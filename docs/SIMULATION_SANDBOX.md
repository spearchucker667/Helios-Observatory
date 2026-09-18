# Interactive Astrophysical Sandbox Architecture & Guide

This document defines the architectural contract, user workflows, data isolation principles, and worker communication protocols for Helios Observatory's **Interactive Sandbox Mode** (`/sandbox`).

---

## 1. Architectural Contract: Two Worlds

Helios Observatory operates under a strict dual-mode model:

| Dimension | Observatory Mode (`/`) | Sandbox Mode (`/sandbox`) |
| :--- | :--- | :--- |
| **Purpose** | Institutional astronomical reference and 3D orrery. | Experimental N-body numerical laboratory and scenario sandbox. |
| **Ephemeris Engine** | Analytical Keplerian orbital elements (Standish / JPL DE405). | Numerical symplectic N-body integration (Velocity Verlet). |
| **State Mutability** | Strictly immutable. Positions derive directly from epoch time. | Fully mutable. Objects can be injected, shifted, boosted, or deleted. |
| **State Origin** | Direct citations from NASA, JPL, IAU, and USGS. | Initialized as an isolated deep copy; evolves dynamically. |
| **Execution Context** | Main thread synchronously on animation frame (`simClock`). | Authoritative background Web Worker (`physics.worker.ts`). |
| **Data Integrity** | Governed by `src/data/validate.ts`. | Governed by conservation laws in `src/simulation/tests/`. |

---

## 2. Canonical Isolation & Adapter Pipeline

The fundamental invariant of the sandbox is: **no sandbox operation may ever mutate canonical reference data (`src/data/**`)**.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Sandbox UI (Main Thread)
    participant Adapt as Canonical Adapter
    participant Bary as Barycentric Converter
    participant Worker as Physics Worker (Background Thread)
    participant Storage as Scenario Storage (IndexedDB)

    User->>UI: Enter /sandbox (or click Sandbox Mode)
    UI->>Adapt: Request canonical deep clone at active epoch
    Note over Adapt: Deep copy registry records (mass, radius, color)
    Adapt->>Adapt: Compute Cartesian state vectors [x, y, z, vx, vy, vz]
    Adapt->>Bary: Transfer state vectors
    Note over Bary: Calculate Center of Mass & Net Momentum
    Bary->>Bary: Shift coordinates (P_net = 0)
    Bary->>Worker: postMessage({ type: 'init', bodies, dt })
    Worker->>Worker: Initialize Float64Array buffers & Velocity Verlet solver
    loop Simulation Loop
        Worker->>Worker: Substep N-body gravity
        Worker-->>UI: postMessage({ type: 'snapshot', positions, velocities })
        UI->>UI: Interpolate in Three.js useFrame
    end
    User->>UI: Apply Velocity Impulse
    UI->>Worker: postMessage({ type: 'command', command: applyImpulse })
    User->>UI: Save Scenario
    UI->>Storage: Serialize state, metadata, and command log
```

### 2.1 State Vector Conversion
When transitioning from the canonical registry into the simulation, `src/simulation/initialization/canonical-adapter.ts`:
1. Converts mean orbital radius and semi-major axis into SI meters.
2. Derives velocities from the analytical Keplerian solver in meters per second ($\text{m/s}$).
3. Maps planetary and lunar masses into kilograms ($\text{kg}$).
4. Marks missing masses (such as minor irregular satellites without mass estimates) as **Tracer Particles**, preventing unphysical gravitational perturbations.

### 2.2 Barycentric Frame Transformation
To prevent the solar system from drifting across the coordinate grid, `src/simulation/initialization/barycentric.ts` computes the system center of mass $\mathbf{R}_{\text{cm}}$ and center-of-mass velocity $\mathbf{V}_{\text{cm}}$, subtracting them from all initial state vectors so that total initial linear momentum is zero.

---

## 3. Worker Boundary & Messaging Protocol

All compute-intensive N-body calculations execute in a dedicated background worker (`src/simulation/worker/physics.worker.ts`). The worker owns the authoritative simulation clock and playback state; the main thread only mirrors what the worker reports and never advances physics itself, so camera and UI interaction stay responsive regardless of how compute-bound the physics is at a given body count (see [docs/PERFORMANCE.md](./PERFORMANCE.md) for measured throughput).

Every inbound and outbound message is runtime-validated against the strict Zod contracts in `src/simulation/worker/worker-schemas.ts`: a malformed, non-finite or out-of-range payload is rejected with a protocol error before it can touch the world.

### 3.1 Main Thread to Worker Messages (`WorkerMessage`)

Defined in `src/simulation/worker/protocol.ts`:

```typescript
export type WorkerMessage =
  | { type: "init"; dt: number; bodies: SimulationBody[] }
  | { type: "command"; command: SimulationCommand }
  | { type: "snapshotReq" }
  | { type: "setTimestep"; dt: number }
  | { type: "setTimeMultiplier"; multiplier: number }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "stepOnce" }
  | { type: "reset" };
```

### 3.2 Worker to Main Thread Messages (`MainMessage`)

```typescript
export type MainMessage =
  | { type: "snapshot"; data: SimulationSnapshot }
  | { type: "event"; event: SimulationEvent }
  | { type: "error"; error: string };
```

- **Snapshots:** Fixed-frequency state vectors containing flat typed arrays (`Float64Array`) of 3D positions and velocities.
- **Events:** Asynchronous discrete events triggered during physics substepping (e.g. physical collisions, tidal disruptions, black hole event-horizon captures).

---

## 4. Provenance Taxonomy

Every parameter displayed in the Sandbox Mode UI carries explicit scientific provenance (`src/simulation/domain/provenance.ts`):

- **Canonical (`canonical`):** Measured observational data from institutional references (NASA/JPL/IAU).
- **Calculated (`calculated`):** Direct mathematical outcome of numerical N-body integration under modeled physics.
- **Estimated (`estimated`):** Model-dependent approximations (e.g., Roche limits, equilibrium temperatures, mean density estimates).
- **Custom (`custom`):** Values injected or modified directly by the user (no observational claim).
- **Unsupported (`unsupported`):** Quantities the engine cannot defensibly evaluate — for example exact/full-GR behaviour, magnetic drag, or a diagnostic whose inputs are absent (a zero-mass tracer in a reduced-mass calculation, a body with no incident flux).

Provenance is not decorative: every edit command rewrites exactly the fields it invalidates (`set_mass` moves mass provenance to `custom` and leaves radius/state untouched, `set_position`/`set_velocity` move state provenance, and so on). Cartesian state vectors produced from canonical orbital elements are `calculated` — the *element source* is canonical, the state vector is not an institutional measurement — and the sandbox refuses canonical initialisation outside the supported 1800–2050 ephemeris range rather than presenting extrapolated values as canonical.

---

## 5. User Workflows & Controls

### 5.1 Object Inspector & Editor
- **Selection:** Click any celestial body in the 3D viewport or select from the Object Browser to inspect its instantaneous Cartesian state vector $[x, y, z, v_x, v_y, v_z]$ and osculating Keplerian orbital elements ($a, e, i$).
- **Impulse Application (command-level):** `apply_impulse` exists as a validated world command (velocity delta in $\text{m/s}$) and moves state provenance to `custom`. The store exposes `applyImpulse()`, but the current UI surface for it is the explicit position/velocity vector editor rather than a 3D manipulator gizmo.
- **Mass, Radius & State Editing:** Tweak body mass ($M_\oplus$, $M_\odot$, or $\text{kg}$), mean radius, name, classification, gravity role and the full position/velocity vectors. Opening the editor pauses the authoritative worker first, and saving issues provenance-aware commands (`set_mass`, `set_radius`, `set_position`, `set_velocity`, …) that each rewrite only the provenance they invalidate. Values are validated (finite, positive where required, compact-object invariants enforced) and rejected with an inline error rather than silently coerced.

### 5.2 Transport Controls
- **Play / Pause (`Space`):** Freezes worker integration while maintaining full camera navigation and 3D globe inspection.
- **Single Step (`.`):** Advances the simulation by exactly one fixed numerical timestep $\Delta t$.
- **Time Warp (`[` / `]`):** Scales the rate of simulation time progression from $1\times$ up to $100,000\times$ without altering the numerical integration step $\Delta t$, ensuring stability.

### 5.3 Adding Celestial Bodies & Spawning Presets
- **Presets (`src/simulation/domain/presets.ts`):** Spawn a single body from a typed astrophysical template, with custom id/name/position/velocity supplied at spawn time:
  - *Stellar:* Sun-like G2V main-sequence star.
  - *Planetary:* Earth-like rocky planet, Jovian gas giant.
  - *Small bodies:* Carbonaceous (C-type) asteroid, volatile comet.
  - *Compact objects:* degenerate white dwarf, neutron star, radio pulsar, magnetar, stellar-mass Schwarzschild black hole.
- **Caps and IDs:** spawning enforces the world invariants — a duplicate id is rejected (never silently replaced) and the massive-body cap demotes or rejects excess massive bodies rather than being bypassed.

---

## 6. Scenario Persistence & Deterministic Replay

Scenarios can be exported and imported as standardized JSON documents (`src/simulation/scenarios/schema.ts`):

```json
{
  "format": "helios-scenario",
  "schemaVersion": 2,
  "engineVersion": "1.0.0",
  "id": "scenario-8f2c",
  "name": "Inner system perturbation study",
  "createdAt": "2026-09-17T10:00:00.000Z",
  "updatedAt": "2026-09-17T10:04:12.000Z",
  "initialState": { "engineVersion": "1.0.0", "tick": 0, "simTimeSeconds": 0, "dtSeconds": 900, "bodies": [] },
  "commands": [
    { "tick": 480, "simTimeSeconds": 432000, "command": { "type": "set_mass", "id": "earth", "massKg": 1.49305e25 } },
    { "tick": 1520, "simTimeSeconds": 1368000, "command": { "type": "set_velocity", "id": "earth", "velocity": [0, 29785, 0] } }
  ],
  "finalState": { "tick": 2400, "simTimeSeconds": 2160000 },
  "checkpoint": { "engineVersion": "1.0.0", "tick": 2400, "simTimeSeconds": 2160000, "dtSeconds": 900, "bodies": [], "configuration": {}, "commandLog": [] }
}
```

- **Authentic chronology:** each logged command stores the tick and simulated time at which it actually executed. The store no longer derives those values from the command's position in the UI history, so a command performed at day 45 is saved as day 45.
- **Deterministic Replay:** loading replays that log through the engine — advancing physics between commands and stopping at the stored `finalState` — instead of dispatching every command at t=0. Because the physics step consumes no pseudo-random source and the timestep is fixed by the accuracy preset, replaying the same document from the same initial state reproduces the same final tick and body state, which the acceptance suite asserts by comparing world hashes before and after a reload.
- **Documents are untrusted input:** persisted and imported documents pass strict Zod validation (strict objects, bounded strings/arrays, duplicate-ID and command-tick checks) on every load, including loads from IndexedDB written by older builds.
- **Local Persistence:** Scenarios are stored locally in IndexedDB (`src/simulation/scenarios/storage.ts`) and can be exported as `.json` files for sharing.

---

## 7. Component Hierarchy

```text
src/components/simulation/
├── simulation-app.tsx        Top-level sandbox orchestrator & state context
├── simulation-canvas.tsx     Three.js WebGL canvas wrapper with resize handlers
├── simulation-scene.tsx      Scene graph with lighting, starfield, and bodies
├── simulation-body.tsx       Instanced rendering of celestial spheres, trails, and labels
├── transport-bar.tsx         Play, pause, step, speed, and reset HUD controls
├── body-inspector.tsx        Tabbed panel for telemetry, orbital elements, and provenance
├── object-browser.tsx        Searchable list of all active bodies and tracers
├── vector-editor.tsx         Velocity vector manipulaton and Cartesian input fields
├── vector-layer.tsx          3D velocity arrow rendering in Three.js
├── trajectory-layer.tsx      Osculating and numerical trajectory line renderers
├── scenario-manager.tsx      Save, load, import, and export modal dialog
├── compact-object-visuals.tsx Accretion disk, event horizon, and relativistic beam shaders
└── accuracy-indicator.tsx    Real-time energy conservation and numerical error HUD badge
```
