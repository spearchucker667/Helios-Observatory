import {
  ScenarioEnvelopeSchema,
  ScenarioDocumentSchema,
  SimulationCommandSchema,
  SCENARIO_SCHEMA_VERSION,
  type ScenarioDocument,
} from "./schema.ts";
import type { LoggedCommand } from "../engine/commands.ts";

export const CURRENT_SCHEMA_VERSION = SCENARIO_SCHEMA_VERSION;

/**
 * Legacy v1 `update_body` payloads are expanded into narrow, provenance-aware
 * typed commands. Field order is fixed so migration is deterministic.
 */
const UPDATE_BODY_FIELD_COMMANDS: Array<[string, (id: string, value: unknown) => string]> = [
  ["name", () => "set_name"],
  ["classification", () => "set_classification"],
  ["gravityRole", () => "set_gravity_role"],
  ["mass", () => "set_mass"],
  ["radius", () => "set_radius"],
  ["position", () => "set_position"],
  ["velocity", () => "set_velocity"],
  ["rotation", () => "set_rotation"],
  ["thermal", () => "set_thermal"],
  ["radiative", () => "set_radiative"],
  ["compact", () => "set_compact_properties"],
  ["parentBodyId", () => "set_parent_body"],
  ["color", () => "set_color"],
];

/** Legacy payload key -> typed command field mapping. */
const FIELD_TO_COMMAND_KEY: Record<string, string> = {
  name: "name",
  classification: "classification",
  gravityRole: "gravityRole",
  mass: "massKg",
  radius: "radiusM",
  position: "position",
  velocity: "velocity",
  rotation: "rotation",
  thermal: "thermal",
  radiative: "radiative",
  compact: "compact",
  parentBodyId: "parentBodyId",
  color: "color",
};

function migrateV1Command(entry: any): LoggedCommand[] {
  const raw = entry?.command;
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid v1 scenario: command entry is not an object");
  }

  // Playback-only legacy commands carry no physics and are not replayable.
  if (raw.type === "pause" || raw.type === "resume") return [];

  if (raw.type !== "update_body") {
    const parsed = SimulationCommandSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Cannot migrate v1 command "${raw.type}": ${parsed.error.issues[0]?.message ?? "invalid payload"}`
      );
    }
    return [{ tick: entry.tick, simTimeSeconds: entry.simTimeSeconds, command: parsed.data as LoggedCommand["command"] }];
  }

  const id = typeof raw.id === "string" ? raw.id : null;
  if (!id) throw new Error("Cannot migrate v1 update_body command without a body id");
  const updates = raw.updates && typeof raw.updates === "object" ? raw.updates : {};

  const migrated: LoggedCommand[] = [];
  for (const [field, commandType] of UPDATE_BODY_FIELD_COMMANDS) {
    if (!(field in updates)) continue;
    const key = FIELD_TO_COMMAND_KEY[field];
    const candidate = { type: commandType(id, updates[field]), id, [key]: updates[field] };
    const parsed = SimulationCommandSchema.safeParse(candidate);
    if (!parsed.success) {
      throw new Error(
        `Cannot migrate v1 update_body field "${field}" for body "${id}": ${
          parsed.error.issues[0]?.message ?? "invalid value"
        }`
      );
    }
    migrated.push({
      tick: entry.tick,
      simTimeSeconds: entry.simTimeSeconds,
      command: parsed.data as LoggedCommand["command"],
    });
  }

  return migrated;
}

export function migrateScenario(raw: unknown): ScenarioDocument {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Invalid scenario document: root must be an object");
  }

  // 1. Minimal envelope parse
  const envelopeResult = ScenarioEnvelopeSchema.safeParse(raw);
  if (!envelopeResult.success) {
    throw new Error(`Invalid scenario envelope: ${envelopeResult.error.message}`);
  }

  const { format, schemaVersion } = envelopeResult.data;

  if (format !== "helios-scenario") {
    throw new Error(`Unsupported scenario format: ${format}`);
  }

  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported future scenario schema version: ${schemaVersion} (highest supported version is ${CURRENT_SCHEMA_VERSION})`
    );
  }

  let candidate: any = raw;

  if (schemaVersion < CURRENT_SCHEMA_VERSION) {
    candidate = migrateV1ToV2(raw);
  }

  // 2. Strict final validation
  const validationResult = ScenarioDocumentSchema.safeParse(candidate);
  if (!validationResult.success) {
    throw new Error(`Scenario schema validation failed: ${validationResult.error.message}`);
  }

  return validationResult.data as ScenarioDocument;
}

/**
 * v1 -> v2.
 *
 * v1 scenarios stored an editor-local command list whose tick/time were
 * synthesized from the UI edit history (tick = index, time = index * 900).
 * Those values are all we have for a legacy document, so they are preserved
 * verbatim and an explicit `finalState` is derived from the last recorded
 * command (or from the checkpoint when one exists). Legacy checkpoints that
 * lack execution configuration are dropped — they are redundant accelerators,
 * and `finalState` is authoritative.
 */
function migrateV1ToV2(raw: any): Record<string, unknown> {
  const commands: LoggedCommand[] = [];
  const rawCommands = Array.isArray(raw.commands) ? raw.commands : [];
  for (const entry of rawCommands) {
    for (const migrated of migrateV1Command(entry)) commands.push(migrated);
  }

  const initialState = raw.initialState;
  if (!initialState || typeof initialState !== "object") {
    throw new Error("Invalid v1 scenario: initialState is required");
  }

  const initialTick = typeof initialState.tick === "number" ? initialState.tick : 0;
  const initialTime = typeof initialState.simTimeSeconds === "number" ? initialState.simTimeSeconds : 0;

  const legacyCheckpoint = raw.checkpoint;
  const hasUsableCheckpoint =
    legacyCheckpoint &&
    typeof legacyCheckpoint === "object" &&
    typeof legacyCheckpoint.tick === "number" &&
    typeof legacyCheckpoint.simTimeSeconds === "number" &&
    legacyCheckpoint.configuration &&
    Array.isArray(legacyCheckpoint.commandLog);

  // The endpoint of a v1 session is best estimated from the LAST RAW entry of
  // the recorded list (which may be a playback-only command that is dropped
  // from the migrated chronology), falling back to the last physics command.
  const lastRaw = rawCommands[rawCommands.length - 1];
  const lastRawValid =
    lastRaw && typeof lastRaw.tick === "number" && typeof lastRaw.simTimeSeconds === "number";
  const lastCommand = commands[commands.length - 1];
  const finalState = hasUsableCheckpoint
    ? { tick: legacyCheckpoint.tick, simTimeSeconds: legacyCheckpoint.simTimeSeconds }
    : lastRawValid
      ? { tick: lastRaw.tick, simTimeSeconds: lastRaw.simTimeSeconds }
      : lastCommand
        ? { tick: lastCommand.tick, simTimeSeconds: lastCommand.simTimeSeconds }
        : { tick: initialTick, simTimeSeconds: initialTime };

  const migrated: Record<string, unknown> = {
    format: raw.format,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    engineVersion: typeof raw.engineVersion === "string" ? raw.engineVersion : "1.0.0",
    id: raw.id,
    name: raw.name,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    initialState,
    commands,
    finalState,
  };

  // `seed` was ceremonial determinism metadata with no effect on the physics
  // path; it is intentionally dropped rather than carried forward.
  if (typeof raw.description === "string") migrated.description = raw.description;
  if (hasUsableCheckpoint) migrated.checkpoint = legacyCheckpoint;

  return migrated;
}
