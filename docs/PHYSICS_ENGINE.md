# Physics Engine Specification

This document provides a comprehensive technical, mathematical, and architectural reference for the Newtonian N-body simulation engine powering Helios Observatory's **Sandbox Mode** (`/sandbox`).

---

## 1. Overview & Architectural Philosophy

The physics engine is designed from first principles with institutional astronomical rigor:
- **Numerical Symplecticity over Naive Order:** Standard high-order non-symplectic integrators (such as classical 4th-order Runge-Kutta / RK4) introduce secular artificial energy dissipation or growth, causing planetary systems to artificially spiral inward or escape over simulated centuries. Helios employs a **second-order Velocity Verlet (Leapfrog)** symplectic integrator that preserves phase-space volume (satisfying Liouville's theorem) and bounds energy errors to periodic oscillations.
- **Strict SI Dimensional Units:** Internally, the simulation operates exclusively in standard SI metric units (meters, seconds, kilograms, kelvins, watts). All conversion to astronomical units ($\text{AU}$, $\text{km}$, $\text{Earth masses}$, $\text{Solar masses}$) occurs strictly in the presentation formatting boundary (`src/simulation/domain/units.ts`).
- **Main-Thread Isolation:** All N-body acceleration evaluations and state integration occur off the main UI thread within a dedicated Web Worker (`src/simulation/worker/physics.worker.ts`), streaming state snapshots to the React Three Fiber renderer.

---

## 2. Mathematical Formulations

### 2.1 All-Pairs Gravitational Acceleration

For a system of $N$ celestial bodies with masses $m_1, m_2, \dots, m_N$ and Cartesian position vectors $\mathbf{r}_1, \mathbf{r}_2, \dots, \mathbf{r}_N$, the net gravitational acceleration $\mathbf{a}_i$ on body $i$ is calculated using Newton's Universal Law of Gravitation with a Plummer gravitational softening parameter $\epsilon$:

$$\mathbf{a}_i = \sum_{\substack{j=1 \\ j \ne i}}^{N} \frac{G m_j (\mathbf{r}_j - \mathbf{r}_i)}{\left(|\mathbf{r}_j - \mathbf{r}_i|^2 + \epsilon^2\right)^{3/2}}$$

Where:
- $G = 6.67430 \times 10^{-11} \text{ m}^3 \text{ kg}^{-1} \text{ s}^{-2}$ (CODATA 2022 recommended value, defined in `src/simulation/domain/constants.ts`).
- $\epsilon = 10^3 \text{ m}$ (gravitational softening length to prevent numerical division-by-zero singularities during close-range grazing encounters).

### 2.2 Symplectic Velocity Verlet Algorithm

The state of the system is advanced from time $t$ to $t + \Delta t$ via a two-stage symplectic kick-drift-kick (Velocity Verlet) scheme:

1. **Half-Step Velocity Kick:**
   $$\mathbf{v}_i\left(t + \frac{1}{2}\Delta t\right) = \mathbf{v}_i(t) + \frac{1}{2} \mathbf{a}_i(t) \Delta t$$

2. **Full-Step Position Drift:**
   $$\mathbf{r}_i(t + \Delta t) = \mathbf{r}_i(t) + \mathbf{v}_i\left(t + \frac{1}{2}\Delta t\right) \Delta t = \mathbf{r}_i(t) + \mathbf{v}_i(t)\Delta t + \frac{1}{2}\mathbf{a}_i(t)\Delta t^2$$

3. **Re-evaluate Accelerations:**
   Compute updated accelerations $\mathbf{a}_i(t + \Delta t)$ from the new positions $\mathbf{r}(t + \Delta t)$.

4. **Final Half-Step Velocity Kick:**
   $$\mathbf{v}_i(t + \Delta t) = \mathbf{v}_i\left(t + \frac{1}{2}\Delta t\right) + \frac{1}{2} \mathbf{a}_i(t + \Delta t) \Delta t = \mathbf{v}_i(t) + \frac{1}{2}\left[\mathbf{a}_i(t) + \mathbf{a}_i(t + \Delta t)\right]\Delta t$$

### 2.3 Energy and Momentum Conservation

For an isolated system of $N$ bodies, total mechanical energy $E$ is the sum of kinetic energy $T$ and gravitational potential energy $U$:

$$T = \sum_{i=1}^{N} \frac{1}{2} m_i |\mathbf{v}_i|^2$$

$$U = -\sum_{i=1}^{N} \sum_{j > i}^{N} \frac{G m_i m_j}{|\mathbf{r}_j - \mathbf{r}_i|}$$

$$E = T + U$$

Under the Velocity Verlet algorithm:
- Total linear momentum $\mathbf{P} = \sum_{i=1}^N m_i \mathbf{v}_i$ is conserved to floating-point precision ($\Delta \mathbf{P} / M_{\text{tot}} < 10^{-5} \text{ m/s}$).
- Total energy $E$ oscillates stably around a constant value with zero secular energy drift over millions of steps ($|\Delta E / E_0| < 10^{-5}$ over 1,000 steps).

---

## 3. Barycentric Frame Transformation

To eliminate unphysical drift of the entire coordinate system through space, initial conditions derived from heliocentric ephemerides are shifted into the system's barycentric (center-of-mass) inertial frame (`src/simulation/initialization/barycentric.ts`):

1. **Center of Mass Calculation:**
   $$\mathbf{R}_{\text{cm}} = \frac{\sum_{i=1}^N m_i \mathbf{r}_i}{\sum_{i=1}^N m_i}$$

2. **Center of Mass Velocity:**
   $$\mathbf{V}_{\text{cm}} = \frac{\sum_{i=1}^N m_i \mathbf{v}_i}{\sum_{i=1}^N m_i}$$

3. **Barycentric Shift:**
   $$\mathbf{r}'_i = \mathbf{r}_i - \mathbf{R}_{\text{cm}}, \quad \mathbf{v}'_i = \mathbf{v}_i - \mathbf{V}_{\text{cm}}$$

Following the transformation, the net system momentum $\mathbf{P}_{\text{net}} = \sum m_i \mathbf{v}'_i = \mathbf{0}$.

---

## 4. Tracer Bodies & Non-Gravitational Objects

Small solar system bodies (asteroids, spacecraft, comets, test particles) often lack sufficient mass to meaningfully perturb major planets. Helios introduces the **Tracer Role** (`isTracer[i] = 1`):
- **Equation of Motion:** A tracer body accelerates due to all massive celestial bodies:
  $$\mathbf{a}_{\text{tracer}} = \sum_{j \in \text{Massive}} \frac{G m_j (\mathbf{r}_j - \mathbf{r}_{\text{tracer}})}{|\mathbf{r}_j - \mathbf{r}_{\text{tracer}}|^3}$$
- **Zero Back-Reaction:** Massive bodies ignore the presence of tracer particles.
- **Benefits:** Prevents artificial numerical noise in planetary orbits caused by tiny artificial test masses, while reducing the pairwise computation complexity for $M$ massive bodies and $K$ tracers from $\mathcal{O}((M+K)^2)$ to $\mathcal{O}(M^2 + M \cdot K)$.

---

## 5. Collisions, Mergers & Tidal Destruction

### 5.1 Inelastic Mergers & Linear Momentum Conservation

When two celestial bodies $A$ and $B$ experience physical contact ($|\mathbf{r}_A - \mathbf{r}_B| \le R_A + R_B$), the collision resolver executes a completely inelastic merger (`src/simulation/collisions/resolve.ts`):
- **Mass Addition:** $M_{\text{new}} = M_A + M_B$
- **Volume Addition (Assuming Constant Mean Density):**
  $$R_{\text{new}} = \left(R_A^3 + R_B^3\right)^{1/3}$$
- **Linear Momentum Conservation:**
  $$\mathbf{v}_{\text{new}} = \frac{M_A \mathbf{v}_A + M_B \mathbf{v}_B}{M_A + M_B}$$
- **Position of Merged Body:** Center of mass of the colliding pair:
  $$\mathbf{r}_{\text{new}} = \frac{M_A \mathbf{r}_A + M_B \mathbf{r}_B}{M_A + M_B}$$

### 5.2 Roche Tidal Disruption Limit

The engine evaluates tidal gravitational gradients. For a secondary body with radius $R_m$ and bulk density $\rho_m$ orbiting a massive primary with radius $R_M$ and bulk density $\rho_M$, the classical rigid Roche limit is estimated as:

$$d_{\text{Roche}} \approx R_M \left(2 \frac{\rho_M}{\rho_m}\right)^{1/3} \approx 1.26 \, R_M \left(\frac{\rho_M}{\rho_m}\right)^{1/3}$$

When an object crosses within its Roche limit, the UI triggers an automated dynamical warning indicating impending tidal disruption.

---

## 6. Compact Objects & General Relativistic Approximations

Helios models compact stellar remnants (White Dwarfs, Neutron Stars, and Stellar-Mass / Supermassive Black Holes) with appropriate physical caveats:

### 6.1 Schwarzschild Horizon & Capture Boundary

For a non-rotating compact mass $M$, the Schwarzschild event horizon radius $r_s$ is:

$$r_s = \frac{2GM}{c^2}$$

Where $c = 299,792,458 \text{ m/s}$.

- **Inelastic Horizon Capture:** Any mass or tracer crossing the capture boundary $r_{\text{capture}} \le r_s$ is irreversibly absorbed into the singularity.
- **Mass Accumulation:** The black hole's mass increases by the absorbed mass: $M \leftarrow M + m_{\text{absorbed}}$, correspondingly expanding its Schwarzschild radius.
- **Photon Sphere:** The unstable orbit radius for relativistic light rays is highlighted at $r_{\text{ph}} = 1.5 \, r_s$.
- **Scientific Honesty Caveat:** The engine does not compute full general relativistic geodesics or Kerr metrics; the gravity field outside the horizon remains Newtonian ($1/r^2$). The UI explicitly notes that relativistic frame-dragging and gravitational radiation are unmodeled.

---

## 7. Internal Units & Precision Constants

| Dimension | Physical Unit | Symbol | Base Unit |
| :--- | :--- | :--- | :--- |
| **Position / Distance** | Meter | $\text{m}$ | $\text{m}$ |
| **Velocity** | Meters per second | $\text{m/s}$ | $\text{m}\cdot\text{s}^{-1}$ |
| **Mass** | Kilogram | $\text{kg}$ | $\text{kg}$ |
| **Time** | Second | $\text{s}$ | $\text{s}$ |
| **Acceleration** | Meters per second squared | $\text{m/s}^2$ | $\text{m}\cdot\text{s}^{-2}$ |
| **Temperature** | Kelvin | $\text{K}$ | $\text{K}$ |
| **Luminosity** | Watt | $\text{W}$ | $\text{kg}\cdot\text{m}^2\cdot\text{s}^{-3}$ |

### Canonical Physical Constants (`src/simulation/domain/constants.ts`)

| Constant | Value | Reference / Provenance |
| :--- | :--- | :--- |
| **Gravitational Constant ($G$)** | $6.67430 \times 10^{-11} \text{ m}^3 \text{ kg}^{-1} \text{ s}^{-2}$ | CODATA 2022 |
| **Speed of Light ($c$)** | $299,792,458 \text{ m/s}$ | SI Definition (Exact) |
| **Astronomical Unit ($\text{AU}$)** | $149,597,870,700 \text{ m}$ | IAU 2012 Resolution B2 |
| **Solar Mass ($M_\odot$)** | $1.98847 \times 10^{30} \text{ kg}$ | IAU Current Best Estimate |
| **Earth Mass ($M_\oplus$)** | $5.9722 \times 10^{24} \text{ kg}$ | NASA JPL Planetary Fact Sheet |
| **Solar Radius ($R_\odot$)** | $6.957 \times 10^8 \text{ m}$ | IAU 2015 Resolution B3 |

---

## 8. Timestep Scheduling & Time-Warp Decoupling

The simulation scheduler (`src/simulation/engine/timestep.ts`) strictly decouples physical integration timestep $\Delta t$ from presentation time-warp factors:
- **Fixed Substepping:** The user-selected time multiplier (e.g. $10\times$, $1000\times$, $1\text{ day/sec}$) dictates how many physical seconds are accumulated during each frame.
- **Invariant Numerical Step:** The underlying symplectic integrator continuously integrates at a constant fixed $\Delta t$ (default: $3,600 \text{ s} = 1 \text{ hour}$ for inner system, up to $86,400 \text{ s} = 1 \text{ day}$ for outer solar system), substepping as many iterations as required.
- **Numerical Stability:** Acceleration of simulation pace will never degrade numerical integration accuracy or trigger explosive orbital instability.

---

## 9. Automated Verification Test Suites

Every physical law and conservation invariant is continuously asserted across automated test suites (`src/simulation/tests/`):

1. **`isolation.test.ts`:** Asserts that simulation cloning never mutates underlying canonical registries in `src/data/**`.
2. **`initialization.test.ts`:** Verifies accurate Cartesian conversion, J2000 state-vector mapping, and barycentric center-of-mass momentum zeroing.
3. **`energy.test.ts`:** Verifies total energy conservation ($|\Delta E / E_0| < 10^{-5}$) and zero total momentum drift over 1,000 steps.
4. **`integrator.test.ts`:** Tests circular orbit stability over a full 1-year orbit of Earth around the Sun ($1.00 \pm 0.05 \text{ AU}$) and verifies tracer particles exert zero force.
5. **`scheduler.test.ts`:** Confirms deterministic execution, pause/resume state retention, and time-multiplier decoupling.
6. **`collision.test.ts`:** Enforces mass and linear momentum conservation upon inelastic body collisions.
7. **`compact.test.ts`:** Validates Schwarzschild radius scaling, capture boundary conditions, and non-relativistic disclaimer presentation.

---

## 10. Supported vs. Unsupported Physical Phenomena

### Supported
- Newtonian all-pairs mutual gravitation ($N$-body).
- Symplectic Velocity Verlet phase-space volume conservation.
- Barycentric center-of-mass frame transformations.
- Gravitational slingshots, orbital resonance, perturbations, and ejections.
- Tracer particles and test mass orbits.
- Completely inelastic mergers with linear momentum conservation.
- Classical Roche tidal disruption limits.
- Schwarzschild horizon mass accumulation.
- Deterministic command logging and snapshot replay.

### Explicitly Unsupported (Out of Scope for Newtonian Engine)
- General relativistic frame dragging (Lense-Thirring effect).
- Gravitational wave radiation and inspiral.
- Relativistic perihelion precession (requires post-Newtonian expansions).
- Magnetohydrodynamics (MHD) and solar wind plasma interactions.
- Atmospheric drag and hypersonic entry ablation.
- Radiative pressure and Poynting-Robertson drag.
- Stellar mass loss and post-main-sequence expansion.
