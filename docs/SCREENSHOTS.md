# Screenshots

All captures are produced in-sandbox by headless Chromium (`scripts/browser-smoke.mjs`
and the `agent-browser` CLI) — never mocked.

## Current set

| File | What it shows |
| --- | --- |
| `screenshots/hero.png` | README hero — Saturn system with rings + moons |
| `screenshots/helios-baseline.png` | Pre-expansion baseline (desktop 1280×800) |
| `screenshots/phase3-dev.png` | Expanded system view, desktop |
| `screenshots/qa-jupiter.png` | Jupiter focus with Galilean moons + detail panel |
| `screenshots/qa-jupiter-surface.png` | Surface tab: Great Red Spot entry |
| `screenshots/qa-search-open.png` | Search palette (⌘K) |
| `screenshots/qa-titan-final.png` | Titan inspection (moon tracking) |
| `screenshots/qa-earth-tabs.png` | Earth detail with wrapped tab row |
| `screenshots/qa-compare.png` | Compare-worlds dialog (Earth vs Mars) |
| `screenshots/qa-mobile-fixed.png` | Mobile (390×844) bottom sheet |

## Regenerating

```bash
# Smoke verdict + desktop/mobile screenshots
node scripts/browser-smoke.mjs http://127.0.0.1:8080/ screenshots/phase3-dev.png

# Arbitrary interaction captures (requires dev server running)
agent-browser open http://127.0.0.1:8080/
agent-browser set viewport 390 844
agent-browser screenshot screenshots/qa-mobile.png
```

## Conventions

- Screenshots stay inside the repo (`screenshots/` is gitignored for
  ephemeral QA; keep the curated set above force-added).
- Regenerate the curated set after any visual change — stale screenshots in
  docs are worse than none.
- Mobile captures always at 390×844 (the smoke default).
