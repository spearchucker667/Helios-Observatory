import type { SimulationBody } from "../domain/types.ts";
import { vec3Dist } from "../physics/vector.ts";

export interface IrradianceContribution {
  sourceBodyId: string;
  sourceBodyName: string;
  distanceM: number;
  fluxWm2: number; // Watts / m^2
}

export interface BodyIrradiance {
  targetBodyId: string;
  totalFluxWm2: number;
  sources: IrradianceContribution[];
  provenance: {
    kind: "calculated" | "unsupported";
    formula: string;
    note?: string;
  };
}

/**
 * Calculates total stellar irradiance (flux in W/m^2) incident on a body
 * from all luminous sources in the simulation.
 * F = L / (4 * pi * r^2)
 * F_total = sum(F_i)
 */
export function computeBodyIrradiance(
  targetBody: SimulationBody,
  allBodies: SimulationBody[]
): BodyIrradiance {
  const sources: IrradianceContribution[] = [];
  let totalFlux = 0;

  for (const b of allBodies) {
    if (b.id === targetBody.id) continue;
    const lum = b.radiative?.luminosityWatts;
    if (lum !== undefined && lum > 0) {
      const dist = vec3Dist(targetBody.position, b.position);
      if (dist > 0) {
        const flux = lum / (4 * Math.PI * dist * dist);
        totalFlux += flux;
        sources.push({
          sourceBodyId: b.id,
          sourceBodyName: b.name,
          distanceM: dist,
          fluxWm2: flux,
        });
      }
    }
  }

  return {
    targetBodyId: targetBody.id,
    totalFluxWm2: totalFlux,
    sources,
    provenance: {
      kind: sources.length > 0 ? "calculated" : "unsupported",
      formula: "F = sum(L_i / (4 * pi * r_i^2))",
      note: sources.length === 0 ? "No luminous sources found in simulation" : undefined,
    },
  };
}
