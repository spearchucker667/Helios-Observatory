import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL (retrieved 2026-09-16). */
export const MIMAS: MoonBody = {
  identity: {
    id: "mimas",
    name: "Mimas",
    epithet: "The Death Star moon",
    kind: "moon",
    category: "Moon",
    parentId: "saturn",
    color: "#d2d4d8",
    discovery: { year: 1789, discoverer: "William Herschel" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 198.2,
    diameterKm: 396,
    massKg24: 0.0000375,
    massEarths: 6.3e-7,
    gravityG: 0.006,
    escapeVelocityKmS: 0.157,
    densityGCm3: 1.15,
  },
  orbit: {
    semiMajorAxisKm: 185_539,
    periodDays: 0.942,
    inclinationDeg: 1.57,
    eccentricity: 0.02,
    orbitalSpeedKmS: 14.32,
    tidallyLocked: true,
  },
  rotation: { periodHours: 22.6, axialTiltDeg: 0 },
  temperature: { meanC: -196 },
  features: [
    {
      id: "herschel-crater",
      name: "Herschel Crater",
      kind: "crater",
      approximateLocation: true,
      summary:
        "A 139 km crater a third of the moon's own diameter, with a central peak 6 km tall — the impact that named it 'the Death Star moon' almost split Mimas apart.",
    },
  ],
  blurb:
    "The smallest known body rounded by its own gravity. Its resonance with the Cassini Division sweeps a gap in Saturn's rings wider than itself.",
  notes: {
    observations:
      "A young ocean was inferred in 2024 from libration measurements — the 'Death Star' moon may hide an ocean under 25 km of ice.",
  },
  sources: [{ id: "nasa-cassini" }],
  retrieved: "2026-09-16",
};
