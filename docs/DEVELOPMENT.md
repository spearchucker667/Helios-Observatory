# Development

## Requirements

- **Node 22+** (the project pins engines implicitly via the toolchain)
- No database, no auth, no env vars needed for local development — Helios is
  fully client-side

## Setup

```bash
npm install
npm run dev
```

The dev server binds `0.0.0.0:8080` (a preview proxy watches that port).

## Command reference

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on `:8080` |
| `npm run typecheck` | `tsc --noEmit` — strict, zero tolerance |
| `npm run lint` | ESLint (flat config) — zero warnings expected |
| `npm test` | Assertion-integrity guard, then `node:test` suites (data integrity, ephemeris, calipers, sandbox physics, platform scripts). CI reports the current counts. |
| `npm run build` | Production build (+ no-op migration step for platform parity) |
| `npm run benchmark` | Sandbox benchmark matrix: steps/s, ms/step, snapshot cost and achieved warp per body count |
| `npm run preview:restart` | Serve the built output on `:8081` (QA) |
| `npm run format` | Prettier write |

## Validation gates

All four gates must pass before any change lands:

```bash
npm run typecheck && npm run lint && npm test && npm run build
node scripts/check-doc-consistency.mjs
node scripts/validate-assets.mjs
```

Tests include the **astronomical data integrity suite** (`src/data/data-validate.test.ts`), the **satellite catalogue suite** (`src/data/satellites/catalogue.test.ts`), the **ephemeris and distance calipers suites** (`src/lib/*.test.ts`), and the **symplectic N-body physics engine suites** (`src/simulation/tests/*.test.ts`). If you modify data records, mathematical solvers, or numerical integrators, these suites are the authoritative reviewers.

## Browser QA

```bash
node scripts/browser-smoke.mjs   # desktop + mobile verdict JSON
```

The smoke script loads the app in headless Chromium at 1280×800 and
390×844, checks for console/page errors, horizontal overflow, canvas
presence, and writes screenshots + verdict JSON under `screenshots/`.

For interactive testing use the `agent-browser` CLI (snapshot/click/type) —
see the workflow in `CONTRIBUTING.md`.

### Built-output verification

Dev-only rendering can hide bundling mistakes:

```bash
npm run build && npm run preview:restart
node scripts/browser-smoke.mjs http://127.0.0.1:8081/ screenshots/built.png
```

## Workflow conventions

- **Science → scene separation**: never put a scene constant in `src/data`,
  never put a scientific figure in a component. Pass through
  `scene-scale.ts` / `format.ts` instead.
- **Formatting**: display strings only from `format.ts`.
- **Textures**: new body structure goes into `HIGH_FACTORIES` (inspection)
  and/or `LOW_FACTORIES` (system view); keep both consistent.
- **Ring systems**: parameterise via the data layer's `RingSystem`, not
  per-planet scene code.
- **Reduced motion**: any new animated transition must respect
  `prefers-reduced-motion` (see `camera-rig.tsx` for the pattern).

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| Blank canvas, no errors | Check WebGL 2 support; the fallback shows a static gradient |
| `tsc` errors in `src/data/**` after adding files | Import paths inside `src/data` are **relative with `.ts`** (the node:test runner strips types without bundler resolution) |
| Smoke test can't reach `:8080` | Dev server down — `npm run dev` |
| Smoke test rejects output path | Screenshots must stay inside the project; pass a `screenshots/*.png` path |
| Moon labels over the panel | Fixed via `zIndexRange` — keep scene labels ≤ z-index 9, panels are 10+ |
