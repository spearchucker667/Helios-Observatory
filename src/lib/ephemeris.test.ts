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
  computeEphemerisStateVector,
  computeOrbitPath,
} from "./ephemeris.ts";
import { parseDeepLinkParams, useSim } from "./sim-store.ts";


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

    // Enforce moon-parent hierarchy (HEL-P2-004)
    assert.equal(parseDeepLinkParams("?body=jupiter&moon=europa").targetId, "europa");
    assert.equal(parseDeepLinkParams("?body=mars&moon=phobos").targetId, "phobos");
    assert.equal(parseDeepLinkParams("?body=earth&moon=moon").targetId, "moon");
    // Mismatch: Europa belongs to Jupiter, not Mars -> resolves to Mars
    assert.equal(parseDeepLinkParams("?body=mars&moon=europa").targetId, "mars");
    // Unparented moon deep link
    assert.equal(parseDeepLinkParams("?moon=titan").targetId, "titan");
    // Invalid moon falls back to valid body
    assert.equal(parseDeepLinkParams("?body=saturn&moon=not-a-moon").targetId, "saturn");
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

  it("reproduces multi-epoch reference fixtures for Earth, Mars, Jupiter, Ceres, and Pluto within tolerances", () => {
    // Pinned reference fixtures at epochs:
    // 1950-01-01T00:00:00Z (-18262.5 d), 2000-01-01T12:00:00Z (0 d), 2025-01-01T00:00:00Z (9131.5 d)
    // Major planets from Standish (1992); Ceres from JPL SBDB (#40); Pluto from Standish Table 1 resonant baseline.
    const fixtures: Record<string, Record<string, { helioAu: [number, number, number]; distAu: number }>> = {
      "1950-01-01T00:00:00Z": {
        earth: { helioAu: [-0.1827, 0.9661, 0.0001], distAu: 0.9833 },
        mars: { helioAu: [-1.3956, 0.9045, 0.0534], distAu: 1.6639 },
        jupiter: { helioAu: [3.4085, -3.7621, -0.0610], distAu: 5.0769 },
        ceres: { helioAu: [-1.5323, 2.0415, 0.3462], distAu: 2.5759 },
        pluto: { helioAu: [-26.5313, 24.2782, 5.0749], distAu: 36.3193 },
      },
      "2000-01-01T12:00:00Z": {
        earth: { helioAu: [-0.1772, 0.9672, -0.0000], distAu: 0.9833 },
        mars: { helioAu: [1.3907, -0.0134, -0.0345], distAu: 1.3912 },
        jupiter: { helioAu: [3.9983, 2.9457, -0.1017], distAu: 4.9673 },
        ceres: { helioAu: [0.8274, 2.5902, -0.0711], distAu: 2.7201 },
        pluto: { helioAu: [-9.8831, -27.9640, 5.8518], distAu: 30.2308 },
      },
      "2025-01-01T00:00:00Z": {
        earth: { helioAu: [-0.1787, 0.9669, -0.0001], distAu: 0.9833 },
        mars: { helioAu: [-0.5218, 1.5252, 0.0448], distAu: 1.6126 },
        jupiter: { helioAu: [1.0585, 4.9682, -0.0443], distAu: 5.0799 },
        ceres: { helioAu: [-1.1852, -2.4826, 0.1401], distAu: 2.7546 },
        pluto: { helioAu: [18.2182, -30.0126, -2.0586], distAu: 35.1695 },
      },
    };

    for (const [epochIso, bodies] of Object.entries(fixtures)) {
      const days = dateToJ2000Days(epochIso);
      for (const [bodyId, expected] of Object.entries(bodies)) {
        const pos = computeEphemerisPosition(bodyId, days, "presentation");
        assert.ok(pos, `Position missing for ${bodyId} at ${epochIso}`);
        assert.ok(
          Math.abs(pos.science.distanceFromSunAu - expected.distAu) < 0.02,
          `${bodyId} distance discrepancy at ${epochIso}: got ${pos.science.distanceFromSunAu}, expected ${expected.distAu}`
        );
        for (let i = 0; i < 3; i++) {
          assert.ok(
            Math.abs(pos.science.heliocentricAu[i] - expected.helioAu[i]) < 0.03,
            `${bodyId} coordinate [${i}] discrepancy at ${epochIso}: got ${pos.science.heliocentricAu[i]}, expected ${expected.helioAu[i]}`
          );
        }
      }
    }
  });

  it("verifies distinct provenance and documented accuracy tolerances for Ceres and Pluto (HEL-P1-003)", () => {
    const ceresElem = KEPLER_TABLE.ceres;
    assert.ok(ceresElem.provenance);
    assert.ok(
      ceresElem.provenance.source.includes("JPL Small-Body Database") ||
      ceresElem.provenance.source.includes("Non-Standish"),
      "Ceres must explicitly document non-Standish Table 1 SBDB provenance"
    );
    assert.ok(ceresElem.provenance.toleranceAu <= 0.05);

    const plutoElem = KEPLER_TABLE.pluto;
    assert.ok(plutoElem.provenance);
    assert.ok(
      plutoElem.provenance.source.includes("Standish (1992)") &&
      plutoElem.provenance.source.includes("resonant"),
      "Pluto must document Standish Table 1 resonant secular linear approximation"
    );
    assert.ok(plutoElem.provenance.toleranceAu <= 0.1);
  });

  it("manages selectedId and selectedRegionId state transitions (HEL-P1-004)", () => {
    const sim = useSim.getState();
    sim.select("jupiter");
    assert.equal(useSim.getState().selectedId, "jupiter");
    assert.equal(useSim.getState().selectedRegionId, null);

    sim.selectRegion("kuiper-belt");
    assert.equal(useSim.getState().selectedId, null);
    assert.equal(useSim.getState().selectedRegionId, "kuiper-belt");

    sim.select("mars");
    assert.equal(useSim.getState().selectedId, "mars");
    assert.equal(useSim.getState().selectedRegionId, null);

    sim.selectRegion("oort-cloud");
    assert.equal(useSim.getState().selectedRegionId, "oort-cloud");
    sim.resetView();
    assert.equal(useSim.getState().selectedId, null);
    assert.equal(useSim.getState().selectedRegionId, null);
  });

  it("calculates accurate state vectors with matching position and SI units", () => {
    const state = computeEphemerisStateVector("earth", 0);
    assert.ok(state);
    assert.equal(state.epochDays, 0);
    // The orbital elements are canonical, but the Cartesian state vector is
    // derived from them, so the state carries `calculated` provenance.
    assert.equal(state.provenance.kind, "calculated");
    assert.ok(state.provenance.source.length > 0);
    assert.ok(state.provenance.method.length > 0);
    assert.ok(state.position.length === 3);
    assert.ok(state.velocity.length === 3);
    
    // Test position consistency
    const pos = computeEphemerisPosition("earth", 0, "presentation");
    assert.ok(pos);
    const auToMeters = 149597870700;
    assert.ok(Math.abs(state.position[0] - pos.science.heliocentricAu[0] * auToMeters) < 1e-4);
    assert.ok(Math.abs(state.position[1] - pos.science.heliocentricAu[1] * auToMeters) < 1e-4);
    assert.ok(Math.abs(state.position[2] - pos.science.heliocentricAu[2] * auToMeters) < 1e-4);
  });

  it("calculates velocity agreeing with finite-difference derivative", () => {
    const id = "mars";
    const days = 1000;
    const dt = 1e-5;
    
    const state = computeEphemerisStateVector(id, days);
    assert.ok(state);
    
    const posMinus = computeEphemerisPosition(id, days - dt, "presentation");
    const posPlus = computeEphemerisPosition(id, days + dt, "presentation");
    assert.ok(posMinus && posPlus);
    
    const auToMeters = 149597870700;
    const secondsPerDay = 86400;
    
    for (let i = 0; i < 3; i++) {
      const v_fd_au_day = (posPlus.science.heliocentricAu[i] - posMinus.science.heliocentricAu[i]) / (2 * dt);
      const v_fd_m_s = v_fd_au_day * auToMeters / secondsPerDay;
      assert.ok(Math.abs(state.velocity[i] - v_fd_m_s) < 1.0, 
        `Velocity mismatch for ${id} coord ${i}: analytical ${state.velocity[i]}, FD ${v_fd_m_s}`);
    }
  });
});


