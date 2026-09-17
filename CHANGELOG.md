# Changelog

All notable changes to Helios Observatory are documented here. Format based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); the project does
not yet use versioned releases, so entries are dated.

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
  Runs N-body numerical integration on an isolated background thread, maintaining 60 FPS rendering and smooth camera transitions on the main thread.
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
