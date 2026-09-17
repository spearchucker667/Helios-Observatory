import { test } from "node:test";
import assert from "node:assert/strict";
import { stepSimulation } from "../engine/integrator.ts";

test("circular orbit stability", () => {
  const numBodies = 2;
  const positions = new Float64Array([
    0, 0, 0,
    149597870700, 0, 0 // 1 AU
  ]);
  const velocities = new Float64Array([
    0, -0.089, 0, // slight reflex
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

  // 1 year is approx 3.154e7 seconds. With dt=86400 (1 day), it's 365 steps
  const dt = 86400; 
  const steps = 365;

  let currentPos: Float64Array = positions;
  let currentVel: Float64Array = velocities;

  for (let i = 0; i < steps; i++) {
    const next = stepSimulation(currentPos, currentVel, masses, isTracer, dt, numBodies);
    currentPos = next.positions;
    currentVel = next.velocities;
  }

  // After 1 year, Earth should be back near 1 AU
  const dx = currentPos[3] - currentPos[0];
  const dy = currentPos[4] - currentPos[1];
  const dz = currentPos[5] - currentPos[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Orbit should be stable, distance stays near 1 AU
  const distAu = dist / 149597870700;
  assert.ok(distAu > 0.95 && distAu < 1.05, `Orbit unstable: ${distAu} AU`);
});

test("tracer objects move but do not attract", () => {
  const numBodies = 3;
  // 0: Sun, 1: Tracer near Sun, 2: Earth
  const positions = new Float64Array([
    0, 0, 0,
    149597870700, 0, 0, // Tracer at Earth's position
    149597870700, 1000, 0 // Earth slightly offset
  ]);
  const velocities = new Float64Array([
    0, 0, 0,
    0, 29780, 0,
    0, 29780, 0
  ]);
  // Give tracer a mass but mark it as tracer
  const masses = new Float64Array([
    1.9885e30,
    1e30, // massive but tracer
    5.972e24
  ]);
  const isTracer = new Uint8Array([0, 1, 0]);

  const dt = 3600;
  
  const next = stepSimulation(positions, velocities, masses, isTracer, dt, numBodies);

  // Tracer should accelerate towards Sun
  assert.ok(next.velocities[3] < 0);
  
  // Earth should not accelerate towards tracer (only towards Sun)
  // If tracer attracted Earth, Earth would have a massive y-acceleration.
  // We can check Earth's velocity.
  const a_y_earth = (next.velocities[7] - velocities[7]) / dt;
  
  // Gravitational acceleration from Sun on Earth is roughly GM/r^2 ≈ 0.0059 m/s^2
  // If tracer (mass 1e30) attracted Earth at 1000m, a = GM/r^2 ≈ 6.67e-11 * 1e30 / 1e6 = 6.67e13 m/s^2.
  assert.ok(Math.abs(a_y_earth) < 0.1, `Earth attracted by tracer! a_y=${a_y_earth}`);
});
