import type { AstronomicalEvent } from "../types.ts";
import { MERCURY_EVENTS } from "./mercury.ts";
import { VENUS_EVENTS } from "./venus.ts";
import { EARTH_EVENTS, LUNAR_EVENTS } from "./earth-moon.ts";
import { MARS_EVENTS } from "./mars.ts";
import { JUPITER_EVENTS, GALILEAN_EVENTS } from "./jupiter.ts";
import { SATURN_EVENTS, SATURN_MOON_EVENTS } from "./saturn.ts";
import { URANUS_EVENTS } from "./uranus.ts";
import { NEPTUNE_EVENTS, TRITON_EVENTS } from "./neptune.ts";
import { SOLAR_EVENTS } from "./sun.ts";
import { DWARF_PLANET_EVENTS } from "./dwarf-planets.ts";

export function compareEvents(a: AstronomicalEvent, b: AstronomicalEvent): number {
  if (a.year !== b.year) {
    return a.year - b.year;
  }
  if (a.date && b.date) {
    const diff = a.date.localeCompare(b.date);
    if (diff !== 0) return diff;
  } else if (a.date && !b.date) {
    return -1;
  } else if (!a.date && b.date) {
    return 1;
  }
  return a.title.localeCompare(b.title);
}

export const EVENTS: AstronomicalEvent[] = [
  ...SOLAR_EVENTS,
  ...MERCURY_EVENTS,
  ...VENUS_EVENTS,
  ...EARTH_EVENTS,
  ...LUNAR_EVENTS,
  ...MARS_EVENTS,
  ...DWARF_PLANET_EVENTS,
  ...JUPITER_EVENTS,
  ...GALILEAN_EVENTS,
  ...SATURN_EVENTS,
  ...SATURN_MOON_EVENTS,
  ...URANUS_EVENTS,
  ...NEPTUNE_EVENTS,
  ...TRITON_EVENTS,
].sort(compareEvents);

/** Events that mention a given body (planet or moon), strictly chronological. */
export function eventsForBody(bodyId: string): AstronomicalEvent[] {
  return EVENTS.filter((e) => e.bodyIds.includes(bodyId)).sort(compareEvents);
}

