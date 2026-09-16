# Performance

## Budgets

| Metric | Target |
| --- | --- |
| Initial JS (route) | ~< 300 KB gz — scene is code-split and lazy |
| Textures at startup | 11 LOW canvas maps + shared (≈ 25 MB GPU) |
| Textures on inspection | + 1 HIGH map (2048×1024) per focused planet, cached |
| Draw calls, system view | < 60 (8 planets + sun + trails + belt instancing) |
| Frame rate, laptop | 60 fps system view; ≥ 45 fps focused with clouds |
| Mobile (390×844) | stable 30–60 fps, DPR capped at 1.75 |

## Strategies in place

### Level of detail

- **Texture tier** — `useLodTier` flips LOW → HIGH when the camera closes
  within ~12 planet radii; HIGH maps are generated lazily on first flip and
  cached, never eagerly at startup.
- **Moon systems** — rendered only when the parent (or a sibling moon) is
  selected (`moonMode: auto`), or forced with `always`; `hidden` removes
  them entirely. Up to 7 moons × (orbit line + mesh + label) appear only on
  focus.
- **Geometry** — planets at 48×48 segments, moons at 24×24, hit-proxies at
  12×12; stars/belt are instanced or point clouds.

### Memory & disposal

- One `TextureCache` for the scene; `dispose()` frees LOW + HIGH + shared
  maps on unmount.
- Orbit trails own their buffers and dispose with the component.
- Ring textures dispose with their mesh; geometry is shared where possible.
- No `Html` label storm: labels render only for visible bodies and the
  selected body's own label is suppressed.

### Rendering pipeline

- DPR capped at `1.75` (mobile GPUs).
- ACES tone mapping; `powerPreference: high-performance`.
- Additive solar billboard instead of post-processing bloom.
- Simulation delta clamped (`min(delta, 0.1)`) so tab-switching never
  teleports planets.

### Code splitting

The Three.js scene (`solar-canvas.tsx`) is `React.lazy`-loaded behind a
static space fallback; the Three/drei chunk (~2.7 MB min) is not paid on
first paint.

## Measuring

```bash
# Dev-time frame stats: three's stats are not mounted by default; use
# Chrome DevTools Performance + the Rendering FPS meter.
node scripts/browser-smoke.mjs   # console-error + overflow verdict
```

For texture-memory spot checks: `chrome://gpu` → "Video Memory", or a
`renderer.info.memory` breakpoint via R3F's `gl` in `onCreated`.

## Known costs

- HIGH textures are 2048×1024 canvases (≈ 8 MB GPU each while cached). The
  cache keeps them for the session; a future optimisation could evict
  unused HIGH maps after N seconds.
- 3,800-star point cloud — trivial GPU-side, built once.
- `cmdk` search index builds on first open (memoized).
