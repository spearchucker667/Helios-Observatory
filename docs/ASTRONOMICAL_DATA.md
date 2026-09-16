# Astronomical Data

This document explains where Helios' numbers come from, how fresh they are,
and which parts of the visualisation are **not** science.

## The three registers

Every quantity in Helios belongs to exactly one of:

| Register | Meaning | Lives in |
| --- | --- | --- |
| **Scientific data** | Canonical, source-cited astronomy | `src/data/**` (`physical`, `orbit`, `rotation`, `temperature`, …) |
| **Visualization scale** | Presentation compromises that make the system watchable | `src/lib/scene-scale.ts` |
| **Simulation approximation** | Circular-orbit kinematics with correct periods/inclinations | `bodies.tsx` position update |

The UI distinguishes these explicitly: the footer shows the active scale
mode ("Presentation view — not to scale", "True size", "True distance") and
the Orbit tab notes that positions are educational approximations.

## Canonical sources

All planetary figures come from the **NASA GSFC planetary fact sheets**;
moon counts and mission history from **NASA/JPL Solar System Exploration**
pages; surface-feature names from the **USGS Gazetteer of Planetary
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

## Moon counts are a living quantity

Confirmed-satellite tallies change as observations accumulate (Jupiter went
from 79 → 95 and Saturn 82 → 146 within a few years). Helios treats them as
dated data:

- `moonSystem.confirmedCount` carries the number **and** the tally date is
  recorded in the note field (e.g. "per NASA/JPL, 2023, retrieved
  2026-09-16").
- The detail panel says "confirmed" and links the source.
- Counts are never hardcoded in UI copy — they render from data.

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

## Simulation honesty

- Orbits are **circular** with correct periods, inclinations, and (data-
  recorded) eccentricities. Eccentricity and orientation parameters are not
  used to compute positions.
- There is **no epoch**: `simClock` starts at 0 and advances at the chosen
  pace. The UI shows "Y0 · D1" style sim time, never calendar dates, and
  never claims "current positions".
- Retrograde rotation/orbit directions are honoured (Venus, Uranus, Triton).

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
