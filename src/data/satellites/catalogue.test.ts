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
import { SOURCES } from "../sources.ts";

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

  it("reconciles fidelity counts deterministically to 461 objects", () => {
    const meta = SATELLITE_METADATA as {
      totalAll: number;
      fidelityCounts: { major: number; regular: number; irregular: number };
    };
    assert.ok(meta.fidelityCounts);
    assert.equal(meta.fidelityCounts.major, 21);
    assert.equal(meta.fidelityCounts.regular, 38);
    assert.equal(meta.fidelityCounts.irregular, 402);
    assert.equal(
      meta.fidelityCounts.major + meta.fidelityCounts.regular + meta.fidelityCounts.irregular,
      meta.totalAll,
    );
    assert.equal(meta.totalAll, SATELLITES.length);
  });

  it("verifies all 461 satellites reference valid sources and ISO asOf dates", () => {
    const validParents = new Set(["earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]);
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    for (const s of SATELLITES) {
      assert.ok(validParents.has(s.parentId), `${s.id}: parent ${s.parentId} must be valid planet/pluto`);
      assert.ok(s.sourceIds.length > 0, `${s.id}: must have at least one source`);
      for (const src of s.sourceIds) {
        assert.ok(SOURCES[src], `${s.id}: source ${src} must resolve in SOURCES registry`);
      }
      assert.match(s.asOf, isoDateRegex, `${s.id}: asOf must be valid ISO yyyy-mm-dd`);
      assert.ok(s.asOf <= "2026-09-16", `${s.id}: asOf date cannot be in the future`);
    }
  });

  it("rejects fabricated scientific constants for sparse irregular satellites", () => {
    const irregular = anyMoonById("s-2003-j-2");
    assert.ok(irregular);
    assert.equal(irregular.identity.kind, "moon");
    assert.equal(irregular.tier, 3, "Irregular satellite must map to Tier 3");
    assert.equal(irregular.identity.category, "Minor moon");
    assert.equal(irregular.fidelity, "irregular");

    // Scientific integrity: unmeasured quantities must remain undefined
    assert.equal(irregular.physical.gravityG, undefined, "gravityG must NOT be a magic constant");
    assert.equal(irregular.physical.escapeVelocityKmS, undefined, "escape velocity must NOT be a magic constant");
    assert.equal(irregular.physical.densityGCm3, undefined, "density must NOT be a magic constant");
    assert.equal(irregular.rotation.periodHours, undefined, "rotation period must NOT be fabricated from orbit");
    assert.equal(irregular.rotation.axialTiltDeg, undefined, "axial tilt must NOT be arbitrarily set to 0");
    assert.equal(irregular.temperature.meanC, undefined, "temperature must NOT be arbitrarily set to -180");
  });

  it("correctly maps regular non-curated satellites to Tier 2", () => {
    const regular = anyMoonById("metis");
    assert.ok(regular);
    assert.equal(regular.tier, 2, "Metis (regular satellite) must map to Tier 2");
    assert.equal(regular.identity.category, "Moon");
    assert.equal(regular.fidelity, "regular");
  });
});
