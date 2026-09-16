import type { CelestialBody } from "../types.ts";
import { satelliteCountOf } from "../satellites/index.ts";

/** Canonical figures: NASA planetary fact sheets (retrieved 2026-09-16). */
export const MARS: CelestialBody = {
  identity: {
    id: "mars",
    name: "Mars",
    epithet: "The rusted frontier",
    kind: "planet",
    parentId: "sun",
    category: "Terrestrial",
    color: "#c07a55",
    discovery: {
      year: "prehistoric",
      discoverer: "Known to ancient astronomers",
      note: "Its retrograde loop puzzled the Greeks; Kepler cracked it with Tycho's data in 1609.",
    },
  },
  physical: {
    meanRadiusKm: 3389.5,
    diameterKm: 6779,
    massKg24: 0.6417,
    massEarths: 0.107,
    gravityG: 0.38,
    escapeVelocityKmS: 5.03,
    densityGCm3: 3.93,
  },
  orbit: {
    semiMajorAxisAu: 1.527,
    periodDays: 686.98,
    inclinationDeg: 1.85,
    eccentricity: 0.094,
    orbitalSpeedKmS: 24.1,
  },
  rotation: {
    periodHours: 24.62,
    axialTiltDeg: 25.19,
  },
  temperature: {
    meanC: -65,
    noteC: { min: -140, max: 20 }, // polar winter night to equatorial summer noon
  },
  atmosphere: {
    pressureBars: 0.006,
    composition: [
      { name: "Carbon dioxide", share: "95 %" },
      { name: "Nitrogen", share: "2.8 %" },
      { name: "Argon", share: "2 %" },
    ],
    note: "Less than 1 % of Earth's pressure — liquid water boils away instantly, yet the thin air still raises planet-wide dust storms.",
  },
  interior: "Iron-sulfur core (partially liquid, per InSight seismic data), basaltic mantle, thin crust.",
  magneticField: "No global field today; ancient crustal magnetisation records an early dynamo that died ~4 Gyr ago.",
  moonSystem: {
    confirmedCount: satelliteCountOf("mars"),
    asOf: "2026-08-15",
    sourceIds: ["nasa-solar-system-exploration", "jpl-ssd"],
    note: "2 small irregularly shaped natural satellites, Phobos and Deimos — likely captured carbonaceous asteroids or impact-ejected debris.",
  },
  features: [
    {
      id: "olympus-mons",
      name: "Olympus Mons",
      kind: "volcano",
      lat: 18.65,
      lon: 226.2, // planetographic, USGS gazetteer
      summary:
        "The tallest volcano in the solar system: ~22 km high, the size of France, built by a crust that never moves over its hot-spot.",
    },
    {
      id: "valles-marineris",
      name: "Valles Marineris",
      kind: "canyon",
      lat: -14.0,
      lon: 301.5,
      approximateLocation: true,
      summary:
        "A tectonic gash as long as the United States is wide — 4,000 km, plunging 7 km, named for the Mariner 9 team that found it.",
    },
    {
      id: "hellas-planitia",
      name: "Hellas Planitia",
      kind: "basin",
      lat: -42.4,
      lon: 70.5,
      summary: "A 2,300 km impact basin, 7 km deep — the deepest point on Mars, where the air is nearly twice as thick as the datum average.",
    },
    {
      id: "mars-polar-caps",
      name: "Polar ice caps",
      kind: "polar",
      approximateLocation: true,
      summary: "Permanent water ice beneath a seasonal CO₂ frost that snows dry-ice flurries each winter.",
    },
  ],
  blurb:
    "A cold desert of iron oxide, volcanoes, and polar ice. Olympus Mons dwarfs Everest, dry riverbeds record a wet youth, and two captured asteroids hurry overhead.",
  notes: {
    surface:
      "Global dust mantles, fresh crater rays, and dry delta channels — Perseverance is caching samples from one such river delta at Jezero Crater.",
    climate:
      "Seasons from a 25° tilt; CO₂ frost cycles between the poles; dust storms can shroud the entire planet for weeks, as in 2018 (ending Opportunity's run).",
    exploration:
      "Mariner 4's 1965 flyby ended tales of canal-building civilisations. Viking landed in 1976; Pathfinder in 1997; Spirit, Opportunity, Curiosity, and Perseverance rolled across four decades of increasingly wet history. Ingenuity flew the first powered flights on another planet, 2021–24.",
  },
  sources: [{ id: "nasa-planetary-factsheet" }, { id: "nasa-mars-missions" }],
  retrieved: "2026-09-16",
};
