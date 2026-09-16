import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Voyager 2 mission pages (retrieved 2026-09-16). */
export const TRITON: MoonBody = {
  identity: {
    id: "triton",
    name: "Triton",
    epithet: "The captured wanderer",
    kind: "moon",
    category: "Moon",
    parentId: "neptune",
    color: "#d6cfc8",
    discovery: { year: 1846, discoverer: "William Lassell", note: "Found just 17 days after Neptune itself." },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 1353.4,
    diameterKm: 2707,
    massKg24: 0.0214,
    massEarths: 0.0036,
    gravityG: 0.0794,
    escapeVelocityKmS: 1.46,
    densityGCm3: 2.06,
  },
  orbit: {
    semiMajorAxisKm: 354_759,
    periodDays: 5.877,
    inclinationDeg: 156.9, // retrograde — orbits backwards
    eccentricity: 0.000,
    orbitalSpeedKmS: 4.39,
    retrograde: true,
    tidallyLocked: true,
  },
  rotation: { periodHours: -141.0, axialTiltDeg: 0 },
  temperature: { meanC: -235 }, // among the coldest surfaces measured
  atmosphere: {
    pressureBars: 1.4e-5,
    composition: [{ name: "Nitrogen", share: "~99 %" }],
    note: "A thin nitrogen atmosphere with metre-high clouds of frozen nitrogen fog near the pole.",
  },
  features: [
    {
      id: "cantaloupe-terrain",
      name: "Cantaloupe terrain",
      kind: "region",
      approximateLocation: true,
      summary: "Dimpled, dimpled plains unlike anywhere else — relic terrain from Triton's early, warmer history.",
    },
    {
      id: "triton-geysers",
      name: "Active nitrogen geysers",
      kind: "plume-source",
      lat: -57.0,
      lon: 0.0,
      approximateLocation: true,
      summary: "Voyager 2 caught 8 km-high nitrogen geysers throwing dark plumes downwind — solar-heated ice erupting through a thin crust.",
    },
  ],
  blurb:
    "The only large moon that orbits backwards — a captured Kuiper Belt object. Its icy surface is young and active, venting nitrogen geysers at -235 °C.",
  notes: {
    interior: "Salty ocean suspected beneath the ice shell, kept liquid by tidal heating during capture and radiogenics since.",
    exploration:
      "Voyager 2's August 1989 flyby mapped ~40 % of the surface in detail; a Trident-class return mission has been repeatedly proposed since.",
  },
  sources: [{ id: "nasa-voyager" }],
  retrieved: "2026-09-16",
};
