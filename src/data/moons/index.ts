import type { MoonBody } from "../types.ts";
import { MOON } from "./moon.ts";
import { PHOBOS } from "./phobos.ts";
import { DEIMOS } from "./deimos.ts";
import { IO } from "./io.ts";
import { EUROPA } from "./europa.ts";
import { GANYMEDE } from "./ganymede.ts";
import { CALLISTO } from "./callisto.ts";
import { TITAN } from "./titan.ts";
import { ENCELADUS } from "./enceladus.ts";
import { RHEA } from "./rhea.ts";
import { IAPETUS } from "./iapetus.ts";
import { DIONE } from "./dione.ts";
import { TETHYS } from "./tethys.ts";
import { MIMAS } from "./mimas.ts";
import { TITANIA } from "./titania.ts";
import { OBERON } from "./oberon.ts";
import { ARIEL } from "./ariel.ts";
import { UMBRIEL } from "./umbriel.ts";
import { MIRANDA } from "./miranda.ts";
import { TRITON } from "./triton.ts";
import { CHARON } from "./charon.ts";

/**
 * Curated detailed major moons (21). Rendered as first-class scene
 * bodies with dedicated procedural textures and full detail panels.
 * Includes all 20 planetary major moons and Pluto's companion Charon.
 */
export const MOONS: MoonBody[] = [
  MOON,
  PHOBOS,
  DEIMOS,
  IO,
  EUROPA,
  GANYMEDE,
  CALLISTO,
  TITAN,
  ENCELADUS,
  RHEA,
  IAPETUS,
  DIONE,
  TETHYS,
  MIMAS,
  TITANIA,
  OBERON,
  ARIEL,
  UMBRIEL,
  MIRANDA,
  TRITON,
  CHARON,
];

export const MOON_BY_ID: Record<string, MoonBody> = Object.fromEntries(
  MOONS.map((m) => [m.identity.id, m]),
);

export function moonsOf(parentId: string): MoonBody[] {
  return MOONS.filter((m) => m.identity.parentId === parentId);
}
