import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  KEPLER_TABLE,
  dateToJ2000Days,
  tryDateToJ2000Days,
  trySupportedEphemerisDate,
  isSupportedEphemerisDay,
  j2000DaysToDate,
  formatEpochIso,
  solveKepler,
  computeEphemerisPosition,
  computeOrbitPath,
} from "./ephemeris.ts";
import { parseDeepLinkParams } from "./sim-store.ts";


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
    assert.equal(isSupportedEphemerisDay(-73048.5), true); // 1800-01-01T00:00:00Z
    assert.equal(isSupportedEphemerisDay(18627.0), true); // 2050-12-31T12:00:00Z
    assert.equal(isSupportedEphemerisDay(-73049.5), false); // 1799-12-31 (out of range)
    assert.equal(isSupportedEphemerisDay(18627.5), false); // 2051-01-01 (out of range)
    assert.equal(isSupportedEphemerisDay(-150000), false); // ancient
    assert.equal(isSupportedEphemerisDay(100000), false); // far future
    assert.equal(isSupportedEphemerisDay(NaN), false);
  });

  it("enforces supported date range in trySupportedEphemerisDate and deep links", () => {
    assert.equal(trySupportedEphemerisDate("1799-12-31"), null);
    assert.equal(trySupportedEphemerisDate("1800-01-01"), -73048.5);
    assert.equal(trySupportedEphemerisDate("2050-12-31"), 18626.5);
    assert.equal(trySupportedEphemerisDate("2051-01-01"), null);
    assert.equal(trySupportedEphemerisDate("invalid-date"), null);

    // parseDeepLinkParams integration
    assert.equal(parseDeepLinkParams("?date=1800-01-01").date, "1800-01-01");
    assert.equal(parseDeepLinkParams("?date=2050-12-31").date, "2050-12-31");
    assert.equal(parseDeepLinkParams("?date=1799-12-31").date, undefined);
    assert.equal(parseDeepLinkParams("?date=2051-01-01").date, undefined);
    assert.equal(parseDeepLinkParams("?date=not-a-date").date, undefined);
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

  it("reproduces multi-epoch reference fixtures for Earth, Mars, and Jupiter within tolerances", () => {
    // Pinned reference fixtures derived from Standish (1992) analytical formulation
    // at epochs: 1950-01-01T00:00:00Z (-18262.5 d), 2000-01-01T12:00:00Z (0 d), 2025-01-01T00:00:00Z (9131.5 d)
    const fixtures: Record<string, Record<string, { helioAu: [number, number, number]; distAu: number }>> = {
      "1950-01-01T00:00:00Z": {
        earth: { helioAu: [-0.1827, 0.9661, 0.0001], distAu: 0.9833 },
        mars: { helioAu: [-1.3956, 0.9045, 0.0534], distAu: 1.6639 },
        jupiter: { helioAu: [3.4085, -3.7621, -0.0610], distAu: 5.0769 },
      },
      "2000-01-01T12:00:00Z": {
        earth: { helioAu: [-0.1772, 0.9672, -0.0000], distAu: 0.9833 },
        mars: { helioAu: [1.3907, -0.0134, -0.0345], distAu: 1.3912 },
        jupiter: { helioAu: [3.9983, 2.9457, -0.1017], distAu: 4.9673 },
      },
      "2025-01-01T00:00:00Z": {
        earth: { helioAu: [-0.1787, 0.9669, -0.0001], distAu: 0.9833 },
        mars: { helioAu: [-0.5218, 1.5252, 0.0448], distAu: 1.6126 },
        jupiter: { helioAu: [1.0585, 4.9682, -0.0443], distAu: 5.0799 },
      },
    };

    for (const [epochIso, bodies] of Object.entries(fixtures)) {
      const days = dateToJ2000Days(epochIso);
      for (const [bodyId, expected] of Object.entries(bodies)) {
        const pos = computeEphemerisPosition(bodyId, days, "presentation");
        assert.ok(pos, `Position missing for ${bodyId} at ${epochIso}`);
        assert.ok(
          Math.abs(pos.science.distanceFromSunAu - expected.distAu) < 0.01,
          `${bodyId} distance discrepancy at ${epochIso}: got ${pos.science.distanceFromSunAu}, expected ${expected.distAu}`
        );
        for (let i = 0; i < 3; i++) {
          assert.ok(
            Math.abs(pos.science.heliocentricAu[i] - expected.helioAu[i]) < 0.02,
            `${bodyId} coordinate [${i}] discrepancy at ${epochIso}: got ${pos.science.heliocentricAu[i]}, expected ${expected.helioAu[i]}`
          );
        }
      }
    }
  });
});

