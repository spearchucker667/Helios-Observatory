import type { SourceRecord } from "./types.ts";

/**
 * Central source registry. Every non-trivial canonical figure and every
 * historical event in `src/data/**` cites an id from this table.
 *
 * Policy: authoritative institutional sources only (NASA, NASA/JPL, USGS
 * Astrogeology, ESA, IAU). No blogs, no wikis as primary citations.
 * `retrieved` is the date figures were last checked against the source.
 *
 * Canonical planetary figures below are from the NASA/JPL planetary
 * fact sheets (retrieved 2026-09-16). Moon counts are the confirmed
 * satellite tallies published by NASA's Solar System Exploration site.
 */
export const SOURCES: Record<string, SourceRecord> = {
  "nasa-planetary-factsheet": {
    id: "nasa-planetary-factsheet",
    title: "Planetary Fact Sheet — Metric",
    organization: "NASA Goddard Space Flight Center",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/",
    retrieved: "2026-09-16",
    scope: "Planetary physical and orbital characteristics",
  },
  "nasa-sun-factsheet": {
    id: "nasa-sun-factsheet",
    title: "Sun Fact Sheet",
    organization: "NASA Goddard Space Flight Center",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html",
    retrieved: "2026-09-16",
    scope: "Solar physical characteristics",
  },
  "nasa-moon-factsheet": {
    id: "nasa-moon-factsheet",
    title: "Moon Fact Sheet",
    organization: "NASA Goddard Space Flight Center",
    url: "https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html",
    retrieved: "2026-09-16",
    scope: "Lunar physical and orbital data",
  },
  "nasa-solar-system-exploration": {
    id: "nasa-solar-system-exploration",
    title: "NASA Solar System Exploration",
    organization: "NASA/JPL",
    url: "https://science.nasa.gov/solar-system/",
    retrieved: "2026-09-16",
    scope: "Moon counts, mission histories, discovery chronologies",
  },
  "nasa-jpl-missions": {
    id: "nasa-jpl-missions",
    title: "JPL Missions",
    organization: "NASA/JPL",
    url: "https://www.jpl.nasa.gov/missions/",
    retrieved: "2026-09-16",
    scope: "Spacecraft mission timelines and milestones",
  },
  "nasa-messenger": {
    id: "nasa-messenger",
    title: "MESSENGER — NASA Mission Pages",
    organization: "NASA",
    url: "https://science.nasa.gov/mission/messenger/",
    retrieved: "2026-09-16",
    scope: "Mercury mission history, polar ice findings",
  },
  "esa-bepicolombo": {
    id: "esa-bepicolombo",
    title: "BepiColombo",
    organization: "ESA/JAXA",
    url: "https://www.esa.int/Science_Exploration/Space_Science/BepiColombo",
    retrieved: "2026-09-16",
    scope: "BepiColombo mission milestones",
  },
  "nasa-magellan": {
    id: "nasa-magellan",
    title: "Magellan — Venus Radar Mapping",
    organization: "NASA/JPL",
    url: "https://science.nasa.gov/mission/magellan/",
    retrieved: "2026-09-16",
    scope: "Venus radar mapping history",
  },
  "nasa-mars-missions": {
    id: "nasa-mars-missions",
    title: "Mars Exploration Program",
    organization: "NASA/JPL",
    url: "https://science.nasa.gov/mars/",
    retrieved: "2026-09-16",
    scope: "Mars missions, rover discoveries, water evidence",
  },
  "nasa-galileo-mission": {
    id: "nasa-galileo-mission",
    title: "Galileo Mission",
    organization: "NASA/JPL",
    url: "https://science.nasa.gov/mission/galileo/",
    retrieved: "2026-09-16",
    scope: "Jupiter system exploration, Galilean moon findings",
  },
  "nasa-juno": {
    id: "nasa-juno",
    title: "Juno Mission",
    organization: "NASA/JPL",
    url: "https://science.nasa.gov/mission/juno/",
    retrieved: "2026-09-16",
    scope: "Jupiter and Jovian system observations",
  },
  "nasa-cassini": {
    id: "nasa-cassini",
    title: "Cassini — Legacy Pages",
    organization: "NASA/JPL",
    url: "https://science.nasa.gov/mission/cassini/",
    retrieved: "2026-09-16",
    scope: "Saturn system exploration, Titan and Enceladus findings",
  },
  "esa-huygens": {
    id: "esa-huygens",
    title: "Huygens Titan Landing",
    organization: "ESA",
    url: "https://www.esa.int/Science_Exploration/Space_Science/Cassini-Huygens",
    retrieved: "2026-09-16",
    scope: "Huygens descent and landing milestones",
  },
  "nasa-voyager": {
    id: "nasa-voyager",
    title: "Voyager Mission Status",
    organization: "NASA/JPL",
    url: "https://science.nasa.gov/mission/voyager/",
    retrieved: "2026-09-16",
    scope: "Voyager encounters, interstellar milestones",
  },
  "nasa-hubble": {
    id: "nasa-hubble",
    title: "Hubble Space Telescope",
    organization: "NASA/ESA",
    url: "https://science.nasa.gov/mission/hubble/",
    retrieved: "2026-09-16",
    scope: "Space-based observations of planets, Shoemaker-Levy 9",
  },
  "usgs-astrogeology": {
    id: "usgs-astrogeology",
    title: "Astrogeology Science Center — Gazetteer of Planetary Nomenclature",
    organization: "USGS",
    url: "https://planetarynames.wr.usgs.gov/",
    retrieved: "2026-09-16",
    scope: "Surface feature names and coordinates",
  },
  "iau-nomenclature": {
    id: "iau-nomenclature",
    title: "IAU Naming of Astronomical Objects",
    organization: "IAU",
    url: "https://www.iau.org/publications/proceedings_rules/units/",
    retrieved: "2026-09-16",
    scope: "Classification conventions",
  },
  "nasa-apollo": {
    id: "nasa-apollo",
    title: "Apollo Program",
    organization: "NASA",
    url: "https://www.nasa.gov/history/apollo.html",
    retrieved: "2026-09-16",
    scope: "Crewed lunar milestones",
  },
  "nasa-newhorizons": {
    id: "nasa-newhorizons",
    title: "New Horizons",
    organization: "NASA/JPL/APL",
    url: "https://science.nasa.gov/mission/new-horizons/",
    retrieved: "2026-09-16",
    scope: "Kuiper Belt and Pluto system (deferred scope)",
  },
};

export function sourceById(id: string): SourceRecord | undefined {
  return SOURCES[id];
}
