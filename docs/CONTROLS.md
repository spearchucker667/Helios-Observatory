# Controls

## Pointer

| Gesture | Action |
| --- | --- |
| Drag | Orbit camera around the focus |
| Scroll / pinch | Zoom (clamped to avoid clipping bodies) |
| Click a body | Select + approach |
| Click a moon | Select the moon |

## Keyboard

| Key | Action |
| --- | --- |
| `Space` | Pause / resume simulation |
| `0` … `8` | Select Sun, Mercury … Neptune |
| `Backspace` | Return to parent (moon → planet → system view) |
| `Esc` | Close search/compare, then deselect |
| `R` | Reset system view |
| `L` | Toggle labels |
| `O` | Toggle orbital trails |
| `M` | Cycle moon mode: auto → always → hidden |
| `C` | Toggle compare-worlds dialog |
| `⌘K` / `Ctrl-K` | Search palette |
| `[` / `]` | Halve / double simulation pace |
| `Tab` / `Shift-Tab` | Move through controls (list, tabs, buttons) |

Inside the detail panel the tabs behave as a standard ARIA tablist: `Tab`
into the row, `←`/`→`-navigable via the buttons, `Enter`/`Space` activates.

## Search palette (`⌘K`)

Type to filter across:

- **Bodies** — all planets and 20 moons
- **Features** — Great Red Spot, Olympus Mons, Caloris Planitia, tiger
  stripes, …
- **Events** — "Shoemaker", "Huygens", "Voyager", …

`↑`/`↓` to move, `Enter` to jump to the body's context, `Esc` to close.

## Compare dialog (`C`)

Click chips to pick up to four bodies; the table updates live across nine
metrics (diameter, mass, gravity, density, mean temp, day, year, tilt, moon
count).

## Touch (mobile)

- Bottom horizontal scroll selects planets
- Tapping a body opens the **bottom sheet** with the same tabbed detail
- The drag-handle collapses the sheet; the footer returns while it's closed
- All touch targets meet 44 px

## Camera framing

- Focus distance scales with the body's **scene** radius, so inspecting
  Phobos zooms far closer than inspecting Jupiter
- `minDistance` scales with the focused radius — no clipping through
  surfaces, rings, or atmosphere shells
- Moons are tracked **exactly** (their orbital motion in accelerated time
  would outrun a lerped target)
