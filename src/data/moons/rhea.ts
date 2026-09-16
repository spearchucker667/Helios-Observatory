import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL (retrieved 2026-09-16). */
export const RHEA: MoonBody = {
  identity: {
    id: "rhea",
    name: "Rhea",
    epithet: "The second largest of Saturn's",
    kind: "moon",
    category: "Moon",
    parentId: "saturn",
    color: "#cfd2d4",
    discovery: { year: 1672, discoverer: "Giovanni Cassini" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 763.8,
    diameterKm: 1528,
    massKg24: 0.002331,
    massEarths: 3.9e-5,
    gravityG: 0.026,
    escapeVelocityKmS: 0.635,
    densityGCm3: 1.24,
  },
  orbit: {
    semiMajorAxisKm: 527_108,
    periodDays: 4.518,
    inclinationDeg: 0.35,
    eccentricity: 0.001,
    orbitalSpeedKmS: 8.48,
    tidallyLocked: true,
  },
  rotation: { periodHours: 108.4, axialTiltDeg: 0 },
  temperature: { meanC: -174 },
  blurb:
    "Saturn's second-largest moon: an ancient ball of three-quarters water ice, pocked with bright craters and wispy ice-cliff fractures.",
  notes: {
    exploration: "Cassini flew within 97 km in 2005; a tenuous oxygen–CO₂ exosphere was confirmed in 2010.",
  },
  sources: [{ id: "nasa-cassini" }],
  retrieved: "2026-09-16",
};
