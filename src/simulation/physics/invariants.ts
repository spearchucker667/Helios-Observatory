import { G_CODATA_2022 } from "../domain/constants.ts";
import type { Vector3 } from "./vector.ts";
import { vec3Cross } from "./vector.ts";
import type { SimulationBody } from "../domain/types.ts";

export interface SystemInvariants {
  totalMassKg: number;
  kineticEnergyJ: number;
  potentialEnergyJ: number;
  totalMechanicalEnergyJ: number;
  linearMomentumKgMs: Vector3;
  angularMomentumKgM2s: Vector3;
  centerOfMassM: Vector3;
  centerOfMassVelocityMs: Vector3;
}

/**
 * Computes the complete physical invariants from typed arrays.
 */
export function computeInvariantsFromArrays(
  positions: Float64Array,
  velocities: Float64Array,
  masses: Float64Array,
  isTracer: Uint8Array,
  numBodies: number
): SystemInvariants {
  let totalMass = 0;
  let kinetic = 0;
  let potential = 0;

  let cmX = 0, cmY = 0, cmZ = 0;
  let px = 0, py = 0, pz = 0;
  let lx = 0, ly = 0, lz = 0;

  for (let i = 0; i < numBodies; i++) {
    if (isTracer[i] || masses[i] <= 0) continue;
    
    const m = masses[i];
    totalMass += m;

    const ix = i * 3;
    const rx = positions[ix];
    const ry = positions[ix + 1];
    const rz = positions[ix + 2];

    const vx = velocities[ix];
    const vy = velocities[ix + 1];
    const vz = velocities[ix + 2];

    // Center of mass
    cmX += m * rx;
    cmY += m * ry;
    cmZ += m * rz;

    // Linear momentum
    px += m * vx;
    py += m * vy;
    pz += m * vz;

    // Kinetic energy: 1/2 m v^2
    const vSq = vx * vx + vy * vy + vz * vz;
    kinetic += 0.5 * m * vSq;

    // Angular momentum: r x (m*v)
    const [h_x, h_y, h_z] = vec3Cross([rx, ry, rz], [vx, vy, vz]);
    lx += m * h_x;
    ly += m * h_y;
    lz += m * h_z;

    // Potential energy with other massive bodies
    for (let j = i + 1; j < numBodies; j++) {
      if (isTracer[j] || masses[j] <= 0) continue;
      
      const jx = j * 3;
      const dx = positions[jx] - rx;
      const dy = positions[jx + 1] - ry;
      const dz = positions[jx + 2] - rz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > 0) {
        potential -= (G_CODATA_2022 * m * masses[j]) / dist;
      }
    }
  }

  const cvX = totalMass > 0 ? px / totalMass : 0;
  const cvY = totalMass > 0 ? py / totalMass : 0;
  const cvZ = totalMass > 0 ? pz / totalMass : 0;

  const comX = totalMass > 0 ? cmX / totalMass : 0;
  const comY = totalMass > 0 ? cmY / totalMass : 0;
  const comZ = totalMass > 0 ? cmZ / totalMass : 0;

  return {
    totalMassKg: totalMass,
    kineticEnergyJ: kinetic,
    potentialEnergyJ: potential,
    totalMechanicalEnergyJ: kinetic + potential,
    linearMomentumKgMs: [px, py, pz],
    angularMomentumKgM2s: [lx, ly, lz],
    centerOfMassM: [comX, comY, comZ],
    centerOfMassVelocityMs: [cvX, cvY, cvZ],
  };
}

/**
 * Computes invariants directly from SimulationBody array.
 */
export function computeSystemInvariants(bodies: SimulationBody[]): SystemInvariants {
  const numBodies = bodies.length;
  const positions = new Float64Array(numBodies * 3);
  const velocities = new Float64Array(numBodies * 3);
  const masses = new Float64Array(numBodies);
  const isTracer = new Uint8Array(numBodies);

  for (let i = 0; i < numBodies; i++) {
    const b = bodies[i];
    positions[i * 3] = b.position[0];
    positions[i * 3 + 1] = b.position[1];
    positions[i * 3 + 2] = b.position[2];

    velocities[i * 3] = b.velocity[0];
    velocities[i * 3 + 1] = b.velocity[1];
    velocities[i * 3 + 2] = b.velocity[2];

    masses[i] = b.mass;
    isTracer[i] = b.gravityRole === "tracer" ? 1 : 0;
  }

  return computeInvariantsFromArrays(positions, velocities, masses, isTracer, numBodies);
}
