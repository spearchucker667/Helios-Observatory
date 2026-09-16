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
 * a compliant MoonBody representation from the catalogue record.
 */
export function anyMoonById(id: string): MoonBody | undefined {
  const curated = MOON_BY_ID[id];
  if (curated) return curated;

  const entry = SATELLITE_BY_ID[id];
  if (!entry) return undefined;

  // Synthesize lightweight MoonBody from catalogue entry
  const diamKm = entry.physical?.diameterKm ?? 5.0;
  const radiusKm = entry.physical?.meanRadiusKm ?? diamKm / 2;

  return {
    identity: {
      id: entry.id,
      name: entry.name,
      epithet: entry.designation ?? (entry.provisional ? "Provisional satellite" : "Irregular satellite"),
      kind: "moon",
      category: "Moon",
      parentId: entry.parentId,
      color: "#88827c",
      discovery: entry.discovery
        ? {
            year: entry.discovery.year ?? "Recent",
            discoverer: entry.discovery.discoverer ?? "Automated Survey",
          }
        : undefined,
    },
    tier: entry.fidelity === "major" ? 1 : 2,
    physical: {
      meanRadiusKm: radiusKm,
      diameterKm: diamKm,
      massKg24: undefined,
      massEarths: undefined,
      gravityG: 0.001,
      escapeVelocityKmS: 0.01,
      densityGCm3: 1.5,
    },
    orbit: {
      semiMajorAxisKm: entry.orbit.semiMajorAxisKm,
      periodDays: entry.orbit.periodDays,
      inclinationDeg: entry.orbit.inclinationDeg,
      eccentricity: entry.orbit.eccentricity,
      retrograde: entry.orbit.retrograde,
      tidallyLocked: entry.fidelity === "major",
    },
    rotation: {
      periodHours: entry.orbit.periodDays * 24,
      axialTiltDeg: 0,
    },
    temperature: {
      meanC: -180,
    },
    blurb: `${entry.name} is a ${entry.orbit.retrograde ? "retrograde" : "prograde"} natural satellite of ${entry.parentId.charAt(0).toUpperCase() + entry.parentId.slice(1)} belonging to the ${entry.family ?? "outer irregular group"}.`,
    notes: {
      surface: "Small, low-albedo irregular satellite likely captured from the primordial planetesimal disk.",
      exploration: `Identified in institutional surveys with discovery credited to ${entry.discovery?.discoverer ?? "astronomical surveys"}${entry.discovery?.year ? ` (${entry.discovery.year})` : ""}.`,
    },
    sources: entry.sourceIds.map((s) => ({ id: s })),
    retrieved: entry.asOf,
  };
}
