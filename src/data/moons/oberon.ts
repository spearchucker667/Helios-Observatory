import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Voyager 2 mission pages (retrieved 2026-09-16). */
export const OBERON: MoonBody = {
  identity: {
    id: "oberon",
    name: "Oberon",
    epithet: "The old red king",
    kind: "moon",
    category: "Moon",
    parentId: "uranus",
    color: "#9a948c",
    discovery: { year: 1787, discoverer: "William Herschel" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 761.4,
    diameterKm: 1523,
    massKg24: 0.003014,
    massEarths: 5.0e-5,
    gravityG: 0.035,
    escapeVelocityKmS: 0.73,
    densityGCm3: 1.63,
  },
  orbit: {
    semiMajorAxisKm: 583_520,
    periodDays: 13.46,
    inclinationDeg: 0.06,
    eccentricity: 0.001,
    orbitalSpeedKmS: 3.15,
    tidallyLocked: true,
  },
  rotation: { periodHours: 323.1, axialTiltDeg: 0 },
  temperature: { meanC: -203 },
  blurb:
    "The outermost major Uranian moon — ancient, dark, and heavily cratered, with mountain peaks rising 6 km above its limb, seen in profile by Voyager 2.",
  notes: {
    surface: "Dark reddish material floors many crater bottoms — either material welling up from inside or radiation chemistry staining the ancient ice.",
  },
  sources: [{ id: "nasa-voyager" }],
  retrieved: "2026-09-16",
};
