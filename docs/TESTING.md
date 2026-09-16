# Testing

## Test commands

```bash
npm test   # everything below (node:test)
```

## Suites

### 1. Astronomical data integrity — `src/data/data-validate.test.ts`

The guardian of curated primary bodies. Asserts:

- `validateData()` reports **zero errors** (invariant checker in
  `src/data/validate.ts`)
- unique body ids across all 32 curated primary bodies (Sun, 8 planets, 2 dwarf planets, 21 major moons)
- exactly the 21 Tier-1 major moons, selectable
- moons reference valid parents; planets and dwarf planets reference `"sun"`
- positive radii/gravities/densities; non-zero rotation periods
- every source citation (bodies, events, missions) resolves in the registry
- unique event ids; every event references ≥ 1 known body
- mission body references resolve
- `moonSystem.confirmedCount` ≥ rendered moons for parents with moons
- temperatures physically plausible

### 2. Natural Satellite Catalogue — `src/data/satellites/catalogue.test.ts`

Verifies the comprehensive 461-moon institutional catalogue:

- exactly 461 total satellites (456 planetary + 5 Pluto)
- exact fidelity tier distribution: 21 Major, 38 Regular, 402 Irregular
- parent body reference integrity and zero duplicated IDs
- positive orbital semi-major axes ($a > 0$) and periods ($P > 0$)
- valid eccentricities ($0 \le e < 1$)
- scientific honesty: verifies sparse/irregular moons do not manufacture placeholder constants

### 3. J2000 Ephemeris Engine — `src/lib/ephemeris.test.ts`

Verifies analytical celestial mechanics:

- exact J2000.0 epoch conversion ($JD 2451545.0 \to d = 0$)
- Newton-Raphson Kepler equation convergence ($\Delta E < 10^{-7}$)
- temporal domain boundary enforcement (1800-01-01 to 2050-12-31)
- deep-link date parameter parsing and rejection of out-of-domain epochs
- heliocentric Cartesian AU vector and distance calculations
- multi-epoch reference fixtures for Earth, Mars, and Jupiter (1950, 2000, 2025)

### 4. Distance Caliper & Coordinate Scales — `src/lib/distance.test.ts`, `src/lib/deep-space-scale.test.ts`

- physical speed of light ($c = 299,792.458\text{ km/s}$) and astronomical unit conversion
- pairwise distance symmetry and Moon-Earth / Earth-Sun distances
- logarithmic coordinate continuum continuity from planetary edge (30 AU) to outer Oort Cloud (100,000 AU)

### 5. Formatting — `src/lib/format.test.ts`

Unit-precision tests for every formatter: diameter (metric/Earth), distance
(AU/km/M-notation), gravity (g/m/s²), day length (h m, retrograde sign),
year length, mass, temperature (°C/°F), eccentricity.

### 6. Platform scripts — `scripts/*.test.mjs`

Comprehensive suites for the build/preview/smoke tooling (path guards, verdict
parsing, PWA injection, auth invariants, and asset validation).

## Browser smoke test

```bash
node scripts/browser-smoke.mjs                       # http://127.0.0.1:8080/
node scripts/browser-smoke.mjs http://127.0.0.1:8081/ screenshots/built.png
```

One run produces a JSON verdict for **desktop (1280×800)** and **mobile
(390×844)**: HTTP status, title, canvas presence, body-text sample, console
errors, page errors, horizontal overflow, plus screenshot paths. Non-zero
exit on any failure. Screenshots must stay inside the project
(`screenshots/`).

## Manual QA matrix

| Viewport | Check |
| --- | --- |
| Desktop wide (1440+) | panel breathing room, no label collisions |
| Desktop (1280×800) | default smoke target |
| Tablet portrait (834×1112) | HUD switches to mobile layout cleanly |
| Tablet landscape | desktop layout holds |
| Phone portrait (390×844) | bottom sheet, chip row, no overflow |
| Phone landscape | sheet max-height respects 46dvh |

Interaction checks (via `agent-browser`):

- select each planet → camera approaches, tabs populate
- expand moons → click a moon → breadcrumb + focus + Events tab
- `Backspace` returns to parent; `Esc` deselects
- `⌘K` → type → Enter navigates
- Compare: pick 4, table correct
- Units cycle changes formatted values everywhere
- Scale modes: True size / True distance relayout orbits and show the
  honesty label
- `M` moon modes; `L`/`O` toggles; `Space` pause; `R` reset
- Reduced-motion emulation: transitions snap

## Conventions

- Data tests are pure `node:test` + `assert/strict` — no DOM, fast.
- Imports inside `src/data` and `src/lib/format.test.ts` are relative with
  explicit `.ts` (type-stripping runner, no bundler).
- No test may be skipped/weakend to force a pass — fix the data or code.
