import type { CelestialBody } from "../types.ts";

/** Canonical figures: NASA planetary fact sheets (retrieved 2026-09-16). */
export const JUPITER: CelestialBody = {
  identity: {
    id: "jupiter",
    name: "Jupiter",
    epithet: "The storm king",
    kind: "planet",
    parentId: "sun",
    category: "Gas giant",
    color: "#d9b48a",
    discovery: {
      year: "prehistoric",
      discoverer: "Known to ancient astronomers",
      note: "Galileo's 1610 telescopic moons made it the first confirmed non-geocentric system.",
    },
  },
  physical: {
    meanRadiusKm: 69911,
    diameterKm: 139820,
    massKg24: 1898,
    massEarths: 317.8,
    gravityG: 2.53, // at 1-bar cloud deck
    escapeVelocityKmS: 59.5,
    densityGCm3: 1.33,
  },
  orbit: {
    semiMajorAxisAu: 5.203,
    periodDays: 4332.6,
    inclinationDeg: 1.3,
    eccentricity: 0.049,
    orbitalSpeedKmS: 13.1,
  },
  rotation: {
    periodHours: 9.93, // fastest planetary rotation — visibly flattened
    axialTiltDeg: 3.13,
  },
  temperature: {
    meanC: -110, // 1-bar level
  },
  atmosphere: {
    pressureBars: 1, // reference cloud deck
    composition: [
      { name: "Hydrogen", share: "~90 %" },
      { name: "Helium", share: "~10 %" },
      { name: "Methane, ammonia, water", share: "trace (colour and clouds)" },
    ],
    note: "No solid surface — pressure and temperature rise without limit into a liquid-metallic hydrogen mantle.",
  },
  interior: "Possible dilute heavy-element core ('fuzzy', per Juno gravity data) inside metallic hydrogen under 40 million bar.",
  magneticField: "The strongest planetary magnetosphere — 20,000× Earth's field power, with aurorae larger than Earth itself.",
  rings: {
    prominent: false,
    innerRadiusPlanetary: 1.72,
    outerRadiusPlanetary: 3.16, // gossamer rings, dusty and nearly invisible
    composition: "Micron-grain dust knocked off the inner moons (main ring from Metis/Adrastea, gossamer from Amalthea and Thebe).",
    divisions: [{ name: "Main ring", atPlanetaryRadius: 1.8, note: "A ~6,500 km annulus of dark dust, discovered by Voyager 1 in 1979." }],
  },
  moonSystem: {
    confirmedCount: 95,
    note: "Four Galilean moons beyond comparison; the rest are small inner shepherds and captured irregulars. Tally per NASA, 2023 (retrieved 2026-09-16).",
  },
  features: [
    {
      id: "great-red-spot",
      name: "Great Red Spot",
      kind: "storm",
      lat: -22.0,
      lon: 95.0,
      approximateLocation: true,
      summary:
        "An anticyclone wider than Earth, observed continuously since 1831 — shrinking and elongating in recent decades, but still spinning counter-clockwise at 430 km/h.",
    },
  ],
  blurb:
    "More massive than all the other planets combined. Hydrogen belts race in opposite directions, and the Great Red Spot has been an anticyclone for centuries.",
  notes: {
    climate:
      "Zonal jets shear the atmosphere into coloured belts and zones at 100+ m/s; polar cyclones cluster in geometric arrays, mapped by Juno.",
    exploration:
      "Galileo orbited 1995–2003, dropping a probe into the clouds. Juno has circled the poles since 2016, mapping the fuzzy core and cyclone clusters. Europa Clipper (2024 launch) arrives 2030; JUICE follows for Ganymede orbit.",
  },
  sources: [{ id: "nasa-planetary-factsheet" }, { id: "nasa-juno" }, { id: "nasa-galileo-mission" }],
  retrieved: "2026-09-16",
};
