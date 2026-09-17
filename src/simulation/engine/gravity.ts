import { G_CODATA_2022 } from "../domain/constants.ts";

/**
 * Computes the gravitational acceleration for each body.
 * Massive bodies attract each other and tracers.
 * Tracers do not attract anything.
 * 
 * @param positions Array of positions [x, y, z] for each body (length N)
 * @param masses Array of masses for each body (length N)
 * @param gravityRoles Array of roles (0 for massive, 1 for tracer)
 * @returns Array of accelerations [ax, ay, az] (length N)
 */
export function computeAccelerations(
  positions: Float64Array,
  masses: Float64Array,
  isTracer: Uint8Array,
  numBodies: number
): Float64Array {
  const accelerations = new Float64Array(numBodies * 3);

  // Compute pairwise forces between massive bodies
  for (let i = 0; i < numBodies; i++) {
    if (isTracer[i]) continue;
    
    const ix = i * 3;
    const px_i = positions[ix];
    const py_i = positions[ix + 1];
    const pz_i = positions[ix + 2];

    for (let j = i + 1; j < numBodies; j++) {
      if (isTracer[j]) continue;
      
      const jx = j * 3;
      const dx = positions[jx] - px_i;
      const dy = positions[jx + 1] - py_i;
      const dz = positions[jx + 2] - pz_i;
      
      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq);
      
      // F/m = G * m_j / r^2
      // a_i = (G * m_j / r^3) * r_vec
      const f_over_r = G_CODATA_2022 / (distSq * dist);
      
      const accel_i = f_over_r * masses[j];
      accelerations[ix] += dx * accel_i;
      accelerations[ix + 1] += dy * accel_i;
      accelerations[ix + 2] += dz * accel_i;
      
      const accel_j = f_over_r * masses[i];
      accelerations[jx] -= dx * accel_j;
      accelerations[jx + 1] -= dy * accel_j;
      accelerations[jx + 2] -= dz * accel_j;
    }
  }

  // Compute forces from massive bodies onto tracers
  for (let i = 0; i < numBodies; i++) {
    if (!isTracer[i]) continue;
    
    const ix = i * 3;
    const px_i = positions[ix];
    const py_i = positions[ix + 1];
    const pz_i = positions[ix + 2];

    for (let j = 0; j < numBodies; j++) {
      if (isTracer[j]) continue; // Only massive bodies exert gravity
      
      const jx = j * 3;
      const dx = positions[jx] - px_i;
      const dy = positions[jx + 1] - py_i;
      const dz = positions[jx + 2] - pz_i;
      
      const distSq = dx * dx + dy * dy + dz * dz;
      const dist = Math.sqrt(distSq);
      
      const f_over_r = G_CODATA_2022 / (distSq * dist);
      const accel_i = f_over_r * masses[j];
      
      accelerations[ix] += dx * accel_i;
      accelerations[ix + 1] += dy * accel_i;
      accelerations[ix + 2] += dz * accel_i;
    }
  }

  return accelerations;
}
