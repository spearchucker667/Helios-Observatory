import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL (retrieved 2026-09-16). */
export const TETHYS: MoonBody = {
  identity: {
    id: "tethys",
    name: "Tethys",
    epithet: "The snow-bright sphere",
    kind: "moon",
    category: "Moon",
    parentId: "saturn",
    color: "#dcdee2",
    discovery: { year: 1684, discoverer: "Giovanni Cassini" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 531.1,
    diameterKm: 1062,
    massKg24: 0.000617,
    massEarths: 1.0e-5,
    gravityG: 0.015,
    escapeVelocityKmS: 0.399,
    densityGCm3: 0.98, // almost pure water ice
  },
  orbit: {
    semiMajorAxisKm: 294_619,
    periodDays: 1.888,
    inclinationDeg: 1.12,
    eccentricity: 0.0001,
    orbitalSpeedKmS: 11.35,
    tidallyLocked: true,
  },
  rotation: { periodHours: 45.3, axialTiltDeg: 0 },
  temperature: { meanC: -187 },
  features: [
    {
      id: "ithaca-chasma",
      name: "Ithaca Chasma",
      kind: "canyon",
      approximateLocation: true,
      summary: "A canyon system 2,000 km long — three-quarters of the way around the moon, up to 3 km deep.",
    },
    {
      id: "odysseus",
      name: "Odysseus Crater",
      kind: "crater",
      approximateLocation: true,
      summary: "A 450 km basin so large it nearly broke the moon — its floor relaxed into a gentle curve.",
    },
  ],
  blurb:
    "Almost pure frozen water — the brightest body in the solar system after Enceladus, split by one of the longest canyons known.",
  notes: {
    exploration: "Voyager 1 imaged Ithaca Chasma in 1980; Cassini mapped it at high resolution from 2005.",
  },
  sources: [{ id: "nasa-cassini" }],
  retrieved: "2026-09-16",
};
