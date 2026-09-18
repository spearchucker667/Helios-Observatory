import { test } from "node:test";
import assert from "node:assert/strict";
import { SimulationWorld } from "../engine/world.ts";
import { PRESETS } from "../domain/presets.ts";
import { MAX_FULL_GRAVITY_BODIES, MAX_TOTAL_SIMULATION_BODIES } from "../physics/gravity.ts";
import { calculateSchwarzschildRadius } from "../engine/compact-objects.ts";
import { SOLAR_MASS_KG } from "../domain/constants.ts";
import type { SimulationBody } from "../domain/types.ts";

function tracer(id: string, radiusFromOrigin = 1e12): SimulationBody {
  const preset = PRESETS.find((p) => p.id === "preset-asteroid")!;
  return preset.createBody({
    id,
    position: [radiusFromOrigin, 0, 0],
    velocity: [0, 100, 0],
  }) as SimulationBody;
}

function massiveBody(id: string, orbitRadius = 1e12): SimulationBody {
  const preset = PRESETS.find((p) => p.id === "preset-earth-like")!;
  return preset.createBody({ id, position: [orbitRadius, 0, 0], velocity: [0, 100, 0] });
}

test("add_body rejects a duplicate ID instead of replacing a body", () => {
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [massiveBody("a")] });
  const originalMass = world.getBody("a")!.mass;

  const replacement = { ...massiveBody("a"), mass: 1e30 };
  assert.equal(world.executeCommand({ type: "add_body", body: replacement }), false);
  assert.equal(world.bodiesList.length, 1);
  assert.equal(world.getBody("a")!.mass, originalMass, "existing body must not be overwritten");
  assert.equal(world.getCommandLog().length, 0, "rejected commands are never logged");
});

test("duplicate_body rejects an existing target ID and accepts a fresh one", () => {
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [massiveBody("a")] });

  assert.equal(world.executeCommand({ type: "duplicate_body", id: "a", newId: "a" }), false);
  assert.equal(world.executeCommand({ type: "duplicate_body", id: "missing", newId: "b" }), false);
  assert.equal(world.bodiesList.length, 1);

  assert.equal(world.executeCommand({ type: "duplicate_body", id: "a", newId: "b" }), true);
  assert.equal(world.bodiesList.length, 2);
  assert.ok(world.getBody("b"));
});

test("the total body cap cannot be exceeded through any command path", () => {
  const bodies: SimulationBody[] = [];
  for (let i = 0; i < MAX_TOTAL_SIMULATION_BODIES; i++) {
    bodies.push(tracer(`t-${i}`, 1e12 + i * 1e6));
  }
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: bodies });
  assert.equal(world.bodiesList.length, MAX_TOTAL_SIMULATION_BODIES);

  assert.equal(world.executeCommand({ type: "add_body", body: tracer("overflow") }), false);
  assert.equal(world.executeCommand({ type: "duplicate_body", id: "t-0", newId: "dup" }), false);
  assert.equal(world.bodiesList.length, MAX_TOTAL_SIMULATION_BODIES);

  // The constructor refuses an over-capacity initial state as well.
  assert.throws(
    () => new SimulationWorld({ dtSeconds: 900, initialBodies: [...bodies, tracer("extra")] }),
    /exceeds the 1024 limit/
  );
});

test("the full-gravity cap is enforced on add_body, set_mass and set_gravity_role", () => {
  const massiveBodies: SimulationBody[] = [];
  for (let i = 0; i < MAX_FULL_GRAVITY_BODIES; i++) {
    massiveBodies.push(massiveBody(`m-${i}`, 1e12 + i * 1e9));
  }
  const extraTracer = tracer("extra");
  const world = new SimulationWorld({
    dtSeconds: 900,
    initialBodies: [...massiveBodies, extraTracer],
  });

  assert.equal(world.countMassive(), MAX_FULL_GRAVITY_BODIES);

  // add_body: over the cap the body is admitted as a tracer, and the demotion
  // is reported rather than silently applied.
  const warnings: string[] = [];
  world.eventBus.subscribe((e) => {
    if (e.eventType === "accuracy_warning") warnings.push(e.summary);
  });
  assert.equal(world.executeCommand({ type: "add_body", body: massiveBody("late") }), true);
  assert.equal(world.getBody("late")!.gravityRole, "tracer", "late massive body must be demoted");
  assert.ok(warnings.some((w) => w.includes("Full-gravity body cap")));

  // set_mass on a tracer would promote it; that must be rejected at the cap.
  const tracerMassBefore = world.getBody("extra")!.mass;
  assert.equal(world.executeCommand({ type: "set_mass", id: "extra", massKg: 1e24 }), false);
  assert.equal(
    world.getBody("extra")!.mass,
    tracerMassBefore,
    "rejected set_mass must not mutate the body"
  );

  // set_gravity_role must respect the same invariant.
  assert.equal(world.executeCommand({ type: "set_gravity_role", id: "extra", gravityRole: "massive" }), false);
  assert.equal(world.getBody("extra")!.gravityRole, "tracer");

  // Below the cap promotion works.
  world.executeCommand({ type: "delete_body", id: "m-0" });
  assert.equal(world.executeCommand({ type: "set_mass", id: "extra", massKg: 1e24 }), true);
  assert.equal(world.getBody("extra")!.gravityRole, "massive");
});

test("every typed command updates exactly the provenance fields it invalidates", () => {
  const canonicalStar = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "sun" });
  const world = new SimulationWorld({
    dtSeconds: 900,
    initialBodies: [canonicalStar, massiveBody("probe")],
  });

  const before = world.getBody("probe")!;
  assert.notEqual(before.provenance.mass.kind, "canonical");

  world.executeCommand({ type: "set_mass", id: "probe", massKg: 1e26 });
  assert.equal(world.getBody("probe")!.provenance.mass.kind, "custom");
  assert.equal(world.getBody("probe")!.provenance.mass.method, "Direct mass edit");
  assert.equal(world.getBody("probe")!.provenance.radius.method, before.provenance.radius.method);

  world.executeCommand({ type: "set_radius", id: "probe", radiusM: 1e7 });
  assert.equal(world.getBody("probe")!.provenance.radius.method, "Direct radius edit");
  assert.equal(world.getBody("probe")!.provenance.density?.kind, "calculated");

  world.executeCommand({ type: "set_position", id: "probe", position: [1, 2, 3] });
  assert.equal(world.getBody("probe")!.provenance.state.method, "Direct position edit");

  world.executeCommand({ type: "apply_impulse", id: "probe", impulseMs: [0, 5, 0] });
  assert.equal(world.getBody("probe")!.provenance.state.method, "Applied velocity impulse");
  assert.equal(world.getBody("probe")!.velocity[1], 105);

  // Thermal edits with no emissivity are flagged estimated, not calculated.
  world.executeCommand({ type: "set_thermal", id: "probe", thermal: { albedo: 0.3 } });
  assert.equal(world.getBody("probe")!.provenance.thermal?.kind, "estimated");

  world.executeCommand({ type: "set_thermal", id: "probe", thermal: { albedo: 0.3, emissivity: 0.9 } });
  assert.equal(world.getBody("probe")!.provenance.thermal?.kind, "custom");
});

test("body IDs can never be rewritten and parents must exist", () => {
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [massiveBody("a"), massiveBody("b")] });

  world.executeCommand({ type: "set_name", id: "a", name: "Renamed" });
  world.executeCommand({ type: "set_parent_body", id: "a", parentBodyId: "b" });
  assert.equal(world.getBody("a")!.id, "a", "id is a Map key and must never change");
  assert.equal(world.getBody("a")!.parentBodyId, "b");

  assert.equal(world.executeCommand({ type: "set_parent_body", id: "a", parentBodyId: "a" }), false);
  assert.equal(world.executeCommand({ type: "set_parent_body", id: "a", parentBodyId: "ghost" }), false);
  assert.equal(world.getBody("a")!.parentBodyId, "b", "rejected parent changes must not apply");
});

test("reclassifying as a black hole derives the horizon radius from the mass", () => {
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [massiveBody("core")] });

  assert.equal(world.executeCommand({ type: "set_mass", id: "core", massKg: 10 * SOLAR_MASS_KG }), true);
  assert.equal(world.executeCommand({ type: "set_classification", id: "core", classification: "black-hole" }), true);

  const body = world.getBody("core")!;
  const rs = calculateSchwarzschildRadius(10 * SOLAR_MASS_KG);
  assert.ok(Math.abs(body.radius - rs) < 1e-9, `radius ${body.radius} != rs ${rs}`);
  assert.ok(Math.abs((body.compact?.schwarzschildRadiusM ?? 0) - rs) < 1e-9);
  assert.equal(body.provenance.radius.kind, "calculated");
  assert.equal(body.physicsCapabilityFlags?.isRelativistic, true);

  // Independent radius edits are refused for a Schwarzschild hole.
  assert.equal(world.executeCommand({ type: "set_radius", id: "core", radiusM: 1 }), false);
});

test("non-finite command payloads are rejected before touching the world", () => {
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [massiveBody("a")] });
  const before = world.getBody("a")!;

  const rejected = [
    { type: "set_mass", id: "a", massKg: Number.NaN } as const,
    { type: "set_radius", id: "a", radiusM: Number.POSITIVE_INFINITY } as const,
    { type: "set_position", id: "a", position: [0, Number.NaN, 0] as [number, number, number] } as const,
    { type: "set_velocity", id: "a", velocity: [0, 0, Number.NEGATIVE_INFINITY] as [number, number, number] } as const,
    { type: "apply_impulse", id: "a", impulseMs: [Number.NaN, 0, 0] as [number, number, number] } as const,
  ];

  for (const command of rejected) {
    assert.equal(world.executeCommand(command as never), false, `${command.type} must be rejected`);
  }

  assert.deepEqual(world.getBody("a")!.position, before.position);
  assert.deepEqual(world.getBody("a")!.velocity, before.velocity);
  assert.equal(world.getBody("a")!.mass, before.mass);
  assert.equal(world.getCommandLog().length, 0);
});

test("reset_to_initial restores the origin state and clears the command chronology", () => {
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [massiveBody("a")] });
  const initialBodies = world.getSnapshot().bodies;

  world.step();
  world.executeCommand({ type: "set_mass", id: "a", massKg: 1e26 });
  world.executeCommand({ type: "delete_body", id: "a" });
  assert.equal(world.bodiesList.length, 0);
  assert.equal(world.getCommandLog().length, 2);

  assert.equal(world.executeCommand({ type: "reset_to_initial" }), true);
  assert.equal(world.bodiesList.length, 1);
  assert.equal(world.tick, 0, "reset must return to the initial epoch");
  assert.equal(world.simTime, 0);
  assert.equal(
    world.getCommandLog().length,
    0,
    "a reset is a session boundary, not a replayable physics command"
  );
  assert.deepEqual(world.getSnapshot().bodies, initialBodies);
});

test("the constructor rejects invalid and duplicate initial bodies", () => {
  const bad = massiveBody("a");
  bad.position = [Number.NaN, 0, 0];
  assert.throws(() => new SimulationWorld({ dtSeconds: 900, initialBodies: [bad] }), /Invalid initial body/);

  const dupA = massiveBody("dup");
  const dupB = massiveBody("dup", 2e12);
  assert.throws(
    () => new SimulationWorld({ dtSeconds: 900, initialBodies: [dupA, dupB] }),
    /duplicate body id/
  );

  const zeroMassMassive = massiveBody("z");
  zeroMassMassive.mass = 0;
  assert.throws(() => new SimulationWorld({ dtSeconds: 900, initialBodies: [zeroMassMassive] }), /Invalid initial body/);
});
