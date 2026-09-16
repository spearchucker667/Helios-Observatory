import * as THREE from "three";

/**
 * Tiered texture architecture.
 *
 * LOW  — procedural canvas textures, generated on demand, tiny memory cost,
 *        always available (offline-safe fallback, distant LOD).
 * HIGH — procedural *inspection* textures: same generator family but at
 *        2048×1024 with body-specific structure (storms, maria, canyons,
 *        ring divisions). Still procedural — no external raster assets — but
 *        recognisably detailed at inspection zoom. Loaded lazily per body
 *        when the camera approaches, disposed when the focus leaves.
 *
 * All textures remain canvas-generated: zero network payloads, full
 * attribution-free provenance (docs/ASSET_PIPELINE.md).
 */

type RGB = [number, number, number];

function hash(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

function noise2(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x: number, y: number, seed: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2(x * freq, y * freq, seed + i * 17);
    amp *= 0.5;
    freq *= 2;
  }
  return sum;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(a: RGB, b: RGB, t: number): RGB {
  const c = Math.max(0, Math.min(1, t));
  return [lerp(a[0], b[0], c), lerp(a[1], b[1], c), lerp(a[2], b[2], c)];
}

function canvasTexture(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w = 1024,
  h = 512,
): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D context unavailable");
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

function paintPixels(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  shade: (u: number, v: number, x: number, y: number) => [number, number, number, number],
) {
  const img = ctx.createImageData(w, h);
  const data = img.data;
  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const [r, g, b, a] = shade(u, v, x, y);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/** Wrap-safe longitude distance for u (0..1). */
function duWrap(u: number, cu: number): number {
  const d = Math.abs(u - cu);
  return Math.min(d, 1 - d);
}

/* ------------------------------------------------------------------ */
/* LOW tier (as shipped — distant LOD and fallback)                    */
/* ------------------------------------------------------------------ */

function cratered(seed: number, base: RGB, high: RGB) {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const lat = v * 2 - 1;
      const n = fbm(u * 8, v * 4, seed, 6);
      const n2 = fbm(u * 18 + 3, v * 9, seed + 4, 4);
      const crater = Math.pow(Math.max(0, 0.62 - n2), 2);
      let col = mix(base, high, n);
      col = mix(col, [40, 38, 36], crater * 1.6);
      const pole = Math.pow(Math.abs(lat), 8);
      col = mix(col, [210, 210, 214], pole * 0.35);
      return [col[0], col[1], col[2], 255];
    });
  });
}

function venusMap() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const n = fbm(u * 6, v * 3, 21, 6);
      const swirl = fbm(u * 4 + n, v * 8, 27, 4);
      const col = mix([196, 148, 72], [232, 206, 150], n * 0.7 + swirl * 0.3);
      const vein = mix(col, [168, 110, 52], Math.pow(swirl, 2));
      return [vein[0], vein[1], vein[2], 255];
    });
  });
}

function earthMap() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const lat = v * 2 - 1;
      const n = fbm(u * 7, v * 4, 42, 6);
      const n2 = fbm(u * 14, v * 8, 48, 4);
      const ocean = mix([8, 42, 92], [22, 92, 148], n * 0.5);
      const land = mix([46, 92, 48], [142, 126, 72], n2);
      const isLand = n > 0.52;
      let col = isLand ? land : ocean;
      if (isLand && n2 > 0.62) col = mix(col, [70, 110, 58], 0.5);
      const ice = Math.pow(Math.abs(lat), 5.4) + (n > 0.7 && Math.abs(lat) > 0.55 ? 0.3 : 0);
      col = mix(col, [236, 242, 248], Math.min(1, ice));
      return [col[0], col[1], col[2], 255];
    });
  });
}

function cloudMap(w = 1024) {
  return canvasTexture((ctx, w2, h) => {
    paintPixels(ctx, w2, h, (u, v) => {
      const n = fbm(u * 10, v * 5, 77, 6);
      const band = fbm(u * 3, v * 12, 81, 3);
      const a = Math.max(0, (n * 0.7 + band * 0.3 - 0.48) * 3.2) * 255;
      return [236, 242, 248, Math.min(255, a)];
    });
  }, w, w / 2);
}

function marsMap() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const lat = v * 2 - 1;
      const n = fbm(u * 8, v * 4, 33, 6);
      const n2 = fbm(u * 16, v * 8, 39, 4);
      let col = mix([92, 42, 28], [186, 108, 64], n);
      col = mix(col, [56, 36, 30], Math.pow(n2, 2));
      const ice = Math.pow(Math.abs(lat), 7.2);
      col = mix(col, [232, 236, 240], ice);
      return [col[0], col[1], col[2], 255];
    });
  });
}

function banded(
  seed: number,
  dark: RGB,
  light: RGB,
  storm?: { u: number; v: number; r: number; color: RGB },
) {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const warp = fbm(u * 4, v * 2, seed, 4);
      const bands = Math.sin((v + warp * 0.12) * Math.PI * 14);
      const turb = fbm(u * 10, v * 6, seed + 9, 5);
      let t = bands * 0.5 + 0.5;
      t = lerp(t, turb, 0.35);
      let col = mix(dark, light, t);
      if (storm) {
        const du = duWrap(u, storm.u);
        const dv = (v - storm.v) * 2;
        const d = Math.sqrt(du * du * 8 + dv * dv * 18);
        if (d < storm.r) {
          col = mix(col, storm.color, 1 - d / storm.r);
        }
      }
      return [col[0], col[1], col[2], 255];
    });
  });
}

function iceGiant(seed: number, a: RGB, b: RGB) {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const n = fbm(u * 5, v * 3, seed, 5);
      const streak = fbm(u * 8, v * 14, seed + 3, 3);
      let col = mix(a, b, n);
      col = mix(col, [20, 28, 60], Math.pow(streak, 3) * 0.45);
      return [col[0], col[1], col[2], 255];
    });
  });
}

function ringMap() {
  return canvasTexture(
    (ctx, w, h) => {
      paintPixels(ctx, w, h, (u, v) => {
        const dx = u * 2 - 1;
        const dy = v * 2 - 1;
        const r = Math.sqrt(dx * dx + dy * dy);
        const inner = 0.42;
        const outer = 0.98;
        if (r < inner || r > outer) return [0, 0, 0, 0];
        const t = (r - inner) / (outer - inner);
        const cassini = t > 0.52 && t < 0.62;
        const n = noise2(r * 40, Math.atan2(dy, dx) * 3, 90);
        const band = 0.35 + Math.sin(t * 48) * 0.12 + n * 0.18;
        const alpha = cassini ? 0.04 : Math.max(0.08, band);
        const col = mix([214, 196, 150], [120, 104, 82], t);
        return [col[0], col[1], col[2], Math.min(255, alpha * 255)];
      });
    },
    1024,
    1024,
  );
}

function glowMap() {
  return canvasTexture(
    (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, "rgba(255, 236, 190, 1)");
      g.addColorStop(0.18, "rgba(255, 196, 92, 0.55)");
      g.addColorStop(0.42, "rgba(255, 140, 40, 0.16)");
      g.addColorStop(0.7, "rgba(255, 90, 20, 0.04)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    },
    256,
    256,
  );
}

/* ------------------------------------------------------------------ */
/* HIGH inspection tier — body-specific structure at 2048×1024         */
/* ------------------------------------------------------------------ */

/** Ellipse patch helper: distance field for spots/storms/craters. */
function patch(
  u: number,
  v: number,
  cu: number,
  cv: number,
  ru: number,
  rv: number,
): number {
  const du = duWrap(u, cu) / ru;
  const dv = (v - cv) / rv;
  return Math.sqrt(du * du + dv * dv);
}

function mercuryHigh() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const lat = v * 2 - 1;
      const n = fbm(u * 8, v * 4, 11, 7);
      const n2 = fbm(u * 24 + 3, v * 12, 15, 5);
      const n3 = fbm(u * 64, v * 32, 18, 3);
      let col = mix([88, 82, 76], [172, 164, 152], n);
      // Crater population: three scales.
      const crater = Math.pow(Math.max(0, 0.6 - n2), 2) * 1.7;
      const crater2 = Math.pow(Math.max(0, 0.5 - n3), 2) * 1.1;
      col = mix(col, [42, 40, 38], Math.min(1, crater + crater2));
      // Caloris basin: large bright annulus with darker floor.
      const caloris = patch(u, v, 0.528, 0.577, 0.11, 0.075);
      if (caloris < 1) {
        const floor = mix(col, [148, 138, 124], 0.55);
        const rim = caloris > 0.78 ? mix(floor, [196, 188, 174], (caloris - 0.78) / 0.22) : floor;
        col = rim;
      }
      // Polar shadow regions stay cold-dark.
      const pole = Math.pow(Math.abs(lat), 9);
      col = mix(col, [208, 210, 216], pole * 0.3);
      return [col[0], col[1], col[2], 255];
    });
  }, 2048, 1024);
}

function venusHigh() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const lat = v * 2 - 1;
      // Y-shaped cloud feature: two sheared bands converging.
      const shear = fbm(u * 3, v * 2, 21, 5) * 0.18;
      const bandY = Math.abs(((v - 0.5) * 2 + shear * 3 + 0.35) % 1.4 - 0.7);
      const chevron = Math.exp(-Math.pow(bandY * 7, 2)) * 0.35;
      const n = fbm(u * 6, v * 5, 27, 6);
      const swirl = fbm(u * 4 + n, v * 9, 33, 4);
      let col = mix([198, 152, 80], [238, 214, 158], n * 0.6 + swirl * 0.25 + chevron);
      col = mix(col, [172, 116, 58], Math.pow(swirl, 2) * 0.5);
      // Bright polar collars.
      const pole = Math.pow(Math.abs(lat), 5);
      col = mix(col, [244, 226, 186], pole * 0.35);
      return [col[0], col[1], col[2], 255];
    });
  }, 2048, 1024);
}

function venusRadarMap() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const n = fbm(u * 9, v * 5, 41, 6);
      const highland = fbm(u * 4, v * 2, 47, 4);
      let col = mix([40, 52, 84], [92, 118, 168], n);
      // Ishtar + Aphrodite terrae as bright highlands.
      const aphrodite = patch(u, v, 0.79, 0.55, 0.22, 0.1);
      const ishtar = patch(u, v, 0.51, 0.18, 0.08, 0.09);
      const high = Math.max(Math.max(0, 1 - aphrodite), Math.max(0, 1 - ishtar) * 0.9, Math.max(0, highland - 0.62) * 1.6);
      col = mix(col, [212, 196, 158], Math.min(1, high));
      return [col[0], col[1], col[2], 255];
    });
  }, 2048, 1024);
}

function earthHigh() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const lat = v * 2 - 1;
      const n = fbm(u * 7, v * 4, 42, 7);
      const n2 = fbm(u * 16, v * 9, 48, 5);
      const detail = fbm(u * 40, v * 22, 52, 3);
      const ocean = mix([6, 34, 82], [24, 98, 156], n * 0.6);
      const land = mix([42, 86, 46], [148, 128, 74], n2);
      const desert = mix([168, 138, 88], [190, 158, 104], detail);
      const isLand = n > 0.52;
      let col = isLand ? mix(land, desert, Math.max(0, detail - 0.45) * 1.2) : mix(ocean, [32, 118, 168], Math.max(0, 0.45 - Math.abs(n - 0.4)) * 0.4);
      if (isLand && n2 > 0.66) col = mix(col, [64, 104, 54], 0.5);
      if (isLand && lat > 0.62) col = mix(col, [220, 222, 218], (lat - 0.62) * 2);
      const ice = Math.pow(Math.abs(lat), 4.6);
      col = mix(col, [240, 246, 250], Math.min(1, ice));
      return [col[0], col[1], col[2], 255];
    });
  }, 2048, 1024);
}

function earthNightMap() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const lat = v * 2 - 1;
      const n = fbm(u * 7, v * 4, 42, 7);
      const isLand = n > 0.52;
      const clusters = fbm(u * 30, v * 16, 91, 4);
      const city = isLand && clusters > 0.58 ? Math.min(1, (clusters - 0.58) * 5.5) : 0;
      const base = mix([2, 6, 14], [8, 12, 20], fbm(u * 5, v * 3, 7, 3));
      const col = mix(base, [255, 208, 128], city * (1 - Math.pow(Math.abs(lat), 6)));
      return [col[0], col[1], col[2], 255];
    });
  }, 1024, 512);
}

function marsHigh() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const lat = v * 2 - 1;
      const n = fbm(u * 8, v * 4, 33, 7);
      const n2 = fbm(u * 20, v * 10, 39, 5);
      let col = mix([88, 40, 26], [190, 112, 66], n);
      col = mix(col, [54, 34, 28], Math.pow(n2, 2) * 0.9);
      // Albedo provinces: Syrtis-like dark region, Hellas bright basin.
      const syrtis = patch(u, v, 0.7, 0.4, 0.09, 0.08);
      col = mix(col, [64, 38, 30], Math.max(0, 1 - syrtis) * 0.7);
      const hellas = patch(u, v, 0.696, 0.62, 0.1, 0.07);
      col = mix(col, [214, 168, 120], Math.max(0, 1 - hellas) * 0.45);
      // Olympus Mons: shield with caldera dot.
      const olympus = patch(u, v, 0.628, 0.448, 0.045, 0.035);
      if (olympus < 1) {
        col = mix(col, [202, 148, 100], (1 - olympus) * 0.5);
        const caldera = patch(u, v, 0.628, 0.448, 0.008, 0.007);
        col = mix(col, [120, 72, 48], Math.max(0, 1 - caldera) * 0.6);
      }
      // Valles Marineris: dark elongated gash.
      const valles = patch(u, v, 0.84, 0.545, 0.13, 0.012);
      col = mix(col, [58, 32, 24], Math.exp(-Math.pow(valles * 3, 2)) * 0.75);
      // Polar caps.
      const capN = Math.pow(Math.max(0, lat), 10) * 1.6 + (n > 0.62 ? 0.1 : 0);
      const capS = Math.pow(Math.max(0, -lat), 9) * 1.7;
      col = mix(col, [236, 240, 244], Math.min(1, capN + capS));
      return [col[0], col[1], col[2], 255];
    });
  }, 2048, 1024);
}

function jupiterHigh() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const warp = fbm(u * 4, v * 2, 55, 5);
      const warp2 = fbm(u * 9, v * 5, 58, 4);
      const bands = Math.sin((v + warp * 0.09 + warp2 * 0.05) * Math.PI * 22);
      const turb = fbm(u * 14, v * 8, 64, 5);
      let t = bands * 0.5 + 0.5;
      t = lerp(t, turb, 0.3);
      let col = mix([142, 98, 62], [232, 210, 170], t);
      // Polar regions: bluish-grey, chaotic.
      const lat = v * 2 - 1;
      const polar = Math.pow(Math.abs(lat), 6);
      col = mix(col, [148, 138, 128], polar * 0.55);
      // Great Red Spot: nested oval with swirl.
      const grs = patch(u, v, 0.263, 0.69, 0.055, 0.042);
      if (grs < 1) {
        const core = patch(u, v, 0.263, 0.69, 0.02, 0.016);
        let spot = mix([196, 92, 58], [224, 148, 104], 1 - grs);
        spot = mix(spot, [172, 64, 44], Math.max(0, 1 - core * 1.4) * 0.6);
        col = mix(col, spot, 1 - grs * grs);
      }
      // White oval storms (ba's) south of the GRS latitude band.
      const oval = patch(u, v, 0.6, 0.63, 0.018, 0.013);
      const oval2 = patch(u, v, 0.86, 0.62, 0.014, 0.011);
      const whiteness = Math.max(Math.max(0, 1 - oval), Math.max(0, 1 - oval2));
      col = mix(col, [242, 234, 220], whiteness * 0.85);
      return [col[0], col[1], col[2], 255];
    });
  }, 2048, 1024);
}

function saturnHigh() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const warp = fbm(u * 4, v * 2, 61, 4);
      const bands = Math.sin((v + warp * 0.06) * Math.PI * 18);
      const turb = fbm(u * 12, v * 7, 67, 4);
      let t = bands * 0.5 + 0.5;
      t = lerp(t, turb, 0.24);
      let col = mix([176, 148, 96], [236, 222, 182], t);
      // Temperate storm: the Great White Spot band (brighter zone).
      const storm = patch(u, v, 0.4, 0.38, 0.1, 0.028);
      col = mix(col, [246, 238, 210], Math.exp(-Math.pow(storm * 2.2, 2)) * 0.4);
      // North-polar hexagon: six-sided boundary near 78°N.
      const polarLat = (0.5 - v) * 2; // +1 at north pole
      if (polarLat > 0.72) {
        const theta = Math.atan2(Math.sin(u * Math.PI * 2), Math.cos(u * Math.PI * 2));
        const hexAngle = Math.abs(Math.cos((theta / 6) * Math.PI * 3)) ;
        const hexEdge = 0.74 + hexAngle * 0.05;
        const inside = polarLat > hexEdge;
        col = inside ? mix(col, [138, 156, 148], 0.5) : mix(col, [204, 188, 148], 0.25);
        const edge = Math.exp(-Math.pow((polarLat - hexEdge) * 60, 2));
        col = mix(col, [88, 108, 100], edge * 0.5);
      }
      return [col[0], col[1], col[2], 255];
    });
  }, 2048, 1024);
}

function uranusHigh() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const lat = v * 2 - 1;
      const n = fbm(u * 5, v * 3, 71, 5);
      const streak = fbm(u * 8, v * 14, 75, 3);
      let col = mix([118, 178, 186], [190, 228, 230], n);
      col = mix(col, [168, 214, 220], Math.pow(streak, 3) * 0.4);
      // Bright polar hood.
      const hood = Math.pow(Math.abs(lat), 3.4);
      col = mix(col, [214, 240, 240], hood * 0.35);
      return [col[0], col[1], col[2], 255];
    });
  }, 2048, 1024);
}

function neptuneHigh() {
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const lat = v * 2 - 1;
      const n = fbm(u * 5, v * 3, 83, 5);
      let col = mix([24, 54, 138], [88, 130, 206], n);
      // High-altitude white cloud streaks.
      const streak = fbm(u * 6, v * 18, 87, 4);
      const cirrus = Math.exp(-Math.pow((0.5 - Math.abs(streak - 0.5)) * 6, 2));
      col = mix(col, [228, 238, 252], cirrus * 0.5 * (1 - Math.pow(Math.abs(lat), 3)));
      // Transient dark spot — presented as it appeared in 1989, per data notes.
      const spot = patch(u, v, 0.32, 0.6, 0.05, 0.04);
      col = mix(col, [16, 32, 96], Math.exp(-Math.pow(spot * 2.4, 2)) * 0.65);
      return [col[0], col[1], col[2], 255];
    });
  }, 2048, 1024);
}

/* ------------------------------------------------------------------ */
/* Moon textures                                                       */
/* ------------------------------------------------------------------ */

function moonTexture(
  seed: number,
  base: RGB,
  high: RGB,
  opts: {
    maria?: { u: number; v: number; r: number }[];
    lineae?: boolean;
    grooves?: boolean;
    darkSide?: number; // Iapetus hemispheric contrast
    tigerStripes?: boolean;
    smoothness?: number;
    craters?: number;
    ventLat?: number;
  } = {},
) {
  const {
    maria = [],
    lineae = false,
    grooves = false,
    darkSide = 0,
    tigerStripes = false,
    smoothness = 0,
    craters = 1,
  } = opts;
  return canvasTexture((ctx, w, h) => {
    paintPixels(ctx, w, h, (u, v) => {
      const n = fbm(u * 10, v * 5, seed, 6);
      const n2 = fbm(u * 28 + 5, v * 14, seed + 4, 4);
      let col = mix(base, high, n * (1 - smoothness * 0.6));
      if (craters > 0) {
        const crater = Math.pow(Math.max(0, 0.6 - n2), 2) * craters;
        col = mix(col, [38, 36, 34], Math.min(1, crater));
      }
      for (const m of maria) {
        const d = patch(u, v, m.u, m.v, m.r, m.r * 0.75);
        if (d < 1) col = mix(col, [64, 62, 60], (1 - d) * 0.75);
      }
      if (lineae) {
        const band = fbm(u * 3 + v * 7, v * 2, seed + 9, 3);
        const ridge = Math.exp(-Math.pow((band - 0.5) * 14, 2));
        col = mix(col, [142, 74, 52], ridge * 0.6);
      }
      if (grooves) {
        const groove = Math.sin(u * 90 + n * 8) * 0.5 + 0.5;
        col = mix(col, [188, 180, 168], groove * 0.22);
      }
      if (darkSide > 0) {
        const leading = u < 0.5 ? 1 : 0;
        col = leading ? mix(col, [52, 38, 30], darkSide) : mix(col, [226, 224, 218], 0.25);
      }
      if (tigerStripes && v > 0.88) {
        const stripe = Math.sin(u * Math.PI * 16) * 0.5 + 0.5;
        col = mix(col, [96, 176, 196], stripe * (v - 0.88) / 0.12 * 0.55);
      }
      return [col[0], col[1], col[2], 255];
    });
  }, 1024, 512);
}

/* ------------------------------------------------------------------ */
/* Registry + lazy cache                                               */
/* ------------------------------------------------------------------ */

export type TextureTier = "low" | "high";

const LOW_FACTORIES: Record<string, () => THREE.CanvasTexture> = {
  sun: () => glowMap(), // sun uses shader; glow for billboard
  mercury: () => cratered(11, [92, 86, 80], [168, 160, 150]),
  venus: () => venusMap(),
  earth: () => earthMap(),
  mars: () => marsMap(),
  jupiter: () => banded(55, [150, 108, 70], [228, 206, 168], { u: 0.72, v: 0.58, r: 0.12, color: [176, 72, 48] }),
  saturn: () => banded(61, [176, 150, 100], [232, 218, 178]),
  uranus: () => iceGiant(71, [72, 154, 162], [186, 226, 228]),
  neptune: () => iceGiant(83, [28, 62, 148], [96, 140, 214]),
  // Moons: LOW tier shares the cratered generator with body-tuned palettes.
  moon: () => moonTexture(101, [176, 172, 166], [216, 212, 204], { maria: [{ u: 0.32, v: 0.4, r: 0.16 }, { u: 0.55, v: 0.32, r: 0.1 }] }),
  phobos: () => moonTexture(103, [122, 110, 98], [150, 138, 124], { craters: 1.8 }),
  deimos: () => moonTexture(107, [134, 124, 112], [160, 150, 138], { craters: 1.1, smoothness: 0.5 }),
  io: () => moonTexture(113, [206, 176, 74], [236, 216, 128], { craters: 0.2, smoothness: 0.3 }),
  europa: () => moonTexture(127, [210, 200, 186], [240, 234, 224], { craters: 0.15, lineae: true, smoothness: 0.6 }),
  ganymede: () => moonTexture(131, [152, 144, 134], [196, 188, 176], { craters: 0.9, grooves: true }),
  callisto: () => moonTexture(137, [118, 106, 94], [158, 148, 134], { craters: 2.2 }),
  titan: () => moonTexture(139, [196, 146, 62], [226, 186, 106], { craters: 0, smoothness: 0.8 }),
  enceladus: () => moonTexture(149, [222, 230, 236], [244, 248, 252], { craters: 0.4, tigerStripes: true, smoothness: 0.4 }),
  rhea: () => moonTexture(151, [186, 190, 194], [220, 224, 228], { craters: 1.5 }),
  iapetus: () => moonTexture(157, [176, 162, 138], [220, 214, 202], { craters: 1.4, darkSide: 0.78 }),
  dione: () => moonTexture(163, [182, 186, 190], [216, 220, 224], { craters: 1.2 }),
  tethys: () => moonTexture(167, [200, 204, 208], [232, 234, 238], { craters: 1.1 }),
  mimas: () => moonTexture(173, [188, 190, 194], [222, 226, 230], { craters: 1.6 }),
  titania: () => moonTexture(179, [148, 142, 134], [186, 180, 170], { craters: 1 }),
  oberon: () => moonTexture(181, [134, 128, 120], [172, 166, 156], { craters: 1.4 }),
  ariel: () => moonTexture(191, [162, 156, 148], [200, 194, 184], { craters: 0.8 }),
  umbriel: () => moonTexture(193, [96, 92, 88], [128, 124, 118], { craters: 1.3 }),
  miranda: () => moonTexture(197, [154, 150, 144], [192, 188, 180], { craters: 0.9, grooves: true }),
  triton: () => moonTexture(199, [204, 198, 190], [232, 228, 220], { craters: 0.4, smoothness: 0.5 }),
};

const HIGH_FACTORIES: Record<string, () => THREE.CanvasTexture> = {
  mercury: mercuryHigh,
  venus: venusHigh,
  earth: earthHigh,
  mars: marsHigh,
  jupiter: jupiterHigh,
  saturn: saturnHigh,
  uranus: uranusHigh,
  neptune: neptuneHigh,
};

/** Specialised secondary maps, generated once, shared. */
export type SharedMaps = {
  clouds: THREE.CanvasTexture;
  cloudsHigh: THREE.CanvasTexture;
  earthNight: THREE.CanvasTexture;
  venusRadar: THREE.CanvasTexture;
  rings: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
};

function createShared(): SharedMaps {
  return {
    clouds: cloudMap(1024),
    cloudsHigh: cloudMap(2048),
    earthNight: earthNightMap(),
    venusRadar: venusRadarMap(),
    rings: ringMap(),
    glow: glowMap(),
  };
}

export type TextureCache = {
  shared: SharedMaps;
  /** LOW tier — generated eagerly, cheap. */
  low: Map<string, THREE.CanvasTexture>;
  /** HIGH tier — generated on first request (lazy), cached thereafter. */
  high: Map<string, THREE.CanvasTexture>;
  get: (bodyId: string, tier: TextureTier) => THREE.CanvasTexture;
  dispose: () => void;
};

export function createTextureCache(): TextureCache {
  const low = new Map<string, THREE.CanvasTexture>();
  const high = new Map<string, THREE.CanvasTexture>();
  const shared = createShared();
  const cache: TextureCache = {
    shared,
    low,
    high,
    get(bodyId, tier) {
      if (tier === "high") {
        let tex = high.get(bodyId);
        if (!tex) {
          const factory = HIGH_FACTORIES[bodyId];
          if (factory) {
            tex = factory();
            high.set(bodyId, tex);
          }
        }
        if (tex) return tex;
        // fall through to LOW for bodies without a HIGH factory
      }
      let tex = low.get(bodyId);
      if (!tex) {
        const factory = LOW_FACTORIES[bodyId] ?? (() => moonTexture(211, [140, 134, 126], [170, 164, 154], { craters: 1 }));
        tex = factory();
        low.set(bodyId, tex);
      }
      return tex;
    },
    dispose() {
      low.forEach((t) => t.dispose());
      high.forEach((t) => t.dispose());
      low.clear();
      high.clear();
      shared.clouds.dispose();
      shared.cloudsHigh.dispose();
      shared.earthNight.dispose();
      shared.venusRadar.dispose();
      shared.rings.dispose();
      shared.glow.dispose();
    },
  };
  return cache;
}

/* Legacy API preserved for the existing scene (delegating to the cache). */
export type BodyTextures = {
  maps: Record<string, THREE.CanvasTexture>;
  clouds: THREE.CanvasTexture;
  rings: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
};

export function createBodyTextures(): BodyTextures {
  const cache = createTextureCache();
  const maps: Record<string, THREE.CanvasTexture> = {};
  for (const id of ["mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune"]) {
    maps[id] = cache.get(id, "low");
  }
  return {
    maps,
    clouds: cache.shared.clouds,
    rings: cache.shared.rings,
    glow: cache.shared.glow,
  };
}

/** Dispose a full cache (used by the scene teardown). */
export function disposeTextureCache(cache: TextureCache) {
  cache.dispose();
}

export function disposeTextures(tex: BodyTextures) {
  Object.values(tex.maps).forEach((t) => t.dispose());
  tex.clouds.dispose();
  tex.rings.dispose();
  tex.glow.dispose();
}
