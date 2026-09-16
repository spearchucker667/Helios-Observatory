# Astronomical Data

This document explains where Helios' numbers come from, how fresh they are,
and which parts of the visualisation are **not** science.

## The three registers

Every quantity in Helios belongs to exactly one of:

| Register | Meaning | Lives in |
| --- | --- | --- |
| **Scientific data** | Canonical, source-cited astronomy | `src/data/**` (`physical`, `orbit`, `rotation`, `temperature`, …) |
| **Analytical ephemeris** | J2000 Keplerian elliptical mechanics (1800–2050 AD) | `src/lib/ephemeris.ts` |
| **Visualization scale** | Presentation compromises that make the system watchable | `src/lib/scene-scale.ts` |
| **Simulation engine** | 3D numerical propagation, camera tracking, and real-time calipers | `bodies.tsx`, `caliper.tsx` |

The UI distinguishes these explicitly: the footer shows the active scale
mode ("Presentation view — not to scale", "True size", "True distance") and
the Epoch control displays the exact UTC date alongside simulation velocity.

## Canonical sources

All planetary figures come from the **NASA GSFC planetary fact sheets**;
moon counts and satellite orbital elements from the **NASA/JPL Solar System Dynamics Group**
and **IAU Minor Planet Center**; surface-feature names from the **USGS Gazetteer of Planetary
Nomenclature**. The full registry with URLs and retrieval dates is
`src/data/sources.ts`.

| Source id | Used for | Retrieved |
| --- | --- | --- |
| `nasa-planetary-factsheet` | Planetary physical/orbital characteristics | 2026-09-16 |
| `nasa-sun-factsheet` | Solar characteristics | 2026-09-16 |
| `nasa-moon-factsheet` | Lunar physical/orbital data | 2026-09-16 |
| `nasa-solar-system-exploration` | Moon counts, discovery chronologies | 2026-09-16 |
| `nasa-cassini`, `esa-huygens` | Saturn-system mission history | 2026-09-16 |
| `nasa-voyager` | Outer-planet encounter history | 2026-09-16 |
| `nasa-mars-missions` | Mars missions and water evidence | 2026-09-16 |
| `usgs-astrogeology` | Feature names/coordinates | 2026-09-16 |
| … | (full list in `src/data/sources.ts`) | |

**Policy:** institutional sources only (NASA, NASA/JPL, ESA, USGS, IAU). No
blogs, no wikis as primary citations. Every dataset entry and every event
lists its `sourceIds`; the integrity tests fail the build if a citation
dangles.

## Moon counts and natural satellite census

Confirmed-satellite tallies change as new telescopic surveys report discoveries.
Helios incorporates the authoritative August 2026 census: **461 natural satellites**
(456 planetary moons + 5 Pluto satellites):

- **Earth:** 1 (Moon)
- **Mars:** 2 (Phobos, Deimos)
- **Jupiter:** 115 (4 major, 4 regular, 107 irregular)
- **Saturn:** 293 (7 major, 10 regular, 276 irregular)
- **Uranus:** 29 (5 major, 13 regular, 11 irregular)
- **Neptune:** 16 (1 major, 7 regular, 8 irregular)
- **Pluto:** 5 (1 major, 4 regular, 0 irregular)

**Fidelity Tiers:**
- **Tier 1 (Major Moons — 21 bodies):** Fully textured 3D bodies with synchronous tidal locking and surface features.
- **Tier 2 (Regular Satellites — 38 bodies):** Prograde inner satellites with catalogued orbital families.
- **Tier 3 (Irregular Satellites — 402 bodies):** Distant retrograde/prograde captured planetesimals.

**Sparse Satellite Unknown-Value Policy:** Unobserved physical properties (such as mass,
gravity, density, or temperature for small irregular moons) are never populated with
fabricated constants; they are set to `undefined` and rendered as unknown in the UI.

## Which visual dimensions are exaggerated

In **Presentation** (default) mode:

- Planet radii are log-compressed (Mercury 0.16 scene units vs Jupiter 1.28 —
  true ratio is ~1:28).
- Orbital radii are compressed so Neptune fits (49 vs 6 scene units; true
  ratio ~82:1).
- Moon orbital distances use log compression relative to the parent radius;
  real distances would put Iapetus far off-screen.
- The asteroid belt is a stylised visual band, not a mass-faithful
  distribution.

**True size** mode uses real radius ratios (Sun capped at ~15× Earth to stay
in frame). **True distance** mode uses real AU spacing. The active mode is
always labelled in the HUD.

## Simulation honesty & ephemeris model

- Planetary and dwarf planetary trajectories follow **analytical Keplerian elliptical orbits**
  derived from Standish (1992) J2000 secular rates, solving Kepler's transcendental equation
  via Newton-Raphson iteration.
- **Epoch Date Control:** Users can select any calendar date in the supported domain
  **1800-01-01 to 2050-12-31 AD** ($d \in [-73048.5, +18627.0]$ days from J2000.0). Positions
  reflect genuine heliocentric ephemeris coordinates.
- **Domain Boundaries:** Dates outside the 250-year calibrated window are rejected by the
  parser and clamped during simulation playback to prevent unmodeled secular divergence.
- Retrograde rotations and orbital inclinations are mathematically preserved (Venus, Uranus, Triton,
  and retrograde irregular moons).

## Event sourcing

Historical entries in `src/data/events/**` carry: exact date where known
(`date`) or year (`year`), category (`discovery`, `mission`, `impact`,
`geological`, …), a summary, a significance statement, the mission/observer,
and source ids. Events are only included when a cited institutional source
backs them; disputed claims (e.g. Venus phosphine) are either excluded or
explicitly framed as open questions.

## Correcting data

Found an error? Open an issue with the
[data-correction template](../.github/ISSUE_TEMPLATE/data-correction.md)
citing an institutional source. Fixes should update the dataset entry, the
`retrieved` date, and — where relevant — the source registry.
