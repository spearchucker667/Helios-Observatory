import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyById, BODIES } from "../../data/registry.ts";
import { KM_PER_AU, SPEED_OF_LIGHT_KM_S } from "../../lib/measurement.ts";
import { AU_M, C_M_S } from "../domain/constants.ts";
import { createCanonicalSolarSystem, createSimulationBodyFromCanonical } from "../initialization/canonical-adapter.ts";
import { SimulationWorld } from "../engine/world.ts";
import { EPHEMERIS_MIN_DAYS, EPHEMERIS_MAX_DAYS } from "../../lib/ephemeris.ts";

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
    // Mass and radius are canonical measurements.
    assert.equal(b.provenance.mass.kind, "canonical");
    assert.equal(b.provenance.radius.kind, "canonical");
    // The Cartesian state is CALCULATED from those canonical orbital elements;
    // it is never institutionally published as a state vector.
    assert.equal(b.provenance.state.kind, "calculated");
    // The Sun's state is a frame convention (origin by construction); every
    // other body's state is a Keplerian transform of canonical elements.
    if (b.id === "sun") {
      assert.match(b.provenance.state.method ?? "", /Frame definition/);
    } else {
      assert.equal(b.provenance.state.method, "J2000 secular Keplerian state-vector transformation");
    }
  }
});

test("Canonical initialization rejects epochs outside the supported ephemeris window", () => {
  const beforeWindow = EPHEMERIS_MIN_DAYS - 1;
  const afterWindow = EPHEMERIS_MAX_DAYS + 1;

  for (const epoch of [beforeWindow, afterWindow, Number.NaN]) {
    assert.throws(
      () => createCanonicalSolarSystem(epoch),
      /Unsupported canonical ephemeris epoch/,
      `epoch ${epoch} must be rejected`
    );
  }

  // Boundary epochs inside the window are accepted.
  assert.ok(createCanonicalSolarSystem(EPHEMERIS_MIN_DAYS).length > 0);
  assert.ok(createCanonicalSolarSystem(EPHEMERIS_MAX_DAYS).length > 0);
});

test("Production editor commands applied to a simulation never touch canonical records", () => {
  const earthBefore = structuredClone(bodyById("earth"));
  const moonBefore = bodyById("moon") ? structuredClone(bodyById("moon")) : null;

  const [simEarth] = createCanonicalSolarSystem(0).filter((b) => b.id === "earth");
  assert.ok(simEarth);

  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [simEarth] });
  world.executeCommand({ type: "set_mass", id: "earth", massKg: 5 * simEarth.mass });
  world.executeCommand({ type: "set_radius", id: "earth", radiusM: 1e7 });
  world.executeCommand({ type: "set_velocity", id: "earth", velocity: [0, 40000, 0] });
  world.step();

  assert.deepEqual(bodyById("earth"), earthBefore, "canonical Earth must remain untouched");
  if (moonBefore) assert.deepEqual(bodyById("moon"), moonBefore);
});
