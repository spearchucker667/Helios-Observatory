import type { SimulationBody } from "../domain/types.ts";
import {
  computeEphemerisStateVector,
  isSupportedEphemerisDay,
  EPHEMERIS_VALID_MIN_DATE,
  EPHEMERIS_VALID_MAX_DATE,
} from "../../lib/ephemeris.ts";
import { bodyById, BODIES } from "../../data/registry.ts";
import { transformToBarycentric } from "./barycentric.ts";
import { celsiusToKelvin } from "../domain/units.ts";
import { SOLAR_LUMINOSITY_W } from "../domain/constants.ts";

export function createSimulationBodyFromCanonical(
  bodyId: string,
  daysFromJ2000: number
): SimulationBody | null {
  const canonical = bodyById(bodyId);
  if (!canonical) return null;

  // Clone to avoid leaking mutations into canonical data
  const safeCanonical = structuredClone(canonical);

  // The Sun is the origin of the heliocentric coordinate system
  let stateVector = null;
  if (bodyId === "sun") {
    stateVector = {
      position: [0, 0, 0] as [number, number, number],
      velocity: [0, 0, 0] as [number, number, number],
      epochDays: daysFromJ2000,
      provenance: {
        kind: "calculated" as const,
        source: "Heliocentric origin of the reference frame",
        authority: "System definition",
        sourceIds: ["heliocentric-origin"],
        method: "Frame definition (origin by construction)",
        note: "The Sun sits at the heliocentric origin; this is a frame convention, not an ephemeris fit.",
      },
    };
  } else {
    stateVector = computeEphemerisStateVector(bodyId, daysFromJ2000);
  }

  if (!stateVector) {
    // If we can't defensibly produce a Cartesian state, return null.
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

  const simMass = hasMass ? massKg : 0;
  const simRadius = hasRadius ? radiusM : 0;
  const canonicalSourceIds = safeCanonical.sources ? safeCanonical.sources.map(s => s.id) : [];

  // Thermal & rotation extraction
  const meanTempC = safeCanonical.temperature?.meanC;
  const surfaceTempK = meanTempC !== undefined ? celsiusToKelvin(meanTempC) : undefined;
  
  const rotPeriodHours = safeCanonical.rotation?.periodHours;
  const rotPeriodSeconds = rotPeriodHours !== undefined ? Math.abs(rotPeriodHours) * 3600 : undefined;
  const axialTiltDeg = safeCanonical.rotation?.axialTiltDeg;

  return {
    id: safeCanonical.identity.id,
    name: safeCanonical.identity.name,
    classification: safeCanonical.identity.kind === "star" ? "star" :
                    safeCanonical.identity.kind === "planet" ? "planet" :
                    safeCanonical.identity.kind === "dwarf-planet" ? "dwarf-planet" : "moon",
    gravityRole,
    mass: simMass,
    radius: simRadius,
    density: safeCanonical.physical?.densityGCm3 ? safeCanonical.physical.densityGCm3 * 1000 : undefined,
    position: [...stateVector.position],
    velocity: [...stateVector.velocity],
    rotation: rotPeriodSeconds !== undefined ? { periodSeconds: rotPeriodSeconds, axialTiltDeg } : undefined,
    thermal: surfaceTempK !== undefined ? { surfaceTempK } : undefined,
    radiative: bodyId === "sun" ? { luminosityWatts: SOLAR_LUMINOSITY_W } : undefined,
    physicsCapabilityFlags: {
      hasAtmosphere: !!safeCanonical.atmosphere,
      isLuminous: bodyId === "sun",
      isRelativistic: false,
    },
    color: safeCanonical.identity.color,
    provenance: {
      mass: hasMass 
        ? { kind: "canonical", sourceIds: canonicalSourceIds } 
        : { kind: "unsupported", note: "Mass unknown; acting as tracer" },
      radius: hasRadius
        ? { kind: "canonical", sourceIds: canonicalSourceIds }
        : { kind: "unsupported", note: "Radius unknown" },
      state: bodyId === "sun"
        ? {
            kind: "calculated",
            method: stateVector.provenance.method,
            note: stateVector.provenance.note,
          }
        : {
            kind: "calculated",
            method: stateVector.provenance.method,
            sourceIds: stateVector.provenance.sourceIds,
            note: `${stateVector.provenance.source} via ${stateVector.provenance.authority}`,
          }
    }
  };
}

/**
 * Creates the initial canonical Solar System world in an inertial barycentric frame.
 * Includes Sun, all 8 planets, and 2 dwarf planets (Ceres, Pluto).
 */
export function createCanonicalSolarSystem(
  daysFromJ2000 = 0,
  options?: { barycentric?: boolean }
): SimulationBody[] {
  // Canonical initialization must not present extrapolated state as
  // institutionally backed ephemeris. Fictional/custom simulation time may
  // extend arbitrarily AFTER initialization, but the epoch we start from must
  // lie inside the documented analytical validity window.
  if (!isSupportedEphemerisDay(daysFromJ2000)) {
    throw new Error(
      `Unsupported canonical ephemeris epoch: ${daysFromJ2000} days from J2000. ` +
        `The analytical source model is validated only for ${EPHEMERIS_VALID_MIN_DATE} through ${EPHEMERIS_VALID_MAX_DATE} UTC.`
    );
  }

  const bodies: SimulationBody[] = [];

  // Order: Sun first, then planets and dwarf planets from PRIMARY_BODIES
  const sun = createSimulationBodyFromCanonical("sun", daysFromJ2000);
  if (sun) bodies.push(sun);

  for (const p of BODIES) {
    if (p.identity.id === "sun") continue;
    const body = createSimulationBodyFromCanonical(p.identity.id, daysFromJ2000);
    if (body) bodies.push(body);
  }

  if (options?.barycentric !== false) {
    transformToBarycentric(bodies);
  }

  return bodies;
}
