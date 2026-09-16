# Deep-Space Coordinate Scaling & Oort Cloud Model

This document explains the continuous logarithmic spatial transformation used to render outer solar system structures from the Kuiper Belt (30–55 AU) to the outer Oort Cloud (~100,000 AU) within Helios Observatory (`src/lib/deep-space-scale.ts`, `src/components/solar/kuiper-belt.tsx`, and `src/components/solar/oort-cloud.tsx`).

---

## 1. The Dynamic Range Challenge

The physical Solar System spans enormous orders of magnitude:
- **Inner Planets:** Mercury to Mars occupy 0.38 to 1.5 AU.
- **Outer Planets:** Jupiter to Neptune extend out to 30 AU.
- **Kuiper Belt:** Classical Edgeworth-Kuiper belt extends from 30 to ~55 AU.
- **Inner Oort Cloud (Hills Cloud):** 2,000 to ~20,000 AU.
- **Outer Oort Cloud:** ~20,000 to 100,000+ AU.

A purely linear scale would either compress the inner planets into a sub-pixel clump or push the outer Oort cloud millions of scene units away, destroying WebGL depth buffer precision ($Z$-fighting).

---

## 2. Continuous Piecewise-Logarithmic Scaling

Helios implements a strictly monotonic, continuous scaling function $S(r)$ mapping heliocentric distance $r$ in AU to Three.js scene units:

### Region 1: Planetary Realm ($0 \le r \le 30\text{ AU}$)
Linear transition matching planetary presentation scaling:
$$S(r) = r \times \frac{R_{\text{boundary}}}{30.0}$$
Where $R_{\text{boundary}} = 100\text{ units}$.

### Region 2: Deep Space & Oort Cloud ($r > 30\text{ AU}$)
Logarithmic mapping smoothly joined at $r = 30\text{ AU}$:
$$S(r) = R_{\text{boundary}} + K \times \ln\left(1 + \frac{r - 30}{r_0}\right)$$
Where $K \approx 18.49$ and $r_0 = 30\text{ AU}$, chosen such that:
- $r = 30\text{ AU}$ (Neptune) maps to exactly $100\text{ units}$.
- $r = 50\text{ AU}$ (Kuiper Belt) maps to $\approx 107\text{ units}$.
- $r = 2,000\text{ AU}$ (Inner Hills Cloud) maps to $\approx 177\text{ units}$.
- $r = 100,000\text{ AU}$ (Outer Oort Cloud) maps to $\approx 250\text{ units}$.

This ensures the entire 100,000 AU expanse remains completely renderable within the default WebGL camera frustum ($Z_{\text{far}} = 2000$) with zero clipping and high numerical stability.

---

## 3. Scientific Inferences & Visual Disclaimer

The Oort Cloud is rendered with strict adherence to the project's scientific honesty policy:
- **Inner Hills Cloud:** Modeled as a toroidal ring of icy planetesimals concentrated near the ecliptic plane.
- **Outer Cloud:** Modeled as an isotropic spherical shell.
- **Scientific Disclaimer:** Unlike the planets and moons, the Oort Cloud has not been directly imaged by spacecraft or optical telescopes. It is a theoretically inferred dynamical reservoir of long-period comets based on orbital inclinations and aphelia. Helios explicitly highlights this in the UI and region documentation.
