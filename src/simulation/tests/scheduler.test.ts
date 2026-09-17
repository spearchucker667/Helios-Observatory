import { test } from "node:test";
import assert from "node:assert/strict";
import { TimestepScheduler } from "../engine/timestep.ts";
import { SimulationWorld } from "../engine/world.ts";
import { PRESETS } from "../domain/presets.ts";

test("identical command stream -> identical result (deterministic execution)", () => {
  const earthPreset = PRESETS.find((p) => p.id === "preset-earth-like")!;
  const starPreset = PRESETS.find((p) => p.id === "preset-sun-like-star")!;

  const initialBodies1 = [
    starPreset.createBody({ id: "star-1", position: [0, 0, 0], velocity: [0, 0, 0] }),
    earthPreset.createBody({ id: "earth-1", position: [149597870700, 0, 0], velocity: [0, 29780, 0] }),
  ];

  const initialBodies2 = [
    starPreset.createBody({ id: "star-1", position: [0, 0, 0], velocity: [0, 0, 0] }),
    earthPreset.createBody({ id: "earth-1", position: [149597870700, 0, 0], velocity: [0, 29780, 0] }),
  ];

  const world1 = new SimulationWorld({ dtSeconds: 3600, initialBodies: initialBodies1 });
  const world2 = new SimulationWorld({ dtSeconds: 3600, initialBodies: initialBodies2 });

  // Apply identical command at step 10
  for (let i = 0; i < 20; i++) {
    if (i === 10) {
      world1.executeCommand({ type: "apply_impulse", id: "earth-1", impulseMs: [0, 500, 0] });
      world2.executeCommand({ type: "apply_impulse", id: "earth-1", impulseMs: [0, 500, 0] });
    }
    world1.step();
    world2.step();
  }

  const b1 = world1.getBody("earth-1")!;
  const b2 = world2.getBody("earth-1")!;

  assert.deepEqual(b1.position, b2.position, "Positions must be identical");
  assert.deepEqual(b1.velocity, b2.velocity, "Velocities must be identical");
  assert.equal(world1.tick, world2.tick);
  assert.equal(world1.simTime, world2.simTime);
});

test("pause and resume behavior", () => {
  const scheduler = new TimestepScheduler(900); // 900s dt
  scheduler.setTimeMultiplier(900); // 900 sim-seconds per real-second -> 1 step/sec

  scheduler.setPaused(true);
  assert.equal(scheduler.advanceRealTime(5), 0, "No steps should run while paused");

  scheduler.setPaused(false);
  assert.equal(scheduler.advanceRealTime(1), 1, "Should advance 1 step for 1 real second");
  assert.equal(scheduler.advanceRealTime(2), 2, "Should advance 2 steps for 2 real seconds");
});

test("time acceleration does not change integration dt", () => {
  const scheduler = new TimestepScheduler(600); // 600s dt
  assert.equal(scheduler.dt, 600);

  // Accelerate time by 10,000x
  scheduler.setTimeMultiplier(6000000);
  assert.equal(scheduler.dt, 600, "Integration dt must remain invariant to time warp");

  scheduler.setPaused(false);
  // 1 real second produces 6,000,000 sim seconds / 600s = 10,000 steps
  // (Capped by maxStepsPerUpdate = 500)
  const steps = scheduler.advanceRealTime(1);
  assert.equal(steps, 500, "Should be capped at maxStepsPerUpdate");
  const stats = scheduler.getStats();
  assert.equal(stats.isComputeLimited, true, "Should report compute-limited status");
});

test("single-step advances exactly one base dt", () => {
  const scheduler = new TimestepScheduler(1200);
  const initialTick = scheduler.tick;
  const initialTime = scheduler.time;

  scheduler.stepOnce();

  assert.equal(scheduler.tick, initialTick + 1);
  assert.equal(scheduler.time, initialTime + 1200);
});
