# Asset Attribution

Helios ships **no third-party imagery**. This page records the provenance of
every visual asset class in the repository.

## Inventory

| Asset | Class | Source | Licence |
| --- | --- | --- | --- |
| Planet/moon surface textures | **Generated** (procedural canvas, runtime) | Original code — `src/components/solar/textures.ts` | N/A (original work, same licence as repo) |
| Ring-system textures | **Generated** (radial profile, runtime) | Original code — `src/components/solar/ring-systems.ts` | N/A |
| Earth clouds / night lights / Venus radar | **Generated** | Original code — same file | N/A |
| Sun surface + glow | **Generated** (GLSL shader + canvas billboard) | Original code — `src/components/solar/bodies.tsx` | N/A |
| Starfield | **Generated** (seeded point cloud) | Original code | N/A |
| `public/favicon.svg` | **Vector** | Original work (this repository) | N/A |
| `public/assets/branding/og-card.svg` | **Vector** | Original work (this repository) | N/A |
| `public/assets/icons/orbit-mark.svg` | **Vector** | Original work (this repository) | N/A |
| `docs/architecture-diagram.svg` | **Vector** | Original work (this repository) | N/A |
| `public/og.jpg`, `public/x-banner.jpg` | **Raster (legacy)** | Pre-existing from initial scaffold | Unverified — see below |
| `public/__grok/**` | **Platform-managed** | App-builder platform chrome | Platform-owned — never modify |

## Legacy raster audit

`public/og.jpg` and `public/x-banner.jpg` date from the initial scaffold
and carry no recorded provenance. They are superseded by
`public/assets/branding/og-card.svg` (original vector art) and kept only
because the platform's PWA injector references them for share cards. If the
injector's reference moves to the SVG card, these two files should be
deleted. Until then: do not distribute them externally.

## Data-figure provenance

Scientific figures are attributed in `src/data/sources.ts` and documented
in [ASTRONOMICAL_DATA.md](ASTRONOMICAL_DATA.md) — that is data provenance,
not asset provenance, but the same honesty standard applies.

## If you add an external asset

1. Verify the licence from the source's own page (an image being publicly
   downloadable is not a licence).
2. Record it in the table above: source, organisation, original URL,
   licence, modifications made, retrieval date.
3. Prefer NASA/JPL/ESA/USGS imagery (generally public-domain as US
   government work) — but **verify per image**; partner facilities (e.g.
   ESA, universities) often retain different terms.
4. Follow the pipeline rules in [ASSET_PIPELINE.md](ASSET_PIPELINE.md)
   (optimise, lazy-load, tier it behind a procedural fallback).
