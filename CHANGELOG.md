# Changelog

All notable changes to Helios are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project does
not yet use versioned releases, so entries are dated.

## [Unreleased] — 2026-09-16 Production expansion

### Added

- **Astronomical data layer** (`src/data/`): typed contracts
  (`types.ts`), 9 body datasets, 20 moon datasets, 60+ sourced historical
  events, 15-mission registry, central source registry
  (`sources.ts`), invariant validator (`validate.ts`).
- **Moons as first-class bodies**: Moon, Phobos, Deimos, Io, Europa,
  Ganymede, Callisto, Titan, Enceladus, Rhea, Iapetus, Dione, Tethys,
  Mimas, Titania, Oberon, Ariel, Umbriel, Miranda, Triton — rendered with
  orbits, tidal locking, selection, labels, and full detail panels.
- **Ring systems** for Jupiter, Saturn, Uranus, Neptune — single
  data-driven generator; Cassini Division / Encke Gap / epsilon ring from
  the data layer.
- **Tiered procedural textures**: LOW (1024×512) + HIGH inspection tier
  (2048×1024, body-specific: Great Red Spot, Saturn hexagon, Olympus Mons,
  Caloris basin, Europa lineae, Enceladus tiger stripes, Iapetus
  hemispheres) with lazy generation and cache disposal.
- **Tabbed detail views** (Overview / Physical / Orbit / Surface / Moons /
  Events) with progressive disclosure, breadcrumb hierarchy, and source
  citations per section.
- **Event timeline** per body — dated, categorised, significance-noted,
  fully sourced; cross-links to related bodies.
- **Search palette** (⌘K, cmdk) across bodies, surface features, and
  events.
- **Compare mode** — 2–4 bodies across nine metrics in a semantic table.
- **Unit systems** — km / AU / Earth-relative, centralised formatting
  (`src/lib/format.ts`).
- **Scale modes** — Presentation / True size / True distance with an
  always-visible honesty label; science↔scene mapping isolated in
  `src/lib/scene-scale.ts`.
- **Camera hierarchy** — exact moon tracking, parent navigation
  (Backspace), reduced-motion snapping, scale-aware framing.
- **Moon modes** — auto / always / hidden (`M`).
- **Documentation set**: README, CONTRIBUTING, SECURITY, CHANGELOG, and
  docs/ (architecture, astronomical data, asset pipeline, controls,
  development, performance, accessibility, testing, roadmap, screenshots).
- **GitHub templates**: bug report, data correction, rendering issue,
  feature request, PR template.
- **Tests**: data-integrity suite (13 assertions groups) + formatting
  suite (8), wired into `npm test`.

### Changed

- Planet data migrated from monolithic `src/lib/planets.ts` to structured
  per-body datasets; legacy module now re-exports shared constants
  (YEAR_SECONDS, clock/pace formatting) for the HUD.
- Scene rendering generalised: one `Planet` component driven by data
  records (was hard-coded per-body JSX).
- Venus atmosphere now reveals the radar-surface mode at inspection range.
- Selection expanded from `BodyId` union to registry-based string ids.

### Fixed

- Pre-existing `tsc` failure in `solar-app.tsx` (lazy import type union).
- Pre-existing lint error (empty catch) in `src/lib/app-data/client.server.ts`
  and unused-directive warning in `use-current-user.ts`.
- Camera target lag when tracking fast-orbiting moons (exact follow).
- Scene labels no longer overlay the detail panel (z-index layering).
- Mobile: header overlap, bottom-sheet/footer collision, tab overflow.

### Honest limitations

- Orbits remain circular approximations (correct periods/inclinations;
  no epoch ephemeris) — UI discloses this.
- Tier-3 irregular moons are catalogued, not rendered.
- No calendar-date positions: the sim clock is educational.

## [Initial] — 2026-09-16

- Sun + 8 planets, circular-orbit simulation, accelerated clock
- Procedural planet textures, Earth clouds, Saturn rings
- Selection/approach camera, orbit trails, labels, pace controls
- Responsive desktop/mobile HUD, basic stats cards
