import { z } from "zod";
import { BODIES, MOONS, EVENTS, MISSIONS, SOURCES } from "./registry.ts";

/**
 * Runtime validation of the static data layer. Data lives in TypeScript, so
 * compile-time types already guard the shape; these schemas guard the
 * *invariants* types cannot express: unique ids, resolvable references,
 * positive physical quantities, and source citations that exist.
 */

const bodyIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/, "body ids must be kebab-case");

const physicalSchema = z
  .object({
    meanRadiusKm: z.number().positive(),
    diameterKm: z.number().positive(),
    massKg24: z.number().positive().optional(),
    massEarths: z.number().positive().optional(),
    gravityG: z.number().positive(),
    escapeVelocityKmS: z.number().positive(),
    densityGCm3: z.number().positive(),
  })
  .strict();

const orbitSchema = z
  .object({
    semiMajorAxisAu: z.number().positive().optional(),
    semiMajorAxisKm: z.number().positive().optional(),
    periodDays: z.number().positive(),
    inclinationDeg: z.number(),
    eccentricity: z.number().min(0).max(1).optional(),
    orbitalSpeedKmS: z.number().positive().optional(),
    retrograde: z.boolean().optional(),
    tidallyLocked: z.boolean().optional(),
  })
  .strict();

const bodySchema = z.object({
  identity: z.object({
    id: bodyIdSchema,
    name: z.string().min(1),
    epithet: z.string().min(1),
    kind: z.enum(["star", "planet", "dwarf-planet", "moon"]),
    category: z.string().min(1),
    parentId: bodyIdSchema.optional(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    discovery: z.any().optional(),
  }),
  physical: physicalSchema,
  orbit: orbitSchema.optional(),
  rotation: z.object({
    periodHours: z.number().refine((v) => v !== 0, "rotation period cannot be zero"),
    axialTiltDeg: z.number().min(0).max(180),
  }),
  temperature: z.object({
    meanC: z.number(),
    noteC: z.any().optional(),
  }),
  sources: z.array(z.object({ id: z.string() })).min(1),
  retrieved: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rings: z.any().optional(),
  moonSystem: z.any().optional(),
  features: z.array(z.any()).optional(),
  atmosphere: z.any().optional(),
  interior: z.string().optional(),
  magneticField: z.string().optional(),
  blurb: z.string().min(1),
  notes: z.any().optional(),
});

const eventSchema = z.object({
  id: z.string().min(1),
  bodyIds: z.array(bodyIdSchema).min(1),
  date: z.string().optional(),
  year: z.number().int(),
  title: z.string().min(1),
  category: z.enum([
    "discovery",
    "observation",
    "mission",
    "impact",
    "atmospheric",
    "geological",
    "orbital",
    "milestone",
  ]),
  summary: z.string().min(1),
  significance: z.string().min(1),
  mission: z.string().optional(),
  sourceIds: z.array(z.string()).min(1),
});

export type DataIssue = { kind: "error" | "warning"; message: string };

/** Validate the whole dataset. Returns a list of issues (empty = clean). */
export function validateData(): DataIssue[] {
  const issues: DataIssue[] = [];
  const allBodies = [...BODIES, ...MOONS];
  const ids = new Set<string>();

  // Unique ids.
  for (const b of allBodies) {
    const id = b.identity.id;
    if (ids.has(id)) issues.push({ kind: "error", message: `duplicate body id: ${id}` });
    ids.add(id);
  }

  // Physical + orbital invariants and parent references.
  for (const b of allBodies) {
    const parsed = bodySchema.safeParse(b);
    if (!parsed.success) {
      issues.push({ kind: "error", message: `body ${b.identity.id}: ${parsed.error.issues[0]?.message}` });
      continue;
    }
    if (Math.abs(b.physical.diameterKm - b.physical.meanRadiusKm * 2) > b.physical.diameterKm * 0.02) {
      issues.push({
        kind: "warning",
        message: `body ${b.identity.id}: diameter/radius inconsistent beyond 2%`,
      });
    }
    if (b.orbit) {
      const orbitParsed = orbitSchema.safeParse(b.orbit);
      if (!orbitParsed.success) {
        issues.push({ kind: "error", message: `body ${b.identity.id} orbit: ${orbitParsed.error.issues[0]?.message}` });
      }
      if (!b.orbit.semiMajorAxisAu && !b.orbit.semiMajorAxisKm && b.identity.kind !== "moon") {
        issues.push({ kind: "error", message: `body ${b.identity.id}: planets need semiMajorAxisAu` });
      }
    }
    const parentId = b.identity.parentId;
    if (parentId) {
      if (!ids.has(parentId) && parentId !== "sun") {
        issues.push({ kind: "error", message: `body ${b.identity.id}: unknown parent ${parentId}` });
      }
      if (b.identity.kind === "moon" && !MOONS.some((m) => m.identity.id === b.identity.id)) {
        issues.push({ kind: "error", message: `body ${b.identity.id}: moon missing from MOONS` });
      }
      if (b.identity.kind !== "moon" && parentId !== "sun") {
        issues.push({ kind: "error", message: `body ${b.identity.id}: non-moon parent must be sun` });
      }
    }
    // Every cited source resolves.
    for (const s of b.sources) {
      if (!SOURCES[s.id]) {
        issues.push({ kind: "error", message: `body ${b.identity.id}: unknown source ${s.id}` });
      }
    }
  }

  // Moons must reference a planet, not another moon or the sun.
  for (const m of MOONS) {
    const parent = allBodies.find((b) => b.identity.id === m.identity.parentId);
    if (!parent) {
      issues.push({ kind: "error", message: `moon ${m.identity.id}: missing parent` });
    } else if (parent.identity.kind !== "planet") {
      issues.push({ kind: "error", message: `moon ${m.identity.id}: parent is not a planet` });
    }
  }

  // Planets reference the sun as parent.
  for (const p of BODIES.filter((b) => b.identity.kind === "planet")) {
    if (p.identity.parentId !== "sun") {
      issues.push({ kind: "error", message: `planet ${p.identity.id}: parent must be "sun"` });
    }
  }

  // Events: unique, resolvable bodies, resolvable sources.
  const eventIds = new Set<string>();
  for (const e of EVENTS) {
    const parsed = eventSchema.safeParse(e);
    if (!parsed.success) {
      issues.push({ kind: "error", message: `event ${e.id}: ${parsed.error.issues[0]?.message}` });
    }
    if (eventIds.has(e.id)) {
      issues.push({ kind: "error", message: `duplicate event id: ${e.id}` });
    }
    eventIds.add(e.id);
    for (const id of e.bodyIds) {
      if (!ids.has(id)) issues.push({ kind: "error", message: `event ${e.id}: unknown body ${id}` });
    }
    for (const sid of e.sourceIds) {
      if (!SOURCES[sid]) issues.push({ kind: "error", message: `event ${e.id}: unknown source ${sid}` });
    }
  }

  // Missions: resolvable bodies and sources.
  for (const m of MISSIONS) {
    for (const id of m.bodyIds) {
      if (!ids.has(id)) issues.push({ kind: "error", message: `mission ${m.id}: unknown body ${id}` });
    }
    for (const sid of m.sourceIds) {
      if (!SOURCES[sid]) issues.push({ kind: "error", message: `mission ${m.id}: unknown source ${sid}` });
    }
  }

  return issues;
}
