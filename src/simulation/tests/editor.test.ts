import { test } from "node:test";
import assert from "node:assert/strict";
import { SimulationWorld } from "../engine/world.ts";
import { PRESETS } from "../domain/presets.ts";
import { bodyById } from "../../data/registry.ts";
import {
  cartesianToOrbitalElements,
  orbitalElementsToCartesian,
  semiLatusRectum,
} from "../physics/orbital-elements.ts";
import { validateBodyDraft, normalizeCompactInvariants } from "../state/editor-validation.ts";
import { buildBodyEditCommands } from "../state/edit-commands.ts";
import {
  massFromDisplay,
  massToDisplay,
  radiusFromDisplay,
  radiusToDisplay,
  type MassDisplayUnit,
  type RadiusDisplayUnit,
} from "../state/display-units.ts";
import { calculateSchwarzschildRadius } from "../engine/compact-objects.ts";
import { createSimulationBodyFromCanonical } from "../initialization/canonical-adapter.ts";
import { SOLAR_MASS_KG, AU_M } from "../domain/constants.ts";
import type { SimulationBody } from "../domain/types.ts";

const MASS_UNITS: MassDisplayUnit[] = ["kg", "earth", "sun"];
const RADIUS_UNITS: RadiusDisplayUnit[] = ["m", "km", "earth", "sun"];

test("SI <-> display-unit conversion round-trips for every supported mass and radius unit", () => {
  const massesKg = [1, 5.972e24, 1.98847e30, 7.342e22];
  for (const unit of MASS_UNITS) {
    for (const kg of massesKg) {
      const roundTripped = massFromDisplay(massToDisplay(kg, unit), unit);
      const relError = Math.abs(roundTripped - kg) / kg;
      assert.ok(
        relError < 1e-12,
        `Mass round-trip failed for unit ${unit}: ${kg} -> ${massToDisplay(kg, unit)} -> ${roundTripped} (relError ${relError})`
      );
    }
  }

  const radiiM = [1, 6371000, 6.957e8, 1.7374e6];
  for (const unit of RADIUS_UNITS) {
    for (const m of radiiM) {
      const roundTripped = radiusFromDisplay(radiusToDisplay(m, unit), unit);
      const relError = Math.abs(roundTripped - m) / m;
      assert.ok(
        relError < 1e-12,
        `Radius round-trip failed for unit ${unit}: ${m} -> ${radiusToDisplay(m, unit)} -> ${roundTripped} (relError ${relError})`
      );
    }
  }
});

test("elliptic Cartesian <-> orbital round-trip reproduces the original state", () => {
  const parentMass = SOLAR_MASS_KG;
  const a = 1.5 * AU_M;
  const e = 0.31;
  const elements = {
    semiMajorAxisM: a,
    eccentricity: e,
    inclinationDeg: 12.5,
    longitudeOfAscendingNodeDeg: 47.2,
    argumentOfPeriapsisDeg: 88.9,
    trueAnomalyDeg: 143.0,
    isBound: true,
  };

  const cartesian = orbitalElementsToCartesian(elements, parentMass);
  assert.ok(cartesian.positionM.every(Number.isFinite), "Elliptic position must be finite");
  assert.ok(cartesian.velocityMs.every(Number.isFinite), "Elliptic velocity must be finite");

  const recovered = cartesianToOrbitalElements(cartesian.positionM, cartesian.velocityMs, parentMass);
  assert.ok(Math.abs(recovered.eccentricity - e) < 1e-9, `eccentricity ${recovered.eccentricity} != ${e}`);
  assert.ok(
    Math.abs(recovered.semiMajorAxisM - a) / a < 1e-9,
    `semi-major axis ${recovered.semiMajorAxisM} != ${a}`
  );
  assert.equal(recovered.isBound, true);

  // Rebuild from the recovered elements; the Cartesian state must agree.
  const rebuilt = orbitalElementsToCartesian(recovered, parentMass);
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs(rebuilt.positionM[i] - cartesian.positionM[i]) / AU_M < 1e-9,
      `position component ${i} diverged`
    );
    assert.ok(
      Math.abs(rebuilt.velocityMs[i] - cartesian.velocityMs[i]) < 1e-3,
      `velocity component ${i} diverged: ${rebuilt.velocityMs[i]} vs ${cartesian.velocityMs[i]}`
    );
  }
});

test("hyperbolic Cartesian <-> orbital round-trip stays finite and reproduces the state", () => {
  const parentMass = SOLAR_MASS_KG;
  const a = -2.2 * AU_M; // negative semi-major axis for an unbound orbit
  const e = 1.42;
  assert.ok(semiLatusRectum(a, e) > 0, "Hyperbolic semi-latus rectum must be positive");

  const elements = {
    semiMajorAxisM: a,
    eccentricity: e,
    inclinationDeg: 25.0,
    longitudeOfAscendingNodeDeg: 210.0,
    argumentOfPeriapsisDeg: 15.0,
    trueAnomalyDeg: -30.0, // inside the reachable cone
    isBound: false,
  };

  const cartesian = orbitalElementsToCartesian(elements, parentMass);
  assert.ok(cartesian.positionM.every(Number.isFinite), "Hyperbolic position must be finite");
  assert.ok(cartesian.velocityMs.every(Number.isFinite), "Hyperbolic velocity must be finite");

  const recovered = cartesianToOrbitalElements(cartesian.positionM, cartesian.velocityMs, parentMass);
  assert.equal(recovered.isBound, false, "Hyperbolic state must be classified unbound");
  assert.ok(Math.abs(recovered.eccentricity - e) < 1e-9, `eccentricity ${recovered.eccentricity} != ${e}`);
  assert.ok(
    Math.abs(recovered.semiMajorAxisM - a) / Math.abs(a) < 1e-9,
    `semi-major axis ${recovered.semiMajorAxisM} != ${a}`
  );

  const rebuilt = orbitalElementsToCartesian(recovered, parentMass);
  for (let i = 0; i < 3; i++) {
    assert.ok(
      Math.abs(rebuilt.positionM[i] - cartesian.positionM[i]) / AU_M < 1e-9,
      `hyperbolic position component ${i} diverged`
    );
    assert.ok(
      Math.abs(rebuilt.velocityMs[i] - cartesian.velocityMs[i]) < 1e-3,
      `hyperbolic velocity component ${i} diverged`
    );
  }
});

test("parabolic boundary handling stays finite or throws a descriptive error", () => {
  const parentMass = SOLAR_MASS_KG;
  const q = 0.5 * AU_M; // periapsis distance; a = q for a parabola
  const parabolic = {
    semiMajorAxisM: q,
    eccentricity: 1,
    inclinationDeg: 0,
    longitudeOfAscendingNodeDeg: 0,
    argumentOfPeriapsisDeg: 0,
    trueAnomalyDeg: 0,
    isBound: false,
  };

  const cartesian = orbitalElementsToCartesian(parabolic, parentMass);
  assert.ok(cartesian.positionM.every(Number.isFinite), "Parabolic position must be finite");
  assert.ok(cartesian.velocityMs.every(Number.isFinite), "Parabolic velocity must be finite");
  // At periapsis the radius equals q exactly for the parabolic conic.
  const rMag = Math.hypot(...cartesian.positionM);
  assert.ok(Math.abs(rMag - q) / q < 1e-9, `parabolic periapsis radius ${rMag} != ${q}`);

  // A true anomaly outside the hyperbolic asymptote must be rejected explicitly
  // rather than silently yielding Infinity/NaN.
  assert.throws(
    () =>
      orbitalElementsToCartesian(
        {
          semiMajorAxisM: -1 * AU_M,
          eccentricity: 1.3,
          inclinationDeg: 0,
          longitudeOfAscendingNodeDeg: 0,
          argumentOfPeriapsisDeg: 0,
          trueAnomalyDeg: 170,
          isBound: false,
        },
        parentMass
      ),
    /outside the reachable cone/
  );
});

test("editor provenance transitions canonical -> custom through production commands", () => {
  const canonicalEarth = createSimulationBodyFromCanonical("earth", 0);
  assert.ok(canonicalEarth, "canonical Earth must convert into a simulation body");
  assert.equal(canonicalEarth.provenance.mass.kind, "canonical");
  assert.equal(canonicalEarth.provenance.radius.kind, "canonical");

  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [canonicalEarth] });
  const before = world.getBody("earth")!;
  assert.equal(before.provenance.mass.kind, "canonical");

  // A mass edit must invalidate ONLY the mass provenance: the radius is a
  // canonical measurement that the edit did not touch, and the state is not
  // affected by a mass change.
  world.executeCommand({ type: "set_mass", id: "earth", massKg: 5 * before.mass });
  const afterMassEdit = world.getBody("earth")!;
  assert.equal(afterMassEdit.provenance.mass.kind, "custom");
  assert.equal(afterMassEdit.provenance.mass.method, "Direct mass edit");
  assert.equal(afterMassEdit.provenance.radius.kind, "canonical");
  assert.equal(afterMassEdit.provenance.state.kind, "calculated");
  assert.equal(afterMassEdit.mass, 5 * before.mass);
  assert.equal(afterMassEdit.radius, before.radius, "a mass edit must not silently change the radius");

  // A velocity edit moves state provenance to custom.
  world.executeCommand({ type: "set_velocity", id: "earth", velocity: [1, 2, 3] });
  const afterVelocityEdit = world.getBody("earth")!;
  assert.equal(afterVelocityEdit.provenance.state.kind, "custom");
  assert.equal(afterVelocityEdit.provenance.state.method, "Direct velocity edit");

  // A position edit likewise.
  world.executeCommand({ type: "set_position", id: "earth", position: [1e9, 0, 0] });
  assert.equal(world.getBody("earth")!.provenance.state.method, "Direct position edit");
});

test("editor-independent canonical record is untouched after production editor commands", () => {
  const canonicalBefore = structuredClone(bodyById("earth"));
  const world = new SimulationWorld({
    dtSeconds: 900,
    initialBodies: [PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "earth" })],
  });

  // Full edit surface of the editor, applied to the world (not to canonical data).
  const draft = world.getBody("earth")!;
  draft.mass *= 5;
  draft.radius *= 2;
  draft.position[0] += 1e11;
  const commands = buildBodyEditCommands(world.getBody("earth")!, draft);
  for (const command of commands) world.executeCommand(command);

  assert.deepEqual(bodyById("earth"), canonicalBefore, "canonical registry must remain untouched");
});

test("invalid NaN / Infinity inputs are rejected by the editor validator and world", () => {
  const base = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "e1" });

  for (const badMass of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    const result = validateBodyDraft({ ...base, mass: badMass });
    assert.equal(result.valid, false, `mass ${badMass} must be rejected`);
    assert.ok(result.errors.mass);
  }

  for (const badPos of [
    [Number.NaN, 0, 0],
    [0, Number.POSITIVE_INFINITY, 0],
  ]) {
    const result = validateBodyDraft({ ...base, position: badPos as [number, number, number] });
    assert.equal(result.valid, false);
    assert.ok(result.errors.position);
  }

  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [base] });
  assert.equal(world.executeCommand({ type: "set_mass", id: "e1", massKg: Number.NaN }), false);
  assert.equal(world.executeCommand({ type: "set_position", id: "e1", position: [0, Number.NaN, 0] }), false);
  assert.equal(world.getBody("e1")!.mass, base.mass, "rejected commands must not mutate the body");
});

test("negative mass and zero radius for massive bodies are rejected", () => {
  const base = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "e1" });

  const negativeMass = validateBodyDraft({ ...base, mass: -1 });
  assert.equal(negativeMass.valid, false);
  assert.ok(negativeMass.errors.mass);

  const zeroRadius = validateBodyDraft({ ...base, radius: 0, gravityRole: "massive" });
  assert.equal(zeroRadius.valid, false);
  assert.ok(zeroRadius.errors.radius);

  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [base] });
  assert.equal(world.executeCommand({ type: "set_mass", id: "e1", massKg: -5 }), false);
  assert.equal(world.executeCommand({ type: "set_radius", id: "e1", radiusM: 0 }), false);
});

test("compact-object settings are validated and normalized consistently", () => {
  const rs = calculateSchwarzschildRadius(10 * SOLAR_MASS_KG);
  const blackHole: SimulationBody = {
    id: "bh-1",
    name: "Stellar Black Hole",
    classification: "black-hole",
    gravityRole: "massive",
    mass: 10 * SOLAR_MASS_KG,
    radius: rs,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    compact: { schwarzschildRadiusM: rs },
    provenance: {
      mass: { kind: "custom" },
      radius: { kind: "calculated" },
      state: { kind: "custom" },
    },
  };

  const consistent = validateBodyDraft(blackHole);
  assert.equal(consistent.valid, true, `expected valid, got ${JSON.stringify(consistent.errors)}`);

  const inconsistent = validateBodyDraft({ ...blackHole, radius: rs * 3 });
  assert.equal(inconsistent.valid, false, "a horizon radius disagreeing with 2GM/c^2 must be rejected");
  assert.ok(inconsistent.errors.radius);

  const inconsistentRecord = validateBodyDraft({
    ...blackHole,
    compact: { schwarzschildRadiusM: rs * 7 },
  });
  assert.equal(inconsistentRecord.valid, false);
  assert.ok(inconsistentRecord.errors.compactSchwarzschild);

  // Invalid spin / magnetic values
  assert.equal(validateBodyDraft({ ...blackHole, compact: { spinPeriodSeconds: -1 } }).valid, false);
  assert.equal(validateBodyDraft({ ...blackHole, compact: { magneticFieldTesla: Number.NaN } }).valid, false);

  // Normalization restores the derived fields from the authoritative mass.
  const normalized = normalizeCompactInvariants({ ...blackHole, mass: 20 * SOLAR_MASS_KG });
  const expectedRs = calculateSchwarzschildRadius(20 * SOLAR_MASS_KG);
  assert.equal(normalized.radius, expectedRs);
  assert.equal(normalized.compact?.schwarzschildRadiusM, expectedRs);
  assert.equal(normalized.provenance.radius.kind, "calculated");
});

test("black-hole mass / radius / rs stay synchronized through world commands", () => {
  const rs = calculateSchwarzschildRadius(5 * SOLAR_MASS_KG);
  const blackHole: SimulationBody = {
    id: "bh-1",
    name: "Black Hole",
    classification: "black-hole",
    gravityRole: "massive",
    mass: 5 * SOLAR_MASS_KG,
    radius: rs,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    compact: { schwarzschildRadiusM: rs },
    provenance: { mass: { kind: "custom" }, radius: { kind: "calculated" }, state: { kind: "custom" } },
  };

  const world = new SimulationWorld({ dtSeconds: 900, initialBodies: [blackHole] });

  assert.equal(
    world.executeCommand({ type: "set_radius", id: "bh-1", radiusM: 1 }),
    false,
    "horizon radius must not be independently editable"
  );

  const doubled = 10 * SOLAR_MASS_KG;
  assert.equal(world.executeCommand({ type: "set_mass", id: "bh-1", massKg: doubled }), true);

  const body = world.getBody("bh-1")!;
  const expected = calculateSchwarzschildRadius(doubled);
  assert.ok(Math.abs(body.radius - expected) < 1e-9, `radius ${body.radius} != rs ${expected}`);
  assert.ok(Math.abs((body.compact?.schwarzschildRadiusM ?? 0) - expected) < 1e-9);
  assert.equal(body.provenance.mass.kind, "custom");
  assert.equal(body.provenance.radius.kind, "calculated");
});

test("the editor emits narrow typed commands and never a generic body patch", () => {
  const current = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id: "e1" });

  const noOp = buildBodyEditCommands(current, structuredClone(current));
  assert.equal(noOp.length, 0, "an unchanged draft must produce no commands");

  const draft = structuredClone(current);
  draft.mass *= 2;
  draft.position = [draft.position[0] + 1, draft.position[1], draft.position[2]];
  draft.name = "Renamed";

  const commands = buildBodyEditCommands(current, draft);
  const types = commands.map((c) => c.type).sort();
  assert.deepEqual(types, ["set_mass", "set_name", "set_position"]);
  for (const command of commands) {
    assert.notEqual(command.type as string, "update_body");
  }
});
