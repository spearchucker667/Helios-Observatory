import { test } from "node:test";
import assert from "node:assert/strict";
import { stepSimulation } from "../physics/integrator.ts";
import { computeInvariantsFromArrays } from "../physics/invariants.ts";

test("integrator conserves energy, linear momentum, and angular momentum over 1000 steps", () => {
  const numBodies = 2;
  const positions = new Float64Array([
    0, 0, 0,
    149597870700, 0, 0 // 1 AU
  ]);
  const velocities = new Float64Array([
    0, 0, 0,
    0, 29780, 0 // Earth orbital speed m/s
  ]);
  const masses = new Float64Array([
    1.9885e30,
    5.972e24
  ]);
  const isTracer = new Uint8Array([0, 0]);

  // Center of mass correction
  const totalMass = masses[0] + masses[1];
  const py = masses[1] * velocities[4];
  velocities[1] = -py / totalMass;
  velocities[4] = velocities[4] - py / totalMass;

  const dt = 3600; // 1 hour steps
  const steps = 1000;

  const initialInvariants = computeInvariantsFromArrays(positions, velocities, masses, isTracer, numBodies);

  let currentPos: Float64Array = positions;
  let currentVel: Float64Array = velocities;
  let accel: Float64Array | undefined = undefined;

  for (let i = 0; i < steps; i++) {
    const next = stepSimulation(currentPos, currentVel, masses, isTracer, dt, numBodies, accel);
    currentPos = next.positions;
    currentVel = next.velocities;
    accel = next.accelerations;
  }

  const finalInvariants = computeInvariantsFromArrays(currentPos, currentVel, masses, isTracer, numBodies);

  // 1. Mechanical energy conservation (bounded oscillation, |dE/E| < 1e-5)
  const relEnergyError = Math.abs(
    (finalInvariants.totalMechanicalEnergyJ - initialInvariants.totalMechanicalEnergyJ) /
    initialInvariants.totalMechanicalEnergyJ
  );
  assert.ok(relEnergyError < 1e-5, `Mechanical energy drift too large: ${relEnergyError}`);

  // 2. Linear momentum conservation (drift normalized by total mass < 1e-5 m/s)
  const pxDrift = Math.abs(finalInvariants.linearMomentumKgMs[0] - initialInvariants.linearMomentumKgMs[0]) / totalMass;
  const pyDrift = Math.abs(finalInvariants.linearMomentumKgMs[1] - initialInvariants.linearMomentumKgMs[1]) / totalMass;
  const pzDrift = Math.abs(finalInvariants.linearMomentumKgMs[2] - initialInvariants.linearMomentumKgMs[2]) / totalMass;
  assert.ok(pxDrift < 1e-5, `Px drift: ${pxDrift}`);
  assert.ok(pyDrift < 1e-5, `Py drift: ${pyDrift}`);
  assert.ok(pzDrift < 1e-5, `Pz drift: ${pzDrift}`);

  // 3. Angular momentum conservation (L_z conserved)
  const initLz = initialInvariants.angularMomentumKgM2s[2];
  const finalLz = finalInvariants.angularMomentumKgM2s[2];
  const relLzError = Math.abs((finalLz - initLz) / initLz);
  assert.ok(relLzError < 1e-5, `Angular momentum drift too large: ${relLzError}`);
});
