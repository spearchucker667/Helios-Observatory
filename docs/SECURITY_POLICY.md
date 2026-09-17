# Security Policy & Vulnerability Reporting

Helios Observatory is dedicated to maintaining high software security standards for our users and contributors.

---

## 1. Supported Versions

Security updates are applied to the active `main` branch:

| Version | Supported |
| :--- | :--- |
| `main` | :white_check_mark: |
| < 1.0.0 | :x: |

---

## 2. Reporting a Vulnerability

If you discover a security vulnerability or potential threat in Helios Observatory, please **do not open a public GitHub issue**.

Instead, report vulnerabilities privately via **GitHub Security Advisories** on this repository:
Navigate to **Security** → **Advisories** → **Report a vulnerability**.

Please include:
1. Description of the vulnerability (e.g. XSS vector, ReDoS in parameter parsing, prototype pollution).
2. Steps to reproduce or proof-of-concept payload.
3. Affected components or routes.
4. Proposed mitigation or patch if known.

We will acknowledge receipt within 48 hours and provide a timeline for remediation.

---

## 3. Threat Model & Client-Side Security

Helios is a client-rendered astronomical visualization web application. Key security boundaries include:
- **URL Parameter Sanitization:** Deep link query parameters (`body`, `moon`, `date`) are strictly validated against known identifiers and constrained intervals via `src/lib/sim-store.ts` and `src/lib/ephemeris.ts`.
- **Zero Raw HTML Injection:** Dynamic user inputs or URL query strings are never passed to `dangerouslySetInnerHTML`.
- **Content Security Policy (CSP):** The application complies with standard strict CSP directives without `unsafe-eval`.
- **Safe Clipboard Access:** Clipboard write operations feature fallback prompts and guarded promises.
- **Local-Only Persistence:** User settings persist exclusively in `localStorage["helios-settings-v2"]` with no telemetry or tracking cookies.

---

## 4. GitHub CodeQL & GHAS Notice

Automated CodeQL security scanning is configured in `.github/workflows/codeql.yml`. Note that on private GitHub repositories, GitHub Advanced Security (GHAS) must be active for SARIF upload and automated alert generation; without GHAS, GitHub's API returns HTTP 422 (`Advanced security has not been purchased`). CI gates enforce TypeScript strict typechecking, zero-warning ESLint checks, and `npm audit` verification on every pull request and push to `main`.

---

## 5. Licence Status

Helios Observatory is released under the **Apache License, Version 2.0**.
See [LICENSE](../LICENSE) for details.
