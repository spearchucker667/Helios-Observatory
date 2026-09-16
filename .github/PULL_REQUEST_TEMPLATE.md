## Summary

<!-- One or two sentences: what and why. -->

## Change type

- [ ] Bug fix
- [ ] Astronomical data (see provenance checklist)
- [ ] Visual / rendering
- [ ] Feature
- [ ] Docs only
- [ ] Tooling / tests

## Validation

All four gates green:

- [ ] `npm run typecheck`
- [ ] `npm run lint` (0 warnings)
- [ ] `npm test`
- [ ] `npm run build`

Browser checks:

- [ ] Smoke test run (`node scripts/browser-smoke.mjs`), console clean
- [ ] Mobile 390×844 checked
- [ ] Keyboard path for any new UI
- [ ] Screenshots regenerated if visuals changed

## Astronomical data provenance (if applicable)

- [ ] Institutional source cited per changed figure (NASA/JPL/ESA/USGS/IAU)
- [ ] `retrieved` dates updated
- [ ] New sources added to `src/data/sources.ts`
- [ ] No scene constants in `src/data`, no data literals in components
- [ ] Scale claims unchanged/honest (UI labels still accurate)

## Docs

- [ ] README/docs updated where behaviour or controls changed
- [ ] CHANGELOG entry added
