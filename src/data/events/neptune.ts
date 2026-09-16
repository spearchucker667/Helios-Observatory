import type { AstronomicalEvent } from "../types.ts";

export const NEPTUNE_EVENTS: AstronomicalEvent[] = [
  {
    id: "neptune-le-verrier-prediction",
    bodyIds: ["neptune"],
    year: 1845,
    title: "Neptune predicted on paper",
    category: "milestone",
    summary:
      "Urbain Le Verrier computed the position of an unseen planet from irregularities in Uranus' orbit — and mailed the coordinates to Berlin.",
    significance: "A planet found by mathematics before telescopes: the triumph of Newtonian mechanics.",
    sourceIds: ["nasa-solar-system-exploration"],
  },
  {
    id: "neptune-discovery-1846",
    bodyIds: ["neptune"],
    year: 1846,
    date: "1846-09-23",
    title: "Neptune found within 1° of prediction",
    category: "discovery",
    summary:
      "Johann Galle and Heinrich d'Arrest located the planet the same night they received Le Verrier's letter.",
    significance: "Confirmed the predictive power of gravitational theory; a priority dispute with Adams continues to be debated.",
    mission: "Berlin Observatory (Galle & d'Arrest)",
    sourceIds: ["nasa-solar-system-exploration"],
  },
  {
    id: "neptune-voyager2-flyby",
    bodyIds: ["neptune", "triton"],
    year: 1989,
    date: "1989-08-25",
    title: "Voyager 2's Neptune flyby",
    category: "mission",
    summary:
      "The Great Dark Spot, supersonic winds, ring arcs, and Triton's nitrogen geysers — all in a single pass.",
    significance: "The only visit; both Neptune and Triton were revealed in a few days of imagery.",
    mission: "NASA Voyager 2",
    sourceIds: ["nasa-voyager"],
  },
  {
    id: "neptune-dark-spot-vanishes",
    bodyIds: ["neptune"],
    year: 1994,
    title: "The Great Dark Spot is gone",
    category: "observation",
    summary: "Hubble found the 1989 storm had vanished; new dark spots have since appeared and faded on multi-year timescales.",
    significance: "Neptune's storms are transient, unlike Jupiter's centuries-old spot.",
    mission: "NASA/ESA Hubble",
    sourceIds: ["nasa-hubble"],
  },
  {
    id: "neptune-first-orbit-completed",
    bodyIds: ["neptune"],
    year: 2011,
    date: "2011-07-12",
    title: "Neptune completes its first observed orbit",
    category: "milestone",
    summary: "One Neptunian year (164.8 Earth years) after discovery, the planet returned to its 1846 position.",
    significance: "A full cycle of ground-based observation of the ice giant.",
    sourceIds: ["nasa-solar-system-exploration"],
  },
];

export const TRITON_EVENTS: AstronomicalEvent[] = [
  {
    id: "triton-discovery",
    bodyIds: ["triton"],
    year: 1846,
    date: "1846-10-10",
    title: "Lassell discovers Triton",
    category: "discovery",
    summary: "Just 17 days after Neptune's discovery, William Lassell spotted its large moon in his own telescope.",
    significance: "The only large moon on a retrograde orbit — later recognised as a captured Kuiper Belt object.",
    mission: "William Lassell (telescopic observation)",
    sourceIds: ["nasa-voyager"],
  },
  {
    id: "triton-geysers-voyager",
    bodyIds: ["triton"],
    year: 1989,
    date: "1989-08-25",
    title: "Nitrogen geysers on Triton",
    category: "geological",
    summary:
      "Voyager 2 photographed 8 km-high dark plumes rising from the frozen surface — ice erupting under solar heating.",
    significance: "Active cryovolcanism on a world 4.5 billion km from the Sun.",
    mission: "NASA Voyager 2",
    sourceIds: ["nasa-voyager"],
  },
];
