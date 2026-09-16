import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Cassini pages (retrieved 2026-09-16). */
export const TITAN: MoonBody = {
  identity: {
    id: "titan",
    name: "Titan",
    epithet: "The world with weather",
    kind: "moon",
    category: "Moon",
    parentId: "saturn",
    color: "#d8a552",
    discovery: { year: 1655, discoverer: "Christiaan Huygens" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 2574.7,
    diameterKm: 5150,
    massKg24: 0.1345,
    massEarths: 0.0225,
    gravityG: 0.14,
    escapeVelocityKmS: 2.64,
    densityGCm3: 1.88,
  },
  orbit: {
    semiMajorAxisKm: 1_221_870,
    periodDays: 15.945,
    inclinationDeg: 0.35,
    eccentricity: 0.029,
    orbitalSpeedKmS: 5.57,
    tidallyLocked: true,
  },
  rotation: { periodHours: 382.7, axialTiltDeg: 0 },
  temperature: { meanC: -179 },
  atmosphere: {
    pressureBars: 1.45, // 1.5× Earth's — under a gravity you could fly in
    composition: [
      { name: "Nitrogen", share: "~95 %" },
      { name: "Methane", share: "~5 %" },
      { name: "Hydrogen, organics (tholin haze)", share: "trace" },
    ],
    note: "The only thick moon atmosphere: orange smog of organic haze, methane rain, rivers and seas of liquid hydrocarbons.",
  },
  features: [
    {
      id: "kraken-mare",
      name: "Kraken Mare",
      kind: "region",
      approximateLocation: true,
      summary: "A sea of liquid methane larger than the Caspian — with shorelines, islands, and waves measured by Cassini radar.",
    },
    {
      id: "huygens-landing-site",
      name: "Huygens landing site",
      kind: "region",
      lat: -10.3,
      lon: 167.7,
      summary: "Where the Huygens probe touched down on 14 January 2005 — damp methane sand and 4-cm ice pebbles.",
    },
  ],
  blurb:
    "The only moon with a substantial atmosphere and the only other world with standing liquid on its surface — rivers, rain, and seas, all of liquid methane.",
  notes: {
    exploration:
      "Cassini radar pierced the haze for 13 years; Huygens landed in 2005 as the most distant touchdown ever. Dragonfly (NASA) launches for Titan's skies in 2028.",
  },
  sources: [{ id: "nasa-cassini" }, { id: "esa-huygens" }],
  retrieved: "2026-09-16",
};
