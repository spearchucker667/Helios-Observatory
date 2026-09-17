import type { SimulationBody } from "../domain/types.ts";
import { G_CODATA_2022 } from "../domain/constants.ts";
import { vec3Dist } from "../physics/vector.ts";

export interface RocheDiagnostics {
  fluidRocheLimitM?: number;
  rigidRocheLimitM?: number;
  currentSeparationM: number;
  isInsideFluidLimit: boolean;
  isInsideRigidLimit: boolean;
  tidalGradientMs2PerM: number; // Delta a / L
}

/**
 * Calculates Roche limit and tidal gradients between a primary massive body and a secondary satellite.
 * Fluid Roche limit: d = 2.44 * R_p * (rho_p / rho_s)^(1/3)
 * Rigid Roche limit: d = 1.26 * R_p * (rho_p / rho_s)^(1/3)
 * Tidal differential acceleration: Delta a approx 2 * G * M * L / r^3
 */
export function computeRocheDiagnostics(
  primary: SimulationBody,
  satellite: SimulationBody
): RocheDiagnostics {
  const dist = vec3Dist(primary.position, satellite.position);

  // Derive densities if not directly specified
  const rhoP = primary.density ?? (primary.radius > 0 ? primary.mass / ((4 / 3) * Math.PI * Math.pow(primary.radius, 3)) : 0);
  const rhoS = satellite.density ?? (satellite.radius > 0 ? satellite.mass / ((4 / 3) * Math.PI * Math.pow(satellite.radius, 3)) : 0);

  let fluidLimit: number | undefined;
  let rigidLimit: number | undefined;

  if (rhoP > 0 && rhoS > 0 && primary.radius > 0) {
    const densityRatioCbrt = Math.cbrt(rhoP / rhoS);
    fluidLimit = 2.44 * primary.radius * densityRatioCbrt;
    rigidLimit = 1.26 * primary.radius * densityRatioCbrt;
  }

  // Tidal acceleration per unit length: 2 * G * M / r^3
  const tidalGradient = dist > 0 ? (2 * G_CODATA_2022 * primary.mass) / Math.pow(dist, 3) : 0;

  return {
    fluidRocheLimitM: fluidLimit,
    rigidRocheLimitM: rigidLimit,
    currentSeparationM: dist,
    isInsideFluidLimit: fluidLimit !== undefined ? dist <= fluidLimit : false,
    isInsideRigidLimit: rigidLimit !== undefined ? dist <= rigidLimit : false,
    tidalGradientMs2PerM: tidalGradient,
  };
}
