/**
 * J2000 Ephemeris and Keplerian Orbit Engine
 *
 * Implements analytical Keplerian orbital elements and secular rates for solar system bodies:
 *
 * Provenance:
 * 1. Major Planets (Mercury through Neptune):
 *    NASA JPL Planetary Ephemeris (E.M. Standish, 1992, "Keplerian Elements for Approximate
 *    Positions of the Major Planets", Table 1). Referenced to the J2000 mean ecliptic and equinox.
 *    Accuracy tolerance: sub-arcminute (inner planets < 0.005 AU, outer giants < 0.05 AU) across 1800-2050 AD.
 *
 * 2. Dwarf Planet Pluto:
 *    Standish (1992) Table 1 historical secular baseline. Because Pluto exhibits a 3:2 mean-motion
 *    resonance with Neptune and a high 17.14° inclination, linear secular rates provide approximate
 *    orbital positions with an accuracy tolerance of ~0.1 AU (~0.3% of 39 AU) over 1800-2050 AD.
 *
 * 3. Dwarf Planet Ceres:
 *    Independent provenance from NASA JPL Small-Body Database (SBDB Solution #40) and IAU Minor
 *    Planet Center (MPC) asteroid orbit elements (Epoch J2000.0). Not included in Standish (1992) Table 1.
 *    Accuracy tolerance: ~0.05 AU (~1.8%) across 1800-2050 AD.
 */

import type { ScaleMode } from "@/lib/format";

export const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0); // JD 2451545.0
const MS_PER_DAY = 86_400_000;
const DAYS_PER_CENTURY = 36525;
const DEG_TO_RAD = Math.PI / 180;

export type KeplerElements = {
  /** Semi-major axis in AU */
  a: number;
  /** Rate of semi-major axis (AU / century) */
  aDot: number;
  /** Eccentricity */
  e: number;
  /** Rate of eccentricity (1 / century) */
  eDot: number;
  /** Inclination in degrees */
  I: number;
  /** Rate of inclination (deg / century) */
  IDot: number;
  /** Mean longitude in degrees */
  L: number;
  /** Rate of mean longitude (deg / century) */
  LDot: number;
  /** Longitude of perihelion in degrees */
  longPeri: number;
  /** Rate of longitude of perihelion (deg / century) */
  longPeriDot: number;
  /** Longitude of ascending node in degrees */
  longNode: number;
  /** Rate of longitude of ascending node (deg / century) */
  longNodeDot: number;
  /** Visual presentation semi-major axis in scene units */
  presentationA: number;
  /** Source catalog and authority provenance (HEL-P1-003) */
  provenance?: {
    source: string;
    authority: string;
    toleranceAu: number;
  };
};

/**
 * Orbital elements referenced to J2000 mean ecliptic and equinox.
 * Sources:
 * - Mercury-Neptune: Standish (1992) Table 1 / NASA JPL SSD
 * - Pluto: Standish (1992) Table 1 (resonant linear approximation)
 * - Ceres: NASA JPL SBDB (Solution #40) / IAU MPC
 */
export const KEPLER_TABLE: Record<string, KeplerElements> = {
  mercury: {
    a: 0.38709927,
    aDot: 0.00000037,
    e: 0.20563593,
    eDot: 0.00001906,
    I: 7.00497902,
    IDot: -0.00594749,
    L: 252.2503235,
    LDot: 149472.67411175,
    longPeri: 77.45779628,
    longPeriDot: 0.16047689,
    longNode: 48.33076593,
    longNodeDot: -0.12534081,
    presentationA: 6.2,
  },
  venus: {
    a: 0.72333566,
    aDot: 0.0000039,
    e: 0.00677672,
    eDot: -0.00004107,
    I: 3.39467605,
    IDot: -0.0007889,
    L: 181.9790995,
    LDot: 58517.81538729,
    longPeri: 131.60246718,
    longPeriDot: 0.00268329,
    longNode: 76.67984255,
    longNodeDot: -0.27769418,
    presentationA: 8.6,
  },
  earth: {
    a: 1.00000261,
    aDot: 0.00000562,
    e: 0.01671123,
    eDot: -0.00004392,
    I: -0.00001531,
    IDot: -0.01294668,
    L: 100.46457166,
    LDot: 35999.37244981,
    longPeri: 102.93768193,
    longPeriDot: 0.32327364,
    longNode: 0.0,
    longNodeDot: 0.0,
    presentationA: 11.6,
  },
  mars: {
    a: 1.52371034,
    aDot: 0.00001847,
    e: 0.0933941,
    eDot: 0.00007882,
    I: 1.84969142,
    IDot: -0.00813131,
    L: -4.55343205,
    LDot: 19140.30268499,
    longPeri: -23.94362959,
    longPeriDot: 0.44441088,
    longNode: 49.55953891,
    longNodeDot: -0.29257343,
    presentationA: 15.4,
  },
  ceres: {
    a: 2.7675,
    aDot: 0.00002,
    e: 0.0758,
    eDot: 0.00001,
    I: 10.593,
    IDot: -0.003,
    L: 80.65,
    LDot: 7819.33,
    longPeri: 153.35,
    longPeriDot: 0.21,
    longNode: 80.327,
    longNodeDot: -0.18,
    presentationA: 19.8,
    provenance: {
      source: "NASA JPL Small-Body Database (Solution #40) / IAU MPC (Non-Standish Table 1)",
      authority: "JPL SBDB / IAU MPC",
      toleranceAu: 0.05,
    },
  },
  jupiter: {
    a: 5.202887,
    aDot: -0.00011607,
    e: 0.04838624,
    eDot: -0.00013253,
    I: 1.30439695,
    IDot: -0.00183714,
    L: 34.39644051,
    LDot: 3034.74612775,
    longPeri: 14.72847983,
    longPeriDot: 0.21252668,
    longNode: 100.47390909,
    longNodeDot: 0.20469106,
    presentationA: 24.8,
  },
  saturn: {
    a: 9.53667594,
    aDot: -0.0012506,
    e: 0.05386179,
    eDot: -0.00050991,
    I: 2.48599187,
    IDot: 0.00193609,
    L: 49.95424423,
    LDot: 1222.49362201,
    longPeri: 92.59887831,
    longPeriDot: -0.41897216,
    longNode: 113.66242448,
    longNodeDot: -0.28867794,
    presentationA: 33.4,
  },
  uranus: {
    a: 19.18916464,
    aDot: -0.00196176,
    e: 0.04725744,
    eDot: -0.00004397,
    I: 0.77263783,
    IDot: -0.00242939,
    L: 313.23810451,
    LDot: 428.48202785,
    longPeri: 170.9542763,
    longPeriDot: 0.40805281,
    longNode: 74.01692503,
    longNodeDot: 0.04240589,
    presentationA: 41.6,
  },
  neptune: {
    a: 30.06992276,
    aDot: 0.00026291,
    e: 0.00859048,
    eDot: 0.00005105,
    I: 1.77004347,
    IDot: 0.00035372,
    L: -55.12002969,
    LDot: 218.45945325,
    longPeri: 44.96476227,
    longPeriDot: -0.32241464,
    longNode: 131.78422574,
    longNodeDot: -0.00508664,
    presentationA: 49.2,
  },
  pluto: {
    a: 39.48168677,
    aDot: -0.00076912,
    e: 0.24880766,
    eDot: 0.00006465,
    I: 17.14175,
    IDot: 0.003075,
    L: 238.92881,
    LDot: 145.207805,
    longPeri: 224.06676,
    longPeriDot: 0.040629,
    longNode: 110.30347,
    longNodeDot: -0.011834,
    presentationA: 56.4,
    provenance: {
      source: "Standish (1992) Table 1 (secular resonant linear approximation)",
      authority: "NASA JPL SSD",
      toleranceAu: 0.1,
    },
  },
};

/**
 * Analytical Keplerian validity interval: 1800-01-01 to 2050-12-31.
 * Standish (1992) polynomial secular rates have sub-arcminute fidelity across
 * this 250-year span, diverging outside it due to unmodeled planetary resonances.
 */
export const EPHEMERIS_VALID_MIN_YEAR = 1800;
export const EPHEMERIS_VALID_MAX_YEAR = 2050;
export const EPHEMERIS_VALID_MIN_DATE = "1800-01-01";
export const EPHEMERIS_VALID_MAX_DATE = "2050-12-31";
export const EPHEMERIS_MIN_DAYS = -73048.5; // 1800-01-01T00:00:00Z
export const EPHEMERIS_MAX_DAYS = 18627.0;  // 2050-12-31T12:00:00Z (through 2050-12-31)

/** Check if given J2000 days fall within authoritative ephemeris accuracy window */
export function isSupportedEphemerisDay(days: number): boolean {
  return Number.isFinite(days) && days >= EPHEMERIS_MIN_DAYS && days <= EPHEMERIS_MAX_DAYS;
}

/**
 * Safely parse any date representation to J2000 days without boundary checking.
 * Returns null if unparseable or non-finite.
 */
export function tryDateToJ2000Days(input: unknown): number | null {
  if (input === null || input === undefined) return null;
  let ms: number;
  if (input instanceof Date) {
    ms = input.getTime();
  } else if (typeof input === "number") {
    ms = input;
  } else if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;
    ms = Date.parse(trimmed);
  } else {
    return null;
  }
  if (Number.isNaN(ms) || !Number.isFinite(ms)) return null;
  return (ms - J2000_EPOCH_MS) / MS_PER_DAY;
}

/**
 * Parse and validate date representation to J2000 days, enforcing the supported
 * ephemeris domain (1800-01-01 through 2050-12-31 UTC).
 * Returns null if unparseable or outside the supported domain.
 */
export function trySupportedEphemerisDate(input: unknown): number | null {
  const days = tryDateToJ2000Days(input);
  if (days === null) return null;
  if (!isSupportedEphemerisDay(days)) return null;
  return days;
}

/** Convert a Date, ISO string, or timestamp to days since J2000.0 with optional fallback */
export function dateToJ2000Days(input: Date | string | number, fallbackDays = 0): number {
  const days = tryDateToJ2000Days(input);
  return days !== null ? days : fallbackDays;
}

/** Convert days since J2000.0 back to a JavaScript Date object */
export function j2000DaysToDate(days: number): Date {
  return new Date(J2000_EPOCH_MS + days * MS_PER_DAY);
}

/** Format days since J2000 into a human-readable calendar string: "16 Sep 2026" */
export function formatEpochDisplay(days: number): string {
  const d = j2000DaysToDate(days);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Format days since J2000 into an ISO format: "2026-09-16" */
export function formatEpochIso(days: number): string {
  const d = j2000DaysToDate(days);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export type EphemerisPosition = {
  /** X in scene units */
  x: number;
  /** Y in scene units (ecliptic normal / vertical) */
  y: number;
  /** Z in scene units */
  z: number;
  /** Distance from Sun in AU */
  distanceAu: number;
  /** True anomaly in radians */
  trueAnomalyRad: number;
  /** Heliocentric longitude in degrees */
  longitudeDeg: number;
  /** True 3D scientific coordinates in AU (P2-001) */
  science: {
    /** Heliocentric position [x, y, z] in AU where Z is ecliptic normal */
    heliocentricAu: [number, number, number];
    /** Euclidean distance from heliocentric origin in AU */
    distanceFromSunAu: number;
  };
  /** Scene coordinates [x, y, z] matching Three.js mapping */
  scene: [number, number, number];
};


/**
 * Solves Kepler's equation M = E - e * sin(E) using Newton-Raphson iteration.
 */
export function solveKepler(M: number, e: number): number {
  // Normalize M to [-PI, PI]
  let m = M % (Math.PI * 2);
  if (m < -Math.PI) m += Math.PI * 2;
  if (m > Math.PI) m -= Math.PI * 2;

  // Good initial guess
  let E = m + e * Math.sin(m);
  for (let i = 0; i < 8; i++) {
    const dE = (m - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-8) break;
  }
  return E;
}

/**
 * Computes the 3D position of a planet or dwarf planet at a specific epoch (days from J2000.0).
 */
export function computeEphemerisPosition(
  bodyId: string,
  daysFromJ2000: number,
  scaleMode: ScaleMode = "presentation",
): EphemerisPosition | null {
  const elem = KEPLER_TABLE[bodyId];
  if (!elem) return null;

  const T = daysFromJ2000 / DAYS_PER_CENTURY;

  // Compute instantaneous orbital elements at epoch T
  const a = elem.a + elem.aDot * T;
  const e = elem.e + elem.eDot * T;
  const I = (elem.I + elem.IDot * T) * DEG_TO_RAD;
  const L = (elem.L + elem.LDot * T) % 360;
  const longPeri = (elem.longPeri + elem.longPeriDot * T) % 360;
  const longNode = (elem.longNode + elem.longNodeDot * T) * DEG_TO_RAD;

  const omega = (longPeri - (elem.longNode + elem.longNodeDot * T)) * DEG_TO_RAD;
  const M_deg = ((L - longPeri) % 360 + 360) % 360;
  const M_rad = M_deg * DEG_TO_RAD;

  // Solve for Eccentric Anomaly
  const E = solveKepler(M_rad, e);

  // Position in orbital plane (AU)
  const xPrime = a * (Math.cos(E) - e);
  const yPrime = a * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);

  // Transform to heliocentric ecliptic coordinates
  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const cosNode = Math.cos(longNode);
  const sinNode = Math.sin(longNode);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);

  // x_h, y_h in ecliptic plane, z_h normal to ecliptic
  const xh = (cosOmega * cosNode - sinOmega * sinNode * cosI) * xPrime +
             (-sinOmega * cosNode - cosOmega * sinNode * cosI) * yPrime;
  const yh = (cosOmega * sinNode + sinOmega * cosNode * cosI) * xPrime +
             (-sinOmega * sinNode + cosOmega * cosNode * cosI) * yPrime;
  const zh = (sinOmega * sinI) * xPrime + (cosOmega * sinI) * yPrime;

  const distanceAu = Math.hypot(xh, yh, zh);
  const trueAnomalyRad = Math.atan2(yPrime, xPrime);
  const longitudeDeg = ((Math.atan2(yh, xh) / DEG_TO_RAD) % 360 + 360) % 360;

  // Scale according to scaleMode
  const scale =
    scaleMode === "distance"
      ? 5.2
      : elem.presentationA / elem.a;

  // Map to Three.js: X is xh, Y is zh (up), Z is yh
  const sceneX = xh * scale;
  const sceneY = zh * scale;
  const sceneZ = yh * scale;

  return {
    x: sceneX,
    y: sceneY,
    z: sceneZ,
    distanceAu,
    trueAnomalyRad,
    longitudeDeg,
    science: {
      heliocentricAu: [xh, yh, zh],
      distanceFromSunAu: distanceAu,
    },
    scene: [sceneX, sceneY, sceneZ],
  };
}


/**
 * Computes a 3D polyline of the elliptical orbit for rendering.
 */
export function computeOrbitPath(
  bodyId: string,
  daysFromJ2000: number,
  scaleMode: ScaleMode = "presentation",
  segments = 180,
): [number, number, number][] {
  const elem = KEPLER_TABLE[bodyId];
  if (!elem) return [];

  const T = daysFromJ2000 / DAYS_PER_CENTURY;
  const a = elem.a + elem.aDot * T;
  const e = elem.e + elem.eDot * T;
  const I = (elem.I + elem.IDot * T) * DEG_TO_RAD;
  const longPeri = (elem.longPeri + elem.longPeriDot * T) % 360;
  const longNode = (elem.longNode + elem.longNodeDot * T) * DEG_TO_RAD;
  const omega = (longPeri - (elem.longNode + elem.longNodeDot * T)) * DEG_TO_RAD;

  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const cosNode = Math.cos(longNode);
  const sinNode = Math.sin(longNode);
  const cosI = Math.cos(I);
  const sinI = Math.sin(I);

  const scale =
    scaleMode === "distance"
      ? 5.2
      : elem.presentationA / elem.a;

  const pts: [number, number, number][] = [];
  const b = a * Math.sqrt(Math.max(0, 1 - e * e));

  for (let i = 0; i <= segments; i++) {
    const E = (i / segments) * Math.PI * 2;
    const xPrime = a * (Math.cos(E) - e);
    const yPrime = b * Math.sin(E);

    const xh = (cosOmega * cosNode - sinOmega * sinNode * cosI) * xPrime +
               (-sinOmega * cosNode - cosOmega * sinNode * cosI) * yPrime;
    const yh = (cosOmega * sinNode + sinOmega * cosNode * cosI) * xPrime +
               (-sinOmega * sinNode + cosOmega * cosNode * cosI) * yPrime;
    const zh = (sinOmega * sinI) * xPrime + (cosOmega * sinI) * yPrime;

    pts.push([xh * scale, zh * scale, yh * scale]);
  }

  return pts;
}

/** Curated historical and scientific epoch presets */
export const EPOCH_PRESETS = [
  { label: "Today", getDays: () => dateToJ2000Days(Date.now()), dateStr: formatEpochIso(dateToJ2000Days(Date.now())) },
  { label: "J2000.0", getDays: () => 0, dateStr: "2000-01-01" },
  { label: "New Horizons (Pluto)", getDays: () => dateToJ2000Days("2015-07-14"), dateStr: "2015-07-14" },
  { label: "Dawn at Ceres", getDays: () => dateToJ2000Days("2015-03-06"), dateStr: "2015-03-06" },
  { label: "Cassini at Saturn", getDays: () => dateToJ2000Days("2004-07-01"), dateStr: "2004-07-01" },
  { label: "Voyager 2 Neptune", getDays: () => dateToJ2000Days("1989-08-25"), dateStr: "1989-08-25" },
] as const;
