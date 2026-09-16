# Security Policy

## Reporting a vulnerability

Helios is a fully client-side visualisation with no backend of its own —
no accounts, no user data, no writes. The realistic vulnerability surface
is therefore small, but real:

- the static site/server bundle (dependency vulnerabilities, XSS via any
  future URL-state feature)
- the build/preview tooling in `scripts/` (path traversal guards already
  exist for the smoke/preview scripts)
- the deployment target (Vercel) configuration

**Please report privately** via GitHub Security Advisories ("Report a
vulnerability" on this repository) rather than a public issue. Include a
description, reproduction, and affected versions/commits.

## Scope

In scope: the application code (`src/`), build & QA tooling (`scripts/`,
`server/`), and dependency chain (`package.json`).

Out of scope: the hosting platform itself, and any hypothetical data store
(the app ships with none).

## Supported versions

Only the latest `main` is supported.

## Data & privacy

Helios collects nothing. The only client-side persistence is
`localStorage["helios-settings-v2"]` — display preferences (pace, labels,
units, scale mode). No telemetry, no cookies, no third-party requests at
runtime.

## Dependency policy

- Dependencies are audited by `npm install` on every setup (0 known
  vulnerabilities at last check).
- New runtime dependencies require justification in the PR (see
  CONTRIBUTING.md) — the scene is intentionally dependency-light.

## Licence status

The project has **no licence established yet**; all rights default to the
repository owner. Do not redistribute externally until that changes.
