import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Cassini pages (retrieved 2026-09-16). */
export const ENCELADUS: MoonBody = {
  identity: {
    id: "enceladus",
    name: "Enceladus",
    epithet: "The geyser world",
    kind: "moon",
    category: "Moon",
    parentId: "saturn",
    color: "#e8eef2",
    discovery: { year: 1789, discoverer: "William Herschel" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 252.1,
    diameterKm: 504,
    massKg24: 0.00108,
    massEarths: 1.8e-5,
    gravityG: 0.0113,
    escapeVelocityKmS: 0.239,
    densityGCm3: 1.61,
  },
  orbit: {
    semiMajorAxisKm: 237_948,
    periodDays: 1.37,
    inclinationDeg: 0.009,
    eccentricity: 0.0047,
    orbitalSpeedKmS: 12.6,
    tidallyLocked: true,
  },
  rotation: { periodHours: 32.9, axialTiltDeg: 0 },
  temperature: { meanC: -198, noteC: { min: -201, max: -90 } }, // south-polar tiger stripes run warm
  features: [
    {
      id: "tiger-stripes",
      name: "South-polar tiger stripes",
      kind: "plume-source",
      lat: -80.0,
      lon: 0.0,
      approximateLocation: true,
      summary:
        "Four warm fractures venting 100+ geysers of salty water into space — Cassini flew through and tasted salts, silica, and hydrogen from a hydrothermal seafloor.",
    },
  ],
  blurb:
    "A 500 km moon of fresh snow and ice that sprays its subsurface ocean into space. Cassini's plume flybys made it the most promising place to look for life beyond Earth.",
  notes: {
    interior: "Global ocean under ~20 km of ice at the south pole; rocky core hydrothermally active (H₂ detection, 2017).",
    exploration:
      "Cassini discovered the plumes in 2005 and sampled them through 2017, ending by deliberately crashing into Saturn to protect this ocean world.",
  },
  sources: [{ id: "nasa-cassini" }],
  retrieved: "2026-09-16",
};
