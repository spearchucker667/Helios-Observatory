# Roadmap

## Shipped (this expansion)

- 20 Tier-1 moons as first-class selectable/renderable bodies
- Ring systems for all four giants, data-driven
- Tiered procedural textures (LOW/HIGH LOD with lazy generation)
- Tabbed detail views with sources; event timeline (60+ sourced entries)
- Search palette, comparison mode, unit systems, scale modes
- Accessibility pass (DOM equivalents, keyboard, reduced motion)
- Mobile bottom-sheet layout
- Documentation set + data-integrity test suite

## Near term

1. **Dwarf planets** — Ceres and Pluto as `kind: "dwarf-planet"` (the type
   union and registry already support it; needs datasets, textures, and
   belt/Kuiper placement).
2. **Kuiper belt** — instanced ring population beyond Neptune in
   distance mode.
3. **Shareable deep links** — `/?body=jupiter&moon=europa` state serialised
   to the URL on selection; restore on load.
4. **Screenshot mode** — hide UI, clean capture of the canvas.
5. **HIGH-texture eviction** — free unused inspection maps after N seconds.

## Mid term

6. **Guided tours** — curated sequences (Inner Worlds, Galilean Moons,
   Voyager's Grand Tour) driving the existing camera/selection store.
7. **Eccentric orbits** — honour the recorded eccentricity/orientation in
   the position update (still educational, closer to honest geometry).
8. **Spacecraft layer** — historically significant trajectories (Voyager 1/2,
   Cassini, Juno, New Horizons) only where real trajectory data exists.
9. **Feature markers on globes** — render `SurfaceFeature` coordinates as
   globe-anchored pins in inspection view (data already carries lat/lon).

## Long term / speculative

10. **Eclipse & transit geometry** — geometry-based demos (solar/lunar
    eclipse angles, Galilean transits), clearly labelled as demonstrations.
11. **Epoch dating** — optional mean-longitude propagation with an explicit
    accuracy disclaimer; never presented as an ephemeris service.
12. **Tier-2 moons** — inner shepherds (Amalthea, Hyperion, …) at low
    fidelity.
13. **I18n** — the data layer separates content from presentation well
    enough to translate prose fields.

## Explicitly out of scope

- Real-time sky positions / telescope pointing
- Photorealistic licensed textures (provenance cost outweighs benefit)
- Multiplayer or accounts (no per-user data anywhere)
