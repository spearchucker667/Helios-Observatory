import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA/JPL Voyager 2 mission pages (retrieved 2026-09-16). */
export const ARIEL: MoonBody = {
  identity: {
    id: "ariel",
    name: "Ariel",
    epithet: "The bright young surface",
    kind: "moon",
    category: "Moon",
    parentId: "uranus",
    color: "#b8b2aa",
    discovery: { year: 1851, discoverer: "William Lassell" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 578.9,
    diameterKm: 1158,
    massKg24: 0.001251,
    massEarths: 2.1e-5,
    gravityG: 0.027,
    escapeVelocityKmS: 0.56,
    densityGCm3: 1.59,
  },
  orbit: {
    semiMajorAxisKm: 190_900,
    periodDays: 2.52,
    inclinationDeg: 0.26,
    eccentricity: 0.001,
    orbitalSpeedKmS: 5.51,
    tidallyLocked: true,
  },
  rotation: { periodHours: 60.5, axialTiltDeg: 0 },
  temperature: { meanC: -213 },
  blurb:
    "The brightest of Uranus' moons and geologically its youngest — broad rift valleys flooded by icy flows that erased the early craters.",
  notes: {
    surface: "Deep graben (Kachina, Kewpie chasmata) cut its surface; CO₂ frost was detected on its trailing side from spectra.",
    exploration: "Voyager 2's 1986 flyby mapped roughly a third of the surface at useful resolution.",
  },
  sources: [{ id: "nasa-voyager" }],
  retrieved: "2026-09-16",
};
