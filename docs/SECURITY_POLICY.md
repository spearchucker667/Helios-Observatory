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

Instead, report vulnerabilities privately by emailing:
**security@helios-observatory.org**

Please include:
1. Description of the vulnerability (e.g. XSS vector, ReDoS in parameter parsing, prototype pollution).
2. Steps to reproduce or proof-of-concept payload.
3. Affected components or routes.
4. Proposed mitigation or patch if known.

We will acknowledge receipt within 48 hours and provide a timeline for remediation.

---

## 3. Threat Model & Client-Side Security

Helios is a client-rendered astronomical visualization web application. Key security boundaries include:
- **URL Parameter Sanitization:** Deep link query parameters (`body`, `date`, `units`) are strictly validated against known identifiers and constrained intervals via `src/lib/sim-store.ts` and `src/lib/ephemeris.ts`.
- **Zero Raw HTML Injection:** Dynamic user inputs or URL query strings are never passed to `dangerouslySetInnerHTML`.
- **Content Security Policy (CSP):** The application complies with standard strict CSP directives without `unsafe-eval`.
- **Safe Clipboard Access:** Clipboard write operations feature fallback prompts and guarded promises.
