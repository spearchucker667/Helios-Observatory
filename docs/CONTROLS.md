# Controls & Keybindings Reference

This document provides a comprehensive reference for pointer gestures, keyboard shortcuts, touch interactions, and search commands in Helios Observatory.

---

## 1. Pointer & Mouse Controls

| Gesture | Action |
| :--- | :--- |
| **Left Click + Drag** | Orbit camera around the currently focused celestial body or system barycentre. |
| **Right Click + Drag** / **Two-Finger Drag** | Pan the orbital camera plane. |
| **Scroll Wheel / Pinch** | Zoom in or out (smoothly clamped to avoid clipping through planetary surfaces, atmospheres, or rings). |
| **Click Celestial Body** | Focus camera, initiate approach trajectory, and open the scientific detail panel. |
| **Click Moon / Satellite** | Focus camera directly on the natural satellite with exact synchronous motion tracking. |
| **Click in Caliper Mode** | Select body as measurement origin (Point A) or target (Point B). |

---

## 2. Global Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Space` | Pause / Resume | Freezes or unfreezes simulation clock and ephemeris progression. |
| `0` | Select Sun | Focuses the central star. |
| `1` … `8` | Select Planet | Focuses Mercury (`1`) through Neptune (`8`) in orbital order. |
| `D` | Distance Caliper | Opens the scientific 3D distance measurement caliper. |
| `T` | Epoch Date Control | Opens the J2000 calendar date picker and ephemeris stepper. |
| `C` | Compare Worlds | Opens the multi-body comparison matrix (up to 4 worlds). |
| `⌘K` / `Ctrl+K` | Search Palette | Opens the global search palette across worlds, features, satellites, and events. |
| `R` | Reset View | Returns camera to the system-wide barycentric perspective. |
| `Backspace` | Return to Parent | Traverses up the hierarchy (satellite → planet → solar system). |
| `L` | Toggle Labels | Toggles 3D celestial text labels on or off. |
| `O` | Toggle Orbits | Shows or hides elliptical orbital paths and motion wakes. |
| `M` | Moon Mode | Cycles moon visibility (`auto` → `always` → `hidden`). |
| `[` / `]` | Simulation Pace | Halves (`[`) or doubles (`]`) simulation speed ($0.25\times$ to $16\times$). |
| `Esc` | Dismiss / Deselect | Closes active dialogs (Search, Caliper, Compare, Epoch), then deselects focused world. |
| `Tab` / `Shift+Tab` | Keyboard Focus | Moves focus between interactive controls, buttons, and tablists. |

---

## 3. Search Palette (`⌘K` / `Ctrl+K`)

The global search palette provides instant fuzzy search across four major catalogs:
- **Major Worlds:** Sun, 8 planets, Ceres, and Pluto.
- **Natural Satellites:** All 461 confirmed moons categorized by parent planet (e.g. "Europa (Jupiter)", "Titan (Saturn)", "Charon (Pluto)").
- **Surface Features:** Geomorphic formations with geographic coordinates (e.g. "Olympus Mons", "Valles Marineris", "Great Red Spot", "Caloris Planitia").
- **Historical Events:** Spacecraft encounters and telescopic milestones (e.g. "Voyager 2 Neptune", "New Horizons Pluto", "Apollo 11").
- **Deep-Space Regions:** Kuiper Belt and Oort Cloud dynamical reservoirs.

Use `↑`/`↓` to navigate search hits, `Enter` to select and focus the target in 3D, and `Esc` to dismiss.

---

## 4. Compare Dialog (`C`)

Click celestial chips to select up to four worlds simultaneously. The matrix compares nine physical and orbital metrics in a semantic, accessible data table:
1. Mean Diameter (km or miles)
2. Surface Gravity ($g$ or $\text{m/s}^2$)
3. Mass ($M_\oplus$ or $\text{kg}$)
4. Bulk Density ($\text{g/cm}^3$)
5. Mean Temperature ($\text{°C}$ or $\text{°F}$)
6. Sidereal Day Length (hours or days)
7. Orbital Year (days or Earth years)
8. Axial Obliquity / Tilt (degrees)
9. Confirmed Natural Satellites Count

---

## 5. Touch & Mobile Interactions

- **Worlds Carousel:** Swipe horizontally across the bottom bar to inspect and select celestial worlds.
- **Detail Sheet:** Selecting a body slides up a touch-friendly bottom sheet. Dragging the top pill downward collapses the sheet.
- **Touch Target Sizing:** All mobile buttons and tab buttons maintain a minimum $44\times44\text{ px}$ interactive touch area complying with WCAG 2.1 Success Criterion 2.5.5.

---

## 6. Sandbox Mode Shortcuts (`/sandbox`)

When navigating the Interactive Astrophysical Sandbox, the following dedicated controls are active:

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `Space` | Pause / Resume | Pauses or resumes authoritative N-body integration in the worker thread. |
| `.` | Single Step | Steps the physics simulation forward by exactly one numerical step $\Delta t$. |
| `[` / `]` | Time Warp | Halves (`[`) or doubles (`]`) time acceleration without changing integration $\Delta t$. |
| `I` | Object Inspector | Toggles Cartesian state-vector telemetry and orbital element readout. |
| `E` | Velocity Impulse | Opens 3D velocity vector manipulation inputs ($\Delta \mathbf{v}$ in $\text{km/s}$). |
| `B` | Object Browser | Opens the searchable list of active celestial bodies and tracer particles. |
| `P` | Spawn Presets | Opens the astrophysical preset spawning menu (Lagrange points, binary stars, black holes). |
| `S` | Save Scenario | Prompts to save the current simulation state to local storage or export as JSON. |
| `R` | Reset Simulation | Resets current scenario state vectors back to initial snapshot conditions. |

