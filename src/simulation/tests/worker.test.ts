import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkerClient } from "../worker/worker-client.ts";
import { PRESETS } from "../domain/presets.ts";
import type { PlaybackState } from "../engine/timestep.ts";
import type { SimulationBody } from "../domain/types.ts";

function star(id = "s1"): SimulationBody {
  return PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id });
}

function earth(id = "e1"): SimulationBody {
  return PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id });
}

test("WorkerClient initialization delivers a snapshot and starts explicitly paused", () => {
  const client = new WorkerClient();
  const states: PlaybackState[] = [];
  client.onPlaybackState((state) => states.push(state));

  let receivedSnapshot = false;
  client.onSnapshot((snap) => {
    receivedSnapshot = true;
    assert.equal(snap.numBodies, 1);
    assert.equal(snap.bodyIds[0], "e1");
  });

  client.init([earth()], 3600);
  assert.equal(receivedSnapshot, true, "Must receive snapshot upon initialization");
  assert.equal(states[0], "paused", "Authoritative initial state must be paused");
  assert.equal(client.fallbackMode, true, "Node has no Web Worker, so the shared host runs in-process");

  client.terminate();
});

test("WorkerClient command dispatch rejects duplicates and reflects state changes", () => {
  const client = new WorkerClient();
  client.init([star()], 3600);

  let numBodiesInSnapshot = 1;
  client.onSnapshot((snap) => {
    numBodiesInSnapshot = snap.numBodies;
  });

  client.sendCommand({ type: "add_body", body: earth() });
  assert.equal(numBodiesInSnapshot, 2, "Snapshot must reflect newly added body");

  // Duplicate id must be rejected, not silently replace the body.
  const errors: string[] = [];
  client.onError((err) => errors.push(err));
  client.sendCommand({ type: "add_body", body: earth("s1") });
  assert.equal(numBodiesInSnapshot, 2, "Duplicate id must not add or replace a body");
  assert.ok(
    errors.some((e) => e.includes("COMMAND_REJECTED") || e.includes("rejected")),
    `expected a rejection error, got ${JSON.stringify(errors)}`
  );

  client.sendCommand({ type: "delete_body", id: "e1" });
  assert.equal(numBodiesInSnapshot, 1, "Snapshot must reflect deleted body");

  client.terminate();
});

test("step_once advances exactly one dt and leaves the engine paused", async () => {
  const client = new WorkerClient();
  client.init([star(), earth()], 1800);

  const states: PlaybackState[] = [];
  client.onPlaybackState((state) => states.push(state));
  client.onPerformance((stats) => states.push(stats.state));

  // Start running first: a single step must still leave it paused.
  client.resume();
  const before = await client.requestCheckpoint();
  assert.equal(before.tick, 0);

  client.stepOnce();
  const after = await client.requestCheckpoint();

  assert.equal(after.tick, before.tick + 1, "step_once must advance exactly one tick");
  assert.equal(
    after.simTimeSeconds - before.simTimeSeconds,
    1800,
    "step_once must advance exactly one dt"
  );
  assert.ok(states.includes("stepping"), "Stepping state must be reported");
  assert.equal(states[states.length - 1], "paused", "Engine must remain paused after a single step");

  // A subsequent interval-driven tick must NOT advance the world while paused.
  await new Promise((resolve) => setTimeout(resolve, 120));
  const settled = await client.requestCheckpoint();
  assert.equal(settled.tick, after.tick, "No automatic stepping may occur while paused");

  client.terminate();
});

test("reset restores the initial world AND the authoritative playback state", async () => {
  const client = new WorkerClient();
  client.init([star(), earth()], 900);

  const states: PlaybackState[] = [];
  client.onPlaybackState((state) => states.push(state));

  client.resume();
  client.stepOnce();
  client.stepOnce();
  client.sendCommand({ type: "add_body", body: earth("e2") });

  const moved = await client.requestCheckpoint();
  assert.ok(moved.tick >= 2, "world must have advanced before reset");

  client.resetToInitial();
  const reset = await client.requestCheckpoint();

  assert.equal(reset.tick, 0, "reset must return to the initial tick");
  assert.equal(reset.simTimeSeconds, 0, "reset must return to the initial time");
  assert.equal(reset.bodies.length, 2, "reset must restore the initial body set");
  assert.equal(states[states.length - 1], "paused", "reset must leave playback paused");

  client.terminate();
});

test("WorkerClient checkpoint roundtrip restores world state and scheduler dt", async () => {
  const client = new WorkerClient();
  client.init([star(), earth()], 120);
  client.stepOnce();
  client.stepOnce();

  const checkpoint = await client.requestCheckpoint();
  assert.equal(checkpoint.tick, 2);
  assert.equal(checkpoint.simTimeSeconds, 240);
  assert.equal(checkpoint.dtSeconds, 120);
  assert.equal(checkpoint.configuration.collisionModelVersion.length > 0, true);

  // Change the timestep, then restore the checkpoint.
  client.setQuality("fast"); // 3600 s steps
  client.stepOnce();

  client.loadCheckpoint(checkpoint);
  const restored = await client.requestCheckpoint();
  assert.equal(restored.tick, 2);
  assert.equal(restored.simTimeSeconds, 240);
  assert.equal(restored.dtSeconds, 120, "checkpoint dt must be restored");

  // The very next single step must use the restored dt, not the quality preset.
  client.stepOnce();
  const afterRestore = await client.requestCheckpoint();
  assert.equal(
    afterRestore.simTimeSeconds - restored.simTimeSeconds,
    120,
    "scheduler dt must agree with the restored checkpoint"
  );

  client.terminate();
});

test("malformed worker messages are rejected at the runtime boundary", () => {
  const client = new WorkerClient();
  const errors: string[] = [];
  client.onError((err) => errors.push(err));

  // Not initialized yet: malformed payloads must never reach the world.
  client.init([
    {
      ...earth(),
      // @ts-expect-error deliberately malformed payload for runtime validation
      position: [1, 2],
    },
  ]);
  assert.ok(errors.length > 0, `expected a validation error, got ${JSON.stringify(errors)}`);
  assert.ok(errors[0].includes("Rejected malformed worker message"));

  client.terminate();
});

test("NaN timestep, infinite multiplier, malformed command and invalid checkpoint are rejected", () => {
  const client = new WorkerClient();
  const errors: string[] = [];
  client.onError((err, code) => errors.push(`${code ?? ""}:${err}`));

  client.init([star(), earth()], 900);
  errors.length = 0;

  client.setDt(Number.NaN);
  client.setTimeMultiplier(Number.POSITIVE_INFINITY);

  // Commands bypass the client typing on purpose: the worker boundary is the
  // last line of defence.
  (client as unknown as { post: (m: unknown) => void }).post({
    type: "command",
    command: { type: "set_mass", id: "e1", massKg: Number.NaN },
  });

  client.loadCheckpoint({ tick: -5 } as never);

  assert.ok(
    errors.some((e) => e.includes("Rejected malformed worker message") && e.includes("dtSeconds")),
    `expected invalid dt rejection, got ${JSON.stringify(errors)}`
  );
  assert.ok(
    errors.some((e) => e.includes("Rejected malformed worker message") && e.includes("multiplier")),
    `expected invalid multiplier rejection, got ${JSON.stringify(errors)}`
  );
  assert.ok(
    errors.some((e) => e.includes("Rejected malformed worker message") && e.includes("massKg")),
    `expected malformed command rejection, got ${JSON.stringify(errors)}`
  );
  assert.ok(
    errors.some((e) => e.includes("Rejected malformed worker message") && e.includes("checkpoint")),
    `expected invalid checkpoint rejection, got ${JSON.stringify(errors)}`
  );

  client.terminate();
});

test("worker loop faults halt the simulation cleanly with the last good tick", async () => {
  const client = new WorkerClient();

  // Two enormous masses one metre apart: repeated 3600 s steps drive the state
  // out of the finite double range. The engine must refuse to continue rather
  // than integrate a non-finite world.
  const runawayA = star("a");
  runawayA.mass = 1e300;
  runawayA.radius = 1;
  runawayA.position = [0, 0, 0];
  runawayA.velocity = [0, 0, 0];

  const runawayB = star("b");
  runawayB.mass = 1e300;
  runawayB.radius = 1;
  runawayB.position = [1, 0, 0];
  runawayB.velocity = [0, 0, 0];

  client.init([runawayA, runawayB], 3600);

  const halts: Array<{ reason: string; lastGoodTick: number }> = [];
  client.onHalt((reason, lastGoodTick) => halts.push({ reason, lastGoodTick }));

  const errors: string[] = [];
  client.onError((err) => errors.push(err));

  for (let i = 0; i < 12 && halts.length === 0; i++) {
    client.stepOnce();
  }

  assert.equal(halts.length, 1, "the run must halt exactly once");
  assert.ok(/Non-finite/.test(halts[0].reason), `unexpected halt reason: ${halts[0].reason}`);
  assert.ok(errors.some((e) => /Non-finite/.test(e)), "the halt must be reported as an error");

  // The halted world must refuse further stepping.
  const beforeTick = halts[0].lastGoodTick;
  client.stepOnce();
  const after = await client.requestCheckpoint().catch(() => null);
  if (after) {
    assert.equal(after.tick, beforeTick, "a halted world must not advance");
  }

  client.terminate();
});

test("checkpoint requests reject instead of hanging when the host disappears", async () => {
  const client = new WorkerClient({ requestTimeoutMs: 20 });
  client.init([star()], 900);
  client.terminate();

  await assert.rejects(() => client.requestCheckpoint(), /timed out/);
});

test("requestCommandLog returns the authoritative chronology and origin", async () => {
  const client = new WorkerClient();
  client.init([star(), earth()], 900);

  client.stepOnce();
  client.stepOnce();
  client.sendCommand({ type: "apply_impulse", id: "e1", impulseMs: [0, 10, 0] });
  client.stepOnce();
  client.sendCommand({ type: "set_mass", id: "e1", massKg: 1e25 });

  const session = await client.requestSession();

  assert.equal(session.commandLog.length, 2, "only deterministic physics commands are logged");
  assert.equal(session.commandLog[0].command.type, "apply_impulse");
  assert.equal(session.commandLog[0].tick, 2, "commands must carry their real tick");
  assert.equal(session.commandLog[0].simTimeSeconds, 1800, "commands must carry their real sim time");
  assert.equal(session.commandLog[1].tick, 3);
  assert.equal(session.commandLog[1].simTimeSeconds, 2700);

  assert.equal(session.initialState.tick, 0);
  assert.equal(session.initialState.simTimeSeconds, 0);
  assert.equal(session.initialState.bodies.length, 2);

  assert.equal(session.checkpoint.tick, 3);
  assert.equal(session.checkpoint.simTimeSeconds, 2700);

  client.terminate();
});

test("WorkerClient trajectory prediction request", () => {
  return new Promise<void>((resolve) => {
    const client = new WorkerClient();
    client.init([star(), earth()], 3600);

    client.onTrajectory((bodyId, points) => {
      assert.equal(bodyId, "e1");
      assert.ok(points.length > 10, "Trajectory prediction must return points");
      client.terminate();
      resolve();
    });

    client.requestTrajectory("e1", 50);
  });
});
