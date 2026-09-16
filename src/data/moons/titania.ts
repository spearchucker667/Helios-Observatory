import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Voyager 2 mission pages (retrieved 2026-09-16). */
export const TITANIA: MoonBody = {
  identity: {
    id: "titania",
    name: "Titania",
    epithet: "Queen of the Uranian moons",
    kind: "moon",
    category: "Moon",
    parentId: "uranus",
    color: "#a8a29a",
    discovery: { year: 1787, discoverer: "William Herschel" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 788.4,
    diameterKm: 1577,
    massKg24: 0.003527,
    massEarths: 5.9e-5,
    gravityG: 0.037,
    escapeVelocityKmS: 0.77,
    densityGCm3: 1.71,
  },
  orbit: {
    semiMajorAxisKm: 435_910,
    periodDays: 8.706,
    inclinationDeg: 0.34,
    eccentricity: 0.001,
    orbitalSpeedKmS: 3.64,
    tidallyLocked: true,
  },
  rotation: { periodHours: 208.9, axialTiltDeg: 0 },
  temperature: { meanC: -203 },
  features: [
    {
      id: "messina-chasmata",
      name: "Messina Chasmata",
      kind: "canyon",
      approximateLocation: true,
      summary: "A 1,500 km rift canyon — evidence of internal expansion as an early ocean froze.",
    },
  ],
  blurb:
    "The largest moon of Uranus, scarred by vast canyons and few craters — its surface was resurfaced by internal activity long after formation.",
  notes: {
    exploration: "Voyager 2 imaged its southern hemisphere only, in January 1986; the north has never been seen close-up.",
  },
  sources: [{ id: "nasa-voyager" }],
  retrieved: "2026-09-16",
};
