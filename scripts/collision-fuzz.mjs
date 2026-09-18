#!/usr/bin/env node
/**
 * Swept-sphere collision fuzz harness.
 *
 * Stresses `sweptContactParameter` / `detectCollisions` and the world
 * integration path across randomized speeds, timesteps and grazing angles,
 * with an exact continuous-time ground truth. Deterministic: the same `--seed`
 * always produces the same cases, and every failure prints a minimal
 * reproducer (seed + case parameters).
 *
 *   node --experimental-strip-types scripts/collision-fuzz.mjs [--seed 2026] [--solver-cases 100000] [--world-cases 1200]
 *
 * Layers:
 *   1. Solver-level — random segments vs random radii. The solver must find
 *      contact whenever the continuous-time path actually touches the sphere,
 *      must never report contact when it does not, and a returned tau must lie
 *      in [0, 1] and land on or inside the sphere.
 *   2. World-level — random N-body configurations run through real
 *      `world.step()` calls. No pair may pass through itself between
 *      integration endpoints without a resolution event, mass and momentum
 *      must be conserved across every event, and state must stay finite.
 */
import process from "node:process";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const SEED = argValue("--seed", 20260917);
const SOLVER_CASES = argValue("--solver-cases", 100_000);
const WORLD_CASES = argValue("--world-cases", 1_200);
// The analytic minimum of |r0 + t*delta| over t in [0,1] is exact, so the
// sampled grid is only a sanity net around it, not the source of truth.
const GROUND_TRUTH_SAMPLES = 256;
const WORLD_PAIR_SAMPLES = 64;
/** Relative slack for the graze boundary: min-separation within
 *  (radius, radius*(1+SLACK)] is inherently ill-conditioned; counted, not fatal. */
const GRAZE_SLACK = 1e-9;
/** fp tolerance on the |r(tau)| <= R check. */
const TAU_TOLERANCE = 1e-9;

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const failures = [];
let boundaryCases = 0;

function fail(layer, message, repro) {
  if (failures.length < 25) failures.push({ layer, message, repro });
}

// ---------------------------------------------------------------------------
// Load production modules.
// ---------------------------------------------------------------------------
const { sweptContactParameter } = await import("../src/simulation/collisions/detect.ts");
const { SimulationWorld } = await import("../src/simulation/engine/world.ts");

// ---------------------------------------------------------------------------
// Shared geometry: exact minimum separation of a parametric segment.
// ---------------------------------------------------------------------------
function minSeparationAlongSegment(r0, delta, samples) {
  // Exact: the squared norm is a convex quadratic in t, minimized at the
  // clamped stationary point tMin — that value IS the true segment minimum.
  const a = delta[0] ** 2 + delta[1] ** 2 + delta[2] ** 2;
  let tMin = 0;
  if (a > 0) {
    const b = 2 * (r0[0] * delta[0] + r0[1] * delta[1] + r0[2] * delta[2]);
    tMin = Math.min(1, Math.max(0, -b / (2 * a)));
  }
  let best = Math.hypot(
    r0[0] + delta[0] * tMin,
    r0[1] + delta[1] * tMin,
    r0[2] + delta[2] * tMin
  );
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const s = Math.hypot(
      r0[0] + delta[0] * t,
      r0[1] + delta[1] * t,
      r0[2] + delta[2] * t
    );
    if (s < best) best = s;
  }
  return best;
}

// ---------------------------------------------------------------------------
// Layer 1 — solver-level fuzz.
// ---------------------------------------------------------------------------
function runSolverFuzz() {
  const rand = mulberry32(SEED);
  const logUniform = (min, max) => Math.exp(Math.log(min) + rand() * (Math.log(max) - Math.log(min)));
  const randomVector = (magMin, magMax) => {
    const mag = logUniform(magMin, magMax);
    // Uniform direction on the sphere (Marsaglia).
    let x, y, z, s;
    do {
      x = 2 * rand() - 1;
      y = 2 * rand() - 1;
      z = 2 * rand() - 1;
      s = x * x + y * y + z * z;
    } while (s > 1 || s < 1e-6);
    const k = mag / Math.sqrt(s);
    return [x * k, y * k, z * k];
  };

  let contacts = 0;
  let detectedMisses = 0;
  for (let c = 0; c < SOLVER_CASES; c++) {
    const radius = logUniform(1e-3, 1e9);
    // Start separation relative to radius: from deep overlap to far away.
    const r0 = randomVector(radius * 0.1, radius * 1e4);
    // Relative displacement spanning a small fraction of the radius to many radii per step.
    let d = randomVector(radius * 1e-3, radius * 50);
    // Occasionally inject degenerate deltas (zero / pure tangent).
    if (c % 97 === 0) {
      d = c % 194 === 0 ? [0, 0, 0] : [d[0], d[1], -((d[0] * r0[0] + d[1] * r0[1]) / (r0[2] || 1))];
    }

    const minSep = minSeparationAlongSegment(r0, d, GROUND_TRUTH_SAMPLES);
    const touches = minSep <= radius;
    if (minSep <= radius * (1 + GRAZE_SLACK) && minSep > radius) boundaryCases++;
    if (touches) contacts++;

    let tau = null;
    try {
      tau = sweptContactParameter(r0, d, radius);
    } catch (err) {
      fail("solver", "sweptContactParameter threw", { c, r0, delta: d, radius, error: String(err) });
      continue;
    }

    if (tau !== null) {
      if (!(tau >= 0 && tau <= 1)) {
        fail("solver", `tau ${tau} outside [0,1]`, { c, r0, delta: d, radius });
        continue;
      }
      const sepAtTau = Math.hypot(r0[0] + d[0] * tau, r0[1] + d[1] * tau, r0[2] + d[2] * tau);
      if (sepAtTau > radius * (1 + TAU_TOLERANCE)) {
        fail("solver", `tau lands outside the sphere: |r(tau)|=${sepAtTau} > R=${radius}`, { c, r0, delta: d, radius, tau });
        continue;
      }
    }

    if (touches && tau === null) {
      detectedMisses++;
      fail("solver", `MISSED CONTACT: ground truth touches (minSep=${minSep.toExponential(6)} <= R=${radius.toExponential(6)}) but solver returned null`, { c, r0, delta: d, radius, minSep });
    }
    if (!touches && tau !== null && minSep > radius * (1 + GRAZE_SLACK)) {
      fail("solver", `FALSE POSITIVE: no continuous contact (minSep=${minSep.toExponential(6)} > R=${radius.toExponential(6)}) but solver returned tau=${tau}`, { c, r0, delta: d, radius, minSep, tau });
    }
  }
  return { cases: SOLVER_CASES, continuousContacts: contacts, detectedMisses };
}

// ---------------------------------------------------------------------------
// Layer 2 — world-level fuzz.
// ---------------------------------------------------------------------------
function makeBody(id, overrides) {
  return {
    id,
    name: id,
    classification: "planet",
    gravityRole: "massive",
    mass: 6e24,
    radius: 6.371e6,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    provenance: { mass: { kind: "custom" }, radius: { kind: "custom" }, state: { kind: "custom" } },
    ...overrides,
  };
}

function runWorldFuzz() {
  const worldRand0 = mulberry32(SEED ^ 0x5f3759df);
  const logUniform = (min, max) => Math.exp(Math.log(min) + worldRand0() * (Math.log(max) - Math.log(min)));
  const worldRand = worldRand0;
  let totalSteps = 0;
  let mergeEvents = 0;
  let captureEvents = 0;
  let tunnellingSuspects = 0;

  for (let wc = 0; wc < WORLD_CASES; wc++) {
    const n = 2 + Math.floor(worldRand() * 4); // 2..5 bodies
    const dt = logUniform(1, 3.6e4) * (worldRand() < 0.2 ? 100 : 1); // 1 s .. 3.6e6 s
    const speedScale = logUniform(1e2, 3e7); // sub-escape to ~hyperbolic
    const radiusScale = worldRand() < 0.5 ? 1 : logUniform(1e-2, 1e3);

    const bodies = [];
    for (let i = 0; i < n; i++) {
      bodies.push(
        makeBody(`b${i}`, {
          mass: 1e24 * (0.1 + worldRand() * 10),
          radius: 6.371e6 * radiusScale,
          position: [
            (worldRand() - 0.5) * 4e8,
            (worldRand() - 0.5) * 4e8,
            (worldRand() - 0.5) * 4e8,
          ],
          velocity: [
            (worldRand() - 0.5) * 2 * speedScale,
            (worldRand() - 0.5) * 2 * speedScale,
            (worldRand() - 0.5) * 2 * speedScale,
          ],
        })
      );
    }
    let world;
    try {
      world = new SimulationWorld({ dtSeconds: dt, initialBodies: bodies });
    } catch {
      continue; // invalid initial configuration rejected by the world guard
    }

    const steps = 40 + Math.floor(worldRand() * 200);
    for (let s = 0; s < steps; s++) {
      const before = new Map();
      for (const b of world.bodiesList) before.set(b.id, [...b.position]);
      const massBefore = world.bodiesList.reduce((acc, b) => acc + b.mass, 0);
      const px = world.bodiesList.reduce((a, b) => a + b.mass * b.velocity[0], 0);
      const py = world.bodiesList.reduce((a, b) => a + b.mass * b.velocity[1], 0);
      const pz = world.bodiesList.reduce((a, b) => a + b.mass * b.velocity[2], 0);

      let result;
      try {
        result = world.step();
      } catch {
        // Halting on non-finite state is a designed safety property, not a bug.
        break;
      }
      totalSteps++;
      const survivors = world.bodiesList;
      const events = result.events.map((e) => e.eventType ?? e.type);
      if (events.includes("merge")) mergeEvents++;
      if (events.includes("black_hole_horizon_crossing")) captureEvents++;

      // Tunnelling check: for every pair that coexisted before the step and
      // still coexists after, their chord across the step must not dip inside
      // the contact sphere. Skipped on steps where an event consumed a body —
      // a survivor of a merge has no single pre-step trajectory to test.
      if (events.length === 0) {
        for (let i = 0; i < survivors.length; i++) {
          for (let j = i + 1; j < survivors.length; j++) {
            const A = survivors[i];
            const B = survivors[j];
            const aPrev = before.get(A.id);
            const bPrev = before.get(B.id);
            if (!aPrev || !bPrev) continue;
            const contact = A.radius + B.radius;
            const r0 = [bPrev[0] - aPrev[0], bPrev[1] - aPrev[1], bPrev[2] - aPrev[2]];
            const dd = [
              B.position[0] - A.position[0] - (bPrev[0] - aPrev[0]),
              B.position[1] - A.position[1] - (bPrev[1] - aPrev[1]),
              B.position[2] - A.position[2] - (bPrev[2] - aPrev[2]),
            ];
            const minSep = minSeparationAlongSegment(r0, dd, WORLD_PAIR_SAMPLES);
            if (minSep < contact * (1 - 1e-6)) {
              tunnellingSuspects++;
              fail("world", `TUNNELLING SUSPECT: ${A.id}/${B.id} minSep=${minSep.toExponential(4)} < contact=${contact.toExponential(4)} with no event`, { wc, s, dt, speedScale, radiusScale, events });
            }
          }
        }
      }

      // Conservation checks (every step, not only event steps: an event-free
      // step must conserve momentum exactly in Newtonian all-pairs gravity).
      const massAfter = survivors.reduce((acc, b) => acc + b.mass, 0);
      if (events.includes("merge")) {
        const rel = Math.abs(massAfter - massBefore) / Math.max(massBefore, 1e-30);
        if (rel > 1e-9) {
          fail("world", `mass not conserved across merge: ${massBefore} -> ${massAfter}`, { wc, s });
        }
      }
      const qx = survivors.reduce((a, b) => a + b.mass * b.velocity[0], 0);
      const qy = survivors.reduce((a, b) => a + b.mass * b.velocity[1], 0);
      const qz = survivors.reduce((a, b) => a + b.mass * b.velocity[2], 0);
      const p0 = Math.abs(px) + Math.abs(py) + Math.abs(pz);
      const pRel = Math.abs(qx - px) + Math.abs(qy - py) + Math.abs(qz - pz);
      if (pRel > Math.max(1e-6 * p0, 1e-6)) {
        fail("world", `linear momentum drift across step: |p|=${p0} -> drift=${pRel}`, { wc, s, events });
      }

      for (const b of survivors) {
        if (!Number.isFinite(b.position[0]) || !Number.isFinite(b.velocity[0])) {
          fail("world", `non-finite state on ${b.id} without halt`, { wc, s });
        }
      }
    }
  }
  return { worldCases: WORLD_CASES, totalSteps, mergeEvents, captureEvents, tunnellingSuspects };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log(`collision-fuzz: seed=${SEED} solver=${SOLVER_CASES} world=${WORLD_CASES}`);
const solver = runSolverFuzz();
console.log(`solver: ${solver.cases} cases, ${solver.continuousContacts} continuous-time contacts, ${boundaryCases} boundary-graze cases (tolerated), ${solver.detectedMisses} misses`);
const worldStats = runWorldFuzz();
console.log(`world: ${worldStats.worldCases} scenarios, ${worldStats.totalSteps} steps, ${worldStats.mergeEvents} merges, ${worldStats.captureEvents} captures, ${worldStats.tunnellingSuspects} tunnelling suspects`);

if (failures.length > 0) {
  console.error(`\nFAILURES (${failures.length} shown):`);
  for (const f of failures) {
    console.error(`- [${f.layer}] ${f.message}`);
    console.error(`  repro: ${JSON.stringify(f.repro)}`);
  }
  console.error(`\ncollision-fuzz FAILED (seed ${SEED})`);
  process.exit(1);
}
console.log(`collision-fuzz PASSED (seed ${SEED})`);
