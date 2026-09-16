import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Voyager 2 mission pages (retrieved 2026-09-16). */
export const MIRANDA: MoonBody = {
  identity: {
    id: "miranda",
    name: "Miranda",
    epithet: "The patchwork world",
    kind: "moon",
    category: "Moon",
    parentId: "uranus",
    color: "#b0aca6",
    discovery: { year: 1948, discoverer: "Gerard Kuiper" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 235.8,
    diameterKm: 472,
    massKg24: 0.0000659,
    massEarths: 1.1e-6,
    gravityG: 0.008,
    escapeVelocityKmS: 0.19,
    densityGCm3: 1.2,
  },
  orbit: {
    semiMajorAxisKm: 129_390,
    periodDays: 1.413,
    inclinationDeg: 4.34, // steeply inclined for a major moon
    eccentricity: 0.001,
    orbitalSpeedKmS: 6.66,
    tidallyLocked: true,
  },
  rotation: { periodHours: 33.9, axialTiltDeg: 0 },
  temperature: { meanC: -214 },
  features: [
    {
      id: "verona-rupes",
      name: "Verona Rupes",
      kind: "canyon",
      approximateLocation: true,
      summary:
        "The tallest cliff known — up to 20 km high. In Miranda's feeble gravity a dropped stone would fall for ten minutes.",
    },
    {
      id: "corona-elope",
      name: "Elsinore Corona",
      kind: "region",
      approximateLocation: true,
      summary: "One of three bizarre 'coronae' — trapezoid racecourses of ridges and grooves unlike any other terrain.",
    },
  ],
  blurb:
    "A 470 km patchwork of contradictory terrains: 20-km cliffs, racetrack coronae, and ancient cratered plains all jammed together — perhaps reassembled after being shattered.",
  notes: {
    exploration: "Voyager 2's 1986 images remain the only close look; the hemisphere facing away has never been seen in detail.",
  },
  sources: [{ id: "nasa-voyager" }],
  retrieved: "2026-09-16",
};
