# Simulation Sandbox

The Sandbox Mode (`/sandbox`) is a mutable numerical experiment utilizing an isolated Newtonian physics engine, independent of the canonical source-backed reference (Observatory Mode).

## Architecture

Unlike Observatory Mode, where celestial bodies follow strict analytical Keplerian ephemeris on the `simClock`, the Sandbox Mode initializes state as a deep copy of canonical records. 

1. **Initialization**: Canonical records + selected epoch -> simulation-specific deep copy -> Cartesian state vector.
2. **Execution**: The physics engine (running in a dedicated worker thread) computes all future states via N-body numerical integration (Velocity Verlet).
3. **Isolation**: A mutation in the sandbox never back-propagates into canonical records (`src/data/**`).

## Provenance States

Every field displayed in Sandbox Mode explicitly defines its origin:
- **Canonical value**: source-backed observation
- **Calculated value**: deterministic outcome of the physics engine
- **Estimated value**: assumption or model-dependent approximation
- **Custom value**: user-provided input with no observational claim
- **Unsupported value**: intentionally unavailable or uncomputable given current state

## Sandbox Scenarios

Users can persist and share customized environments. Scenario documents are strictly versioned, explicitly noting engine version, integration method, timestep, and initial conditions to guarantee bit-identical deterministic replay (under identical runtime constraints).
