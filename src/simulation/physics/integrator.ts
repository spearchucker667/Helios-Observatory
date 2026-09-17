import { computeAccelerations, type AccelerationOptions } from "./gravity.ts";

export interface IntegrationState {
  positions: Float64Array;
  velocities: Float64Array;
  accelerations?: Float64Array;
}

/**
 * Executes a single second-order symplectic Velocity Verlet (Leapfrog) step:
 * 1. a(t) = computeAccelerations(r(t), v(t))
 * 2. v(t + dt/2) = v(t) + a(t) * (dt / 2)
 * 3. r(t + dt) = r(t) + v(t + dt/2) * dt
 * 4. a(t + dt) = computeAccelerations(r(t + dt), v(t + dt/2))
 * 5. v(t + dt) = v(t + dt/2) + a(t + dt) * (dt / 2)
 */
export function stepSimulation(
  positions: Float64Array,
  velocities: Float64Array,
  masses: Float64Array,
  isTracer: Uint8Array,
  dtSeconds: number,
  numBodies: number,
  knownAccelerations?: Float64Array,
  options?: AccelerationOptions
): IntegrationState {
  const nextPositions = new Float64Array(numBodies * 3);
  const nextVelocities = new Float64Array(numBodies * 3);

  // Step 1: evaluate a(t) (or reuse if known from prior step)
  const a_t = knownAccelerations ?? computeAccelerations(positions, masses, isTracer, numBodies, velocities, options);

  // Step 2 & 3: Half-kick and full drift
  // r(t + dt) = r(t) + v(t) * dt + 0.5 * a(t) * dt^2
  const half_dt = 0.5 * dtSeconds;
  const half_dt_sq = half_dt * dtSeconds;

  for (let i = 0; i < numBodies * 3; i++) {
    nextPositions[i] = positions[i] + velocities[i] * dtSeconds + a_t[i] * half_dt_sq;
  }

  // Half-step velocity for evaluating velocity-dependent forces (e.g. 1PN post-Newtonian terms)
  const v_half = new Float64Array(numBodies * 3);
  for (let i = 0; i < numBodies * 3; i++) {
    v_half[i] = velocities[i] + a_t[i] * half_dt;
  }

  // Step 4: evaluate a(t + dt)
  const a_t_plus_dt = computeAccelerations(nextPositions, masses, isTracer, numBodies, v_half, options);

  // Step 5: Final half-kick
  // v(t + dt) = v(t + dt/2) + 0.5 * a(t + dt) * dt
  for (let i = 0; i < numBodies * 3; i++) {
    nextVelocities[i] = v_half[i] + a_t_plus_dt[i] * half_dt;
  }

  return {
    positions: nextPositions,
    velocities: nextVelocities,
    accelerations: a_t_plus_dt,
  };
}
