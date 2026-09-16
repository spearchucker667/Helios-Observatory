import type { CelestialBody } from "../types.ts";

/** Canonical figures: NASA planetary fact sheets (retrieved 2026-09-16). */
export const SATURN: CelestialBody = {
  identity: {
    id: "saturn",
    name: "Saturn",
    epithet: "The ringed sovereign",
    kind: "planet",
    parentId: "sun",
    category: "Gas giant",
    color: "#e6d3a4",
    discovery: {
      year: "prehistoric",
      discoverer: "Known to ancient astronomers",
      note: "Galileo saw the rings as 'ears' (1610); Huygens resolved them as a ring in 1655.",
    },
  },
  physical: {
    meanRadiusKm: 58232,
    diameterKm: 116460,
    massKg24: 568.3,
    massEarths: 95.2,
    gravityG: 1.07,
    escapeVelocityKmS: 35.5,
    densityGCm3: 0.687, // less than water
  },
  orbit: {
    semiMajorAxisAu: 9.537,
    periodDays: 10759,
    inclinationDeg: 2.49,
    eccentricity: 0.052,
    orbitalSpeedKmS: 9.7,
  },
  rotation: {
    periodHours: 10.7,
    axialTiltDeg: 26.73, // seasons + the dramatic ring tilt cycle
  },
  temperature: {
    meanC: -140,
  },
  atmosphere: {
    pressureBars: 1,
    composition: [
      { name: "Hydrogen", share: "~96 %" },
      { name: "Helium", share: "~3 %" },
      { name: "Methane, ammonia", share: "trace" },
    ],
    note: "Helium rain sinks through the interior, a process Juno's cousin instruments see as excess heat — Saturn radiates more energy than it receives.",
  },
  interior: "Rocky core wrapped in metallic and liquid hydrogen; the lowest density of any planet (0.69 g/cm³).",
  magneticField: "Bipolar field almost exactly aligned with the rotation axis — a puzzle against most dynamo theory.",
  rings: {
    prominent: true,
    innerRadiusPlanetary: 1.11, // D ring
    outerRadiusPlanetary: 2.27, // A ring outer edge (F ring shepherds beyond)
    composition:
      "Almost pure water ice — from house-sized boulders down to dust — likely young (tens to hundreds of Myr) and slowly raining into the planet.",
    divisions: [
      { name: "Cassini Division", atPlanetaryRadius: 1.95, note: "A 4,700 km gap opened by the 2:1 resonance with Mimas." },
      { name: "Encke Gap", atPlanetaryRadius: 2.21, note: "A 325 km gap kept clear by the moon Pan." },
      { name: "B ring", atPlanetaryRadius: 1.53, note: "The densest, brightest ring — radially structured spokes and moonlet wakes." },
    ],
  },
  moonSystem: {
    confirmedCount: 146,
    note: "Confirmed tally per NASA/JPL, 2023 (retrieved 2026-09-16): Titan, Enceladus, Rhea, Iapetus, Dione, Tethys, Mimas among the major seven.",
  },
  features: [
    {
      id: "north-polar-hexagon",
      name: "North Polar Hexagon",
      kind: "storm",
      lat: 78.0,
      lon: 0.0,
      approximateLocation: true,
      summary:
        "A jet stream wrapped in a perfect hexagon, 30,000 km across — stable since its 1980 Voyager discovery and reproduced in fluid-dynamics labs.",
    },
  ],
  blurb:
    "A pale giant so light it would float on water, wearing ice-and-dust rings only tens of metres thick. Titan, its largest moon, hides a methane weather cycle.",
  notes: {
    exploration:
      "Pioneer 11 made the first pass (1979); Voyager 1 and 2 followed in 1980–81. Cassini orbited 2004–2017, ended in the Grand Finale plunge — 22 dives between planet and rings.",
    observations:
      "The rings' changing tilt across Saturn's 29-year orbit fooled early observers; Huygens' 1655 ring solution was the first correct reading.",
  },
  sources: [{ id: "nasa-planetary-factsheet" }, { id: "nasa-cassini" }],
  retrieved: "2026-09-16",
};
