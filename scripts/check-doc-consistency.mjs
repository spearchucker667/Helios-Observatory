#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const DOCS_DIR = path.join(ROOT_DIR, "docs");

export const REQUIRED_DOCS = [
  "ACCESSIBILITY.md",
  "ARCHITECTURE.md",
  "ASSET_ATTRIBUTION.md",
  "ASSET_PIPELINE.md",
  "ASTRONOMICAL_DATA.md",
  "CONTROLS.md",
  "DEEP_SPACE_SCALE.md",
  "DEVELOPMENT.md",
  "EPHEMERIS_ENGINE.md",
  "INSTALLATION.md",
  "LEGAL.md",
  "MEASUREMENT_SYSTEM.md",
  "PERFORMANCE.md",
  "PHYSICS_ENGINE.md",
  "RELEASE_PROCESS.md",
  "ROADMAP.md",
  "SATELLITE_CATALOGUE.md",
  "SCREENSHOTS.md",
  "SECURITY_POLICY.md",
  "SIMULATION_SANDBOX.md",
  "TESTING.md",
  "THIRD_PARTY_NOTICES.md",
  "TROUBLESHOOTING.md",
  "USER_GUIDE.md",
];

export const REQUIRED_ROOT_DOCS = [
  "README.md",
  "LICENSE",
  "NOTICE",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "CODE_OF_CONDUCT.md",
];

/**
 * Derived, single-source-of-truth test inventory.
 *
 * Counts are derived from the repository (declared `test(...)` cases in every
 * suite file) rather than maintained by hand. Documentation is not allowed to
 * hardcode these numbers, because a hand-maintained count drifts: this repo
 * previously claimed 154, 156 and 159 simultaneously.
 */
export function deriveTestInventory() {
  const pkgPath = path.join(ROOT_DIR, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  const testScript = pkg.scripts?.test ?? "";

  const suites = [];
  const unregistered = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", ".output", "build"].includes(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!/\.test\.(mjs|ts)$/.test(entry.name)) continue;
      const relative = path.relative(ROOT_DIR, full).split(path.sep).join("/");
      const isScriptSuite = relative.startsWith("scripts/");
      // Every suite must be executed by `npm test`; otherwise it is dead weight
      // that silently protects nothing.
      const directory = relative.split("/").slice(0, -1).join("/");
      if (!isScriptSuite && !testScript.includes(relative) && !testScript.includes(`${directory}/*.test.ts`)) {
        unregistered.push(relative);
      }
      const source = fs.readFileSync(full, "utf-8");
      // Line-anchored declarations only: matches inside string literals (for
      // example a guard test that embeds sample suites) must not be counted.
      const declarations = (source.match(/^[ \t]*(?:test|it)\(/gm) || []).length;
      suites.push({ file: relative, tests: declarations, simulation: relative.startsWith("src/simulation/") });
    }
  }

  walk(ROOT_DIR);

  return {
    testCount: suites.reduce((sum, s) => sum + s.tests, 0),
    suiteCount: suites.length,
    simulationTestCount: suites.filter((s) => s.simulation).reduce((sum, s) => sum + s.tests, 0),
    simulationSuiteCount: suites.filter((s) => s.simulation).length,
    unregistered,
  };
}

export function checkDocConsistency() {
  const errors = [];

  // 1. Verify required root files
  for (const rootFile of REQUIRED_ROOT_DOCS) {
    const full = path.join(ROOT_DIR, rootFile);
    if (!fs.existsSync(full)) {
      errors.push(`Required root documentation file missing: ${rootFile}`);
    }
  }

  // 2. Verify all 22 docs files exist
  for (const doc of REQUIRED_DOCS) {
    const full = path.join(DOCS_DIR, doc);
    if (!fs.existsSync(full)) {
      errors.push(`Required documentation file missing: docs/${doc}`);
    }
  }

  // 3. Verify README links to all 22 docs
  const readmePath = path.join(ROOT_DIR, "README.md");
  if (fs.existsSync(readmePath)) {
    const readmeContent = fs.readFileSync(readmePath, "utf-8");
    for (const doc of REQUIRED_DOCS) {
      if (!readmeContent.includes(`docs/${doc}`)) {
        errors.push(`README.md does not link to docs/${doc}`);
      }
    }
  }

  // 4. Verify relative Markdown links in docs/*.md
  const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  function checkLinksInFile(filePath) {
    const content = fs.readFileSync(filePath, "utf-8");
    let match;
    while ((match = markdownLinkRegex.exec(content)) !== null) {
      const linkTarget = match[2].split("#")[0].trim();
      // Skip external links, mailto, badges, schemas
      if (
        linkTarget.startsWith("http://") ||
        linkTarget.startsWith("https://") ||
        linkTarget.startsWith("mailto:") ||
        linkTarget === ""
      ) {
        continue;
      }
      const dir = path.dirname(filePath);
      const targetFull = path.resolve(dir, linkTarget);
      if (!fs.existsSync(targetFull)) {
        errors.push(`Broken link in ${path.relative(ROOT_DIR, filePath)}: ${linkTarget}`);
      }
    }
  }

  for (const doc of REQUIRED_DOCS) {
    const full = path.join(DOCS_DIR, doc);
    if (fs.existsSync(full)) {
      checkLinksInFile(full);
    }
  }
  if (fs.existsSync(readmePath)) {
    checkLinksInFile(readmePath);
  }

  // 5. Verify package.json license alignment
  const pkgPath = path.join(ROOT_DIR, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    if (pkg.license !== "Apache-2.0") {
      errors.push(`package.json license must be Apache-2.0, found: ${pkg.license}`);
    }
  }

  // 6. Semantic facts verification
  if (fs.existsSync(readmePath)) {
    const readme = fs.readFileSync(readmePath, "utf-8");
    if (!readme.includes("461-moon") && !readme.includes("461-Moon")) {
      errors.push("README.md must cite the 461-moon census total");
    }
    if (!readme.includes("Jupiter (115)") || !readme.includes("Saturn (293)")) {
      errors.push("README.md census table must reflect 115 Jupiter and 293 Saturn satellites");
    }
    if (!readme.includes("38 bodies") && !readme.includes("38 Regular")) {
      errors.push("README.md must reflect 38 Tier-2 regular satellites");
    }
    if (!readme.includes("402 bodies") && !readme.includes("402 Irregular")) {
      errors.push("README.md must reflect 402 Tier-3 irregular satellites");
    }
  }

  const satDocPath = path.join(DOCS_DIR, "SATELLITE_CATALOGUE.md");
  if (fs.existsSync(satDocPath)) {
    const satDoc = fs.readFileSync(satDocPath, "utf-8");
    if (!satDoc.includes("| **Total** | **461** | **21** | **38** | **402** |")) {
      errors.push("docs/SATELLITE_CATALOGUE.md total row must match 461 / 21 / 38 / 402");
    }
  }

  const contributingPath = path.join(ROOT_DIR, "CONTRIBUTING.md");
  if (fs.existsSync(contributingPath)) {
    const contrib = fs.readFileSync(contributingPath, "utf-8");
    if (contrib.includes("no licence yet")) {
      errors.push("CONTRIBUTING.md must not state 'no licence yet'");
    }
  }

  // 7. Semantic consistency: docs must not assert physics the code does not do.
  errors.push(...checkSemanticClaims());

  return {
    valid: errors.length === 0,
    errors,
    docCount: REQUIRED_DOCS.length,
    inventory: deriveTestInventory(),
  };
}

/** Files whose prose is treated as the authority on shipped behaviour. */
function proseFiles() {
  const files = [path.join(ROOT_DIR, "README.md"), path.join(ROOT_DIR, "CONTRIBUTING.md")];
  for (const doc of REQUIRED_DOCS) files.push(path.join(DOCS_DIR, doc));
  return files.filter((f) => fs.existsSync(f));
}

function readSource(relative) {
  const full = path.join(ROOT_DIR, relative);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf-8") : "";
}

/**
 * Rejects claims that contradict the implementation:
 *  - hand-maintained test counts (they drifted 154 / 156 / 159 before)
 *  - gravitational softening that is documented but absent from the engine
 *  - a relativistic model described as both supported and unsupported
 *  - a symplectic guarantee for a velocity-dependent force
 *  - a 60 FPS claim at the 1024-body cap with no benchmark evidence
 *  - sandbox browser acceptance claimed as verified while absent from CI
 *  - documented sandbox keyboard shortcuts that are not implemented
 */
export function checkSemanticClaims() {
  const errors = [];

  // 7a. No hand-maintained test counts.
  // Section numbers such as "2.19 Test" are not count claims: the lookbehind
  // rejects digits preceded by a dot or another digit.
  const countClaim = /(?<![\d.])\b\d{2,4}\s+(?:passing\s+|declared\s+|automated\s+)?tests?\b|(?<![\d.])\b\d{1,3}\s+(?:test\s+)?suites?\b|Tests-\d+/i;
  for (const file of proseFiles()) {
    const content = fs.readFileSync(file, "utf-8");
    content.split("\n").forEach((line, idx) => {
      const match = line.match(countClaim);
      if (match) {
        errors.push(
          `${path.relative(ROOT_DIR, file)}:${idx + 1}: hand-maintained test/suite count "${match[0]}" — counts drift; refer to the CI test job instead`
        );
      }
    });
  }

  // 7b. Every declared suite must actually run under `npm test`.
  const inventory = deriveTestInventory();
  for (const file of inventory.unregistered) {
    errors.push(`${file}: test suite is not executed by the \`npm test\` script`);
  }

  // 7c. Gravitational softening: documented means implemented.
  const gravitySource = readSource("src/simulation/physics/gravity.ts");
  const softeningImplemented = /plummer|softening/i.test(gravitySource);
  if (!softeningImplemented) {
    for (const file of proseFiles()) {
      const content = fs.readFileSync(file, "utf-8");
      if (/plummer/i.test(content) && !/no plummer|not appl|no softening|never appl/i.test(content)) {
        errors.push(
          `${path.relative(ROOT_DIR, file)}: claims Plummer softening, but src/simulation/physics/gravity.ts implements none`
        );
      }
    }
  }

  // 7d. Relativistic model scope and integrator claims.
  const physicsPath = path.join(DOCS_DIR, "PHYSICS_ENGINE.md");
  if (fs.existsSync(physicsPath)) {
    const physics = fs.readFileSync(physicsPath, "utf-8");
    if (!/Einstein[\u2013-]Infeld[\u2013-]Hoffmann|\bEIH\b/.test(physics)) {
      errors.push(
        "docs/PHYSICS_ENGINE.md must state that the shipped model is a pairwise 1PN approximation and not the full Einstein–Infeld–Hoffmann N-body equations"
      );
    }
    physics.split("\n").forEach((line, idx) => {
      const qualified =
        /\b(not|no|never|only|unclaimed|does not)\b/i.test(line) ||
        /Newtonian mode|position-dependent|velocity-dependent|approximation/i.test(line);
      if (/symplectic/i.test(line) && !qualified) {
        errors.push(
          `docs/PHYSICS_ENGINE.md:${idx + 1}: claims symplectic behaviour without qualification — velocity-dependent 1PN forces do not inherit the symplectic guarantee`
        );
      }
    });
  }

  // 7e. No frame-rate claim at the 1024-body envelope without benchmark evidence.
  for (const file of proseFiles()) {
    const content = fs.readFileSync(file, "utf-8");
    content.split("\n").forEach((line, idx) => {
      if (/(60|30)\s*(fps|FPS)/i.test(line) && /1024|256 massive|768 tracer/i.test(line)) {
        errors.push(
          `${path.relative(ROOT_DIR, file)}:${idx + 1}: claims a frame rate at the 1024-body envelope — the measured envelope is documented in docs/PERFORMANCE.md`
        );
      }
    });
  }

  // 7f. Sandbox browser acceptance must be a hosted gate when it is advertised.
  const ciPath = path.join(ROOT_DIR, ".github", "workflows", "ci.yml");
  if (fs.existsSync(ciPath)) {
    const ci = fs.readFileSync(ciPath, "utf-8");
    if (!ci.includes("scripts/browser-sandbox.mjs")) {
      errors.push(".github/workflows/ci.yml must run scripts/browser-sandbox.mjs (Sandbox Browser Acceptance job)");
    }
  }

  // 7g. Documented sandbox shortcuts must exist in the key handler.
  const appSource = readSource("src/components/simulation/simulation-app.tsx");
  const shortcutDocs = ["README.md", "docs/USER_GUIDE.md", "docs/CONTROLS.md"];
  const documented = new Set();
  for (const doc of shortcutDocs) {
    const full = path.join(ROOT_DIR, doc);
    if (!fs.existsSync(full)) continue;
    const content = fs.readFileSync(full, "utf-8");
    for (const key of ["Space", "I", "E", "S"]) {
      const pattern = new RegExp(`\\(?\\b${key}\\b[^\\n]{0,40}(inspector|edit|save|scenario|play|pause)`, "i");
      if (pattern.test(content)) documented.add(key);
    }
  }
  const handlerChecks = {
    Space: /e\.code === "Space"/,
    I: /toLowerCase\(\) === "i"/,
    E: /toLowerCase\(\) === "e"/,
    S: /toLowerCase\(\) === "s"/,
  };
  for (const key of documented) {
    if (!handlerChecks[key].test(appSource)) {
      errors.push(`documented sandbox shortcut "${key}" has no handler in src/components/simulation/simulation-app.tsx`);
    }
  }

  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkDocConsistency();
  if (!result.valid) {
    console.error("Documentation consistency check failed with errors:");
    for (const err of result.errors) console.error(` - ${err}`);
    process.exit(1);
  }
  const inv = result.inventory;
  console.log(
    `Documentation consistency verified across ${result.docCount} docs ` +
      `(derived inventory: ${inv.testCount} declared test cases across ${inv.suiteCount} suites, ` +
      `${inv.simulationTestCount} sandbox cases across ${inv.simulationSuiteCount} files).`
  );
}
