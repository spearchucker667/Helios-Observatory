import { test } from "node:test";
import assert from "node:assert/strict";
import { SimulationWorld } from "../engine/world.ts";
import { PRESETS } from "../domain/presets.ts";
import {
  COLLISION_MODEL_VERSION,
  FORCE_MODEL_NEWTONIAN,
  FORCE_MODEL_PAIRWISE_1PN,
} from "../engine/snapshot.ts";
import type { SimulationBody } from "../domain/types.ts";

function buildSystem(): SimulationBody[] {
  const sun = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "sun" });
  const earth = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({
    id: "earth",
    position: [149597870700, 0, 0],
    velocity: [0, 29780, 0],
  });
  const mars = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({
    id: "mars",
    position: [0, 227939200000, 0],
    velocity: [-24077, 0, 0],
  });
  return [sun, earth, mars];
}

test("a checkpoint carries every execution-critical configuration input", () => {
  const world = new SimulationWorld({ dtSeconds: 1800, initialBodies: buildSystem(), enableRelativity: true });
  world.executeCommand({ type: "set_relativity", enabled: true });

  const checkpoint = world.getCheckpoint("running");

  assert.equal(checkpoint.dtSeconds, 1800);
  assert.equal(checkpoint.configuration.enableRelativity, true);
  assert.equal(checkpoint.configuration.forceModel, FORCE_MODEL_PAIRWISE_1PN);
  assert.equal(checkpoint.configuration.playbackState, "running");
  assert.equal(checkpoint.configuration.collisionModelVersion, COLLISION_MODEL_VERSION);
  assert.ok(checkpoint.configuration.integrator.length > 0);
  assert.equal(typeof checkpoint.configuration.timeMultiplier, "number");
  assert.equal(checkpoint.configuration.quality, "standard");
  assert.ok(Array.isArray(checkpoint.commandLog));
  assert.equal(checkpoint.commandLog.length, 1, "the command chronology is part of the checkpoint");
  assert.equal(checkpoint.commandLog[0].command.type, "set_relativity");

  // Newtonian mode reports the Newtonian force model.
  const newtonian = new SimulationWorld({ dtSeconds: 900, initialBodies: buildSystem() });
  assert.equal(newtonian.getCheckpoint("paused").configuration.forceModel, FORCE_MODEL_NEWTONIAN);
  assert.equal(newtonian.getCheckpoint("paused").configuration.enableRelativity, false);
});

test("checkpoint -> mutate settings and world -> restore -> 100 steps equals the uninterrupted run", () => {
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: buildSystem() });

  for (let i = 0; i < 200; i++) world.step();
  const checkpoint = world.getCheckpoint("running");

  // Reference continuation: 100 uninterrupted steps from the checkpoint.
  for (let i = 0; i < 100; i++) world.step();
  const reference = world.getSnapshot();
  assert.equal(reference.tick, 300);

  // Now mutate EVERYTHING a restore must undo, then restore.
  const restoredWorld = new SimulationWorld({ dtSeconds: 900, initialBodies: buildSystem() });
  const configuration = restoredWorld.restoreCheckpoint(checkpoint);
  assert.equal(restoredWorld.tick, 200, "restore must return to the checkpoint tick");
  assert.equal(restoredWorld.simTime, checkpoint.simTimeSeconds);
  assert.equal(restoredWorld.dt, 900, "restore must return the checkpoint timestep");

  // Mutate after the restore point: settings, a body edit and a new body.
  restoredWorld.enableRelativity = true;
  restoredWorld.setDt(60);
  restoredWorld.executeCommand({ type: "set_mass", id: "mars", massKg: 1e24 });
  restoredWorld.executeCommand({
    type: "add_body",
    body: PRESETS.find((p) => p.id === "preset-asteroid")!.createBody({ id: "late" }),
  });

  // A second restore must undo all of it, including the command chronology.
  restoredWorld.restoreCheckpoint(checkpoint);
  restoredWorld.enableRelativity = configuration.enableRelativity;
  restoredWorld.setDt(checkpoint.dtSeconds);
  assert.equal(restoredWorld.bodiesList.length, 3, "the added body must be gone after restore");
  assert.equal(restoredWorld.getCommandLog().length, checkpoint.commandLog.length);

  for (let i = 0; i < 100; i++) restoredWorld.step();
  const reproduced = restoredWorld.getSnapshot();

  assert.equal(reproduced.tick, 300);
  assert.deepEqual(reproduced.bodies, reference.bodies, "restored continuation must be bit-identical");
  assert.equal(reproduced.simTimeSeconds, reference.simTimeSeconds);
  assert.deepEqual(reproduced.invariants, reference.invariants);
});

test("a checkpoint taken while relativity is enabled continues in relativistic mode", () => {
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: buildSystem(), enableRelativity: true });
  for (let i = 0; i < 50; i++) world.step();
  const checkpoint = world.getCheckpoint("running");
  const reference = (() => {
    for (let i = 0; i < 10; i++) world.step();
    return world.getSnapshot();
  })();

  const restored = new SimulationWorld({ dtSeconds: 900, initialBodies: buildSystem() });
  const configuration = restored.restoreCheckpoint(checkpoint);
  restored.enableRelativity = configuration.enableRelativity;
  assert.equal(restored.enableRelativity, true);

  for (let i = 0; i < 10; i++) restored.step();
  assert.deepEqual(restored.getSnapshot().bodies, reference.bodies);
});

test("the Newtonian mode is unchanged when relativity is disabled", () => {
  const newtonianA = new SimulationWorld({ dtSeconds: 900, initialBodies: buildSystem(), enableRelativity: false });
  const newtonianB = new SimulationWorld({ dtSeconds: 900, initialBodies: buildSystem() });

  for (let i = 0; i < 60; i++) {
    newtonianA.step();
    newtonianB.step();
  }
  assert.deepEqual(newtonianA.getSnapshot().bodies, newtonianB.getSnapshot().bodies);

  const relativistic = new SimulationWorld({ dtSeconds: 900, initialBodies: buildSystem(), enableRelativity: true });
  for (let i = 0; i < 60; i++) relativistic.step();

  // Mercury-like configurations differ measurably, so the modes are distinct.
  assert.notDeepEqual(relativistic.getSnapshot().bodies, newtonianA.getSnapshot().bodies);
});
