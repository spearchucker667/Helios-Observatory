# Implementation Agent Handoff Summary — Interactive Astrophysical Sandbox

The Interactive Astrophysical Sandbox (`/sandbox`) for Helios Observatory is implemented and integrated for the scope documented below. This document states what is verified by a gate (test, assertion, numerical comparison, hosted CI job) and what remains a known limitation; nothing here is claimed as "verified" without one of those. The status was rewritten after an external post-implementation audit found deterministic-replay, provenance and test-integrity defects; §Post-Audit Remediation records what that audit prompted.

---

### System Overview & Invariants
- **Dual-Mode Architectural Isolation:** The canonical Observatory Mode (`/`) and the Interactive Sandbox Mode (`/sandbox`) are strictly isolated. Canonical astronomical reference records under `src/data/**` remain completely immutable and source-backed.
- **Strict SI Dimensionality:** All internal physics computation operates strictly in SI base units (meters, kilograms, seconds, Newtons, Watts). Unit conversions to astronomical units ($\text{AU}$, $M_\odot$, $M_\oplus$, $\text{km/s}$, $\text{m/s}$) occur strictly at the presentation boundary.
- **CODATA 2022 Constants:** Universal gravitation constant $G = 6.67430 \times 10^{-11} \text{ m}^3\text{kg}^{-1}\text{s}^{-2}$, speed of light $c = 299,792,458 \text{ m/s}$, astronomical unit $1\text{ AU} = 149,597,870,700 \text{ m}$.

---

### Phase-by-Phase Completion Status

#### Phase 0: Preflight & Scientific Guardrails
- Implemented deep isolation invariants asserting that simulation operations never modify or contaminate the canonical celestial registry (`src/simulation/tests/isolation.test.ts`).
- Enforced CODATA 2022 physical constant parity across canonical and simulation modules.
- Formulated 5-kind scientific provenance schema (`canonical`, `calculated`, `estimated`, `custom`, `unsupported`).

#### Phase 1: Domain Models & Ephemeris State Vectors
- Created `src/simulation/domain/types.ts` defining `SimulationBody`, vectors, classification, and provenance metadata.
- Built `src/simulation/initialization/canonical-adapter.ts` converting analytical Keplerian ephemerides into Cartesian state vectors $[\mathbf{r}, \mathbf{v}]$ in SI meters and $\text{m/s}$.
- Implemented `src/simulation/initialization/barycentric.ts` transforming state vectors into the system barycenter ($\sum m_i \mathbf{v}_i / M_{\text{tot}} = 0$) to eliminate unphysical coordinate drift.
- Marked non-massive minor bodies as tracer particles (`gravityRole: "tracer"`).

#### Phase 2: Symplectic Newtonian Physics Engine
- Developed exact Newtonian pairwise gravitational acceleration ($\mathbf{a}_i = \sum_{j \ne i} G m_j \frac{\mathbf{r}_j - \mathbf{r}_i}{\|\mathbf{r}_j - \mathbf{r}_i\|^3}$) in `src/simulation/physics/gravity.ts`. **No gravitational softening** (no Plummer kernel, no $\epsilon$) is applied — only exactly coincident pairs are skipped and reported as an accuracy warning — so canonical orbit diagnostics stay comparable with institutional ephemerides.
- Implemented second-order Velocity Verlet (Leapfrog) symplectic integrator in `src/simulation/physics/integrator.ts`.
- Implemented mechanical invariant trackers (`src/simulation/physics/invariants.ts`) asserting total energy conservation, linear momentum conservation, and angular momentum conservation over 1,000 hourly steps.
- Implemented Cartesian to osculating Keplerian orbital element transformations ($a, e, i, \Omega, \omega, \nu, P$) in `src/simulation/physics/orbital-elements.ts`.

#### Phase 3: Timestep Scheduler & Deterministic Commands
- Built `TimestepScheduler` (`src/simulation/engine/timestep.ts`) decoupling integration timestep $\Delta t$ from wall-clock rendering rate. Supports time-warp rates from 1 hour/sec to 1 year/sec.
- Implemented a typed command stack (`src/simulation/engine/commands.ts`) where every command is logged with the **authentic** tick and simulated time at which it was executed, a discrete simulation event bus (`src/simulation/engine/events.ts`), and a replay engine (`src/simulation/engine/replay.ts`) that reconstructs history from that log to an explicitly stored final tick. The physics step consumes **no** pseudo-random source, so no PRNG seed exists to persist or replay.

#### Phase 4: Web Worker Architecture & Transferable Pipeline
- Created Web Worker protocol (`src/simulation/worker/protocol.ts`) and native worker thread loop (`src/simulation/worker/physics.worker.ts`).
- Created dual-mode `WorkerClient` (`src/simulation/worker/worker-client.ts`) supporting native Web Worker execution in the browser and synchronous fallback in Node.js test environments.
- Implemented flat typed array snapshots (`Float64Array`) for allocation-free worker-to-main-thread transfers at roughly 30 Hz, with main-thread render interpolation between snapshots so the visual layer is not limited to the publish rate.

#### Phase 5: Collision Resolution & Compact Objects
- Implemented pairwise sphere collision detection and inelastic linear-momentum conserving merger physics (`src/simulation/collisions/detect.ts`, `resolve.ts`).
- Implemented Roche limit diagnostics for fluid and rigid self-gravitating bodies (`src/simulation/collisions/disruption.ts`).
- Created compact object evaluation module (`src/simulation/engine/compact-objects.ts`) calculating exact Schwarzschild radius $r_s = 2GM/c^2$, strong-field parameter $GM/rc^2$, event-horizon capture boundaries, and non-relativistic Newtonian limit warnings.

#### Phase 6: Environmental & Thermal Models
- Created real-time stellar irradiance model ($F = \sum_j \frac{L_j}{4\pi r_j^2}$) in `src/simulation/environment/irradiance.ts`.
- Implemented equilibrium blackbody temperature derivation ($T_{\text{eq}} = \left[ \frac{(1 - A_B) F_{\text{incident}}}{4 \epsilon \sigma} \right]^{1/4}$) in `src/simulation/environment/temperature.ts`.
- Implemented derived orbital and Hill sphere diagnostics in `src/simulation/environment/orbital-derived.ts`.

#### Phase 7: Scenario Persistence & Zod v4 Schema
- Implemented strict Zod v4 validation schema (`src/simulation/scenarios/schema.ts`) rejecting malformed structures, duplicate body IDs, oversized collections ($> 128$ bodies), and unsupported future versions.
- Implemented JSON serialization and migration pipeline (`src/simulation/scenarios/serialize.ts`).
- Built browser-local IndexedDB scenario store with in-memory fallback (`src/simulation/scenarios/storage.ts`).

#### Phase 8: Reactive UI Layer & Three.js 3D Viewport
- **Zustand Sandbox Store:** `src/simulation/state/sandbox-store.ts` managing worker client lifecycle, state snapshots, undo/redo command stack, selection, and editing drafts.
- **Transport Controls:** `TransportBar` with Play, Pause, Step Forward, Reset (with 2-step confirmation), time-warp presets, continuous slider, and scale mode selectors.
- **Celestial Object Browser:** `ObjectBrowser` with search, category filtering (stars, planets, moons, compact, tracers), layer toggles, body deletion, duplication, and preset insertion dialog (Sun-like star, Earth-like planet, Jupiter-like gas giant, Moon, Comet, White dwarf, Neutron star, Pulsar, Magnetar, Schwarzschild black hole).
- **Body Inspector:** `BodyInspector` with 6 detailed tabs (State, Physical, Orbit, Environment, Events, Provenance) displaying osculating elements, Roche limits, equilibrium temperatures, and event history.
- **Body Editor:** `BodyEditor` with numeric inputs for mass, radius, position, and velocity across SI and astronomical units with real-time validation.
- **Provenance Badges:** `ProvenanceBadge` displaying badge colors and popovers for all 5 scientific provenance kinds.
- **Accuracy Indicator:** `AccuracyIndicator` with physics status readout, strong-field warnings ($GM/rc^2 > 0.01$), and quality selector (fast, standard, high).
- **Event Timeline:** `EventTimeline` with accessible collapsed ticker, expanded event log, and `aria-live` screen reader notifications.
- **Scenario Manager:** `ScenarioManager` modal supporting save to IndexedDB, reload, JSON export, and JSON file import.
- **Three.js & R3F Scene:** `SimulationScene`, `SimulationCanvas`, `SimulationBody`, `CompactObjectVisuals` (black hole accretion disk, pulsar radiation cones, magnetar loops), `TrajectoryLayer` (predicted orbital paths), and `VectorLayer` (velocity arrows).
- **Route & Shell:** Connected route at `/sandbox` with mode indicator and return link to `/`.

#### Phase 9: Quality & Verification Gates
- `npm test`: the full automated suite plus the assertion-integrity guard. CI reports the current counts; this document deliberately does not hardcode them.
- `npm run typecheck`: **0 TypeScript errors** (`tsc --noEmit`).
- `npm run lint`: **0 warnings** (`eslint . --max-warnings=0`).
- `npm run build`: Clean production build with Vite, Tailwind CSS v4, and Nitro.

#### Phase 10: Headless Browser QA & Accessibility
- `scripts/browser-sandbox.mjs` drives the production build and **asserts** every step; a step that merely logs is not acceptance verification. Asserted checks, each of which fails the run:
  1. Canonical baseline (pre-session) captured: body count, Earth mass provenance `canonical`, Earth state provenance `calculated`, tick 0 / t=0.
  2. `/sandbox` renders canvas, "SIMULATION SANDBOX" indicator and return link; initial playback state is `paused` in both store and worker telemetry.
  3. Play advances the authoritative clock (tick and simulated time increase; telemetry reports `running`).
  4. Pause freezes the clock (tick and simulated time identical after a 700 ms wait).
  5. Single step advances **exactly one `dt`** and leaves the engine paused, with no further steps afterwards.
  6. A single step requested while running settles the engine into `paused` and stops advancing.
  7. Mass edit reaches the authoritative world and flips provenance `canonical` → `custom` without touching radius/state provenance.
  8. Position/velocity edits are reflected numerically in SI units (1.25 AU → metres, 15 km/s → m/s) and state provenance becomes `custom`.
  9. Undo restores the exact pre-edit world hash, provenance included.
  10. Reset restores the canonical initial world exactly (tick 0, t=0, identical hash) and leaves the engine paused.
  11. A scenario saved after real evolution records authentic command ticks/times (tick > 0, time = tick × dt), not index-derived ones.
  12. Exported JSON carries the same chronology plus a `finalState` equal to the authoritative tick and time.
  13. Reload + load from IndexedDB replays to the identical final tick, time and world hash.
  14. Importing that exported JSON into a **fresh** browser profile reproduces the identical tick, time, world hash and body set.
  15. Canonical data is reproduced exactly after a full editing session (deep equality of masses, radii, positions, velocities and provenance).
  16. Documented shortcuts work: Space (play/pause), `.` (single step, exactly one `dt`), `I` (inspector), `E` (editor + Escape closes), `S` (scenario manager + Escape closes).
  17. Mobile 390×844 has no horizontal overflow and both drawers open.
  18. Reduced motion: the media query is active and motion durations are suppressed (computed `animation-duration` is 0.01 ms).
  19. Returning to `/` renders Observatory content, and every pass finishes with zero console/page/worker errors.
- Hosted CI runs this script as the **Sandbox Browser Acceptance** job against `http://127.0.0.1:8081/sandbox`, so the claim is gated rather than local-only.

#### Phase 11: Physical & Scale Limitations Resolved
- **Pairwise 1PN Approximation & Einstein Precession:**
  - Integrated a pairwise 1PN (first post-Newtonian) Schwarzschild-like acceleration term $\mathbf{a}_{\text{1PN}, i} = \sum_{j \ne i} \frac{G m_j}{c^2 r_{ij}^3} [ ( 4 \frac{G(m_i + m_j)}{r_{ij}} - v_{rel}^2 ) \mathbf{r}_{ij} + 4 (\mathbf{v}_{rel} \cdot \mathbf{r}_{ij}) \mathbf{v}_{rel} ]$ in `src/simulation/physics/gravity.ts`.
  - This is a **pairwise approximation, not the full Einstein–Infeld–Hoffmann (EIH) N-body 1PN system** (EIH multi-body cross terms are not implemented), and it is labelled as such in the UI and in `docs/PHYSICS_ENGINE.md` §6.2.
  - The 1PN force is velocity-dependent, so the second acceleration evaluation uses a half-step velocity and the path is presented as a second-order **velocity-dependent approximation**: no symplectic/phase-space-volume guarantee is claimed for relativity-enabled runs (only for Newtonian mode).
  - Implemented exact Einstein apsidal precession calculation ($\Delta \varpi = \frac{6\pi G(M+m)}{a(1-e^2)c^2}$) in `src/simulation/environment/orbital-derived.ts`, verified against Mercury reference (~42.98″/century).
  - Wired 1PN relativistic corrections user toggle into `AccuracyIndicator`, worker protocol (`set_relativity`), engine command stack, and `BodyInspector` (GR Precession & Compactness $GM/rc^2$).
- **Tidal Disruption & Shredding Remnants:**
  - Upgraded `resolveCollision` in `src/simulation/collisions/resolve.ts` to detect fluid Roche limit breaches ($r \le d_{\text{Roche}}$) for non-compact secondary bodies ($m_2 < 0.5 m_1$).
  - Generates 6 symmetrically dispersed tidal debris fragments along orbital tangent with velocity dispersion matching parent escape speed ($v_{\text{disp}} \sim \sqrt{2 G m_{\text{sec}} / r_{\text{sec}}}$).
  - Fully conserves total system mass and linear momentum ($\Delta m / m < 10^{-12}$, $\Delta p / p < 10^{-12}$) and emits `tidal_disruption` timeline events.
- **Dynamic Body Envelope Expanded to 1,024 Bodies:**
  - Expanded capacity from 128 to 1,024 total bodies in `src/simulation/scenarios/schema.ts`, `world.ts`, and `gravity.ts`.
  - Partitioned into up to 256 massive $O(N^2)$ bodies and 768 massless/debris tracer particles ($O(N_{\text{massive}} \times N_{\text{tracer}})$). The envelope is a **capacity** limit, not a frame-rate promise: measured throughput on the reference machine is recorded in `docs/PERFORMANCE.md` (§Sandbox benchmark matrix) — 8 massive bodies reach ~119 simulated days/s and ~11,000 steps/s, while the full 1024-body envelope reaches ~0.033 simulated days/s, i.e. the sandbox stays interactive but is compute-bound. `src/simulation/tests/performance.test.ts` pins conservative floors so this cannot silently regress.
  - Updated UI body counter in `ObjectBrowser` to show total and massive counts (`X / 1024 bodies (Y massive)`).
- **Verification gates (CI is the source of truth for counts):**
  - `npm test`: assertion-integrity guard plus the full automated suite.
  - `npm run typecheck`: **0 errors**; `npm run lint`: **0 warnings**; `npm run build`: clean production build.
  - `scripts/browser-sandbox.mjs`: all asserted sandbox acceptance checks above pass with 0 console/page/worker errors (hosted job **Sandbox Browser Acceptance**).

---

### Post-Audit Remediation (this change set)

The following defects were found by the post-implementation audit and repaired here. Each entry names the gate that now prevents regression.

**P0 — deterministic scenario/replay integrity**
- Scenario save now serialises the worker's *authoritative* command log (real tick and simulated time per command) plus an explicit `finalState`, instead of a fabricated index-based chronology. Asserted in `src/simulation/tests/scenario.test.ts`, `commands.test.ts`, `replay.test.ts` and browser step 11–12.
- Loading a scenario replays through the single replay engine, advancing physics between commands to the stored final tick, rather than dispatching commands instantly. Asserted by shell replay tests and browser steps 13–14.
- Scenario schema gained a mandatory final state and strict documents (see P1 below).

**P0 — scientific provenance after user edits**
- Generic `update_body: Partial<SimulationBody>` mutation was removed. Each editable concept has a dedicated command (`set_name`, `set_classification`, `set_gravity_role`, `set_mass`, `set_radius`, `set_position`, `set_velocity`, `set_rotation`, `set_thermal`, `set_radiative`, `set_compact_properties`, …) that explicitly rewrites the provenance fields it invalidates. Asserted in `editor.test.ts`, `commands.test.ts` and browser steps 7–8.

**P0 — test integrity**
- The five placeholder editor tests were replaced with real assertions (SI↔display conversion, elliptic and hyperbolic roundtrips, NaN/Infinity, negative mass, zero radius, compact invariants, black-hole synchronisation, canonical isolation).
- `scripts/check-test-integrity.mjs` rejects trivially-true assertions, assertion-free tests, conditional-only assertions and skipped markers; it runs inside `npm test` and as its own CI job, and is itself unit-tested.

**P1**
- **Playback state**: one authoritative state machine in the worker (`uninitialized` / `paused` / `running` / `stepping` / `halted` / `replaying`); the store mirrors worker state instead of inventing it. Initial state is explicitly paused. Step is atomic (pause → one step → publish → stay paused). Tested in `scheduler.test.ts`, `worker.test.ts`, `sandbox-store.test.ts` and browser steps 2–6.
- **One simulation clock**: the scheduler proposes a work budget and the authoritative tick/time advance only after each successful world step, so a throwing step cannot desynchronise scheduler and world.
- **Worker trust boundary**: strict Zod inbound/outbound schemas (`src/simulation/worker/worker-schemas.ts`) validate every payload, and NaN/±Infinity/negative dt or multiplier values are rejected with a protocol error.
- **Fault containment**: a physics exception halts the world, emits `SIMULATION_HALTED` with the last good tick/snapshot, and pauses the scheduler rather than continuing with non-finite state.
- **World mutation invariants**: `src/simulation/engine/mutation-guard.ts` centrally enforces unique IDs, the massive/total body caps, finite values, mass/radius validity, gravity-role consistency, compact-object invariants and provenance transitions; no command path bypasses it.
- **Collisions**: swept (continuous) contact detection plus a separate tidal pass that emits `roche_limit_crossing` outside physical contact; zero-mass tracers return `unsupported` diagnostics instead of a synthesised mass.
- **Checkpoints**: `SimulationCheckpoint` now carries the configuration (dt, quality, relativity, multiplier, model versions, command cursor), and restoring a checkpoint also restores the scheduler `dt`; continuing from a restored checkpoint equals an uninterrupted run (tested).
- **Undo**: checkpoint-based temporal undo — a full checkpoint is stored before each editable action and undo restores it exactly (asserted by world-hash equality in the store tests and browser step 9).
- **Render vs domain state**: the high-frequency render snapshot stays minimal, while authoritative metadata (provenance, compact fields, thermal, rotation) travels as `WORLD_CHANGED` domain patches.
- **Hyperbolic conics**: orbital-element conversion handles elliptic / parabolic / hyperbolic cases with finite roundtrips.
- **1PN labelling and integrator claims**: see Phase 11 above and `docs/PHYSICS_ENGINE.md` §6.2.
- **Ephemeris provenance**: Cartesian state vectors derived from canonical orbital elements are `calculated` (the element source remains `canonical`), canonical sandbox initialisation refuses epochs outside the supported 1800–2050 analytical range, and a validation matrix covers Mercury/Earth/Mars/Jupiter/Ceres/Pluto across the boundary epochs (`src/simulation/tests/ephemeris-state-vector.test.ts`).
- **Hosted acceptance and semantic docs**: the sandbox browser job runs in CI, and `scripts/check-doc-consistency.mjs` now rejects hand-maintained test counts, a documented-but-absent softening model, unqualified symplectic claims, frame-rate claims at the 1024-body envelope, an unwired sandbox QA script, and documented shortcuts with no handler.

**P2**
- Render interpolation between ~30 Hz snapshots (visual only; never fed back into physics).
- Dedicated environment suites (irradiance inverse-square, multi-star flux, albedo/emissivity boundaries, equilibrium temperature assumptions, Hill radius, bound/unbound energy, Roche/tidal scaling).
- Equilibrium temperature records its emissivity assumption and reports `estimated` provenance rather than a silent default; missing incident flux reports `unsupported`.
- Event detectors implemented for close encounter, Roche crossing, escape, ejection and accuracy warning.
- Documented shortcuts `I`, `E` and `S` implemented and browser-verified.
- The unused scenario seed was removed; replay is deterministic by construction (no PRNG), so the Mulberry32 replay claim was deleted.
- Physical-size display mode renamed to "Size emphasis" to stop implying a true proportional radius scale.
- Magnetic dipole ($r^{-3}$) and tidal-gradient ($r^{-3}$) scaling split into separate unconditional assertions.

### Known limitations (unchanged and explicitly unsupported)
- No full EIH N-body 1PN integration; no symplectic guarantee for the velocity-dependent 1PN path.
- No frame dragging, gravitational radiation, photon geodesics or Kerr metrics.
- No MHD, solar wind, atmospheric drag or radiative-pressure modelling.
- Major moons are not initialised as massive bodies: defensible derived state exists only for selected satellites, and the sandbox does not fabricate the rest.
- The sandbox initial epoch is the canonical default; inheriting an arbitrary Observatory epoch (`/sandbox?date=…`) remains future work.
- At the 1024-body envelope the simulation is compute-bound (≈0.03 simulated days/s on the reference machine), so "1,024 bodies at 60 FPS" is not a supported claim; see `docs/PERFORMANCE.md`.
