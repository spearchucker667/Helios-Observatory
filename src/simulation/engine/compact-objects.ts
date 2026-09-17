import { G_CODATA_2022, C_M_S } from "../domain/constants.ts";
import type { SimulationBody } from "../domain/types.ts";

export interface CompactObjectDiagnostics {
  schwarzschildRadiusM: number;
  strongFieldParameter: number; // GM / (r * c^2)
  isStrongFieldRegime: boolean;
  surfaceGravityMs2: number;
  localMagneticFieldTesla?: number;
}

/**
 * Computes exact Schwarzschild radius: rs = 2 * G * M / c^2
 */
export function calculateSchwarzschildRadius(massKg: number): number {
  if (massKg <= 0) return 0;
  return (2 * G_CODATA_2022 * massKg) / (C_M_S * C_M_S);
}

/**
 * Computes compact object diagnostics at a target distance r from the compact object.
 */
export function evaluateCompactObjectField(
  compactBody: SimulationBody,
  targetDistanceM: number
): CompactObjectDiagnostics {
  const rs = compactBody.compact?.schwarzschildRadiusM ?? calculateSchwarzschildRadius(compactBody.mass);
  const r = Math.max(rs, targetDistanceM);

  // Relativistic compactness parameter: GM / (r * c^2)
  const strongFieldParam = (G_CODATA_2022 * compactBody.mass) / (r * C_M_S * C_M_S);
  const isStrongField = strongFieldParam > 0.01;

  // Surface gravity
  const surfaceR = Math.max(1, compactBody.radius);
  const surfaceGrav = (G_CODATA_2022 * compactBody.mass) / (surfaceR * surfaceR);

  // Dipole magnetic field attenuation: B(r) = B0 * (R / r)^3
  let localB: number | undefined;
  if (compactBody.compact?.magneticFieldTesla && compactBody.radius > 0) {
    const ratio = compactBody.radius / r;
    localB = compactBody.compact.magneticFieldTesla * Math.pow(ratio, 3);
  }

  return {
    schwarzschildRadiusM: rs,
    strongFieldParameter: strongFieldParam,
    isStrongFieldRegime: isStrongField,
    surfaceGravityMs2: surfaceGrav,
    localMagneticFieldTesla: localB,
  };
}
