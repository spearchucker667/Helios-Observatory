import { test } from "node:test";
import assert from "node:assert/strict";
import { SimulationWorld } from "../engine/world.ts";
import {
  IMPLEMENTED_EVENT_TYPES,
  RESERVED_EVENT_TYPES,
  type SimulationEventType,
} from "../engine/events.ts";
import { PRESETS } from "../domain/presets.ts";
import { AU_M } from "../domain/constants.ts";
import type { SimulationBody } from "../domain/types.ts";

function pair(idA: string, idB: string): SimulationBody[] {
  const preset = PRESETS.find((p) => p.id === "preset-earth-like")!;
  return [
    preset.createBody({ id: idA, position: [0, 0, 0], velocity: [0, 0, 0] }),
    preset.createBody({ id: idB, position: [1e9, 0, 0], velocity: [0, 0, 0] }),
  ];
}

test("close encounters are detected on the transition into the threshold", () => {
  const a = pair("a", "b")[0];
  const b = pair("a", "b")[1];
  // Separation below 10 contact radii with a > 1 km/s relative speed.
  b.position = [1e8, 0, 0];
  b.velocity = [0, 5000, 0];
  a.velocity = [0, -5000, 0];

  const world = new SimulationWorld({ dtSeconds: 1, initialBodies: [a, b] });
  const types: SimulationEventType[] = [];
  world.eventBus.subscribe((e) => types.push(e.eventType));

  world.step();
  assert.ok(types.includes("close_encounter"), `expected a close encounter, got ${JSON.stringify(types)}`);

  // The detector is edge-triggered: staying near must not re-emit.
  const before = types.filter((t) => t === "close_encounter").length;
  world.step();
  const after = types.filter((t) => t === "close_encounter").length;
  assert.equal(after, before, "close encounters must not re-fire every step");
});

test("escape and ejection are reported for an unbound body", () => {
  const star = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "sun" });
  const runaway = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({
    id: "runaway",
    position: [101 * AU_M, 0, 0],
    velocity: [0, 60000, 0], // above solar escape speed at this radius
  });

  const world = new SimulationWorld({ dtSeconds: 3600, initialBodies: [star, runaway] });
  const events: Array<{ type: SimulationEventType; summary: string }> = [];
  world.eventBus.subscribe((e) => events.push({ type: e.eventType, summary: e.summary }));

  world.step();

  const escaped = events.find((e) => e.type === "escape");
  const ejected = events.find((e) => e.type === "ejection");
  assert.ok(escaped, `expected an escape event, got ${JSON.stringify(events.map((e) => e.type))}`);
  assert.ok(ejected, "an unbound body beyond 100 AU must be reported as ejected");
  assert.match(escaped!.summary, /unbound/);
  assert.match(ejected!.summary, /ejected/);
});

test("an accuracy warning fires when the timestep under-resolves the shortest dynamical time", () => {
  const preset = PRESETS.find((p) => p.id === "preset-earth-like")!;
  const a = preset.createBody({ id: "a", position: [0, 0, 0], velocity: [0, 0, 0] });
  // 5e7 m apart: no physical contact (contact is ~1.27e7 m), but the closest
  // massive-pair dynamical time is ~1.2e4 s, well below 100x the 900 s step.
  const b = preset.createBody({ id: "b", position: [5e7, 0, 0], velocity: [0, 0, 0] });

  // dt = 900 s is far larger than 1% of t_dyn for this configuration.
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [a, b] });
  const events: Array<{ type: SimulationEventType; quantities?: Record<string, number | string> }> = [];
  world.eventBus.subscribe((e) => events.push({ type: e.eventType, quantities: e.calculatedQuantities }));

  world.step();

  const warning = events.find((e) => e.type === "accuracy_warning");
  assert.ok(warning, `expected an accuracy warning, got ${JSON.stringify(events.map((e) => e.type))}`);
  assert.equal(warning!.quantities?.dtSeconds, 900);
  assert.ok(typeof warning!.quantities?.dynamicalTimeSeconds === "number");

  // A comfortably small timestep must not warn.
  const quiet = new SimulationWorld({ dtSeconds: 1, initialBodies: pair("c", "d") });
  const quietEvents: SimulationEventType[] = [];
  quiet.eventBus.subscribe((e) => quietEvents.push(e.eventType));
  quiet.step();
  assert.equal(
    quietEvents.includes("accuracy_warning"),
    false,
    "a well-resolved timestep must not raise an accuracy warning"
  );
});

test("reserved event kinds are declared but never emitted by the engine", () => {
  const star = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "sun" });
  const earth = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({
    id: "earth",
    position: [AU_M, 0, 0],
    velocity: [0, 29780, 0],
  });

  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [star, earth] });
  const emitted = new Set<SimulationEventType>();
  world.eventBus.subscribe((e) => emitted.add(e.eventType));

  for (let i = 0; i < 25; i++) world.step();
  world.executeCommand({ type: "set_mass", id: "earth", massKg: 6e24 });
  world.executeCommand({ type: "delete_body", id: "earth" });

  for (const reserved of RESERVED_EVENT_TYPES) {
    assert.equal(
      emitted.has(reserved),
      false,
      `reserved event "${reserved}" must not be emitted while it has no detector`
    );
  }

  for (const implemented of IMPLEMENTED_EVENT_TYPES) {
    assert.equal(
      (RESERVED_EVENT_TYPES as readonly string[]).includes(implemented),
      false,
      `${implemented} cannot be both implemented and reserved`
    );
  }

  // Parameter and lifecycle events do fire from commands.
  assert.ok(emitted.has("parameter_changed"));
  assert.ok(emitted.has("body_removed"));
});

test("every emitted event carries tick, simulated time and model provenance", () => {
  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: pair("a", "b") });
  const events: Array<Record<string, unknown>> = [];
  world.eventBus.subscribe((e) => events.push(e as unknown as Record<string, unknown>));

  world.step();
  world.executeCommand({ type: "set_mass", id: "a", massKg: 6e24 });

  assert.ok(events.length > 0);
  for (const event of events) {
    assert.equal(typeof event.eventId, "string");
    assert.equal(typeof event.tick, "number");
    assert.equal(typeof event.simTimeSeconds, "number");
    assert.ok(Number.isFinite(event.tick as number));
    assert.ok(Number.isFinite(event.simTimeSeconds as number));
    assert.equal(typeof event.summary, "string");
    const provenance = event.provenance as { model: string; version: string } | undefined;
    assert.ok(provenance, "events must state which model produced them");
    assert.ok(provenance!.model.length > 0);
    assert.ok(provenance!.version.length > 0);
  }
});
