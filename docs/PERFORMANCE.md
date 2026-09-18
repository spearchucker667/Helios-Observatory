# Performance

## Budgets

| Metric | Target |
| --- | --- |
| Initial JS (route) | ~< 300 KB gz — scene is code-split and lazy |
| Textures at startup | 11 LOW canvas maps + shared (≈ 25 MB GPU) |
| Textures on inspection | + 1 HIGH map (2048×1024) per focused planet, cached |
| Draw calls, system view | < 60 (8 planets + sun + trails + belt instancing) |
| Frame rate, laptop | observatory system view target 60 fps; ≥ 45 fps focused with clouds |
| Mobile (390×844) | observatory target 30–60 fps, DPR capped at 1.75 |
| Sandbox `1,024` bodies | no frame-rate target — capacity limit only; see the measured matrix below |

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

## Sandbox benchmark matrix (measured)

Produced by `npm run benchmark` (`scripts/sim-benchmark.mjs`), which builds each
scenario, warms up for 5 steps, then times 200 steps per row (`--steps N`
changes the timed step count) and reports a machine-readable JSON line after the
table.

Reference machine for the numbers below: **`superUser.local` — Apple A18 Pro, 6
vCPU, macOS (darwin arm64), Node.js v22.23.2**, single run of the default
invocation. Step throughput on a laptop-class CPU varies by roughly ±40 %
between runs (JIT warm-up, thermal state, other load), so these rows are a
measured snapshot of the envelope, not a reproducible constant: an earlier run
of the same script on the same machine reported 47 steps/s at 256 massive where
the run below reports 29. CI never asserts this table; it pins only the
conservative floors in `src/simulation/tests/performance.test.ts` (> 100 steps/s
with 8 massive bodies, < 500 ms/step with 256).

| Scenario | Bodies | steps/s | ms/step | snapshot build (ms) | achieved warp |
| --- | --- | --- | --- | --- | --- |
| 8 massive | 8 | 12,444 | 0.080 | 0.0013 | 129.6 d/s |
| 32 massive | 32 | 2,493 | 0.40 | 0.0006 | 26.0 d/s |
| 64 massive | 64 | 699 | 1.43 | 0.0009 | 7.3 d/s |
| 128 massive | 128 | 168 | 5.95 | 0.0008 | 1.75 d/s |
| 256 massive | 256 | 29 | 34.9 | 0.0009 | 0.30 d/s |
| 256 massive + 768 tracers | 1,024 | 3.7 | 269 | 0.034 | 0.039 d/s |
| 1 massive + 1,023 tracers | 1,024 | 3.2 | 315 | 0.034 | 0.033 d/s |

No row produced non-finite body state. All-pairs gravity is $O(N^2)$ over massive
bodies, so cost grows steeply: the 1,024-body envelope is a **capacity** limit,
not a frame-rate guarantee. What the architecture does guarantee at that size is
that the main thread stays interactive — physics runs in the worker and streams
~30 Hz typed-array snapshots, so camera/UI responsiveness is decoupled from
physics throughput. The honest summary is *"1,024 bodies fit and remain
interactive; they do not run at 60 FPS"*.

Render-side FPS is measured separately by the sandbox acceptance pass
(`scripts/browser-sandbox.mjs`), which records the observed frame cadence and
snapshot update rate rather than asserting a fixed frame-rate claim.

## Measuring

```bash
# Sandbox physics matrix (steps/s, ms/step, snapshot cost, achieved warp)
npm run benchmark

# Dev-time frame stats: three's stats are not mounted by default; use
# Chrome DevTools Performance + the Rendering FPS meter.
node scripts/browser-smoke.mjs   # console-error + overflow verdict
node scripts/browser-sandbox.mjs http://127.0.0.1:8081/sandbox   # sandbox acceptance
node scripts/check-doc-consistency.mjs   # rejects undocumented/unbacked claims
```

For texture-memory spot checks: `chrome://gpu` → "Video Memory", or a
`renderer.info.memory` breakpoint via R3F's `gl` in `onCreated`.

## Known costs

- HIGH textures are 2048×1024 canvases (≈ 8 MB GPU each while cached). The
  cache keeps them for the session; a future optimisation could evict
  unused HIGH maps after N seconds.
- 3,800-star point cloud — trivial GPU-side, built once.
- `cmdk` search index builds on first open (memoized).
