import { test } from "node:test";
import assert from "node:assert/strict";
import { useSandboxStore } from "../state/sandbox-store.ts";
import { PRESETS } from "../domain/presets.ts";

async function flush(times = 6): Promise<void> {
  for (let i = 0; i < times; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** Advances the authoritative world by N single steps at a one-day timestep. */
function advanceDays(days: number): void {
  const client = useSandboxStore.getState().client!;
  client.setDt(86400);
  for (let i = 0; i < days; i++) {
    client.stepOnce();
  }
}

test("the sandbox store mirrors worker playback state instead of inventing its own", async () => {
  const store = useSandboxStore.getState();
  store.init();

  // Initial state is paused and comes from the worker.
  assert.equal(useSandboxStore.getState().paused, true);
  assert.equal(useSandboxStore.getState().playbackState, "paused");

  useSandboxStore.getState().play();
  assert.equal(useSandboxStore.getState().paused, false);
  assert.equal(useSandboxStore.getState().playbackState, "running");

  useSandboxStore.getState().pause();
  assert.equal(useSandboxStore.getState().paused, true);
  assert.equal(useSandboxStore.getState().playbackState, "paused");

  // A single step leaves the engine paused.
  useSandboxStore.getState().stepOnce();
  assert.equal(useSandboxStore.getState().paused, true);
  assert.equal(useSandboxStore.getState().stats?.state, "paused");

  useSandboxStore.getState().cleanup();
  await flush();
});

test("undo restores the pre-edit state at the correct simulation time", async () => {
  const store = useSandboxStore.getState();
  store.init();
  await flush();

  // 150 simulated days of physics before any edit.
  advanceDays(150);
  const beforeEditTick = useSandboxStore.getState().snapshot!.tick;
  assert.equal(beforeEditTick, 150);

  // Add a body (a real, checkpointed edit).
  const presetKey = PRESETS.find((p) => p.id === "preset-asteroid")!.id;
  useSandboxStore.getState().addPreset(presetKey);
  await flush();
  assert.equal(useSandboxStore.getState().canUndo, true);

  // Another 50 days of physics after the first edit.
  advanceDays(50);
  const asteroidId = useSandboxStore.getState().selectedId!;
  const asteroid = useSandboxStore.getState().bodies[asteroidId];
  assert.ok(asteroid, "the added asteroid must be authoritative in the store");

  // The store's body records are mutated in place by render snapshots, so copy
  // the pre-edit values out before touching the editor.
  const preEditMass = asteroid.mass;
  const preEditProvenanceKind = asteroid.provenance.mass.kind;
  const preEditCommandLogLength = (await useSandboxStore.getState().client!.requestCommandLog())
    .commandLog.length;

  const tickBeforeSecondEdit = useSandboxStore.getState().snapshot!.tick;
  assert.ok(tickBeforeSecondEdit >= 200, `expected >= 200 days, got ${tickBeforeSecondEdit}`);

  // Second edit: change the asteroid's mass through the production editor path.
  useSandboxStore.getState().startEditing(asteroidId);
  await flush();
  assert.equal(useSandboxStore.getState().paused, true, "editing must pause the authoritative engine");
  useSandboxStore.getState().updateDraft({ mass: preEditMass * 5 });
  assert.equal(useSandboxStore.getState().saveDraft(), true);
  await flush(12);

  const editedMass = useSandboxStore.getState().bodies[asteroidId]?.mass;
  assert.equal(editedMass, preEditMass * 5, "the mass edit must reach the authoritative store");
  assert.equal(
    useSandboxStore.getState().bodies[asteroidId]?.provenance.mass.kind,
    "custom",
    "a mass edit must move provenance to custom"
  );

  // Undo the edit: the world must return to the pre-edit state AT ~200 days,
  // not to the scenario epoch.
  useSandboxStore.getState().undo();
  await flush();

  const afterUndo = useSandboxStore.getState();
  assert.equal(
    afterUndo.snapshot!.tick,
    tickBeforeSecondEdit,
    "undo must preserve the simulation time that had already elapsed"
  );
  assert.equal(afterUndo.bodies[asteroidId]?.mass, preEditMass, "the mass edit must be reverted");
  assert.equal(afterUndo.bodies[asteroidId]?.provenance.mass.kind, preEditProvenanceKind);

  const logAfterUndo = await useSandboxStore.getState().client!.requestCommandLog();
  assert.equal(
    logAfterUndo.commandLog.length,
    preEditCommandLogLength,
    "undo must drop the edit from the command chronology"
  );

  // Redo re-applies the edit.
  useSandboxStore.getState().redo();
  await flush(12);
  assert.equal(useSandboxStore.getState().bodies[asteroidId]?.mass, preEditMass * 5);

  useSandboxStore.getState().cleanup();
  await flush();
});
