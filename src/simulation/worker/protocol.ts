import type { SimulationBody } from "../domain/types.ts";
import type { SimulationCommand } from "../engine/commands.ts";
import type { SimulationEvent } from "../engine/events.ts";
import type { RenderSnapshot, WorldSnapshot } from "../engine/snapshot.ts";
import type { TimestepQuality, TimestepStats } from "../engine/timestep.ts";

export type WorkerInboundMessage =
  | { type: "init"; bodies: SimulationBody[]; dtSeconds?: number; simTimeSeconds?: number; tick?: number }
  | { type: "command"; command: SimulationCommand }
  | { type: "pause" }
  | { type: "resume" }
  | { type: "step_once" }
  | { type: "set_time_multiplier"; multiplier: number }
  | { type: "set_dt"; dtSeconds: number }
  | { type: "set_relativity"; enabled: boolean }
  | { type: "set_quality"; quality: TimestepQuality }
  | { type: "request_snapshot" }
  | { type: "request_trajectory"; bodyId: string; steps?: number; dt?: number }
  | { type: "request_checkpoint" }
  | { type: "load_checkpoint"; snapshot: WorldSnapshot }
  | { type: "reset_to_initial" };

export type WorkerOutboundMessage =
  | { type: "ready"; engineVersion: string }
  | { type: "snapshot"; data: RenderSnapshot }
  | { type: "event"; event: SimulationEvent }
  | { type: "trajectory_result"; bodyId: string; trajectory: [number, number, number][] }
  | { type: "checkpoint"; snapshot: WorldSnapshot }
  | { type: "performance_status"; stats: TimestepStats }
  | { type: "error"; error: string };
