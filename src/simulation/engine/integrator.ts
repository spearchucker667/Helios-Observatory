import { computeAccelerations } from "./gravity.ts";

export function stepSimulation(
  positions: Float64Array,
  velocities: Float64Array,
  masses: Float64Array,
  isTracer: Uint8Array,
  dtSeconds: number,
  numBodies: number
): { positions: Float64Array; velocities: Float64Array } {
  const nextPositions = new Float64Array(numBodies * 3);
  const nextVelocities = new Float64Array(numBodies * 3);

  // 1. Calculate a(t)
  const a_t = computeAccelerations(positions, masses, isTracer, numBodies);

  // 2. x(t + dt) = x(t) + v(t)*dt + 0.5 * a(t) * dt^2
  const half_dt_sq = 0.5 * dtSeconds * dtSeconds;
  for (let i = 0; i < numBodies * 3; i++) {
    nextPositions[i] = positions[i] + velocities[i] * dtSeconds + a_t[i] * half_dt_sq;
  }

  // 3. Calculate a(t + dt) using x(t + dt)
  const a_t_plus_dt = computeAccelerations(nextPositions, masses, isTracer, numBodies);

  // 4. v(t + dt) = v(t) + 0.5 * (a(t) + a(t + dt)) * dt
  const half_dt = 0.5 * dtSeconds;
  for (let i = 0; i < numBodies * 3; i++) {
    nextVelocities[i] = velocities[i] + (a_t[i] + a_t_plus_dt[i]) * half_dt;
  }

  return { positions: nextPositions, velocities: nextVelocities };
}
