import type { AstronomicalEvent } from "../types.ts";

export const DWARF_PLANET_EVENTS: AstronomicalEvent[] = [
  {
    id: "ceres-discovery",
    bodyIds: ["ceres"],
    year: 1801,
    date: "1801-01-01",
    title: "Discovery of Ceres by Piazzi",
    category: "discovery",
    summary:
      "Giuseppe Piazzi discovered Ceres from Palermo Observatory, initially thinking it was a comet or small missing planet between Mars and Jupiter.",
    significance:
      "First discovered asteroid/dwarf planet; Carl Friedrich Gauss developed modern orbital determination methods to relocate it later that year.",
    sourceIds: ["nasa-planetary-factsheet"],
  },
  {
    id: "pluto-discovery",
    bodyIds: ["pluto"],
    year: 1930,
    date: "1930-02-18",
    title: "Clyde Tombaugh discovers Pluto",
    category: "discovery",
    summary:
      "Using a blink comparator at Lowell Observatory in Flagstaff, Arizona, Tombaugh identified a shifting faint object beyond Neptune.",
    significance:
      "Opened exploration of the Kuiper Belt and outer trans-Neptunian region.",
    sourceIds: ["nasa-planetary-factsheet"],
  },
  {
    id: "iau-dwarf-planet-definition",
    bodyIds: ["ceres", "pluto"],
    year: 2006,
    date: "2006-08-24",
    title: "IAU adopts Dwarf Planet classification",
    category: "milestone",
    summary:
      "The International Astronomical Union General Assembly in Prague defined 'planet' and established the 'dwarf planet' category for bodies with sufficient gravity to achieve hydrostatic equilibrium but that haven't cleared their orbital neighborhood.",
    significance:
      "Ceres was promoted from asteroid to dwarf planet; Pluto was reclassified from major planet to dwarf planet, clarifying the taxonomy of the Solar System.",
    sourceIds: ["iau-nomenclature"],
  },
  {
    id: "dawn-ceres-arrival",
    bodyIds: ["ceres"],
    year: 2015,
    date: "2015-03-06",
    title: "Dawn arrives in orbit around Ceres",
    category: "mission",
    mission: "NASA Dawn",
    summary:
      "NASA's ion-propelled Dawn spacecraft entered orbit around Ceres after previously orbiting asteroid Vesta, becoming the first spacecraft to orbit two extraterrestrial destinations.",
    significance:
      "Revealed Occator Crater's bright sodium carbonate faculae and Ahuna Mons cryovolcano, proving Ceres is a geologically active brine-rich world.",
    sourceIds: ["nasa-dawn"],
  },
  {
    id: "new-horizons-pluto-flyby",
    bodyIds: ["pluto"],
    year: 2015,
    date: "2015-07-14",
    title: "New Horizons Pluto Flyby",
    category: "mission",
    mission: "NASA New Horizons",
    summary:
      "NASA's New Horizons probe flew within 12,500 km of Pluto's surface at 49,600 km/h, returning the first close-up high-resolution imagery and spectra.",
    significance:
      "Discovered the vast nitrogen glacier of Sputnik Planitia, towering water-ice mountain ranges, complex organic tholins, and atmospheric blue haze layers.",
    sourceIds: ["nasa-newhorizons"],
  },
];
