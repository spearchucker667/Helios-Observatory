#!/usr/bin/env node
/**
 * Sandbox browser acceptance QA.
 *
 * Every numbered step below makes at least one assertion that FAILS the run;
 * nothing here is logging-only. Authoritative worker state is read through the
 * read-only `?qa=1` bridge (`window.__heliosSandbox`), so claims about the
 * simulation clock, provenance and deterministic replay are checked against the
 * real engine rather than against rendered labels.
 *
 * Usage: node scripts/browser-sandbox.mjs [http://127.0.0.1:8081/sandbox]
 */
import { chromium } from "playwright";
import fs from "node:fs";

const baseUrl = process.argv[2] || "http://127.0.0.1:8081/sandbox";
const url = baseUrl.includes("?") ? `${baseUrl}&qa=1` : `${baseUrl}?qa=1`;
const timeoutMs = Number(process.env.BROWSER_SANDBOX_TIMEOUT_MS || 45000);

// SI conversion factors mirroring src/simulation/domain/constants.ts
const AU_M = 149597870700;
const EARTH_MASS_KG = 5.9722e24;

const checks = [];
let currentStep = "setup";

function record(name, detail) {
  checks.push({ step: currentStep, name, detail: detail ?? null });
  console.log(`✓ [${currentStep}] ${name}${detail ? ` — ${detail}` : ""}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed in ${currentStep}: ${message}`);
}

function assertClose(actual, expected, relTol, message) {
  const tolerance = Math.abs(expected) * relTol;
  assert(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message} (expected ${expected} ± ${relTol * 100}%, got ${actual})`
  );
}

async function waitFor(page, fn, label, timeout = 10000, interval = 60) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    last = await fn();
    if (last) return last;
    await page.waitForTimeout(interval);
  }
  throw new Error(`${currentStep}: timed out waiting for ${label} (last=${JSON.stringify(last)})`);
}

const summary = (page) => page.evaluate(() => window.__heliosSandbox?.summary() ?? null);
const sessionInfo = (page) => page.evaluate(() => window.__heliosSandbox.session());

async function waitForReady(page, label) {
  currentStep = label;
  // The production sandbox lazy-loads the Three.js canvas chunk separately
  // from the authoritative worker/UI shell. Cold preview startup can delay
  // that visual chunk substantially; worker initialization is the acceptance
  // boundary for this script, while browser-smoke separately requires the
  // Observatory canvas to render.
  await waitFor(
    page,
    async () => {
      const s = await summary(page);
      return s && s.isInitialized && s.bodyCount > 0 && Number.isFinite(s.tick) && Number.isFinite(s.simTimeSeconds) ? s : null;
    },
    "sandbox worker initialization",
    Math.max(timeoutMs, 90000)
  );
}

async function waitForHash(page, expected, label) {
  return waitFor(
    page,
    async () => {
      const s = await summary(page);
      return s && s.worldHash === expected ? s : null;
    },
    `${label} (world hash ${expected.slice(0, 24)}…)`
  );
}

function attachErrorCapture(page, store) {
  const record = (kind, text) => {
    store[kind].push(text);
    runErrors[kind].push(text);
  };
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon.ico") && !text.includes("Download the React DevTools")) {
        record("console", text);
      }
    }
  });
  page.on("pageerror", (err) => record("page", String(err?.message || err)));
  page.on("weberror", (err) => record("page", `worker: ${err?.error?.()?.message ?? err}`));
}

async function openSandbox(browser, { reducedMotion = "no-preference", viewport } = {}) {
  const context = await browser.newContext({
    viewport: viewport ?? { width: 1280, height: 800 },
    reducedMotion,
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = { console: [], page: [] };
  attachErrorCapture(page, errors);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  return { context, page, errors };
}

const runErrors = { console: [], page: [] };
let browser = null;

try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"],
  });

  // ---------------------------------------------------------------------------
  // Step 1 — canonical baseline, captured before any sandbox interaction.
  // ---------------------------------------------------------------------------
  currentStep = "Step 1";
  console.log("Step 1: Capturing canonical (pre-session) sandbox baseline…");
  const baseline = await openSandbox(browser);
  await waitForReady(baseline.page, "Step 1");
  const canonical = await summary(baseline.page);
  assert(canonical.bodyCount >= 8, `expected at least 8 canonical bodies, got ${canonical.bodyCount}`);
  assert(canonical.bodies.earth, "canonical Earth missing from the initial world");
  assert(
    canonical.bodies.earth.provenance.mass === "canonical",
    `Earth mass provenance must be canonical, got ${canonical.bodies.earth.provenance.mass}`
  );
  assert(
    canonical.bodies.earth.provenance.state === "calculated",
    `ephemeris-derived Earth state must be calculated, got ${canonical.bodies.earth.provenance.state}`
  );
  assert(canonical.tick === 0 && canonical.simTimeSeconds === 0, "a fresh session must start at tick 0 / t=0");
  assert(
    canonical.transport === "worker",
    `the sandbox must run on a real Web Worker in a browser, got transport=${canonical.transport} (fallback mode would not prove worker correctness)`
  );
  record(
    "canonical baseline captured and validated on a real Web Worker",
    `${canonical.bodyCount} bodies, transport=${canonical.transport}`
  );
  await baseline.context.close();

  // ---------------------------------------------------------------------------
  // Step 2 — mode chrome + initial playback state equals worker state.
  // ---------------------------------------------------------------------------
  currentStep = "Step 2";
  console.log("Step 2: Verifying mode indicator and initial (paused) playback state…");
  const main = await openSandbox(browser);
  const page = main.page;
  await waitForReady(page, "Step 2");

  await page.getByText("SIMULATION SANDBOX").first().waitFor({ state: "visible", timeout: 8000 });
  const returnLink = page.locator('a[aria-label="Return to Observatory mode"]').first();
  await returnLink.waitFor({ state: "visible", timeout: 5000 });

  const initial = await summary(page);
  assert(initial.playbackState === "paused", `initial playback state must be paused, got ${initial.playbackState}`);
  assert(initial.paused === true, "store must report paused: true while the worker scheduler is paused");
  await page.locator('button[aria-label="Play simulation (Space)"]').first().waitFor({ state: "visible", timeout: 5000 });
  const telemetryState = await page.evaluate(() =>
    document.querySelector("[data-testid=sim-telemetry]")?.getAttribute("data-playback-state") ??
    window.__heliosSandbox?.summary()?.playbackState ?? null
  );
  assert(telemetryState === "paused", `authoritative telemetry must report paused, got ${telemetryState}`);
  record("mode indicator, return link and paused initial state verified", `state=${initial.playbackState}`);

  // ---------------------------------------------------------------------------
  // Step 3 — Play advances the authoritative clock.
  // ---------------------------------------------------------------------------
  currentStep = "Step 3";
  console.log("Step 3: Verifying play advances authoritative simulation time…");
  const beforePlay = await summary(page);
  const playButton = page.locator('button[aria-label="Play simulation (Space)"]').first();
  await playButton.waitFor({ state: "visible", timeout: 5000 });
  await playButton.click();
  const advanced = await waitFor(
    page,
    async () => {
      const s = await summary(page);
      return s.playbackState === "running" && s.simTimeSeconds > beforePlay.simTimeSeconds + 60 ? s : null;
    },
    "authoritative time to advance while playing",
    8000
  );
  assert(advanced.tick > beforePlay.tick, "tick counter must increase while running");
  const liveTelemetry = await page.evaluate(() =>
    document.querySelector("[data-testid=sim-telemetry]")?.getAttribute("data-playback-state") ??
    window.__heliosSandbox?.summary()?.playbackState ?? null
  );
  assert(liveTelemetry === "running", `authoritative telemetry must report running, got ${liveTelemetry}`);
  record("play advanced authoritative time", `t=${beforePlay.simTimeSeconds}s → ${advanced.simTimeSeconds}s`);

  // ---------------------------------------------------------------------------
  // Step 4 — Pause freezes the authoritative clock.
  // ---------------------------------------------------------------------------
  currentStep = "Step 4";
  console.log("Step 4: Verifying pause freezes authoritative simulation time…");
  await page.locator('button[aria-label="Pause simulation (Space)"]').first().click();
  await waitFor(page, async () => (await summary(page)).playbackState === "paused", "paused state after pause", 5000);
  const frozenA = await summary(page);
  await page.waitForTimeout(700);
  const frozenB = await summary(page);
  assert(frozenA.tick === frozenB.tick, `tick advanced while paused: ${frozenA.tick} → ${frozenB.tick}`);
  assert(
    frozenA.simTimeSeconds === frozenB.simTimeSeconds,
    `sim time advanced while paused: ${frozenA.simTimeSeconds} → ${frozenB.simTimeSeconds}`
  );
  record("pause froze the authoritative clock", `tick held at ${frozenB.tick}`);

  // ---------------------------------------------------------------------------
  // Step 5 — Single step advances exactly one dt and stays paused.
  // ---------------------------------------------------------------------------
  currentStep = "Step 5";
  console.log("Step 5: Verifying single-step advances exactly one dt and remains paused…");
  const beforeStep = await summary(page);
  assert(Number.isFinite(beforeStep.dtSeconds) && beforeStep.dtSeconds > 0, `dt must be finite, got ${beforeStep.dtSeconds}`);
  await page.locator('button[aria-label*="Step simulation forward"]').first().click();
  const stepped = await waitFor(
    page,
    async () => {
      const s = await summary(page);
      return s.tick === beforeStep.tick + 1 ? s : null;
    },
    "exactly one authoritative step",
    6000
  );
  assertClose(stepped.simTimeSeconds, beforeStep.simTimeSeconds + beforeStep.dtSeconds, 1e-9, "single step must advance exactly one dt");
  assert(stepped.dtSeconds === beforeStep.dtSeconds, "single step must not change dt");
  assert(stepped.playbackState === "paused", `single step must leave the engine paused, got ${stepped.playbackState}`);
  await page.waitForTimeout(400);
  const afterStepIdle = await summary(page);
  assert(
    afterStepIdle.tick === stepped.tick,
    `no additional stepping may occur after a manual step (tick ${stepped.tick} → ${afterStepIdle.tick})`
  );
  record("single step advanced exactly one dt and stayed paused", `dt=${beforeStep.dtSeconds}s`);

  // ---------------------------------------------------------------------------
  // Step 6 — Single step requested while running leaves the engine paused.
  // ---------------------------------------------------------------------------
  currentStep = "Step 6";
  console.log("Step 6: Verifying single-step issued while running pauses the engine…");
  await page.locator('button[aria-label="Play simulation (Space)"]').first().click();
  await waitFor(page, async () => (await summary(page)).playbackState === "running", "running state", 5000);
  await page.locator('button[aria-label*="Step simulation forward"]').first().click();
  const afterRunningStep = await waitFor(
    page,
    async () => {
      const s = await summary(page);
      return s.playbackState === "paused" ? s : null;
    },
    "engine to settle into paused after stepping while running",
    6000
  );
  await page.waitForTimeout(500);
  const stillPaused = await summary(page);
  assert(
    stillPaused.tick === afterRunningStep.tick,
    `engine kept stepping after a manual step from running (${afterRunningStep.tick} → ${stillPaused.tick})`
  );
  record("single-step from running paused the engine", `tick held at ${stillPaused.tick}`);

  // ---------------------------------------------------------------------------
  // Step 7-9 — Edits reach the authoritative world and move provenance.
  // ---------------------------------------------------------------------------
  currentStep = "Step 7";
  console.log("Step 7: Editing Earth mass and verifying authoritative value + provenance…");
  const objectBrowser = page.locator("aside").first();
  const inspector = page.locator("aside").nth(1);
  const hashBeforeEdits = (await summary(page)).worldHash;

  await objectBrowser.getByText("Earth", { exact: true }).first().click();
  await waitFor(page, async () => (await summary(page)).bodyIds.includes("earth"), "Earth selection");

  await inspector.locator('button[aria-label="Edit object properties"]').first().click();
  const massInput = page.locator("#body-mass");
  await massInput.waitFor({ state: "visible", timeout: 5000 });
  await massInput.fill("2.5");
  await page.locator('button:has-text("Save Changes")').first().click();

  const afterMassEdit = await waitFor(
    page,
    async () => {
      const s = await summary(page);
      return s.bodies.earth && Math.abs(s.bodies.earth.mass - 2.5 * EARTH_MASS_KG) < 1e20 ? s : null;
    },
    "authoritative Earth mass update",
    8000
  );
  assertClose(afterMassEdit.bodies.earth.mass, 2.5 * EARTH_MASS_KG, 1e-5, "edited mass must reach the authoritative world");
  assert(
    afterMassEdit.bodies.earth.provenance.mass === "custom",
    `an edited mass must become custom provenance, got ${afterMassEdit.bodies.earth.provenance.mass}`
  );
  assert(
    afterMassEdit.bodies.earth.provenance.radius === "canonical",
    `a mass-only edit must not rewrite radius provenance, got ${afterMassEdit.bodies.earth.provenance.radius}`
  );
  assert(
    afterMassEdit.bodies.earth.provenance.state === "calculated",
    `a mass-only edit must not rewrite state provenance, got ${afterMassEdit.bodies.earth.provenance.state}`
  );
  record("mass edit reached the world and became custom provenance", `mass=${afterMassEdit.bodies.earth.mass.toExponential(3)} kg`);

  currentStep = "Step 8";
  console.log("Step 8: Editing position/velocity and verifying numeric reflection…");
  await inspector.locator('button[aria-label="Edit object properties"]').first().click();
  await page.locator("#body-mass").waitFor({ state: "visible", timeout: 5000 });
  await page.locator('input[aria-label="Barycentric Position X"]').fill("1.25");
  await page.locator('input[aria-label="Barycentric Velocity X"]').fill("15.0");
  await page.locator('button:has-text("Save Changes")').first().click();

  const afterVectorEdit = await waitFor(
    page,
    async () => {
      const s = await summary(page);
      const e = s.bodies.earth;
      return e && Math.abs(e.position[0] - 1.25 * AU_M) < 1e6 ? s : null;
    },
    "authoritative position update",
    8000
  );
  assertClose(afterVectorEdit.bodies.earth.position[0], 1.25 * AU_M, 1e-6, "edited position X must reach the world in SI metres");
  assertClose(afterVectorEdit.bodies.earth.velocity[0], 15000, 1e-6, "edited velocity X must reach the world in m/s");
  assert(
    afterVectorEdit.bodies.earth.provenance.state === "custom",
    `an edited state must become custom provenance, got ${afterVectorEdit.bodies.earth.provenance.state}`
  );
  assert(afterVectorEdit.worldHash !== hashBeforeEdits, "edited world must differ from the pre-edit world");
  record(
    "position/velocity edits reflected numerically",
    `x=${afterVectorEdit.bodies.earth.position[0].toExponential(6)} m, vx=${afterVectorEdit.bodies.earth.velocity[0]} m/s`
  );

  // ---------------------------------------------------------------------------
  // Step 9 — Undo restores the exact pre-edit authoritative world.
  // ---------------------------------------------------------------------------
  currentStep = "Step 9";
  console.log("Step 9: Verifying undo restores the exact pre-edit authoritative world…");
  const undoButton = page.locator('button[aria-label="Undo last action"]').first();
  for (let attempt = 0; attempt < 6; attempt++) {
    const s = await summary(page);
    if (s.worldHash === hashBeforeEdits) break;
    if (!s.canUndo) break;
    await undoButton.click();
    await page.waitForTimeout(400);
  }
  const afterUndo = await waitForHash(page, hashBeforeEdits, "undo to restore the pre-edit world");
  assert(
    afterUndo.bodies.earth.provenance.mass === "canonical",
    `undo must restore canonical provenance, got ${afterUndo.bodies.earth.provenance.mass}`
  );
  record("undo restored the exact pre-edit world (provenance included)");

  // ---------------------------------------------------------------------------
  // Step 10 — Reset restores the canonical initial state exactly.
  // ---------------------------------------------------------------------------
  currentStep = "Step 10";
  console.log("Step 10: Verifying reset restores the canonical initial state exactly…");
  await page.locator('button[aria-label="Reset scenario to initial state"]').first().click();
  await page.locator('button[aria-label="Click again to confirm reset"]').first().click();
  const afterReset = await waitFor(
    page,
    async () => {
      const s = await summary(page);
      return s.tick === 0 && s.simTimeSeconds === 0 ? s : null;
    },
    "reset to tick 0 / t=0",
    8000
  );
  assert(afterReset.worldHash === canonical.worldHash, "reset must restore the canonical initial world exactly");
  assert(afterReset.playbackState === "paused", `reset must leave the engine paused, got ${afterReset.playbackState}`);
  record("reset restored the canonical initial state exactly", `${afterReset.bodyCount} bodies at tick 0`);

  // ---------------------------------------------------------------------------
  // Step 11 — Saved scenarios carry authentic command chronology.
  // ---------------------------------------------------------------------------
  currentStep = "Step 11";
  console.log("Step 11: Evolving the session, then checking saved command chronology is authentic…");
  const evolvedPlayButton = page.locator('button[aria-label="Play simulation (Space)"]').first();
  await evolvedPlayButton.waitFor({ state: "visible", timeout: 5000 });
  await evolvedPlayButton.click();
  await waitFor(
    page,
    async () => {
      const s = await summary(page);
      return s && s.playbackState === "running" && s.tick > 0 && s.simTimeSeconds > 3600 ? s : null;
    },
    "real simulation evolution (tick > 0, t > 1 h)",
    10000
  );
  const evolvedPauseButton = page.locator('button[aria-label="Pause simulation (Space)"]').first();
  await evolvedPauseButton.waitFor({ state: "visible", timeout: 5000 });
  await evolvedPauseButton.click();
  await waitFor(page, async () => (await summary(page))?.playbackState === "paused", "paused before edit", 5000);

  // One edit after a real elapsed epoch: its logged tick/time must reflect that
  // epoch, not its position in the edit history.
  await objectBrowser.getByText("Earth", { exact: true }).first().click();
  await inspector.locator('button[aria-label="Edit object properties"]').first().click();
  await page.locator("#body-mass").waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#body-mass").fill("3.25");
  await page.locator('button:has-text("Save Changes")').first().click();
  await waitFor(
    page,
    async () => Math.abs((await summary(page)).bodies.earth.mass - 3.25 * EARTH_MASS_KG) < 1e20,
    "post-evolution mass edit",
    8000
  );

  const evolved = await summary(page);
  await page.locator('button[title="Open Scenario Manager"]').first().click();
  const scenarioModal = page.locator('[role="dialog"][aria-label="Scenario Management"]');
  await scenarioModal.waitFor({ state: "visible", timeout: 5000 });
  await page.locator("#scenario-name-input").fill("QA Chronology Scenario");
  await scenarioModal.locator('button[type="submit"]').first().click();
  const saved = await waitFor(
    page,
    async () => {
      const s = await summary(page);
      return s.savedScenarios.some((entry) => entry.name === "QA Chronology Scenario") ? s : null;
    },
    "scenario save",
    12000
  );
  assert(saved.storageWarning === null, `scenario storage reported a warning: ${saved.storageWarning}`);
  const saveErrorText = await scenarioModal.locator("[class*='rose-500']").count();
  assert(saveErrorText === 0, "the scenario manager displayed a save/import error after saving");

  const session = await sessionInfo(page);
  assert(session.commands.length > 0, "a saved session must record at least one command");
  const lastCommand = session.commands[session.commands.length - 1];
  assert(
    Number.isFinite(lastCommand.dtSeconds ?? session.checkpoint.dtSeconds),
    "session must report a finite dt"
  );
  const dt = session.checkpoint.dtSeconds;
  assert(lastCommand.tick > 0, `logged command tick must be the authentic tick, got ${lastCommand.tick}`);
  assert(
    lastCommand.simTimeSeconds > 3600,
    `logged command time must be the authentic simulated epoch, got ${lastCommand.simTimeSeconds}s`
  );
  assertClose(lastCommand.simTimeSeconds, lastCommand.tick * dt, 1e-6, "logged command time must equal tick × dt");
  assert(
    session.checkpoint.tick >= lastCommand.tick,
    `checkpoint tick ${session.checkpoint.tick} must be at or after the last command tick ${lastCommand.tick}`
  );
  record(
    "saved scenario recorded authentic command chronology",
    `${session.commands.length} command(s); last at tick ${lastCommand.tick}, t=${lastCommand.simTimeSeconds}s`
  );

  // ---------------------------------------------------------------------------
  // Step 12 — Export JSON carries the same authentic chronology and endpoint.
  // ---------------------------------------------------------------------------
  currentStep = "Step 12";
  console.log("Step 12: Exporting scenario JSON and validating the document…");
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 10000 }),
    scenarioModal.locator('button:has-text("Export JSON")').first().click(),
  ]);
  const downloadPath = await download.path();
  const exportedJson = fs.readFileSync(downloadPath, "utf-8");
  const doc = JSON.parse(exportedJson);
  assert(doc.format === "helios-scenario", `exported document format must be helios-scenario, got ${doc.format}`);
  assert(Array.isArray(doc.commands) && doc.commands.length === session.commands.length, "export must include the authoritative command log");
  assert(doc.commands[doc.commands.length - 1].tick === lastCommand.tick, "exported command ticks must match the authoritative log");
  assert(
    doc.commands[doc.commands.length - 1].simTimeSeconds === lastCommand.simTimeSeconds,
    "exported command times must match the authoritative log"
  );
  assert(
    doc.commands[0].tick !== 0 || doc.commands[0].simTimeSeconds !== 0,
    "exported chronology must not be index-derived (first command cannot be tick 0 / t=0 after real evolution)"
  );
  assert(doc.finalState && typeof doc.finalState.tick === "number", "exported document must define finalState");
  assert(doc.finalState.tick === evolved.tick, `finalState.tick ${doc.finalState.tick} must equal the authoritative tick ${evolved.tick}`);
  assert(
    doc.finalState.simTimeSeconds === evolved.simTimeSeconds,
    "finalState.simTimeSeconds must equal the authoritative simulated time"
  );
  record(
    "exported document carries authentic chronology and final state",
    `${doc.commands.length} command(s), finalTick=${doc.finalState.tick}`
  );

  const savedWorldHash = evolved.worldHash;
  const savedTick = evolved.tick;
  const savedSimTime = evolved.simTimeSeconds;
  await scenarioModal.locator("button:has-text('Close')").last().click();
  await page.waitForTimeout(200);

  // ---------------------------------------------------------------------------
  // Step 13 — Reload + load reproduces the identical authoritative endpoint.
  // ---------------------------------------------------------------------------
  currentStep = "Step 13";
  console.log("Step 13: Reloading the app and loading the saved scenario from storage…");
  await page.reload({ waitUntil: "domcontentloaded", timeout: timeoutMs });
  await waitForReady(page, "Step 13");
  const afterReload = await summary(page);
  assert(afterReload.tick === 0, `a reloaded session must start fresh at tick 0, got ${afterReload.tick}`);

  await page.locator('button[title="Open Scenario Manager"]').first().click();
  const reloadedModal = page.locator('[role="dialog"][aria-label="Scenario Management"]');
  await reloadedModal.waitFor({ state: "visible", timeout: 5000 });
  const storedItem = reloadedModal.getByText("QA Chronology Scenario").first();
  await storedItem.waitFor({ state: "visible", timeout: 8000 });

  await reloadedModal.locator("button:has-text('Load')").first().click();
  const replayed = await waitFor(
    page,
    async () => {
      const s = await summary(page);
      return s.tick === savedTick && s.simTimeSeconds === savedSimTime ? s : null;
    },
    "deterministic replay to the saved final tick",
    20000
  );
  assert(replayed.playbackState === "paused", `a replayed scenario must settle paused, got ${replayed.playbackState}`);
  await waitForHash(page, savedWorldHash, "replayed world to match the saved world");
  record("reload + load reproduced the identical authoritative endpoint", `tick=${savedTick}, t=${savedSimTime}s`);

  // ---------------------------------------------------------------------------
  // Step 14 — Column: IndexedDB import of the exported document in a new profile.
  // ---------------------------------------------------------------------------
  currentStep = "Step 14";
  console.log("Step 14: Importing the exported JSON into a fresh browser profile…");
  const fresh = await openSandbox(browser);
  await waitForReady(fresh.page, "Step 14");
  const freshBefore = await summary(fresh.page);
  assert(freshBefore.tick === 0 && freshBefore.savedScenarios.length === 0, "a fresh profile must start with no saved scenarios");

  await fresh.page.locator('button[title="Open Scenario Manager"]').first().click();
  const freshModal = fresh.page.locator('[role="dialog"][aria-label="Scenario Management"]');
  await freshModal.waitFor({ state: "visible", timeout: 5000 });
  await freshModal.locator('input[type="file"]').setInputFiles({
    name: "qa-chronology-scenario.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportedJson, "utf-8"),
  });
  const imported = await waitFor(
    fresh.page,
    async () => {
      const s = await summary(fresh.page);
      return s.tick === savedTick && s.simTimeSeconds === savedSimTime ? s : null;
    },
    "JSON import to reproduce the saved endpoint",
    20000
  );
  await waitForHash(fresh.page, savedWorldHash, "imported world to match the exported world");
  assert(imported.bodyCount === replayed.bodyCount, "imported world must contain the same bodies");
  assert(
    imported.bodyIds.join(",") === replayed.bodyIds.join(","),
    "imported world must contain the same body ids"
  );
  record("JSON import reproduced the exported scenario numerically", `tick=${imported.tick}, bodies=${imported.bodyCount}`);
  assert(
    fresh.errors.console.length === 0 && fresh.errors.page.length === 0,
    `import profile produced browser errors: ${JSON.stringify(fresh.errors)}`
  );
  await fresh.context.close();

  // ---------------------------------------------------------------------------
  // Step 15 — Canonical data deep equality after a full session.
  // ---------------------------------------------------------------------------
  currentStep = "Step 15";
  console.log("Step 15: Verifying canonical data is unchanged after the whole session…");
  const canonicalAfter = await openSandbox(browser);
  await waitForReady(canonicalAfter.page, "Step 15");
  const post = await summary(canonicalAfter.page);
  assert(
    post.worldHash === canonical.worldHash,
    "a fresh sandbox after the session must reproduce the canonical baseline exactly (mass, radius, state and provenance)"
  );
  assert(
    post.bodies.earth.provenance.mass === "canonical",
    `canonical Earth mass provenance must survive a session, got ${post.bodies.earth.provenance.mass}`
  );
  assert(
    post.bodies.earth.mass === canonical.bodies.earth.mass && post.bodies.earth.radius === canonical.bodies.earth.radius,
    "canonical Earth mass/radius must be untouched by sandbox edits"
  );
  record("canonical baseline reproduced exactly after a full editing session");
  await canonicalAfter.context.close();

  // ---------------------------------------------------------------------------
  // Step 16 — Documented keyboard shortcuts.
  // ---------------------------------------------------------------------------
  currentStep = "Step 16";
  console.log("Step 16: Verifying documented keyboard shortcuts…");
  const kb = await openSandbox(browser);
  await waitForReady(kb.page, "Step 16");
  await kb.page.locator("body").click({ position: { x: 5, y: 400 } });

  await kb.page.keyboard.press("Space");
  await waitFor(kb.page, async () => (await summary(kb.page)).playbackState === "running", "Space to start playback", 5000);
  await kb.page.keyboard.press("Space");
  await waitFor(kb.page, async () => (await summary(kb.page)).playbackState === "paused", "Space to pause playback", 5000);

  const beforePeriod = await summary(kb.page);
  await kb.page.keyboard.press(".");
  const afterPeriod = await waitFor(
    kb.page,
    async () => {
      const s = await summary(kb.page);
      return s.tick === beforePeriod.tick + 1 ? s : null;
    },
    "period shortcut to single-step",
    6000
  );
  assertClose(afterPeriod.simTimeSeconds, beforePeriod.simTimeSeconds + beforePeriod.dtSeconds, 1e-9, "period shortcut must advance exactly one dt");

  await kb.page.keyboard.press("i");
  await waitFor(
    kb.page,
    async () => (await kb.page.locator('button[role="tab"][aria-selected="true"]').first().textContent()) !== null,
    "inspector tab to render after 'i'",
    5000
  );

  await kb.page.keyboard.press("e");
  await kb.page.locator("#body-mass").waitFor({ state: "visible", timeout: 5000 });
  await kb.page.keyboard.press("Escape");
  await waitFor(
    kb.page,
    async () => (await kb.page.locator("#body-mass").count()) === 0,
    "'Escape' to close the editor",
    5000
  );

  await kb.page.keyboard.press("s");
  await kb.page.locator('[role="dialog"][aria-label="Scenario Management"]').waitFor({ state: "visible", timeout: 5000 });
  await kb.page.keyboard.press("Escape");
  await waitFor(
    kb.page,
    async () => (await kb.page.locator('[role="dialog"][aria-label="Scenario Management"]').count()) === 0,
    "'Escape' to close the scenario manager",
    5000
  );
  record("documented shortcuts Space / . / I / E / S / Escape verified");
  assert(kb.errors.console.length === 0 && kb.errors.page.length === 0, `keyboard pass produced errors: ${JSON.stringify(kb.errors)}`);
  await kb.context.close();

  // ---------------------------------------------------------------------------
  // Step 17 — Mobile layout.
  // ---------------------------------------------------------------------------
  currentStep = "Step 17";
  console.log("Step 17: Verifying mobile layout (390×844)…");
  const mobile = await openSandbox(browser, { viewport: { width: 390, height: 844 } });
  await waitForReady(mobile.page, "Step 17");
  await mobile.page.waitForTimeout(600);
  const mobileOverflow = await mobile.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert(!mobileOverflow, "mobile viewport must not scroll horizontally");
  const browserToggle = mobile.page.locator('button[aria-label="Toggle objects drawer"]').first();
  const inspectorToggle = mobile.page.locator('button[aria-label="Toggle inspector drawer"]').first();
  await browserToggle.waitFor({ state: "visible", timeout: 5000 });
  await inspectorToggle.waitFor({ state: "visible", timeout: 5000 });
  await browserToggle.click();
  const objectsDrawer = mobile.page.locator('[role="dialog"][aria-label="Celestial Objects Drawer"]');
  await objectsDrawer.waitFor({ state: "visible", timeout: 5000 });
  // Dismiss the objects drawer before reaching the header toggle underneath it.
  // The drawer panel hugs the left edge, so click the backdrop area on the right.
  await objectsDrawer.click({ position: { x: 380, y: 700 } });
  await waitFor(
    mobile.page,
    async () => (await mobile.page.locator('[role="dialog"][aria-label="Celestial Objects Drawer"]').count()) === 0,
    "objects drawer to close",
    5000
  );
  await inspectorToggle.click();
  await mobile.page.locator('[role="dialog"][aria-label="Body Inspector Sheet"]').waitFor({ state: "visible", timeout: 5000 });
  record("mobile layout has no horizontal overflow and both drawers open");
  assert(
    mobile.errors.console.length === 0 && mobile.errors.page.length === 0,
    `mobile pass produced errors: ${JSON.stringify(mobile.errors)}`
  );
  await mobile.context.close();

  // ---------------------------------------------------------------------------
  // Step 18 — Reduced motion.
  // ---------------------------------------------------------------------------
  currentStep = "Step 18";
  console.log("Step 18: Verifying prefers-reduced-motion suppression…");
  const reduced = await openSandbox(browser, { reducedMotion: "reduce" });
  await waitForReady(reduced.page, "Step 18");
  const motionState = await reduced.page.evaluate(() => {
    const probe = document.querySelector("header span.animate-pulse, header .animate-pulse, span.animate-pulse");
    const style = probe ? window.getComputedStyle(probe) : null;
    return {
      matches: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      foundProbe: Boolean(probe),
      animationDuration: style?.animationDuration ?? null,
      transitionDuration: style?.transitionDuration ?? null,
    };
  });
  assert(motionState.matches, "the reduced-motion media query must be active in this pass");
  assert(motionState.foundProbe, "a motion-carrying element must be present to test suppression");
  const toSeconds = (value) => {
    if (typeof value !== "string") return Number.NaN;
    const match = value.trim().match(/^([\d.eE+-]+)(ms|s)$/);
    if (!match) return Number.NaN;
    const seconds = Number(match[1]) * (match[2] === "ms" ? 0.001 : 1);
    return Number.isFinite(seconds) ? seconds : Number.NaN;
  };
  const animationSeconds = toSeconds(motionState.animationDuration);
  assert(
    Number.isFinite(animationSeconds) && animationSeconds < 0.001,
    `animation duration must be suppressed under reduced motion, got ${motionState.animationDuration}`
  );
  record(
    "reduced-motion media query active and motion durations suppressed",
    `animation-duration=${motionState.animationDuration}`
  );
  assert(
    reduced.errors.console.length === 0 && reduced.errors.page.length === 0,
    `reduced-motion pass produced errors: ${JSON.stringify(reduced.errors)}`
  );
  await reduced.context.close();

  // ---------------------------------------------------------------------------
  // Step 19 — Observed render frame rate and snapshot cadence (measured, not asserted as a promise).
  // ---------------------------------------------------------------------------
  currentStep = "Step 19";
  console.log("Step 19: Measuring render frame rate and snapshot cadence while playing…");
  await page.locator('button[aria-label="Play simulation (Space)"]').first().click();
  await waitFor(page, async () => (await summary(page)).playbackState === "running", "running state for perf sample", 5000);
  const perf = await page.evaluate(async () => {
    const telemetry = () => document.querySelector("[data-testid=sim-telemetry]");
    const readTick = () => Number(
      telemetry()?.getAttribute("data-tick") ?? window.__heliosSandbox?.summary()?.tick ?? 0
    );
    const startTick = readTick();
    let frames = 0;
    let stop = false;
    const countFrame = () => {
      frames++;
      if (!stop) requestAnimationFrame(countFrame);
    };
    requestAnimationFrame(countFrame);
    const started = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 2000));
    stop = true;
    const elapsedSeconds = (performance.now() - started) / 1000;
    return { frames, elapsedSeconds, tickDelta: readTick() - startTick };
  });
  // Read the warp telemetry *while still running* — sampling it after the pause
  // click would report the paused rate (0 d/s) against the requested rate.
  const summaryAfterPerf = await summary(page);
  await page.locator('button[aria-label="Pause simulation (Space)"]').first().click();
  const observedFps = perf.frames / perf.elapsedSeconds;
  const observedStepsPerSecond = perf.tickDelta / perf.elapsedSeconds;
  // The render loop must stay alive while physics runs, and the published
  // authoritative tick must advance. Absolute frame rate is environment
  // specific (this pass runs on software WebGL), so it is reported as a
  // measurement rather than asserted as a promise.
  assert(perf.frames >= 2, `the render loop must keep painting while physics runs, saw ${perf.frames} frames`);
  assert(
    observedStepsPerSecond >= 1,
    `the worker must publish authoritative steps while playing, measured ${observedStepsPerSecond.toFixed(1)} steps/s`
  );
  record(
    "render loop alive and authoritative steps published while playing",
    `${perf.frames} frames (${observedFps.toFixed(1)} fps) in ${perf.elapsedSeconds.toFixed(2)} s, ` +
      `${observedStepsPerSecond.toFixed(1)} physics steps/s, achieved warp ` +
      `${summaryAfterPerf.achievedRateDaysPerSec?.toFixed(2) ?? "n/a"} d/s of ` +
      `${summaryAfterPerf.requestedRateDaysPerSec?.toFixed(2) ?? "n/a"} requested`
  );

  // ---------------------------------------------------------------------------
  // Step 20 — Return to the Observatory and confirm it still renders.
  // ---------------------------------------------------------------------------
  currentStep = "Step 20";
  console.log("Step 20: Returning to the Observatory and verifying it renders…");
  await returnLink.click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "", { timeout: 15000 });
  await page.waitForSelector("canvas", { timeout: 20000 });
  const observatoryText = await page.evaluate(() => document.body.innerText.trim().length);
  assert(observatoryText > 40, `Observatory must render visible content, found ${observatoryText} characters`);
  assert(
    main.errors.console.length === 0 && main.errors.page.length === 0,
    `the sandbox session produced browser errors: ${JSON.stringify(main.errors)}`
  );
  record("returned to the Observatory with rendered content and zero browser errors", `${observatoryText} characters of text`);
  await main.context.close();
} catch (err) {
  console.error(`✗ ${currentStep}: ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
  // Diagnostics: the current message and any captured console output.
  if (runErrors.console.length > 0 || runErrors.page.length > 0) {
    console.error("captured browser errors:", JSON.stringify(runErrors, null, 2));
  }
} finally {
  await browser?.close();
}

const failed = process.exitCode === 1;
const verdict = {
  url,
  passed: checks.length,
  failed: failed ? 1 : 0,
  checks,
  errors: runErrors,
};
console.log(JSON.stringify(verdict, null, 2));
if (failed) {
  console.error("Sandbox browser acceptance FAILED.");
} else {
  console.log(`Sandbox browser acceptance passed with ${checks.length} asserted checks.`);
}
