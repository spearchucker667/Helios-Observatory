import type { SimulationBody } from "../domain/types.ts";
import type { CollisionPair } from "./detect.ts";
import { G_CODATA_2022, C_M_S } from "../domain/constants.ts";
import { type Vector3, vec3Sub, vec3Mag, vec3Normalize, vec3Cross } from "../physics/vector.ts";
import { computeRocheDiagnostics } from "./disruption.ts";

export interface CollisionDiagnostics {
  /** False when the pair's masses cannot support the requested diagnostic. */
  supported: boolean;
  unsupportedReason?: string;
  relativeVelocityMs: number;
  reducedMassKg: number;
  kineticImpactEnergyJ: number;
  mutualEscapeVelocityMs?: number;
  specificImpactEnergyJkg?: number;
  bindingEnergyApproximationJ?: number;
}

export interface CollisionResolution {
  survivingBody: SimulationBody;
  removedBodyIds: string[];
  remnantBodies?: SimulationBody[];
  diagnostics: CollisionDiagnostics;
  outcome: "merge" | "black_hole_capture" | "tidal_disruption";
}

/**
 * Calculates rigorous impact diagnostics for a collision pair.
 *
 * A zero/unknown mass is NEVER clamped up to a fabricated physical mass: a
 * zero-mass tracer is a test particle, not a 1 kg body. Diagnostics that
 * require a non-zero mass report `supported: false` instead.
 */
export function computeCollisionDiagnostics(
  a: SimulationBody,
  b: SimulationBody,
  vRelMs: number
): CollisionDiagnostics {
  const m1 = a.mass;
  const m2 = b.mass;
  const totalM = m1 + m2;

  if (!(totalM > 0)) {
    return {
      supported: false,
      unsupportedReason:
        "Both participants have zero (tracer) mass; impact energetics are undefined.",
      relativeVelocityMs: vRelMs,
      reducedMassKg: 0,
      kineticImpactEnergyJ: 0,
    };
  }

  const reducedMass = (m1 * m2) / totalM; // Exactly 0 when either body is a zero-mass tracer.
  const eImpact = 0.5 * reducedMass * vRelMs * vRelMs;
  const contactR = a.radius + b.radius;

  const tracerNote =
    m1 <= 0 || m2 <= 0
      ? "Zero-mass tracer participant: reduced mass, impact energy and specific energy are identically zero."
      : undefined;

  const mutualEscapeVelocityMs =
    contactR > 0
      ? Math.sqrt((2 * G_CODATA_2022 * totalM) / contactR)
      : undefined;

  const targetBody = a.mass >= b.mass ? a : b;
  const bindingEnergyApproximationJ =
    targetBody.mass > 0 && targetBody.radius > 0
      ? (3 * G_CODATA_2022 * targetBody.mass * targetBody.mass) / (5 * targetBody.radius)
      : undefined;

  return {
    supported: true,
    unsupportedReason: tracerNote,
    relativeVelocityMs: vRelMs,
    reducedMassKg: reducedMass,
    kineticImpactEnergyJ: eImpact,
    mutualEscapeVelocityMs,
    specificImpactEnergyJkg: eImpact / totalM,
    bindingEnergyApproximationJ,
  };
}

/**
 * Resolves a collision pair through an inelastic merger, black hole capture,
 * or tidal shredding disruption, strictly conserving total mass and linear momentum.
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
    // Both tracers: no mass, so position/velocity fall back to the midpoint.
    mergedVelocity = [
      (bodyA.velocity[0] + bodyB.velocity[0]) / 2,
      (bodyA.velocity[1] + bodyB.velocity[1]) / 2,
      (bodyA.velocity[2] + bodyB.velocity[2]) / 2,
    ];
    mergedPosition = [
      (bodyA.position[0] + bodyB.position[0]) / 2,
      (bodyA.position[1] + bodyB.position[1]) / 2,
      (bodyA.position[2] + bodyB.position[2]) / 2,
    ];
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
      density: newRs > 0 ? newMass / ((4 / 3) * Math.PI * Math.pow(newRs, 3)) : undefined,
      position: mergedPosition,
      velocity: mergedVelocity,
      compact: {
        ...bh.compact,
        schwarzschildRadiusM: newRs,
      },
      provenance: {
        ...bh.provenance,
        mass: {
          kind: "calculated",
          method: "Mass accumulation from capture",
          note: `Absorbed ${captured.name}`,
        },
        radius: { kind: "calculated", method: "rs = 2GM/c^2", note: "Updated Schwarzschild radius" },
        compact: { kind: "calculated", method: "rs = 2GM/c^2" },
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

  // Primary and secondary bodies based on mass
  const primary = bodyA.mass >= bodyB.mass ? bodyA : bodyB;
  const secondary = bodyA.mass >= bodyB.mass ? bodyB : bodyA;

  // Tidal disruption check: the secondary is significantly less massive, is not
  // a compact object, and lies inside the fluid Roche limit. This works for
  // both physical contact and Roche-crossing (no contact) interactions.
  const roche = computeRocheDiagnostics(primary, secondary);
  const isCompactSecondary =
    secondary.classification === "black-hole" ||
    secondary.classification === "neutron-star" ||
    secondary.classification === "pulsar" ||
    secondary.classification === "magnetar";
  const isAsymmetric = primary.mass >= 2 * secondary.mass && secondary.mass > 0;
  // One-generation rule: debris remnants produced by an earlier tidal
  // disruption are never re-shredded. Without this, remnants that spawn inside
  // the primary's Roche limit are disrupted again on the next step, each
  // spawning six more remnants — an exponential cascade that floods the world
  // to the body cap and stalls the simulation. Physically, a debris stream
  // does not repeatedly shred as discrete self-gravitating bodies: fragments
  // either fall back and accrete (merge) or disperse.
  const isDebrisRemnant =
    secondary.provenance.mass?.kind === "calculated" &&
    typeof secondary.provenance.mass.method === "string" &&
    secondary.provenance.mass.method.startsWith("Tidal disruption");
  const isTidalShredding =
    !isCompactSecondary && !isDebrisRemnant && isAsymmetric && roche.isInsideFluidLimit;

  if (isTidalShredding) {
    const remnantCount = 6;
    const debrisFraction = 0.25; // 25% of secondary mass forms tidal debris remnants
    const debrisTotalMass = secondary.mass * debrisFraction;
    const retainedSecondaryMass = secondary.mass * (1 - debrisFraction);
    const primaryNewMass = primary.mass + retainedSecondaryMass;

    // Linear momentum of primary with retained portion:
    // P_retained = m_prim * v_prim + (1 - f) * m_sec * v_sec
    const vPrimRetained: Vector3 = [
      (primary.mass * primary.velocity[0] + retainedSecondaryMass * secondary.velocity[0]) / primaryNewMass,
      (primary.mass * primary.velocity[1] + retainedSecondaryMass * secondary.velocity[1]) / primaryNewMass,
      (primary.mass * primary.velocity[2] + retainedSecondaryMass * secondary.velocity[2]) / primaryNewMass,
    ];

    const posPrimRetained: Vector3 = [
      (primary.mass * primary.position[0] + retainedSecondaryMass * secondary.position[0]) / primaryNewMass,
      (primary.mass * primary.position[1] + retainedSecondaryMass * secondary.position[1]) / primaryNewMass,
      (primary.mass * primary.position[2] + retainedSecondaryMass * secondary.position[2]) / primaryNewMass,
    ];

    // Compute tangent vector for tidal debris stream along orbit
    const rRel = vec3Sub(secondary.position, primary.position);
    const vRel = vec3Sub(secondary.velocity, primary.velocity);
    let tangent = vec3Normalize(vRel);
    if (vec3Mag(tangent) === 0) {
      // Fallback perpendicular to rRel
      const cross = vec3Cross(rRel, [0, 0, 1]);
      tangent = vec3Mag(cross) > 0 ? vec3Normalize(cross) : [1, 0, 0];
    }

    // Velocity dispersion matching parent body escape speed: v_disp ~ sqrt(2 * G * m_sec / r_sec)
    const secR = Math.max(1, secondary.radius);
    const vDisp = Math.sqrt((2 * G_CODATA_2022 * secondary.mass) / secR);
    const fragmentMass = debrisTotalMass / remnantCount;
    const fragmentRadius = Math.max(100, secondary.radius * Math.cbrt(debrisFraction / remnantCount));

    const remnants: SimulationBody[] = [];
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (let k = 0; k < remnantCount; k++) {
      // Symmetrically spaced parameter from -1 to 1 so sum(s_k) = 0 strictly!
      const s_k = (k - (remnantCount - 1) / 2) / ((remnantCount - 1) / 2);

      const fragPos: Vector3 = [
        secondary.position[0] + s_k * secondary.radius * 2 * tangent[0],
        secondary.position[1] + s_k * secondary.radius * 2 * tangent[1],
        secondary.position[2] + s_k * secondary.radius * 2 * tangent[2],
      ];

      const fragVel: Vector3 = [
        secondary.velocity[0] + s_k * vDisp * tangent[0],
        secondary.velocity[1] + s_k * vDisp * tangent[1],
        secondary.velocity[2] + s_k * vDisp * tangent[2],
      ];

      remnants.push({
        id: `${secondary.id}-debris-${k + 1}`,
        name: `${secondary.name} Debris ${alphabet[k] ?? k + 1}`,
        classification: secondary.classification === "comet" ? "comet" : "asteroid",
        gravityRole: fragmentMass < 1e20 ? "tracer" : "massive",
        mass: fragmentMass,
        radius: fragmentRadius,
        position: fragPos,
        velocity: fragVel,
        color: secondary.color ?? "#fbbf24",
        provenance: {
          mass: { kind: "calculated", method: "Tidal disruption mass conservation (25% debris / 6)" },
          radius: { kind: "calculated", method: "Volume conservation from fragment mass" },
          state: { kind: "calculated", method: "Orbital momentum conservation with symmetric dispersion" },
        },
      });
    }

    // Surviving primary with accreted 75% mass
    const newRadius = Math.cbrt(Math.pow(primary.radius, 3) + (1 - debrisFraction) * Math.pow(secondary.radius, 3));

    const surviving: SimulationBody = {
      ...primary,
      mass: primaryNewMass,
      radius: newRadius,
      position: posPrimRetained,
      velocity: vPrimRetained,
      gravityRole: "massive",
      provenance: {
        ...primary.provenance,
        mass: {
          kind: "calculated",
          method: "Tidal disruption core accretion (75% retained)",
          note: `Accreted from ${secondary.name}`,
        },
        radius: { kind: "calculated", method: "Volume conservation with accreted core" },
        state: { kind: "calculated", method: "Linear momentum conservation" },
      },
    };

    return {
      survivingBody: surviving,
      removedBodyIds: [secondary.id],
      remnantBodies: remnants,
      diagnostics,
      outcome: "tidal_disruption",
    };
  }

  // General inelastic merge (for comparable mass bodies or direct central impact)
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
