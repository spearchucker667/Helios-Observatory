import type { AstronomicalEvent } from "../types.ts";

export const SOLAR_EVENTS: AstronomicalEvent[] = [
  {
    id: "sun-galileo-sunspots",
    bodyIds: ["sun"],
    year: 1613,
    date: "1613",
    title: "Sunspots end the perfect Sun",
    category: "observation",
    summary:
      "Galileo's published letters argued sunspots were on or near the Sun's surface — imperfections on a 'perfect' celestial body, and proof the heavens changed.",
    significance: "Helped dismantle Aristotelian cosmology and opened solar physics as a discipline.",
    mission: "Galileo Galilei (telescopic observation)",
    sourceIds: ["nasa-sun-factsheet"],
  },
  {
    id: "sun-maunder-minimum",
    bodyIds: ["sun"],
    year: 1645,
    title: "The Maunder Minimum",
    category: "observation",
    summary:
      "For seventy years sunspots nearly vanished; the coldest decades of the Little Ice Age coincided with Europe's frozen rivers.",
    significance: "First clear evidence that the Sun's output varies — the foundation of solar-cycle science.",
    sourceIds: ["nasa-sun-factsheet"],
  },
  {
    id: "sun-parker-touch",
    bodyIds: ["sun"],
    year: 2021,
    date: "2021-04-28",
    title: "Parker Solar Probe enters the corona",
    category: "milestone",
    summary:
      "Parker Solar Probe flew through the Sun's upper atmosphere, sampling the million-degree corona directly for the first time.",
    significance: "First spacecraft to 'touch' the Sun; direct measurement of the solar wind's birthplace.",
    mission: "NASA Parker Solar Probe",
    sourceIds: ["nasa-sun-factsheet"],
  },
];
