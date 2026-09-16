import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL (retrieved 2026-09-16). */
export const GANYMEDE: MoonBody = {
  identity: {
    id: "ganymede",
    name: "Ganymede",
    epithet: "The largest moon of all",
    kind: "moon",
    category: "Moon",
    parentId: "jupiter",
    color: "#a89f96",
    discovery: { year: 1610, discoverer: "Galileo Galilei" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 2634.1,
    diameterKm: 5268,
    massKg24: 0.1482,
    massEarths: 0.0248,
    gravityG: 0.146,
    escapeVelocityKmS: 2.74,
    densityGCm3: 1.94,
  },
  orbit: {
    semiMajorAxisKm: 1_070_400,
    periodDays: 7.155,
    inclinationDeg: 0.2,
    eccentricity: 0.001,
    orbitalSpeedKmS: 10.88,
    tidallyLocked: true,
  },
  rotation: { periodHours: 171.7, axialTiltDeg: 0 },
  temperature: { meanC: -163 },
  features: [
    {
      id: "galileo-regio",
      name: "Galileo Regio",
      kind: "region",
      approximateLocation: true,
      summary: "A 3,200 km dark, ancient cratered province — one of the oldest surfaces known, contrasted with younger bright grooved terrain (sulci).",
    },
  ],
  blurb:
    "Larger than Mercury and the only moon with its own magnetic field — a conducting ocean lurks between ice layers beneath the patchwork surface.",
  notes: {
    interior: "Iron core, rock mantle, and stacked ice layers with a saline ocean in between; its dynamo makes it the only magnetised moon.",
    exploration: "Galileo mapped the field and confirmed the ocean; JUICE (ESA) enters orbit around Ganymede in 2034 — the first moon orbit by any spacecraft.",
  },
  sources: [{ id: "nasa-solar-system-exploration" }, { id: "esa-bepicolombo" }],
  retrieved: "2026-09-16",
};
