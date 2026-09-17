import type { SimulationBody } from "../domain/types.ts";
import { STEFAN_BOLTZMANN } from "../domain/constants.ts";
import { computeBodyIrradiance } from "./irradiance.ts";

export interface EquilibriumTemperatureResult {
  equilibriumTempK?: number;
  equilibriumTempC?: number;
  totalIncidentFluxWm2: number;
  albedoUsed?: number;
  emissivityUsed?: number;
  provenance: {
    kind: "calculated" | "estimated" | "unsupported";
    method: string;
    assumptions?: string;
    note?: string;
  };
}

/**
 * Calculates planetary equilibrium temperature:
 * Teq = [ F_total * (1 - A) / (4 * epsilon * sigma) ]^(1/4)
 * If albedo is missing, reports unsupported without injecting fake Earth values.
 */
export function computeEquilibriumTemperature(
  body: SimulationBody,
  allBodies: SimulationBody[]
): EquilibriumTemperatureResult {
  const irradiance = computeBodyIrradiance(body, allBodies);
  const flux = irradiance.totalFluxWm2;

  if (flux <= 0) {
    return {
      totalIncidentFluxWm2: 0,
      provenance: {
        kind: "unsupported",
        method: "Stefan-Boltzmann balance",
        note: "Zero incident stellar flux",
      },
    };
  }

  const albedo = body.thermal?.albedo;
  if (albedo === undefined) {
    return {
      totalIncidentFluxWm2: flux,
      provenance: {
        kind: "unsupported",
        method: "Teq = [F(1 - A) / (4 * eps * sigma)]^(1/4)",
        note: "Unsupported — planetary Bond albedo unknown",
      },
    };
  }

  const emissivity = body.thermal?.emissivity ?? 0.95; // Standard planetary infrared emissivity
  // Teq = ( F * (1 - A) / (4 * eps * sigma) )^(1/4)
  const numerator = flux * (1 - albedo);
  const denominator = 4 * emissivity * STEFAN_BOLTZMANN;

  if (denominator <= 0) {
    return {
      totalIncidentFluxWm2: flux,
      provenance: {
        kind: "unsupported",
        method: "Stefan-Boltzmann",
        note: "Invalid emissivity",
      },
    };
  }

  const teq = Math.pow(numerator / denominator, 0.25);
  const teqC = teq - 273.15;

  return {
    equilibriumTempK: teq,
    equilibriumTempC: teqC,
    totalIncidentFluxWm2: flux,
    albedoUsed: albedo,
    emissivityUsed: emissivity,
    provenance: {
      kind: "calculated",
      method: "Teq = [F(1 - A) / (4 * eps * sigma)]^(1/4)",
      assumptions: `Emissivity eps = ${emissivity}, homogeneous redistribution factor = 4`,
      note: "Radiative equilibrium without greenhouse atmosphere model",
    },
  };
}
