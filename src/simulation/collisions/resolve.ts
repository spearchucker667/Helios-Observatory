import type { SimulationBody } from "../domain/types.ts";
import type { CollisionPair } from "./detect.ts";
import { G_CODATA_2022, C_M_S } from "../domain/constants.ts";
import type { Vector3 } from "../physics/vector.ts";

export interface CollisionDiagnostics {
  relativeVelocityMs: number;
  reducedMassKg: number;
  kineticImpactEnergyJ: number;
  mutualEscapeVelocityMs: number;
  specificImpactEnergyJkg: number;
  bindingEnergyApproximationJ: number;
}

export interface CollisionResolution {
  survivingBody: SimulationBody;
  removedBodyIds: string[];
  diagnostics: CollisionDiagnostics;
  outcome: "merge" | "black_hole_capture";
}

/**
 * Calculates rigorous impact diagnostics for a collision pair.
 */
export function computeCollisionDiagnostics(a: SimulationBody, b: SimulationBody, vRelMs: number): CollisionDiagnostics {
  const m1 = Math.max(1, a.mass);
  const m2 = Math.max(1, b.mass);
  const totalM = m1 + m2;
  const reducedMass = (m1 * m2) / totalM;

  // Kinetic impact energy: 1/2 * mu * v_rel^2
  const eImpact = 0.5 * reducedMass * vRelMs * vRelMs;

  // Mutual escape velocity: sqrt(2 * G * (m1 + m2) / (r1 + r2))
  const contactR = Math.max(1, a.radius + b.radius);
  const vEscape = Math.sqrt((2 * G_CODATA_2022 * totalM) / contactR);

  // Specific impact energy Q = E_impact / (m1 + m2)
  const specificEnergy = eImpact / totalM;

  // Uniform sphere gravitational binding energy: U = 3/5 * G * M^2 / R
  const targetBody = a.mass >= b.mass ? a : b;
  const targetR = Math.max(1, targetBody.radius);
  const bindingEnergy = (3 * G_CODATA_2022 * targetBody.mass * targetBody.mass) / (5 * targetR);

  return {
    relativeVelocityMs: vRelMs,
    reducedMassKg: reducedMass,
    kineticImpactEnergyJ: eImpact,
    mutualEscapeVelocityMs: vEscape,
    specificImpactEnergyJkg: specificEnergy,
    bindingEnergyApproximationJ: bindingEnergy,
  };
}

/**
 * Resolves a collision pair through an inelastic merger or black hole capture,
 * strictly conserving total mass and linear momentum.
 */
export function resolveCollision(pair: CollisionPair): CollisionResolution {
  const { bodyA, bodyB, relativeVelocityMs, isBlackHoleCapture } = pair;

  const diagnostics = computeCollisionDiagnostics(bodyA, bodyB, relativeVelocityMs);

  const m1 = bodyA.mass;
  const m2 = bodyB.mass;
  const totalMass = m1 + m2;

  // Linear momentum conservation: v_merged = (m1 * v1 + m2 * v2) / totalMass
  let mergedVelocity: Vector3;
  let mergedPosition: Vector3;

  if (totalMass > 0) {
    mergedVelocity = [
      (m1 * bodyA.velocity[0] + m2 * bodyB.velocity[0]) / totalMass,
      (m1 * bodyA.velocity[1] + m2 * bodyB.velocity[1]) / totalMass,
      (m1 * bodyA.velocity[2] + m2 * bodyB.velocity[2]) / totalMass,
    ];

    mergedPosition = [
      (m1 * bodyA.position[0] + m2 * bodyB.position[0]) / totalMass,
      (m1 * bodyA.position[1] + m2 * bodyB.position[1]) / totalMass,
      (m1 * bodyA.position[2] + m2 * bodyB.position[2]) / totalMass,
    ];
  } else {
    // Both tracers
    mergedVelocity = [(bodyA.velocity[0] + bodyB.velocity[0]) / 2, (bodyA.velocity[1] + bodyB.velocity[1]) / 2, (bodyA.velocity[2] + bodyB.velocity[2]) / 2];
    mergedPosition = [(bodyA.position[0] + bodyB.position[0]) / 2, (bodyA.position[1] + bodyB.position[1]) / 2, (bodyA.position[2] + bodyB.position[2]) / 2];
  }

  // Black hole capture: primary is the black hole
  if (isBlackHoleCapture) {
    const isABh = bodyA.classification === "black-hole";
    const bh = isABh ? bodyA : bodyB;
    const captured = isABh ? bodyB : bodyA;

    const newMass = totalMass;
    const newRs = (2 * G_CODATA_2022 * newMass) / (C_M_S * C_M_S);

    const surviving: SimulationBody = {
      ...bh,
      mass: newMass,
      radius: newRs,
      position: mergedPosition,
      velocity: mergedVelocity,
      compact: {
        ...bh.compact,
        schwarzschildRadiusM: newRs,
      },
      provenance: {
        ...bh.provenance,
        mass: { kind: "calculated", method: "Mass accumulation from capture", note: `Absorbed ${captured.name}` },
        radius: { kind: "calculated", method: "rs = 2GM/c^2", note: "Updated Schwarzschild radius" },
        state: { kind: "calculated", method: "Linear momentum conservation" },
      },
    };

    return {
      survivingBody: surviving,
      removedBodyIds: [captured.id],
      diagnostics,
      outcome: "black_hole_capture",
    };
  }

  // General inelastic merge
  const primary = bodyA.mass >= bodyB.mass ? bodyA : bodyB;
  const secondary = bodyA.mass >= bodyB.mass ? bodyB : bodyA;

  // New radius from volume addition assuming mean bulk density
  const newRadius = Math.cbrt(Math.pow(bodyA.radius, 3) + Math.pow(bodyB.radius, 3));

  const surviving: SimulationBody = {
    ...primary,
    mass: totalMass,
    radius: newRadius,
    position: mergedPosition,
    velocity: mergedVelocity,
    gravityRole: totalMass > 0 ? "massive" : "tracer",
    provenance: {
      ...primary.provenance,
      mass: { kind: "calculated", method: "Inelastic mass addition (m1 + m2)", note: `Merged with ${secondary.name}` },
      radius: { kind: "calculated", method: "Volume conservation (r1^3 + r2^3)^(1/3)" },
      state: { kind: "calculated", method: "Linear momentum conservation" },
    },
  };

  return {
    survivingBody: surviving,
    removedBodyIds: [secondary.id],
    diagnostics,
    outcome: "merge",
  };
}
