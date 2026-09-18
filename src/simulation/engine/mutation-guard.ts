import type { SimulationBody } from "../domain/types.ts";
import type { SimulationCommand } from "./commands.ts";
import { MAX_FULL_GRAVITY_BODIES, MAX_TOTAL_SIMULATION_BODIES } from "../physics/gravity.ts";
import { calculateSchwarzschildRadius } from "./compact-objects.ts";

export interface MutationValidationOk {
  ok: true;
}

export interface MutationValidationError {
  ok: false;
  error: string;
}

export type MutationValidation = MutationValidationOk | MutationValidationError;

/** Read-only view of the world the validator needs. */
export interface WorldMutationContext {
  hasBody(id: string): boolean;
  getBody(id: string): SimulationBody | undefined;
  massiveBodyCount(): number;
  totalBodyCount(): number;
}

const COMPACT_CLASSES = new Set(["black-hole", "neutron-star", "pulsar", "magnetar"]);

export function isFiniteVector(v: readonly unknown[]): boolean {
  return (
    Array.isArray(v) &&
    v.length === 3 &&
    typeof v[0] === "number" &&
    typeof v[1] === "number" &&
    typeof v[2] === "number" &&
    Number.isFinite(v[0]) &&
    Number.isFinite(v[1]) &&
    Number.isFinite(v[2])
  );
}

/**
 * Validates an entire body record before it enters the world.
 * Used for `add_body` and for the initial state of a scenario.
 */
export function validateBodyRecord(body: SimulationBody): MutationValidation {
  if (!body || typeof body !== "object") return { ok: false, error: "Body record must be an object" };
  if (typeof body.id !== "string" || body.id.length === 0) {
    return { ok: false, error: "Body id must be a non-empty string" };
  }
  if (typeof body.name !== "string" || body.name.length === 0) {
    return { ok: false, error: `Body ${body.id}: name must be a non-empty string` };
  }
  if (body.gravityRole !== "massive" && body.gravityRole !== "tracer") {
    return { ok: false, error: `Body ${body.id}: invalid gravity role` };
  }
  if (!Number.isFinite(body.mass) || body.mass < 0) {
    return { ok: false, error: `Body ${body.id}: mass must be a finite non-negative number` };
  }
  if (!Number.isFinite(body.radius) || body.radius < 0) {
    return { ok: false, error: `Body ${body.id}: radius must be a finite non-negative number` };
  }
  if (body.gravityRole === "massive" && body.mass <= 0) {
    return { ok: false, error: `Body ${body.id}: a massive body requires positive mass` };
  }
  if (body.gravityRole === "massive" && body.radius <= 0) {
    return { ok: false, error: `Body ${body.id}: a massive body requires positive radius` };
  }
  if (!isFiniteVector(body.position)) {
    return { ok: false, error: `Body ${body.id}: position must be a finite 3-vector` };
  }
  if (!isFiniteVector(body.velocity)) {
    return { ok: false, error: `Body ${body.id}: velocity must be a finite 3-vector` };
  }
  if (!body.provenance || typeof body.provenance !== "object") {
    return { ok: false, error: `Body ${body.id}: provenance record is required` };
  }
  for (const field of ["mass", "radius", "state"] as const) {
    if (!body.provenance[field]) {
      return { ok: false, error: `Body ${body.id}: provenance.${field} is required` };
    }
  }
  if (body.thermal) {
    const { albedo, emissivity, surfaceTempK, equilibriumTempK } = body.thermal;
    if (albedo !== undefined && (!Number.isFinite(albedo) || albedo < 0 || albedo > 1)) {
      return { ok: false, error: `Body ${body.id}: albedo must lie in [0, 1]` };
    }
    if (emissivity !== undefined && (!Number.isFinite(emissivity) || emissivity <= 0 || emissivity > 1)) {
      return { ok: false, error: `Body ${body.id}: emissivity must lie in (0, 1]` };
    }
    if (surfaceTempK !== undefined && (!Number.isFinite(surfaceTempK) || surfaceTempK < 0)) {
      return { ok: false, error: `Body ${body.id}: surface temperature must be finite and non-negative` };
    }
    if (equilibriumTempK !== undefined && (!Number.isFinite(equilibriumTempK) || equilibriumTempK < 0)) {
      return { ok: false, error: `Body ${body.id}: equilibrium temperature must be finite and non-negative` };
    }
  }
  if (body.compact) {
    const { schwarzschildRadiusM, magneticFieldTesla, spinPeriodSeconds } = body.compact;
    if (schwarzschildRadiusM !== undefined && (!Number.isFinite(schwarzschildRadiusM) || schwarzschildRadiusM < 0)) {
      return { ok: false, error: `Body ${body.id}: Schwarzschild radius must be finite and non-negative` };
    }
    if (magneticFieldTesla !== undefined && (!Number.isFinite(magneticFieldTesla) || magneticFieldTesla < 0)) {
      return { ok: false, error: `Body ${body.id}: magnetic field must be finite and non-negative` };
    }
    if (spinPeriodSeconds !== undefined && (!Number.isFinite(spinPeriodSeconds) || spinPeriodSeconds <= 0)) {
      return { ok: false, error: `Body ${body.id}: spin period must be finite and positive` };
    }
  }
  if (body.rotation?.periodSeconds !== undefined) {
    if (!Number.isFinite(body.rotation.periodSeconds) || body.rotation.periodSeconds <= 0) {
      return { ok: false, error: `Body ${body.id}: rotation period must be finite and positive` };
    }
  }
  if (body.radiative?.luminosityWatts !== undefined) {
    if (!Number.isFinite(body.radiative.luminosityWatts) || body.radiative.luminosityWatts < 0) {
      return { ok: false, error: `Body ${body.id}: luminosity must be finite and non-negative` };
    }
  }
  if (body.density !== undefined && (!Number.isFinite(body.density) || body.density <= 0)) {
    return { ok: false, error: `Body ${body.id}: density must be finite and positive` };
  }
  return { ok: true };
}

/**
 * Enforces the compact-object coupling rule:
 *   mass  = authoritative input
 *   r_s   = 2GM/c^2                       (calculated)
 *   radius (physical capture radius) = r_s (calculated)
 * A Schwarzschild black hole can therefore never carry a horizon radius that
 * disagrees with its mass.
 */
export function applyCompactInvariants(body: SimulationBody, method: string): void {
  if (body.classification !== "black-hole") return;
  const rs = calculateSchwarzschildRadius(body.mass);
  body.radius = rs;
  body.density = body.radius > 0 ? body.mass / ((4 / 3) * Math.PI * Math.pow(body.radius, 3)) : undefined;
  body.compact = { ...(body.compact ?? {}), schwarzschildRadiusM: rs };
  body.provenance.radius = { kind: "calculated", method: `rs = 2GM/c^2 (${method})` };
  body.provenance.compact = { kind: "calculated", method: `rs = 2GM/c^2 (${method})` };
  if (body.density !== undefined) {
    body.provenance.density = { kind: "calculated", method: "Uniform sphere density from derived horizon radius" };
  }
}

/** Recomputes a compact object's horizon radius when its mass changes. */
export function isCompactObject(body: SimulationBody): boolean {
  return COMPACT_CLASSES.has(body.classification);
}

/**
 * Central mutation validator. EVERY world-mutating command must pass through
 * this before it touches authoritative state.
 */
export function validateWorldMutation(
  ctx: WorldMutationContext,
  command: SimulationCommand
): MutationValidation {
  const requireBody = (id: string): MutationValidation | SimulationBody => {
    const body = ctx.getBody(id);
    if (!body) return { ok: false, error: `No body with id "${id}"` };
    return body;
  };

  switch (command.type) {
    case "add_body": {
      if (ctx.totalBodyCount() >= MAX_TOTAL_SIMULATION_BODIES) {
        return {
          ok: false,
          error: `Maximum body capacity reached (${MAX_TOTAL_SIMULATION_BODIES})`,
        };
      }
      if (ctx.hasBody(command.body.id)) {
        return { ok: false, error: `Body id "${command.body.id}" already exists` };
      }
      const recordCheck = validateBodyRecord(command.body);
      if (!recordCheck.ok) return recordCheck;
      if (
        command.body.gravityRole === "massive" &&
        ctx.massiveBodyCount() >= MAX_FULL_GRAVITY_BODIES &&
        !ctx.hasBody(command.body.id)
      ) {
        // Over the cap we do not reject: the body is admitted as a tracer, but
        // the decision is explicit and reported (see world.executeCommand).
        return { ok: true };
      }
      return { ok: true };
    }

    case "duplicate_body": {
      if (ctx.totalBodyCount() >= MAX_TOTAL_SIMULATION_BODIES) {
        return { ok: false, error: `Maximum body capacity reached (${MAX_TOTAL_SIMULATION_BODIES})` };
      }
      if (!ctx.hasBody(command.id)) {
        return { ok: false, error: `Cannot duplicate missing body "${command.id}"` };
      }
      if (ctx.hasBody(command.newId)) {
        return { ok: false, error: `Body id "${command.newId}" already exists` };
      }
      if (command.newId === command.id) {
        return { ok: false, error: "Duplicate body must receive a distinct id" };
      }
      if (command.offsetM !== undefined && !isFiniteVector(command.offsetM)) {
        return { ok: false, error: "Duplicate offset must be a finite 3-vector" };
      }
      return { ok: true };
    }

    case "delete_body":
      return ctx.hasBody(command.id)
        ? { ok: true }
        : { ok: false, error: `No body with id "${command.id}"` };

    case "set_name":
      if (!ctx.hasBody(command.id)) return { ok: false, error: `No body with id "${command.id}"` };
      if (typeof command.name !== "string" || command.name.trim().length === 0) {
        return { ok: false, error: "Name must be a non-empty string" };
      }
      if (command.name.length > 100) return { ok: false, error: "Name exceeds 100 characters" };
      return { ok: true };

    case "set_classification":
      return ctx.hasBody(command.id)
        ? { ok: true }
        : { ok: false, error: `No body with id "${command.id}"` };

    case "set_gravity_role": {
      const body = requireBody(command.id);
      if ("ok" in body) return body;
      if (command.gravityRole === "massive" && body.gravityRole !== "massive") {
        if (body.mass <= 0) {
          return { ok: false, error: `Body "${command.id}" cannot become massive with zero mass` };
        }
        if (ctx.massiveBodyCount() >= MAX_FULL_GRAVITY_BODIES) {
          return {
            ok: false,
            error: `Maximum full-gravity body count reached (${MAX_FULL_GRAVITY_BODIES})`,
          };
        }
      }
      return { ok: true };
    }

    case "set_color":
      return ctx.hasBody(command.id)
        ? { ok: true }
        : { ok: false, error: `No body with id "${command.id}"` };

    case "set_mass": {
      const body = requireBody(command.id);
      if ("ok" in body) return body;
      if (!Number.isFinite(command.massKg) || command.massKg <= 0) {
        return { ok: false, error: "Mass must be finite and strictly positive" };
      }
      if (body.gravityRole !== "massive" && ctx.massiveBodyCount() >= MAX_FULL_GRAVITY_BODIES) {
        return {
          ok: false,
          error: `Maximum full-gravity body count reached (${MAX_FULL_GRAVITY_BODIES}); mass edit rejected`,
        };
      }
      return { ok: true };
    }

    case "set_radius": {
      const body = requireBody(command.id);
      if ("ok" in body) return body;
      if (!Number.isFinite(command.radiusM) || command.radiusM <= 0) {
        return { ok: false, error: "Radius must be finite and strictly positive" };
      }
      if (body.classification === "black-hole") {
        return {
          ok: false,
          error: "A Schwarzschild horizon radius is derived (rs = 2GM/c^2); edit the mass instead",
        };
      }
      return { ok: true };
    }

    case "set_position":
      if (!ctx.hasBody(command.id)) return { ok: false, error: `No body with id "${command.id}"` };
      if (!isFiniteVector(command.position)) {
        return { ok: false, error: "Position must be a finite 3-vector" };
      }
      return { ok: true };

    case "set_velocity":
      if (!ctx.hasBody(command.id)) return { ok: false, error: `No body with id "${command.id}"` };
      if (!isFiniteVector(command.velocity)) {
        return { ok: false, error: "Velocity must be a finite 3-vector" };
      }
      return { ok: true };

    case "apply_impulse":
      if (!ctx.hasBody(command.id)) return { ok: false, error: `No body with id "${command.id}"` };
      if (!isFiniteVector(command.impulseMs)) {
        return { ok: false, error: "Impulse must be a finite 3-vector" };
      }
      return { ok: true };

    case "set_rotation":
      if (!ctx.hasBody(command.id)) return { ok: false, error: `No body with id "${command.id}"` };
      if (command.rotation?.periodSeconds !== undefined) {
        if (!Number.isFinite(command.rotation.periodSeconds) || command.rotation.periodSeconds <= 0) {
          return { ok: false, error: "Rotation period must be finite and positive" };
        }
      }
      return { ok: true };

    case "set_thermal": {
      if (!ctx.hasBody(command.id)) return { ok: false, error: `No body with id "${command.id}"` };
      const thermal = command.thermal;
      if (thermal) {
        if (thermal.albedo !== undefined && (!Number.isFinite(thermal.albedo) || thermal.albedo < 0 || thermal.albedo > 1)) {
          return { ok: false, error: "Albedo must lie in [0, 1]" };
        }
        if (
          thermal.emissivity !== undefined &&
          (!Number.isFinite(thermal.emissivity) || thermal.emissivity <= 0 || thermal.emissivity > 1)
        ) {
          return { ok: false, error: "Emissivity must lie in (0, 1]" };
        }
        if (thermal.surfaceTempK !== undefined && (!Number.isFinite(thermal.surfaceTempK) || thermal.surfaceTempK < 0)) {
          return { ok: false, error: "Surface temperature must be finite and non-negative" };
        }
        if (
          thermal.equilibriumTempK !== undefined &&
          (!Number.isFinite(thermal.equilibriumTempK) || thermal.equilibriumTempK < 0)
        ) {
          return { ok: false, error: "Equilibrium temperature must be finite and non-negative" };
        }
      }
      return { ok: true };
    }

    case "set_radiative":
      if (!ctx.hasBody(command.id)) return { ok: false, error: `No body with id "${command.id}"` };
      if (
        command.radiative?.luminosityWatts !== undefined &&
        (!Number.isFinite(command.radiative.luminosityWatts) || command.radiative.luminosityWatts < 0)
      ) {
        return { ok: false, error: "Luminosity must be finite and non-negative" };
      }
      return { ok: true };

    case "set_compact_properties": {
      if (!ctx.hasBody(command.id)) return { ok: false, error: `No body with id "${command.id}"` };
      const compact = command.compact;
      if (compact) {
        if (
          compact.magneticFieldTesla !== undefined &&
          (!Number.isFinite(compact.magneticFieldTesla) || compact.magneticFieldTesla < 0)
        ) {
          return { ok: false, error: "Magnetic field must be finite and non-negative" };
        }
        if (
          compact.schwarzschildRadiusM !== undefined &&
          (!Number.isFinite(compact.schwarzschildRadiusM) || compact.schwarzschildRadiusM < 0)
        ) {
          return { ok: false, error: "Schwarzschild radius must be finite and non-negative" };
        }
        if (
          compact.spinPeriodSeconds !== undefined &&
          (!Number.isFinite(compact.spinPeriodSeconds) || compact.spinPeriodSeconds <= 0)
        ) {
          return { ok: false, error: "Spin period must be finite and positive" };
        }
      }
      return { ok: true };
    }

    case "set_parent_body":
      if (!ctx.hasBody(command.id)) return { ok: false, error: `No body with id "${command.id}"` };
      if (command.parentBodyId !== undefined) {
        if (!ctx.hasBody(command.parentBodyId)) {
          return { ok: false, error: `No parent body with id "${command.parentBodyId}"` };
        }
        if (command.parentBodyId === command.id) {
          return { ok: false, error: "A body cannot be its own parent" };
        }
      }
      return { ok: true };

    case "set_time_multiplier":
      if (!Number.isFinite(command.multiplier) || command.multiplier < 0) {
        return { ok: false, error: "Time multiplier must be finite and non-negative" };
      }
      return { ok: true };

    case "set_dt":
      if (!Number.isFinite(command.dtSeconds) || command.dtSeconds <= 0) {
        return { ok: false, error: "Timestep must be finite and strictly positive" };
      }
      return { ok: true };

    case "set_relativity":
      return { ok: true };

    case "reset_to_initial":
      return { ok: true };

    default: {
      const exhaustive: never = command;
      return { ok: false, error: `Unsupported command: ${JSON.stringify(exhaustive)}` };
    }
  }
}
