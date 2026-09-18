import { AU_M } from "@/simulation/domain/constants";
import type { DisplayMode } from "@/simulation/state/sandbox-store";

/**
 * Maps simulation Cartesian position (SI meters) to Three.js scene coordinates.
 * In accordance with Section 44, changing display mode produces ZERO change in the
 * underlying physics engine.
 */
export function mapSimPositionToScene(
  simPos: [number, number, number],
  mode: DisplayMode
): [number, number, number] {
  const [x, y, z] = simPos;
  const distM = Math.hypot(x, y, z);
  if (distM < 1) return [0, 0, 0];

  const distAu = distM / AU_M;

  if (mode === "distance") {
    // Exact linear scale: 1 AU = 5.2 scene units
    const scale = 5.2 / AU_M;
    return [x * scale, z * scale, -y * scale]; // Astronomical Z-up to Three.js Y-up
  }

  // Presentation & relative-size modes use smooth logarithmic/power compression
  // so Mercury and Neptune both fit comfortably in the camera frustum.
  // 1 AU -> 11.6 scene units (matching canonical Earth)
  const sceneRadius = 11.6 * Math.pow(Math.max(0.01, distAu), 0.44);
  const factor = sceneRadius / distM;

  return [x * factor, z * factor, -y * factor];
}

/**
 * Maps simulation body radius (SI meters) to Three.js scene radius.
 */
export function mapSimRadiusToScene(
  radiusM: number,
  classification: string,
  mode: DisplayMode
): number {
  const radiusKm = radiusM / 1000;

  if (classification === "star") {
    return mode === "relative-size" ? 3.5 : 2.65;
  }

  if (classification === "black-hole" || classification === "neutron-star" || classification === "pulsar" || classification === "magnetar") {
    // Compact objects have microscopic physical radii, so give them a clear marker size
    return 0.18;
  }

  if (mode === "relative-size") {
    // Alternative size emphasis: Earth radius (6,371 km) = 0.34 scene units.
    // NOTE: this is a deliberately compressed *presentation* scale, not a
    // physically proportional radius scale across object classes.
    return Math.max(0.04, (radiusKm / 6371) * 0.34);
  }

  // Presentation scale
  return Math.max(0.08, 0.34 * Math.pow(Math.max(0.01, radiusKm / 6371), 0.42));
}

/**
 * Maps simulation velocity (SI m/s) to a visualization direction and scaled length.
 */
export function mapSimVelocityToSceneVector(
  simVel: [number, number, number]
): [number, number, number] {
  const [vx, vy, vz] = simVel;
  const speed = Math.hypot(vx, vy, vz);
  if (speed < 1) return [0, 0, 0];

  // Visual length between 0.5 and 4.0 scene units
  const len = Math.min(4.0, Math.max(0.6, Math.log10(speed + 1) * 0.7));
  const factor = len / speed;

  return [vx * factor, vz * factor, -vy * factor];
}
