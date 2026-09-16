import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA Solar System Exploration (retrieved 2026-09-16). */
export const DEIMOS: MoonBody = {
  identity: {
    id: "deimos",
    name: "Deimos",
    epithet: "The outer terror",
    kind: "moon",
    category: "Moon",
    parentId: "mars",
    color: "#9a9088",
    discovery: { year: 1877, discoverer: "Asaph Hall" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 6.2,
    diameterKm: 12.4, // ~15×12×11 km
    massKg24: 1.4762e-9,
    massEarths: 2.5e-10,
    gravityG: 0.0003,
    escapeVelocityKmS: 0.0057,
    densityGCm3: 1.471,
  },
  orbit: {
    semiMajorAxisKm: 23_463,
    periodDays: 1.263,
    inclinationDeg: 1.79,
    eccentricity: 0.0002, // near-perfect circle
    orbitalSpeedKmS: 1.35,
    tidallyLocked: true,
  },
  rotation: { periodHours: 30.3, axialTiltDeg: 0 },
  temperature: { meanC: -40 },
  blurb:
    "Mars' small, smooth outer moon — a body so light that a good sprint could launch you clear of it. Named for the Greek personification of dread.",
  notes: {
    surface: "Smoother than Phobos: regolith buries its craters, though Stickney-scale hits would still be fatal.",
    exploration: "Imaged by Viking and HiRISE; a sample-return target for future small-body missions.",
  },
  sources: [{ id: "nasa-solar-system-exploration" }],
  retrieved: "2026-09-16",
};
