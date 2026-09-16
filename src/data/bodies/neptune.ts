import type { CelestialBody } from "../types.ts";

/** Canonical figures: NASA planetary fact sheets (retrieved 2026-09-16). */
export const NEPTUNE: CelestialBody = {
  identity: {
    id: "neptune",
    name: "Neptune",
    epithet: "The far wind",
    kind: "planet",
    parentId: "sun",
    category: "Ice giant",
    color: "#5b7fd4",
    discovery: {
      year: 1846,
      discoverer: "Le Verrier (prediction) / Galle & d'Arrest (observation)",
      note: "Found within 1° of the predicted position — celestial mechanics' greatest triumph.",
    },
  },
  physical: {
    meanRadiusKm: 24622,
    diameterKm: 49244,
    massKg24: 102.41,
    massEarths: 17.1,
    gravityG: 1.14,
    escapeVelocityKmS: 23.5,
    densityGCm3: 1.64,
  },
  orbit: {
    semiMajorAxisAu: 30.07,
    periodDays: 60190,
    inclinationDeg: 1.77,
    eccentricity: 0.010,
    orbitalSpeedKmS: 5.4,
  },
  rotation: {
    periodHours: 16.11,
    axialTiltDeg: 28.32,
  },
  temperature: {
    meanC: -200,
  },
  atmosphere: {
    pressureBars: 1,
    composition: [
      { name: "Hydrogen", share: "~80 %" },
      { name: "Helium", share: "~19 %" },
      { name: "Methane", share: "~1.5 % (the deep blue)" },
    ],
    note: "The strongest winds in the solar system: supersonic jets at 2,100 km/h, despite receiving 1/900th of Earth's sunlight.",
  },
  interior: "Ice-giant mantle of water, ammonia, methane 'ices' over a rocky core; laboratory work suggests diamond rain may form at depth.",
  magneticField: "Like Uranus: tilted 47° and offset from centre.",
  rings: {
    prominent: false,
    innerRadiusPlanetary: 1.7,
    outerRadiusPlanetary: 2.5, // outer "Adams" ring with arc clumps
    composition: "Dark, narrow rings of fine particles; the Adams ring carries five bright arcs shepherded by Galatea.",
    divisions: [
      { name: "Adams ring arcs", atPlanetaryRadius: 2.5, note: "Short bright arcs (Liberté, Égalité, Fraternité, Courage) that shift over decades." },
    ],
  },
  moonSystem: {
    confirmedCount: 16,
    note: "Triton dominates — a captured Kuiper-belt object in a retrograde orbit — with Proteus, Nereid, and 13 smaller attendants (retrieved 2026-09-16).",
  },
  features: [
    {
      id: "great-dark-spot-1989",
      name: "Great Dark Spot (1989)",
      kind: "storm",
      approximateLocation: true,
      summary:
        "An Earth-sized storm Voyager 2 photographed in 1989 — gone when Hubble looked in 1994. Later dark spots have come and gone; Neptune's storms are transient, not permanent.",
    },
  ],
  blurb:
    "The outermost giant, stained deep blue by methane. Winds scream past 2,000 km/h — the fastest in the solar system — around dark, wandering storms that bloom and fade.",
  notes: {
    observations:
      "Discovered on paper before telescopes: Le Verrier's mathematics told Galle where to look in September 1846. Its 165-year orbit means it completed its first full post-discovery lap only in 2011.",
    exploration:
      "Voyager 2's August 1989 flyby remains the only visit, discovering the Great Dark Spot, Triton's geysers, and the ring arcs in one pass.",
  },
  sources: [{ id: "nasa-planetary-factsheet" }, { id: "nasa-voyager" }],
  retrieved: "2026-09-16",
};
