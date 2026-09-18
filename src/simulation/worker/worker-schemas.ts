import { z } from "zod";
import {
  BodiesArraySchema,
  FinalStateSchema,
  LoggedCommandSchema,
  MAX_LOGGED_COMMANDS,
  MAX_SCENARIO_BODIES,
  MAX_TRAJECTORY_STEPS,
  PlaybackStateSchema,
  SimulationCheckpointSchema,
  SimulationCommandSchema,
  WorldSnapshotSchema,
} from "../scenarios/schema.ts";
import { isFiniteNumber } from "../engine/timestep.ts";

/**
 * Runtime contracts for the worker trust boundary.
 *
 * TypeScript types vanish at runtime, so every inbound message is parsed
 * against these schemas before a single field reaches the world.
 */

const boundedPositive = (max: number) =>
  z
    .number()
    .positive()
    .refine((v) => Number.isFinite(v) && v <= max, `Must be finite and <= ${max}`);

const boundedFinite = (min: number, max: number) =>
  z.number().refine((v) => isFiniteNumber(v) && v >= min && v <= max, `Must be finite within [${min}, ${max}]`);

export const WorkerInboundMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("init"),
    bodies: BodiesArraySchema,
    dtSeconds: boundedPositive(86400 * 365).optional(),
    simTimeSeconds: z.number().refine(Number.isFinite).optional(),
    tick: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
    enableRelativity: z.boolean().optional(),
  }),
  z.strictObject({ type: z.literal("command"), command: SimulationCommandSchema }),
  z.strictObject({ type: z.literal("pause") }),
  z.strictObject({ type: z.literal("resume") }),
  z.strictObject({ type: z.literal("step_once") }),
  z.strictObject({ type: z.literal("set_time_multiplier"), multiplier: boundedFinite(0, 86400 * 365 * 1000) }),
  z.strictObject({ type: z.literal("set_dt"), dtSeconds: boundedPositive(86400 * 365) }),
  z.strictObject({ type: z.literal("set_relativity"), enabled: z.boolean() }),
  z.strictObject({ type: z.literal("set_quality"), quality: z.enum(["fast", "standard", "high"]) }),
  z.strictObject({ type: z.literal("request_snapshot") }),
  z.strictObject({
    type: z.literal("request_trajectory"),
    bodyId: z.string().min(1).max(64),
    steps: z.number().int().min(1).max(MAX_TRAJECTORY_STEPS).optional(),
    dt: boundedPositive(86400 * 365).optional(),
  }),
  z.strictObject({ type: z.literal("request_checkpoint") }),
  z.strictObject({ type: z.literal("request_command_log") }),
  z.strictObject({ type: z.literal("load_checkpoint"), checkpoint: SimulationCheckpointSchema }),
  z.strictObject({
    type: z.literal("load_scenario"),
    initialState: WorldSnapshotSchema,
    commands: z.array(LoggedCommandSchema).max(MAX_LOGGED_COMMANDS),
    finalState: FinalStateSchema,
  }),
  z.strictObject({ type: z.literal("reset_to_initial") }),
]);

export type ValidatedWorkerInboundMessage = z.infer<typeof WorkerInboundMessageSchema>;

/**
 * Outbound contracts.
 *
 * The high-frequency `snapshot` payload is intentionally typed but not
 * re-validated every frame (it carries transferable Float64Arrays produced by
 * this same module); every other message is validated by
 * `validateOutboundMessage`, which the worker asserts on in development and
 * which tests exercise directly.
 */
export const WorkerOutboundMessageSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("ready"), engineVersion: z.string() }),
  z.strictObject({
    type: z.literal("snapshot"),
    data: z.strictObject({
      engineVersion: z.string(),
      simTimeSeconds: z.number(),
      tick: z.number().int(),
      dtSeconds: z.number().positive(),
      numBodies: z.number().int().min(0).max(MAX_SCENARIO_BODIES),
      bodyIds: z.array(z.string()).max(MAX_SCENARIO_BODIES),
      names: z.array(z.string()).max(MAX_SCENARIO_BODIES),
      classes: z.array(z.string()).max(MAX_SCENARIO_BODIES),
      colors: z.array(z.string()).max(MAX_SCENARIO_BODIES),
    }),
  }),
  z.strictObject({ type: z.literal("event"), event: z.strictObject({ eventId: z.string(), tick: z.number().int() }).passthrough() }),
  z.strictObject({
    type: z.literal("trajectory_result"),
    bodyId: z.string(),
    trajectory: z.array(z.tuple([z.number(), z.number(), z.number()])).max(MAX_TRAJECTORY_STEPS + 1),
  }),
  z.strictObject({ type: z.literal("checkpoint"), checkpoint: SimulationCheckpointSchema }),
  z.strictObject({
    type: z.literal("command_log"),
    commandLog: z.array(LoggedCommandSchema).max(MAX_LOGGED_COMMANDS),
    // The session origin travels with the log: scenario persistence needs both.
    initialState: WorldSnapshotSchema,
  }),
  z.strictObject({
    type: z.literal("world_changed"),
    bodies: z.array(z.unknown()).max(MAX_SCENARIO_BODIES),
    removedIds: z.array(z.string()).max(MAX_SCENARIO_BODIES),
    reason: z.string(),
  }),
  z.strictObject({
    type: z.literal("performance_status"),
    stats: z.strictObject({
      dtSeconds: z.number().positive(),
      timeMultiplier: z.number().min(0),
      requestedRateDaysPerSec: z.number(),
      achievedRateDaysPerSec: z.number(),
      isComputeLimited: z.boolean(),
      quality: z.enum(["fast", "standard", "high"]),
      state: PlaybackStateSchema,
      isPaused: z.boolean(),
      currentTick: z.number().int(),
      simTimeSeconds: z.number(),
    }),
  }),
  z.strictObject({ type: z.literal("playback_state"), state: PlaybackStateSchema }),
  z.strictObject({ type: z.literal("error"), error: z.string(), code: z.string().optional() }),
  z.strictObject({
    type: z.literal("simulation_halted"),
    reason: z.string(),
    lastGoodTick: z.number().int().min(0),
    lastGoodSnapshot: WorldSnapshotSchema.nullable(),
  }),
]);

export type ValidatedWorkerOutboundMessage = z.infer<typeof WorkerOutboundMessageSchema>;

/** Validates an outbound message, rejecting malformed internal output loudly. */
export function validateOutboundMessage(msg: unknown): { ok: true } | { ok: false; error: string } {
  if (msg && typeof msg === "object" && (msg as { type?: unknown }).type === "snapshot") {
    // Snapshot payloads contain non-JSON typed arrays; structural checks only.
    const data = (msg as { data?: Record<string, unknown> }).data;
    if (!data || typeof data !== "object") return { ok: false, error: "Snapshot payload missing" };
    if (!(data.positions instanceof Float64Array)) {
      return { ok: false, error: "Snapshot positions must be a Float64Array" };
    }
    if (typeof data.tick !== "number" || !Number.isFinite(data.simTimeSeconds as number)) {
      return { ok: false, error: "Snapshot clock fields must be finite numbers" };
    }
    return { ok: true };
  }

  const result = WorkerOutboundMessageSchema.safeParse(msg);
  if (!result.success) {
    return { ok: false, error: result.error.issues[0]?.message ?? "Invalid outbound message" };
  }
  return { ok: true };
}
