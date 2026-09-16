# Release Process & Quality Gates

This document defines the release lifecycle, semantic versioning policy, and automated quality gates for Helios Observatory.

---

## 1. Versioning Policy

Helios follows [Semantic Versioning (SemVer 2.0.0)](https://semver.org/):
- **MAJOR (X.0.0):** Incompatible architectural breaks, coordinate engine changes, or public data API schema modifications.
- **MINOR (0.X.0):** New celestial bodies, satellite catalogue expansions, new visual layers (e.g. Oort cloud, calipers), or backward-compatible feature additions.
- **PATCH (0.0.X):** Astronomical data corrections, numerical stability fixes, shader optimization, and documentation improvements.

---

## 2. Pre-Release Quality Gates Checklist

Before cutting any release tag or merging to `main`, every one of the following gates must pass:

1. **TypeScript Typecheck:**
   ```bash
   npm run typecheck
   ```
   Must exit with code 0 and zero type errors.

2. **Strict Linting (Zero Warnings):**
   ```bash
   npm run lint
   ```
   Enforced with `--max-warnings=0`. No warnings permitted.

3. **Complete Automated Test Suite:**
   ```bash
   npm test
   ```
   All test suites (app data, auth, data validation, formatting, ephemeris, satellite catalogue, deep space scale, distance measurement, asset validation) must pass 100%.

4. **Production Build & Preview Verification:**
   ```bash
   npm run build
   npm run preview:restart
   ```
   Verify that Vite builds without asset bundling errors or missing chunks.

5. **Headless Browser Smoke QA:**
   ```bash
   node scripts/browser-smoke.mjs
   ```
   Must verify both desktop (1280×800) and mobile (390×844) viewports with zero uncaught console errors and confirmed DOM root elements.

6. **Asset Manifest Audit:**
   ```bash
   node scripts/validate-assets.mjs
   ```
   All SVGs must be pure vector with zero raster embedding.

---

## 3. Release Execution

1. **Update Changelog:**
   Add new release section in `CHANGELOG.md` with release notes adhering to Keep a Changelog format.
2. **Commit & Tag:**
   ```bash
   git commit -am "chore(release): cut v1.0.0"
   git tag -a v1.0.0 -m "Release Helios Observatory v1.0.0"
   git push origin main --tags
   ```
3. **GitHub Release:**
   Draft GitHub release from the tag, including the summary of changes and asset checksums.
