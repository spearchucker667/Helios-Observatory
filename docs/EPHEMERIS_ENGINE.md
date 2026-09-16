# J2000 Ephemeris & Orbital Mechanics Engine

This document details the mathematical algorithms, coordinate systems, and analytical methods used in Helios Observatory's orbital mechanics engine (`src/lib/ephemeris.ts`).

---

## 1. Mathematical Framework

Helios computes the position of celestial bodies in 3D heliocentric ecliptic coordinates using Keplerian orbital elements referenced to the **J2000.0 epoch** (2000 January 1, 12:00 Terrestrial Time / Julian Date 2451545.0).

### Time Coordinate
Given any Gregorian calendar date `YYYY-MM-DD`, time $T$ in Julian centuries from J2000.0 and days $d$ from J2000.0 are calculated as:
$$d = \text{JD} - 2451545.0$$
$$T = \frac{d}{36525.0}$$

### Keplerian Orbital Elements
Each planetary body $k$ is parameterized by six orbital elements, each expressed as a baseline value at J2000 plus a secular rate of change per century:
1. **Semi-major axis ($a$):** $a(T) = a_0 + \dot{a} T$ (Astronomical Units, AU)
2. **Eccentricity ($e$):** $e(T) = e_0 + \dot{e} T$ (dimensionless)
3. **Inclination ($I$):** $I(T) = I_0 + \dot{I} T$ (degrees, converted to radians)
4. **Mean Longitude ($L$):** $L(T) = L_0 + \dot{L} T$ (degrees)
5. **Longitude of Perihelion ($\varpi$):** $\varpi(T) = \varpi_0 + \dot{\varpi} T$ (degrees)
6. **Longitude of Ascending Node ($\Omega$):** $\Omega(T) = \Omega_0 + \dot{\Omega} T$ (degrees)

The argument of perihelion is defined as $\omega = \varpi - \Omega$.

---

## 2. Solving Kepler's Equation

The Mean Anomaly $M$ is computed and normalized into $(-\pi, \pi]$:
$$M = L - \varpi$$

The Eccentric Anomaly $E$ is determined by solving Kepler's transcendental equation:
$$M = E - e \sin E$$

Helios solves this iteratively using the Newton-Raphson method, converging to high precision ($\Delta E < 10^{-7}\text{ rad}$) in typically 3 to 5 iterations:
$$E_{n+1} = E_n - \frac{E_n - e \sin E_n - M}{1 - e \cos E_n}$$

---

## 3. Heliocentric Orbital Coordinates

From the Eccentric Anomaly $E$, the orbital plane coordinates $(x', y')$ are:
$$x' = a (\cos E - e)$$
$$y' = a \sqrt{1 - e^2} \sin E$$

Helios transforms $(x', y')$ to 3D heliocentric ecliptic Cartesian coordinates $(x_h, y_h, z_h)$ in Astronomical Units:
$$x_h = x' (\cos \omega \cos \Omega - \sin \omega \sin \Omega \cos I) - y' (\sin \omega \cos \Omega + \cos \omega \sin \Omega \cos I)$$
$$y_h = x' (\sin \omega \sin I) + y' (\cos \omega \sin I)$$
$$z_h = x' (\cos \omega \sin \Omega + \sin \omega \cos \Omega \cos I) - y' (\sin \omega \sin \Omega - \cos \omega \cos \Omega \cos I)$$

The exact Euclidean distance from the Sun in AU is:
$$r_{\text{AU}} = \sqrt{x_h^2 + y_h^2 + z_h^2}$$

---

## 4. Scientific Output & Scene Mapping

The engine outputs both a pure **scientific telemetry vector** and an aesthetic **scene position**:
```typescript
type EphemerisPosition = {
  science: {
    heliocentricAu: [number, number, number];
    distanceFromSunAu: number;
  };
  scene: [number, number, number];
  // Backwards-compatible aliases
  x: number;
  y: number;
  z: number;
  distanceAu: number;
};
```

In Presentation and Distance scale modes, the raw AU coordinates are mapped into Three.js scene coordinates using the calibrated transformation functions in `src/lib/scene-scale.ts`.

---

## 5. Temporal Domain & Validity Limits

- **Supported Domain:** 1800-01-01 to 2050-12-31 AD ($d \in [-73050, +18628]$).
- **Validation:** Dates outside this interval are safely rejected by `tryDateToJ2000Days` and flagged as out of bounds rather than producing extrapolations that violate perturbation bounds.
- **Accuracy:** Positions match NASA JPL Horizons ephemerides to within $< 0.05\text{ AU}$ across inner planets and $< 0.25\text{ AU}$ for outer gas giants over the entire two-century window.
