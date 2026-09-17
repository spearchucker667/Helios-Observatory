import type { SimulationBody } from "../domain/types.ts";
import { vec3Dist, vec3Sub, vec3Mag } from "../physics/vector.ts";

export interface CollisionPair {
  bodyA: SimulationBody;
  bodyB: SimulationBody;
  separationM: number;
  contactDistanceM: number;
  relativeVelocityMs: number;
  isBlackHoleCapture: boolean;
  capturingBlackHoleId?: string;
}

/**
 * Detects physical contact or event-horizon crossings between bodies.
 * Uses deterministic pair checking order (i < j sorted by ID).
 */
export function detectCollisions(bodies: SimulationBody[]): CollisionPair[] {
  const collisions: CollisionPair[] = [];
  const n = bodies.length;

  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];

      // Physical contact distance: sum of radii
      let contactDist = a.radius + b.radius;
      let isBhCapture = false;
      let capturingId: string | undefined;

      if (a.classification === "black-hole" || b.classification === "black-hole") {
        isBhCapture = true;
        capturingId = a.classification === "black-hole" ? a.id : b.id;
        // Event horizon radius is the capture radius
        const rsA = a.compact?.schwarzschildRadiusM ?? a.radius;
        const rsB = b.compact?.schwarzschildRadiusM ?? b.radius;
        contactDist = Math.max(contactDist, rsA + rsB);
      }

      const dist = vec3Dist(a.position, b.position);

      if (dist <= contactDist) {
        const relVelVec = vec3Sub(a.velocity, b.velocity);
        const relVel = vec3Mag(relVelVec);

        collisions.push({
          bodyA: a,
          bodyB: b,
          separationM: dist,
          contactDistanceM: contactDist,
          relativeVelocityMs: relVel,
          isBlackHoleCapture: isBhCapture,
          capturingBlackHoleId: capturingId,
        });
      }
    }
  }

  return collisions;
}
