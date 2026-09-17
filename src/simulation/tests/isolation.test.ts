import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyById, BODIES } from "../../data/registry.ts";
import { KM_PER_AU, SPEED_OF_LIGHT_KM_S } from "../../lib/measurement.ts";
import { AU_M, C_M_S } from "../domain/constants.ts";
import { createCanonicalSolarSystem, createSimulationBodyFromCanonical } from "../initialization/canonical-adapter.ts";

test("Canonical data must not be mutated by simulation operations", () => {
  const earthCanonicalBefore = structuredClone(bodyById("earth"));
  assert.ok(earthCanonicalBefore);

  const solarSystem = createCanonicalSolarSystem(0);
  const simEarth = solarSystem.find((b) => b.id === "earth");
  assert.ok(simEarth);

  // Aggressively mutate the simulation earth
  simEarth.mass *= 3;
  simEarth.radius *= 0.5;
  simEarth.position[0] += 1e11;
  simEarth.velocity[1] -= 5000;
  if (simEarth.rotation) simEarth.rotation.periodSeconds = 12345;

  // Canonical data in registry must remain strictly untouched
  const earthCanonicalAfter = bodyById("earth");
  assert.deepEqual(earthCanonicalAfter, earthCanonicalBefore);
});

test("Canonical registry records remain deeply isolated when modifying individual simulation bodies", () => {
  const jupiterBefore = structuredClone(bodyById("jupiter"));
  const simJupiter = createSimulationBodyFromCanonical("jupiter", 0);
  assert.ok(simJupiter);

  simJupiter.mass = 0;
  simJupiter.name = "Destroyed Jupiter";
  simJupiter.provenance.mass.kind = "custom";

  assert.deepEqual(bodyById("jupiter"), jupiterBefore);
});

test("Simulation constants must not drift from canonical constants", () => {
  // Convert KM to M
  const diffAu = Math.abs(KM_PER_AU * 1000 - AU_M);
  assert.ok(diffAu < 1e-4, `AU constant drift: ${diffAu}`);

  const diffC = Math.abs(SPEED_OF_LIGHT_KM_S * 1000 - C_M_S);
  assert.ok(diffC < 1e-4, `Speed of light constant drift: ${diffC}`);
});

test("All canonical primary bodies can be converted into simulation bodies", () => {
  const solarSystem = createCanonicalSolarSystem(0);
  assert.equal(solarSystem.length, BODIES.length);

  for (const b of solarSystem) {
    assert.ok(b.id);
    assert.ok(b.name);
    assert.ok(b.mass > 0);
    assert.ok(b.radius > 0);
    assert.equal(b.provenance.mass.kind, "canonical");
    assert.equal(b.provenance.radius.kind, "canonical");
    assert.ok(b.provenance.state.kind === "canonical");
  }
});
