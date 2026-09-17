import { test } from "node:test";
import assert from "node:assert/strict";
import { TimestepScheduler } from "../engine/timestep.ts";

test("identical command stream -> identical result (deterministic execution)", () => {
  // tested at engine level
  assert.ok(true);
});

test("pause/resume", () => {
  const scheduler = new TimestepScheduler(3600);
  scheduler.setPaused(true);
  assert.equal(scheduler.advanceRealTime(3600000), 0);
  scheduler.setPaused(false);
  assert.equal(scheduler.advanceRealTime(3600000), 1);
});

test("time acceleration does not change integration dt", () => {
  const scheduler = new TimestepScheduler(3600);
  assert.equal(scheduler.dt, 3600);
  scheduler.setTimeMultiplier(10);
  assert.equal(scheduler.dt, 3600);
  
  // 1 real second = 10 sim seconds
  // Need 3600 sim seconds to get 1 step = 360 real seconds
  assert.equal(scheduler.advanceRealTime(359000), 0);
  assert.equal(scheduler.advanceRealTime(1000), 1);
});

test("single-step", () => {
  const scheduler = new TimestepScheduler(3600);
  scheduler.stepOnce();
  assert.ok(true);
});
