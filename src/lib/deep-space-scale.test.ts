import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  auToDeepSpaceRadius,
  deepSpaceRadiusToAu,
  isOortCloudAu,
  isKuiperBeltAu,
  NEPTUNE_AU,
  NEPTUNE_SCENE_R,
  OORT_CLOUD_INNER_MIN_AU,
  OORT_CLOUD_OUTER_AU,
} from "./deep-space-scale.ts";

describe("Deep Space Coordinate Scale", () => {
  it("matches zero at origin", () => {
    assert.equal(auToDeepSpaceRadius(0), 0);
    assert.equal(deepSpaceRadiusToAu(0), 0);
  });

  it("is continuous at Neptune boundary (30 AU)", () => {
    const rAtBoundary = auToDeepSpaceRadius(NEPTUNE_AU);
    assert.ok(Math.abs(rAtBoundary - NEPTUNE_SCENE_R) < 1e-6);
  });

  it("is strictly monotonically increasing from 0 to 150,000 AU", () => {
    const samples = [0, 1, 5, 10, 30, 40, 50, 100, 1000, 2000, 10000, 50000, 100000];
    for (let i = 0; i < samples.length - 1; i++) {
      const r1 = auToDeepSpaceRadius(samples[i]);
      const r2 = auToDeepSpaceRadius(samples[i + 1]);
      assert.ok(r2 > r1, `Failed monotonicity between ${samples[i]} and ${samples[i + 1]}`);
    }
  });

  it("inverts accurately across all domains", () => {
    const testDistances = [0.1, 1.0, 5.2, 9.5, 30.0, 42.0, 100.0, 2500.0, 50000.0, 100000.0];
    for (const au of testDistances) {
      const r = auToDeepSpaceRadius(au);
      const invertedAu = deepSpaceRadiusToAu(r);
      assert.ok(
        Math.abs(invertedAu - au) / au < 1e-5,
        `Inversion error at ${au} AU: got ${invertedAu}`,
      );
    }
  });

  it("correctly identifies Kuiper Belt and Oort Cloud domains", () => {
    assert.equal(isKuiperBeltAu(35), true);
    assert.equal(isKuiperBeltAu(10), false);
    assert.equal(isKuiperBeltAu(100), false);

    assert.equal(isOortCloudAu(OORT_CLOUD_INNER_MIN_AU), true);
    assert.equal(isOortCloudAu(50000), true);
    assert.equal(isOortCloudAu(OORT_CLOUD_OUTER_AU), true);
    assert.equal(isOortCloudAu(500), false);
    assert.equal(isOortCloudAu(150000), false);
  });

  it("keeps 100,000 AU outer Oort Cloud within reasonable scene bounds (~240-250)", () => {
    const rOuter = auToDeepSpaceRadius(100000);
    assert.ok(rOuter > 220 && rOuter < 260, `Outer radius out of bounds: ${rOuter}`);
  });
});
