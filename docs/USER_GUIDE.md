# Helios Observatory User Guide

Welcome to **Helios Observatory**, a high-precision, living 3D orrery and astronomical reference platform for the Solar System. This manual covers navigation, world inspection, ephemeris simulation, natural satellite exploration, distance calipers, and sharing views.

---

## 1. Navigating the 3D Orrery

### Camera Navigation
- **Orbit System:** Click and drag (or single-finger drag on touchscreens) anywhere in the deep-space void to rotate the camera around the current focus target.
- **Pan View:** Right-click and drag (or two-finger drag) to pan the orbital plane.
- **Zoom:** Scroll your mouse wheel or pinch on a trackpad/touchscreen to zoom smoothly between planetary close-ups and system-wide scales.
- **Reset to Barycentre:** Click **System view** in the sidebar or press `R` to frame the whole solar system.

### Selecting Celestial Worlds
- **Direct 3D Picking:** Click on any sun, planet, dwarf planet, or major moon directly in the viewport.
- **Sidebar Worlds List:** The left sidebar organizes worlds hierarchically:
  - **Star:** Sun
  - **Planets:** Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune
  - **Dwarf Planets:** Ceres (asteroid belt), Pluto (Kuiper Belt)
- **Natural Satellites Accordion:** Planets with major moons display an expand toggle (`▾`) in the sidebar allowing instant selection of individual moons (e.g., Earth's Moon, Jupiter's Galilean moons, Saturn's Titan and Enceladus).

---

## 2. World Detail & Scientific Inspection

Selecting any celestial body opens the slide-out **Detail Panel** containing institutional data cited directly from NASA GSFC and USGS:

1. **Overview Tab:**
   - Physical summary, classification, diameter, gravity, mean temperature, sidereal day, orbital year, and total confirmed natural satellites.
   - Exact ephemeris epoch readout.
   - Discovery history and primary citations.
2. **Physical Tab:**
   - Dimensions & Mass: mean radius, diameter, mass in Earths and kg, bulk density.
   - Gravity: surface acceleration ($g$ or $\text{m/s}^2$) and escape velocity ($\text{km/s}$).
   - Rotation & Axial Tilt: sidereal day length, obliquity to orbit.
   - Temperature range ($\text{°C}$ and $\text{°F}$).
   - Internal core/mantle structure and global magnetic field dynamics.
3. **Orbit Tab:**
   - Semi-major axis (AU and km), orbital period, orbital eccentricity, orbital inclination, mean orbital velocity, and retrograde/tidal-lock status.
4. **Surface & Rings Tab:**
   - Atmospheric composition and barometric surface pressure.
   - Notable geomorphic features (canyons, volcanoes, impact basins, storms). Features with known coordinates display **interactive 3D pins directly on the rotating globe**.
   - Planetary ring structures (Cassini division, Encke gap, ring brightness and composition).
5. **Moons Tab (Natural Satellite Explorer):**
   - Interactive catalogue of all known natural satellites for the parent body (e.g. 95 for Jupiter, 146 for Saturn).
   - Fidelity filtering: **All**, **Major** (3D rendered), **Regular**, and **Irregular**.
   - Real-time search by satellite name, provisional MPC designation, or orbital family.
   - Orbital parameters: semi-major axis, period, eccentricity, inclination, and retrograde indicator.
6. **Events & Timeline Tab:**
   - Chronological milestones in solar system exploration (telescopic discoveries, Mariner, Pioneer, Voyager, Galileo, Cassini-Huygens, New Horizons, JWST).
   - Sourced summaries, historical significance, and cross-links to companion bodies.

---

## 3. Epoch-Based Date Control & J2000 Ephemeris

Helios uses an analytical Keplerian ephemeris engine spanning **1800 AD through 2050 AD**:
- Click the **Calendar icon** in the top toolbar or press `T` to open the **Epoch Date Control**.
- Enter any valid calendar date (e.g. `1969-07-20` for the Apollo 11 lunar landing or `2015-07-14` for the New Horizons Pluto flyby).
- Step through time using standard intervals: **-1 Year**, **-30 Days**, **Today**, **+30 Days**, **+1 Year**.
- Select historical epoch presets (J2000.0, Voyager 2 Neptune flyby, etc.).
- All 8 planets, Ceres, and Pluto move along true 3D elliptical Keplerian trajectories calculated for that exact day.

---

## 4. Scientific Distance Measurement Caliper

Measure real-time 3D Euclidean distances between any two celestial bodies:
1. Click the **Ruler icon** in the top toolbar or press `D` to activate **Distance Caliper Mode**.
2. Click your first world in 3D (or select from the dropdown) to set **Origin A**.
3. Click your second world to set **Target B**.
4. A 3D laser caliper connects the two bodies with an interactive HUD midpoint badge.
5. The **Measurement Panel** displays:
   - Distance in Astronomical Units ($\text{AU}$)
   - Distance in Kilometers ($\text{km}$)
   - Light Travel Time (seconds, minutes, or hours based on $c = 299,792.458\text{ km/s}$)
6. Swap endpoints or clear measurements at any time. Press `Escape` or `D` to close.

---

## 5. Shareable Deep Links

Every view in Helios can be shared via URL:
- Click the **Share icon** in the header or in any detail panel.
- URLs preserve both the selected target world and the exact simulated epoch date (e.g., `/?body=jupiter&moon=europa&date=2026-09-16`).
- Opening the link on any device restores the exact camera framing, world focus, and ephemeris date.

---

## 6. Interactive Astrophysical Sandbox (`/sandbox`)

For interactive numerical experimentation, switch from the canonical reference into the **Interactive Sandbox**:
- Click **Sandbox** in the top navigation or navigate directly to `/sandbox`.

### 6.1 State Initialization & Canonical Safety
When launched, the sandbox creates an isolated deep copy of the solar system at the currently viewed epoch date. Positions and velocities are converted into SI meters and meters per second, and transformed into the system barycentre. **Nothing you modify in the sandbox can ever alter or corrupt the underlying canonical reference data.**

### 6.2 Physics Controls & Transport Bar
- **Play / Pause (`Space`):** Freezes the N-body numerical solver while leaving camera navigation and object inspection fully active.
- **Single Step (`.`):** Advances the simulation by exactly one fixed numerical timestep $\Delta t$ (default: 1 hour).
- **Time Warp (`[` / `]`):** Accelerates simulation progression from $1\times$ to $100,000\times$ without altering numerical integration accuracy.
- **Reset:** Restores the simulation to its initial state vector configuration.

### 6.3 Body Telemetry & State Vector Editing
Clicking any object in the sandbox opens the **Body Inspector**:
- **Cartesian State Vectors:** View instantaneous positions $[x, y, z]$ and velocities $[v_x, v_y, v_z]$.
- **Osculating Orbital Elements:** Real-time semi-major axis $a$, eccentricity $e$, and inclination $i$.
- **Apply Velocity Impulse (`E`):** Apply delta-v boosts ($\Delta \mathbf{v}$) in $\text{km/s}$ to alter trajectories, establish transfer orbits, or perform gravitational slingshots.
- **Mass & Dimension Adjustments:** Modify mass in Earth masses, Solar masses, or kilograms. Watch real-time surface gravity and tidal disruption boundaries adjust dynamically.

### 6.4 Spawning Presets & Test Objects
Open the **Object Browser** to inject additional celestial configurations:
- **Inner Terrestrial System:** Sun, Mercury, Venus, Earth, Mars.
- **Earth-Moon System with Lagrange Points:** Earth and Moon accompanied by test tracer particles stationed at L1–L5.
- **Binary Star Encounter:** Dual-stellar system with crossing gravitational potentials.
- **Black Hole Intrusion:** Stellar-mass black hole with a Schwarzschild event horizon and accretion disk visuals.

### 6.5 Saving & Replaying Scenarios
- Click **Save Scenario** (`S`) to store your scenario locally in IndexedDB or export it as a portable `.json` scenario file.
- Replaying a saved scenario executes the recorded command stream deterministically, reproducing identical trajectories across sessions.
