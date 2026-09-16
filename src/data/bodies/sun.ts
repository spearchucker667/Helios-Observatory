import type { CelestialBody } from "../types.ts";

export const SUN: CelestialBody = {
  identity: {
    id: "sun",
    name: "Sun",
    epithet: "The hearth of the system",
    kind: "star",
    category: "Star",
    color: "#f3c27a",
  },
  physical: {
    meanRadiusKm: 695_700,
    diameterKm: 1_392_700,
    massKg24: 1_988_500, // ×10²⁴ kg
    massEarths: 333_000,
    gravityG: 27.9,
    escapeVelocityKmS: 617.6,
    densityGCm3: 1.41,
  },
  rotation: {
    periodHours: 609.12, // ~25.38 days at the equator
    axialTiltDeg: 7.25,
  },
  temperature: {
    meanC: 5500,
    noteC: { min: 5_500_000, max: 5_500_000 }, // core, ~15.7M K — see note
  },
  blurb:
    "A G2V yellow dwarf holding every orbit in its gravity. The photosphere seethes near 5,500 °C while the corona above runs millions of degrees hotter — a reversal that is still not fully explained.",
  notes: {
    observations:
      "Galileo's 1613 sunspot letters, the Maunder Minimum of the 17th century, and the modern 11-year solar cycle all trace the Sun's variable face. Heliospheric spacecraft (Parker Solar Probe, Solar Orbiter) now sample the corona directly.",
  },
  sources: [
    { id: "nasa-sun-factsheet" },
    { id: "nasa-planetary-factsheet" },
  ],
  retrieved: "2026-09-16",
};
