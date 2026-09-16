import type { AstronomicalEvent } from "../types.ts";

export const URANUS_EVENTS: AstronomicalEvent[] = [
  {
    id: "uranus-herschel-discovery",
    bodyIds: ["uranus"],
    year: 1781,
    date: "1781-03-13",
    title: "Herschel discovers Uranus",
    category: "discovery",
    summary:
      "Widely reported first as a comet, the object in Gemini was quickly recognised as a new planet — the first found in recorded history.",
    significance: "Doubled the radius of the known solar system overnight and made Herschel famous.",
    mission: "William Herschel (telescopic observation)",
    sourceIds: ["nasa-voyager"],
  },
  {
    id: "uranus-rings-occultation",
    bodyIds: ["uranus"],
    year: 1977,
    date: "1977-03-10",
    title: "Rings discovered by stellar occultation",
    category: "discovery",
    summary:
      "A star's light blinked on and off before and after the planet — nine narrow rings nobody had seen directly.",
    significance: "Uranus became the second ringed planet known, caught by accident during an airborne observation.",
    mission: "Kuiper Airborne Observatory",
    sourceIds: ["nasa-voyager"],
  },
  {
    id: "uranus-voyager2-flyby",
    bodyIds: ["uranus", "titania", "oberon", "ariel", "umbriel", "miranda"],
    year: 1986,
    date: "1986-01-24",
    title: "Voyager 2's Uranus flyby",
    category: "mission",
    summary:
      "The only spacecraft visit: imaged the featureless blue disc, 10 new moons, and Miranda's impossible cliffs.",
    significance: "All close-up knowledge of the Uranian system dates from these few hours.",
    mission: "NASA Voyager 2",
    sourceIds: ["nasa-voyager"],
  },
  {
    id: "uranus-extreme-seasons",
    bodyIds: ["uranus"],
    year: 2007,
    title: "Equinox reveals changing weather",
    category: "observation",
    summary:
      "As the Sun crossed Uranus' equator, storms and banding appeared — the atmosphere is far more dynamic than the 1986 snapshot suggested.",
    significance: "Seasonal monitoring replaced the 'boring planet' narrative with a 42-year weather cycle.",
    mission: "Hubble and ground-based campaigns",
    sourceIds: ["nasa-hubble"],
  },
];
