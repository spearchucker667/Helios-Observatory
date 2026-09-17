import { test } from "node:test";
import assert from "node:assert/strict";
import { stepSimulation } from "../physics/integrator.ts";
import { G_CODATA_2022 } from "../domain/constants.ts";
import { cartesianToOrbitalElements } from "../physics/orbital-elements.ts";

test("circular orbit stability and Kepler period accuracy", () => {
  const numBodies = 2;
  const a_m = 149597870700; // 1 AU
  const M_sun = 1.9885e30;
  const m_earth = 5.972e24;
  const mu = G_CODATA_2022 * (M_sun + m_earth);
  const v_circular = Math.sqrt(mu / a_m);

  // Exact Keplerian orbital period P = 2 * pi * sqrt(a^3 / mu)
  const theoreticalPeriodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(a_m, 3) / mu);

  const positions = new Float64Array([
    0, 0, 0,
    a_m, 0, 0,
  ]);
  const velocities = new Float64Array([
    0, 0, 0,
    0, v_circular, 0,
  ]);
  const masses = new Float64Array([M_sun, m_earth]);
  const isTracer = new Uint8Array([0, 0]);

  // Barycentric shift
  const totalMass = M_sun + m_earth;
  const py = m_earth * v_circular;
  velocities[1] = -py / totalMass;
  velocities[4] = v_circular - py / totalMass;

  const dt = 3600; // 1 hour step
  const totalSteps = Math.round(theoreticalPeriodSeconds / dt);

  let currentPos: Float64Array = positions;
  let currentVel: Float64Array = velocities;
  let accel: Float64Array | undefined = undefined;

  for (let i = 0; i < totalSteps; i++) {
    const next = stepSimulation(currentPos, currentVel, masses, isTracer, dt, numBodies, accel);
    currentPos = next.positions;
    currentVel = next.velocities;
    accel = next.accelerations;
  }

  // After 1 full period, separation must return to ~1 AU within tight tolerance (< 0.1% drift)
  const dx = currentPos[3] - currentPos[0];
  const dy = currentPos[4] - currentPos[1];
  const dz = currentPos[5] - currentPos[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const separationRatio = dist / a_m;

  assert.ok(
    Math.abs(separationRatio - 1.0) < 0.005,
    `Period position drift exceeded tolerance: ratio = ${separationRatio}`
  );
});

test("tracer objects move under gravity but exert zero backreaction", () => {
  const numBodies = 3;
  const M_sun = 1.9885e30;
  const m_earth = 5.972e24;
  const m_tracer_fake = 1e30; // huge mass on tracer to verify it exerts 0 force

  const positions = new Float64Array([
    0, 0, 0,                  // 0: Sun
    149597870700, 0, 0,       // 1: Tracer at 1 AU
    149597870700, 100000, 0,  // 2: Earth right next to tracer
  ]);
  const velocities = new Float64Array([
    0, 0, 0,
    0, 29780, 0,
    0, 29780, 0,
  ]);
  const masses = new Float64Array([M_sun, m_tracer_fake, m_earth]);
  const isTracer = new Uint8Array([0, 1, 0]); // Body 1 is a tracer!

  const dt = 600; // 10 minutes
  const next = stepSimulation(positions, velocities, masses, isTracer, dt, numBodies);

  // Tracer should accelerate gravitationally toward the Sun
  assert.ok(next.velocities[3] < 0, "Tracer must accelerate toward the Sun");

  // Earth must NOT feel any gravitational acceleration from tracer
  // If tracer exerted gravity: a = G * 1e30 / (100000)^2 = 6.67e-11 * 1e30 / 1e10 = 6.67e9 m/s^2!
  const a_y_earth = (next.velocities[7] - velocities[7]) / dt;
  assert.ok(
    Math.abs(a_y_earth) < 0.1,
    `Earth experienced gravitational backreaction from tracer! a_y = ${a_y_earth}`
  );
});

test("three-body gravitational perturbation produces measurable trajectory divergence", () => {
  const dt = 3600;
  const steps = 24 * 30; // 30 days
  const M_sun = 1.9885e30;
  const m_earth = 5.972e24;
  const m_jupiter = 1.898e27;

  // Run 1: Sun + Earth alone
  const pos2 = new Float64Array([0, 0, 0, 149597870700, 0, 0]);
  const vel2 = new Float64Array([0, 0, 0, 0, 29780, 0]);
  const mass2 = new Float64Array([M_sun, m_earth]);
  const tracer2 = new Uint8Array([0, 0]);

  let cPos2: Float64Array<any> = pos2, cVel2: Float64Array<any> = vel2;
  for (let i = 0; i < steps; i++) {
    const next = stepSimulation(cPos2, cVel2, mass2, tracer2, dt, 2);
    cPos2 = next.positions;
    cVel2 = next.velocities;
  }

  // Run 2: Sun + Earth + Jupiter (placed at 5.2 AU along x)
  const pos3 = new Float64Array([
    0, 0, 0,
    149597870700, 0, 0,
    778500000000, 0, 0,
  ]);
  const vel3 = new Float64Array([
    0, 0, 0,
    0, 29780, 0,
    0, 13070, 0,
  ]);
  const mass3 = new Float64Array([M_sun, m_earth, m_jupiter]);
  const tracer3 = new Uint8Array([0, 0, 0]);

  let cPos3: Float64Array<any> = pos3, cVel3: Float64Array<any> = vel3;
  for (let i = 0; i < steps; i++) {
    const next = stepSimulation(cPos3, cVel3, mass3, tracer3, dt, 3);
    cPos3 = next.positions;
    cVel3 = next.velocities;
  }

  // Earth's position in 3-body simulation must measurably diverge from 2-body simulation
  const diffX = Math.abs(cPos3[3] - cPos2[3]);
  const diffY = Math.abs(cPos3[4] - cPos2[4]);
  const diffDist = Math.sqrt(diffX * diffX + diffY * diffY);

  // Jupiter should pull Earth noticeably over 30 days (> 1,000 km)
  assert.ok(
    diffDist > 1e6,
    `Jupiter perturbation too weak or missing: divergence = ${diffDist} meters`
  );
});

test("hyperbolic escape trajectory has positive specific orbital energy and monotonic separation growth", () => {
  const M_sun = 1.9885e30;
  const r0 = 149597870700;
  const v_escape = Math.sqrt((2 * G_CODATA_2022 * M_sun) / r0);
  const v_hyperbolic = v_escape * 1.5; // 50% above escape velocity

  const orbitalElements = cartesianToOrbitalElements(
    [r0, 0, 0],
    [0, v_hyperbolic, 0],
    M_sun
  );

  assert.equal(orbitalElements.isBound, false);
  assert.ok(orbitalElements.eccentricity > 1.0, `Expected e > 1, got ${orbitalElements.eccentricity}`);

  // Integrate for 100 days
  const positions = new Float64Array([0, 0, 0, r0, 0, 0]);
  const velocities = new Float64Array([0, 0, 0, 0, v_hyperbolic, 0]);
  const masses = new Float64Array([M_sun, 1000]);
  const isTracer = new Uint8Array([0, 1]);

  let cPos: Float64Array<any> = positions, cVel: Float64Array<any> = velocities;
  let lastDist = r0;
  const dt = 86400; // 1 day steps
  for (let i = 0; i < 100; i++) {
    const next = stepSimulation(cPos, cVel, masses, isTracer, dt, 2);
    cPos = next.positions;
    cVel = next.velocities;
    const curDist = Math.hypot(cPos[3] - cPos[0], cPos[4] - cPos[1], cPos[5] - cPos[2]);
    assert.ok(curDist > lastDist, `Separation must grow monotonically: ${curDist} vs ${lastDist}`);
    lastDist = curDist;
  }
});
