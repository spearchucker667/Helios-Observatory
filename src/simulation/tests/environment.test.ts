import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBodyIrradiance } from "../environment/irradiance.ts";
import { computeEquilibriumTemperature } from "../environment/temperature.ts";
import { computeDerivedOrbitalState, calculateEinsteinPrecession } from "../environment/orbital-derived.ts";
import { computeRocheDiagnostics } from "../collisions/disruption.ts";
import { PRESETS } from "../domain/presets.ts";
import { AU_M, SOLAR_LUMINOSITY_W, SOLAR_MASS_KG, EARTH_MASS_KG } from "../domain/constants.ts";
import type { SimulationBody } from "../domain/types.ts";

function sun(overrides: Partial<SimulationBody> = {}): SimulationBody {
  return {
    ...PRESETS.find((p) => p.id === "preset-sun-like-star")!.createBody({ id: "sun" }),
    radiative: { luminosityWatts: SOLAR_LUMINOSITY_W },
    ...overrides,
  };
}

function planet(id: string, distanceAu: number, overrides: Partial<SimulationBody> = {}): SimulationBody {
  const body = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({ id });
  const r = distanceAu * AU_M;
  // Circular-orbit speed for the Sun's mass, so the fixture is a bound orbit.
  const v = Math.sqrt((6.6743e-11 * SOLAR_MASS_KG) / r);
  return {
    ...body,
    position: [r, 0, 0],
    velocity: [0, v, 0],
    ...overrides,
  };
}

test("irradiance follows the inverse-square law and matches the canonical solar constant", () => {
  const star = sun();
  const earth = planet("earth", 1);
  const far = planet("far", 2);

  const atOneAu = computeBodyIrradiance(earth, [star, earth]);
  const atTwoAu = computeBodyIrradiance(far, [star, far]);

  assert.equal(atOneAu.provenance.kind, "calculated");
  assert.equal(atOneAu.sources.length, 1);

  // Solar constant: L / (4 pi (1 AU)^2) = 1361 W/m^2
  assert.ok(
    Math.abs(atOneAu.totalFluxWm2 - 1361) / 1361 < 0.01,
    `expected the canonical solar constant, got ${atOneAu.totalFluxWm2}`
  );

  const ratio = atOneAu.totalFluxWm2 / atTwoAu.totalFluxWm2;
  assert.ok(Math.abs(ratio - 4) < 1e-9, `inverse-square ratio must be exactly 4, got ${ratio}`);
});

test("multiple luminous sources contribute a summed flux", () => {
  const starA = sun({ id: "a", position: [0, 0, 0] });
  const starB = sun({ id: "b", position: [2 * AU_M, 0, 0] });
  const target = planet("target", 0.5);

  const both = computeBodyIrradiance(target, [starA, starB, target]);
  const onlyA = computeBodyIrradiance(target, [starA, target]);

  assert.equal(both.sources.length, 2);
  assert.ok(both.totalFluxWm2 > onlyA.totalFluxWm2);
  assert.ok(
    Math.abs(both.totalFluxWm2 - (onlyA.totalFluxWm2 + both.sources[1].fluxWm2)) < 1e-9,
    "total flux must be the exact sum of the contributions"
  );
});

test("irradiance reports unsupported when no luminous source exists", () => {
  const star = sun({ radiative: undefined });
  const earth = planet("earth", 1);
  const result = computeBodyIrradiance(earth, [star, earth]);
  assert.equal(result.totalFluxWm2, 0);
  assert.equal(result.provenance.kind, "unsupported");
  assert.match(result.provenance.note ?? "", /No luminous sources/);
});

test("equilibrium temperature honours albedo/emissivity boundaries and reports assumptions", () => {
  const star = sun();
  const earth = planet("earth", 1);

  // Missing albedo -> unsupported rather than a fabricated Earth value.
  const earthWithoutThermal = { ...earth, thermal: undefined };
  const noAlbedo = computeEquilibriumTemperature(earthWithoutThermal, [star, earthWithoutThermal]);
  assert.equal(noAlbedo.provenance.kind, "unsupported");
  assert.match(noAlbedo.provenance.note ?? "", /albedo unknown/);

  // Missing emissivity -> estimated, with the assumed value recorded.
  const assumed = computeEquilibriumTemperature(
    { ...earth, thermal: { albedo: 0.306 } },
    [star, { ...earth, thermal: { albedo: 0.306 } }]
  );
  assert.equal(assumed.provenance.kind, "estimated");
  assert.equal(assumed.emissivityUsed, 0.95);
  assert.match(assumed.provenance.assumptions ?? "", /Assumed emissivity/);

  // Supplied emissivity -> calculated.
  const suppliedBody = { ...earth, thermal: { albedo: 0.306, emissivity: 0.95 } };
  const calculated = computeEquilibriumTemperature(suppliedBody, [star, suppliedBody]);
  assert.equal(calculated.provenance.kind, "calculated");

  // Reference value: Earth-like Teq with A = 0.306 and eps = 0.95 is ~257 K.
  assert.ok(
    calculated.equilibriumTempK! > 250 && calculated.equilibriumTempK! < 262,
    `Earth-like equilibrium temperature out of range: ${calculated.equilibriumTempK}`
  );
  assert.ok(Math.abs(calculated.equilibriumTempC! - (calculated.equilibriumTempK! - 273.15)) < 1e-9);

  // Albedo boundaries: 0 absorbs everything, 1 reflects everything.
  const blackBody = computeEquilibriumTemperature(
    { ...earth, thermal: { albedo: 0, emissivity: 1 } },
    [star, { ...earth, thermal: { albedo: 0, emissivity: 1 } }]
  );
  const mirror = computeEquilibriumTemperature(
    { ...earth, thermal: { albedo: 1, emissivity: 1 } },
    [star, { ...earth, thermal: { albedo: 1, emissivity: 1 } }]
  );
  assert.ok(blackBody.equilibriumTempK! > mirror.equilibriumTempK!);
  assert.equal(mirror.equilibriumTempK, 0);

  // Zero incident flux -> unsupported.
  const darkStar = sun({ radiative: { luminosityWatts: 0 } });
  assert.equal(
    computeEquilibriumTemperature({ ...earth, thermal: { albedo: 0.3 } }, [darkStar, earth]).provenance.kind,
    "unsupported"
  );
});

test("Hill sphere radius for Earth around the Sun matches the reference value", () => {
  const star = sun();
  const earth = planet("earth", 1);

  const derived = computeDerivedOrbitalState(earth, [star, earth]);
  assert.ok(derived.hillRadiusM, "a Hill radius must be computed for a bound satellite");
  // Reference: r_H ~= 1.5e9 m (about 1.5 million km) for the Earth-Sun system.
  assert.ok(
    derived.hillRadiusM! > 1.4e9 && derived.hillRadiusM! < 1.6e9,
    `Earth Hill radius out of range: ${derived.hillRadiusM}`
  );

  // A satellite well inside its primary's Hill sphere must be attributed to the
  // primary. NOTE: dominance here is decided by the largest instantaneous
  // gravitational acceleration, which is a deliberate single-body criterion and
  // not a full hierarchical/tidal binding analysis.
  const closeSatellite = {
    ...PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({
      id: "close-satellite",
      position: [AU_M + 1e7, 0, 0],
      velocity: [0, 1022, 0],
    }),
    mass: 7.342e22,
  };
  const derivedClose = computeDerivedOrbitalState(closeSatellite, [star, earth, closeSatellite]);
  assert.equal(derivedClose.dominantParent?.id, "earth");

  // Earth's own state is attributed to the Sun.
  assert.equal(computeDerivedOrbitalState(earth, [star, earth]).dominantParent?.id, "sun");
});

test("orbital energy distinguishes bound and unbound trajectories", () => {
  const star = sun();

  const circular = planet("circular", 1);
  const bound = computeDerivedOrbitalState(circular, [star, circular]);
  assert.equal(bound.osculatingElements?.isBound, true);
  assert.ok(bound.osculatingElements?.periodSeconds && bound.osculatingElements.periodSeconds > 0);

  const escapee = PRESETS.find((p) => p.id === "preset-earth-like")!.createBody({
    id: "escapee",
    position: [AU_M, 0, 0],
    velocity: [0, 60000, 0], // above solar escape velocity at 1 AU (42 km/s)
  });
  const unbound = computeDerivedOrbitalState(escapee, [star, escapee]);
  assert.equal(unbound.osculatingElements?.isBound, false);
  assert.equal(unbound.osculatingElements?.periodSeconds, undefined, "unbound orbits have no period");
  assert.equal(calculateEinsteinPrecession(star.mass, escapee.mass, unbound.osculatingElements!.semiMajorAxisM, 1.4), undefined);
});

test("Roche and tidal diagnostics agree with the analytic scaling laws", () => {
  const star = sun();
  const sat = PRESETS.find((p) => p.id === "preset-asteroid")!.createBody({
    id: "sat",
    position: [2 * AU_M, 0, 0],
    velocity: [0, 0, 0],
  });

  const far = computeRocheDiagnostics(star, sat);
  const near = computeRocheDiagnostics(star, { ...sat, position: [AU_M, 0, 0] });

  assert.ok(far.fluidRocheLimitM! > far.rigidRocheLimitM!, "the fluid limit always exceeds the rigid limit");
  assert.ok(
    Math.abs(far.fluidRocheLimitM! / far.rigidRocheLimitM! - 2.44 / 1.26) < 1e-9,
    "fluid/rigid ratio must be 2.44 / 1.26"
  );

  const gradientRatio = near.tidalGradientMs2PerM / far.tidalGradientMs2PerM;
  assert.ok(Math.abs(gradientRatio - 8) < 1e-9, `tidal gradient must scale as r^-3, got ${gradientRatio}`);

  // The Roche limits depend only on the two bodies, not on their separation.
  assert.equal(far.fluidRocheLimitM, near.fluidRocheLimitM);
  assert.equal(far.isInsideFluidLimit, false);
  assert.equal(near.isInsideFluidLimit, false, "1 AU is far outside the Sun-asteroid Roche limit");

  // Inside the analytic limits the insideness flags flip.
  const insideFluid = computeRocheDiagnostics(star, { ...sat, position: [far.fluidRocheLimitM! * 0.8, 0, 0] });
  assert.equal(insideFluid.isInsideFluidLimit, true);
  assert.equal(
    insideFluid.isInsideRigidLimit,
    false,
    "0.8 x the fluid limit is still outside the (smaller) rigid limit"
  );

  const insideRigid = computeRocheDiagnostics(star, { ...sat, position: [far.rigidRocheLimitM! * 0.8, 0, 0] });
  assert.equal(insideRigid.isInsideRigidLimit, true);
  assert.equal(insideRigid.isInsideFluidLimit, true);

  // The limit sits outside the primary's surface, which is why a Roched
  // satellite disrupts without ever physically touching the primary.
  assert.ok(far.fluidRocheLimitM! > star.radius);
});

test("computeDerivedOrbitalState reports surface gravity and escape velocity from the body itself", () => {
  const star = sun({ mass: SOLAR_MASS_KG });
  const derived = computeDerivedOrbitalState(star, [star]);
  assert.ok(derived.surfaceGravityMs2 > 200 && derived.surfaceGravityMs2 < 400, `solar surface gravity ${derived.surfaceGravityMs2}`);
  assert.ok(derived.escapeVelocityMs > 500000 && derived.escapeVelocityMs < 700000, `solar escape velocity ${derived.escapeVelocityMs}`);

  const tracer: SimulationBody = {
    id: "tracer",
    name: "Tracer",
    classification: "asteroid",
    gravityRole: "tracer",
    mass: 0,
    radius: 0,
    position: [0, 0, 0],
    velocity: [0, 0, 0],
    provenance: { mass: { kind: "unsupported" }, radius: { kind: "unsupported" }, state: { kind: "custom" } },
  };
  const tracerDerived = computeDerivedOrbitalState(tracer, [star, tracer]);
  assert.equal(tracerDerived.surfaceGravityMs2, 0, "a zero-mass tracer has no surface gravity");
  assert.equal(tracerDerived.escapeVelocityMs, 0);
});

test("A planet exactly at the Earth-Sun distance sees the canonical flux, not a scaled one", () => {
  const star = sun();
  const earth = planet("earth", 1, { mass: EARTH_MASS_KG });
  const result = computeEquilibriumTemperature({ ...earth, thermal: { albedo: 0.3, emissivity: 1 } }, [star, earth]);
  // Teq = (1361 * 0.7 / (4 * 1 * sigma))^(1/4) ~= 255 K
  assert.ok(
    Math.abs(result.equilibriumTempK! - 255) < 3,
    `expected ~255 K for A=0.3 eps=1, got ${result.equilibriumTempK}`
  );
});
