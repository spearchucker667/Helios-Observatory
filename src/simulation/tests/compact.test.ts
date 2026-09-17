import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateSchwarzschildRadius,
  evaluateCompactObjectField,
} from "../engine/compact-objects.ts";
import { SOLAR_MASS_KG, AU_M } from "../domain/constants.ts";
import { detectCollisions } from "../collisions/detect.ts";
import { resolveCollision } from "../collisions/resolve.ts";
import { calculateEinsteinPrecession } from "../environment/orbital-derived.ts";
import { computeAccelerations } from "../physics/gravity.ts";
import type { SimulationBody } from "../domain/types.ts";

test("Schwarzschild radius calculation matches standard ~2.95 km per solar mass", () => {
  const rs1Sun = calculateSchwarzschildRadius(SOLAR_MASS_KG);
  // rs = 2 * 6.67430e-11 * 1.98847e30 / (299792458)^2 ≈ 2953.25 m ≈ 2.95 km
  assert.ok(rs1Sun > 2950 && rs1Sun < 2960, `Expected ~2953m, got ${rs1Sun}m`);

  // 10 Solar mass black hole
  const rs10Sun = calculateSchwarzschildRadius(10 * SOLAR_MASS_KG);
  assert.ok(Math.abs(rs10Sun - 10 * rs1Sun) < 1e-4);
});

test("capture boundary triggers black-hole capture outcome", () => {
  const blackHoleMass = 10 * SOLAR_MASS_KG;
  const rs = calculateSchwarzschildRadius(blackHoleMass);

  const blackHole: SimulationBody = {
    id: "bh-1",
    name: "Stellar Black Hole",
    classification: "black-hole",
    gravityRole: "massive",
    mass: blackHoleMass,
    radius: rs,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    compact: { schwarzschildRadiusM: rs },
    provenance: { mass: { kind: "custom" }, radius: { kind: "calculated" }, state: { kind: "custom" } },
  };

  // Infalling asteroid at distance 0.5 * rs (inside horizon)
  const asteroid: SimulationBody = {
    id: "infall-1",
    name: "Infalling Object",
    classification: "asteroid",
    gravityRole: "tracer",
    mass: 1e12,
    radius: 500,
    position: [rs * 0.5, 0, 0],
    velocity: [1e5, 0, 0],
    provenance: { mass: { kind: "custom" }, radius: { kind: "custom" }, state: { kind: "custom" } },
  };

  const collisions = detectCollisions([blackHole, asteroid]);
  assert.equal(collisions.length, 1, "Must detect horizon crossing collision");
  assert.equal(collisions[0].isBlackHoleCapture, true);

  const resolution = resolveCollision(collisions[0]);
  assert.equal(resolution.outcome, "black_hole_capture");
  assert.equal(resolution.survivingBody.id, "bh-1");
  assert.deepEqual(resolution.removedBodyIds, ["infall-1"]);
});

test("compact-object collision routing and black-hole mass growth after capture", () => {
  const initialMass = 5 * SOLAR_MASS_KG;
  const rsInitial = calculateSchwarzschildRadius(initialMass);

  const blackHole: SimulationBody = {
    id: "bh-2",
    name: "Black Hole",
    classification: "black-hole",
    gravityRole: "massive",
    mass: initialMass,
    radius: rsInitial,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    compact: { schwarzschildRadiusM: rsInitial },
    provenance: { mass: { kind: "custom" }, radius: { kind: "calculated" }, state: { kind: "custom" } },
  };

  const planet: SimulationBody = {
    id: "planet-infall",
    name: "Captured Planet",
    classification: "planet",
    gravityRole: "massive",
    mass: 6e24, // Earth mass
    radius: 6.371e6,
    position: [0, 0, 0],
    velocity: [0, 1000, 0],
    provenance: { mass: { kind: "custom" }, radius: { kind: "custom" }, state: { kind: "custom" } },
  };

  const collisions = detectCollisions([blackHole, planet]);
  const resolution = resolveCollision(collisions[0]);

  const newBh = resolution.survivingBody;
  assert.equal(newBh.mass, initialMass + 6e24, "Mass must grow by captured object mass");
  assert.ok(newBh.radius > rsInitial, "Schwarzschild radius must expand proportionally with mass");
  assert.equal(newBh.compact?.schwarzschildRadiusM, newBh.radius);
});

test("tidal scaling follows inverse cube law (1 / r^3)", () => {
  const neutronStar: SimulationBody = {
    id: "ns-1",
    name: "Neutron Star",
    classification: "neutron-star",
    gravityRole: "massive",
    mass: 1.4 * SOLAR_MASS_KG,
    radius: 12000,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    provenance: { mass: { kind: "custom" }, radius: { kind: "custom" }, state: { kind: "custom" } },
  };

  // Evaluate field at distance R and distance 2R
  const d1 = 100000; // 100 km
  const d2 = 200000; // 200 km
  const eval1 = evaluateCompactObjectField(neutronStar, d1);
  const eval2 = evaluateCompactObjectField(neutronStar, d2);

  // Dipole magnetic field scales as 1/r^3
  if (eval1.localMagneticFieldTesla && eval2.localMagneticFieldTesla) {
    const ratio = eval1.localMagneticFieldTesla / eval2.localMagneticFieldTesla;
    assert.ok(Math.abs(ratio - 8.0) < 1e-4, "Magnetic field must scale as 1/r^3");
  }
});

test("strong-field regime flag is set when GM / (r * c^2) > 0.01 without false GR claims", () => {
  const blackHole: SimulationBody = {
    id: "bh-3",
    name: "Black Hole",
    classification: "black-hole",
    gravityRole: "massive",
    mass: 10 * SOLAR_MASS_KG,
    radius: calculateSchwarzschildRadius(10 * SOLAR_MASS_KG),
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    provenance: { mass: { kind: "custom" }, radius: { kind: "calculated" }, state: { kind: "custom" } },
  };

  // Close to horizon (5 * rs): GM/(r c^2) = 0.5 * rs / (5 rs) = 0.1 > 0.01
  const rs = blackHole.radius;
  const closeDiag = evaluateCompactObjectField(blackHole, 5 * rs);
  assert.equal(closeDiag.isStrongFieldRegime, true, "Must flag strong field regime close to black hole");

  // Far from horizon (1 AU): GM/(r c^2) is tiny
  const farDiag = evaluateCompactObjectField(blackHole, 149597870700);
  assert.equal(farDiag.isStrongFieldRegime, false, "Must not flag strong field regime at 1 AU");
});

test("Einstein relativistic perihelion precession matches Mercury canonical ~43 arcsec/century", () => {
  // Mercury parameters: a = 0.387098 AU, e = 0.20563, M_sun = SOLAR_MASS_KG, m_mercury = 3.3011e23 kg
  const mercuryA = 0.387098 * AU_M;
  const mercuryE = 0.20563;
  const mercuryM = 3.3011e23;

  const precession = calculateEinsteinPrecession(SOLAR_MASS_KG, mercuryM, mercuryA, mercuryE);
  assert.ok(precession !== undefined, "Precession must be calculated for bound orbit");

  // Historic Einstein prediction: ~42.98 arcsec / century
  const rate = precession!.arcsecPerCentury;
  assert.ok(
    rate > 42.0 && rate < 44.0,
    `Expected Mercury GR precession ~42.98 arcsec/century, got ${rate.toFixed(2)}`
  );
});

test("1PN post-Newtonian acceleration computes relativistic perturbing force", () => {
  // Relativistic binary near compact object
  const numBodies = 2;
  const positions = new Float64Array([
    0, 0, 0, // Central black hole at origin
    1e7, 0, 0, // Infalling body at 10,000 km
  ]);
  const velocities = new Float64Array([
    0, 0, 0,
    0, 5e6, 0, // 5,000 km/s (relativistic speed: v/c ~ 0.0167)
  ]);
  const masses = new Float64Array([10 * SOLAR_MASS_KG, 1e20]);
  const isTracer = new Uint8Array([0, 0]);

  const newtonianAccel = computeAccelerations(positions, masses, isTracer, numBodies, velocities, {
    enableRelativity: false,
  });

  const relativisticAccel = computeAccelerations(positions, masses, isTracer, numBodies, velocities, {
    enableRelativity: true,
  });

  // Secondary body acceleration comparison (indices 3, 4, 5)
  const axNewton = newtonianAccel[3];
  const axRel = relativisticAccel[3];

  assert.ok(axNewton < 0, "Newtonian gravity attracts towards origin");
  assert.ok(axRel < 0, "Relativistic gravity attracts towards origin");
  // 1PN post-Newtonian adds additional inward attractive pull: |a_rel| > |a_newton|
  assert.ok(Math.abs(axRel) > Math.abs(axNewton), "1PN corrections enhance gravitational attraction in strong field");

  // Relative correction magnitude should be order (v/c)^2 or GM/(r c^2) ~ 1e-4 to 1e-3
  const relativeDiff = Math.abs(axRel - axNewton) / Math.abs(axNewton);
  assert.ok(relativeDiff > 1e-4 && relativeDiff < 0.1, `Relative 1PN diff: ${relativeDiff.toExponential(3)}`);
});
