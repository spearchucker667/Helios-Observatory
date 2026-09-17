import type { SimulationBody } from "../domain/types.ts";
import { computeEphemerisStateVector } from "../../lib/ephemeris.ts";
import { bodyById } from "../../data/registry.ts";

export function createSimulationBodyFromCanonical(
  bodyId: string,
  daysFromJ2000: number
): SimulationBody | null {
  const canonical = bodyById(bodyId);
  if (!canonical) return null;

  // Clone to avoid leaking mutations
  const safeCanonical = structuredClone(canonical);

  // The Sun is the origin of the heliocentric coordinate system
  let stateVector = null;
  if (bodyId === "sun") {
    stateVector = {
      position: [0, 0, 0] as [number, number, number],
      velocity: [0, 0, 0] as [number, number, number],
      epochDays: daysFromJ2000,
      provenance: { kind: "canonical" as const, source: "Heliocentric Origin", authority: "System" }
    };
  } else {
    stateVector = computeEphemerisStateVector(bodyId, daysFromJ2000);
  }

  if (!stateVector) {
    // If we can't defensibly produce a Cartesian state, we return null for now.
    // Moon initialization policy says: "The default Solar-System sandbox should initially 
    // include only bodies whose mass and Cartesian state can be defensibly produced."
    return null;
  }

  const massKg = safeCanonical.physical?.massKg24 
    ? safeCanonical.physical.massKg24 * 1e24 
    : undefined;

  const radiusM = safeCanonical.physical?.meanRadiusKm
    ? safeCanonical.physical.meanRadiusKm * 1000
    : undefined;

  const hasMass = massKg !== undefined && massKg > 0;
  const hasRadius = radiusM !== undefined && radiusM > 0;

  const gravityRole = (hasMass && hasRadius) ? "massive" : "tracer";

  // If tracer, we need *some* mass/radius for internal structure, but it won't exert gravity.
  // The task says "Never invent a mass simply so an object can enter the full N-body solver."
  // So we use role="tracer" and 0 mass/radius.
  const simMass = hasMass ? massKg : 0;
  const simRadius = hasRadius ? radiusM : 0;
  const canonicalSourceIds = safeCanonical.sources ? safeCanonical.sources.map(s => s.id) : [];

  return {
    id: safeCanonical.identity.id,
    name: safeCanonical.identity.name,
    classification: safeCanonical.identity.kind === "star" ? "star" :
                    safeCanonical.identity.kind === "planet" ? "planet" :
                    safeCanonical.identity.kind === "dwarf-planet" ? "dwarf-planet" : "moon",
    gravityRole,
    mass: simMass,
    radius: simRadius,
    position: [...stateVector.position],
    velocity: [...stateVector.velocity],
    color: safeCanonical.identity.color,
    provenance: {
      mass: hasMass 
        ? { kind: "canonical", sourceIds: canonicalSourceIds } 
        : { kind: "unsupported", note: "Mass unknown; acting as tracer" },
      radius: hasRadius
        ? { kind: "canonical", sourceIds: canonicalSourceIds }
        : { kind: "unsupported", note: "Radius unknown" },
      state: {
        kind: stateVector.provenance.kind,
        method: "computeEphemerisStateVector",
        note: `${stateVector.provenance.source} via ${stateVector.provenance.authority}`
      }
    }
  };
}
