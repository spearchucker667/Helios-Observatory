import { z } from "zod";
import type { SimulationBody } from "../domain/types.ts";

/** Bounds for untrusted persisted payloads. */
export const MAX_SCENARIO_COMMANDS = 20000;
export const MAX_SCENARIO_BODIES = 1024;
export const MAX_SCENARIO_MASSIVE_BODIES = 256;
export const MAX_SCENARIO_NAME_LENGTH = 100;
export const MAX_SCENARIO_DESCRIPTION_LENGTH = 500;
export const MAX_PROVENANCE_SOURCE_IDS = 32;
export const MAX_PROVENANCE_STRING_LENGTH = 240;

const finiteNumber = z.number().refine(Number.isFinite, "Must be finite");

const BoundedString = (max: number) => z.string().max(max);

const Vector3Schema = z.tuple([finiteNumber, finiteNumber, finiteNumber]);

export const SimulationFieldProvenanceSchema = z.strictObject({
  kind: z.enum(["canonical", "calculated", "estimated", "custom", "unsupported"]),
  sourceIds: z.array(BoundedString(MAX_PROVENANCE_STRING_LENGTH)).max(MAX_PROVENANCE_SOURCE_IDS).optional(),
  method: BoundedString(MAX_PROVENANCE_STRING_LENGTH).optional(),
  engineVersion: BoundedString(64).optional(),
  inputPaths: z.array(BoundedString(MAX_PROVENANCE_STRING_LENGTH)).max(MAX_PROVENANCE_SOURCE_IDS).optional(),
  note: BoundedString(MAX_PROVENANCE_STRING_LENGTH).optional(),
});

export const ClassificationSchema = z.enum([
  "star",
  "planet",
  "dwarf-planet",
  "moon",
  "asteroid",
  "comet",
  "artificial",
  "white-dwarf",
  "neutron-star",
  "pulsar",
  "magnetar",
  "black-hole",
]);

export const GravityRoleSchema = z.enum(["massive", "tracer"]);

export const RotationSchema = z.strictObject({
  periodSeconds: z.number().positive().optional(),
  axialTiltDeg: finiteNumber.optional(),
  angleRad: finiteNumber.optional(),
});

export const ThermalSchema = z.strictObject({
  surfaceTempK: z.number().min(0).optional(),
  equilibriumTempK: z.number().min(0).optional(),
  albedo: z.number().min(0).max(1).optional(),
  emissivity: z.number().gt(0).max(1).optional(),
  greenhouseEffectK: finiteNumber.optional(),
});

export const RadiativeSchema = z.strictObject({
  luminosityWatts: z.number().min(0).optional(),
});

export const CompactSchema = z.strictObject({
  schwarzschildRadiusM: z.number().min(0).optional(),
  magneticFieldTesla: z.number().min(0).optional(),
  beamConeAngleDeg: finiteNumber.optional(),
  magneticAxisTiltDeg: finiteNumber.optional(),
  spinPeriodSeconds: z.number().positive().optional(),
});

export const PhysicsCapabilityFlagsSchema = z.strictObject({
  hasAtmosphere: z.boolean().optional(),
  isLuminous: z.boolean().optional(),
  isRelativistic: z.boolean().optional(),
  isTidallyLocked: z.boolean().optional(),
});

export const SimulationBodySchema: z.ZodType<SimulationBody> = z.strictObject({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(MAX_SCENARIO_NAME_LENGTH),
  classification: ClassificationSchema,
  gravityRole: GravityRoleSchema,
  mass: z.number().min(0).refine(Number.isFinite, "Mass must be finite"),
  radius: z.number().min(0).refine(Number.isFinite, "Radius must be finite"),
  density: z.number().positive().optional(),
  position: Vector3Schema,
  velocity: Vector3Schema,
  rotation: RotationSchema.optional(),
  thermal: ThermalSchema.optional(),
  radiative: RadiativeSchema.optional(),
  compact: CompactSchema.optional(),
  physicsCapabilityFlags: PhysicsCapabilityFlagsSchema.optional(),
  parentBodyId: z.string().max(64).optional(),
  color: z.string().max(32).optional(),
  provenance: z.strictObject({
    mass: SimulationFieldProvenanceSchema,
    radius: SimulationFieldProvenanceSchema,
    state: SimulationFieldProvenanceSchema,
    density: SimulationFieldProvenanceSchema.optional(),
    thermal: SimulationFieldProvenanceSchema.optional(),
    radiative: SimulationFieldProvenanceSchema.optional(),
    compact: SimulationFieldProvenanceSchema.optional(),
  }) as unknown as z.ZodType<SimulationBody["provenance"]>,
});

export const SystemInvariantsSchema = z.strictObject({
  totalMassKg: finiteNumber,
  kineticEnergyJ: finiteNumber,
  potentialEnergyJ: finiteNumber,
  totalMechanicalEnergyJ: finiteNumber,
  linearMomentumKgMs: Vector3Schema,
  angularMomentumKgM2s: Vector3Schema,
  centerOfMassM: Vector3Schema,
  centerOfMassVelocityMs: Vector3Schema,
});

export const BodiesArraySchema = z
  .array(SimulationBodySchema)
  .max(MAX_SCENARIO_BODIES, `Maximum ${MAX_SCENARIO_BODIES} bodies supported`)
  .refine(
    (bodies) => bodies.filter((b) => b.gravityRole === "massive").length <= MAX_SCENARIO_MASSIVE_BODIES,
    `Maximum ${MAX_SCENARIO_MASSIVE_BODIES} massive bodies supported`
  );

export const WorldSnapshotSchema = z.strictObject({
  engineVersion: z.string().max(64),
  schemaVersion: z.number().int().min(1),
  simTimeSeconds: finiteNumber,
  tick: z.number().int().min(0),
  dtSeconds: z.number().positive().refine(Number.isFinite),
  bodies: BodiesArraySchema,
  invariants: SystemInvariantsSchema,
});

export const SimulationCommandSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("add_body"), body: SimulationBodySchema }),
  z.strictObject({ type: z.literal("delete_body"), id: z.string().min(1).max(64) }),
  z.strictObject({
    type: z.literal("duplicate_body"),
    id: z.string().min(1).max(64),
    newId: z.string().min(1).max(64),
    offsetM: Vector3Schema.optional(),
  }),
  z.strictObject({ type: z.literal("set_name"), id: z.string().min(1).max(64), name: z.string().min(1).max(MAX_SCENARIO_NAME_LENGTH) }),
  z.strictObject({
    type: z.literal("set_classification"),
    id: z.string().min(1).max(64),
    classification: ClassificationSchema,
  }),
  z.strictObject({
    type: z.literal("set_gravity_role"),
    id: z.string().min(1).max(64),
    gravityRole: GravityRoleSchema,
  }),
  z.strictObject({ type: z.literal("set_color"), id: z.string().min(1).max(64), color: z.string().max(32).optional() }),
  z.strictObject({ type: z.literal("set_mass"), id: z.string().min(1).max(64), massKg: z.number().positive().refine(Number.isFinite) }),
  z.strictObject({ type: z.literal("set_radius"), id: z.string().min(1).max(64), radiusM: z.number().positive().refine(Number.isFinite) }),
  z.strictObject({ type: z.literal("set_position"), id: z.string().min(1).max(64), position: Vector3Schema }),
  z.strictObject({ type: z.literal("set_velocity"), id: z.string().min(1).max(64), velocity: Vector3Schema }),
  z.strictObject({
    type: z.literal("set_rotation"),
    id: z.string().min(1).max(64),
    rotation: RotationSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("set_thermal"),
    id: z.string().min(1).max(64),
    thermal: ThermalSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("set_radiative"),
    id: z.string().min(1).max(64),
    radiative: RadiativeSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("set_compact_properties"),
    id: z.string().min(1).max(64),
    compact: CompactSchema.optional(),
  }),
  z.strictObject({
    type: z.literal("set_parent_body"),
    id: z.string().min(1).max(64),
    parentBodyId: z.string().max(64).optional(),
  }),
  z.strictObject({ type: z.literal("apply_impulse"), id: z.string().min(1).max(64), impulseMs: Vector3Schema }),
  z.strictObject({ type: z.literal("set_time_multiplier"), multiplier: z.number().min(0).refine(Number.isFinite) }),
  z.strictObject({ type: z.literal("set_dt"), dtSeconds: z.number().positive().refine(Number.isFinite) }),
  z.strictObject({ type: z.literal("set_relativity"), enabled: z.boolean() }),
  z.strictObject({ type: z.literal("reset_to_initial") }),
]);

export const LoggedCommandSchema = z.strictObject({
  tick: z.number().int().min(0),
  simTimeSeconds: finiteNumber,
  command: SimulationCommandSchema,
});

export const MAX_LOGGED_COMMANDS = MAX_SCENARIO_COMMANDS;
export const MAX_TRAJECTORY_STEPS = 2048;

export const PlaybackStateSchema = z.enum([
  "uninitialized",
  "paused",
  "running",
  "stepping",
  "halted",
  "replaying",
]);

export const SimulationConfigurationSchema = z.strictObject({
  quality: z.enum(["fast", "standard", "high"]),
  timeMultiplier: z.number().min(0).refine(Number.isFinite),
  enableRelativity: z.boolean(),
  playbackState: PlaybackStateSchema,
  forceModel: z.string().max(64),
  integrator: z.string().max(64),
  collisionModelVersion: z.string().max(64),
  rngState: finiteNumber.optional(),
});

export const SimulationCheckpointSchema = z.strictObject({
  engineVersion: z.string().max(64),
  schemaVersion: z.number().int().min(1),
  simTimeSeconds: finiteNumber,
  tick: z.number().int().min(0),
  dtSeconds: z.number().positive().refine(Number.isFinite),
  bodies: BodiesArraySchema,
  invariants: SystemInvariantsSchema,
  configuration: SimulationConfigurationSchema,
  commandLog: z.array(LoggedCommandSchema).max(MAX_SCENARIO_COMMANDS),
});

export const FinalStateSchema = z.strictObject({
  tick: z.number().int().min(0),
  simTimeSeconds: finiteNumber,
});

/**
 * Pre-migration envelope sniff. Deliberately permissive: it only identifies the
 * document family/version so the correct migration can run. All strictness is
 * applied afterwards by ScenarioDocumentSchema.
 */
export const ScenarioEnvelopeSchema = z.looseObject({
  format: z.literal("helios-scenario"),
  schemaVersion: z.number().int().min(1),
});

export const SCENARIO_SCHEMA_VERSION = 2;

export const ScenarioDocumentSchema = z
  .strictObject({
    format: z.literal("helios-scenario"),
    schemaVersion: z.literal(SCENARIO_SCHEMA_VERSION),
    engineVersion: z.string().max(64),
    id: z.string().min(1).max(64),
    name: z.string().min(1).max(MAX_SCENARIO_NAME_LENGTH),
    description: z.string().max(MAX_SCENARIO_DESCRIPTION_LENGTH).optional(),
    createdAt: z.string().max(64),
    updatedAt: z.string().max(64),
    initialState: WorldSnapshotSchema,
    commands: z.array(LoggedCommandSchema).max(MAX_SCENARIO_COMMANDS, `Maximum ${MAX_SCENARIO_COMMANDS} commands supported`),
    finalState: FinalStateSchema,
    checkpoint: SimulationCheckpointSchema.optional(),
  })
  .superRefine((doc, ctx) => {
    // Initial-state IDs must be unique.
    const ids = new Set<string>();
    for (let i = 0; i < doc.initialState.bodies.length; i++) {
      const id = doc.initialState.bodies[i].id;
      if (ids.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate body ID "${id}" detected in scenario initial state`,
          path: ["initialState", "bodies", i, "id"],
        });
      }
      ids.add(id);
    }

    // Command chronology must be monotonic and its introduced IDs unique.
    let lastTick = doc.initialState.tick;
    let lastTime = doc.initialState.simTimeSeconds;
    const commandIds = new Set<string>();
    for (let i = 0; i < doc.commands.length; i++) {
      const entry = doc.commands[i];
      if (entry.tick < lastTick) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Command at index ${i} moves backwards in tick (${entry.tick} < ${lastTick})`,
          path: ["commands", i, "tick"],
        });
      }
      if (entry.tick === lastTick && entry.simTimeSeconds < lastTime - 1e-6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Command at index ${i} moves backwards in simulated time`,
          path: ["commands", i, "simTimeSeconds"],
        });
      }
      lastTick = entry.tick;
      lastTime = entry.simTimeSeconds;

      const cmd = entry.command;
      if (cmd.type === "add_body") {
        if (ids.has(cmd.body.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Command log introduces duplicate body ID "${cmd.body.id}"`,
            path: ["commands", i, "command", "body", "id"],
          });
        }
        ids.add(cmd.body.id);
        commandIds.add(cmd.body.id);
      } else if (cmd.type === "duplicate_body") {
        if (ids.has(cmd.newId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Command log duplicates an existing body ID "${cmd.newId}"`,
            path: ["commands", i, "command", "newId"],
          });
        }
        ids.add(cmd.newId);
        commandIds.add(cmd.newId);
      }
    }

    if (doc.finalState.tick < doc.initialState.tick) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "finalState.tick must not precede the initial tick",
        path: ["finalState", "tick"],
      });
    }

    if (doc.checkpoint && doc.checkpoint.tick !== doc.finalState.tick) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "checkpoint.tick must equal finalState.tick",
        path: ["checkpoint", "tick"],
      });
    }
  });

export type ScenarioDocument = z.infer<typeof ScenarioDocumentSchema>;
