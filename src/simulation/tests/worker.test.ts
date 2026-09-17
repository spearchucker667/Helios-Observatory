import { test } from "node:test";
import assert from "node:assert/strict";
import { WorkerClient } from "../worker/worker-client.ts";
import { PRESETS } from "../domain/presets.ts";

test("WorkerClient initialization and initial snapshot delivery", () => {
  const client = new WorkerClient();
  const earth = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "e1" });

  let receivedSnapshot = false;
  client.onSnapshot((snap) => {
    receivedSnapshot = true;
    assert.equal(snap.numBodies, 1);
    assert.equal(snap.bodyIds[0], "e1");
  });

  client.init([earth], 3600);
  assert.equal(receivedSnapshot, true, "Must receive snapshot upon initialization");
  client.terminate();
});

test("WorkerClient command dispatch and state snapshot update", () => {
  const client = new WorkerClient();
  const star = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "s1" });
  const earth = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "e1" });

  client.init([star], 3600);

  let numBodiesInSnapshot = 1;
  client.onSnapshot((snap) => {
    numBodiesInSnapshot = snap.numBodies;
  });

  // Dispatch add_body command
  client.sendCommand({ type: "add_body", body: earth });
  assert.equal(numBodiesInSnapshot, 2, "Snapshot must reflect newly added body");

  // Dispatch delete_body command
  client.sendCommand({ type: "delete_body", id: "e1" });
  assert.equal(numBodiesInSnapshot, 1, "Snapshot must reflect deleted body");

  client.terminate();
});

test("WorkerClient step_once and checkpoint roundtrip", async () => {
  const client = new WorkerClient();
  const star = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "s1" });
  client.init([star], 1800);

  client.stepOnce();
  const checkpoint = await client.requestCheckpoint();

  assert.equal(checkpoint.tick, 1);
  assert.equal(checkpoint.simTimeSeconds, 1800);
  assert.equal(checkpoint.bodies.length, 1);

  // Advance further
  client.stepOnce();
  client.stepOnce();

  // Restore checkpoint
  client.loadCheckpoint(checkpoint);
  const restoredCheckpoint = await client.requestCheckpoint();
  assert.equal(restoredCheckpoint.tick, 1);
  assert.equal(restoredCheckpoint.simTimeSeconds, 1800);

  client.terminate();
});

test("WorkerClient error handling on malformed operations", () => {
  const client = new WorkerClient();
  let errorReceived: string | null = null;
  client.onError((err) => {
    errorReceived = err;
  });

  // Step before init should emit an error
  client.stepOnce();
  assert.ok(errorReceived !== null, "Must receive error when operating on uninitialized world");
  client.terminate();
});

test("WorkerClient trajectory prediction request", () => {
  return new Promise<void>((resolve) => {
    const client = new WorkerClient();
    const star = PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "s1" });
    const earth = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "e1" });

    client.init([star, earth], 3600);

    client.onTrajectory((bodyId, points) => {
      assert.equal(bodyId, "e1");
      assert.ok(points.length > 10, "Trajectory prediction must return points");
      client.terminate();
      resolve();
    });

    client.requestTrajectory("e1", 50);
  });
});
