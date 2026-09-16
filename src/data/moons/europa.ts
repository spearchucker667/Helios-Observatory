import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Europa Clipper mission pages (retrieved 2026-09-16). */
export const EUROPA: MoonBody = {
  identity: {
    id: "europa",
    name: "Europa",
    epithet: "The ocean beneath the ice",
    kind: "moon",
    category: "Moon",
    parentId: "jupiter",
    color: "#c8b8a6",
    discovery: { year: 1610, discoverer: "Galileo Galilei" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 1560.8,
    diameterKm: 3122,
    massKg24: 0.048,
    massEarths: 0.008,
    gravityG: 0.134,
    escapeVelocityKmS: 2.02,
    densityGCm3: 3.01,
  },
  orbit: {
    semiMajorAxisKm: 671_100,
    periodDays: 3.551,
    inclinationDeg: 0.47,
    eccentricity: 0.009,
    orbitalSpeedKmS: 13.74,
    tidallyLocked: true,
  },
  rotation: { periodHours: 85.2, axialTiltDeg: 0 },
  temperature: { meanC: -160 },
  features: [
    {
      id: "lineae",
      name: "Conamara Chaos & the lineae",
      kind: "region",
      approximateLocation: true,
      summary:
        "Bands of dark reddish-brown fractures criss-cross the ice shell — ridges where the shell cracked, shifted, and refroze over a global ocean.",
    },
  ],
  blurb:
    "The smoothest world in the solar system: a cracked shell of water ice over a salty ocean holding twice Earth's water — the leading candidate for life beyond Earth.",
  notes: {
    interior: "15–25 km ice shell over a 60–150 km ocean in contact with a rocky seafloor — the chemistry of hydrothermal habitability.",
    exploration:
      "Galileo orbited 1995–2003 and found the induced magnetic signature of a salty ocean. Europa Clipper (launched 2024) arrives 2030 for ~50 flybys; JUICE follows for two Europa passes.",
  },
  sources: [{ id: "nasa-galileo-mission" }, { id: "nasa-solar-system-exploration" }],
  retrieved: "2026-09-16",
};
