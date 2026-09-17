# Security Policy

## Reporting a vulnerability

Helios Observatory is a client-side astronomical visualization with no backend of its own —
no accounts, no user data, no writes. The realistic vulnerability surface
is therefore small, but real:

- the static site/server bundle (dependency vulnerabilities, XSS via URL-state parameters)
- the build/preview tooling in `scripts/` (path traversal guards exist for preview and smoke scripts)
- the deployment target (Vercel) configuration

**Please report vulnerabilities privately** via GitHub Security Advisories ("Report a
vulnerability" on this repository) rather than a public issue. Include a
description, reproduction steps, and affected versions/commits. We acknowledge receipts within 48 hours.

## Scope

In scope: the application code (`src/`), build & QA tooling (`scripts/`,
`server/`), and dependency chain (`package.json`).

Out of scope: the hosting platform itself, and any hypothetical data store
(the app ships with none).

## Supported versions

Only the latest `main` branch is supported.

| Version | Supported |
| :--- | :--- |
| `main` | :white_check_mark: |
| < 1.0.0 | :x: |

## Data & privacy

Helios collects nothing. The only client-side persistence is
`localStorage["helios-settings-v2"]` — display preferences (pace, labels,
units, scale mode). No telemetry, no cookies, no third-party requests at
runtime.

## Dependency policy & automated scanning

- Dependencies are audited by `npm install` and `npm audit` on every setup and CI run (0 known vulnerabilities).
- New runtime dependencies require justification in the PR (see CONTRIBUTING.md) — the scene is intentionally dependency-light.
- Static analysis is continuously enforced by ESLint with zero allowed warnings (`--max-warnings=0`) and TypeScript strict mode.

## GitHub CodeQL & GHAS notice

Automated CodeQL static analysis workflows (`.github/workflows/codeql.yml`) run against `main`. Note that on private GitHub repositories, GitHub Advanced Security (GHAS) must be enabled on the repository or organization for SARIF analysis results to be processed; without GHAS, GitHub's CodeQL Action returns an HTTP 422 error (`Advanced security has not been purchased`). Local and CI security gates enforce static analysis independently of GHAS status.

## Content Security Policy (CSP)

The application complies with strict CSP directives:
- No `unsafe-eval` in production bundles.
- URL query parameters (`body`, `moon`, `date`) are strictly validated against known identifiers and bounded ephemeris intervals via `src/lib/sim-store.ts` and `src/lib/ephemeris.ts`.
- Zero raw HTML injection (`dangerouslySetInnerHTML` is never used for dynamic user or query inputs).

## Licence status

Helios Observatory is licensed under the **Apache License, Version 2.0**.
See [LICENSE](LICENSE) for the full licence text.
