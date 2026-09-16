import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { validateAssetManifest } from "./validate-assets.mjs";

describe("Vector Assets & Manifest Validation", () => {
  test("validates all registered vector assets on disk", () => {
    const result = validateAssetManifest();
    assert.equal(
      result.valid,
      true,
      `Expected asset validation to pass, but received errors:\n${result.errors.join("\n")}`,
    );
    assert.ok(result.assetCount >= 8, `Expected at least 8 assets, got ${result.assetCount}`);
  });
});
