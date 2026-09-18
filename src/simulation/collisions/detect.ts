import type { SimulationBody } from "../domain/types.ts";
import { vec3Dist, vec3Sub, vec3Mag, type Vector3 } from "../physics/vector.ts";

export interface CollisionPair {
  bodyA: SimulationBody;
  bodyB: SimulationBody;
  separationM: number;
  contactDistanceM: number;
  relativeVelocityMs: number;
  isBlackHoleCapture: boolean;
  capturingBlackHoleId?: string;
  /** Fraction of the step [0, 1] at which contact occurs (0 = already overlapping). */
  contactParameter: number;
  /** True when contact was found by swept-sphere search rather than endpoint overlap. */
  isSwept: boolean;
  /** How the interaction was discovered: physical contact or a Roche-limit crossing. */
  interactionSource?: "contact" | "roche";
}

export interface SweptCollisionOptions {
  /** Pre-step positions keyed by body id, enabling continuous (swept) detection. */
  previousPositions?: Map<string, Vector3>;
}

function contactRadius(a: SimulationBody, b: SimulationBody): { radius: number; isBh: boolean; bhId?: string } {
  let radius = a.radius + b.radius;
  let isBh = false;
  let bhId: string | undefined;

  if (a.classification === "black-hole" || b.classification === "black-hole") {
    isBh = true;
    bhId = a.classification === "black-hole" ? a.id : b.id;
    const rsA = a.compact?.schwarzschildRadiusM ?? a.radius;
    const rsB = b.compact?.schwarzschildRadiusM ?? b.radius;
    radius = Math.max(radius, rsA + rsB);
  }

  return { radius, isBh, bhId };
}

/**
 * Detects physical contact or event-horizon crossings between bodies.
 *
 * Detection is *continuous* (swept-sphere): each pair is tested against the
 * segment swept by their relative motion across the step, so a fast body can no
 * longer pass completely through another body between two integration
 * endpoints. Deterministic pair ordering (i < j) is preserved.
 */
export function detectCollisions(
  bodies: SimulationBody[],
  options?: SweptCollisionOptions
): CollisionPair[] {
  const collisions: CollisionPair[] = [];
  const n = bodies.length;
  const previous = options?.previousPositions;

  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    const aPrev = previous?.get(a.id);
    const aDelta: Vector3 = aPrev ? vec3Sub(a.position, aPrev) : [0, 0, 0];

    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];
      const { radius: contactDist, isBh, bhId } = contactRadius(a, b);

      const bPrev = previous?.get(b.id);
      const bDelta: Vector3 = bPrev ? vec3Sub(b.position, bPrev) : [0, 0, 0];

      // Relative motion of b with respect to a across the step.
      const r0: Vector3 = aPrev && bPrev ? vec3Sub(bPrev, aPrev) : vec3Sub(b.position, a.position);
      const relDelta: Vector3 = [bDelta[0] - aDelta[0], bDelta[1] - aDelta[1], bDelta[2] - aDelta[2]];

      const contactTau = sweptContactParameter(r0, relDelta, contactDist);

      if (contactTau === null) continue;

      const separationAtContact = vec3Mag([
        r0[0] + relDelta[0] * contactTau,
        r0[1] + relDelta[1] * contactTau,
        r0[2] + relDelta[2] * contactTau,
      ]);

      const relVelVec = vec3Sub(a.velocity, b.velocity);
      const relVel = vec3Mag(relVelVec);

      collisions.push({
        bodyA: a,
        bodyB: b,
        separationM: Math.min(separationAtContact, vec3Dist(a.position, b.position)),
        contactDistanceM: contactDist,
        relativeVelocityMs: relVel,
        isBlackHoleCapture: isBh,
        capturingBlackHoleId: bhId,
        contactParameter: contactTau,
        isSwept: contactTau > 0 && !(aPrev === undefined && bPrev === undefined),
      });
    }
  }

  return collisions;
}

/**
 * Solves |r0 + tau * delta|^2 = contactRadius^2 for the earliest tau in [0, 1].
 * @returns the contact parameter, or null when the pair never touches.
 */
export function sweptContactParameter(
  r0: Vector3,
  delta: Vector3,
  contactRadiusM: number
): number | null {
  const c = r0[0] * r0[0] + r0[1] * r0[1] + r0[2] * r0[2] - contactRadiusM * contactRadiusM;
  // Already overlapping at the start of the step.
  if (c <= 0) return 0;

  const a = delta[0] * delta[0] + delta[1] * delta[1] + delta[2] * delta[2];
  if (a <= 0) return null; // No relative motion and not overlapping.

  const b = 2 * (r0[0] * delta[0] + r0[1] * delta[1] + r0[2] * delta[2]);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;

  const sqrtD = Math.sqrt(discriminant);
  const tauEnter = (-b - sqrtD) / (2 * a);
  const tauExit = (-b + sqrtD) / (2 * a);

  if (tauEnter >= 0 && tauEnter <= 1) return tauEnter;
  if (tauEnter < 0 && tauExit >= 0) return 0;
  return null;
}
