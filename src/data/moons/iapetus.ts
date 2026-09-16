import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Cassini pages (retrieved 2026-09-16). */
export const IAPETUS: MoonBody = {
  identity: {
    id: "iapetus",
    name: "Iapetus",
    epithet: "The two-faced moon",
    kind: "moon",
    category: "Moon",
    parentId: "saturn",
    color: "#b3a289",
    discovery: { year: 1671, discoverer: "Giovanni Cassini" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 734.5,
    diameterKm: 1469,
    massKg24: 0.001806,
    massEarths: 3.0e-5,
    gravityG: 0.022,
    escapeVelocityKmS: 0.572,
    densityGCm3: 1.09,
  },
  orbit: {
    semiMajorAxisKm: 3_560_820,
    periodDays: 79.32,
    inclinationDeg: 15.47, // far out and steeply tilted — unique among major moons
    eccentricity: 0.028,
    orbitalSpeedKmS: 3.26,
    tidallyLocked: true,
  },
  rotation: { periodHours: 1903.7, axialTiltDeg: 0 },
  temperature: { meanC: -143, noteC: { min: -183, max: -103 } }, // dark leading hemisphere vs bright trailing
  features: [
    {
      id: "equatorial-ridge",
      name: "Equatorial ridge",
      kind: "region",
      approximateLocation: true,
      summary:
        "A 20 km-high wall of mountains running exactly along the equator of the dark hemisphere — possibly the remains of a former ring that collapsed onto the moon.",
    },
  ],
  blurb:
    "One hemisphere is snow-bright, the other coal-dark: Cassini noted you can see it from Earth on only one side of its orbit. The dark material is dust swept up from outer moons.",
  notes: {
    observations:
      "Cassini's 1705 insight — bright on the western half, invisible on the eastern — was the first albedo puzzle in astronomy, solved only by Voyager in 1980.",
  },
  sources: [{ id: "nasa-cassini" }],
  retrieved: "2026-09-16",
};
