import type { AnyBody } from "@/data/types";
import type { ScaleMode } from "@/lib/format";

/**
 * SCIENCE → SCENE mapping. Nothing in this file is scientific data: these are
 * presentation compromises, clearly separated from `src/data/**`. The UI
 * always discloses the active mode (see `SCALE_MODE_LABELS`).
 *
 * Presentation mode: logarithmic size compression so Mercury is visible next
 * to Jupiter; orbital radii compressed so Neptune fits on screen.
 * Relative-size mode: planet radii in true ratio (Sun capped, still dominant).
 * Distance mode: orbital radii in true ratio (outer planets pushed far out).
 */

/** Legacy scene constants preserved from the original build (presentation). */
const PRESENTATION_ORBIT: Record<string, number> = {
  mercury: 6.2,
  venus: 8.6,
  earth: 11.6,
  mars: 15.4,
  ceres: 19.8,
  jupiter: 24.8,
  saturn: 33.4,
  uranus: 41.6,
  neptune: 49.2,
  pluto: 56.4,
};

const PRESENTATION_RADIUS: Record<string, number> = {
  sun: 2.65,
  mercury: 0.16,
  venus: 0.32,
  earth: 0.34,
  mars: 0.22,
  ceres: 0.12,
  jupiter: 1.28,
  saturn: 1.08,
  uranus: 0.58,
  neptune: 0.56,
  pluto: 0.15,
};

/** True relative radii (Earth = 0.34 scene units), Sun compressed 4×. */
const RELATIVE_RADIUS_SCALE = 0.34 / 6371; // scene units per km
const SUN_RADIUS_CAP = 5.2;

export function sceneRadius(body: AnyBody, mode: ScaleMode): number {
  const km = body.physical.meanRadiusKm ?? (body.physical.diameterKm ? body.physical.diameterKm / 2 : 2.5);
  if (mode === "relative-size") {
    if (body.identity.kind === "star") return SUN_RADIUS_CAP;
    return Math.max(km * RELATIVE_RADIUS_SCALE, 0.05);
  }
  return PRESENTATION_RADIUS[body.identity.id] ?? Math.max(0.08, 0.34 * (km / 6371) ** 0.45);
}

/** True-ratio orbital radii: 1 AU = 5.2 scene units (Neptune ≈ 156). */
export function sceneOrbitRadius(body: AnyBody, mode: ScaleMode): number {
  if (body.identity.kind !== "planet" && body.identity.kind !== "dwarf-planet") return 0;
  const au = body.orbit?.semiMajorAxisAu ?? 0;
  if (mode === "distance") return au * 5.2;
  return PRESENTATION_ORBIT[body.identity.id] ?? au * 5.2;
}

/**
 * Moon orbit radius in scene units around its (presentation-scaled) parent.
 * Log-compressed: real distances would fling moons off-screen.
 */
export function sceneMoonOrbit(moon: AnyBody, parentRadius: number): number {
  const km = moon.orbit?.semiMajorAxisKm ?? 0;
  if (!km) return parentRadius * 2.5;
  // Log compression keeps Phobos (9,400 km) and Iapetus (3.56M km) usable.
  const t = Math.log10(km / 9_000) / Math.log10(3_600_000 / 9_000); // 0..1
  return parentRadius * (1.9 + t * 3.4);
}

export function sceneMoonRadius(moon: AnyBody, parentRadius: number): number {
  const km = moon.physical.meanRadiusKm ?? (moon.physical.diameterKm ? moon.physical.diameterKm / 2 : 2.5);
  // Cap so Ganymede never dwarfs its planet on screen.
  return Math.max(Math.min(km * RELATIVE_RADIUS_SCALE, parentRadius * 0.38), 0.035);
}

/**
 * Single source of truth for "how big is this body on screen" — the camera
 * rig must use exactly what the renderer draws. Moons use the compressed
 * moon scale relative to their parent's scene radius; `parent` is the moon's
 * parent body (resolvable via `bodyById` in the caller).
 */
export function sceneBodyRadius(
  body: AnyBody,
  mode: ScaleMode,
  parent?: AnyBody | null,
): number {
  if (body.identity.kind === "moon" && body.identity.parentId) {
    const parentR = parent ? sceneRadius(parent, mode) : 0.34;
    return sceneMoonRadius(body, parentR);
  }
  return sceneRadius(body, mode);
}
