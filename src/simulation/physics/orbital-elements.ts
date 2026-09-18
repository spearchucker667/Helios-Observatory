import { G_CODATA_2022 } from "../domain/constants.ts";
import type { Vector3 } from "./vector.ts";
import { vec3Cross, vec3Dot, vec3Mag } from "./vector.ts";

export interface OrbitalElements {
  semiMajorAxisM: number; // a (m)
  eccentricity: number; // e (dimensionless)
  inclinationDeg: number; // i (deg)
  longitudeOfAscendingNodeDeg: number; // Omega (deg)
  argumentOfPeriapsisDeg: number; // omega (deg)
  trueAnomalyDeg: number; // nu (deg)
  periodSeconds?: number; // P (s)
  isBound: boolean;
}

export interface CartesianState {
  positionM: Vector3;
  velocityMs: Vector3;
}

/**
 * Converts Cartesian relative state (r, v) to osculating Keplerian orbital elements.
 * @param relPos Position of child relative to parent (m)
 * @param relVel Velocity of child relative to parent (m/s)
 * @param parentMassKg Mass of parent body (kg)
 * @param childMassKg Mass of child body (kg, default 0)
 */
export function cartesianToOrbitalElements(
  relPos: Vector3,
  relVel: Vector3,
  parentMassKg: number,
  childMassKg = 0
): OrbitalElements {
  const mu = G_CODATA_2022 * (parentMassKg + childMassKg);
  const r = vec3Mag(relPos);
  const v = vec3Mag(relVel);

  if (r === 0 || mu === 0) {
    return {
      semiMajorAxisM: 0,
      eccentricity: 0,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 0,
      trueAnomalyDeg: 0,
      isBound: false,
    };
  }

  // Specific angular momentum h = r x v
  const hVec = vec3Cross(relPos, relVel);
  const h = vec3Mag(hVec);

  // Node vector n = k x h = [-h_y, h_x, 0]
  const nVec: Vector3 = [-hVec[1], hVec[0], 0];
  const n = vec3Mag(nVec);

  // Eccentricity vector eVec = ( (v^2 - mu/r)*r - (r.v)*v ) / mu
  const rDotV = vec3Dot(relPos, relVel);
  const vSqMinusMuOverR = v * v - mu / r;
  const eVec: Vector3 = [
    (vSqMinusMuOverR * relPos[0] - rDotV * relVel[0]) / mu,
    (vSqMinusMuOverR * relPos[1] - rDotV * relVel[1]) / mu,
    (vSqMinusMuOverR * relPos[2] - rDotV * relVel[2]) / mu,
  ];
  let e = vec3Mag(eVec);
  if (e < 1e-12) e = 0;

  // Specific orbital energy
  const specificEnergy = 0.5 * v * v - mu / r;
  const isBound = specificEnergy < 0;

  // Semi-major axis
  let a = 0;
  if (Math.abs(1 - e) > 1e-8) {
    a = -mu / (2 * specificEnergy);
  } else {
    // Parabolic limit: use periapsis distance
    a = (h * h) / (2 * mu);
  }

  // Inclination i = acos(h_z / h)
  const iRad = Math.acos(Math.max(-1, Math.min(1, hVec[2] / (h > 0 ? h : 1))));

  // Longitude of ascending node Omega
  let omegaNodeRad = 0;
  if (n > 1e-12) {
    omegaNodeRad = Math.acos(Math.max(-1, Math.min(1, nVec[0] / n)));
    if (nVec[1] < 0) {
      omegaNodeRad = 2 * Math.PI - omegaNodeRad;
    }
  }

  // Argument of periapsis omega
  let omegaPeriRad = 0;
  if (n > 1e-12 && e > 1e-12) {
    const dotN_e = vec3Dot(nVec, eVec);
    omegaPeriRad = Math.acos(Math.max(-1, Math.min(1, dotN_e / (n * e))));
    if (eVec[2] < 0) {
      omegaPeriRad = 2 * Math.PI - omegaPeriRad;
    }
  } else if (e > 1e-12) {
    // Equatorial orbit
    omegaPeriRad = Math.atan2(eVec[1], eVec[0]);
    if (omegaPeriRad < 0) omegaPeriRad += 2 * Math.PI;
  }

  // True anomaly nu
  let nuRad = 0;
  if (e > 1e-12) {
    const dotE_r = vec3Dot(eVec, relPos);
    nuRad = Math.acos(Math.max(-1, Math.min(1, dotE_r / (e * r))));
    if (rDotV < 0) {
      nuRad = 2 * Math.PI - nuRad;
    }
  } else {
    // Circular orbit: use angle from ascending node or x-axis
    if (n > 1e-12) {
      const dotN_r = vec3Dot(nVec, relPos);
      nuRad = Math.acos(Math.max(-1, Math.min(1, dotN_r / (n * r))));
      if (relPos[2] < 0) nuRad = 2 * Math.PI - nuRad;
    } else {
      nuRad = Math.atan2(relPos[1], relPos[0]);
      if (nuRad < 0) nuRad += 2 * Math.PI;
    }
  }

  // Period for elliptical bound orbits
  let periodSeconds: number | undefined;
  if (isBound && a > 0) {
    periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
  }

  const radToDeg = 180 / Math.PI;

  return {
    semiMajorAxisM: a,
    eccentricity: e,
    inclinationDeg: iRad * radToDeg,
    longitudeOfAscendingNodeDeg: omegaNodeRad * radToDeg,
    argumentOfPeriapsisDeg: omegaPeriRad * radToDeg,
    trueAnomalyDeg: nuRad * radToDeg,
    periodSeconds,
    isBound,
  };
}

/** |1 - e^2| below this value is treated as the parabolic conic. */
export const PARABOLIC_ECC_EXCESS = 1e-8;

/**
 * Semi-latus rectum for any conic section.
 *
 *   ellipse:      a > 0, e < 1  ->  p = a (1 - e^2)  > 0
 *   parabola:     e = 1        ->  p = 2 |a|        (with a = q)
 *   hyperbola:    a < 0, e > 1  ->  p = a (1 - e^2) > 0
 *
 * The signed expression a (1 - e^2) is already positive for hyperbolic orbits;
 * the previous |1 - e^2| formulation flipped its sign and produced a negative
 * semi-latus rectum (hence a NaN state vector) for every unbound orbit.
 */
export function semiLatusRectum(semiMajorAxisM: number, eccentricity: number): number {
  const oneMinusESq = 1 - eccentricity * eccentricity;
  if (Math.abs(oneMinusESq) <= PARABOLIC_ECC_EXCESS) return 2 * Math.abs(semiMajorAxisM);
  return semiMajorAxisM * oneMinusESq;
}

/**
 * Converts Keplerian orbital elements to Cartesian relative state (r, v).
 *
 * Valid for elliptic (e < 1), parabolic (e = 1) and hyperbolic (e > 1) conics.
 * Throws for a true anomaly outside the physically reachable cone of a
 * hyperbolic orbit instead of returning a non-finite state.
 */
export function orbitalElementsToCartesian(
  elements: OrbitalElements,
  parentMassKg: number,
  childMassKg = 0
): CartesianState {
  const mu = G_CODATA_2022 * (parentMassKg + childMassKg);
  const a = elements.semiMajorAxisM;
  const e = Math.max(0, elements.eccentricity);

  const degToRad = Math.PI / 180;
  const iRad = elements.inclinationDeg * degToRad;
  const OmegaRad = elements.longitudeOfAscendingNodeDeg * degToRad;
  const omegaRad = elements.argumentOfPeriapsisDeg * degToRad;
  const nuRad = elements.trueAnomalyDeg * degToRad;

  // Semi-latus rectum, valid for all three conic types.
  const p = semiLatusRectum(a, e);
  if (!Number.isFinite(p) || p <= 0) {
    throw new Error(
      `Undefined conic: semi-latus rectum ${p} for a=${a} m, e=${e}. ` +
        "Elliptic (e<1), parabolic (e=1) and hyperbolic (e>1) orbits require a finite semi-major axis."
    );
  }

  const radialDenominator = 1 + e * Math.cos(nuRad);
  if (radialDenominator <= 0) {
    throw new Error(
      `True anomaly ${elements.trueAnomalyDeg} deg lies outside the reachable cone of a hyperbolic orbit (e=${e}).`
    );
  }
  const r = p / radialDenominator;

  // Perifocal coordinates
  const r_perifocal: Vector3 = [r * Math.cos(nuRad), r * Math.sin(nuRad), 0];

  const h = Math.sqrt(mu * p);
  const v_perifocal: Vector3 = [
    -(mu / h) * Math.sin(nuRad),
    (mu / h) * (e + Math.cos(nuRad)),
    0,
  ];

  // Coordinate transformation matrix from perifocal to heliocentric ecliptic
  // P_x, P_y, P_z (unit vector toward periapsis)
  // Q_x, Q_y, Q_z (unit vector toward true anomaly 90 deg)
  const cosO = Math.cos(OmegaRad);
  const sinO = Math.sin(OmegaRad);
  const cosi = Math.cos(iRad);
  const sini = Math.sin(iRad);
  const cosw = Math.cos(omegaRad);
  const sinw = Math.sin(omegaRad);

  const P: Vector3 = [
    cosO * cosw - sinO * sinw * cosi,
    sinO * cosw + cosO * sinw * cosi,
    sinw * sini,
  ];

  const Q: Vector3 = [
    -cosO * sinw - sinO * cosw * cosi,
    -sinO * sinw + cosO * cosw * cosi,
    cosw * sini,
  ];

  const pos: Vector3 = [
    r_perifocal[0] * P[0] + r_perifocal[1] * Q[0],
    r_perifocal[0] * P[1] + r_perifocal[1] * Q[1],
    r_perifocal[0] * P[2] + r_perifocal[1] * Q[2],
  ];

  const vel: Vector3 = [
    v_perifocal[0] * P[0] + v_perifocal[1] * Q[0],
    v_perifocal[0] * P[1] + v_perifocal[1] * Q[1],
    v_perifocal[0] * P[2] + v_perifocal[1] * Q[2],
  ];

  return { positionM: pos, velocityMs: vel };
}
