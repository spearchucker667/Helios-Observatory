import type { SimulationBody } from "../domain/types.ts";
import { G_CODATA_2022 } from "../domain/constants.ts";
import { vec3Dist } from "../physics/vector.ts";

export interface BodyTidalInteraction {
  perturberId: string;
  perturberName: string;
  distanceM: number;
  tidalAccelerationMs2: number; // Delta a = 2 * G * M * R_target / r^3
}

export interface BodyTidalState {
  targetBodyId: string;
  interactions: BodyTidalInteraction[];
  dominantPerturber?: BodyTidalInteraction;
}

/**
 * Computes tidal differential acceleration exerted on targetBody by other massive bodies:
 * Delta a = (2 * G * M_perturber * R_target) / r^3
 */
export function computeBodyTidalInteractions(
  target: SimulationBody,
  allBodies: SimulationBody[]
): BodyTidalState {
  const interactions: BodyTidalInteraction[] = [];

  for (const b of allBodies) {
    if (b.id === target.id || b.gravityRole === "tracer" || b.mass <= 0) continue;
    const dist = vec3Dist(target.position, b.position);
    if (dist <= 0) continue;

    const deltaA = (2 * G_CODATA_2022 * b.mass * target.radius) / Math.pow(dist, 3);
    interactions.push({
      perturberId: b.id,
      perturberName: b.name,
      distanceM: dist,
      tidalAccelerationMs2: deltaA,
    });
  }

  interactions.sort((a, b) => b.tidalAccelerationMs2 - a.tidalAccelerationMs2);

  return {
    targetBodyId: target.id,
    interactions,
    dominantPerturber: interactions[0],
  };
}
