# README Integration Snippets

## Static hero (recommended default)

```html
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/miku-space/helios-miku-lockup-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="public/assets/miku-space/helios-miku-lockup-light.svg" />
    <img src="public/assets/miku-space/helios-miku-lockup-dark.svg" alt="Helios Observatory — Miku orbital edition" width="900" />
  </picture>
</p>
```

## Animated README banner

```markdown
![Helios Observatory — Miku orbital telemetry](public/assets/miku-space/helios-miku-mission-control.gif)
```

Use the animated banner sparingly. Keep the static SVG hero above it as the primary identity because SVG is sharper, smaller, accessible, and respects reduced-motion expectations when the GIF is omitted.
