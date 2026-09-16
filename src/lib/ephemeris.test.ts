import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  KEPLER_TABLE,
  dateToJ2000Days,
  tryDateToJ2000Days,
  isSupportedEphemerisDay,
  j2000DaysToDate,
  formatEpochIso,
  solveKepler,
  computeEphemerisPosition,
  computeOrbitPath,
} from "./ephemeris.ts";


describe("J2000 Ephemeris and Orbit Engine", () => {
  it("converts J2000.0 epoch exactly to 0 days", () => {
    const days = dateToJ2000Days("2000-01-01T12:00:00Z");
    assert.equal(Math.round(days), 0);
    const date = j2000DaysToDate(0);
    assert.equal(date.toISOString(), "2000-01-01T12:00:00.000Z");
  });

  it("formats ISO strings correctly", () => {
    assert.equal(formatEpochIso(0), "2000-01-01");
  });

  it("solves Kepler's equation with high precision", () => {
    const e = 0.2056; // Mercury
    const M = 1.2;
    const E = solveKepler(M, e);
    // Verify M = E - e * sin(E)
    const diff = Math.abs(M - (E - e * Math.sin(E)));
    assert.ok(diff < 1e-7, `Kepler error too large: ${diff}`);
  });

  it("contains all 8 planets plus Ceres and Pluto", () => {
    const expected = [
      "mercury",
      "venus",
      "earth",
      "mars",
      "ceres",
      "jupiter",
      "saturn",
      "uranus",
      "neptune",
      "pluto",
    ];
    for (const id of expected) {
      assert.ok(KEPLER_TABLE[id], `Missing ${id} in Kepler table`);
      assert.ok(KEPLER_TABLE[id].a > 0, `${id} semi-major axis`);
      assert.ok(KEPLER_TABLE[id].e >= 0 && KEPLER_TABLE[id].e < 1, `${id} eccentricity`);
    }
  });

  it("computes physically valid positions at J2000.0 epoch", () => {
    for (const id of Object.keys(KEPLER_TABLE)) {
      const pos = computeEphemerisPosition(id, 0, "presentation");
      assert.ok(pos, `Failed computing position for ${id}`);
      assert.ok(Number.isFinite(pos.x), `${id} x is finite`);
      assert.ok(Number.isFinite(pos.y), `${id} y is finite`);
      assert.ok(Number.isFinite(pos.z), `${id} z is finite`);
      assert.ok(pos.distanceAu > 0, `${id} distanceAu > 0`);
      assert.ok(pos.longitudeDeg >= 0 && pos.longitudeDeg <= 360, `${id} longitude in range`);
    }
  });

  it("properly scales distances in distance mode", () => {
    const earthDist = computeEphemerisPosition("earth", 0, "distance");
    assert.ok(earthDist);
    // In distance mode, 1 AU = 5.2 scene units
    const rScene = Math.hypot(earthDist.x, earthDist.y, earthDist.z);
    assert.ok(Math.abs(rScene - earthDist.distanceAu * 5.2) < 0.01);
  });

  it("generates closed 3D elliptical orbit polylines", () => {
    const pts = computeOrbitPath("mars", 0, "presentation", 100);
    assert.equal(pts.length, 101);
    // First and last point should connect (closed loop)
    const first = pts[0];
    const last = pts[pts.length - 1];
    const dist = Math.hypot(first[0] - last[0], first[1] - last[1], first[2] - last[2]);
    assert.ok(dist < 1e-4, `Orbit loop not closed: dist = ${dist}`);
  });

  it("safely handles arbitrary epoch input with tryDateToJ2000Days", () => {
    assert.equal(tryDateToJ2000Days(null), null);
    assert.equal(tryDateToJ2000Days(undefined), null);
    assert.equal(tryDateToJ2000Days("not-a-date"), null);
    assert.equal(tryDateToJ2000Days(""), null);
    assert.equal(tryDateToJ2000Days({}), null);

    const valid = tryDateToJ2000Days("2026-09-16");
    assert.ok(typeof valid === "number" && Number.isFinite(valid));
    assert.ok(valid > 9000); // 26+ years after 2000
  });

  it("accurately reports supported ephemeris day intervals (1800-2050 AD)", () => {
    assert.equal(isSupportedEphemerisDay(0), true); // 2000-01-01
    assert.equal(isSupportedEphemerisDay(-73050), true); // 1800-01-01
    assert.equal(isSupportedEphemerisDay(18628), true); // 2050-12-31
    assert.equal(isSupportedEphemerisDay(-150000), false); // ancient
    assert.equal(isSupportedEphemerisDay(100000), false); // far future
    assert.equal(isSupportedEphemerisDay(NaN), false);
  });

  it("outputs physical heliocentric AU vector and distance in science field (P2-001)", () => {
    for (const id of Object.keys(KEPLER_TABLE)) {
      const pos = computeEphemerisPosition(id, 0, "presentation");
      assert.ok(pos);
      assert.ok(pos.science, `Missing science object for ${id}`);
      assert.equal(pos.science.heliocentricAu.length, 3);
      const [xAu, yAu, zAu] = pos.science.heliocentricAu;
      const magAu = Math.hypot(xAu, yAu, zAu);
      assert.ok(Math.abs(magAu - pos.science.distanceFromSunAu) < 1e-6);
      assert.ok(Math.abs(pos.distanceAu - pos.science.distanceFromSunAu) < 1e-6);

      // Verify scene vector
      assert.deepEqual(pos.scene, [pos.x, pos.y, pos.z]);
    }
  });
});

