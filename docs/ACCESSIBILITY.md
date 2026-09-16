# Accessibility

## Statement

The 3-D canvas alone is not accessible, so **every meaningful interaction
has a DOM equivalent**. Helios aims for WCAG 2.1 AA on the interface layer:
keyboard operability, visible focus, labelled controls, sufficient contrast,
and reduced-motion support. Gaps are listed honestly at the bottom.

## DOM equivalents for scene content

| Scene object | DOM equivalent |
| --- | --- |
| Sun, planets | World list buttons (left panel, desktop) / bottom chip row (mobile) |
| Moons | Expandable moon lists under each planet; search palette |
| Surface features | Surface tab of the detail panel (with coordinates) |
| Events | Events tab (chronological timeline with buttons) |
| Comparison | Compare dialog (semantic table) |
| Search deep-links | Search palette across bodies/features/events |

Body selection is a single store action (`select`) consumed by both the
canvas (camera focus) and the DOM (panels) — clicking a sphere and clicking
a list button produce identical state.

## Keyboard support

Full map in [CONTROLS.md](CONTROLS.md). Highlights:

- `Tab` reaches every control in reading order; focus is never trapped
  (dialogs close on `Esc`).
- `0`–`8` jump-select bodies; `Backspace` walks up the hierarchy — a
  keyboard-only user can reach any moon: select Saturn (`6`) → the moon
  list gains buttons → `Tab` to Titan → `Enter`.
- The search palette (`⌘K`) is the fastest keyboard path to anything.
- Canvas clicks have keyboard alternatives; the canvas itself is
  decorative-with-annotations (`aria-hidden` visuals, real text elsewhere).

## Semantics & ARIA

- Landmarks: `header`, `nav` (Worlds), `aside` (detail), `footer`.
- Detail tabs are a real `role="tablist"` / `role="tab"` /
  `role="tabpanel"` with `aria-selected` state.
- Unit and scale-mode switchers are `role="radiogroup"` with
  `aria-checked` radios.
- Expanders expose `aria-expanded`; dialogs label themselves and close on
  backdrop click / `Esc`.
- Live region: the detail `aside` is `aria-live="polite"` so selection
  changes are announced.
- Icon-only buttons carry descriptive `aria-label`s ("Hide labels",
  "Reset system view", …).

## Focus & contrast

- Focus indicators: browser default outlines are preserved (never
  `outline: none` without replacement); buttons show hover *and* focus
  states.
- Text contrast: body text `#eceef2` on `#07080c` (≈ 15.9:1), muted text
  `#8e939e` on surface (≈ 5.4:1) — AA for normal text.
- Information is never colour-only: states pair colour with text
  (e.g. "Retrograde", "approx.") or position.

## Reduced motion

`prefers-reduced-motion: reduce`:

- CSS transitions/animations collapse to ~0ms (global media rule in
  `styles.css`).
- The camera rig **snaps** instead of exponential-gliding (see
  `camera-rig.tsx`), so focus changes are instant rather than animated.
- Orbital motion is simulation content, not decoration; `Space` pauses it.

## Touch targets

Mobile controls are ≥ 44 px (`h-11` chips, `size-10`+ buttons); the bottom
sheet drag handle is a 48×12 px target; horizontal chip rows scroll without
precision tapping.

## Known gaps

- The canvas render itself has no sonification/haptic description of
  spatial layout — the DOM layer is the accessible representation.
- Screen-reader users cannot *spatially* browse; the world list is flat
  (grouped, but not a tree).
- WebGL failure falls back to a static gradient with the UI fully usable.
