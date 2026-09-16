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
  "RELEASE_PROCESS.md",
  "ROADMAP.md",
  "SATELLITE_CATALOGUE.md",
  "SCREENSHOTS.md",
  "SECURITY_POLICY.md",
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

  return {
    valid: errors.length === 0,
    errors,
    docCount: REQUIRED_DOCS.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkDocConsistency();
  if (!result.valid) {
    console.error("Documentation consistency check failed with errors:");
    for (const err of result.errors) console.error(` - ${err}`);
    process.exit(1);
  }
  console.log(`Documentation consistency verified across ${result.docCount} docs.`);
}
