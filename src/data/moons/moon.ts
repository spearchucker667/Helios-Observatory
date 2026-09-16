import type { MoonBody } from "../types.ts";

/** Canonical figures: NASA Moon fact sheet (retrieved 2026-09-16). */
export const MOON: MoonBody = {
  identity: {
    id: "moon",
    name: "Moon",
    epithet: "Luna — our companion",
    kind: "moon",
    category: "Moon",
    parentId: "earth",
    color: "#c9c6c0",
    discovery: { year: "prehistoric", discoverer: "Known since antiquity" },
  },
  tier: 1,
  physical: {
    meanRadiusKm: 1737.4,
    diameterKm: 3475,
    massKg24: 0.07346,
    massEarths: 0.0123,
    gravityG: 0.166,
    escapeVelocityKmS: 2.38,
    densityGCm3: 3.34,
  },
  orbit: {
    semiMajorAxisKm: 384_400,
    periodDays: 27.32,
    inclinationDeg: 6.68, // to lunar orbit vs ecliptic ~5.15°; vs Earth's equator 6.68° — fact sheet convention
    eccentricity: 0.055,
    orbitalSpeedKmS: 1.02,
    tidallyLocked: true,
  },
  rotation: {
    periodHours: 655.7, // synchronous with orbit (27.32 d)
    axialTiltDeg: 6.68,
  },
  temperature: {
    meanC: -20,
    noteC: { min: -173, max: 127 },
  },
  atmosphere: {
    pressureBars: 3e-15,
    composition: [{ name: "Exosphere: He, Ne, H, Ar", share: "trace" }],
    note: "A true exosphere — atoms so sparse they never collide.",
  },
  interior: "Small iron core (~350 km), partly molten; thick mantle; 30–40 km crust — Apollo seismometers told us all of it.",
  features: [
    {
      id: "mare-tranquillitatis",
      name: "Mare Tranquillitatis",
      kind: "region",
      lat: 8.5,
      lon: 31.4,
      summary: "The Sea of Tranquility — Apollo 11's landing site, a basalt plain from ancient lava flooding.",
    },
    {
      id: "tycho",
      name: "Tycho Crater",
      kind: "crater",
      lat: -43.3,
      lon: -11.2,
      summary: "A 86 km rayed crater whose bright ejecta streaks a third of the way around the Moon.",
    },
    {
      id: "copernicus",
      name: "Copernicus Crater",
      kind: "crater",
      lat: 9.6,
      lon: -20.1,
      summary: "The 'Monarch of the Moon' — 93 km of terraced walls and central peaks, binocular-visible.",
    },
  ],
  blurb:
    "Earth's constant companion, born from a giant impact 4.5 billion years ago. Tidally locked, it shows us one face while its gravity steadies our seasons.",
  notes: {
    exploration:
      "Nine crewed missions crossed its orbit; twelve walked on it (Apollo, 1969–72). Robotic visitors from Luna to Chang'e and Artemis-era landers continue today.",
    surface:
      "Bright highlands of ancient anorthosite; dark maria of flooded basalt; a regolith blanket ground fine by 4 billion years of impacts.",
  },
  sources: [{ id: "nasa-moon-factsheet" }, { id: "nasa-apollo" }],
  retrieved: "2026-09-16",
};
