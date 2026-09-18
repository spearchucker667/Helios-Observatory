import { test } from "node:test";
import assert from "node:assert/strict";
import { TimestepScheduler } from "../engine/timestep.ts";
import { SimulationWorld } from "../engine/world.ts";
import { PRESETS } from "../domain/presets.ts";

test("identical command stream -> identical result (deterministic execution)", () => {
  const earthPreset = PRESETS.find((p) => p.id === "preset-earth-like")!;
  const starPreset = PRESETS.find((p) => p.id === "preset-sun-like-star")!;

  const build = () => [
    starPreset.createBody({ id: "star-1", position: [0, 0, 0], velocity: [0, 0, 0] }),
    earthPreset.createBody({ id: "earth-1", position: [149597870700, 0, 0], velocity: [0, 29780, 0] }),
  ];

  const world1 = new SimulationWorld({ dtSeconds: 3600, initialBodies: build() });
  const world2 = new SimulationWorld({ dtSeconds: 3600, initialBodies: build() });

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

test("planSteps runs nothing while paused and only plans work while running", () => {
  const scheduler = new TimestepScheduler(900);
  assert.equal(scheduler.getState(), "uninitialized");
  assert.equal(scheduler.planSteps(5), 0, "No work may be planned before playback starts");

  scheduler.setTimeMultiplier(900); // 900 sim-seconds per real-second -> 1 step/sec
  scheduler.setState("paused");
  assert.equal(scheduler.planSteps(5), 0, "No work may be planned while paused");

  scheduler.setState("running");
  assert.equal(scheduler.planSteps(1), 1, "Should plan 1 step for 1 real second");
  assert.equal(scheduler.planSteps(2), 2, "Should plan 2 steps for 2 real seconds");
});

test("planning never commits the simulation clock (single clock authority)", () => {
  const scheduler = new TimestepScheduler(600);
  scheduler.setTimeMultiplier(6000);
  scheduler.setState("running");

  assert.equal(scheduler.planSteps(1), 10, "6000 sim seconds / 600 s dt = 10 steps");
  assert.equal(scheduler.tick, 0, "Planning must not advance the scheduler tick");
  assert.equal(scheduler.time, 0, "Planning must not advance the scheduler time");

  // Only an explicit sync from the authoritative world moves the clock.
  scheduler.syncClock(10, 6000);
  assert.equal(scheduler.tick, 10);
  assert.equal(scheduler.time, 6000);
});

test("time acceleration does not change integration dt", () => {
  const scheduler = new TimestepScheduler(600); // 600s dt
  assert.equal(scheduler.dt, 600);

  // Accelerate time by 10,000x
  scheduler.setTimeMultiplier(6000000);
  assert.equal(scheduler.dt, 600, "Integration dt must remain invariant to time warp");

  scheduler.setState("running");
  // 1 real second produces 6,000,000 sim seconds / 600s = 10,000 steps
  // (Capped by maxStepsPerUpdate = 500)
  const steps = scheduler.planSteps(1);
  assert.equal(steps, 500, "Should be capped at maxStepsPerUpdate");
  assert.equal(scheduler.getStats().isComputeLimited, true, "Should report compute-limited status");
});

test("non-finite and invalid scheduling inputs are rejected outright", () => {
  const scheduler = new TimestepScheduler(900);

  for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(scheduler.setDt(bad), false, `dt ${bad} must be rejected`);
    assert.equal(scheduler.setTimeMultiplier(bad), false, `multiplier ${bad} must be rejected`);
    assert.equal(scheduler.planSteps(bad), 0, `elapsed ${bad} must produce no work`);
  }

  assert.equal(scheduler.setDt(0), false, "dt <= 0 must be rejected");
  assert.equal(scheduler.setDt(-120), false);
  assert.equal(scheduler.setTimeMultiplier(-1), false);

  assert.equal(scheduler.dt, 900, "rejected values must not mutate scheduling state");
  assert.ok(Number.isFinite(scheduler.getStats().dtSeconds));
  assert.ok(Number.isFinite(scheduler.getStats().timeMultiplier));
});

test("scheduler clock mirrors the world clock after each committed step", () => {
  const star = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "s1" });
  const earth = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "e1" });

  const world = new SimulationWorld({ dtSeconds: 120, initialBodies: [star, earth] });
  const scheduler = new TimestepScheduler(120);
  scheduler.setTimeMultiplier(120);
  scheduler.setState("running");

  const planned = scheduler.planSteps(3); // 3 * 120 sim seconds / 120 dt = 3 steps
  assert.equal(planned, 3);

  for (let i = 0; i < planned; i++) {
    world.step();
    scheduler.syncClock(world.tick, world.simTime);
  }

  assert.equal(scheduler.tick, world.tick);
  assert.equal(scheduler.time, world.simTime);
  assert.equal(scheduler.time, 3 * 120);
});

test("a throwing world step leaves the scheduler clock consistent with the world", () => {
  const scheduler = new TimestepScheduler(900);
  scheduler.setTimeMultiplier(900);
  scheduler.setState("running");

  const stepsToRun = scheduler.planSteps(100); // requests 100 steps
  assert.equal(stepsToRun, 100);

  let executed = 0;
  assert.throws(() => {
    for (let s = 0; s < stepsToRun; s++) {
      if (s === 37) throw new Error("simulated physics failure");
      executed++;
    }
  });

  // The old implementation had already advanced its own clock by the full
  // batch before the world ran; now nothing is committed unless the caller
  // explicitly syncs after a successful step.
  scheduler.syncClock(executed, executed * 900);

  assert.equal(executed, 37);
  assert.equal(scheduler.tick, 37, "scheduler must reflect only the executed steps");
  assert.equal(scheduler.time, 37 * 900);
});
