# Changelog

All notable changes to Helios Observatory are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project does
not yet use versioned releases, so entries are dated.

## [Unreleased] — 2026-09-17 Sandbox Post-Audit Hardening

### Fixed

- **Authentic scenario chronology** (`src/simulation/state/sandbox-store.ts`, `src/simulation/engine/commands.ts`): scenarios now persist the worker's real command log — each command stamped with the tick and simulated time at which it executed — plus an explicit `finalState`, replacing an index-derived chronology that could rewrite a day-45 action as t=1800 s.
- **Deterministic scenario loading** (`src/simulation/engine/replay.ts`, `src/simulation/worker/simulation-host.ts`): loading replays through the engine to the stored final tick instead of dispatching every command at t=0, so the time evolution between commands survives.
- **Provenance-aware editing** (`src/simulation/engine/commands.ts`, `src/simulation/state/edit-commands.ts`): the unrestricted `update_body: Partial<SimulationBody>` escape hatch is gone. Each editable concept has a validated command that rewrites exactly the provenance it invalidates, so an edited canonical value can no longer keep claiming `canonical`.
- **Authoritative playback state** (`src/simulation/engine/timestep.ts`, `src/simulation/worker/simulation-host.ts`): the worker owns playback state (`uninitialized`/`paused`/`running`/`stepping`/`halted`/`replaying`); the UI mirrors it, starts explicitly paused, and single-step is atomic (pause → one step → publish → stay paused).
- **One simulation clock**: the scheduler proposes a work budget and the authoritative clock advances only after each successful world step, so a throwing step can no longer leave the scheduler ahead of the world.
- **Runtime-validated worker boundary** (`src/simulation/worker/worker-schemas.ts`): strict Zod schemas reject malformed, non-finite or out-of-range payloads before they reach the world; physics exceptions halt cleanly with the last good tick instead of continuing on non-finite state.
- **Central world-mutation invariants** (`src/simulation/engine/mutation-guard.ts`): unique ids (no silent replacement), massive/total body caps enforced on every mutation path, finite values, compact-object invariants, and provenance transitions.
- **Swept collision detection and a real tidal pass** (`src/simulation/collisions/`): fast bodies can no longer tunnel through a target, Roche-limit crossing fires outside physical contact, and zero-mass tracers report `unsupported` diagnostics instead of a synthesised mass.
- **Collision resolution hardening** (`src/simulation/collisions/resolve.ts`, `src/simulation/engine/world.ts`, found by `scripts/collision-fuzz.mjs`): tidal debris is never re-shredded (one-generation rule — previously a deep Roche overlap cascaded exponentially to the 1,024-body cap), and each body participates in at most one resolution per step (previously a second stale read silently destroyed a merge's conserved mass and momentum; regressions from 1.8e25 kg to 1.2e25 kg in one step were reproducible).
- **Complete checkpoints** (`src/simulation/engine/snapshot.ts`): checkpoints carry dt, quality, relativity, multiplier, model versions and the command cursor, and restoring one restores the scheduler dt; undo is checkpoint-based temporal undo.
- **Hyperbolic conic handling** (`src/simulation/physics/orbital-elements.ts`): elliptic, parabolic and hyperbolic roundtrips stay finite.
- **Ephemeris provenance** (`src/lib/ephemeris.ts`, `src/simulation/initialization/canonical-adapter.ts`): ephemeris-derived Cartesian states are `calculated` (the element source stays canonical), and canonical initialisation refuses out-of-domain epochs.
- **Test integrity** (`scripts/check-test-integrity.mjs`): the five placeholder editor tests were replaced with real assertions, and a hosted guard now rejects trivially-true, assertion-free, conditional-only and skipped tests.

### Changed

- **1PN labelling and integrator claims** (`src/components/simulation/accuracy-indicator.tsx`, `docs/PHYSICS_ENGINE.md`): the relativistic path is documented as a *pairwise 1PN Schwarzschild-like approximation* (not full Einstein–Infeld–Hoffmann N-body 1PN), and no symplectic guarantee is claimed for the velocity-dependent path.
- **Collision/tidal, environment, event and performance suites added**; render interpolation added between ~30 Hz worker snapshots (visual only).
- **Documentation reconciled with measured evidence**: the Plummer softening claim was removed (no softening exists), frame-rate claims at the 1,024-body envelope were replaced with a measured benchmark matrix (`docs/PERFORMANCE.md`), hand-maintained test counts were removed (CI is the source of truth), and `scripts/check-doc-consistency.mjs` now rejects those contradictions automatically.
- **Shortcuts `I`, `E`, `S`** documented in the README are now implemented and browser-verified; "physical-size" display mode was renamed to "Size emphasis" because it is a compressed presentation scale, not a true proportional radius scale.
- **Hosted CI**: added **Sandbox Browser Acceptance** (runs `scripts/browser-sandbox.mjs` against the production preview), **Simulation Test Integrity**, and **Numerical Reference & Sandbox Physics** jobs.

### Removed

- The unused scenario PRNG seed and the Mulberry32 replay claim: the physics step consumes no pseudo-random source.

---

## [Unreleased] — 2026-09-17 Interactive Astrophysical Sandbox & Symplectic Engine

### Added

- **Second-Order Velocity Verlet (Leapfrog) Symplectic Integrator** (`src/simulation/engine/integrator.ts`):
  Guarantees bounded mechanical energy oscillation ($|\Delta E / E_0| < 10^{-5}$) and phase-space volume conservation without secular orbital decay over simulated centuries.
- **Strict SI Dimensional Unit Foundation** (`src/simulation/domain/units.ts`, `src/simulation/domain/constants.ts`):
  Unified physical modeling in meters ($\text{m}$), seconds ($\text{s}$), and kilograms ($\text{kg}$) referenced to CODATA 2022 and IAU standards.
- **Barycentric Center-of-Mass Frame Invariant** (`src/simulation/initialization/barycentric.ts`):
  Automatically shifts heliocentric state vectors to the system barycentre, zeroing net linear momentum ($\sum m_i \mathbf{v}_i = \mathbf{0}$) to prevent system drift.
- **Canonical Data Adapter & Strict Isolation** (`src/simulation/initialization/canonical-adapter.ts`):
  Deep-clones canonical registry records into mutable simulation bodies, ensuring zero back-propagation to canonical data.
- **Authoritative Web Worker Architecture** (`src/simulation/worker/`):
  Runs N-body numerical integration on an isolated background thread that streams ~30 Hz typed-array snapshots, keeping camera and UI interaction responsive on the main thread regardless of physics throughput.
- **Deterministic Timestep Scheduler** (`src/simulation/engine/timestep.ts`):
  Decouples presentation time-warp factors from integration step $\Delta t$, preventing numerical blowup during high-speed simulation.
- **Tracer Particle Mechanics**:
  Small bodies and test particles feel gravitational pull without exerting back-reaction on primary bodies.
- **Astrophysical Simulation Test Suites** (`src/simulation/tests/`):
  Expanded automated tests from 114 to 154 passing tests across 22 suites, covering canonical isolation, energy conservation, circular orbit stability, collision mechanics, and Schwarzschild horizon capture.
- **Interactive Sandbox Route & UI Suite** (`src/routes/sandbox.tsx`, `src/components/simulation/`):
  Added `/sandbox` route, simulation canvas, transport bar, body inspector, object browser, vector manipulator, and scenario manager.
- **Comprehensive Technical Documentation**:
  Published `docs/PHYSICS_ENGINE.md` and `docs/SIMULATION_SANDBOX.md`, updating `README.md`, `ARCHITECTURE.md`, `TESTING.md`, `USER_GUIDE.md`, and `CONTROLS.md`.

## 2026-09-16 Production expansion & release-readiness pass

### Added

- **Complete Natural Satellite Catalogue (461 Moons)** (`src/data/satellites/`):
  Official August 2026 IAU MPC & NASA/JPL baseline encompassing all 456 planetary moons
  and 5 satellites of Pluto. Features 3-tier classification (21 major, 38 regular,
  402 irregular), dynamical families (Galilean, Inuit, Norse, Gallic, etc.), and
  automated validation suites.
- **Natural Satellite Explorer UI** (`src/components/overlay/detail.tsx`):
  Filter by fidelity tier (All, Major, Regular, Irregular), fuzzy search by name or
  provisional designation, and one-click 3D camera focusing.
- **Analytical J2000 Keplerian Ephemeris Engine** (`src/lib/ephemeris.ts`):
  Replaced concentric circular approximations with true 3D elliptical Keplerian orbits
  solved via Newton-Raphson. Outputs physical heliocentric Cartesian AU vectors and
  supports a continuous temporal interval from 1800 AD through 2050 AD.
- **Epoch-Based Date Control & Presets** (`src/components/overlay/hud.tsx`):
  Calendar date picker (`T` / toolbar button) with date stepping (-1Y, -30D, Today, +30D, +1Y)
  and historical presets (J2000.0, Apollo 11, Voyager 2 Neptune, New Horizons Pluto).
- **Interactive Scientific Distance Measurement Caliper** (`src/lib/measurement.ts`, `src/components/solar/measurement-line.tsx`, `src/components/overlay/measurement-panel.tsx`):
  Real-time 3D Euclidean distance measurement between any two celestial bodies. Computes
  distance in Astronomical Units (AU), kilometers (km), and light travel time ($c = 299,792.458\text{ km/s}$).
  Includes 3D laser caliper line, oriented midpoint HUD, and floating caliper panel (`D` / toolbar button).
- **Deep-Space Continuum & Oort Cloud Model** (`src/lib/deep-space-scale.ts`, `src/components/solar/kuiper-belt.tsx`, `src/components/solar/oort-cloud.tsx`):
  Continuous piecewise-logarithmic scaling mapping 0 to 100,000 AU into stable WebGL camera bounds.
  Renders the classical Kuiper Belt (30–55 AU), toroidal inner Hills Cloud (2,000–20,000 AU),
  and outer isotropic spherical Oort Cloud (~100,000 AU) with scientific disclaimer.
- **Interactive 3D Surface Feature Markers** (`src/components/solar/feature-markers.tsx`):
  3D marker pins positioned at exact latitude/longitude coordinates on rotating planetary
  and lunar globes (Olympus Mons, Valles Marineris, Great Red Spot, Caloris Planitia, etc.).
- **Dwarf Planet Architecture**:
  First-class `dwarf-planet` classification supporting Ceres in the asteroid belt and Pluto (with Charon).
- **Scalable Vector Asset Suite & Manifest** (`public/assets/`):
  Canonical vector branding, iconography, and educational diagrams. Zero embedded raster/base64 compliance
  enforced by `scripts/validate-assets.mjs` and `public/assets/manifest.json`.
- **Documentation Overhaul (22 Documents in `docs/`)**:
  Complete documentation production covering installation, architecture, ephemeris engine,
  satellite catalogue, calipers, deep-space scale, legal, accessibility, and release process.
- **Legal & Governance**:
  Apache-2.0 `LICENSE`, `NOTICE`, `docs/LEGAL.md`, `docs/THIRD_PARTY_NOTICES.md`, and
  Contributor Covenant `CODE_OF_CONDUCT.md`.
- **GitHub Actions Workflows** (`.github/workflows/`):
  Quality CI pipeline with TypeScript typecheck, zero-warning linting, automated test suite,
  and browser-smoke validation, alongside CodeQL and Dependabot.

### Changed

- Updated `package.json` license to `Apache-2.0` and enforced strict zero-warning linting with `--max-warnings=0`.
- Detail sheet share button now generates deep links containing the active epoch date (`formatEpochIso(simClock.days)`).
- Compare dialog now formats all values respecting the active unit system (`km`, `AU`, Earth-relative).
- Natural satellite counts on planet data records derive dynamically from `satelliteCountOf(id)`.
- Charon added to curated moon registry with New Horizons encounter data.

### Fixed

- Fixed Sun shader noise interpolation bug (corrected duplicated `hash(i + vec3(1,1,1))` to `hash(i + vec3(0,1,1))`).
- Fixed deterministic PRNG seeding in `Starfield` and `AsteroidBelt` using Mulberry32.
- Ensured Moon 3D position and orbit line trace the exact same 3D curve in `src/components/solar/moons.tsx`.
- Fixed date parameter parsing in `parseDeepLinkParams` to validate Gregorian interval bounds (1800–2050 AD).
- Fixed all ESLint warnings across the repository.
