import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { checkDocConsistency } from "./check-doc-consistency.mjs";

describe("Documentation Consistency Verification", () => {
  test("verifies all 22 required documentation files, links, and license", () => {
    const result = checkDocConsistency();
    assert.equal(
      result.valid,
      true,
      `Expected documentation check to pass, but found errors:\n${result.errors.join("\n")}`,
    );
    assert.equal(result.docCount, 22);
  });
});
