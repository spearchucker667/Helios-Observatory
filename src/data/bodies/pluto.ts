import type { CelestialBody } from "../types.ts";
import { satelliteCountOf } from "../satellites/index.ts";

/** Canonical figures: NASA planetary fact sheets and New Horizons mission archives (retrieved 2026-09-16). */
export const PLUTO: CelestialBody = {
  identity: {
    id: "pluto",
    name: "Pluto",
    epithet: "King of the Kuiper Belt",
    kind: "dwarf-planet",
    parentId: "sun",
    category: "Dwarf planet",
    color: "#c8a27a",
    discovery: {
      year: 1930,
      discoverer: "Clyde Tombaugh",
      note: "Found at Lowell Observatory following Percival Lowell's search for 'Planet X'. Reclassified as a dwarf planet by the IAU in 2006.",
    },
  },
  physical: {
    meanRadiusKm: 1188.3,
    diameterKm: 2376.6,
    massKg24: 0.01303,
    massEarths: 0.00218,
    gravityG: 0.063,
    escapeVelocityKmS: 1.21,
    densityGCm3: 1.85,
  },
  orbit: {
    semiMajorAxisAu: 39.482,
    periodDays: 90560,
    inclinationDeg: 17.14,
    eccentricity: 0.2488,
    orbitalSpeedKmS: 4.74,
  },
  rotation: {
    periodHours: -153.29, // retrograde rotation, ~6.387 days
    axialTiltDeg: 122.53,
  },
  temperature: {
    meanC: -229,
    noteC: { min: -233, max: -223 },
  },
  atmosphere: {
    pressureBars: 0.00001, // ~10 microbars, expands near perihelion
    composition: [
      { name: "Nitrogen", share: "99 %" },
      { name: "Methane", share: "0.5 %" },
      { name: "Carbon monoxide", share: "0.5 %" },
    ],
    note: "A hazy, stratified nitrogen atmosphere extending over 1,600 km into space, with blue skies created by sunlight scattering off tholin haze particles.",
  },
  interior: "Dense silicate rock core surrounded by a deep mantle of water ice, with evidence from New Horizons for a subsurface liquid ocean beneath Sputnik Planitia.",
  magneticField: "No detected intrinsic magnetic field.",
  moonSystem: {
    confirmedCount: satelliteCountOf("pluto"),
    asOf: "2026-08-15",
    sourceIds: ["nasa-solar-system-exploration", "nasa-new-horizons"],
    note: "5 known natural satellites: large companion Charon (mutually tidally locked in a binary system), plus Styx, Nix, Kerberos, and Hydra discovered by the Hubble Space Telescope.",
  },
  features: [
    {
      id: "tombaugh-regio",
      name: "Tombaugh Regio",
      kind: "region",
      lat: 19.5,
      lon: 183.0,
      summary: "The famous heart-shaped feature spanning 1,590 km, composed of bright nitrogen, carbon monoxide, and methane ices.",
    },
    {
      id: "sputnik-planitia",
      name: "Sputnik Planitia",
      kind: "basin",
      lat: 24.0,
      lon: 176.0,
      summary: "A 1,000-km-wide plain of slowly churning nitrogen ice polygons, devoid of impact craters, indicating active surface renewal within the last 10 million years.",
    },
    {
      id: "cthulhu-macula",
      name: "Cthulhu Macula",
      kind: "region",
      lat: -5.0,
      lon: 100.0,
      summary: "A dark equatorial 'whale' of ancient crust coated in complex organic macromolecules called tholins, formed by solar UV processing of methane.",
    },
    {
      id: "tenzing-montes",
      name: "Tenzing Montes",
      kind: "region",
      lat: -17.0,
      lon: 178.0,
      summary: "Rugged mountains of pure water ice towering up to 3.4 km high along the southwestern margin of Sputnik Planitia.",
    },
  ],
  blurb:
    "A complex, active world at the threshold of the Kuiper Belt. New Horizons revealed towering water-ice mountains, actively convecting nitrogen glaciers, and layered atmospheric hazes that scatter blue sunlight.",
  notes: {
    surface:
      "A mosaic of bright nitrogen and methane glaciers alongside ancient cratered terrains coated in reddish tholins. Water ice acts as the rigid bedrock supporting sheer multi-kilometre peaks.",
    climate:
      "Extreme seasons over its 248-year orbit. The atmosphere cyclically expands and collapses as surface nitrogen sublimates near perihelion and freezes out during the outer orbit.",
    exploration:
      "NASA's New Horizons conducted the historic first flyby on July 14, 2015, passing within 12,500 km of the surface and revolutionising our understanding of outer Solar System bodies.",
  },
  sources: [{ id: "nasa-planetary-factsheet" }, { id: "nasa-newhorizons" }, { id: "usgs-astrogeology" }, { id: "iau-nomenclature" }],
  retrieved: "2026-09-16",
};
