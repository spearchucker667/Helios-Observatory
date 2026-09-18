# Testing Guide & Verification Suites

Helios Observatory maintains a strict zero-tolerance testing policy. All tests are automated via the native Node.js test runner (`node:test`) and executed cleanly without external mocking frameworks.

---

## 1. Test Commands

```bash
# Run the assertion-integrity guard, then the complete test suite.
# Test counts are reported by CI and the guard output; this document never
# hardcodes them, because hand-maintained counts drift.
npm test

# Reject trivially-true or conditional-only assertions in the sandbox suites
node scripts/check-test-integrity.mjs

# Measure the sandbox performance matrix (steps/s, ms/step, achieved warp)
npm run benchmark

# Run strict TypeScript typecheck
npm run typecheck

# Run zero-warning linter
npm run lint

# Run browser sandbox QA suite
node scripts/browser-sandbox.mjs http://127.0.0.1:8081/sandbox

# Check documentation integrity and link consistency
node scripts/check-doc-consistency.mjs

# Validate vector assets and JSON manifests
node scripts/validate-assets.mjs
```

---

## 2. Test Suites Overview

### 2.1 Astronomical Data Integrity — `src/data/data-validate.test.ts`
Guarantees canonical data invariants across all primary celestial bodies:
- `validateData()` returns **zero errors**.
- Unique body IDs across all 32 primary bodies (Sun, 8 planets, 2 dwarf planets, 21 major moons).
- Exactly 21 Tier-1 major moons mapped with parent planet relationships.
- Positive radii, masses, gravities, and escape velocities; non-zero rotation periods.
- Every source citation across bodies, events, and missions resolves in `src/data/sources.ts`.
- Every mission and event references existing registered bodies.
- `confirmedCount` matches or exceeds catalogued major moons.

### 2.2 Natural Satellite Catalogue — `src/data/satellites/catalogue.test.ts`
Validates the complete 461-moon institutional baseline (August 2026 IAU MPC & NASA/JPL):
- Exactly 461 total satellites (456 planetary + 5 Pluto).
- Exact fidelity tier distribution: 21 Major, 38 Regular, 402 Irregular.
- Parent body reference integrity and zero duplicate IDs.
- Positive orbital semi-major axes ($a > 0$) and periods ($P > 0$).
- Valid eccentricities ($0 \le e < 1$).
- Scientific honesty: verifies sparse/irregular moons do not manufacture placeholder constants.

### 2.3 J2000 Ephemeris Engine — `src/lib/ephemeris.test.ts`
Verifies analytical Keplerian celestial mechanics:
- Exact J2000.0 epoch conversion ($JD 2451545.0 \to d = 0$).
- Newton-Raphson Kepler equation convergence ($\Delta E < 10^{-7}$).
- Temporal domain boundary enforcement (1800-01-01 through 2050-12-31).
- Deep-link date parameter parsing and rejection of out-of-domain epochs.
- Heliocentric Cartesian AU vectors and scalar distances.
- Multi-epoch reference fixtures for Earth, Mars, Jupiter, Ceres, and Pluto (1950, 2000, 2025).
- Distinct provenance verification (Standish 1992, JPL SBDB Solution #40) and accuracy tolerances.
- Velocity calculation agreement with finite-difference numerical derivatives.

### 2.4 Distance Caliper & Scale Continua — `src/lib/distance.test.ts`, `src/lib/deep-space-scale.test.ts`
- Physical speed of light ($c = 299,792.458\text{ km/s}$) and astronomical unit conversion.
- Pairwise distance symmetry ($d(A, B) = d(B, A)$) and self-distance ($d(A, A) = 0$).
- Moon-Earth and Earth-Sun physical distance checks.
- Piecewise-logarithmic coordinate continuum continuity from planetary edge (30 AU) through Kuiper Belt (30–55 AU) to outer Oort Cloud (100,000 AU).

### 2.5 Formatting Systems — `src/lib/format.test.ts`
Unit-precision tests for all formatters: diameter (metric/Earth), distance (AU/km/light-time), gravity ($g$/$\text{m/s}^2$), day length (hours/minutes, retrograde sign), year length, mass ($M_\oplus$/$\text{kg}$), temperature ($\text{°C}$/$\text{°F}$), and eccentricity.

### 2.6 Canonical Simulation Isolation — `src/simulation/tests/isolation.test.ts`
- **Data Immutability:** Asserts that spawning simulation bodies never mutates canonical records in `src/data/**`.
- **Constant Parity:** Asserts that simulation physical constants ($G$, $c$, $\text{AU}$) match canonical definitions without numerical drift.

### 2.7 Simulation Initialization & Barycentric Shift — `src/simulation/tests/initialization.test.ts`
- Ephemeris-to-state-vector Cartesian conversion in strict SI meters and $\text{m/s}$.
- Center-of-mass barycentric momentum zeroing ($\sum m_i \mathbf{v}_i / M_{\text{tot}} < 10^{-5} \text{ m/s}$).
- Missing-mass objects correctly marked with the `isTracer` flag.

### 2.8 Symplectic Energy & Momentum Conservation — `src/simulation/tests/energy.test.ts`
- Tests the Velocity Verlet symplectic integrator over 1,000 hourly steps.
- Asserts mechanical energy conservation ($|\Delta E / E_0| < 10^{-5}$).
- Asserts zero total linear momentum drift ($\Delta \mathbf{P} / M_{\text{tot}} < 10^{-5} \text{ m/s}$).

### 2.9 Orbital Stability & Tracer Mechanics — `src/simulation/tests/integrator.test.ts`
- Verifies Earth-Sun orbital stability over a full 1-year orbit (365 daily steps), confirming distance remains bounded ($0.95 \text{ AU} \le r \le 1.05 \text{ AU}$).
- Verifies tracer particles move under gravitational influence but exert zero gravitational perturbation on massive primary bodies.

### 2.10 Timestep Scheduler & Determinism — `src/simulation/tests/scheduler.test.ts`
- Bit-identical execution under identical command streams.
- Pause/resume state retention without time leakage.
- Time-acceleration decoupling: verifying that accelerating playback rate does not alter integration timestep $\Delta t$.
- Single-step advancement precision.

### 2.11 Worker Communication Protocol — `src/simulation/tests/worker.test.ts`
- Valid command acceptance and malformed payload rejection.
- Worker initialization and state snapshot cadence.
- Checkpoint and reset request handling.
- Immutability of main-thread state copies.

### 2.12 Object Editor, Provenance & Coordinate Roundtrip — `src/simulation/tests/editor.test.ts`
- SI to display-unit conversion and back for mass, radius, position and velocity.
- Elliptic **and** hyperbolic Cartesian to Keplerian roundtrips (hyperbolic conics stay finite).
- Editor validation: NaN/Infinity, negative mass, zero radius for massive bodies.
- Editor commands move provenance from canonical to custom, and leave unrelated provenance untouched.
- Black-hole mass/horizon invariants ($r_s = 2GM/c^2$ stays consistent with the mass).
- Canonical registry isolation after a production editor command.

### 2.13 Scenario Persistence & Replay — `src/simulation/tests/scenario.test.ts`
- Save/load and import/export serialization equality.
- Rejection of malformed JSON, duplicate body IDs, and future schema versions.
- Replay reproduces command timestamps and stops at the stored final tick.

### 2.14 Commands, Mutation Guard & Replay — `src/simulation/tests/commands.test.ts`, `src/simulation/tests/replay.test.ts`
- Duplicate IDs are rejected instead of silently replacing a body.
- The massive-body and total-body caps hold through **every** mutation path.
- Every physical edit updates the affected provenance fields.
- Replay of tick-stamped logs separated by thousands of ticks reaches the identical final state.

### 2.15 Collision & Tidal Physics — `src/simulation/tests/collision.test.ts`
- Linear momentum conservation across inelastic mergers ($\mathbf{P}_{\text{after}} = \mathbf{P}_{\text{before}}$).
- Total mass conservation ($M_{\text{merged}} = M_A + M_B$).
- Swept (continuous) detection: high-speed bodies cannot tunnel through a target.
- Roche-limit crossing fires **outside** physical contact, and zero-mass tracers report `unsupported` diagnostics rather than a synthesized mass.

### 2.16 Compact Objects & Relativistic Limits — `src/simulation/tests/compact.test.ts`
- Exact Schwarzschild radius evaluation ($r_s = 2GM/c^2$).
- Inelastic event horizon capture boundary verification.
- Mass accumulation upon capture.
- Mercury precession through the pairwise 1PN path, plus explicit strong-field limitations.
- Magnetic dipole scaling ($r^{-3}$) and tidal-gradient scaling ($r^{-3}$) as separate, unconditional assertions.

### 2.17 Environment, Events, Worker & Store — `environment.test.ts`, `events.test.ts`, `worker.test.ts`, `sandbox-store.test.ts`, `ephemeris-state-vector.test.ts`
- Irradiance inverse-square law, multi-star summed flux, albedo/emissivity boundaries.
- Equilibrium temperature provenance: a missing emissivity yields `estimated` (with the assumption recorded), never a silent default.
- Event detectors: close encounter, Roche crossing, escape, ejection, accuracy warning.
- Worker trust boundary: malformed/NaN/Infinity payloads rejected before touching the world; a throwing step halts cleanly.
- Store semantics: undo restores an exact checkpoint, single-step advances exactly one dt and stays paused.
- Ephemeris state vectors are `calculated` (the orbital element source is canonical) and unsupported epochs are rejected.

### 2.18 Performance Envelope — `src/simulation/tests/performance.test.ts`
- The 1024-body envelope (256 massive + 768 tracers) is admitted and stays finite.
- 257 massive bodies are rejected at construction.
- Conservative throughput floors that catch algorithmic regressions without being timing-flaky.

### 2.19 Test Integrity Guard — `scripts/check-test-integrity.mjs`
- Rejects trivially-true assertions (`assert.ok(true)`), assertion-free tests, tests whose assertions are all conditional, and skipped/todo markers.
- Runs first inside `npm test` and as its own hosted CI job.

### 2.20 Platform Scripts & Tooling — `scripts/*.test.mjs`
Comprehensive test suites verifying:
- Asset manifest integrity and vector SVG schemas.
- Browser smoke test JSON output parsing.
- Platform path guards and preview proxy bindings.
- PWA extension injection and offline fallback invariants.

---

## 3. Headless Browser Smoke & Interaction QA

Automated Playwright browser tests execute on the compiled production build:

```bash
# Build and preview
npm run build
npm run preview:restart

# Execute smoke test across Desktop (1280x800) and Mobile (390x844)
node scripts/browser-smoke.mjs http://127.0.0.1:8081/ screenshots/built.png

# Execute interactive UI assertion suite
node scripts/browser-interaction.mjs http://127.0.0.1:8081/

# Execute the sandbox acceptance suite (fails on any unasserted step)
node scripts/browser-sandbox.mjs http://127.0.0.1:8081/sandbox
```

`scripts/browser-sandbox.mjs` runs as the hosted CI job **Sandbox Browser
Acceptance**. It drives the production build and asserts, among others:
initial paused state matches the worker, play/pause/step clock semantics, exact
single-`dt` stepping, provenance transitions on edits, exact undo and reset
world equality, authentic command chronology in saved scenarios,
reload-and-replay equality, export then import equality in a fresh profile,
canonical data deep equality after a full session, the documented keyboard
shortcuts, mobile layout, and reduced-motion suppression. The sandbox exposes a
read-only state bridge only when a page is opened with `?qa=1`; nothing is
exposed in normal use.

### Smoke Test Invariants
- HTTP 200 status on both desktop and mobile viewports.
- WebGL `<canvas>` presence with active animation loops.
- Zero uncaught browser console errors, warnings, or hydration mismatches.
- Zero horizontal overflow on mobile viewports ($390\text{ px}$).
- Screenshots saved exclusively to `screenshots/`.

---

## 4. Manual QA Matrix

| Viewport | Dimension | Critical Checks |
| :--- | :--- | :--- |
| **Desktop Wide** | 1920×1080 | Full panel visibility, caliper midpoint HUD, zero 3D text collision. |
| **Desktop Standard** | 1280×800 | Default smoke target; sidebar navigation, command palette, inspection tabs. |
| **Tablet Portrait** | 834×1112 | HUD collapses into mobile bottom sheet; touch target spacing $\ge 44\text{ px}$. |
| **Phone Portrait** | 390×844 | Draggable bottom sheet ($46\text{ dvh}$ max), horizontal world carousel, no horizontal scroll. |

---

## 5. Testing Invariants & Philosophy

1. **Evidence Before Claims:** No test may be commented out, weakened, or bypassed to force a release gate to pass.
2. **Deterministic Physics:** The physics step consumes **no** pseudo-random source, so no seed is required or persisted; benchmarks use a local Mulberry32 generator purely to build reproducible initial conditions, and simulation tests use fixed analytical epochs.
3. **Institutional Provenance:** Every celestial constant asserted in test suites must link to NASA, JPL, or IAU peer-reviewed literature.
