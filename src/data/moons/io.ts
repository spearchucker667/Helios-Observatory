import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Galileo mission pages (retrieved 2026-09-16). */
export const IO: MoonBody = {
  identity: {
    id: "io",
    name: "Io",
    epithet: "The volcanic furnace",
    kind: "moon",
    category: "Moon",
    parentId: "jupiter",
    color: "#d9c04a",
    discovery: { year: 1610, discoverer: "Galileo Galilei" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 1821.6,
    diameterKm: 3643,
    massKg24: 0.0893,
    massEarths: 0.015,
    gravityG: 0.183,
    escapeVelocityKmS: 2.56,
    densityGCm3: 3.53,
  },
  orbit: {
    semiMajorAxisKm: 421_700,
    periodDays: 1.769,
    inclinationDeg: 0.05,
    eccentricity: 0.004,
    orbitalSpeedKmS: 17.34,
    tidallyLocked: true,
  },
  rotation: { periodHours: 42.5, axialTiltDeg: 0 },
  temperature: { meanC: -143, noteC: { min: -143, max: 1600 } }, // surface to lava
  atmosphere: {
    pressureBars: 1e-9,
    composition: [{ name: "Sulfur dioxide (frost sublimation)", share: "trace" }],
    note: "SO₂ frost cycles through plumes into a patchy, collapsing atmosphere.",
  },
  features: [
    {
      id: "loki-patera",
      name: "Loki Patera",
      kind: "volcano",
      approximateLocation: true,
      summary: "A 200 km lava lake that resurfaces itself in waves — the most powerful volcano in the solar system.",
    },
    {
      id: "pele",
      name: "Pele Plume",
      kind: "plume-source",
      approximateLocation: true,
      summary: "A 300 km sulfur umbrella visible from orbit, depositing a red ring the size of Alaska.",
    },
  ],
  blurb:
    "The most volcanically active world known: hundreds of erupting volcanoes, squeezed like a stress ball by Jupiter and its sibling moons in a 4:2:1 resonance.",
  notes: {
    surface: "No impact craters survive — fresh lava buries them. Sulfur paints the surface in yellows, oranges, and reds.",
    exploration: "Galileo flew through Io's plume in 2000; Juno's extended mission mapped the poles. Europa Clipper will study it in passing.",
  },
  sources: [{ id: "nasa-galileo-mission" }, { id: "nasa-solar-system-exploration" }],
  retrieved: "2026-09-16",
};
