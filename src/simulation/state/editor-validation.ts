import type { SimulationBody } from "../domain/types.ts";
import { isFiniteVector } from "../engine/mutation-guard.ts";
import { calculateSchwarzschildRadius } from "../engine/compact-objects.ts";

export interface EditorValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export const COMPACT_CLASSIFICATIONS = new Set([
  "black-hole",
  "neutron-star",
  "pulsar",
  "magnetar",
]);

/** Relative tolerance when checking that a horizon radius equals rs = 2GM/c^2. */
export const SCHWARZSCHILD_RADIUS_TOLERANCE = 1e-9;

/**
 * Validates a BodyEditor draft before it becomes world commands.
 * Assertions that this function makes are covered by
 * src/simulation/tests/editor.test.ts.
 */
export function validateBodyDraft(draft: Partial<SimulationBody> | null | undefined): EditorValidationResult {
  const errors: Record<string, string> = {};

  if (!draft || typeof draft !== "object") {
    return { valid: false, errors: { draft: "No body draft provided" } };
  }

  if (typeof draft.name !== "string" || draft.name.trim().length === 0) {
    errors.name = "Name cannot be empty";
  }

  const mass = draft.mass;
  if (mass === undefined || !Number.isFinite(mass)) {
    errors.mass = "Mass must be a finite number";
  } else if (mass < 0) {
    errors.mass = "Mass cannot be negative";
  } else if (draft.gravityRole === "massive" && mass === 0) {
    errors.mass = "A full-gravity body requires positive mass";
  }

  const radius = draft.radius;
  if (radius === undefined || !Number.isFinite(radius)) {
    errors.radius = "Radius must be a finite number";
  } else if (radius < 0) {
    errors.radius = "Radius cannot be negative";
  } else if (draft.gravityRole === "massive" && radius === 0) {
    errors.radius = "A full-gravity body requires a positive radius";
  }

  if (draft.position !== undefined && !isFiniteVector(draft.position)) {
    errors.position = "Position must be a finite 3-vector";
  }
  if (draft.velocity !== undefined && !isFiniteVector(draft.velocity)) {
    errors.velocity = "Velocity must be a finite 3-vector";
  }

  const compact = draft.compact;
  if (compact) {
    if (compact.schwarzschildRadiusM !== undefined && !Number.isFinite(compact.schwarzschildRadiusM)) {
      errors.compactSchwarzschild = "Schwarzschild radius must be finite";
    }
    if (compact.magneticFieldTesla !== undefined && !Number.isFinite(compact.magneticFieldTesla)) {
      errors.compactMagnetic = "Magnetic field must be finite";
    }
    if (compact.spinPeriodSeconds !== undefined && !(compact.spinPeriodSeconds > 0)) {
      errors.compactSpin = "Spin period must be positive";
    }
  }

  const thermal = draft.thermal;
  if (thermal) {
    if (thermal.albedo !== undefined && !(thermal.albedo >= 0 && thermal.albedo <= 1)) {
      errors.thermalAlbedo = "Albedo must lie within [0, 1]";
    }
    if (thermal.emissivity !== undefined && !(thermal.emissivity > 0 && thermal.emissivity <= 1)) {
      errors.thermalEmissivity = "Emissivity must lie within (0, 1]";
    }
    if (thermal.surfaceTempK !== undefined && !(Number.isFinite(thermal.surfaceTempK) && thermal.surfaceTempK >= 0)) {
      errors.thermalSurfaceTemp = "Surface temperature must be finite and non-negative";
    }
  }

  // Compact-object coupling: for a Schwarzschild hole the horizon radius is
  // derived from the mass, so an edited radius that disagrees is invalid.
  if (draft.classification === "black-hole") {
    const expectedRs = calculateSchwarzschildRadius(Number.isFinite(mass) ? (mass as number) : 0);
    if (Number.isFinite(expectedRs) && expectedRs > 0) {
      if (Number.isFinite(radius) && radius !== undefined && radius > 0) {
        const relError = Math.abs((radius as number) - expectedRs) / expectedRs;
        if (relError > SCHWARZSCHILD_RADIUS_TOLERANCE) {
          errors.radius =
            `Black-hole horizon radius must equal rs = 2GM/c^2 (${expectedRs.toFixed(3)} m). Edit the mass instead.`;
        }
      }
      if (
        compact?.schwarzschildRadiusM !== undefined &&
        Number.isFinite(compact.schwarzschildRadiusM) &&
        Math.abs(compact.schwarzschildRadiusM - expectedRs) / expectedRs > SCHWARZSCHILD_RADIUS_TOLERANCE
      ) {
        errors.compactSchwarzschild =
          `Recorded Schwarzschild radius disagrees with rs = 2GM/c^2 (${expectedRs.toFixed(3)} m).`;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Returns a copy of the draft with derived compact-object fields consistent.
 * Only derived (calculated) fields are touched; user inputs are never altered.
 */
export function normalizeCompactInvariants(draft: SimulationBody): SimulationBody {
  if (draft.classification !== "black-hole") return draft;
  const rs = calculateSchwarzschildRadius(draft.mass);
  return {
    ...draft,
    radius: rs,
    compact: { ...(draft.compact ?? {}), schwarzschildRadiusM: rs },
    provenance: {
      ...draft.provenance,
      radius: { kind: "calculated", method: "rs = 2GM/c^2" },
      compact: { kind: "calculated", method: "rs = 2GM/c^2" },
    },
  };
}
