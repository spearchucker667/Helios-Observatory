import type { CelestialBody } from "../types.ts";

/**
 * Canonical figures: NASA planetary fact sheets (retrieved 2026-09-16).
 * The legacy HUD "day" was the solar day (176 d); rotation here is the
 * sidereal period (58.65 d), consistent with the fact sheet.
 */
export const MERCURY: CelestialBody = {
  identity: {
    id: "mercury",
    name: "Mercury",
    epithet: "The swift messenger",
    kind: "planet",
    parentId: "sun",
    category: "Terrestrial",
    color: "#b7aea3",
    discovery: {
      year: "prehistoric",
      discoverer: "Known to ancient astronomers",
      note: "Its two-per-orbit resonance confused classical observers; Copernicus reportedly never saw it.",
    },
  },
  physical: {
    meanRadiusKm: 2439.7,
    diameterKm: 4879,
    massKg24: 0.3301,
    massEarths: 0.055,
    gravityG: 0.38,
    escapeVelocityKmS: 4.3,
    densityGCm3: 5.43,
  },
  orbit: {
    semiMajorAxisAu: 0.387,
    periodDays: 87.97,
    inclinationDeg: 3.38, // to ecliptic
    eccentricity: 0.206,
    orbitalSpeedKmS: 47.4,
  },
  rotation: {
    periodHours: 1407.6,
    axialTiltDeg: 0.034,
  },
  temperature: {
    meanC: 167,
    noteC: { min: -180, max: 430 },
  },
  interior:
    "An outsized iron core fills roughly 85 % of the planet's radius — the largest core-to-size ratio of any planet, likely the scar of a mantle-stripping impact.",
  features: [
    {
      id: "caloris-planitia",
      name: "Caloris Planitia",
      kind: "basin",
      lat: 30.5,
      lon: 190.0, // planetographic, USGS gazetteer
      summary:
        "A 1,550 km impact basin ringed by mile-high mountains; the shock focused through the planet and shattered the opposite antipodal terrain.",
    },
    {
      id: "mercury-polar-ice",
      name: "Polar permanently shadowed craters",
      kind: "polar",
      approximateLocation: true,
      summary:
        "Radar-bright deposits in craters that never see sunlight — water ice preserved for aeons on the closest planet to the Sun.",
    },
  ],
  blurb:
    "The innermost world — a cratered, airless sphere of iron. A single solar day outlasts its year, and the sun-facing cliffs bake while the night side freezes.",
  notes: {
    surface:
      "Heavily cratered and globally shrunk: long lobate scarps (thrust faults) cut across craters as the interior cooled and the whole planet contracted.",
    exploration:
      "Mariner 10 sketched less than half the planet in three 1974–75 flybys. MESSENGER orbited 2011–2015 and mapped the rest, confirming polar ice and a surprising volatile-rich crust. BepiColombo (ESA/JAXA) arrives for orbit in late 2026.",
  },
  sources: [{ id: "nasa-planetary-factsheet" }, { id: "nasa-messenger" }],
  retrieved: "2026-09-16",
};
