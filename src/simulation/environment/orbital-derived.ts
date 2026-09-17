import type { SimulationBody } from "../domain/types.ts";
import { G_CODATA_2022 } from "../domain/constants.ts";
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
}

/**
 * Identifies the dominant gravitational parent for a body and computes
 * osculating orbital elements, Hill sphere radius, surface gravity, and escape velocity.
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

  if (dominantParent) {
    const parent = allBodies.find((b) => b.id === dominantParent!.id);
    if (parent) {
      const relPos = vec3Sub(body.position, parent.position);
      const relVel = vec3Sub(body.velocity, parent.velocity);

      osculatingElements = cartesianToOrbitalElements(relPos, relVel, parent.mass, body.mass);

      // Hill radius: r_H = a * (1 - e) * (m / (3 * M))^(1/3)
      if (body.mass > 0 && parent.mass > 0 && osculatingElements.isBound && osculatingElements.semiMajorAxisM > 0) {
        const a = osculatingElements.semiMajorAxisM;
        const e = osculatingElements.eccentricity;
        const periapsis = a * (1 - e);
        hillRadius = periapsis * Math.cbrt(body.mass / (3 * parent.mass));
      }
    }
  }

  return {
    dominantParent,
    osculatingElements,
    hillRadiusM: hillRadius,
    surfaceGravityMs2: surfaceGrav,
    escapeVelocityMs: escapeVel,
  };
}
