import type { AnyBody, CelestialBody } from "./types.ts";
import { SUN } from "./bodies/sun.ts";
import { MERCURY } from "./bodies/mercury.ts";
import { VENUS } from "./bodies/venus.ts";
import { EARTH } from "./bodies/earth.ts";
import { MARS } from "./bodies/mars.ts";
import { JUPITER } from "./bodies/jupiter.ts";
import { SATURN } from "./bodies/saturn.ts";
import { URANUS } from "./bodies/uranus.ts";
import { NEPTUNE } from "./bodies/neptune.ts";
import { MOONS, MOON_BY_ID, moonsOf } from "./moons/index.ts";
import { EVENTS, eventsForBody } from "./events/index.ts";
import { MISSIONS } from "./missions/index.ts";
import { SOURCES, sourceById } from "./sources.ts";

export const BODIES: CelestialBody[] = [
  SUN,
  MERCURY,
  VENUS,
  EARTH,
  MARS,
  JUPITER,
  SATURN,
  URANUS,
  NEPTUNE,
];

const REGISTRY: Record<string, AnyBody> = Object.fromEntries(
  [...BODIES, ...MOONS].map((b) => [b.identity.id, b]),
);

export function bodyById(id: string): AnyBody | undefined {
  return REGISTRY[id];
}

export function isMoon(id: string): boolean {
  return id in MOON_BY_ID;
}

export function bodyKind(id: string): "sun" | "planet" | "moon" | undefined {
  const b = REGISTRY[id];
  if (!b) return undefined;
  if (b.identity.kind === "star") return "sun";
  if (b.identity.kind === "moon") return "moon";
  return "planet";
}

export { moonsOf, eventsForBody, MOONS, MOON_BY_ID, EVENTS, MISSIONS, SOURCES, sourceById };

export const PLANET_IDS = BODIES.filter((b) => b.identity.kind === "planet").map(
  (b) => b.identity.id,
);

/** True when the body has a moon system worth rendering/inspecting. */
export function hasMoons(id: string): boolean {
  return moonsOf(id).length > 0;
}
