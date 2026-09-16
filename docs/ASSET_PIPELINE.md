# Asset Pipeline

Helios ships **zero third-party imagery**. Every planetary surface, moon,
ring, and cloud layer is generated procedurally at runtime from seeded noise
plus body-specific structure painting.

## Why procedural

1. **Provenance** — no licence questions, no attribution mistakes, nothing
   copied from a source with unknown terms.
2. **Weight** — the entire visual system costs kilobytes of code instead of
   tens of megabytes of equirectangular rasters.
3. **Consistency** — one shared noise/fbm toolkit guarantees a unified
   visual identity across 29 bodies.

## Texture tiers

```
LOW   1024×512 canvas   generated eagerly at scene mount   system-view fidelity
HIGH  2048×1024 canvas  generated lazily on approach      inspection fidelity
```

- **LOW** — the `LOW_FACTORIES` table in `src/components/solar/textures.ts`.
  Generic generators (cratered, banded, ice-giant, moon) parameterised per
  body. Cheap enough to create every texture at startup (~11 canvas fills).
- **HIGH** — the `HIGH_FACTORIES` table: hand-authored structure per planet
  (Jupiter's Great Red Spot + white ovals, Saturn's polar hexagon, Mars'
  Olympus/Valles/Hellas, Mercury's Caloris basin, Earth continents +
  deserts, Venus' Y-cloud, Neptune's transient dark spot). Generated only
  when the camera comes within ~12 planet radii, then cached. Bodies without
  a HIGH factory fall back to LOW.

### Supporting maps (generated once, shared)

`clouds`/`cloudsHigh` (Earth), `earthNight` (city lights), `venusRadar`
(surface mode), `rings` (legacy Saturn ring disc), `glow` (solar billboard).

### Ring systems

`src/components/solar/ring-systems.ts` builds a 1024×8 radial profile
per ringed planet from the **data layer's** `RingSystem` record: inner/outer
radii in planet radii, band count, alpha prominence, and named divisions
(Cassini Division gap comes straight from the data). One generator, four
planets, no planet-specific hacks.

### Disposal

The scene owns one `TextureCache`; on unmount `disposeTextureCache` frees
every canvas texture (LOW, HIGH, shared). Per-use geometries/materials
dispose in their own effects (trails, ring meshes).

## Vector assets (SVG)

`public/assets/` holds the UI/brand vectors:

```
public/assets/
├── branding/   # wordmark, og-card art
├── icons/      # favicon set
└── diagrams/   # docs illustrations
```

Standards for any SVG added here:

- valid `viewBox`, no hardcoded width/height that block scaling
- no embedded raster payloads, no editor metadata/garbage
- minimal path count, semantic ids (`id="orbit-ring"`, not `path-47`)
- accessibility: `role="img"` + `<title>` for meaningful marks,
  `aria-hidden="true"` for decorative ones

## Adding an externally-sourced asset

The pipeline is designed so you shouldn't need to — but if a future feature
genuinely requires a raster (e.g. a real Cassini mosaic), it must:

1. come from a verifiable institutional source (NASA/JPL, ESA, USGS),
2. be recorded in `docs/ASSET_ATTRIBUTION.md` with source, URL, licence,
   modifications, and retrieval date,
3. be optimised (KTX2/basis or WebP where possible) and lazy-loaded,
4. slot into the tier system as a HIGH-tier map with the procedural map as
   LOW/fallback.

## Screenshots

QA captures for docs/PRs live in `screenshots/` (desktop + mobile), produced
by `scripts/browser-smoke.mjs` — see [TESTING.md](TESTING.md).
