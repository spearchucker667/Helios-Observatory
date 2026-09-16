# Testing

## Test commands

```bash
npm test   # everything below (node:test)
```

## Suites

### 1. Astronomical data integrity — `src/data/data-validate.test.ts`

The guardian of the catalogue. Asserts:

- `validateData()` reports **zero errors** (invariant checker in
  `src/data/validate.ts`)
- unique body ids across all 29 bodies
- exactly the 20 Tier-1 moons, selectable
- moons reference valid **planet** parents; planets reference `"sun"`
- positive radii/gravities/densities; non-zero rotation periods
- every source citation (bodies, events, missions) resolves in the registry
- unique event ids; every event references ≥ 1 known body
- mission body references resolve
- `moonSystem.confirmedCount` ≥ rendered moons for parents with moons
- temperatures physically plausible

Add a dataset entry → this suite reviews it.

### 2. Formatting — `src/lib/format.test.ts`

Unit-precision tests for every formatter: diameter (metric/Earth), distance
(AU/km/M-notation), gravity (g/m/s²), day length (h m, retrograde sign),
year length, mass, temperature (°C/°F), eccentricity.

### 3. Platform scripts — `scripts/*.test.mjs`

Existing suites for the build/preview/smoke tooling (path guards, verdict
parsing, PWA injection).

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
