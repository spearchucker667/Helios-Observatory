/**
 * Deep Space & Oort Cloud logarithmic coordinate transformation.
 *
 * Maps astronomical distances from 0 AU past 100,000 AU into a unified
 * WebGL scene volume (0 to ~250 units) while preserving relative ordering,
 * smooth continuity at Neptune's orbit (30 AU), and invertible coordinates.
 */

export const NEPTUNE_AU = 30.0;
export const NEPTUNE_SCENE_R = 49.2;
export const LOG_SCALE_FACTOR = 48.0;
export const LOG_SCALE_OFFSET = 10.0;

export const OORT_CLOUD_INNER_MIN_AU = 2_000;
export const OORT_CLOUD_INNER_MAX_AU = 5_000;
export const OORT_CLOUD_OUTER_AU = 100_000;

export const KUIPER_BELT_INNER_AU = 30.0;
export const KUIPER_BELT_OUTER_AU = 50.0;

/**
 * Transforms heliocentric distance in AU to a 3D scene radius in deep space view.
 * Continuous and monotonically strictly increasing.
 */
export function auToDeepSpaceRadius(au: number): number {
  if (au <= 0) return 0;
  if (au <= NEPTUNE_AU) {
    return au * (NEPTUNE_SCENE_R / NEPTUNE_AU);
  }
  const delta = (au - NEPTUNE_AU) / LOG_SCALE_OFFSET;
  return NEPTUNE_SCENE_R + LOG_SCALE_FACTOR * Math.log10(1 + delta);
}

/**
 * Invert scene radius back to astronomical AU.
 */
export function deepSpaceRadiusToAu(radius: number): number {
  if (radius <= 0) return 0;
  if (radius <= NEPTUNE_SCENE_R) {
    return radius / (NEPTUNE_SCENE_R / NEPTUNE_AU);
  }
  const exponent = (radius - NEPTUNE_SCENE_R) / LOG_SCALE_FACTOR;
  return NEPTUNE_AU + LOG_SCALE_OFFSET * (Math.pow(10, exponent) - 1);
}

/**
 * Checks whether a given distance in AU falls within the inferred Oort Cloud domain.
 */
export function isOortCloudAu(au: number): boolean {
  return au >= OORT_CLOUD_INNER_MIN_AU && au <= OORT_CLOUD_OUTER_AU;
}

/**
 * Checks whether a given distance in AU falls within the Kuiper Belt domain.
 */
export function isKuiperBeltAu(au: number): boolean {
  return au >= KUIPER_BELT_INNER_AU && au <= KUIPER_BELT_OUTER_AU;
}
