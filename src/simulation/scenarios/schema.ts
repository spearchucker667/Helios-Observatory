import { z } from "zod";
import type { SimulationBody } from "../domain/types.ts";

const Vector3Schema = z.tuple([
  z.number().refine(Number.isFinite, "Must be finite"),
  z.number().refine(Number.isFinite, "Must be finite"),
  z.number().refine(Number.isFinite, "Must be finite"),
]);

export const SimulationFieldProvenanceSchema = z.object({
  kind: z.enum(["canonical", "calculated", "estimated", "custom", "unsupported"]),
  sourceIds: z.array(z.string()).optional(),
  method: z.string().optional(),
  engineVersion: z.string().optional(),
  inputPaths: z.array(z.string()).optional(),
  note: z.string().optional(),
});

export const SimulationBodySchema: z.ZodType<SimulationBody> = z.object({
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(100),
  classification: z.enum([
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
  ]),
  gravityRole: z.enum(["massive", "tracer"]),
  mass: z.number().min(0).refine(Number.isFinite, "Mass must be finite"),
  radius: z.number().min(0).refine(Number.isFinite, "Radius must be finite"),
  density: z.number().positive().optional(),
  position: Vector3Schema,
  velocity: Vector3Schema,
  rotation: z
    .object({
      periodSeconds: z.number().positive().optional(),
      axialTiltDeg: z.number().optional(),
      angleRad: z.number().optional(),
    })
    .optional(),
  thermal: z
    .object({
      surfaceTempK: z.number().min(0).optional(),
      equilibriumTempK: z.number().min(0).optional(),
      albedo: z.number().min(0).max(1).optional(),
      emissivity: z.number().min(0).max(1).optional(),
      greenhouseEffectK: z.number().optional(),
    })
    .optional(),
  radiative: z
    .object({
      luminosityWatts: z.number().min(0).optional(),
    })
    .optional(),
  compact: z
    .object({
      schwarzschildRadiusM: z.number().min(0).optional(),
      magneticFieldTesla: z.number().min(0).optional(),
      beamConeAngleDeg: z.number().optional(),
      magneticAxisTiltDeg: z.number().optional(),
      spinPeriodSeconds: z.number().positive().optional(),
    })
    .optional(),
  physicsCapabilityFlags: z
    .object({
      hasAtmosphere: z.boolean().optional(),
      isLuminous: z.boolean().optional(),
      isRelativistic: z.boolean().optional(),
      isTidallyLocked: z.boolean().optional(),
    })
    .optional(),
  parentBodyId: z.string().optional(),
  color: z.string().optional(),
  provenance: z.object({
    mass: SimulationFieldProvenanceSchema,
    radius: SimulationFieldProvenanceSchema,
    state: SimulationFieldProvenanceSchema,
    density: SimulationFieldProvenanceSchema.optional(),
    thermal: SimulationFieldProvenanceSchema.optional(),
    radiative: SimulationFieldProvenanceSchema.optional(),
    compact: SimulationFieldProvenanceSchema.optional(),
  }).catchall(SimulationFieldProvenanceSchema) as any,
});

export const SystemInvariantsSchema = z.object({
  totalMassKg: z.number(),
  kineticEnergyJ: z.number(),
  potentialEnergyJ: z.number(),
  totalMechanicalEnergyJ: z.number(),
  linearMomentumKgMs: Vector3Schema,
  angularMomentumKgM2s: Vector3Schema,
  centerOfMassM: Vector3Schema,
  centerOfMassVelocityMs: Vector3Schema,
});

export const WorldSnapshotSchema = z.object({
  engineVersion: z.string(),
  schemaVersion: z.number().int().min(1),
  simTimeSeconds: z.number().refine(Number.isFinite),
  tick: z.number().int().min(0),
  dtSeconds: z.number().positive().refine(Number.isFinite),
  bodies: z
    .array(SimulationBodySchema)
    .max(1024, "Maximum 1024 bodies supported")
    .refine(
      (bodies) => bodies.filter((b) => b.gravityRole === "massive").length <= 256,
      "Maximum 256 massive bodies supported"
    ),
  invariants: SystemInvariantsSchema,
});

export const SimulationCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("add_body"), body: SimulationBodySchema }),
  z.object({ type: z.literal("update_body"), id: z.string(), updates: z.record(z.string(), z.any()) }),
  z.object({ type: z.literal("delete_body"), id: z.string() }),
  z.object({ type: z.literal("duplicate_body"), id: z.string(), newId: z.string(), offsetM: Vector3Schema.optional() }),
  z.object({ type: z.literal("set_position"), id: z.string(), position: Vector3Schema }),
  z.object({ type: z.literal("set_velocity"), id: z.string(), velocity: Vector3Schema }),
  z.object({ type: z.literal("apply_impulse"), id: z.string(), impulseMs: Vector3Schema }),
  z.object({ type: z.literal("set_mass"), id: z.string(), massKg: z.number().positive() }),
  z.object({ type: z.literal("set_radius"), id: z.string(), radiusM: z.number().positive() }),
  z.object({ type: z.literal("set_time_multiplier"), multiplier: z.number().positive() }),
  z.object({ type: z.literal("set_dt"), dtSeconds: z.number().positive() }),
  z.object({ type: z.literal("set_relativity"), enabled: z.boolean() }),
  z.object({ type: z.literal("pause") }),
  z.object({ type: z.literal("resume") }),
  z.object({ type: z.literal("reset_to_initial") }),
]);

export const LoggedCommandSchema = z.object({
  tick: z.number().int().min(0),
  simTimeSeconds: z.number(),
  command: SimulationCommandSchema,
});

export const ScenarioEnvelopeSchema = z.object({
  format: z.literal("helios-scenario"),
  schemaVersion: z.number().int().min(1),
});

export const ScenarioDocumentSchema = z
  .object({
    format: z.literal("helios-scenario"),
    schemaVersion: z.literal(1),
    engineVersion: z.string(),
    id: z.string().min(1),
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    seed: z.number().optional(),
    initialState: WorldSnapshotSchema,
    commands: z.array(LoggedCommandSchema),
    checkpoint: WorldSnapshotSchema.optional(),
  })
  .superRefine((doc, ctx) => {
    // Check for duplicate body IDs in initialState
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
  });

export type ScenarioDocument = z.infer<typeof ScenarioDocumentSchema>;
