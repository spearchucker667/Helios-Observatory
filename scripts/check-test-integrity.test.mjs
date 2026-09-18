import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkTestIntegrity, extractTestBodies } from "./check-test-integrity.mjs";

function withTempSuite(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "helios-integrity-"));
  for (const [name, source] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), source, "utf-8");
  }
  return dir;
}

test("extractTestBodies finds every declared test with real bodies", () => {
  const source = [
    'import { test } from "node:test";',
    'test("first", () => {',
    "  assert.ok(1 === 1);",
    "});",
    'test("second", () => {',
    "  assert.equal(2, 2);",
    "});",
  ].join("\n");

  const tests = extractTestBodies(source);
  assert.equal(tests.length, 2);
  assert.deepEqual(
    tests.map((t) => t.name),
    ["first", "second"]
  );
});

test("the guard rejects a trivially-true assertion", () => {
  const dir = withTempSuite({
    "placeholder.test.ts": 'test("placeholder", () => {\n  assert.ok(true);\n});\n',
  });
  const result = checkTestIntegrity({ testsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((e) => e.includes("trivially-true")),
    `expected a trivially-true error, got ${JSON.stringify(result.errors)}`
  );
});

test("the guard rejects a test with no assertion", () => {
  const dir = withTempSuite({
    "empty.test.ts": 'test("does nothing", () => {\n  const value = 4;\n  void value;\n});\n',
  });
  const result = checkTestIntegrity({ testsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("no assertion")));
});

test("the guard rejects assertions that are all conditional", () => {
  const dir = withTempSuite({
    "conditional.test.ts": [
      'test("maybe", () => {',
      "  const optional = undefined;",
      "  if (optional) {",
      "    assert.equal(optional, 1);",
      "  }",
      "});",
    ].join("\n"),
  });
  const result = checkTestIntegrity({ testsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("only asserts inside conditionals")));
});

test("the guard rejects skipped tests", () => {
  const dir = withTempSuite({
    "skipped.test.ts": 'test.skip("later", () => {\n  assert.ok(true);\n});\n',
  });
  const result = checkTestIntegrity({ testsDir: dir });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("skipped")));
});

test("the guard accepts an unconditional numerical assertion", () => {
  const dir = withTempSuite({
    "real.test.ts": [
      'test("real", () => {',
      "  const energy = 0.5 * 2 * 3 * 3;",
      "  assert.equal(energy, 9);",
      "  assert.ok(Number.isFinite(energy));",
      "});",
    ].join("\n"),
  });
  const result = checkTestIntegrity({ testsDir: dir });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.testCount, 1);
});

test("the shipped simulation suites pass the guard", () => {
  const result = checkTestIntegrity();
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.ok(result.testCount > 50, `expected a meaningful test count, got ${result.testCount}`);
});
