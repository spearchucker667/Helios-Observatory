import { test } from "node:test";
import assert from "node:assert/strict";
import { SimulationWorld } from "../engine/world.ts";
import { PRESETS } from "../domain/presets.ts";
import { AU_M, SOLAR_MASS_KG } from "../domain/constants.ts";
import { MAX_FULL_GRAVITY_BODIES, MAX_TOTAL_SIMULATION_BODIES } from "../physics/gravity.ts";

const star = () => PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "perf-star" });
const planet = (id: string, index: number, count: number) => {
  const r = AU_M * (0.4 + (index + 1) * 0.12);
  const v = Math.sqrt((6.6743e-11 * SOLAR_MASS_KG) / r);
  const angle = (index / Math.max(1, count)) * Math.PI * 2;
  return PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({
    id,
    position: [r * Math.cos(angle), r * Math.sin(angle), 0],
    velocity: [-v * Math.sin(angle), v * Math.cos(angle), 0],
  });
};

const asteroid = (id: string, index: number) => {
  const r = AU_M * (0.6 + (index % 40) * 0.1);
  const angle = (index / 40) * Math.PI * 2;
  return PRESETS.find((p) => p.id === "preset-asteroid")!.createBody({
    id,
    position: [r * Math.cos(angle), r * Math.sin(angle), 0],
    velocity: [-8_000 * Math.sin(angle), 8_000 * Math.cos(angle), 0],
  });
};

function buildWorld(massive: number, tracers: number) {
  const bodies = [star()];
  for (let i = 0; i < massive - 1; i++) bodies.push(planet(`perf-massive-${i}`, i, massive - 1));
  for (let i = 0; i < tracers; i++) bodies.push(asteroid(`perf-tracer-${i}`, i));
  return new SimulationWorld({
    dtSeconds: 900,
    initialBodies: bodies,
    initialSimTime: 0,
    initialTick: 0,
    enableRelativity: false,
  });
}

test("the 1024-body envelope is admitted and remains finite over many steps", () => {
  const world = buildWorld(MAX_FULL_GRAVITY_BODIES, MAX_TOTAL_SIMULATION_BODIES - MAX_FULL_GRAVITY_BODIES);
  assert.equal(world.bodiesList.length, MAX_TOTAL_SIMULATION_BODIES);

  for (let i = 0; i < 5; i++) world.step(world.dt);

  const offenders = world.bodiesList.filter(
    (b) => !b.position.every(Number.isFinite) || !b.velocity.every(Number.isFinite)
  );
  assert.equal(offenders.length, 0, `non-finite state after 5 steps: ${offenders.map((b) => b.id).join(", ")}`);
  assert.equal(world.tick, 5);
  assert.equal(world.simTime, 5 * world.dt);
});

test("a body above the massive-body cap is rejected at world construction", () => {
  const bodies = [star()];
  for (let i = 0; i < MAX_FULL_GRAVITY_BODIES; i++) bodies.push(planet(`over-cap-${i}`, i, MAX_FULL_GRAVITY_BODIES));
  assert.throws(
    () =>
      new SimulationWorld({
        dtSeconds: 900,
        initialBodies: bodies,
        initialSimTime: 0,
        initialTick: 0,
        enableRelativity: false,
      }),
    /exceeds the 256 limit/,
    "constructing a world above the massive-body cap must throw"
  );
});

test("an 8-body system sustains a documented performance floor", () => {
  // Floor, not a target: the measured reference machine reaches ~12,000 steps/s
  // for this scenario (docs/PERFORMANCE.md), so this catches an algorithmic
  // regression (e.g. an accidental O(n^3) term) without being timing-flaky on
  // loaded CI runners.
  const world = buildWorld(8, 0);
  for (let i = 0; i < 5; i++) world.step(world.dt); // warm-up

  const steps = 200;
  const start = process.hrtime.bigint();
  for (let i = 0; i < steps; i++) world.step(world.dt);
  const seconds = Number(process.hrtime.bigint() - start) / 1e9;
  const stepsPerSecond = steps / seconds;

  assert.ok(
    stepsPerSecond > 100,
    `an 8-body system must sustain more than 100 steps/s on the reference class of machine, measured ${stepsPerSecond.toFixed(1)}`
  );
  const warpDaysPerSecond = (stepsPerSecond * world.dt) / 86400;
  assert.ok(
    warpDaysPerSecond > 0.5,
    `an 8-body system must achieve more than 0.5 simulated days per real second, measured ${warpDaysPerSecond.toFixed(3)}`
  );
});

test("single-body step cost at 256 massive stays inside the documented envelope", () => {
  const world = buildWorld(MAX_FULL_GRAVITY_BODIES, 0);
  for (let i = 0; i < 3; i++) world.step(world.dt);

  const steps = 10;
  const start = process.hrtime.bigint();
  for (let i = 0; i < steps; i++) world.step(world.dt);
  const msPerStep = Number(process.hrtime.bigint() - start) / 1e6 / steps;

  // The reference machine measures ~30 ms/step here; this bound documents the
  // honest envelope rather than a frame-rate promise.
  assert.ok(msPerStep < 500, `256 massive bodies must stay under 500 ms per step, measured ${msPerStep.toFixed(1)} ms`);
});
