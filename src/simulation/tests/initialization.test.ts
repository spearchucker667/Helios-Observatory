import { test } from "node:test";
import assert from "node:assert/strict";
import { createSimulationBodyFromCanonical } from "../initialization/canonical-adapter.ts";
import { transformToBarycentric } from "../initialization/barycentric.ts";
import type { SimulationBody } from "../domain/types.ts";

test("creates simulation body with correct provenance and properties", () => {
  const earth = createSimulationBodyFromCanonical("earth", 0);
  assert.ok(earth);
  assert.equal(earth.id, "earth");
  assert.equal(earth.classification, "planet");
  assert.equal(earth.gravityRole, "massive");
  assert.ok(earth.mass > 0);
  assert.ok(earth.radius > 0);
  // Mass/radius come from canonical institutional records; the Cartesian state
  // is a calculated transform of canonical orbital elements.
  assert.equal(earth.provenance.mass.kind, "canonical");
  assert.equal(earth.provenance.radius.kind, "canonical");
  assert.equal(earth.provenance.state.kind, "calculated");
  assert.equal(earth.provenance.state.method, "J2000 secular Keplerian state-vector transformation");
});

test("transforms to barycentric frame correctly", () => {
  const sun = createSimulationBodyFromCanonical("sun", 0);
  const jupiter = createSimulationBodyFromCanonical("jupiter", 0);
  assert.ok(sun && jupiter);

  const bodies: SimulationBody[] = [sun, jupiter];
  
  // They are heliocentric, so sun is at [0,0,0] initially
  assert.deepEqual(sun.position, [0, 0, 0]);
  
  transformToBarycentric(bodies);
  
  // Sun is no longer at [0,0,0]
  assert.notDeepEqual(sun.position, [0, 0, 0]);

  // Center of mass should now be [0,0,0]
  let cmX = 0, cmY = 0, cmZ = 0;
  let px = 0, py = 0, pz = 0;
  let totalMass = 0;

  for (const b of bodies) {
    cmX += b.mass * b.position[0];
    cmY += b.mass * b.position[1];
    cmZ += b.mass * b.position[2];
    
    px += b.mass * b.velocity[0];
    py += b.mass * b.velocity[1];
    pz += b.mass * b.velocity[2];
    totalMass += b.mass;
  }

  assert.ok(Math.abs(cmX / totalMass) < 1e-5);
  assert.ok(Math.abs(cmY / totalMass) < 1e-5);
  assert.ok(Math.abs(cmZ / totalMass) < 1e-5);
  
  assert.ok(Math.abs(px / totalMass) < 1e-5);
  assert.ok(Math.abs(py / totalMass) < 1e-5);
  assert.ok(Math.abs(pz / totalMass) < 1e-5);
});

test("missing mass behaves as a tracer", () => {
  // Try with Ceres or Pluto? 
  // Ceres has mass in canonical data.
  // We can just construct a fake body to test the adapter logic, or find one without mass.
  // For now, we mock the canonical adapter behavior for missing mass.
  
  // Let's create a body with missing mass by creating a dummy one.
  const tracer: SimulationBody = {
    id: "dummy",
    name: "Dummy",
    classification: "asteroid",
    gravityRole: "tracer",
    mass: 0,
    radius: 0,
    position: [1000, 0, 0],
    velocity: [0, 10, 0],
    provenance: {
      mass: { kind: "unsupported" },
      radius: { kind: "unsupported" },
      state: { kind: "custom" }
    }
  };

  const sun = createSimulationBodyFromCanonical("sun", 0);
  assert.ok(sun);

  const bodies: SimulationBody[] = [sun, tracer];
  transformToBarycentric(bodies);

  // The center of mass is entirely at the sun's position because tracer has 0 mass.
  // Sun's initial position was [0,0,0], so Rcm = [0,0,0].
  // So Sun shouldn't move.
  assert.deepEqual(sun.position, [0, 0, 0]);
  assert.deepEqual(sun.velocity, [0, 0, 0]);
  
  // Tracer should still be at its original position relative to Rcm.
  assert.deepEqual(tracer.position, [1000, 0, 0]);
});
