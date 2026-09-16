import type { CelestialBody } from "../types.ts";

/** Canonical figures: NASA planetary fact sheets (retrieved 2026-09-16). */
export const VENUS: CelestialBody = {
  identity: {
    id: "venus",
    name: "Venus",
    epithet: "The veiled furnace",
    kind: "planet",
    parentId: "sun",
    category: "Terrestrial",
    color: "#e4c48a",
    discovery: {
      year: "prehistoric",
      discoverer: "Known to ancient astronomers",
      note: "Galileo's 1610 observation of its phases vindicated the heliocentric model.",
    },
  },
  physical: {
    meanRadiusKm: 6051.8,
    diameterKm: 12104,
    massKg24: 4.867,
    massEarths: 0.815,
    gravityG: 0.91,
    escapeVelocityKmS: 10.36,
    densityGCm3: 5.24,
  },
  orbit: {
    semiMajorAxisAu: 0.723,
    periodDays: 224.7,
    inclinationDeg: 3.86,
    eccentricity: 0.007,
    orbitalSpeedKmS: 35.0,
  },
  rotation: {
    periodHours: -5832.5, // retrograde; sidereal
    axialTiltDeg: 177.4,
  },
  temperature: {
    meanC: 464,
    noteC: { min: 437, max: 470 }, // remarkably uniform, day and pole alike
  },
  atmosphere: {
    pressureBars: 92,
    composition: [
      { name: "Carbon dioxide", share: "96.5 %" },
      { name: "Nitrogen", share: "3.5 %" },
      { name: "Sulfuric-acid cloud droplets", share: "trace (cloud deck)" },
    ],
    note: "A runaway greenhouse: the 92-bar CO₂ blanket keeps the surface hot enough to melt lead, day and night, pole to equator.",
  },
  interior: "Iron core and silicate mantle, broadly Earth-like in structure though tectonically stagnant.",
  magneticField: "None measurable — an induced magnetosphere is combed out of the solar wind by the upper atmosphere.",
  features: [
    {
      id: "maxwell-montes",
      name: "Maxwell Montes",
      kind: "region",
      lat: 65.2,
      lon: 3.3,
      summary: "The tallest range on Venus — 11 km above the mean surface, higher than Everest, first seen in radar soundings.",
    },
    {
      id: "aphrodite-terra",
      name: "Aphrodite Terra",
      kind: "region",
      lat: -10.0,
      lon: 105.0,
      approximateLocation: true,
      summary: "A continent-scale highland the size of Africa, deformed by vast ridge systems.",
    },
  ],
  blurb:
    "Earth's twin in size, wrapped in sulfuric-acid cloud. A runaway greenhouse holds the surface at 464 °C — hot enough to melt lead — and the planet spins backwards, slower than it orbits.",
  notes: {
    surface:
      "Beneath the unbroken cloud deck lies a volcanic plain world: thousands of shield volcanoes, broad lava flows, and almost no impact craters — the surface repaved itself within the last ~700 million years.",
    climate:
      "Super-rotating atmosphere: the cloud deck laps the planet every four days while the ground turns once per 243. Winds at cloud level reach 360 km/h; on the ground, a slow breeze.",
    exploration:
      "Venera 7 made the first successful landing on another planet (1970); Venera 9–14 returned the only surface photographs, surviving an hour or two each. Magellan radar-mapped 98 % of the planet 1990–94. Akatsuki studies the super-rotation from orbit.",
    observations:
      "Phases observed by Galileo (1610); a possible phosphine detection (2020) remains disputed and is treated here as an open question, not a finding.",
  },
  sources: [{ id: "nasa-planetary-factsheet" }, { id: "nasa-magellan" }],
  retrieved: "2026-09-16",
};
