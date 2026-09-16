import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL (retrieved 2026-09-16). */
export const CALLISTO: MoonBody = {
  identity: {
    id: "callisto",
    name: "Callisto",
    epithet: "The ancient archive",
    kind: "moon",
    category: "Moon",
    parentId: "jupiter",
    color: "#8a7f74",
    discovery: { year: 1610, discoverer: "Galileo Galilei" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 2410.3,
    diameterKm: 4821,
    massKg24: 0.1076,
    massEarths: 0.018,
    gravityG: 0.126,
    escapeVelocityKmS: 2.44,
    densityGCm3: 1.83,
  },
  orbit: {
    semiMajorAxisKm: 1_882_700,
    periodDays: 16.689,
    inclinationDeg: 0.28,
    eccentricity: 0.007,
    orbitalSpeedKmS: 8.2,
    tidallyLocked: true,
  },
  rotation: { periodHours: 400.5, axialTiltDeg: 0 },
  temperature: { meanC: -155 },
  features: [
    {
      id: "valhalla",
      name: "Valhalla Basin",
      kind: "basin",
      approximateLocation: true,
      summary: "A multi-ring impact scar 3,800 km across — the largest such structure in the solar system.",
    },
  ],
  blurb:
    "The most heavily cratered world known: its 4-billion-year-old surface records the early bombardment of the outer solar system, unaltered by geology.",
  notes: {
    interior: "Partially differentiated; a possible deep salty ocean between ice layers, hinted by Galileo magnetometer data.",
    exploration: "Mapped by Voyager and Galileo; considered a promising site for a future crewed Jupiter-system base (radiation is low out here).",
  },
  sources: [{ id: "nasa-galileo-mission" }],
  retrieved: "2026-09-16",
};
