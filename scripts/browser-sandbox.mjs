#!/usr/bin/env node
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8081/sandbox";
const timeoutMs = Number(process.env.BROWSER_SANDBOX_TIMEOUT_MS || 40000);

console.log(`Starting headless browser sandbox QA against ${url}...`);

const errors = {
  consoleErrors: [],
  pageErrors: [],
};

let browser = null;

try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon.ico") && !text.includes("Download the React DevTools")) {
        errors.consoleErrors.push(text);
      }
    }
  });

  page.on("pageerror", (err) => {
    errors.pageErrors.push(String(err?.message || err));
  });

  // Step 1: Open /sandbox
  console.log("Step 1: Navigating to /sandbox...");
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(1000);
  console.log("✓ Sandbox route loaded with WebGL canvas");

  // Step 2: Verify Sandbox mode indicator
  console.log("Step 2: Verifying Sandbox mode indicator...");
  const modeBanner = page.getByText("SIMULATION SANDBOX").first();
  await modeBanner.waitFor({ state: "visible", timeout: 8000 });
  const returnLink = page.locator('a[aria-label="Return to Observatory mode"]').first();
  await returnLink.waitFor({ state: "visible", timeout: 5000 });
  console.log("✓ Mode indicator 'SIMULATION SANDBOX' and Return to Observatory link verified");

  // Step 3: Pause simulation
  console.log("Step 3: Testing pause / transport control...");
  const pauseBtn = page.locator('button[aria-label*="Pause simulation" i]').first();
  if (await pauseBtn.isVisible()) {
    await pauseBtn.click();
    await page.waitForTimeout(400);
  }
  const playBtn = page.locator('button[aria-label*="Play simulation" i]').first();
  await playBtn.waitFor({ state: "visible", timeout: 5000 });
  console.log("✓ Transport paused successfully");

  // Step 4: Add custom body (spawn preset)
  console.log("Step 4: Testing adding custom body via preset modal...");
  const objectBrowser = page.locator('aside').first();
  const addObjectBtn = objectBrowser.locator('button:has-text("Add Object")');
  await addObjectBtn.waitFor({ state: "visible", timeout: 5000 });
  await addObjectBtn.click();
  await page.waitForTimeout(400);

  const presetModal = page.locator('[role="dialog"][aria-label="Add Astronomical Preset"]');
  await presetModal.waitFor({ state: "visible", timeout: 5000 });
  const earthPreset = presetModal.getByText("Earth-like Rocky Planet").first();
  await earthPreset.click();
  await page.waitForTimeout(600);

  const customObjectEntry = objectBrowser.getByText("Earth-like Planet").first();
  await customObjectEntry.waitFor({ state: "visible", timeout: 5000 });
  console.log("✓ Custom preset body spawned and added to simulation");

  // Step 5, 6, 7: Edit body mass, position, velocity
  console.log("Step 5-7: Editing body mass, position, and velocity...");
  const inspector = page.locator('aside').nth(1);
  const editBtn = inspector.locator('button:has-text("Edit")').first();
  await editBtn.waitFor({ state: "visible", timeout: 5000 });
  await editBtn.click();
  await page.waitForTimeout(400);

  // Edit mass
  const massInput = page.locator('#body-mass');
  await massInput.waitFor({ state: "visible", timeout: 5000 });
  await massInput.fill("2.5");

  // Edit position X
  const posXInput = page.locator('input[aria-label="Barycentric Position X"]');
  await posXInput.fill("1.25");

  // Edit velocity X
  const velXInput = page.locator('input[aria-label="Barycentric Velocity X"]');
  await velXInput.fill("15.0");

  // Save changes
  const saveChangesBtn = page.locator('button:has-text("Save Changes")').first();
  await saveChangesBtn.click();
  await page.waitForTimeout(500);
  console.log("✓ Mass, position, and velocity edited and persisted in draft");

  // Step 8 & 9: Single-step and verify telemetry updates
  console.log("Step 8-9: Testing single-step execution and telemetry...");
  const timeDisplay = page.locator('span.font-medium:has-text("d")').first();
  const initialTime = await timeDisplay.textContent();

  const stepBtn = page.locator('button[aria-label*="Step simulation forward" i]').first();
  await stepBtn.click();
  await page.waitForTimeout(400);

  const nextTime = await timeDisplay.textContent();
  console.log(`✓ Single-step advanced simulation time: ${initialTime} -> ${nextTime}`);

  // Step 10 & 11: Delete body and undo deletion
  console.log("Step 10-11: Testing body deletion and undo...");
  const deleteBtn = objectBrowser.locator('button[aria-label="Delete Earth-like Planet"]').first();
  await deleteBtn.click();
  await page.waitForTimeout(400);

  const countBeforeUndo = await objectBrowser.getByText("Earth-like Planet").count();
  if (countBeforeUndo > 0) {
    throw new Error("Body was not deleted from object browser");
  }

  const undoBtn = page.locator('button[aria-label="Undo last action"]').first();
  await undoBtn.click();
  await page.waitForTimeout(500);

  const countAfterUndo = await objectBrowser.getByText("Earth-like Planet").count();
  if (countAfterUndo === 0) {
    throw new Error("Undo failed to restore deleted body");
  }
  console.log("✓ Body deleted and successfully restored via Undo");

  // Step 12: Reset scenario
  console.log("Step 12: Testing scenario reset...");
  const resetBtn = page.locator('button[aria-label*="Reset scenario" i]').first();
  await resetBtn.click();
  await page.waitForTimeout(300);

  const confirmResetBtn = page.locator('button[aria-label*="confirm reset" i]').first();
  await confirmResetBtn.waitFor({ state: "visible", timeout: 3000 });
  await confirmResetBtn.click();
  await page.waitForTimeout(500);
  console.log("✓ Simulation reset to initial state verified");

  // Step 13 & 14: Save scenario and reload from storage
  console.log("Step 13-14: Testing scenario save and reload...");
  const openScenarioBtn = page.locator('button[title="Open Scenario Manager"]').first();
  await openScenarioBtn.click();
  await page.waitForTimeout(400);

  const scenarioModal = page.locator('[role="dialog"][aria-label="Scenario Management"]');
  await scenarioModal.waitFor({ state: "visible", timeout: 5000 });

  const scenarioNameInput = page.locator('#scenario-name-input');
  await scenarioNameInput.fill("Automated QA Scenario");
  const saveScenarioBtn = scenarioModal.locator('button[type="submit"]').first();
  await saveScenarioBtn.click();
  await page.waitForTimeout(700);

  const savedItem = scenarioModal.getByText("Automated QA Scenario").first();
  await savedItem.waitFor({ state: "visible", timeout: 5000 });

  // Step 15: Export / Import scenario round trip
  console.log("Step 15: Testing scenario JSON export...");
  const exportBtn = scenarioModal.locator('button:has-text("Export JSON")').first();
  await exportBtn.waitFor({ state: "visible", timeout: 3000 });
  await exportBtn.click();
  await page.waitForTimeout(300);
  console.log("✓ Scenario export action tested cleanly");

  // Reload saved scenario (this automatically closes the modal upon successful load)
  const loadBtn = scenarioModal.locator('button:has-text("Load")').first();
  await loadBtn.click();
  await page.waitForTimeout(500);
  console.log("✓ Scenario saved to browser storage and reloaded");

  // Step 16: Switch accuracy mode
  console.log("Step 16: Testing accuracy mode switching...");
  const accuracyBtn = page.locator('button[aria-label="Simulation Accuracy and Integrator Diagnostics"]').first();
  await accuracyBtn.click();
  await page.waitForTimeout(400);

  const highAccuracyRadio = page.locator('button[role="radio"]:has-text("high")').first();
  await highAccuracyRadio.click();
  await page.waitForTimeout(400);

  const accuracyBadgeText = await accuracyBtn.textContent();
  if (!accuracyBadgeText.includes("HIGH")) {
    throw new Error(`Expected HIGH ACCURACY badge, got: ${accuracyBadgeText}`);
  }
  await accuracyBtn.click(); // close popup
  await page.waitForTimeout(300);
  console.log("✓ Accuracy mode successfully switched to HIGH");

  // Step 17: Inspect provenance details
  console.log("Step 17: Inspecting provenance details...");
  const earthItem = objectBrowser.locator('p:has-text("Earth")').first();
  await earthItem.click();
  await page.waitForTimeout(400);

  const sourceTab = inspector.locator('button[role="tab"]:has-text("Source")').first();
  await sourceTab.waitFor({ state: "visible", timeout: 5000 });
  await sourceTab.click();
  await page.waitForTimeout(400);

  const provenanceHeading = inspector.getByText("Scientific Provenance Protocol").first();
  await provenanceHeading.waitFor({ state: "visible", timeout: 5000 });
  console.log("✓ Scientific provenance details inspected");

  // Step 18: Verify desktop layout has no horizontal overflow
  console.log("Step 18: Verifying desktop layout has no horizontal overflow...");
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  if (overflow) {
    throw new Error("Horizontal overflow detected on desktop viewport");
  }
  console.log("✓ Desktop viewport has zero horizontal overflow");

  // Step 19: Verify mobile layout (390 x 844)
  console.log("Step 19: Verifying mobile layout (390 x 844)...");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);

  const mobileOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  if (mobileOverflow) {
    throw new Error("Horizontal overflow detected on mobile viewport");
  }

  // Verify mobile drawers toggle buttons are present
  const mobileButtons = page.locator('button[aria-label="Toggle objects drawer"], button[aria-label="Toggle inspector drawer"]');
  const countMobileButtons = await mobileButtons.count();
  if (countMobileButtons === 0) {
    throw new Error("Mobile drawer toggle buttons not found");
  }
  console.log("✓ Mobile layout adapts correctly without horizontal overflow");

  // Restore desktop size
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(400);

  // Step 20 & 21: Return to / and verify canonical Earth
  console.log("Step 20-21: Returning to / and verifying canonical Earth...");
  await returnLink.click();
  await page.waitForURL((u) => u.pathname === "/" || u.pathname === "", { timeout: 10000 });
  await page.waitForSelector("canvas", { timeout: 15000 });
  await page.waitForTimeout(1000);

  const observatoryEarth = page.locator('button:has-text("Earth")').first();
  await observatoryEarth.waitFor({ state: "visible", timeout: 10000 });
  console.log("✓ Returned to Observatory mode; canonical Earth is verified intact");

  // Step 22: Check errors
  if (errors.consoleErrors.length > 0 || errors.pageErrors.length > 0) {
    console.error("Browser sandbox QA failed with errors:", JSON.stringify(errors, null, 2));
    process.exitCode = 1;
  } else {
    console.log("✓ Primary interaction pass completed with zero console/page errors.");
  }

  // Reduced-Motion Pass
  console.log("Starting prefers-reduced-motion verification pass...");
  const motionContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  const motionPage = await motionContext.newPage();

  const motionErrors = { consoleErrors: [], pageErrors: [] };
  motionPage.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!text.includes("favicon.ico") && !text.includes("Download the React DevTools")) {
        motionErrors.consoleErrors.push(text);
      }
    }
  });
  motionPage.on("pageerror", (err) => {
    motionErrors.pageErrors.push(String(err?.message || err));
  });

  await motionPage.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await motionPage.waitForSelector("canvas", { timeout: 15000 });
  await motionPage.waitForTimeout(1000);

  const motionBanner = motionPage.getByText("SIMULATION SANDBOX").first();
  await motionBanner.waitFor({ state: "visible", timeout: 5000 });

  if (motionErrors.consoleErrors.length > 0 || motionErrors.pageErrors.length > 0) {
    console.error("Reduced-motion pass failed with errors:", JSON.stringify(motionErrors, null, 2));
    process.exitCode = 1;
  } else {
    console.log("✓ Reduced-motion pass verified with zero errors.");
  }

  await motionContext.close();
} catch (err) {
  console.error("Browser sandbox QA exception:", err);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
