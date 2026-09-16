import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SATELLITES,
  SATELLITE_METADATA,
  satellitesOf,
  satelliteById,
  satelliteCountOf,
  anyMoonById,
  MOONS,
} from "./index.ts";

describe("Natural Satellite Catalogue", () => {
  it("contains the complete pinned planetary satellite snapshot (456 planetary + 5 Pluto = 461 total)", () => {
    assert.equal(satellitesOf("earth").length, 1);
    assert.equal(satellitesOf("mars").length, 2);
    assert.equal(satellitesOf("jupiter").length, 115);
    assert.equal(satellitesOf("saturn").length, 293);
    assert.equal(satellitesOf("uranus").length, 29);
    assert.equal(satellitesOf("neptune").length, 16);
    assert.equal(satellitesOf("pluto").length, 5);
    assert.equal(SATELLITES.length, 461);
    assert.equal(SATELLITE_METADATA.totalPlanetary, 456);
    assert.equal(SATELLITE_METADATA.totalAll, 461);
  });

  it("retains rich detail for the curated major moons", () => {
    assert.ok(MOONS.length >= 20);
    const moonIds = new Set(MOONS.map((m) => m.identity.id));
    assert.ok(moonIds.has("moon"));
    assert.ok(moonIds.has("phobos"));
    assert.ok(moonIds.has("io"));
    assert.ok(moonIds.has("europa"));
    assert.ok(moonIds.has("titan"));
    assert.ok(moonIds.has("triton"));
    assert.ok(moonIds.has("charon"));
  });

  it("ensures all satellite IDs are unique", () => {
    const seen = new Set<string>();
    for (const s of SATELLITES) {
      assert.ok(!seen.has(s.id), `Duplicate ID found: ${s.id}`);
      seen.add(s.id);
    }
  });

  it("verifies orbital physics sanity across all 461 satellites", () => {
    for (const s of SATELLITES) {
      assert.ok(s.orbit.semiMajorAxisKm > 0, `${s.id}: semi-major axis must be positive`);
      assert.ok(s.orbit.periodDays > 0, `${s.id}: orbital period must be positive`);
      assert.ok(s.orbit.eccentricity >= 0 && s.orbit.eccentricity < 1, `${s.id}: eccentricity must be in [0, 1)`);
      assert.ok(s.orbit.inclinationDeg >= 0 && s.orbit.inclinationDeg <= 180, `${s.id}: inclination must be in [0, 180]`);
      assert.equal(s.orbit.retrograde, s.orbit.inclinationDeg > 90, `${s.id}: retrograde flag must match inclination > 90°`);
    }
  });

  it("provides reliable lookups by id and parent", () => {
    const europa = satelliteById("europa");
    assert.ok(europa);
    assert.equal(europa.parentId, "jupiter");
    assert.equal(europa.fidelity, "major");

    assert.equal(satelliteCountOf("jupiter"), 115);
    assert.equal(satelliteCountOf("saturn"), 293);
    assert.equal(satelliteCountOf("uranus"), 29);
    assert.equal(satelliteCountOf("neptune"), 16);
    assert.equal(satelliteCountOf("mercury"), 0);
  });

  it("synthesizes valid MoonBody records for irregular satellites", () => {
    const irregular = anyMoonById("s-2003-j-2");
    assert.ok(irregular);
    assert.equal(irregular.identity.kind, "moon");
    assert.ok(irregular.orbit);
    assert.ok(irregular.orbit.periodDays > 0);
    assert.ok(irregular.physical.diameterKm && irregular.physical.diameterKm > 0);

  });
});
