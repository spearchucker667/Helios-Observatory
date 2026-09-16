import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA New Horizons mission pages and JPL SSD (retrieved 2026-09-16). */
export const CHARON: MoonBody = {
  identity: {
    id: "charon",
    name: "Charon",
    epithet: "Ferryman of the Kuiper Belt",
    kind: "moon",
    category: "Moon",
    parentId: "pluto",
    color: "#b0a8a0",
    discovery: {
      year: 1978,
      discoverer: "James W. Christy",
      note: "Discovered at the US Naval Observatory from photographic plates showing an elongated bulge on Pluto.",
    },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 606.0,
    diameterKm: 1212.0,
    massKg24: 0.001586,
    massEarths: 0.000266,
    gravityG: 0.029,
    escapeVelocityKmS: 0.59,
    densityGCm3: 1.702,
  },
  orbit: {
    semiMajorAxisKm: 19596,
    periodDays: 6.387,
    inclinationDeg: 0.08,
    eccentricity: 0.00005,
    orbitalSpeedKmS: 0.223,
    retrograde: false,
    tidallyLocked: true,
  },
  rotation: { periodHours: 153.3, axialTiltDeg: 0 },
  temperature: { meanC: -220 },
  atmosphere: {
    pressureBars: 0,
    composition: [],
    note: "No detectable atmosphere; trace methane escaping from Pluto is cold-trapped at Charon's poles.",
  },
  features: [
    {
      id: "mordor-macula",
      name: "Mordor Macula",
      kind: "region",
      lat: 80.0,
      lon: 0.0,
      approximateLocation: true,
      summary: "Dark reddish north polar cap composed of tholins — organic macromolecules synthesized by solar UV from Pluto's escaping methane atmosphere.",
    },
    {
      id: "serenity-chasma",
      name: "Serenity Chasma",
      kind: "canyon",
      lat: 0.0,
      lon: 120.0,
      approximateLocation: true,
      summary: "Enormous equatorial rift system stretching over 1,000 km with scarps up to 9 km deep, formed when an ancient subsurface ocean froze and expanded.",
    },
    {
      id: "dorothy-crater",
      name: "Dorothy Crater",
      kind: "crater",
      lat: 58.0,
      lon: 40.0,
      approximateLocation: true,
      summary: "Large 230-km impact crater in Charon's northern hemisphere, named after Dorothy Gale of The Wizard of Oz.",
    },
  ],
  blurb:
    "Pluto's massive companion, more than half the diameter of Pluto itself. Together they form a binary system whose barycenter lies in open space above Pluto's surface.",
  notes: {
    surface:
      "Unlike Pluto's volatile nitrogen and methane ices, Charon's surface is dominated by water ice and ammonia hydrates, giving it a neutral grayish color except for its red tholin-tinted north pole.",
    interior:
      "Differentiated with a rocky core surrounded by a thick water-ice mantle. Massive tectonic grabens indicate an ancient subsurface ocean that completely froze.",
    exploration:
      "Imaged in spectacular detail by NASA's New Horizons spacecraft during its July 14, 2015 flyby.",
  },
  sources: [{ id: "nasa-new-horizons" }],
  retrieved: "2026-09-16",
};
