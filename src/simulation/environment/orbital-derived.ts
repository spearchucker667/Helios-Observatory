import type { SimulationBody } from "../domain/types.ts";
import { G_CODATA_2022, C_M_S } from "../domain/constants.ts";
import { vec3Dist, vec3Sub } from "../physics/vector.ts";
import { cartesianToOrbitalElements, type OrbitalElements } from "../physics/orbital-elements.ts";

export interface DerivedOrbitalState {
  dominantParent?: {
    id: string;
    name: string;
    distanceM: number;
    gravitationalAccelerationMs2: number;
  };
  osculatingElements?: OrbitalElements;
  hillRadiusM?: number;
  surfaceGravityMs2: number;
  escapeVelocityMs: number;
  einsteinPrecessionRadPerOrbit?: number;
  einsteinPrecessionArcsecPerCentury?: number;
  relativisticCompactness?: number; // GM / (r * c^2)
}

/**
 * Calculates Einstein relativistic perihelion advance (1PN apsidal precession):
 * Delta varpi = 6 * pi * G * (M + m) / (a * (1 - e^2) * c^2)  [rad / orbit]
 * Arcsec/century = Rate * 3.15576e9 * (180 * 3600 / pi)
 */
export function calculateEinsteinPrecession(
  parentMassKg: number,
  satelliteMassKg: number,
  semiMajorAxisM: number,
  eccentricity: number
): { radPerOrbit: number; arcsecPerCentury: number } | undefined {
  if (parentMassKg <= 0 || semiMajorAxisM <= 0 || eccentricity >= 1) return undefined;
  const eSq = eccentricity * eccentricity;
  if (eSq >= 1) return undefined;

  const totalM = parentMassKg + Math.max(0, satelliteMassKg);
  const cSq = C_M_S * C_M_S;

  const radPerOrbit = (6 * Math.PI * G_CODATA_2022 * totalM) / (semiMajorAxisM * (1 - eSq) * cSq);

  // Period T = 2 * pi * sqrt(a^3 / (G * totalM))
  const mu = G_CODATA_2022 * totalM;
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxisM, 3) / mu);

  if (periodSeconds <= 0) return undefined;

  const radPerSecond = radPerOrbit / periodSeconds;
  const SECONDS_PER_JULIAN_CENTURY = 365.25 * 86400 * 100;
  const ARCSEC_PER_RADIAN = (180 * 3600) / Math.PI;

  const arcsecPerCentury = radPerSecond * SECONDS_PER_JULIAN_CENTURY * ARCSEC_PER_RADIAN;

  return {
    radPerOrbit,
    arcsecPerCentury,
  };
}

/**
 * Identifies the dominant gravitational parent for a body and computes
 * osculating orbital elements, Hill sphere radius, surface gravity, escape velocity,
 * and 1PN Einstein relativistic periapsis precession.
 */
export function computeDerivedOrbitalState(
  body: SimulationBody,
  allBodies: SimulationBody[]
): DerivedOrbitalState {
  // Surface gravity and escape velocity
  const r = Math.max(1, body.radius);
  const surfaceGrav = body.mass > 0 ? (G_CODATA_2022 * body.mass) / (r * r) : 0;
  const escapeVel = body.mass > 0 ? Math.sqrt((2 * G_CODATA_2022 * body.mass) / r) : 0;

  // Find dominant gravitating attractor
  let dominantParent: { id: string; name: string; distanceM: number; gravitationalAccelerationMs2: number } | undefined;
  let maxAccel = 0;

  for (const other of allBodies) {
    if (other.id === body.id || other.gravityRole === "tracer" || other.mass <= 0) continue;
    const dist = vec3Dist(body.position, other.position);
    if (dist <= 0) continue;

    const accel = (G_CODATA_2022 * other.mass) / (dist * dist);
    if (accel > maxAccel) {
      maxAccel = accel;
      dominantParent = {
        id: other.id,
        name: other.name,
        distanceM: dist,
        gravitationalAccelerationMs2: accel,
      };
    }
  }

  let osculatingElements: OrbitalElements | undefined;
  let hillRadius: number | undefined;
  let precession: { radPerOrbit: number; arcsecPerCentury: number } | undefined;
  let compactness: number | undefined;

  if (dominantParent) {
    const parent = allBodies.find((b) => b.id === dominantParent!.id);
    if (parent) {
      const relPos = vec3Sub(body.position, parent.position);
      const relVel = vec3Sub(body.velocity, parent.velocity);

      osculatingElements = cartesianToOrbitalElements(relPos, relVel, parent.mass, body.mass);

      // Relativistic compactness parameter GM / (r * c^2)
      const dist = dominantParent.distanceM;
      if (dist > 0) {
        compactness = (G_CODATA_2022 * parent.mass) / (dist * C_M_S * C_M_S);
      }

      // Hill radius & Einstein precession
      if (osculatingElements.isBound && osculatingElements.semiMajorAxisM > 0) {
        const a = osculatingElements.semiMajorAxisM;
        const e = osculatingElements.eccentricity;
        const periapsis = a * (1 - e);

        if (body.mass > 0 && parent.mass > 0) {
          hillRadius = periapsis * Math.cbrt(body.mass / (3 * parent.mass));
        }

        precession = calculateEinsteinPrecession(parent.mass, body.mass, a, e);
      }
    }
  }

  return {
    dominantParent,
    osculatingElements,
    hillRadiusM: hillRadius,
    surfaceGravityMs2: surfaceGrav,
    escapeVelocityMs: escapeVel,
    einsteinPrecessionRadPerOrbit: precession?.radPerOrbit,
    einsteinPrecessionArcsecPerCentury: precession?.arcsecPerCentury,
    relativisticCompactness: compactness,
  };
}
