#!/usr/bin/env node
/**
 * Simulation test-integrity guard.
 *
 * The sandbox once shipped suites whose only assertion was `assert.ok(true)`.
 * That is worse than no test: it reports coverage while verifying nothing. This
 * guard rejects, across every simulation test file:
 *
 *   1. trivially-true assertions (`assert.ok(true)`, `assert.equal(1, 1)`, …)
 *   2. test bodies with no assertion at all
 *   3. tests whose assertions are all conditional (every `assert` nested inside
 *      an `if`) — a test that can pass without executing a single check
 *   4. `todo` / `skip` markers used to park unresolved work
 *
 * It is wired into `npm test` and into hosted CI.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const TESTS_DIR = path.join(ROOT_DIR, "src", "simulation", "tests");

/** Assertions that are unconditionally true regardless of the code under test. */
const TRIVIAL_ASSERTION_PATTERNS = [
  /assert\.(ok|strictOk)\(\s*true\s*[,)]/,
  /assert\.(ok|strictOk)\(\s*1\s*[,)]/,
  /assert\.equal\(\s*1\s*,\s*1\s*\)/,
  /assert\.equal\(\s*(true|false)\s*,\s*\1\s*\)/,
  /assert\.strictEqual\(\s*1\s*,\s*1\s*\)/,
  /assert\.(ok|strictOk)\(\s*[A-Za-z_$][\w$.]*\s*!==\s*undefined\s*\|\|\s*true\s*[,)]/,
  /assert\.notEqual\(\s*1\s*,\s*2\s*\)/,
];

const SKIP_MARKERS = [
  /\btest\.skip\(/,
  /\btest\.todo\(/,
  /\bdescribe\.skip\(/,
  /\bit\.skip\(/,
];

/** Splits a test file into top-level `test(...)` bodies with their line numbers. */
export function extractTestBodies(source) {
  const tests = [];
  const marker = /\btest\(\s*(?:"([^"]*)"|'([^']*)'|`([^`]*)`)/g;
  let match;
  while ((match = marker.exec(source)) !== null) {
    const name = match[1] ?? match[2] ?? match[3] ?? "(unnamed test)";
    const bodyStart = source.indexOf("{", marker.lastIndex);
    if (bodyStart === -1) continue;

    let depth = 0;
    let index = bodyStart;
    for (; index < source.length; index++) {
      const char = source[index];
      if (char === "{") depth++;
      else if (char === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    const body = source.slice(bodyStart, index + 1);
    const line = source.slice(0, match.index).split("\n").length;
    tests.push({ name, line, body });
  }
  return tests;
}

/** True when every assert call in the body sits inside a conditional block. */
function allAssertionsConditional(body) {
  const lines = body.split("\n");
  const assertLines = [];
  lines.forEach((line, idx) => {
    if (/\bassert\.[A-Za-z]+\(/.test(line)) assertLines.push(idx);
  });
  if (assertLines.length === 0) return false;

  return assertLines.every((assertLine) => {
    let depth = 0;
    for (let i = assertLine; i >= 0; i--) {
      const line = lines[i];
      // Walk backwards: an `if (...) {` with the brace still open means the
      // assertion is conditionally reached.
      depth += (line.match(/\}/g) || []).length;
      depth -= (line.match(/\{/g) || []).length;
      if (/\bif\s*\(/.test(line) && depth < 0) return true;
      if (i === assertLine && /\}\s*else\b/.test(line)) return true;
      depth = Math.max(depth, 0);
    }
    return false;
  });
}

export function checkTestIntegrity({ testsDir = TESTS_DIR } = {}) {
  const errors = [];
  if (!fs.existsSync(testsDir)) {
    return { valid: false, errors: [`Simulation test directory missing: ${testsDir}`], testCount: 0 };
  }

  const files = fs
    .readdirSync(testsDir)
    .filter((f) => f.endsWith(".test.ts"))
    .sort();

  let testCount = 0;
  for (const file of files) {
    const full = path.join(testsDir, file);
    const source = fs.readFileSync(full, "utf-8");
    const tests = extractTestBodies(source);
    if (tests.length === 0) {
      errors.push(`${file}: contains no test() declarations`);
      continue;
    }

    for (const test of tests) {
      testCount++;
      for (const pattern of TRIVIAL_ASSERTION_PATTERNS) {
        if (pattern.test(test.body)) {
          errors.push(
            `${file}:${test.line}: "${test.name}" uses a trivially-true assertion (${pattern})`
          );
          break;
        }
      }

      const assertionCount = (test.body.match(/\bassert\.[A-Za-z]+\(/g) || []).length;
      if (assertionCount === 0) {
        errors.push(`${file}:${test.line}: "${test.name}" contains no assertion`);
        continue;
      }
      if (allAssertionsConditional(test.body)) {
        errors.push(
          `${file}:${test.line}: "${test.name}" only asserts inside conditionals — it can pass without checking anything`
        );
      }
    }

    for (const marker of SKIP_MARKERS) {
      if (marker.test(source)) {
        const line = source.split("\n").findIndex((l) => marker.test(l)) + 1;
        errors.push(`${file}:${line}: skipped/todo test marker is not accepted in the sandbox suites`);
      }
    }
  }

  return { valid: errors.length === 0, errors, testCount, fileCount: files.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkTestIntegrity();
  if (!result.valid) {
    console.error("Simulation test-integrity check failed:");
    for (const err of result.errors) console.error(` - ${err}`);
    process.exit(1);
  }
  console.log(
    `Simulation test integrity verified: ${result.testCount} tests across ${result.fileCount} files contain real assertions.`
  );
}
