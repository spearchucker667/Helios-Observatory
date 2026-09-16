import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getBodyHeliocentricAu,
  calculateDistance,
  formatLightTime,
  KM_PER_AU,
  SPEED_OF_LIGHT_KM_S,
} from "./measurement.ts";

describe("Scientific Distance Measurement Engine", () => {
  it("verifies canonical physical constants", () => {
    assert.equal(KM_PER_AU, 149597870.7);
    assert.equal(SPEED_OF_LIGHT_KM_S, 299792.458);
  });

  it("resolves the Sun at coordinate origin [0, 0, 0]", () => {
    const sunPos = getBodyHeliocentricAu("sun", 0);
    assert.deepEqual(sunPos, [0, 0, 0]);
  });

  it("calculates Earth-Sun distance at J2000.0 close to 1 AU (~8.3 light minutes)", () => {
    const res = calculateDistance("sun", "earth", 0);
    assert.ok(res);
    assert.ok(Math.abs(res.distanceAu - 1.0) < 0.03, `Distance AU: ${res.distanceAu}`);
    // Light travels 1 AU in ~499 seconds (~8.3 minutes)
    assert.ok(
      Math.abs(res.lightTimeSeconds - 499) < 20,
      `Light time: ${res.lightTimeSeconds} s`,
    );
    assert.ok(res.formattedLightTime.includes("8m"));
  });

  it("returns zero distance when measuring body against itself", () => {
    const res = calculateDistance("mars", "mars", 0);
    assert.ok(res);
    assert.equal(res.distanceAu, 0);
    assert.equal(res.distanceKm, 0);
    assert.equal(res.lightTimeSeconds, 0);
  });

  it("calculates symmetrical distances (A to B equals B to A)", () => {
    const ab = calculateDistance("earth", "jupiter", 100);
    const ba = calculateDistance("jupiter", "earth", 100);
    assert.ok(ab && ba);
    assert.ok(Math.abs(ab.distanceAu - ba.distanceAu) < 1e-9);
    assert.ok(Math.abs(ab.distanceKm - ba.distanceKm) < 1e-4);
  });

  it("measures distances to natural satellites (Moon from Earth)", () => {
    const res = calculateDistance("earth", "moon", 0);
    assert.ok(res);
    // Lunar distance is ~384,400 km
    assert.ok(
      Math.abs(res.distanceKm - 384400) < 50000,
      `Expected lunar distance, got ${res.distanceKm}`,
    );
    // Light travel time is ~1.28 seconds
    assert.ok(res.lightTimeSeconds > 1.0 && res.lightTimeSeconds < 1.6);
  });

  it("formats light travel time cleanly across magnitudes", () => {
    assert.equal(formatLightTime(0.5), "0.50 s");
    assert.equal(formatLightTime(75.5), "1m 15.5s");
    assert.equal(formatLightTime(3660), "1h 1m");
    assert.equal(formatLightTime(18000), "5h 0m");
  });
});
