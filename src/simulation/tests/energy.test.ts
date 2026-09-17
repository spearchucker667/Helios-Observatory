import { test } from "node:test";
import assert from "node:assert/strict";
import { stepSimulation } from "../engine/integrator.ts";
import { G_CODATA_2022 } from "../domain/constants.ts";

function computeSystemEnergy(positions: Float64Array, velocities: Float64Array, masses: Float64Array, numBodies: number) {
  let kinetic = 0;
  let potential = 0;

  for (let i = 0; i < numBodies; i++) {
    if (masses[i] === 0) continue; // skip tracers
    
    const ix = i * 3;
    const vx = velocities[ix];
    const vy = velocities[ix + 1];
    const vz = velocities[ix + 2];
    kinetic += 0.5 * masses[i] * (vx * vx + vy * vy + vz * vz);

    for (let j = i + 1; j < numBodies; j++) {
      if (masses[j] === 0) continue;
      
      const jx = j * 3;
      const dx = positions[jx] - positions[ix];
      const dy = positions[jx + 1] - positions[ix + 1];
      const dz = positions[jx + 2] - positions[ix + 2];
      
      const r = Math.sqrt(dx * dx + dy * dy + dz * dz);
      potential -= (G_CODATA_2022 * masses[i] * masses[j]) / r;
    }
  }

  return { kinetic, potential, total: kinetic + potential };
}

function computeSystemMomentum(velocities: Float64Array, masses: Float64Array, numBodies: number) {
  let px = 0, py = 0, pz = 0;
  for (let i = 0; i < numBodies; i++) {
    const ix = i * 3;
    px += masses[i] * velocities[ix];
    py += masses[i] * velocities[ix + 1];
    pz += masses[i] * velocities[ix + 2];
  }
  return { px, py, pz };
}

test("integrator conserves energy and momentum over 1000 steps", () => {
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
  let px = 0, py = 0;
  const totalMass = masses[0] + masses[1];
  px = masses[0] * velocities[0] + masses[1] * velocities[3];
  py = masses[0] * velocities[1] + masses[1] * velocities[4];
  
  velocities[0] -= px / totalMass;
  velocities[1] -= py / totalMass;
  velocities[3] -= px / totalMass;
  velocities[4] -= py / totalMass;

  const dt = 3600; // 1 hour steps
  const steps = 1000;

  const initialEnergy = computeSystemEnergy(positions, velocities, masses, numBodies);
  const initialMomentum = computeSystemMomentum(velocities, masses, numBodies);

  let currentPos: Float64Array = positions;
  let currentVel: Float64Array = velocities;

  for (let i = 0; i < steps; i++) {
    const next = stepSimulation(currentPos, currentVel, masses, isTracer, dt, numBodies);
    currentPos = next.positions;
    currentVel = next.velocities;
  }

  const finalEnergy = computeSystemEnergy(currentPos, currentVel, masses, numBodies);
  const finalMomentum = computeSystemMomentum(currentVel, masses, numBodies);

  // Energy conservation (Symplectic integrator oscillates but shouldn't drift linearly)
  // Check relative error is small
  const errorE = Math.abs((finalEnergy.total - initialEnergy.total) / initialEnergy.total);
  assert.ok(errorE < 1e-5, `Energy drifted too much: ${errorE}`);

  // Momentum should be perfectly conserved to floating point limits
  assert.ok(Math.abs(finalMomentum.px - initialMomentum.px) / totalMass < 1e-5);
  assert.ok(Math.abs(finalMomentum.py - initialMomentum.py) / totalMass < 1e-5);
  assert.ok(Math.abs(finalMomentum.pz - initialMomentum.pz) / totalMass < 1e-5);
});
