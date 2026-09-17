import type { SimulationBody } from "../domain/types.ts";
import type { Vector3 } from "../physics/vector.ts";

export type SimulationCommand =
  | { type: "add_body"; body: SimulationBody }
  | { type: "update_body"; id: string; updates: Partial<SimulationBody> }
  | { type: "delete_body"; id: string }
  | { type: "duplicate_body"; id: string; newId: string; offsetM?: Vector3 }
  | { type: "set_position"; id: string; position: Vector3 }
  | { type: "set_velocity"; id: string; velocity: Vector3 }
  | { type: "apply_impulse"; id: string; impulseMs: Vector3 }
  | { type: "set_mass"; id: string; massKg: number }
  | { type: "set_radius"; id: string; radiusM: number }
  | { type: "set_time_multiplier"; multiplier: number }
  | { type: "set_dt"; dtSeconds: number }
  | { type: "set_relativity"; enabled: boolean }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "reset_to_initial" };

export interface LoggedCommand {
  tick: number;
  simTimeSeconds: number;
  command: SimulationCommand;
}
