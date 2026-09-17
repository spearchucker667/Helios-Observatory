import { G_CODATA_2022 } from "../domain/constants.ts";

export const MAX_FULL_GRAVITY_BODIES = 128;

/**
 * Computes exact Newtonian gravitational accelerations for an N-body system.
 * - Massive bodies exert pairwise gravitational forces on each other (Newton's 3rd law symmetry).
 * - Massive bodies exert gravity on tracer particles.
 * - Tracer particles exert ZERO backreaction on any body.
 *
 * @param positions Array of 3D positions [x0, y0, z0, x1, y1, z1, ...] in meters
 * @param masses Array of masses in kg
 * @param isTracer Uint8Array where 1 indicates a tracer (non-gravitating) object
 * @param numBodies Number of bodies in the system
 * @returns Array of accelerations [ax0, ay0, az0, ...] in m/s^2
 */
export function computeAccelerations(
  positions: Float64Array,
  masses: Float64Array,
  isTracer: Uint8Array,
  numBodies: number
): Float64Array {
  const accelerations = new Float64Array(numBodies * 3);

  // 1. Compute pairwise forces between massive bodies
  for (let i = 0; i < numBodies; i++) {
    if (isTracer[i] || masses[i] <= 0) continue;

    const ix = i * 3;
    const px_i = positions[ix];
    const py_i = positions[ix + 1];
    const pz_i = positions[ix + 2];
    const mi = masses[i];

    for (let j = i + 1; j < numBodies; j++) {
      if (isTracer[j] || masses[j] <= 0) continue;

      const jx = j * 3;
      const dx = positions[jx] - px_i;
      const dy = positions[jx + 1] - py_i;
      const dz = positions[jx + 2] - pz_i;

      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq === 0) continue; // Colocated bodies handled by collision system

      const dist = Math.sqrt(distSq);
      // F/m = G * m / r^2; a_vec = (G * m / r^3) * r_vec
      const f_over_r = G_CODATA_2022 / (distSq * dist);

      const accel_i = f_over_r * masses[j];
      accelerations[ix] += dx * accel_i;
      accelerations[ix + 1] += dy * accel_i;
      accelerations[ix + 2] += dz * accel_i;

      const accel_j = f_over_r * mi;
      accelerations[jx] -= dx * accel_j;
      accelerations[jx + 1] -= dy * accel_j;
      accelerations[jx + 2] -= dz * accel_j;
    }
  }

  // 2. Compute gravitational forces from massive bodies on tracers
  for (let i = 0; i < numBodies; i++) {
    if (!isTracer[i]) continue;

    const ix = i * 3;
    const px_i = positions[ix];
    const py_i = positions[ix + 1];
    const pz_i = positions[ix + 2];

    for (let j = 0; j < numBodies; j++) {
      if (isTracer[j] || masses[j] <= 0) continue;

      const jx = j * 3;
      const dx = positions[jx] - px_i;
      const dy = positions[jx + 1] - py_i;
      const dz = positions[jx + 2] - pz_i;

      const distSq = dx * dx + dy * dy + dz * dz;
      if (distSq === 0) continue;

      const dist = Math.sqrt(distSq);
      const f_over_r = G_CODATA_2022 / (distSq * dist);
      const accel = f_over_r * masses[j];

      accelerations[ix] += dx * accel;
      accelerations[ix + 1] += dy * accel;
      accelerations[ix + 2] += dz * accel;
    }
  }

  return accelerations;
}
