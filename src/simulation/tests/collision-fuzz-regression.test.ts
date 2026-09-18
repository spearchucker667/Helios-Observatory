import { test } from "node:test";
import assert from "node:assert/strict";
import { SimulationWorld } from "../engine/world.ts";
import type { SimulationBody } from "../domain/types.ts";

/**
 * Regression tests for defects found by scripts/collision-fuzz.mjs.
 *
 * 1. Tidal-disruption cascade: debris remnants spawned inside the primary's
 *    Roche limit were themselves disrupted on the next step, each spawning six
 *    more remnants — an exponential body-count cascade that ran away to the
 *    1,024-body cap and stalled the simulation.
 * 2. Multi-pair resolution: when one body appeared in several collision pairs
 *    during the same step, the second resolution read stale pre-merge objects
 *    and silently destroyed the first resolution's conserved mass/momentum.
 */

function body(id: string, overrides: Partial<SimulationBody>): SimulationBody {
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

test("tidal debris is never re-shredded: no cascade to the body cap", () => {
  // Exact parameters from collision-fuzz case 7 (seed 20260917): two
  // giant-radius bodies deeply overlapping inside the Roche limit.
  const world = new SimulationWorld({
    dtSeconds: 161.29642010486128,
    initialBodies: [
      body("b0", {
        mass: 8.464858962595463e24,
        radius: 684657554.4789634,
        position: [-86281502.15372443, -194972281.4373672, 179083736.7065251],
        velocity: [10480.890793722016, 10639.510778720592, -545.3437945324116],
      }),
      body("b1", {
        mass: 9.023580187000334e23,
        radius: 684657554.4789634,
        position: [-10918295.849114656, 121092842.89181232, -35904501.378536224],
        velocity: [-181.75534666736957, 954.1877215390979, -6488.780504205567],
      }),
    ],
  });

  for (let s = 0; s < 10; s++) world.step();

  assert.ok(
    world.bodiesList.length <= 10,
    `body count must stay bounded (was cascading: 2 -> 37 -> 181 -> 910 ...), got ${world.bodiesList.length}`
  );
  const debris = world.bodiesList.filter((b) => b.id.includes("-debris-"));
  for (const d of debris) {
    assert.ok(
      !d.id.includes("-debris--debris-"),
      `debris must never be nested (re-shredded), got ${d.id}`
    );
  }
});

test("each body participates in at most one resolution per step", () => {
  // Chain of three mutually overlapping equal-mass bodies: all three pairs are
  // detected in one step and each body appears in two pairs. Without the
  // one-resolution-per-body guard the second merge read the stale pre-merge
  // b1 and the world silently lost a third of its mass (1.8e25 -> 1.2e25).
  const b0 = body("b0", { position: [-6e6, 0, 0] });
  const b1 = body("b1", { position: [0, 0, 0] });
  const b2 = body("b2", { position: [5e6, 1e6, 0] });

  const world = new SimulationWorld({ dtSeconds: 1, initialBodies: [b0, b1, b2] });

  const massBefore = 3 * 6e24;
  world.step();
  const massAfter = world.bodiesList.reduce((acc, b) => acc + b.mass, 0);

  assert.ok(
    Math.abs(massAfter - massBefore) < 1e-9 * massBefore,
    `total mass must be conserved across a multi-contact step, got ${massAfter} vs ${massBefore}`
  );
  assert.equal(world.bodiesList.length, 2, "exactly one merge resolves; the shared body blocks the rest");
});

test("a later pair touching an already-resolved body is deferred, not resolved", () => {
  const b0 = body("b0", { position: [-6e6, 0, 0] });
  const b1 = body("b1", { position: [0, 0, 0] });
  const b2 = body("b2", { position: [5e6, 1e6, 0] });

  const world = new SimulationWorld({ dtSeconds: 1, initialBodies: [b0, b1, b2] });
  const result = world.step();

  const mergeEvents = result.events.filter((e) => e.eventType === "merge");
  assert.equal(
    mergeEvents.length,
    1,
    `only one merge may execute in the step, got ${mergeEvents.length}`
  );
});
