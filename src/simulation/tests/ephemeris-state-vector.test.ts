import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeEphemerisPosition,
  computeEphemerisStateVector,
  isSupportedEphemerisDay,
  EPHEMERIS_MIN_DAYS,
  EPHEMERIS_MAX_DAYS,
} from "../../lib/ephemeris.ts";

const AU_M = 149597870700;
const DAY_S = 86400;
const FD_STEP_DAYS = 0.01;

/** Measured on this build: worst per-component error / |v| = 3.4e-4, worst speed error 3.6e-4. */
const SPEED_RELATIVE_TOLERANCE = 1e-3;
const COMPONENT_OVER_SPEED_TOLERANCE = 1e-3;

const VALIDATION_BODIES = ["mercury", "earth", "mars", "jupiter", "ceres", "pluto"] as const;
const VALIDATION_EPOCHS: Array<{ label: string; days: number }> = [
  { label: "1800 boundary", days: EPHEMERIS_MIN_DAYS },
  { label: "J2000", days: 0 },
  { label: "2026", days: 9557 },
  { label: "2050 boundary", days: EPHEMERIS_MAX_DAYS },
];

test("analytical ephemeris velocity agrees with the finite difference of the full position model", (t) => {
  let worstComponentOverSpeed = 0;
  let worstSpeedRelative = 0;

  for (const bodyId of VALIDATION_BODIES) {
    for (const epoch of VALIDATION_EPOCHS) {
      const state = computeEphemerisStateVector(bodyId, epoch.days);
      assert.ok(state, `${bodyId} must have a state vector at ${epoch.label}`);
      assert.ok(isSupportedEphemerisDay(epoch.days));

      const forward = computeEphemerisPosition(bodyId, epoch.days + FD_STEP_DAYS, "distance");
      const backward = computeEphemerisPosition(bodyId, epoch.days - FD_STEP_DAYS, "distance");
      assert.ok(forward && backward, `${bodyId} must expose heliocentric positions at ${epoch.label}`);

      const finiteDifference = [0, 1, 2].map((i) => {
        const deltaAu = forward.science.heliocentricAu[i] - backward.science.heliocentricAu[i];
        return (deltaAu * AU_M) / (2 * FD_STEP_DAYS * DAY_S);
      });

      const speed = Math.hypot(state.velocity[0], state.velocity[1], state.velocity[2]);
      assert.ok(speed > 0, `${bodyId} must have a non-zero speed`);

      for (let i = 0; i < 3; i++) {
        const componentError = Math.abs(finiteDifference[i] - state.velocity[i]) / speed;
        worstComponentOverSpeed = Math.max(worstComponentOverSpeed, componentError);
        assert.ok(
          componentError <= COMPONENT_OVER_SPEED_TOLERANCE,
          `${bodyId} @ ${epoch.label}: velocity component ${i} differs from the finite difference by ${componentError.toExponential(3)} of the speed`
        );
      }

      const differenceSpeed = Math.hypot(finiteDifference[0], finiteDifference[1], finiteDifference[2]);
      const speedRelative = Math.abs(differenceSpeed - speed) / speed;
      worstSpeedRelative = Math.max(worstSpeedRelative, speedRelative);
      assert.ok(
        speedRelative <= SPEED_RELATIVE_TOLERANCE,
        `${bodyId} @ ${epoch.label}: speed differs by ${speedRelative.toExponential(3)}`
      );
    }
  }

  t.diagnostic(
    `max per-component error / |v| = ${worstComponentOverSpeed.toExponential(3)}; ` +
      `max speed relative error = ${worstSpeedRelative.toExponential(3)}`
  );
});

test("ephemeris state vectors are finite and inside the documented position tolerances", () => {
  for (const bodyId of VALIDATION_BODIES) {
    for (const epoch of VALIDATION_EPOCHS) {
      const state = computeEphemerisStateVector(bodyId, epoch.days)!;
      assert.ok(state.position.every(Number.isFinite), `${bodyId} position must be finite`);
      assert.ok(state.velocity.every(Number.isFinite), `${bodyId} velocity must be finite`);
      assert.equal(state.provenance.kind, "calculated");
      assert.ok(state.provenance.source.length > 0);
      assert.ok(state.provenance.authority.length > 0);
    }
  }
});

test("unsupported epochs return no state vector instead of extrapolating", () => {
  assert.equal(computeEphemerisStateVector("earth", EPHEMERIS_MIN_DAYS - 1), null);
  assert.equal(computeEphemerisStateVector("earth", EPHEMERIS_MAX_DAYS + 1), null);
  assert.equal(computeEphemerisStateVector("earth", Number.NaN), null);
  assert.equal(computeEphemerisStateVector("not-a-body", 0), null);
});
