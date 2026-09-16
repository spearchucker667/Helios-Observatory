import type { CelestialBody } from "../types.ts";

/** Canonical figures: NASA planetary fact sheets and Dawn mission archives (retrieved 2026-09-16). */
export const CERES: CelestialBody = {
  identity: {
    id: "ceres",
    name: "Ceres",
    epithet: "Queen of the asteroid belt",
    kind: "dwarf-planet",
    parentId: "sun",
    category: "Dwarf planet",
    color: "#96928b",
    discovery: {
      year: 1801,
      discoverer: "Giuseppe Piazzi",
      note: "Discovered on New Year's Day at Palermo Observatory; lost in the Sun's glare until Gauss recalculated its orbit.",
    },
  },
  physical: {
    meanRadiusKm: 469.7,
    diameterKm: 939.4,
    massKg24: 0.000938,
    massEarths: 0.000157,
    gravityG: 0.029,
    escapeVelocityKmS: 0.51,
    densityGCm3: 2.16,
  },
  orbit: {
    semiMajorAxisAu: 2.7675,
    periodDays: 1681.6,
    inclinationDeg: 10.59,
    eccentricity: 0.0758,
    orbitalSpeedKmS: 17.9,
  },
  rotation: {
    periodHours: 9.074,
    axialTiltDeg: 4.0,
  },
  temperature: {
    meanC: -106,
    noteC: { min: -143, max: -38 }, // midday equatorial vs polar winter
  },
  atmosphere: {
    pressureBars: 1e-11,
    composition: [{ name: "Water vapour (transient)", share: "100 %" }],
    note: "Transient exosphere detected by Herschel and Dawn when surface water ice sublimates near perihelion.",
  },
  interior: "Differentiated interior with a rocky/dusty mantle and a brine-rich mud-rock mantle/crust containing trapped water ice and sodium carbonate salts.",
  magneticField: "No global magnetic field.",
  moonSystem: {
    confirmedCount: 0,
    note: "No natural satellites discovered by ground-based surveys or NASA's Dawn orbiter.",
  },
  features: [
    {
      id: "occator-crater",
      name: "Occator Crater",
      kind: "crater",
      lat: 19.8,
      lon: 239.3,
      summary: "A 92-km impact crater hosting Cerealia Facula and Vinalia Faculae — brilliant white deposits of sodium carbonate salts extruded from deep brines.",
    },
    {
      id: "ahuna-mons",
      name: "Ahuna Mons",
      kind: "volcano",
      lat: -10.48,
      lon: 316.2,
      summary: "A solitary 4-km-high cryovolcano dome formed by subterranean brine volcanism within the last few hundred million years.",
    },
    {
      id: "kerwan-crater",
      name: "Kerwan Basin",
      kind: "basin",
      lat: -10.7,
      lon: 123.9,
      summary: "The oldest and largest distinct impact basin on Ceres (280 km across), featuring a smoothed plain indicative of ancient cryolava flows.",
    },
  ],
  blurb:
    "The largest object in the main asteroid belt and the only dwarf planet in the inner Solar System. NASA's Dawn mission revealed an active world of bright salt faculae, cryovolcanoes, and subterranean brines.",
  notes: {
    surface:
      "A dark carbonaceous regolith punctured by intensely reflective faculae (bright spots) composed of sodium carbonate and ammonium salts deposited by cryo-hydrothermal activity.",
    climate:
      "Airless and frigid, but close enough to the Sun for seasonal sublimation of surface ice, generating a tenuous transient water exosphere.",
    exploration:
      "NASA's Dawn orbiter arrived in March 2015, becoming the first spacecraft to visit a dwarf planet and the first to orbit two extraterrestrial destinations (Vesta and Ceres).",
  },
  sources: [{ id: "nasa-planetary-factsheet" }, { id: "nasa-dawn" }, { id: "usgs-astrogeology" }],
  retrieved: "2026-09-16",
};
