#!/usr/bin/env node
/**
 * Simulation sandbox benchmark matrix.
 *
 * Measures the numbers the documentation is allowed to quote: physics steps per
 * second, per-step cost, snapshot serialization cost and the implied warp. Run
 * it on the reference machine named in `--reference` (default: hostname) and
 * paste only what it actually prints into docs/PERFORMANCE.md.
 *
 *   node --experimental-strip-types scripts/sim-benchmark.mjs [--steps 200]
 */
import os from "node:os";
import process from "node:process";

const args = process.argv.slice(2);
const stepsArg = args.indexOf("--steps");
const STEPS = stepsArg >= 0 ? Number(args[stepsArg + 1]) : 200;

const { SimulationWorld } = await import("../src/simulation/engine/world.ts");
const { PRESETS } = await import("../src/simulation/domain/presets.ts");
const { createRenderSnapshot } = await import("../src/simulation/engine/snapshot.ts");

const starPreset = PRESETS.find((p) => p.id === "preset-sun-like-star");
const planetPreset = PRESETS.find((p) => p.id === "preset-earth-like");
const asteroidPreset = PRESETS.find((p) => p.id === "preset-asteroid");

/** Deterministic pseudo-random source so the matrix is repeatable. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildWorld({ massive, tracers }) {
  const rand = mulberry32(1234 + massive * 7 + tracers);
  const bodies = [];

  // Central star (counts toward the massive-body budget).
  bodies.push(
    starPreset.createBody({
      id: "bench-star",
      position: [0, 0, 0],
      velocity: [0, 0, 0],
    })
  );

  const planetCount = Math.max(0, massive - 1);
  const AU = 149597870700;
  for (let i = 0; i < planetCount; i++) {
    const r = AU * (0.4 + (i + 1) * 0.12);
    const v = Math.sqrt((6.6743e-11 * 1.98892e30) / r);
    const angle = (i / Math.max(1, planetCount)) * Math.PI * 2;
    bodies.push(
      planetPreset.createBody({
        id: `bench-massive-${i}`,
        position: [r * Math.cos(angle), r * Math.sin(angle), (rand() - 0.5) * AU * 0.05],
        velocity: [-v * Math.sin(angle), v * Math.cos(angle), (rand() - 0.5) * 120],
      })
    );
  }

  for (let i = 0; i < tracers; i++) {
    const r = AU * (0.5 + rand() * 4);
    const angle = rand() * Math.PI * 2;
    const v = Math.sqrt((6.6743e-11 * 1.98892e30) / r);
    bodies.push(
      asteroidPreset.createBody({
        id: `bench-tracer-${i}`,
        position: [r * Math.cos(angle), r * Math.sin(angle), (rand() - 0.5) * AU * 0.2],
        velocity: [-v * Math.sin(angle), v * Math.cos(angle), (rand() - 0.5) * 200],
      })
    );
  }

  const world = new SimulationWorld({
    dtSeconds: 900,
    initialBodies: bodies,
    initialSimTime: 0,
    initialTick: 0,
    enableRelativity: false,
  });
  return world;
}

function bench(label, { massive, tracers }) {
  const world = buildWorld({ massive, tracers });
  const bodyCount = world.bodiesList.length;

  // Warm-up (JIT + first-touch allocations) is excluded from timing.
  for (let i = 0; i < 5; i++) world.step(world.dt);

  const start = process.hrtime.bigint();
  for (let i = 0; i < STEPS; i++) world.step(world.dt);
  const elapsedNs = Number(process.hrtime.bigint() - start);
  const seconds = elapsedNs / 1e9;
  const stepsPerSecond = STEPS / seconds;
  const msPerStep = (seconds * 1000) / STEPS;

  // Snapshot serialization cost (worker → main thread payload build).
  const snapStart = process.hrtime.bigint();
  let snapshot;
  for (let i = 0; i < 20; i++) snapshot = createRenderSnapshot(world);
  const snapshotMs = Number(process.hrtime.bigint() - snapStart) / 1e6 / 20;

  const nonFinite = world.bodiesList.filter(
    (b) =>
      !Number.isFinite(b.mass) ||
      !b.position.every(Number.isFinite) ||
      !b.velocity.every(Number.isFinite)
  ).length;

  // Achieved warp: how much simulated time the machine can push per real second.
  const simSecondsPerRealSecond = stepsPerSecond * world.dt;
  const achievedWarpDaysPerSecond = simSecondsPerRealSecond / 86400;

  return {
    label,
    bodies: bodyCount,
    massive,
    tracers,
    stepsPerSecond: Number(stepsPerSecond.toFixed(1)),
    msPerStep: Number(msPerStep.toFixed(3)),
    snapshotMs: Number(snapshotMs.toFixed(4)),
    achievedWarpDaysPerSecond: Number(achievedWarpDaysPerSecond.toFixed(3)),
    nonFiniteBodies: nonFinite,
    runtimeSeconds: Number(seconds.toFixed(3)),
    bodiesInSnapshot: snapshot.numBodies,
  };
}

const matrix = [
  { label: "8 massive", massive: 8, tracers: 0 },
  { label: "32 massive", massive: 32, tracers: 0 },
  { label: "64 massive", massive: 64, tracers: 0 },
  { label: "128 massive", massive: 128, tracers: 0 },
  { label: "256 massive", massive: 256, tracers: 0 },
  { label: "256 massive + 768 tracers (1024 total)", massive: 256, tracers: 768 },
  { label: "1024 tracer-heavy (1 massive + 1023 tracers)", massive: 1, tracers: 1023 },
];

const results = matrix.map((entry) => bench(entry.label, entry));

console.log(`# Helios simulation benchmark`);
console.log(`reference machine: ${os.hostname()} (${os.platform()} ${os.arch()}, ${os.cpus().length} vCPU)`);
console.log(`cpu: ${os.cpus()[0]?.model ?? "unknown"}`);
console.log(`node: ${process.version}; warms up 5 steps, then times ${STEPS} steps per row\n`);
console.log("| scenario | bodies | steps/s | ms/step | snapshot ms | achieved warp (d/s) | non-finite |");
console.log("| --- | --- | --- | --- | --- | --- | --- |");
for (const row of results) {
  console.log(
    `| ${row.label} | ${row.bodies} | ${row.stepsPerSecond} | ${row.msPerStep} | ${row.snapshotMs} | ${row.achievedWarpDaysPerSecond} | ${row.nonFiniteBodies} |`
  );
}

const worst = results[results.length - 1];
if (results.some((r) => r.nonFiniteBodies > 0)) {
  console.error("\nFAILED: benchmark produced non-finite body state");
  process.exitCode = 1;
}
if (worst.stepsPerSecond < 1) {
  console.error(`\nFAILED: ${worst.label} ran at ${worst.stepsPerSecond} steps/s`);
  process.exitCode = 1;
}
console.log(`\njson: ${JSON.stringify({ reference: os.hostname(), steps: STEPS, results })}`);
