# Contributing to Helios

Thanks for helping build the observatory. This project has two kinds of
truth that deserve different care: **code**, and **astronomical facts**.

## Getting started

```bash
npm install
npm run dev          # dev server on :8080
npm test             # data integrity + formatting + platform suites
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first — especially the
science/scene separation. It explains most of the code-review comments you
will get.

## Ground rules

1. **All four gates pass** before opening a PR:
   ```bash
   npm run typecheck && npm run lint && npm test && npm run build
   ```
   No gate may be weakened, skipped, or suppressed to force a pass.
2. **Never invent astronomy.** Figures and events need institutional
   sources (NASA/JPL/ESA/USGS/IAU) recorded in the dataset and source
   registry. See [docs/ASTRONOMICAL_DATA.md](docs/ASTRONOMICAL_DATA.md).
3. **Keep science out of the scene** and scene out of science. Scene radii
   belong in `scene-scale.ts`; display strings in `format.ts`; canonical
   numbers only in `src/data`.
4. **Preserve Sandbox isolation**: Sandbox modifications must operate on deep
   clones and never mutate canonical reference data in `src/data/**`.
5. **Physical simulation operates in SI units**: All physics in `src/simulation`
   must use meters, seconds, and kilograms. Astronomical conversions belong in
   the presentation boundary.
6. **Respect the visual identity** — restrained, dark, instrument-like.
   No dashboard sprawl.
7. **Accessibility is not optional** — new controls need labels, keyboard
   paths, and reduced-motion handling.

## Fixing astronomical data

Use the [data-correction issue template](.github/ISSUE_TEMPLATE/data-correction.md).
A good correction:

- cites an institutional source (URL) and its retrieval date,
- updates the dataset entry **and** `retrieved`,
- adds/updates the source in `src/data/sources.ts` if new,
- updates any events that depend on the figure.

The integrity suite (`npm test`) catches dangling references; accuracy is
on you and the reviewer.

## Reporting visual issues

Use the [rendering issue template](.github/ISSUE_TEMPLATE/rendering-issue.md).
Attach the smoke output if you can:

```bash
node scripts/browser-smoke.mjs http://127.0.0.1:8080/ screenshots/issue.png
```

## PR checklist

- [ ] `npm run typecheck && npm run lint && npm test && npm run build` all green
- [ ] `node scripts/check-doc-consistency.mjs && node scripts/validate-assets.mjs` pass
- [ ] New bodies/moons/events include sources + retrieved dates
- [ ] No scene constants in `src/data`; no data literals in components
- [ ] Sandbox operations strictly isolated from canonical registries
- [ ] Physics changes maintain symplectic energy & momentum conservation
- [ ] Mobile (390×844) checked via smoke or manually
- [ ] Keyboard-only path exists for any new UI
- [ ] Screenshots regenerated if visuals changed
- [ ] Docs updated when architecture/controls change
- [ ] CHANGELOG entry added

## Style

- TypeScript strict; no `any` without a comment justifying it
- Prettier config in `.prettierrc`; ESLint must stay at 0 warnings
- Components stay small; data shaping belongs in `src/lib` or `src/data`
- Prefer editing existing files; delete dead code outright

## Licensing
Helios Observatory is licensed under the [Apache License, Version 2.0](LICENSE).
Astronomical ephemeris and data constants are derived from public domain and open-access
materials published by NASA, JPL, and IAU; see [NOTICE](NOTICE) and [docs/LEGAL.md](docs/LEGAL.md).
