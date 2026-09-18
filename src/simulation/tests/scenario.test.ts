import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS } from "../domain/presets.ts";
import { createWorldSnapshot } from "../engine/snapshot.ts";
import { ENGINE_VERSION } from "../engine/engine-version.ts";
import { serializeScenario, deserializeScenario } from "../scenarios/serialize.ts";
import {
  saveScenario,
  loadScenario,
  listScenarios,
  deleteScenario,
  clearInMemoryScenarios,
  __putRawScenarioForTest,
} from "../scenarios/storage.ts";
import { SCENARIO_SCHEMA_VERSION, type ScenarioDocument } from "../scenarios/schema.ts";
import { replaySimulation } from "../engine/replay.ts";
import { SimulationWorld } from "../engine/world.ts";
import type { SimulationBody } from "../domain/types.ts";

function createTestScenarioDoc(id = "test-scen-1", name = "Test Scenario"): ScenarioDocument {
  const earth = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "earth" });
  const sun = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "sun" });

  const snapshot = createWorldSnapshot([sun, earth], 0, 0, 900);

  return {
    format: "helios-scenario",
    schemaVersion: SCENARIO_SCHEMA_VERSION,
    engineVersion: ENGINE_VERSION,
    id,
    name,
    description: "Scenario for testing serialization and storage",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    initialState: snapshot,
    commands: [
      {
        tick: 5,
        simTimeSeconds: 4500,
        command: { type: "apply_impulse", id: "earth", impulseMs: [0, 100, 0] },
      },
    ],
    finalState: { tick: 20, simTimeSeconds: 18000 },
  };
}

test("save/load equality in storage", async () => {
  clearInMemoryScenarios();
  const doc = createTestScenarioDoc("scen-storage-1", "Storage Test");

  await saveScenario(doc);
  const loaded = await loadScenario("scen-storage-1");

  assert.ok(loaded);
  assert.deepEqual(loaded, doc, "Loaded scenario must match saved scenario");

  const list = await listScenarios();
  assert.equal(list.scenarios.length, 1);
  assert.equal(list.scenarios[0].id, "scen-storage-1");
  assert.equal(list.skippedInvalid, 0);

  await deleteScenario("scen-storage-1");
  const afterDelete = await loadScenario("scen-storage-1");
  assert.equal(afterDelete, null);
});

test("export/import serialization equality", () => {
  const doc = createTestScenarioDoc("scen-export-1", "Export Test");
  const json = serializeScenario(doc);
  const imported = deserializeScenario(json);

  assert.deepEqual(imported, doc, "Imported scenario must equal exported document");
});

test("malformed JSON is rejected with descriptive error", () => {
  assert.throws(() => deserializeScenario("{ invalid json ]"), /Malformed JSON/);
});

test("strict schemas reject unknown top-level and nested fields", () => {
  const doc = createTestScenarioDoc("strict-1");
  const withExtraTopLevel = { ...doc, sneaky: true };
  assert.throws(
    () => deserializeScenario(JSON.stringify(withExtraTopLevel)),
    /Scenario schema validation failed/
  );

  const withExtraBody = structuredClone(doc) as unknown as Record<string, unknown>;
  (withExtraBody.initialState as { bodies: unknown[] }).bodies = [
    { ...doc.initialState.bodies[0], injected: 1 },
    doc.initialState.bodies[1],
  ];
  assert.throws(
    () => deserializeScenario(JSON.stringify(withExtraBody)),
    /Scenario schema validation failed/
  );

  // A generic body patch is no longer part of the command contract at all.
  const withGenericPatch = structuredClone(doc) as unknown as Record<string, unknown>;
  (withGenericPatch.commands as unknown[]) = [
    { tick: 1, simTimeSeconds: 900, command: { type: "update_body", id: "earth", updates: { mass: 1 } } },
  ];
  assert.throws(
    () => deserializeScenario(JSON.stringify(withGenericPatch)),
    /Scenario schema validation failed/
  );
});

test("oversized bodies array (> 1024 bodies or > 256 massive) is rejected", () => {
  const doc = createTestScenarioDoc("oversized-1");
  const baseBody = doc.initialState.bodies[0];

  const massiveInflated = [];
  for (let i = 0; i < 257; i++) {
    massiveInflated.push({
      ...baseBody,
      id: `body-massive-${i}`,
      name: `Massive Body ${i}`,
      gravityRole: "massive" as const,
    });
  }
  doc.initialState.bodies = massiveInflated;
  assert.throws(() => deserializeScenario(JSON.stringify(doc)), /Maximum 256 massive bodies supported/);

  const totalInflated = [];
  for (let i = 0; i < 1025; i++) {
    totalInflated.push({
      ...baseBody,
      id: `body-total-${i}`,
      name: `Total Body ${i}`,
      gravityRole: "tracer" as const,
    });
  }
  doc.initialState.bodies = totalInflated;
  assert.throws(() => deserializeScenario(JSON.stringify(doc)), /Maximum 1024 bodies supported/);
});

test("duplicate body IDs in the initial state and in the command log are rejected", () => {
  const doc = createTestScenarioDoc("dup-1");
  doc.initialState.bodies = [
    { ...doc.initialState.bodies[0], id: "identical-id" },
    { ...doc.initialState.bodies[1], id: "identical-id" },
  ];
  assert.throws(() => deserializeScenario(JSON.stringify(doc)), /Duplicate body ID.*identical-id/);

  const doc2 = createTestScenarioDoc("dup-2");
  doc2.commands = [
    {
      tick: 1,
      simTimeSeconds: 900,
      command: { type: "add_body", body: { ...doc2.initialState.bodies[0], id: "sun" } },
    },
  ];
  assert.throws(
    () => deserializeScenario(JSON.stringify(doc2)),
    /command log introduces duplicate body ID/i
  );
});

test("non-monotonic command chronology is rejected", () => {
  const doc = createTestScenarioDoc("chrono-1");
  doc.commands = [
    { tick: 50, simTimeSeconds: 45000, command: { type: "set_dt", dtSeconds: 60 } },
    { tick: 10, simTimeSeconds: 9000, command: { type: "set_dt", dtSeconds: 120 } },
  ];
  assert.throws(() => deserializeScenario(JSON.stringify(doc)), /moves backwards in tick/);
});

test("future unsupported schema version is rejected", () => {
  const doc = createTestScenarioDoc("future-1") as unknown as Record<string, unknown>;
  doc.schemaVersion = 999;
  assert.throws(() => deserializeScenario(JSON.stringify(doc)), /Unsupported future scenario schema version: 999/);
});

test("v1 scenarios migrate: typed commands replace update_body and pause/resume disappear", () => {
  const legacy = {
    format: "helios-scenario",
    schemaVersion: 1,
    engineVersion: ENGINE_VERSION,
    id: "legacy-1",
    name: "Legacy",
    seed: 12345,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    initialState: createWorldSnapshot(
      [
        PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "sun" }),
        PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "earth" }),
      ],
      0,
      0,
      900
    ),
    commands: [
      { tick: 0, simTimeSeconds: 0, command: { type: "pause" } },
      {
        tick: 3,
        simTimeSeconds: 2700,
        command: {
          type: "update_body",
          id: "earth",
          updates: { mass: 1e25, position: [1, 2, 3] },
        },
      },
      { tick: 9, simTimeSeconds: 8100, command: { type: "resume" } },
    ],
  };

  const migrated = deserializeScenario(JSON.stringify(legacy));
  assert.equal(migrated.schemaVersion, SCENARIO_SCHEMA_VERSION);
  assert.equal(migrated.commands.length, 2, "pause/resume carry no physics and must be dropped");
  assert.deepEqual(
    migrated.commands.map((c) => c.command.type),
    ["set_mass", "set_position"]
  );
  assert.equal(migrated.commands[0].tick, 3, "legacy ticks are preserved verbatim");
  assert.equal(migrated.commands[0].simTimeSeconds, 2700);
  assert.deepEqual(migrated.finalState, { tick: 9, simTimeSeconds: 8100 });
  assert.equal("seed" in migrated, false, "the unused ceremonial seed must not survive migration");
});

test("replay reconstructs a session whose commands are separated by thousands of ticks", () => {
  const sun = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "sun" });
  const earth = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({
    id: "earth",
    position: [149597870700, 0, 0],
    velocity: [0, 29780, 0],
  });
  const asteroid = PRESETS.find((p) => p.id === "preset-asteroid")!.createBody({
    id: "rock",
    position: [0, 149597870700, 0],
    velocity: [-29780, 0, 0],
  });

  const initialBodies: SimulationBody[] = [sun, earth, asteroid];
  const live = new SimulationWorld({ dtSeconds: 900, initialBodies });
  const initialSnapshot = live.getInitialSnapshot();

  // run 5,000 steps, then edit, then run 20,000 steps, then edit again.
  for (let i = 0; i < 5000; i++) live.step();
  live.executeCommand({ type: "apply_impulse", id: "rock", impulseMs: [0, 500, 0] });
  for (let i = 0; i < 20000; i++) live.step();
  live.executeCommand({ type: "set_mass", id: "rock", massKg: 5e19 });
  for (let i = 0; i < 3000; i++) live.step();

  const commandLog = live.getCommandLog();
  assert.equal(commandLog[0].tick, 5000);
  assert.equal(commandLog[0].simTimeSeconds, 5000 * 900);
  assert.equal(commandLog[1].tick, 25000);
  assert.equal(commandLog[1].simTimeSeconds, 25000 * 900);

  const finalState = { tick: live.tick, simTimeSeconds: live.simTime };
  const replayed = replaySimulation({ initialSnapshot, commands: commandLog, finalState });

  assert.equal(replayed.finalTick, live.tick, "replay must stop at the recorded final tick");
  assert.equal(replayed.matchesFinalState, true, "replayed simulated time must match the record");
  assert.ok(replayed.timeDeltaSeconds < 1e-9);

  assert.deepEqual(
    replayed.world.getSnapshot().bodies,
    live.getSnapshot().bodies,
    "replayed body state must be bit-identical to the live session"
  );

  // Event order must match too.
  const liveEvents = live.eventBus.getHistory().map((e) => `${e.tick}:${e.eventType}`);
  const replayEvents = replayed.world.eventBus.getHistory().map((e) => `${e.tick}:${e.eventType}`);
  assert.deepEqual(replayEvents, liveEvents, "replayed event order must be identical");
});

test("replay reports a mismatch when the documented final time is wrong", () => {
  const doc = createTestScenarioDoc("mismatch-1");
  const result = replaySimulation({
    initialSnapshot: doc.initialState,
    commands: doc.commands,
    finalState: { tick: doc.finalState.tick, simTimeSeconds: doc.finalState.simTimeSeconds + 500 },
  });
  assert.equal(result.matchesFinalState, false);
  assert.ok(result.timeDeltaSeconds > 400);
});

test("stored records are revalidated on load and invalid ones are skipped when listing", async () => {
  clearInMemoryScenarios();

  const doc = createTestScenarioDoc("revalidate-1");

  // The writer refuses to persist an invalid document at all.
  await assert.rejects(
    () => saveScenario({ ...doc, name: "" } as ScenarioDocument),
    /Refusing to persist an invalid scenario/
  );
  await assert.rejects(
    () =>
      saveScenario({
        ...doc,
        commands: [{ tick: 1, simTimeSeconds: 900, command: { type: "totally_unknown_command" } }],
      } as unknown as ScenarioDocument),
    /Refusing to persist an invalid scenario/
  );

  // A valid document round-trips.
  await saveScenario(doc);
  const validLoaded = await loadScenario("revalidate-1");
  assert.ok(validLoaded, "a valid stored scenario must load");

  // Simulate a stale record left behind by an older build / manual DevTools edit.
  const stale = structuredClone(doc) as unknown as Record<string, unknown>;
  stale.id = "stale-1";
  stale.commands = [{ tick: 1, simTimeSeconds: 900, command: { type: "totally_unknown_command" } }];
  __putRawScenarioForTest("stale-1", stale);

  await assert.rejects(() => loadScenario("stale-1"), /no longer validates against the current schema/);

  const list = await listScenarios();
  assert.equal(list.scenarios.length, 1, "only the valid record may be listed");
  assert.equal(list.scenarios[0].id, "revalidate-1");
  assert.equal(list.skippedInvalid, 1, "the stale record must be reported as skipped");
});
