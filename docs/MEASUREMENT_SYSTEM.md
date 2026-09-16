# Scientific Distance Measurement System

This document outlines the architecture, mathematical definitions, and interaction design of the 3D scientific distance measurement caliper in Helios Observatory (`src/lib/measurement.ts`, `src/components/solar/measurement-line.tsx`, and `src/components/overlay/measurement-panel.tsx`).

---

## 1. Mathematical Principles

Helios computes real-time 3D Euclidean distances between any two celestial entities (Sun, planets, dwarf planets, or natural satellites) from their true heliocentric coordinates at the active simulation epoch:

Given bodies $A$ and $B$ with heliocentric coordinate vectors $\vec{r}_A = (x_A, y_A, z_A)$ and $\vec{r}_B = (x_B, y_B, z_B)$ in Astronomical Units (AU):

### Euclidean Distance
$$\Delta \vec{r} = \vec{r}_B - \vec{r}_A$$
$$d_{\text{AU}} = \|\Delta \vec{r}\| = \sqrt{(x_B - x_A)^2 + (y_B - y_A)^2 + (z_B - z_A)^2}$$

### Unit Conversions & Physical Constants
1. **Kilometers ($\text{km}$):**
   $$1\text{ AU} \equiv 149,597,870.7\text{ km}$$
   $$d_{\text{km}} = d_{\text{AU}} \times 149,597,870.7$$
2. **Speed of Light in Vacuum ($c$):**
   $$c \equiv 299,792.458\text{ km/s}$$
3. **Light Travel Time ($t_{\text{light}}$):**
   $$t_{\text{light}} = \frac{d_{\text{km}}}{c}$$

---

## 2. Telemetry Formatting

The engine formats light travel time into clear, human-readable units:
- $t < 60\text{ s}$: Formatted in seconds (e.g. `1.28 s` for Earth–Moon).
- $60\text{ s} \le t < 3600\text{ s}$: Formatted in light-minutes (e.g. `8.32 light minutes` for Earth–Sun).
- $t \ge 3600\text{ s}$: Formatted in light-hours (e.g. `4.16 light hours` for Earth–Neptune).

---

## 3. Natural Satellite Coordinate Resolution

For natural satellites orbiting a parent planet:
1. The parent planet's heliocentric position is computed via the J2000 ephemeris engine.
2. The satellite's relative Keplerian orbit position (semi-major axis $a_{\text{km}}$) is converted into AU:
   $$\vec{r}_{\text{rel, AU}} = \frac{\vec{r}_{\text{rel, km}}}{149,597,870.7}$$
3. The total heliocentric position of the moon is:
   $$\vec{r}_{\text{moon}} = \vec{r}_{\text{parent}} + \vec{r}_{\text{rel, AU}}$$

---

## 4. Visual 3D Representation & Interaction

- **3D Caliper Line:** Rendered as a pulsing laser line (`MeasurementLine`) between origin and target in the 3D scene.
- **Midpoint HUD:** An oriented Drei `Html` badge renders at the midpoint of the line displaying the distance in AU, km, and light time.
- **HUD Panel:** The floating `MeasurementPanel` allows switching bodies, swapping origin/target, and clearing measurements with full keyboard support (`Escape` or `D`).
- **Interactive Picking:** When measurement mode is active, clicking any planet or moon in the 3D scene assigns it directly as the source or target.
