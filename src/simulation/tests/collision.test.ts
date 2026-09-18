import { test } from "node:test";
import assert from "node:assert/strict";
import { detectCollisions, sweptContactParameter } from "../collisions/detect.ts";
import { resolveCollision, computeCollisionDiagnostics } from "../collisions/resolve.ts";
import { computeRocheDiagnostics } from "../collisions/disruption.ts";
import { SimulationWorld } from "../engine/world.ts";
import type { SimulationBody } from "../domain/types.ts";

function massive(overrides: Partial<SimulationBody> & { id: string }): SimulationBody {
  return {
    name: overrides.id,
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

test("mass and linear momentum conservation in inelastic merger", () => {
  const bodyA = massive({
    id: "impactor-a",
    mass: 6e24,
    radius: 6.371e6,
    position: [0, 0, 0],
    velocity: [10000, 5000, 0],
  });
  const bodyB = massive({
    id: "impactor-b",
    mass: 4e24,
    radius: 5e6,
    position: [1e6, 0, 0],
    velocity: [-8000, 2000, 0],
  });

  const pBeforeX = bodyA.mass * bodyA.velocity[0] + bodyB.mass * bodyB.velocity[0];
  const pBeforeY = bodyA.mass * bodyA.velocity[1] + bodyB.mass * bodyB.velocity[1];
  const pBeforeZ = bodyA.mass * bodyA.velocity[2] + bodyB.mass * bodyB.velocity[2];
  const mBefore = bodyA.mass + bodyB.mass;

  const pairs = detectCollisions([bodyA, bodyB]);
  assert.equal(pairs.length, 1, "Must detect collision between overlapping bodies");

  const resolution = resolveCollision(pairs[0]);
  assert.equal(resolution.outcome, "merge");

  const survivor = resolution.survivingBody;

  assert.equal(survivor.mass, mBefore, "Total mass must be conserved exactly");

  const pAfterX = survivor.mass * survivor.velocity[0];
  const pAfterY = survivor.mass * survivor.velocity[1];
  const pAfterZ = survivor.mass * survivor.velocity[2];

  assert.ok(Math.abs(pAfterX - pBeforeX) < 1e-4, `Px mismatch: ${pAfterX} vs ${pBeforeX}`);
  assert.ok(Math.abs(pAfterY - pBeforeY) < 1e-4, `Py mismatch: ${pAfterY} vs ${pBeforeY}`);
  assert.ok(Math.abs(pAfterZ - pBeforeZ) < 1e-4, `Pz mismatch: ${pAfterZ} vs ${pBeforeZ}`);

  const expectedRadius = Math.cbrt(Math.pow(bodyA.radius, 3) + Math.pow(bodyB.radius, 3));
  assert.ok(Math.abs(survivor.radius - expectedRadius) < 1e-4, "Merged radius must preserve volume");
});

test("Roche limit calculations against theoretical values", () => {
  // Earth-Moon system test fixture:
  // Fluid Roche limit: d = 2.44 * R_p * (rho_p / rho_s)^(1/3) ≈ 18,367 km
  const earth = massive({
    id: "earth",
    mass: 5.972e24,
    radius: 6.371e6,
    density: 5515,
    position: [0, 0, 0],
  });
  const moon = massive({
    id: "moon",
    classification: "moon",
    mass: 7.342e22,
    radius: 1.737e6,
    density: 3344,
    position: [3.844e8, 0, 0],
    velocity: [0, 1022, 0],
  });

  const diagnosticsNormal = computeRocheDiagnostics(earth, moon);
  assert.ok(diagnosticsNormal.fluidRocheLimitM! > 1.8e7 && diagnosticsNormal.fluidRocheLimitM! < 1.9e7);
  assert.equal(diagnosticsNormal.isInsideFluidLimit, false, "Moon at 384,400 km is safely outside Roche limit");

  const closeMoon = massive({ ...moon, position: [1e7, 0, 0] });
  const diagnosticsClose = computeRocheDiagnostics(earth, closeMoon);
  assert.equal(diagnosticsClose.isInsideFluidLimit, true, "Moon at 10,000 km is inside fluid Roche limit");
});

test("tidal disruption generates debris remnants conserving mass and linear momentum", () => {
  const primary = massive({
    id: "jupiter-like",
    mass: 1.898e27,
    radius: 6.9911e7,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
  });
  const comet = massive({
    id: "comet-shoemaker",
    classification: "comet",
    mass: 1e15,
    radius: 5000,
    position: [1e8, 0, 0],
    velocity: [0, 45000, 0],
  });

  const mBefore = primary.mass + comet.mass;
  const pBeforeX = primary.mass * primary.velocity[0] + comet.mass * comet.velocity[0];
  const pBeforeY = primary.mass * primary.velocity[1] + comet.mass * comet.velocity[1];
  const pBeforeZ = primary.mass * primary.velocity[2] + comet.mass * comet.velocity[2];

  const resolution = resolveCollision({
    bodyA: primary,
    bodyB: comet,
    separationM: 1e8,
    contactDistanceM: primary.radius + comet.radius,
    relativeVelocityMs: 45000,
    isBlackHoleCapture: false,
    contactParameter: 0,
    isSwept: false,
    interactionSource: "contact",
  });
  assert.equal(resolution.outcome, "tidal_disruption", "Must resolve to tidal disruption");
  assert.ok(resolution.remnantBodies && resolution.remnantBodies.length > 0, "Must produce remnant bodies");

  const remnants = resolution.remnantBodies!;
  assert.equal(remnants.length, 6, "Expected 6 debris fragments");

  const totalRemnantMass = remnants.reduce((acc, r) => acc + r.mass, 0);
  const mAfter = resolution.survivingBody.mass + totalRemnantMass;
  const massRelError = Math.abs(mAfter - mBefore) / mBefore;
  assert.ok(massRelError < 1e-12, `Mass mismatch: ${mAfter} vs ${mBefore} (relError: ${massRelError})`);

  let pAfterX = resolution.survivingBody.mass * resolution.survivingBody.velocity[0];
  let pAfterY = resolution.survivingBody.mass * resolution.survivingBody.velocity[1];
  let pAfterZ = resolution.survivingBody.mass * resolution.survivingBody.velocity[2];

  for (const rem of remnants) {
    pAfterX += rem.mass * rem.velocity[0];
    pAfterY += rem.mass * rem.velocity[1];
    pAfterZ += rem.mass * rem.velocity[2];
  }

  assert.ok(Math.abs(pAfterX - pBeforeX) < 1e-4, `Px mismatch: ${pAfterX} vs ${pBeforeX}`);
  const pyRelError = Math.abs(pAfterY - pBeforeY) / Math.abs(pBeforeY);
  assert.ok(pyRelError < 1e-12, `Py mismatch: ${pAfterY} vs ${pBeforeY} (relError: ${pyRelError})`);
  assert.ok(Math.abs(pAfterZ - pBeforeZ) < 1e-4, `Pz mismatch: ${pAfterZ} vs ${pBeforeZ}`);

  for (const rem of remnants) {
    assert.ok(rem.name.includes("Debris"), "Remnant name must identify debris");
    assert.equal(rem.classification, "comet", "Inherited comet classification");
    assert.equal(rem.provenance.mass.kind, "calculated");
    assert.equal(rem.provenance.state.kind, "calculated");
  }
});

test("swept contact parameter solves the exact time of impact", () => {
  // r0 = 10 m separation, closing at 20 m per step, contact radius 1 m.
  const tau = sweptContactParameter([10, 0, 0], [-20, 0, 0], 1);
  assert.ok(tau !== null, "contact must be found");
  assert.ok(Math.abs(tau! - 0.45) < 1e-12, `expected tau=0.45, got ${tau}`);

  // Passing at 2 m closest approach with 1 m contact radius: never touches.
  assert.equal(sweptContactParameter([10, 2, 0], [-20, 0, 0], 1), null);

  // Already overlapping.
  assert.equal(sweptContactParameter([0.5, 0, 0], [0, 0, 0], 1), 0);
});

test("high-speed impactors cannot tunnel through a target in one timestep", () => {
  const dt = 10;
  const target = massive({
    id: "target",
    mass: 6e24,
    radius: 6.371e6,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
  });
  const impactor = massive({
    id: "impactor",
    mass: 6e24,
    radius: 6.371e6,
    position: [-5e7, 0, 0],
    velocity: [2e7, 0, 0], // travels 2e8 m in this step: far beyond the target
  });

  const world = new SimulationWorld({ dtSeconds: dt, initialBodies: [target, impactor] });
  const events: string[] = [];
  world.eventBus.subscribe((evt) => events.push(evt.eventType));

  const result = world.step();

  assert.equal(result.renderSnapshot.numBodies, 1, "the fast body must not pass through the target");
  assert.ok(events.includes("merge"), `expected a merge event, got ${JSON.stringify(events)}`);
});

test("grazing impacts are detected by the swept test", () => {
  const contactRadius = 1.2e7;
  const offset = 6e6; // half the contact radius: a graze, not a head-on hit
  const target = massive({
    id: "target",
    mass: 6e24,
    radius: 6e6,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
  });

  // The relative path sweeps from x = -7e7 to x = +1e7 during this step, so the
  // closest approach (6e6 m) happens strictly inside the step and the endpoints
  // themselves are never in contact. Endpoint-only detection would miss it.
  const impactor = massive({
    id: "impactor",
    mass: 6e24,
    radius: 6e6,
    position: [1.3e7, offset, 0],
    velocity: [8.3e7, 0, 0],
  });

  const endpointsOnly = detectCollisions([target, impactor]);
  assert.equal(endpointsOnly.length, 0, "the endpoint positions are not in contact");

  const pairs = detectCollisions([target, impactor], {
    previousPositions: new Map<string, [number, number, number]>([
      [target.id, [0, 0, 0]],
      [impactor.id, [-7e7, offset, 0]],
    ]),
  });
  assert.equal(pairs.length, 1, "grazing impact must be detected");
  assert.ok(pairs[0].isSwept, "contact must be reported as swept");
  assert.ok(pairs[0].contactParameter > 0 && pairs[0].contactParameter < 1);
  assert.ok(
    Math.abs(pairs[0].separationM - contactRadius) < 1e-3,
    `separation at contact must equal the contact radius, got ${pairs[0].separationM}`
  );
});

test("static overlap is detected at the start of the step", () => {
  const a = massive({ id: "a", position: [0, 0, 0] });
  const b = massive({ id: "b", position: [1e6, 0, 0] });
  const pairs = detectCollisions([a, b]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].contactParameter, 0);
});

test("zero-mass tracers never receive a fabricated physical mass", () => {
  const tracer: SimulationBody = {
    id: "tracer",
    name: "Zero-mass tracer",
    classification: "asteroid",
    gravityRole: "tracer",
    mass: 0,
    radius: 0,
    position: [0, 0, 0],
    velocity: [100, 0, 0],
    provenance: { mass: { kind: "unsupported" }, radius: { kind: "unsupported" }, state: { kind: "custom" } },
  };
  const planet = massive({ id: "planet", position: [1e6, 0, 0], velocity: [0, 0, 0] });

  const diagnostics = computeCollisionDiagnostics(tracer, planet, 100);
  assert.equal(diagnostics.supported, true, "a tracer-vs-body pair is physically defined");
  assert.equal(diagnostics.reducedMassKg, 0, "reduced mass of a zero-mass tracer is exactly zero");
  assert.equal(diagnostics.kineticImpactEnergyJ, 0, "a massless test particle carries no impact energy");
  assert.equal(diagnostics.specificImpactEnergyJkg, 0);
  assert.ok(diagnostics.unsupportedReason?.includes("tracer"));

  const bothTracers = computeCollisionDiagnostics(tracer, { ...tracer, id: "tracer-2" }, 100);
  assert.equal(bothTracers.supported, false);
  assert.equal(bothTracers.reducedMassKg, 0);
  assert.equal(bothTracers.mutualEscapeVelocityMs, undefined);
  assert.equal(bothTracers.bindingEnergyApproximationJ, undefined);
});

test("Roche crossing outside physical contact triggers disruption through the real world path", () => {
  const primary = massive({
    id: "primary",
    classification: "planet",
    mass: 1.898e27,
    radius: 6.9911e7,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
  });

  const roche = computeRocheDiagnostics(primary, massive({ ...primary, id: "probe", mass: 1e15, radius: 5000 }));
  const fluidLimit = roche.fluidRocheLimitM!;
  const separation = fluidLimit * 0.8; // inside the Roche limit but far outside physical contact

  assert.ok(separation > primary.radius * 1.1, "the satellite must NOT be in physical contact");

  const satellite = massive({
    id: "satellite",
    classification: "comet",
    mass: 1e15,
    radius: 5000,
    position: [separation, 0, 0],
    velocity: [0, 0, 0],
  });

  const world = new SimulationWorld({ dtSeconds: 60, initialBodies: [primary, satellite] });
  const events: Array<{ type: string; source?: string | number }> = [];
  world.eventBus.subscribe((evt) =>
    events.push({
      type: evt.eventType,
      source: evt.calculatedQuantities?.contactSource as string | undefined,
    })
  );

  world.step();

  const types = events.map((e) => e.type);
  assert.ok(
    types.includes("roche_limit_crossing"),
    `expected a roche_limit_crossing event, got ${JSON.stringify(types)}`
  );
  assert.ok(
    types.includes("tidal_disruption"),
    `expected tidal disruption from the Roche pass, got ${JSON.stringify(types)}`
  );

  const disruption = events.find((e) => e.type === "tidal_disruption");
  assert.equal(disruption?.source, "roche", "disruption must be attributed to the Roche pass");

  // Survivor + 6 debris remnants.
  assert.equal(world.bodiesList.length, 7, "disruption must generate 6 debris remnants");

  const totalMass = world.bodiesList.reduce((acc, b) => acc + b.mass, 0);
  const expectedMass = primary.mass + satellite.mass;
  assert.ok(
    Math.abs(totalMass - expectedMass) / expectedMass < 1e-12,
    `tidal disruption must conserve mass: ${totalMass} vs ${expectedMass}`
  );
});
