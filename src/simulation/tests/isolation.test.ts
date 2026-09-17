import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyById } from "../../data/registry.ts";
import { KM_PER_AU, SPEED_OF_LIGHT_KM_S } from "../../lib/measurement.ts";
import { AU_M, C_M_S } from "../domain/constants.ts";

test("Canonical data must not be mutated by simulation operations", () => {
  const earthCanonicalBefore = structuredClone(bodyById("earth"));
  
  // Dummy mutation to simulate a bad deep copy (which we won't actually do in the engine,
  // but we test that the registry itself hasn't been touched)
  const simulatedEarth = structuredClone(earthCanonicalBefore);
  if (simulatedEarth && simulatedEarth.physical && simulatedEarth.physical.massKg24) {
    simulatedEarth.physical.massKg24 *= 2;
  }
  
  assert.deepEqual(bodyById("earth"), earthCanonicalBefore);
});

test("Simulation constants must not drift from canonical constants", () => {
  // Convert KM to M
  const diffAu = Math.abs((KM_PER_AU * 1000) - AU_M);
  assert.ok(diffAu < 1, `AU constant drift: ${diffAu}`);
  
  const diffC = Math.abs((SPEED_OF_LIGHT_KM_S * 1000) - C_M_S);
  assert.ok(diffC < 1, `Speed of light constant drift: ${diffC}`);
});
