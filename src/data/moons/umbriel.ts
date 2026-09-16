import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Voyager 2 mission pages (retrieved 2026-09-16). */
export const UMBRIEL: MoonBody = {
  identity: {
    id: "umbriel",
    name: "Umbriel",
    epithet: "The dark one",
    kind: "moon",
    category: "Moon",
    parentId: "uranus",
    color: "#6e6a66",
    discovery: { year: 1851, discoverer: "William Lassell" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 584.7,
    diameterKm: 1169,
    massKg24: 0.001172,
    massEarths: 2.0e-5,
    gravityG: 0.023,
    escapeVelocityKmS: 0.52,
    densityGCm3: 1.39,
  },
  orbit: {
    semiMajorAxisKm: 266_000,
    periodDays: 4.144,
    inclinationDeg: 0.13,
    eccentricity: 0.003,
    orbitalSpeedKmS: 4.67,
    tidallyLocked: true,
  },
  rotation: { periodHours: 99.5, axialTiltDeg: 0 },
  temperature: { meanC: -214 },
  features: [
    {
      id: "wunda",
      name: "Wunda",
      kind: "crater",
      approximateLocation: true,
      summary: "A mysterious bright ring of material 131 km across, sitting on the equator — unexplained since 1986.",
    },
  ],
  blurb:
    "The darkest of the Uranian moons, reflecting just 16 % of the light that hits it — an ancient, unmodified surface of ice and dark rock.",
  notes: {
    observations: "Wunda's bright ring is one of the unsolved curiosities of the Voyager 2 archive.",
  },
  sources: [{ id: "nasa-voyager" }],
  retrieved: "2026-09-16",
};
