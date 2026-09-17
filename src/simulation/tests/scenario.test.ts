import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESETS } from "../domain/presets.ts";
import { createWorldSnapshot } from "../engine/snapshot.ts";
import { serializeScenario, deserializeScenario } from "../scenarios/serialize.ts";
import { saveScenario, loadScenario, listScenarios, deleteScenario, clearInMemoryScenarios } from "../scenarios/storage.ts";
import type { ScenarioDocument } from "../scenarios/schema.ts";
import { replaySimulation } from "../engine/replay.ts";

function createTestScenarioDoc(id = "test-scen-1", name = "Test Scenario"): ScenarioDocument {
  const earth = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "earth" });
  const sun = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "sun" });

  const snapshot = createWorldSnapshot([sun, earth], 0, 0, 900);

  return {
    format: "helios-scenario",
    schemaVersion: 1,
    engineVersion: "1.0.0",
    id,
    name,
    description: "Scenario for testing serialization and storage",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    seed: 42,
    initialState: snapshot,
    commands: [
      {
        tick: 5,
        simTimeSeconds: 4500,
        command: { type: "apply_impulse", id: "earth", impulseMs: [0, 100, 0] },
      },
    ],
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
  assert.equal(list.length, 1);
  assert.equal(list[0].id, "scen-storage-1");

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
  assert.throws(
    () => deserializeScenario("{ invalid json ]"),
    /Malformed JSON/
  );
});

test("oversized bodies array (> 1024 bodies or > 256 massive) is rejected", () => {
  const doc = createTestScenarioDoc("oversized-1");
  const baseBody = doc.initialState.bodies[0];

  // Test 1: Exceeding massive body cap (257 massive bodies)
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
  assert.throws(
    () => deserializeScenario(JSON.stringify(doc)),
    /Maximum 256 massive bodies supported/
  );

  // Test 2: Exceeding total body cap (1025 bodies)
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
  assert.throws(
    () => deserializeScenario(JSON.stringify(doc)),
    /Maximum 1024 bodies supported/
  );
});

test("duplicate body IDs in scenario initial state are rejected", () => {
  const doc = createTestScenarioDoc("dup-1");
  doc.initialState.bodies = [
    { ...doc.initialState.bodies[0], id: "identical-id" },
    { ...doc.initialState.bodies[1], id: "identical-id" },
  ];

  const json = JSON.stringify(doc);
  assert.throws(
    () => deserializeScenario(json),
    /Duplicate body ID.*identical-id/
  );
});

test("future unsupported schema version is rejected", () => {
  const doc: any = createTestScenarioDoc("future-1");
  doc.schemaVersion = 999;

  const json = JSON.stringify(doc);
  assert.throws(
    () => deserializeScenario(json),
    /Unsupported future scenario schema version: 999/
  );
});

test("deterministic replay from scenario initial state and command log", () => {
  const doc = createTestScenarioDoc("replay-1");
  const session = {
    initialSnapshot: doc.initialState,
    commands: doc.commands,
  };

  const world1 = replaySimulation(session, 20);
  const world2 = replaySimulation(session, 20);

  assert.equal(world1.tick, 20);
  assert.equal(world2.tick, 20);

  const snap1 = world1.getSnapshot();
  const snap2 = world2.getSnapshot();

  assert.deepEqual(snap1.bodies, snap2.bodies, "Replay must be bit-identical");
});
