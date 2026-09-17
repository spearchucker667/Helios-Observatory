import { test } from "node:test";
import assert from "node:assert/strict";
import { detectCollisions } from "../collisions/detect.ts";
import { resolveCollision } from "../collisions/resolve.ts";
import { computeRocheDiagnostics } from "../collisions/disruption.ts";
import type { SimulationBody } from "../domain/types.ts";

test("mass and linear momentum conservation in inelastic merger", () => {
  const bodyA: SimulationBody = {
    id: "impactor-a",
    name: "Body A",
    classification: "planet",
    gravityRole: "massive",
    mass: 6e24, // Earth-like
    radius: 6.371e6,
    position: [0, 0, 0],
    velocity: [10000, 5000, 0], // 10 km/s, 5 km/s
    provenance: {
      mass: { kind: "custom" },
      radius: { kind: "custom" },
      state: { kind: "custom" },
    },
  };

  const bodyB: SimulationBody = {
    id: "impactor-b",
    name: "Body B",
    classification: "planet",
    gravityRole: "massive",
    mass: 4e24,
    radius: 5e6,
    position: [1e6, 0, 0], // overlapping
    velocity: [-8000, 2000, 0], // -8 km/s, 2 km/s
    provenance: {
      mass: { kind: "custom" },
      radius: { kind: "custom" },
      state: { kind: "custom" },
    },
  };

  const pBeforeX = bodyA.mass * bodyA.velocity[0] + bodyB.mass * bodyB.velocity[0];
  const pBeforeY = bodyA.mass * bodyA.velocity[1] + bodyB.mass * bodyB.velocity[1];
  const pBeforeZ = bodyA.mass * bodyA.velocity[2] + bodyB.mass * bodyB.velocity[2];
  const mBefore = bodyA.mass + bodyB.mass;

  const pairs = detectCollisions([bodyA, bodyB]);
  assert.equal(pairs.length, 1, "Must detect collision between overlapping bodies");

  const resolution = resolveCollision(pairs[0]);
  assert.equal(resolution.outcome, "merge");

  const survivor = resolution.survivingBody;

  // Mass conservation
  assert.equal(survivor.mass, mBefore, "Total mass must be conserved exactly");

  // Linear momentum conservation
  const pAfterX = survivor.mass * survivor.velocity[0];
  const pAfterY = survivor.mass * survivor.velocity[1];
  const pAfterZ = survivor.mass * survivor.velocity[2];

  assert.ok(Math.abs(pAfterX - pBeforeX) < 1e-4, `Px mismatch: ${pAfterX} vs ${pBeforeX}`);
  assert.ok(Math.abs(pAfterY - pBeforeY) < 1e-4, `Py mismatch: ${pAfterY} vs ${pBeforeY}`);
  assert.ok(Math.abs(pAfterZ - pBeforeZ) < 1e-4, `Pz mismatch: ${pAfterZ} vs ${pBeforeZ}`);

  // Volume conservation
  const expectedRadius = Math.cbrt(Math.pow(bodyA.radius, 3) + Math.pow(bodyB.radius, 3));
  assert.ok(Math.abs(survivor.radius - expectedRadius) < 1e-4, "Merged radius must preserve volume");
});

test("Roche limit calculations against theoretical values", () => {
  // Earth-Moon system test fixture:
  // Primary (Earth): R_p = 6.371e6 m, density rho_p = 5515 kg/m^3
  // Satellite (Moon): R_s = 1.737e6 m, density rho_s = 3344 kg/m^3
  // Fluid Roche limit: d = 2.44 * R_p * (rho_p / rho_s)^(1/3)
  // = 2.44 * 6371 * (5515 / 3344)^(1/3) km = 2.44 * 6371 * 1.1815 ≈ 18,367 km = 1.8367e7 m
  const earth: SimulationBody = {
    id: "earth",
    name: "Earth",
    classification: "planet",
    gravityRole: "massive",
    mass: 5.972e24,
    radius: 6.371e6,
    density: 5515,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    provenance: { mass: { kind: "canonical" }, radius: { kind: "canonical" }, state: { kind: "canonical" } },
  };

  const moon: SimulationBody = {
    id: "moon",
    name: "Moon",
    classification: "moon",
    gravityRole: "massive",
    mass: 7.342e22,
    radius: 1.737e6,
    density: 3344,
    position: [3.844e8, 0, 0], // 384,400 km
    velocity: [0, 1022, 0],
    provenance: { mass: { kind: "canonical" }, radius: { kind: "canonical" }, state: { kind: "canonical" } },
  };

  const diagnosticsNormal = computeRocheDiagnostics(earth, moon);
  assert.ok(diagnosticsNormal.fluidRocheLimitM! > 1.8e7 && diagnosticsNormal.fluidRocheLimitM! < 1.9e7);
  assert.equal(diagnosticsNormal.isInsideFluidLimit, false, "Moon at 384,400 km is safely outside Roche limit");

  // Move Moon inside Roche limit (e.g. at 10,000 km = 1e7 m)
  const closeMoon: SimulationBody = {
    ...moon,
    position: [1e7, 0, 0],
  };

  const diagnosticsClose = computeRocheDiagnostics(earth, closeMoon);
  assert.equal(diagnosticsClose.isInsideFluidLimit, true, "Moon at 10,000 km is inside fluid Roche limit");
});

test("tidal disruption generates debris remnants conserving mass and linear momentum", () => {
  const primary: SimulationBody = {
    id: "jupiter-like",
    name: "Gas Giant",
    classification: "planet",
    gravityRole: "massive",
    mass: 1.898e27,
    radius: 6.9911e7,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    provenance: { mass: { kind: "custom" }, radius: { kind: "custom" }, state: { kind: "custom" } },
  };

  const comet: SimulationBody = {
    id: "comet-shoemaker",
    name: "Infalling Comet",
    classification: "comet",
    gravityRole: "massive",
    mass: 1e15, // 1 trillion kg comet
    radius: 5000,
    position: [1e8, 0, 0], // ~100,000 km, inside Roche limit of gas giant
    velocity: [0, 45000, 0], // 45 km/s
    provenance: { mass: { kind: "custom" }, radius: { kind: "custom" }, state: { kind: "custom" } },
  };

  const mBefore = primary.mass + comet.mass;
  const pBeforeX = primary.mass * primary.velocity[0] + comet.mass * comet.velocity[0];
  const pBeforeY = primary.mass * primary.velocity[1] + comet.mass * comet.velocity[1];
  const pBeforeZ = primary.mass * primary.velocity[2] + comet.mass * comet.velocity[2];

  const collisionPair = {
    bodyA: primary,
    bodyB: comet,
    separationM: 1e8,
    contactDistanceM: primary.radius + comet.radius,
    relativeVelocityMs: 45000,
    isBlackHoleCapture: false,
  };

  const resolution = resolveCollision(collisionPair);
  assert.equal(resolution.outcome, "tidal_disruption", "Must resolve to tidal disruption");
  assert.ok(resolution.remnantBodies && resolution.remnantBodies.length > 0, "Must produce remnant bodies");

  const remnants = resolution.remnantBodies!;
  assert.equal(remnants.length, 6, "Expected 6 debris fragments");

  // Verify total mass conservation across surviving primary and remnants
  const totalRemnantMass = remnants.reduce((acc, r) => acc + r.mass, 0);
  const mAfter = resolution.survivingBody.mass + totalRemnantMass;
  const massRelError = Math.abs(mAfter - mBefore) / mBefore;
  assert.ok(massRelError < 1e-12, `Mass mismatch: ${mAfter} vs ${mBefore} (relError: ${massRelError})`);

  // Verify total linear momentum conservation
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

  // Verify fragment names, classification and provenance
  for (const rem of remnants) {
    assert.ok(rem.name.includes("Debris"), "Remnant name must identify debris");
    assert.equal(rem.classification, "comet", "Inherited comet classification");
    assert.equal(rem.provenance.mass.kind, "calculated");
    assert.equal(rem.provenance.state.kind, "calculated");
  }
});
