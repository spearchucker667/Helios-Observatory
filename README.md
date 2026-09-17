# Helios Observatory

[![CI](https://github.com/spearchucker667/Helios-Observatory/actions/workflows/ci.yml/badge.svg)](https://github.com/spearchucker667/Helios-Observatory/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7_Strict-blue.svg)](https://www.typescriptlang.org/)
[![ESLint](https://img.shields.io/badge/ESLint-Zero_Warnings-success.svg)](https://eslint.org/)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen.svg)](./docs/TESTING.md)

**Helios Observatory** is an interactive, scientifically rigorous 3D orrery and astronomical reference platform for the Solar System. Combining analytical Keplerian ephemerides, NASA/JPL data registries, a complete 461-moon natural satellite catalogue, 3D surface feature inspection, real-time distance calipers, and deep-space logarithmic continuum layers, Helios bridges exploratory computer graphics with institutional astronomical precision.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/miku-space/helios-miku-lockup-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="public/assets/miku-space/helios-miku-lockup-light.svg" />
    <img
      src="public/assets/miku-space/helios-miku-lockup-dark.svg"
      alt="Helios Observatory — Miku orbital edition"
      width="900"
    />
  </picture>
</p>

> **Disclaimer:** Helios Observatory is an unofficial open-source project. Space-agency styling and Miku-inspired visual elements do not imply affiliation with or endorsement by NASA, Crypton Future Media, or Piapro.

---

## Key Capabilities

### 1. Analytical J2000 Ephemeris & Epoch Date Control
- **True Keplerian Elliptical Orbits:** Planets and dwarf planets move along 3D elliptical trajectories calculated from J2000 secular orbital elements rather than simplified concentric circles.
- **Continuous Temporal Interval (1800–2050 AD):** Set any historical or future calendar date (e.g., Apollo 11 moon landing in 1969, New Horizons Pluto flyby in 2015, or contemporary observations).
- **Physical Telemetry Vectors:** Computes true heliocentric Cartesian vectors $[x_h, y_h, z_h]$ in Astronomical Units ($\text{AU}$) and scalar distance from the Sun.

### 2. Comprehensive 461-Moon Natural Satellite Catalogue
- **Institutional Census (August 2026 Baseline):** Catalogues all 456 planetary moons across all eight planets plus all 5 satellites of Pluto, referenced to NASA/JPL Solar System Dynamics and the IAU Minor Planet Center.
- **Fidelity Tiers:**
  - **Tier 1 (Major Moons — 21 bodies):** 3D textured globes with tidal locking, surface feature markers, and real-time motion tracking (Moon, Phobos, Deimos, Galilean moons, Titan, Enceladus, Triton, Charon, etc.).
  - **Tier 2 (Regular Satellites — 38 bodies):** Catalogued with orbital parameters, semi-major axis, period, and dynamical families.
  - **Tier 3 (Irregular Satellites — 402 bodies):** Distant retrograde and prograde captured planetesimals organized into dynamical clusters (Norse, Inuit, Gallic, Pasiphae).
- **Satellite Explorer:** Interactive filterable and searchable catalogue inside the planet detail panel.

### 3. Dwarf Planet Classification
- Includes **Ceres** (largest body in the asteroid belt) and **Pluto** (with major moon Charon and Nix, Hydra, Kerberos, Styx) modeled using the first-class `dwarf-planet` body architecture.

### 4. Interactive Scientific Distance Caliper
- **3D Laser Caliper:** Connect any two celestial bodies in 3D space.
- **Precision Telemetry:** Real-time calculation of Euclidean distance in Astronomical Units ($\text{AU}$), kilometers ($\text{km}$, $1\text{ AU} = 149,597,870.7\text{ km}$), and vacuum light travel time ($c = 299,792.458\text{ km/s}$).
- **Midpoint HUD & Caliper Panel:** Keyboard navigable (`D` / `Escape`) with endpoint swapping and origin-target selection.

### 5. Deep-Space Continuum & Oort Cloud Layer
- **Logarithmic Spatial Scale:** Smoothly maps distances from the planetary boundary (30 AU) through the Kuiper Belt (30–55 AU), inner Hills Cloud (2,000–20,000 AU), to the outer spherical Oort Cloud (~100,000 AU) into WebGL camera space without clipping or $Z$-fighting.
- **Scientific Honesty Disclaimer:** Highlights the Oort Cloud as an inferred dynamical comet reservoir rather than a directly imaged surface.

### 6. Surface Inspection & Feature Markers
- **Interactive Globe Markers:** Geomorphic formations (volcanoes, canyons, impact basins, atmospheric storms) display 3D marker pins positioned at exact latitude/longitude coordinates on rotating planetary globes.
- **Detailed Interior & Atmosphere:** Stratified core/mantle descriptions, global magnetic field summaries, and atmospheric gas fractions with barometric surface pressures.

### 7. Precise Deep-Link Hydration
- URLs seamlessly preserve focused worlds, major moons, and the exact simulation epoch date (e.g., `/?body=jupiter&moon=europa&date=2026-09-16`), restoring exact camera framing on load.

---

## Celestial Body Matrix

| Class | Celestial Bodies | Confirmed Satellites | Notable Features & Rings |
| :--- | :--- | :--- | :--- |
| **Star** | Sun | — | Granulation shader, core corona glow |
| **Terrestrial Planets** | Mercury, Venus, Earth, Mars | Earth (1), Mars (2) | Caloris Basin, Maxwell Montes, Olympus Mons, Valles Marineris |
| **Gas Giants** | Jupiter, Saturn | Jupiter (115), Saturn (293) | Great Red Spot, Galilean moons, prominent rings, Cassini Division, Encke Gap |
| **Ice Giants** | Uranus, Neptune | Uranus (29), Neptune (16) | Tilted retrograde spin, Miranda cliffs, Great Dark Spot, Triton plumes |
| **Dwarf Planets** | Ceres, Pluto | Pluto (5) | Occator crater bright spots, Sputnik Planitia, Tombaugh Regio, Charon |
| **Minor Belts** | Asteroid Belt, Kuiper Belt | — | Procedural instanced asteroids, trans-Neptunian objects |
| **Comet Reservoirs** | Oort Cloud (Hills + Outer Shell) | — | 2,000 to 100,000 AU logarithmic continuum |

---

## Quickstart

### Prerequisites
- Node.js **22.x LTS**
- WebGL 2.0 capable graphics hardware

### Running Locally
```bash
# Clone the repository
git clone https://github.com/spearchucker667/Helios-Observatory.git
cd Helios-Observatory

# Install dependencies
npm install

# Start development server (bound to 0.0.0.0:8080)
npm run dev

# Run automated test suites (114 tests)
npm test

# Run strict zero-warning linter and typecheck
npm run lint
npm run typecheck

# Build and preview production distribution
npm run build
npm run preview:restart
```

---

## Controls Summary

| Shortcut | Action |
| :--- | :--- |
| `Space` | Pause / unpause simulation |
| `0` … `8` | Focus Sun (`0`), Mercury (`1`) through Neptune (`8`) |
| `D` | Toggle Scientific Distance Caliper |
| `T` | Toggle Epoch Date Control & Stepper |
| `C` | Toggle Multi-World Comparison Matrix |
| `⌘K` / `Ctrl+K` | Search Palette across bodies, satellites, features, and events |
| `R` | Reset view to system barycentre |
| `Backspace` | Navigate up hierarchy (moon → planet → solar system) |
| `L` / `O` / `M` | Toggle Labels (`L`), Orbital trails (`O`), Moon visibility mode (`M`) |
| `[` / `]` | Halve / double simulation speed ($0.25\times$ to $16\times$) |
| `Escape` | Dismiss dialogs, clear measurement points, or deselect |

See [docs/CONTROLS.md](./docs/CONTROLS.md) for touch and mouse gesture mappings.

---

## Documentation Directory

The complete technical and astronomical documentation suite is maintained under [`docs/`](./docs/):

| Document | Description |
| :--- | :--- |
| [docs/INSTALLATION.md](./docs/INSTALLATION.md) | Comprehensive installation, hardware requirements, and environment setup. |
| [docs/USER_GUIDE.md](./docs/USER_GUIDE.md) | User manual for 3D exploration, calipers, satellite browsing, and sharing. |
| [docs/CONTROLS.md](./docs/CONTROLS.md) | Complete pointer, touch, and keyboard shortcut reference. |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, 3D scene graph, state stores, and rendering pipeline. |
| [docs/EPHEMERIS_ENGINE.md](./docs/EPHEMERIS_ENGINE.md) | Keplerian mechanics, Newton-Raphson solver, and J2000 orbital elements. |
| [docs/SATELLITE_CATALOGUE.md](./docs/SATELLITE_CATALOGUE.md) | 461-moon catalogue architecture, MPC/JPL baselines, and fidelity tiers. |
| [docs/MEASUREMENT_SYSTEM.md](./docs/MEASUREMENT_SYSTEM.md) | 3D Euclidean distance calculations in AU, km, and light travel time. |
| [docs/DEEP_SPACE_SCALE.md](./docs/DEEP_SPACE_SCALE.md) | Continuous piecewise logarithmic scaling and Oort Cloud dynamical model. |
| [docs/ASTRONOMICAL_DATA.md](./docs/ASTRONOMICAL_DATA.md) | Canonical data sources, institutional references, and honesty policy. |
| [docs/ASSET_PIPELINE.md](./docs/ASSET_PIPELINE.md) | Scalable vector SVG assets, manifest schema, and texture management. |
| [docs/ASSET_ATTRIBUTION.md](./docs/ASSET_ATTRIBUTION.md) | Attribution for planetary textures, spacecraft imagery, and vector assets. |
| [docs/ACCESSIBILITY.md](./docs/ACCESSIBILITY.md) | WCAG 2.1 AA compliance, keyboard focus trapping, ARIA roles, and contrast. |
| [docs/PERFORMANCE.md](./docs/PERFORMANCE.md) | 60 FPS budget, GPU draw calls, LOD distance thresholds, and memory disposal. |
| [docs/TESTING.md](./docs/TESTING.md) | Automated Node test runner, integrity assertions, and smoke verification. |
| [docs/TROUBLESHOOTING.md](./docs/TROUBLESHOOTING.md) | WebGL context loss, port binding, and headless container troubleshooting. |
| [docs/RELEASE_PROCESS.md](./docs/RELEASE_PROCESS.md) | Quality gates checklist, semantic versioning, and release workflow. |
| [docs/LEGAL.md](./docs/LEGAL.md) | Apache-2.0 licensing, patent grants, trademark policy, and export compliance. |
| [docs/THIRD_PARTY_NOTICES.md](./docs/THIRD_PARTY_NOTICES.md) | Third-party software dependencies and open data citations. |
| [docs/ROADMAP.md](./docs/ROADMAP.md) | Future engineering milestones and astronomical feature backlog. |
| [docs/SCREENSHOTS.md](./docs/SCREENSHOTS.md) | High-resolution visual gallery and responsive viewport captures. |
| [docs/SECURITY_POLICY.md](./docs/SECURITY_POLICY.md) | Security vulnerability reporting and client-side threat model. |
| [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) | Developer guide, code style conventions, and startup script contracts. |

---

## License

Helios Observatory is open-source software licensed under the **Apache License, Version 2.0**.  
See the [LICENSE](./LICENSE) and [NOTICE](./NOTICE) files for details.
