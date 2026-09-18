import type {
  GravityRole,
  SimulationBody,
  SimulationBodyClass,
  SimulationCompact,
  SimulationRadiative,
  SimulationRotation,
  SimulationThermal,
} from "../domain/types.ts";
import type { Vector3 } from "../physics/vector.ts";

/**
 * Deterministic, provenance-aware world mutation commands.
 *
 * There is deliberately NO generic `update_body` / `Partial<SimulationBody>`
 * mutation path: every mutating domain concept has a narrow, validated command
 * that knows which provenance fields it invalidates.
 */
export type SimulationCommand =
  | { type: "add_body"; body: SimulationBody }
  | { type: "delete_body"; id: string }
  | { type: "duplicate_body"; id: string; newId: string; offsetM?: Vector3 }
  | { type: "set_name"; id: string; name: string }
  | { type: "set_classification"; id: string; classification: SimulationBodyClass }
  | { type: "set_gravity_role"; id: string; gravityRole: GravityRole }
  | { type: "set_color"; id: string; color?: string }
  | { type: "set_mass"; id: string; massKg: number }
  | { type: "set_radius"; id: string; radiusM: number }
  | { type: "set_position"; id: string; position: Vector3 }
  | { type: "set_velocity"; id: string; velocity: Vector3 }
  | { type: "set_rotation"; id: string; rotation?: SimulationRotation }
  | { type: "set_thermal"; id: string; thermal?: SimulationThermal }
  | { type: "set_radiative"; id: string; radiative?: SimulationRadiative }
  | { type: "set_compact_properties"; id: string; compact?: SimulationCompact }
  | { type: "set_parent_body"; id: string; parentBodyId?: string }
  | { type: "apply_impulse"; id: string; impulseMs: Vector3 }
  | { type: "set_time_multiplier"; multiplier: number }
  | { type: "set_dt"; dtSeconds: number }
  | { type: "set_relativity"; enabled: boolean }
  | { type: "reset_to_initial" };

/** Commands that mutate a body's continuous physical state (and provenance). */
export const PHYSICS_EDIT_COMMAND_TYPES = [
  "set_position",
  "set_velocity",
  "set_mass",
  "set_radius",
  "set_compact_properties",
  "apply_impulse",
] as const;

/** Commands that are pure presentation/metadata and never touch provenance. */
export const METADATA_COMMAND_TYPES = ["set_color", "set_name"] as const;

export interface LoggedCommand {
  tick: number;
  simTimeSeconds: number;
  command: SimulationCommand;
}
