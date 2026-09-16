import * as THREE from "three";
import { JUPITER } from "@/data/bodies/jupiter";
import { SATURN } from "@/data/bodies/saturn";
import { URANUS } from "@/data/bodies/uranus";
import { NEPTUNE } from "@/data/bodies/neptune";
import type { RingSystem } from "@/data/types";

/**
 * Ring systems for all four ringed planets, driven by the data layer's
 * `RingSystem` records (inner/outer radii in planet radii). Saturn stays
 * dramatically prominent; Jupiter/Neptune are faint dust sheets; Uranus is a
 * set of narrow dark rings. One generator, per-planet parameters — no
 * planet-specific rendering hacks in the scene code.
 */

type RingParams = {
  data: RingSystem;
  /** Base colour pair (inner → outer). */
  from: THREE.Color;
  to: THREE.Color;
  /** Peak alpha of the main band. */
  alpha: number;
  /** Number of fine sub-bands. */
  bandCount: number;
  /** Named divisions → alpha gaps (fraction between inner/outer). */
  gaps: { at: number; width: number }[];
};

function gapsFromData(data: RingSystem, total: number): { at: number; width: number }[] {
  if (!data.divisions?.length) return [];
  const inner = data.innerRadiusPlanetary;
  const span = data.outerRadiusPlanetary - inner;
  return data.divisions
    .filter((d) => d.atPlanetaryRadius > inner)
    .map((d) => {
      const at = (d.atPlanetaryRadius - inner) / span;
      const cassini = d.name.toLowerCase().includes("cassini");
      return { at, width: cassini ? 0.09 : 0.02 };
    })
    .filter((g) => g.at > 0 && g.at < 1)
    .slice(0, total);
}

export const RING_PARAMS: Record<string, RingParams> = {
  jupiter: {
    data: JUPITER.rings!,
    from: new THREE.Color("#5a4a3c"),
    to: new THREE.Color("#8a7660"),
    alpha: 0.1,
    bandCount: 8,
    gaps: [],
  },
  saturn: {
    data: SATURN.rings!,
    from: new THREE.Color("#d8c49a"),
    to: new THREE.Color("#8a7454"),
    alpha: 0.95,
    bandCount: 56,
    gaps: gapsFromData(SATURN.rings!, 3),
  },
  uranus: {
    data: URANUS.rings!,
    from: new THREE.Color("#4a5058"),
    to: new THREE.Color("#687078"),
    alpha: 0.4,
    bandCount: 14,
    gaps: [],
  },
  neptune: {
    data: NEPTUNE.rings!,
    from: new THREE.Color("#3c4668"),
    to: new THREE.Color("#586a94"),
    alpha: 0.26,
    bandCount: 10,
    gaps: [],
  },
};

function hash(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

/** Radial profile texture (1×1024) stretched around the ring annulus. */
export function createRingTexture(planetId: string): THREE.CanvasTexture {
  const p = RING_PARAMS[planetId];
  if (!p) throw new Error(`no ring params for ${planetId}`);
  const w = 1024;
  const h = 8;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context unavailable");

  const img = ctx.createImageData(w, h);
  const d = img.data;

  for (let x = 0; x < w; x++) {
    const t = x / (w - 1); // 0 = inner edge, 1 = outer edge
    // Fine banding: layered sine + noise, denser for Saturn.
    let band = 0;
    for (let b = 1; b <= 3; b++) {
      band += (Math.sin(t * p.bandCount * b * 1.7 + b) * 0.5 + 0.5) / (b * 1.8);
    }
    band /= 1.5;
    const grain = hash(x, 7, 11) * 0.16;
    let a = p.alpha * Math.min(1, band + grain * p.alpha);

    // Fade-in at the inner edge, taper at the outer edge.
    a *= Math.min(1, t / 0.06) * Math.min(1, (1 - t) / 0.05);

    // Named gaps (Cassini etc.).
    for (const g of p.gaps) {
      const dist = Math.abs(t - g.at);
      if (dist < g.width) a *= dist / g.width * 0.6;
    }

    // Saturn's B ring is the densest: brighten mid-radial range.
    if (planetId === "saturn" && t > 0.25 && t < 0.6) a = Math.min(1, a * 1.35);

    const col = p.from.clone().lerp(p.to, t);
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      d[i] = col.r * 255;
      d[i + 1] = col.g * 255;
      d[i + 2] = col.b * 255;
      d[i + 3] = Math.min(255, a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}
