/**
 * Scientific Distance Measurement Engine
 *
 * Implements exact 3D Euclidean distance calculations between any two solar system
 * bodies based on their heliocentric Cartesian vectors at any given epoch.
 *
 * Constants:
 * - 1 AU = 149,597,870.7 km (IAU 2012 exact definition)
 * - c = 299,792.458 km/s (Speed of light in vacuum)
 */

import { computeEphemerisPosition } from "./ephemeris.ts";
import { bodyById } from "../data/registry.ts";


export const KM_PER_AU = 149_597_870.7;
export const SPEED_OF_LIGHT_KM_S = 299_792.458;

export type ScientificDistance = {
  sourceId: string;
  targetId: string;
  sourcePositionAu: [number, number, number];
  targetPositionAu: [number, number, number];
  distanceAu: number;
  distanceKm: number;
  lightTimeSeconds: number;
  formattedAu: string;
  formattedKm: string;
  formattedLightTime: string;
};

/**
 * Resolves the 3D heliocentric coordinates of any body (Sun, planet, dwarf planet, moon)
 * in Astronomical Units (AU) at a specified epoch.
 */
export function getBodyHeliocentricAu(
  bodyId: string,
  daysFromJ2000: number,
): [number, number, number] | null {
  if (bodyId === "sun") {
    return [0, 0, 0];
  }

  // Check if primary body with analytical ephemeris
  const primaryPos = computeEphemerisPosition(bodyId, daysFromJ2000);
  if (primaryPos) {
    return primaryPos.science.heliocentricAu;
  }

  // Check if natural satellite
  const body = bodyById(bodyId);
  if (body?.identity.kind === "moon" && body.identity.parentId) {
    const parentPos = computeEphemerisPosition(body.identity.parentId, daysFromJ2000);
    if (!parentPos) return null;

    const parentAu = parentPos.science.heliocentricAu;
    const semiMajorKm = body.orbit?.semiMajorAxisKm;
    const periodDays = body.orbit?.periodDays;
    
    if (semiMajorKm === undefined || periodDays === undefined) {
      return null;
    }
    const retrograde = body.orbit?.retrograde ?? false;
    const incRad = ((body.orbit?.inclinationDeg ?? 0) * Math.PI) / 180;
    const theta = (daysFromJ2000 / periodDays) * Math.PI * 2 * (retrograde ? -1 : 1);
    const semiMajorAu = semiMajorKm / KM_PER_AU;
    const cosInc = Math.cos(incRad);
    const sinInc = Math.sin(incRad);

    const moonOffsetAu: [number, number, number] = [
      Math.cos(theta) * semiMajorAu,
      Math.sin(theta) * cosInc * semiMajorAu,
      Math.sin(theta) * sinInc * semiMajorAu,
    ];

    return [
      parentAu[0] + moonOffsetAu[0],
      parentAu[1] + moonOffsetAu[1],
      parentAu[2] + moonOffsetAu[2],
    ];
  }

  return null;
}

/**
 * Format light travel time into human-readable representation.
 */
export function formatLightTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0.0s";
  if (seconds < 60) {
    return `${seconds.toFixed(2)} s`;
  }
  const mins = Math.floor(seconds / 60);
  const remSec = seconds % 60;
  if (mins < 60) {
    return `${mins}m ${remSec.toFixed(1)}s`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m`;
}

/**
 * Calculate Euclidean scientific distance between two bodies.
 */
export function calculateDistance(
  sourceId: string,
  targetId: string,
  daysFromJ2000: number,
): ScientificDistance | null {
  if (!sourceId || !targetId) return null;
  const pA = getBodyHeliocentricAu(sourceId, daysFromJ2000);
  const pB = getBodyHeliocentricAu(targetId, daysFromJ2000);
  if (!pA || !pB) return null;

  const dx = pB[0] - pA[0];
  const dy = pB[1] - pA[1];
  const dz = pB[2] - pA[2];

  const distanceAu = Math.hypot(dx, dy, dz);
  const distanceKm = distanceAu * KM_PER_AU;
  const lightTimeSeconds = distanceKm / SPEED_OF_LIGHT_KM_S;

  return {
    sourceId,
    targetId,
    sourcePositionAu: pA,
    targetPositionAu: pB,
    distanceAu,
    distanceKm,
    lightTimeSeconds,
    formattedAu: `${distanceAu.toFixed(4)} AU`,
    formattedKm: `${Math.round(distanceKm).toLocaleString("en-US")} km`,
    formattedLightTime: formatLightTime(lightTimeSeconds),
  };
}
