# Physics Engine Specification

This document provides a comprehensive technical, mathematical, and architectural reference for the Newtonian N-body simulation engine powering Helios Observatory's **Sandbox Mode** (`/sandbox`).

---

## 1. Overview & Architectural Philosophy

The physics engine is designed from first principles with institutional astronomical rigor:
- **Numerical Symplecticity over Naive Order:** Standard high-order non-symplectic integrators (such as classical 4th-order Runge-Kutta / RK4) introduce secular artificial energy dissipation or growth, causing planetary systems to artificially spiral inward or escape over simulated centuries. In Newtonian mode Helios employs a **second-order Velocity Verlet (Leapfrog)** integrator that is symplectic and preserves phase-space volume (satisfying Liouville's theorem), bounding energy errors to periodic oscillations. When the optional pairwise 1PN correction is enabled the force becomes velocity-dependent and **no** symplectic guarantee is claimed for that path — see §6.2.
- **Strict SI Dimensional Units:** Internally, the simulation operates exclusively in standard SI metric units (meters, seconds, kilograms, kelvins, watts). All conversion to astronomical units ($\text{AU}$, $\text{km}$, $\text{Earth masses}$, $\text{Solar masses}$) occurs strictly in the presentation formatting boundary (`src/simulation/domain/units.ts`).
- **Main-Thread Isolation:** All N-body acceleration evaluations and state integration occur off the main UI thread within a dedicated Web Worker (`src/simulation/worker/physics.worker.ts`), streaming state snapshots to the React Three Fiber renderer.

---

## 2. Mathematical Formulations

### 2.1 All-Pairs Gravitational Acceleration

For a system of $N$ celestial bodies with masses $m_1, m_2, \dots, m_N$ and Cartesian position vectors $\mathbf{r}_1, \mathbf{r}_2, \dots, \mathbf{r}_N$, the net gravitational acceleration $\mathbf{a}_i$ on body $i$ is the exact pairwise Newtonian sum:

$$\mathbf{a}_i = \sum_{\substack{j=1 \\ j \ne i}}^{N} \frac{G m_j (\mathbf{r}_j - \mathbf{r}_i)}{|\mathbf{r}_j - \mathbf{r}_i|^3}$$

Where:
- $G = 6.67430 \times 10^{-11} \text{ m}^3 \text{ kg}^{-1} \text{ s}^{-2}$ (CODATA 2022 recommended value, defined in `src/simulation/domain/constants.ts`).

**Softening policy (no hidden softening).** `src/simulation/physics/gravity.ts` implements the exact $1/r^2$ pairwise law above and skips only pairs at *exactly zero* separation (a measure-zero, non-physical configuration reported as an accuracy warning). No Plummer kernel, $\epsilon$-softening or any other hidden smoothing term is applied: canonical orbit diagnostics must remain reproducible against institutional ephemerides, and a silent softening length would invalidate those comparisons. Collision detection is handled separately (see §5) rather than by softening the force law.

### 2.2 Velocity Verlet Algorithm (Newtonian mode)

In Newtonian mode (relativity disabled) the acceleration depends only on position, and the state is advanced from time $t$ to $t + \Delta t$ via a two-stage kick-drift-kick (Velocity Verlet) scheme, which is symplectic for position-dependent forces:

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

The disruption model enforces a **one-generation rule**: debris remnants produced by a tidal disruption are never re-shredded. A fragment stream does not repeatedly disrupt as discrete self-gravitating bodies — pieces either fall back and accrete or disperse. Without this rule, remnants spawned inside the primary's Roche limit disrupt again each step, cascading exponentially to the 1,024-body cap (found by `npm run fuzz:collisions`).

Within a single step, each body participates in **at most one resolution** (contact or Roche). Pairs are resolved earliest-contact first; later pairs touching an already-resolved body are deferred to the next step. Resolving a pair consumes its bodies, so a second resolution in the same tick would otherwise read stale pre-merge state and silently destroy the first merge's conserved mass and momentum.

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
- **Mass/radius coupling invariant:** for a Schwarzschild black hole the horizon radius is *calculated* from the mass ($r_s = 2GM/c^2$) and the physical capture radius is *calculated* from the horizon. Mass and classification are the authoritative inputs; a command that would leave mass, horizon radius and capture radius mutually inconsistent is rejected by `src/simulation/engine/mutation-guard.ts`.

### 6.2 Pairwise 1PN Approximation (Relativity Toggle)

When the sandbox's relativity toggle is enabled, the engine adds a **pairwise 1PN (first post-Newtonian) Schwarzschild-like acceleration term** to the Newtonian sum, following the standard two-body form

$$\mathbf{a}_{\text{1PN}} = \frac{G M}{c^2 r^3}\left[\left(4\frac{GM}{r} - v^2\right)\mathbf{r} + 4(\mathbf{r}\cdot\mathbf{v})\mathbf{v}\right]$$

**What this model is, and what it is not:**

- It is a *velocity-dependent pairwise* correction. It captures the dominant relativistic perihelion-advance behaviour and is validated against the Mercury precession reference in `src/simulation/tests/compact.test.ts`.
- It is **not** the full Einstein–Infeld–Hoffmann (EIH) N-body 1PN system: EIH carries multi-body cross terms (mutual kinetic and potential couplings between every pair), which this implementation does not include. Documentation and UI label it accordingly (*pairwise 1PN Schwarzschild-like correction*), never "full GR" or "EIH".
- Because the force now depends on velocity, the Newtonian symplectic guarantee **does not carry over**: no phase-space-volume or bounded-energy-error claim is made for the relativistically enabled path, and its accuracy is reported separately in the accuracy panel. Published numerical-dynamics results agree that naively adding velocity-dependent post-Newtonian terms to a leapfrog scheme is not time-symmetric; Helios therefore presents the 1PN path as a second-order approximation, not a symplectic integrator.
- The strong-field limitation in §6.1 still applies: inside the compact-object regime the field remains Newtonian outside $r_s$, with horizon capture handled as an inelastic boundary condition.

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
- **Invariant Numerical Step:** The integrator advances at a constant fixed $\Delta t$ selected by the accuracy preset, substepping as many iterations as required to satisfy the wall-clock budget.
- **Numerical Stability:** The scheduler never changes $\Delta t$ to chase a time-warp target. Achieved warp degrades instead, and the achieved/requested warp ratio is reported in the transport bar.
- **Budget semantics:** The scheduler computes a work budget from the wall-clock delta; the authoritative simulation clock (tick and simulated time) is advanced only after each successful world step, so a throwing step can never leave the scheduler ahead of the world.

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

### Supported (exact)
- Newtonian all-pairs mutual gravitation ($N$-body), with no softening.
- Symplectic Velocity Verlet phase-space volume conservation **in Newtonian mode**.
- Barycentric center-of-mass frame transformations.
- Gravitational slingshots, orbital resonance, perturbations, and ejections.
- Tracer particles and test mass orbits.
- Completely inelastic mergers with linear momentum conservation.
- Classical Roche tidal disruption limits, evaluated as a tidal pass that runs whether or not the bodies physically touch.
- Schwarzschild horizon mass accumulation with mass-derived $r_s$.
- Deterministic command logging with authentic tick/simulated-time stamps, checkpoint capture, and replay to a stored final tick.
- Swept (continuous) contact detection, so fast bodies cannot tunnel through one another.

### Supported (approximate, explicitly labelled in the UI)
- Pairwise 1PN Schwarzschild-like perihelion precession (see §6.2 for scope and limitations).
- Equilibrium temperature and irradiance derived from canonical luminosity (missing emissivity/coverage yields an `estimated` or `unsupported` provenance, never a silent default).

### Explicitly Unsupported (Out of Scope)
- Full Einstein–Infeld–Hoffmann multi-body 1PN integration, and no symplectic guarantee for the velocity-dependent 1PN path.
- General relativistic frame dragging (Lense-Thirring effect).
- Gravitational wave radiation and inspiral.
- Exact photon geodesics, Kerr metrics, and strong-field ray tracing.
- Magnetohydrodynamics (MHD) and solar wind plasma interactions.
- Atmospheric drag and hypersonic entry ablation.
- Stochastic (PRNG-driven) physics: no random process affects the physics step, so no seed is consumed or persisted.
- Radiative pressure and Poynting-Robertson drag.
- Stellar mass loss and post-main-sequence expansion.
