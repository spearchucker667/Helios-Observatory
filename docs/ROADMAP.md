# Roadmap

## Shipped (Current Release)

- **21 Tier-1 Major Moons** as first-class selectable/renderable bodies (including Charon with New Horizons data).
- **Comprehensive Natural Satellite Catalogue** (461 total moons: 21 major, 38 regular, 402 irregular) with IAU MPC & NASA/JPL provenance.
- **Analytical J2000 Keplerian Ephemeris Engine** with 3D elliptical orbits and continuous 1800–2050 AD temporal propagation.
- **Epoch-Based Date Control & Presets** (calendar date stepping, J2000.0, Apollo 11, Voyager 2, New Horizons).
- **Interactive 3D Distance Measurement Calipers** with real-time Euclidean distance (AU, km) and light-travel time.
- **Deep-Space Continuum**: Logarithmic coordinate mapping spanning 0 to 100,000 AU, rendering the Kuiper Belt and outer Oort Cloud.
- **Dwarf Planet Architecture**: First-class support for Ceres and Pluto.
- **Shareable Deep Links**: Exact camera target, moon hierarchy validation, and epoch date serialization in URLs.
- **Interactive 3D Surface Feature Markers** on rotating planetary and lunar globes (lat/lon anchored pins).
- **Scalable Vector Asset Suite** and automated manifest validation (`scripts/validate-assets.mjs`).
- **Interactive Astrophysical Sandbox (`/sandbox`)**: Mutable numerical experimentation environment with isolated N-body physics engine.
- **Velocity Verlet (Leapfrog) Symplectic Integrator**: Second-order symplectic time integration conserving mechanical energy ($|\Delta E/E_0| < 10^{-5}$) and phase-space volume with zero secular momentum drift.
- **Strict SI Dimensional Units**: Physical simulation operating exclusively in SI meters, seconds, and kilograms.
- **Barycentric Center-of-Mass Frame**: Automated barycentric coordinate and momentum zeroing.
- **Decoupled Timestep Scheduler**: Frame-rate independent substepping maintaining numerical stability during high-speed time warp.
- **Dedicated Web Worker Pipeline**: Background physics worker streaming interpolated state vectors to React Three Fiber rendering layer.
- **Scenario Persistence & Deterministic Replay**: Versioned JSON scenario schema, local IndexedDB persistence, and bit-identical deterministic command replay.
- **Full Quality & Test Gates**: Automated `node:test` suites with an assertion-integrity guard, zero ESLint warnings (`--max-warnings=0`), strict TypeScript checking, hosted `Sandbox Browser Acceptance` against the production build, and headless Playwright production browser smoke/interaction QA. CI is the single source of truth for test counts.

## Near Term

1. **Screenshot / Clean Capture Mode** — hide UI overlay and produce clean high-resolution canvas captures.
2. **HIGH-Texture Memory Eviction** — dynamically free GPU inspection textures after inactive timeout.
3. **Orbital Precession & Osculating Elements** — visualize nodal and apsidal precession effects on outer irregular orbits over multi-decade scales.

## Mid Term

4. **Curated Guided Tours** — automated sequence paths (Inner Terrestrial Worlds, Galilean Moons, Voyager's Grand Tour) driving camera transitions.
5. **Historical Spacecraft Trajectories** — render real mission flight paths (Voyager 1 & 2, Pioneer 10 & 11, Cassini, New Horizons, Juno) from SPICE trajectory data.
6. **Solar & Lunar Eclipse Cones** — accurate geometric visualization of umbra and penumbra shadow cones during syzygy alignments.

## Long Term / Speculative

7. **Internationalization (i18n)** — translate prose and educational content into additional languages.
8. **Planetary Seismology & Magnetic Field Lines** — educational dipole field visualizations for Earth, Jupiter, and Saturn.

## Explicitly Out of Scope

- Real-time sky positions / telescope pointing service
- Photorealistic licensed raster textures (provenance and licensing costs outweigh procedural benefits)
- Multiplayer, user accounts, or cloud data persistence (remains 100% client-side and privacy-preserving)
