import type { SimulationBody } from "../domain/types.ts";
import type { SimulationCommand, LoggedCommand } from "../engine/commands.ts";
import type { SimulationEvent } from "../engine/events.ts";
import type { RenderSnapshot, SimulationCheckpoint, WorldSnapshot } from "../engine/snapshot.ts";
import type { PlaybackState, TimestepQuality, TimestepStats } from "../engine/timestep.ts";

/**
 * Hand-written protocol types (authoritative for the TypeScript view).
 * Runtime validation lives in ./worker-schemas.ts.
 */
export type WorkerInboundMessage =
  | {
      type: "init";
      bodies: SimulationBody[];
      dtSeconds?: number;
      simTimeSeconds?: number;
      tick?: number;
      enableRelativity?: boolean;
    }
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
  | { type: "request_command_log" }
  | { type: "load_checkpoint"; checkpoint: SimulationCheckpoint }
  | {
      type: "load_scenario";
      initialState: WorldSnapshot;
      commands: LoggedCommand[];
      finalState: { tick: number; simTimeSeconds: number };
    }
  | { type: "reset_to_initial" };

export type WorkerOutboundMessage =
  | { type: "ready"; engineVersion: string }
  | { type: "snapshot"; data: RenderSnapshot }
  | { type: "event"; event: SimulationEvent }
  | { type: "trajectory_result"; bodyId: string; trajectory: [number, number, number][] }
  | { type: "checkpoint"; checkpoint: SimulationCheckpoint }
  | { type: "command_log"; commandLog: LoggedCommand[]; initialState: WorldSnapshot }
  | { type: "world_changed"; bodies: SimulationBody[]; removedIds: string[]; reason: string }
  | { type: "performance_status"; stats: TimestepStats }
  | { type: "playback_state"; state: PlaybackState }
  | { type: "error"; error: string; code?: string }
  | {
      type: "simulation_halted";
      reason: string;
      lastGoodTick: number;
      lastGoodSnapshot: WorldSnapshot | null;
    };

export type { PlaybackState, TimestepStats, SimulationCheckpoint };
