import type { SimulationBody } from "../domain/types.ts";
import { computeRocheDiagnostics, type RocheDiagnostics } from "./disruption.ts";

export interface RocheInteraction {
  primary: SimulationBody;
  secondary: SimulationBody;
  diagnostics: RocheDiagnostics;
  /** Whether the pair was already inside the fluid Roche limit on the previous evaluation. */
  wasInside: boolean;
  /** True on the step where the pair first crossed into the limit. */
  isNewCrossing: boolean;
}

const COMPACT_SECONDARIES = new Set([
  "black-hole",
  "neutron-star",
  "pulsar",
  "magnetar",
]);

export function rochePairKey(aId: string, bId: string): string {
  return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
}

/**
 * Evaluates every massive pair against its fluid Roche limit.
 *
 * A Roche limit normally lies *outside* the primary's physical surface, so a
 * satellite can be shredded without ever overlapping the primary. This pass is
 * therefore independent of `detectCollisions()`.
 *
 * @param previousState Inside/outside state from the previous step, keyed by `rochePairKey`.
 * @param excludedPairs Pairs already handled as physical contact this step.
 */
export function detectRocheInteractions(
  bodies: SimulationBody[],
  previousState: ReadonlyMap<string, boolean>,
  excludedPairs?: ReadonlySet<string>
): { interactions: RocheInteraction[]; state: Map<string, boolean> } {
  const interactions: RocheInteraction[] = [];
  const state = new Map<string, boolean>();
  const n = bodies.length;

  for (let i = 0; i < n; i++) {
    const a = bodies[i];
    if (a.gravityRole !== "massive" || a.mass <= 0) continue;

    for (let j = i + 1; j < n; j++) {
      const b = bodies[j];
      if (b.gravityRole !== "massive" || b.mass <= 0) continue;

      const key = rochePairKey(a.id, b.id);
      const primary = a.mass >= b.mass ? a : b;
      const secondary = a.mass >= b.mass ? b : a;

      const wasInside = previousState.get(key) ?? false;

      const isCandidate =
        secondary.mass > 0 &&
        !COMPACT_SECONDARIES.has(secondary.classification) &&
        primary.mass >= 2 * secondary.mass;

      if (!isCandidate) {
        state.set(key, false);
        continue;
      }

      const diagnostics = computeRocheDiagnostics(primary, secondary);
      const inside = diagnostics.isInsideFluidLimit;
      state.set(key, inside);

      if (inside && !excludedPairs?.has(key)) {
        interactions.push({
          primary,
          secondary,
          diagnostics,
          wasInside,
          isNewCrossing: !wasInside,
        });
      }
    }
  }

  return { interactions, state };
}
