## Summary

<!-- One or two sentences: what and why. -->

## Change type

- [ ] Bug fix
- [ ] Astronomical data (see provenance checklist)
- [ ] Visual / rendering
- [ ] Feature (Observatory Mode or Sandbox Mode)
- [ ] Docs only
- [ ] Tooling / tests

## Validation

All quality gates green:

- [ ] `npm run typecheck`
- [ ] `npm run lint` (0 warnings)
- [ ] `npm test` (154 passing tests)
- [ ] `npm run build`
- [ ] `node scripts/check-doc-consistency.mjs`
- [ ] `node scripts/validate-assets.mjs`

Browser checks:

- [ ] Smoke test run (`node scripts/browser-smoke.mjs`), console clean
- [ ] Mobile 390×844 checked
- [ ] Keyboard path for any new UI
- [ ] Screenshots regenerated if visuals changed

## Scientific & Simulation Invariants (if applicable)

- [ ] Institutional source cited per changed figure (NASA/JPL/ESA/USGS/IAU)
- [ ] `retrieved` dates updated
- [ ] New sources added to `src/data/sources.ts`
- [ ] No scene constants in `src/data`, no data literals in components
- [ ] Scale claims unchanged/honest (UI labels still accurate)
- [ ] Sandbox operations strictly isolated from canonical registries (`src/data/**`)
- [ ] Physics changes maintain symplectic energy & linear momentum conservation
- [ ] Internal simulation calculations operate strictly in SI dimensional units

## Docs

- [ ] README/docs updated where behaviour or controls changed
- [ ] CHANGELOG entry added
