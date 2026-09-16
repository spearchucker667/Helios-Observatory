# Helios Observatory — Miku Space Asset Pack

A cohesive space-agency / mission-control visual family for Helios Observatory. The pack combines an original vector identity system with transformed mascot animations based on the supplied Miku spritesheet.

## Contents

- `assets/svg/` — production SVG marks, lockups, mission patch, feature badges, README hero
- `assets/gif/` — animated mascot/telemetry assets
- `assets/png/` — rendered SVG previews and static GIF fallbacks
- `assets/previews/asset-contact-sheet.png` — visual inventory
- `implementation/` — README snippets, React helper, CSS, CODEOWNERS sample
- `docs/` — legal/provenance notes
- `manifests/assets.json` — checksums, dimensions, frame counts, provenance
- `AGENT_HANDOFF.md` — implementation plan and acceptance criteria

## Recommended production set

Use these first:

1. `helios-miku-lockup-dark.svg` / `helios-miku-lockup-light.svg` — README and docs header
2. `helios-miku-orbit-mark.svg` — app about screen / splash / footer
3. `helios-miku-favicon.svg` — small UI mark
4. `helios-miku-mission-control.gif` — optional animated README section
5. `helios-miku-orbit-spinner.gif` + static PNG fallback — small in-app decorative status mascot
6. Feature badges for the Moon Catalog, Oort Frontier, and Distance Lab

The animated GIFs are optional because their source-art licensing must be verified independently.
