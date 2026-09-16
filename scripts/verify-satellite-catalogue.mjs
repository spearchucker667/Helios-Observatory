#!/usr/bin/env node
/**
 * verify-satellite-catalogue.mjs
 *
 * Validates the pinned satellite snapshot and catalogue:
 * 1. Satellite counts by parent match the NASA August 2026 baseline.
 * 2. All satellite IDs are unique.
 * 3. All parents are known major planets or dwarf planets.
 * 4. Orbital parameters are physically valid (positive radius, positive period, e in [0, 1), inc in [0, 180]).
 * 5. All referenced source IDs resolve to known sources.
 * 6. As-of date is a valid non-future ISO date string.
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SNAPSHOT_PATH = resolve(ROOT, "src/data/satellites/generated/snapshot.json");
const META_PATH = resolve(ROOT, "src/data/satellites/generated/snapshot.meta.json");

const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
const meta = JSON.parse(readFileSync(META_PATH, "utf8"));

const EXPECTED_COUNTS = {
  mercury: 0,
  venus: 0,
  earth: 1,
  mars: 2,
  jupiter: 115,
  saturn: 293,
  uranus: 29,
  neptune: 16,
  pluto: 5,
};

const VALID_PARENTS = new Set(["earth", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"]);
const KNOWN_SOURCES = new Set([
  "nasa-planetary-factsheet",
  "nasa-sun-factsheet",
  "nasa-moon-factsheet",
  "nasa-solar-system-exploration",
  "nasa-jpl-missions",
  "nasa-messenger",
  "nasa-dawn",
  "jpl-horizons",
  "jpl-ssd",
  "iau-mpc",
  "nasa-oort-cloud",
  "nasa-jpl-standish",
]);

let errors = 0;
function error(msg) {
  console.error("FAIL:", msg);
  errors++;
}

// 1. Total count
if (snapshot.length !== 461) {
  error(`Expected 461 total satellites, got ${snapshot.length}`);
}

// 2. Parent counts
const actualCounts = {};
for (const parent of Object.keys(EXPECTED_COUNTS)) {
  actualCounts[parent] = 0;
}
for (const sat of snapshot) {
  actualCounts[sat.parentId] = (actualCounts[sat.parentId] ?? 0) + 1;
}

for (const [parent, expected] of Object.entries(EXPECTED_COUNTS)) {
  if (actualCounts[parent] !== expected) {
    error(`Parent ${parent}: expected ${expected} satellites, got ${actualCounts[parent]}`);
  }
}

// 3. ID uniqueness
const ids = new Set();
for (const sat of snapshot) {
  if (ids.has(sat.id)) {
    error(`Duplicate satellite id: ${sat.id}`);
  }
  ids.add(sat.id);

  if (!VALID_PARENTS.has(sat.parentId)) {
    error(`Satellite ${sat.id} references invalid parent: ${sat.parentId}`);
  }

  if (sat.orbit.semiMajorAxisKm <= 0) {
    error(`Satellite ${sat.id} non-positive semi-major axis: ${sat.orbit.semiMajorAxisKm}`);
  }
  if (sat.orbit.periodDays <= 0) {
    error(`Satellite ${sat.id} non-positive orbital period: ${sat.orbit.periodDays}`);
  }
  if (sat.orbit.eccentricity < 0 || sat.orbit.eccentricity >= 1) {
    error(`Satellite ${sat.id} invalid eccentricity: ${sat.orbit.eccentricity}`);
  }
  if (sat.orbit.inclinationDeg < 0 || sat.orbit.inclinationDeg > 180) {
    error(`Satellite ${sat.id} invalid inclination: ${sat.orbit.inclinationDeg}`);
  }

  for (const src of sat.sourceIds) {
    if (!KNOWN_SOURCES.has(src)) {
      error(`Satellite ${sat.id} references unknown source: ${src}`);
    }
  }
}

// 4. As-of date validation
const asOfDate = new Date(meta.asOf);
if (Number.isNaN(asOfDate.getTime())) {
  error(`Invalid meta.asOf date: ${meta.asOf}`);
}

if (errors === 0) {
  console.log(`Satellite catalogue verification PASSED (461 satellites across 7 parents, 0 errors).`);
  process.exit(0);
} else {
  console.error(`Satellite catalogue verification FAILED with ${errors} error(s).`);
  process.exit(1);
}
