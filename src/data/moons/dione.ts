import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL (retrieved 2026-09-16). */
export const DIONE: MoonBody = {
  identity: {
    id: "dione",
    name: "Dione",
    epithet: "The wispy ice-cliff moon",
    kind: "moon",
    category: "Moon",
    parentId: "saturn",
    color: "#c4c8cc",
    discovery: { year: 1684, discoverer: "Giovanni Cassini" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 561.4,
    diameterKm: 1123,
    massKg24: 0.001095,
    massEarths: 1.8e-5,
    gravityG: 0.023,
    escapeVelocityKmS: 0.51,
    densityGCm3: 1.48,
  },
  orbit: {
    semiMajorAxisKm: 377_396,
    periodDays: 2.737,
    inclinationDeg: 0.019,
    eccentricity: 0.002,
    orbitalSpeedKmS: 10.03,
    tidallyLocked: true,
  },
  rotation: { periodHours: 65.7, axialTiltDeg: 0 },
  temperature: { meanC: -186 },
  blurb:
    "A cratered ice moon trailing bright wisps — canyons of ice cliffs hundreds of metres tall, once mistaken for frost streaks by early Voyager imaging.",
  notes: {
    exploration: "Cassini found a possible subsurface ocean and a wispy exosphere; its gravity tugs Enceladus into resonance.",
  },
  sources: [{ id: "nasa-cassini" }],
  retrieved: "2026-09-16",
};
