import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA Solar System Exploration (retrieved 2026-09-16). */
export const PHOBOS: MoonBody = {
  identity: {
    id: "phobos",
    name: "Phobos",
    epithet: "The doomed inner moon",
    kind: "moon",
    category: "Moon",
    parentId: "mars",
    color: "#8d8177",
    discovery: { year: 1877, discoverer: "Asaph Hall" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 11.27,
    diameterKm: 22.5, // irregular ~27×22×18 km
    massKg24: 1.0659e-8,
    massEarths: 1.8e-9,
    gravityG: 0.00057,
    escapeVelocityKmS: 0.0114,
    densityGCm3: 1.876,
  },
  orbit: {
    semiMajorAxisKm: 9_376,
    periodDays: 0.319, // rises in the west, sets in the east — twice a Martian day
    inclinationDeg: 1.08,
    eccentricity: 0.015,
    orbitalSpeedKmS: 2.14,
    tidallyLocked: true,
  },
  rotation: { periodHours: 7.66, axialTiltDeg: 0 },
  temperature: { meanC: -40 },
  features: [
    {
      id: "stickney",
      name: "Stickney Crater",
      kind: "crater",
      approximateLocation: true,
      summary: "A 9 km crater that nearly shattered the moon — the impact grooves radiate across the whole surface.",
    },
  ],
  blurb:
    "The larger of Mars' two tiny moons, skimming so low it circles three times a day. Tidal forces drag it inward by ~1.8 m per century — in ~50 Myr it shatters into a ring.",
  notes: {
    exploration: "Overflown by Mars orbiters since Viking; Mars Moons eXploration (MMX, JAXA) aims to return a sample in the 2030s.",
  },
  sources: [{ id: "nasa-solar-system-exploration" }],
  retrieved: "2026-09-16",
};
