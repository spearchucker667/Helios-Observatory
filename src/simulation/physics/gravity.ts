import { G_CODATA_2022, C_M_S } from "../domain/constants.ts";

export const MAX_FULL_GRAVITY_BODIES = 256;
export const MAX_TOTAL_SIMULATION_BODIES = 1024;

const C_SQ = C_M_S * C_M_S;

export interface AccelerationOptions {
  enableRelativity?: boolean;
}

/**
 * Computes gravitational accelerations for an N-body system.
 * - Massive bodies exert pairwise gravitational forces on each other (Newton's 3rd law symmetry).
 * - Massive bodies exert gravity on tracer particles.
 * - Tracer particles exert ZERO backreaction on any body.
 * - When options.enableRelativity is true, incorporates 1PN (First Post-Newtonian)
 *   relativistic corrections responsible for Schwarzschild apsidal precession.
 *
 * @param positions Array of 3D positions [x0, y0, z0, x1, y1, z1, ...] in meters
 * @param masses Array of masses in kg
 * @param isTracer Uint8Array where 1 indicates a tracer (non-gravitating) object
 * @param numBodies Number of bodies in the system
 * @param velocities Optional 3D velocities array for 1PN post-Newtonian evaluations
 * @param options Optional physics configuration
 * @returns Array of accelerations [ax0, ay0, az0, ...] in m/s^2
 */
export function computeAccelerations(
  positions: Float64Array,
  masses: Float64Array,
  isTracer: Uint8Array,
  numBodies: number,
  velocities?: Float64Array,
  options?: AccelerationOptions
): Float64Array {
  const accelerations = new Float64Array(numBodies * 3);
  const enableRelativity = options?.enableRelativity === true && velocities !== undefined;

  // 1. Compute pairwise forces between massive bodies
  for (let i = 0; i < numBodies; i++) {
    if (isTracer[i] || masses[i] <= 0) continue;

    const ix = i * 3;
    const px_i = positions[ix];
    const py_i = positions[ix + 1];
    const pz_i = positions[ix + 2];
    const mi = masses[i];

    const vx_i = enableRelativity ? velocities![ix] : 0;
    const vy_i = enableRelativity ? velocities![ix + 1] : 0;
    const vz_i = enableRelativity ? velocities![ix + 2] : 0;

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
      const accel_j = f_over_r * mi;

      accelerations[ix] += dx * accel_i;
      accelerations[ix + 1] += dy * accel_i;
      accelerations[ix + 2] += dz * accel_i;

      accelerations[jx] -= dx * accel_j;
      accelerations[jx + 1] -= dy * accel_j;
      accelerations[jx + 2] -= dz * accel_j;

      // 1PN post-Newtonian correction for pairwise interactions
      if (enableRelativity) {
        const mj = masses[j];
        const vx_j = velocities![jx];
        const vy_j = velocities![jx + 1];
        const vz_j = velocities![jx + 2];

        // Relative velocity: v_rel = v_i - v_j
        const dvx = vx_i - vx_j;
        const dvy = vy_i - vy_j;
        const dvz = vz_i - vz_j;
        const vRelSq = dvx * dvx + dvy * dvy + dvz * dvz;

        // r_vec . v_rel (dx points from i to j, so r_rel = r_j - r_i)
        const rDotV = dx * dvx + dy * dvy + dz * dvz;

        // 1PN acceleration on body i due to body j:
        // a_1pn = (G * mj / (c^2 * r^3)) * [ (4 * G*(mi + mj)/r - v_rel^2) * r_vec + 4 * (r_vec . v_rel) * v_rel ]
        const prefactor_i = (G_CODATA_2022 * mj) / (C_SQ * distSq * dist);
        const termR_i = (4 * G_CODATA_2022 * (mi + mj)) / dist - vRelSq;
        const termV_i = 4 * rDotV;

        accelerations[ix] += prefactor_i * (dx * termR_i + dvx * termV_i);
        accelerations[ix + 1] += prefactor_i * (dy * termR_i + dvy * termV_i);
        accelerations[ix + 2] += prefactor_i * (dz * termR_i + dvz * termV_i);

        // Equal and opposite backreaction for body j (r_ji = -r_ij, v_ji = -v_ij)
        const prefactor_j = (G_CODATA_2022 * mi) / (C_SQ * distSq * dist);
        accelerations[jx] -= prefactor_j * (dx * termR_i + dvx * termV_i);
        accelerations[jx + 1] -= prefactor_j * (dy * termR_i + dvy * termV_i);
        accelerations[jx + 2] -= prefactor_j * (dz * termR_i + dvz * termV_i);
      }
    }
  }

  // 2. Compute gravitational forces from massive bodies on tracers
  for (let i = 0; i < numBodies; i++) {
    if (!isTracer[i]) continue;

    const ix = i * 3;
    const px_i = positions[ix];
    const py_i = positions[ix + 1];
    const pz_i = positions[ix + 2];

    const vx_i = enableRelativity ? velocities![ix] : 0;
    const vy_i = enableRelativity ? velocities![ix + 1] : 0;
    const vz_i = enableRelativity ? velocities![ix + 2] : 0;

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

      // 1PN post-Newtonian acceleration for tracer in gravitational field of body j
      if (enableRelativity) {
        const mj = masses[j];
        const vx_j = velocities![jx];
        const vy_j = velocities![jx + 1];
        const vz_j = velocities![jx + 2];

        const dvx = vx_i - vx_j;
        const dvy = vy_i - vy_j;
        const dvz = vz_i - vz_j;
        const vRelSq = dvx * dvx + dvy * dvy + dvz * dvz;
        const rDotV = dx * dvx + dy * dvy + dz * dvz;

        const prefactor = (G_CODATA_2022 * mj) / (C_SQ * distSq * dist);
        const termR = (4 * G_CODATA_2022 * mj) / dist - vRelSq;
        const termV = 4 * rDotV;

        accelerations[ix] += prefactor * (dx * termR + dvx * termV);
        accelerations[ix + 1] += prefactor * (dy * termR + dvy * termV);
        accelerations[ix + 2] += prefactor * (dz * termR + dvz * termV);
      }
    }
  }

  return accelerations;
}
