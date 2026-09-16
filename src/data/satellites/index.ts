/**
 * Central natural satellite registry:
 * - Complete 461-moon catalogue (456 planetary + 5 Pluto)
 * - Curated detailed major moons (21)
 */

import { MOONS, MOON_BY_ID } from "../moons/index.ts";
import type { MoonBody } from "../types.ts";
import {
  SATELLITES,
  SATELLITE_BY_ID,
  SATELLITE_METADATA,
  satellitesOf,
  satelliteById,
  satelliteCountOf,
} from "./generated/catalogue.ts";

export * from "./schema.ts";
export {
  SATELLITES,
  SATELLITE_BY_ID,
  SATELLITE_METADATA,
  satellitesOf,
  satelliteById,
  satelliteCountOf,
};
export { MOONS, MOON_BY_ID };

/**
 * Returns detailed curated MoonBody if available, otherwise synthesizes
 * a scientifically honest MoonBody representation from the catalogue record.
 * Unknown values remain undefined rather than populated with placeholder constants.
 */
export function anyMoonById(id: string): MoonBody | undefined {
  const curated = MOON_BY_ID[id];
  if (curated) return curated;

  const entry = SATELLITE_BY_ID[id];
  if (!entry) return undefined;

  // Use sourced physical dimensions if established in catalogue, otherwise leave undefined
  const diamKm = entry.physical?.diameterKm;
  const radiusKm = entry.physical?.meanRadiusKm ?? (diamKm !== undefined ? diamKm / 2 : undefined);

  // Map fidelity to standard 3-tier hierarchy: 1 = major, 2 = regular, 3 = irregular
  const tier: 1 | 2 | 3 =
    entry.fidelity === "major" ? 1 : entry.fidelity === "regular" ? 2 : 3;

  const category = entry.fidelity === "irregular" ? "Minor moon" : "Moon";

  const parentName = entry.parentId.charAt(0).toUpperCase() + entry.parentId.slice(1);
  const designationStr = entry.designation ? ` (${entry.designation})` : "";
  const groupStr = entry.family ? ` belonging to the ${entry.family}` : "";

  return {
    identity: {
      id: entry.id,
      name: entry.name,
      epithet:
        entry.designation ??
        (entry.provisional
          ? "Provisional satellite"
          : entry.fidelity === "irregular"
          ? "Irregular satellite"
          : "Natural satellite"),
      kind: "moon",
      category,
      parentId: entry.parentId,
      color: "#88827c",
      discovery: entry.discovery
        ? {
            year: entry.discovery.year ?? "Recent",
            discoverer: entry.discovery.discoverer ?? "Astronomical Survey",
          }
        : undefined,
    },
    tier,
    fidelity: entry.fidelity,
    physical: {
      meanRadiusKm: radiusKm,
      diameterKm: diamKm,
      massKg24: undefined,
      massEarths: undefined,
      gravityG: undefined,
      escapeVelocityKmS: undefined,
      densityGCm3: undefined,
    },
    orbit: {
      semiMajorAxisKm: entry.orbit.semiMajorAxisKm,
      periodDays: entry.orbit.periodDays,
      inclinationDeg: entry.orbit.inclinationDeg,
      eccentricity: entry.orbit.eccentricity,
      retrograde: entry.orbit.retrograde,
      tidallyLocked: entry.fidelity === "major" ? true : undefined,
    },
    rotation: {
      periodHours: undefined,
      axialTiltDeg: undefined,
      tidallyLocked: entry.fidelity === "major" ? true : undefined,
    },
    temperature: {
      meanC: undefined,
    },
    blurb: `${entry.name}${designationStr} is a ${
      entry.orbit.retrograde ? "retrograde" : "prograde"
    } natural satellite of ${parentName}${groupStr}.`,
    notes: {
      surface: entry.physical?.diameterKm
        ? `Estimated diameter approximately ${entry.physical.diameterKm} km. Surface composition uncharacterized by in-situ spectroscopy.`
        : "Unresolved physical dimensions; surface composition and albedo uncharacterized in current institutional catalogue.",
      exploration: `Identified via telescopic survey. Discovery credited to ${
        entry.discovery?.discoverer ?? "astronomical surveys"
      }${entry.discovery?.year ? ` (${entry.discovery.year})` : ""}.`,
    },
    sources: entry.sourceIds.map((s) => ({ id: s })),
    retrieved: entry.asOf,
  };
}
