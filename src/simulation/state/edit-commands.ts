import type { SimulationBody } from "../domain/types.ts";
import type { SimulationCommand } from "../engine/commands.ts";
import { isFiniteVector } from "../engine/mutation-guard.ts";

function vectorsDiffer(a?: readonly number[], b?: readonly number[]): boolean {
  if (!a || !b) return a !== b;
  return a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2];
}

function jsonDiffer(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
}

/**
 * Translates an editor draft into narrow, provenance-aware commands.
 *
 * The editor is NOT allowed to write a generic body patch: each changed domain
 * concept maps to the command that owns its invariants and provenance
 * transition. Nothing is emitted for unchanged fields, so a no-op save
 * produces no commands at all.
 */
export function buildBodyEditCommands(
  current: SimulationBody | undefined,
  draft: SimulationBody
): SimulationCommand[] {
  if (!current) {
    return [{ type: "add_body", body: draft }];
  }

  const commands: SimulationCommand[] = [];

  if (draft.name !== current.name) {
    commands.push({ type: "set_name", id: current.id, name: draft.name });
  }
  if (draft.classification !== current.classification) {
    commands.push({ type: "set_classification", id: current.id, classification: draft.classification });
  }
  if (draft.gravityRole !== current.gravityRole) {
    commands.push({ type: "set_gravity_role", id: current.id, gravityRole: draft.gravityRole });
  }
  if (draft.mass !== current.mass) {
    commands.push({ type: "set_mass", id: current.id, massKg: draft.mass });
  }
  // A black hole's horizon radius is derived from its mass, so radius edits are
  // intentionally never emitted for that class.
  if (draft.radius !== current.radius && draft.classification !== "black-hole") {
    commands.push({ type: "set_radius", id: current.id, radiusM: draft.radius });
  }
  if (vectorsDiffer(draft.position, current.position)) {
    commands.push({ type: "set_position", id: current.id, position: [...draft.position] });
  }
  if (vectorsDiffer(draft.velocity, current.velocity)) {
    commands.push({ type: "set_velocity", id: current.id, velocity: [...draft.velocity] });
  }
  if (jsonDiffer(draft.rotation, current.rotation)) {
    commands.push({ type: "set_rotation", id: current.id, rotation: draft.rotation });
  }
  if (jsonDiffer(draft.thermal, current.thermal)) {
    commands.push({ type: "set_thermal", id: current.id, thermal: draft.thermal });
  }
  if (jsonDiffer(draft.radiative, current.radiative)) {
    commands.push({ type: "set_radiative", id: current.id, radiative: draft.radiative });
  }
  if (jsonDiffer(draft.compact, current.compact)) {
    commands.push({ type: "set_compact_properties", id: current.id, compact: draft.compact });
  }
  if (draft.parentBodyId !== current.parentBodyId) {
    commands.push({ type: "set_parent_body", id: current.id, parentBodyId: draft.parentBodyId });
  }
  if (draft.color !== current.color) {
    commands.push({ type: "set_color", id: current.id, color: draft.color });
  }

  return commands;
}

/**
 * Guards a set of edit commands before they are dispatched to the worker.
 * Cheap structural checks only; the world re-validates authoritatively.
 */
export function validateEditCommands(
  commands: SimulationCommand[],
  existingIds: ReadonlySet<string>
): { ok: true } | { ok: false; error: string } {
  for (const command of commands) {
    switch (command.type) {
      case "add_body":
        if (existingIds.has(command.body.id)) return { ok: false, error: `Body id "${command.body.id}" already exists` };
        if (!Number.isFinite(command.body.mass) || command.body.mass < 0) {
          return { ok: false, error: "Mass must be a finite non-negative number" };
        }
        if (!Number.isFinite(command.body.radius) || command.body.radius < 0) {
          return { ok: false, error: "Radius must be a finite non-negative number" };
        }
        if (!isFiniteVector(command.body.position)) return { ok: false, error: "Position must be finite" };
        if (!isFiniteVector(command.body.velocity)) return { ok: false, error: "Velocity must be finite" };
        break;
      case "set_mass":
        if (!Number.isFinite(command.massKg) || command.massKg <= 0) {
          return { ok: false, error: "Mass must be finite and strictly positive" };
        }
        break;
      case "set_radius":
        if (!Number.isFinite(command.radiusM) || command.radiusM <= 0) {
          return { ok: false, error: "Radius must be finite and strictly positive" };
        }
        break;
      case "set_position":
        if (!isFiniteVector(command.position)) return { ok: false, error: "Position must be finite" };
        break;
      case "set_velocity":
        if (!isFiniteVector(command.velocity)) return { ok: false, error: "Velocity must be finite" };
        break;
      case "apply_impulse":
        if (!isFiniteVector(command.impulseMs)) return { ok: false, error: "Impulse must be finite" };
        break;
      default:
        break;
    }
  }
  return { ok: true };
}
