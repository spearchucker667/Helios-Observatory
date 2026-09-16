import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateData } from "./validate.ts";
import { BODIES, MOONS, EVENTS, MISSIONS, SOURCES, moonsOf, bodyById } from "./registry.ts";

describe("astronomical data integrity", () => {
  const issues = validateData();
  const errors = issues.filter((i) => i.kind === "error");

  it("validates with zero errors", () => {
    assert.deepEqual(errors, [], `data errors:\n${errors.map((e) => e.message).join("\n")}`);
  });

  it("has unique body ids", () => {
    const ids = [...BODIES, ...MOONS].map((b) => b.identity.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("has 11 core bodies (sun + 8 planets + 2 dwarf planets)", () => {
    assert.equal(BODIES.length, 11);
    assert.equal(BODIES[0].identity.kind, "star");
    assert.equal(BODIES.filter((b) => b.identity.kind === "planet").length, 8);
    assert.equal(BODIES.filter((b) => b.identity.kind === "dwarf-planet").length, 2);
  });

  it("has all 21 curated tier-1 moons selectable", () => {
    const expected = [
      "moon", "phobos", "deimos", "io", "europa", "ganymede", "callisto",
      "titan", "enceladus", "rhea", "iapetus", "dione", "tethys", "mimas",
      "titania", "oberon", "ariel", "umbriel", "miranda", "triton", "charon",
    ];
    assert.deepEqual(
      MOONS.map((m) => m.identity.id).sort(),
      [...expected].sort(),
    );
  });


  it("moons reference valid parents", () => {
    for (const m of MOONS) {
      const parent = bodyById(m.identity.parentId);
      assert.ok(parent, `moon ${m.identity.id} parent missing`);
      assert.ok(
        parent.identity.kind === "planet" || parent.identity.kind === "dwarf-planet",
        `moon ${m.identity.id} parent is not a planet or dwarf planet`,
      );
    }
  });

  it("planets and dwarf planets reference the sun as parent", () => {
    for (const p of BODIES.filter((b) => b.identity.kind === "planet" || b.identity.kind === "dwarf-planet")) {
      assert.equal(p.identity.parentId, "sun");
    }
  });

  it("all radii, periods and gravities are positive", () => {
    for (const b of [...BODIES, ...MOONS]) {
      assert.ok(b.physical.meanRadiusKm > 0, `${b.identity.id} radius`);
      assert.ok(b.physical.gravityG > 0, `${b.identity.id} gravity`);
      assert.ok(b.physical.densityGCm3 > 0, `${b.identity.id} density`);
      assert.ok(b.orbit ? b.orbit.periodDays > 0 : true, `${b.identity.id} period`);
      assert.ok(b.rotation.periodHours !== 0, `${b.identity.id} rotation`);
    }
  });

  it("every source citation resolves to the registry", () => {
    for (const b of [...BODIES, ...MOONS]) {
      for (const s of b.sources) {
        assert.ok(SOURCES[s.id], `body ${b.identity.id} cites unknown source ${s.id}`);
      }
    }
    for (const e of EVENTS) {
      for (const sid of e.sourceIds) {
        assert.ok(SOURCES[sid], `event ${e.id} cites unknown source ${sid}`);
      }
    }
    for (const m of MISSIONS) {
      for (const sid of m.sourceIds) {
        assert.ok(SOURCES[sid], `mission ${m.id} cites unknown source ${sid}`);
      }
    }
  });

  it("has unique event ids", () => {
    const ids = EVENTS.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("every event references at least one known body", () => {
    for (const e of EVENTS) {
      assert.ok(e.bodyIds.length >= 1, `event ${e.id} has no bodies`);
      for (const id of e.bodyIds) {
        assert.ok(bodyById(id), `event ${e.id} references unknown body ${id}`);
      }
    }
  });

  it("mission body references resolve", () => {
    for (const m of MISSIONS) {
      for (const id of m.bodyIds) {
        assert.ok(bodyById(id), `mission ${m.id} references unknown body ${id}`);
      }
    }
  });

  it("every moon count event body has a moonSystem tally", () => {
    for (const p of BODIES) {
      const kids = moonsOf(p.identity.id);
      if (kids.length > 0) {
        assert.ok(p.moonSystem, `${p.identity.id} has moons but no moonSystem record`);
        assert.ok(p.moonSystem.confirmedCount >= kids.length, `${p.identity.id} confirmedCount below rendered moons`);
      }
    }
  });

  it("temperature means are physically plausible", () => {
    for (const b of [...BODIES, ...MOONS]) {
      assert.ok(b.temperature.meanC > -300 && b.temperature.meanC < 6000, `${b.identity.id} meanC`);
    }
  });
});
