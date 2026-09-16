# Asset Attribution & Provenance

This document records the provenance, license status, and authorship of visual assets and graphics in Helios Observatory.

---

## 1. Primary Vector & Procedural Graphics Inventory

| Asset Path | Class | Source / Authorship | License |
| :--- | :--- | :--- | :--- |
| `src/components/solar/textures.ts` | Procedural Canvas Textures | Original project code | Apache-2.0 |
| `src/components/solar/ring-systems.ts` | Procedural Ring Generators | Original project code | Apache-2.0 |
| `src/components/solar/bodies.tsx` | Procedural Sun GLSL Shader | Original project code | Apache-2.0 |
| `public/favicon.svg` | Scalable Vector Graphic | Original project artwork | Apache-2.0 |
| `public/assets/branding/og-card.svg` | Scalable Vector Graphic | Original project artwork | Apache-2.0 |
| `public/assets/branding/helios-wordmark.svg` | Scalable Vector Graphic | Original project artwork | Apache-2.0 |
| `public/assets/icons/orbit-mark.svg` | Scalable Vector Graphic | Original project artwork | Apache-2.0 |
| `public/assets/icons/caliper.svg` | Scalable Vector Graphic | Original project artwork | Apache-2.0 |
| `public/assets/icons/epoch-clock.svg` | Scalable Vector Graphic | Original project artwork | Apache-2.0 |
| `public/assets/diagrams/*.svg` | Scalable Vector Graphics | Original project artwork | Apache-2.0 |
| `public/assets/miku-space/*.svg` | Scalable Vector Graphics | Original artwork (Helios asset pack) | Apache-2.0 |
| `public/assets/miku-space/animated/*.gif` | Animated Sprites | Derived from Miku orbital telemetry sprites | Unofficial / Fair Use (see below) |

---

## 2. Space-Agency Styling & Miku Space Asset Pack

The SVG marks and layouts under `public/assets/miku-space/` are original artwork created for Helios Observatory:
- **Design Inspiration:** Styled after retro-futuristic mission control and space agency aesthetics. They deliberately avoid copying or reproducing NASA's official meatball insignia, seal, or worm logotype.
- **Hatsune Miku IP Notice:** Hatsune Miku is a character/IP associated with Crypton Future Media / Piapro. Helios Observatory is an independent, non-commercial open-source project and claims no affiliation with, sponsorship from, or endorsement by Crypton Future Media, Piapro, or NASA.
- **Pure Vector Delivery:** In-app production views utilize clean, lightweight SVGs with zero embedded raster payloads. Animated GIFs are strictly opt-in, non-essential, and respect the browser's `prefers-reduced-motion` media query.

---

## 3. Scientific Data Provenance

All planetary constants, orbital elements, feature coordinates, and natural satellite data are derived from public domain US Government datasets published by:
- NASA Goddard Space Flight Center (GSFC)
- NASA Jet Propulsion Laboratory (JPL)
- USGS Astrogeology Science Center
- International Astronomical Union (IAU) Minor Planet Center (MPC)

Full citations and URLs are maintained in `src/data/sources.ts` and documented in [docs/ASTRONOMICAL_DATA.md](./ASTRONOMICAL_DATA.md).
