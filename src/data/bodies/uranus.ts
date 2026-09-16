import type { CelestialBody } from "../types.ts";
import { satelliteCountOf } from "../satellites/index.ts";

/** Canonical figures: NASA planetary fact sheets (retrieved 2026-09-16). */
export const URANUS: CelestialBody = {
  identity: {
    id: "uranus",
    name: "Uranus",
    epithet: "The tipped ice",
    kind: "planet",
    parentId: "sun",
    category: "Ice giant",
    color: "#9ad2d6",
    discovery: {
      year: 1781,
      discoverer: "William Herschel",
      note: "The first planet found with a telescope — Herschel first logged it as a comet.",
    },
  },
  physical: {
    meanRadiusKm: 25362,
    diameterKm: 50724,
    massKg24: 86.81,
    massEarths: 14.5,
    gravityG: 0.89,
    escapeVelocityKmS: 21.3,
    densityGCm3: 1.27,
  },
  orbit: {
    semiMajorAxisAu: 19.19,
    periodDays: 30687,
    inclinationDeg: 0.77,
    eccentricity: 0.047,
    orbitalSpeedKmS: 6.8,
  },
  rotation: {
    periodHours: -17.24, // retrograde under the right-hand convention
    axialTiltDeg: 97.77, // rolling around its orbit on its side
  },
  temperature: {
    meanC: -195, // coldest planetary atmosphere measured (-224 °C in the tropopause)
  },
  atmosphere: {
    pressureBars: 1,
    composition: [
      { name: "Hydrogen", share: "~83 %" },
      { name: "Helium", share: "~15 %" },
      { name: "Methane", share: "~2 % (the cyan colour)" },
    ],
    note: "Methane absorbs red light, leaving the pale cyan disc seen through any telescope — nearly featureless in visible light.",
  },
  interior: "Dense 'icy' mantle of water, ammonia, and methane ices above a rocky core — the ice giants' defining recipe.",
  magneticField: "Tilted 59° from the spin axis and off-centre: the lopsided dynamo makes a corkscrew magnetotail.",
  rings: {
    prominent: false,
    innerRadiusPlanetary: 1.64, // 1986 U2 R
    outerRadiusPlanetary: 2.0, // ε (epsilon) ring outer edge
    composition: "Narrow, dark rings of centimetre-to-metre particles; the ε ring is shepherded by Cordelia and Ophelia.",
    divisions: [
      { name: "ε (epsilon) ring", atPlanetaryRadius: 2.0, note: "The brightest and widest ring, discovered during the 1977 stellar occultation." },
    ],
  },
  moonSystem: {
    confirmedCount: satelliteCountOf("uranus"),
    asOf: "2026-08-15",
    sourceIds: ["nasa-solar-system-exploration", "jpl-ssd", "iau-mpc"],
    note: "29 recognized natural satellites (NASA August 2026 baseline), comprising 13 inner ring moons, 5 major classical satellites (Miranda, Ariel, Umbriel, Titania, Oberon), and 11 outer irregulars including S/2023 U 1.",
  },
  features: [
    {
      id: "uranus-polar-hood",
      name: "Polar hood",
      kind: "polar",
      approximateLocation: true,
      summary: "A bright polar cap that brightens through the 42-year seasons as each pole takes its turn facing the Sun.",
    },
  ],
  blurb:
    "Rolled onto its side, this methane-cyan ice giant rolls around the Sun like a barrel. Winter at a pole lasts four decades; Voyager 2 remains its only visitor.",
  notes: {
    climate:
      "The 98° tilt gives each pole 42 years of sunlight, then 42 of darkness. Despite feeble sunlight, storms brighten visibly in recent Webb and Hubble imaging.",
    exploration:
      "Voyager 2's January 1986 flyby is the only close encounter — everything else comes from telescopes. A dedicated Uranus Orbiter and Probe tops the 2023 Planetary Decadal Survey's priority list.",
  },
  sources: [{ id: "nasa-planetary-factsheet" }, { id: "nasa-voyager" }],
  retrieved: "2026-09-16",
};
