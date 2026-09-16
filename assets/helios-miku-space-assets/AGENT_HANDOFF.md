# Helios Observatory — Miku Space Asset Integration Agent Handoff

**Repository:** `spearchucker667/Helios-Observatory`  
**Target branch:** `main`  
**Asset pack:** `helios-miku-space-assets`  
**Objective:** integrate the supplied original SVG identity family and approved Miku-derived animations into the app and GitHub-facing documentation without degrading performance, accessibility, licensing clarity, or the existing Helios visual language.

---

## 1. Non-negotiable constraints

1. Work from current `main`; inspect the repository before editing.
2. Do not replace or imitate NASA's official seal, meatball insignia, or exact worm logotype. These assets are **space-agency / mission-control inspired** and must remain clearly unofficial.
3. Do not claim NASA, Crypton Future Media, Piapro, or Hatsune Miku endorsement/affiliation.
4. The SVG family is the canonical production identity. GIFs are optional decorative assets because the supplied Miku spritesheet contains no embedded license metadata.
5. Preserve Helios' existing dark instrument-like UI. Miku styling is an accent system, not a wholesale anime reskin.
6. Do not put animation behind critical information or use animation as the sole state indicator.
7. Respect `prefers-reduced-motion` and provide a static SVG/PNG alternative for every animated placement.
8. Do not weaken typecheck, lint, tests, build, browser smoke, data-integrity, or future CI gates.
9. Do not introduce base64 raster payloads into SVGs.
10. Optimize for GitHub rendering and app runtime separately: SVG first, GIF only where animation adds value.

---

## 2. Files supplied by this pack

### Canonical SVGs

Copy all files from `assets/svg/` to:

```text
public/assets/miku-space/
```

Primary files:

- `helios-miku-orbit-mark.svg` — canonical standalone mark
- `helios-miku-favicon.svg` — compact decorative/app mark
- `helios-miku-lockup-dark.svg` — dark-background README/app lockup
- `helios-miku-lockup-light.svg` — light-background counterpart
- `helios-miku-mission-patch.svg` — About/docs/contributor-facing mission patch
- `helios-miku-telemetry-badge.svg` — telemetry/status docs identifier
- `helios-miku-measurement-badge.svg` — Distance Lab identifier
- `helios-miku-moon-catalog-badge.svg` — all-moons/catalogue identifier
- `helios-miku-oort-frontier-badge.svg` — Oort Cloud identifier
- `helios-miku-readme-header.svg` — wide static README hero

### Animated GIFs

Copy only after rights review to:

```text
public/assets/miku-space/animated/
```

- `helios-miku-mission-control.gif`
- `helios-miku-orbit-runner.gif`
- `helios-miku-zero-g-idle.gif`
- `helios-miku-signal-scan.gif`
- `helios-miku-orbit-spinner.gif`
- `helios-miku-moon-catalog.gif`

Copy matching `*-static.png` files as reduced-motion / non-animation fallbacks.

---

## 3. Required repository governance: add CODEOWNERS

Create **`.github/CODEOWNERS`**. The pack contains a ready-to-copy example at `implementation/github/CODEOWNERS`.

Minimum required file:

```text
# Helios Observatory ownership
* @spearchucker667

/public/assets/ @spearchucker667
/screenshots/ @spearchucker667
/README.md @spearchucker667
/docs/ @spearchucker667
/src/data/ @spearchucker667
/.github/ @spearchucker667
```

Validation:

```bash
test -f .github/CODEOWNERS
grep -F '/public/assets/' .github/CODEOWNERS
grep -F '/README.md' .github/CODEOWNERS
```

If repository ownership later expands, replace the single account with teams such as `@org/docs`, `@org/astronomy-data`, and `@org/frontend`; do not leave stale usernames silently owning protected paths.

---

## 4. README integration

Update `README.md` with a static responsive hero first. Prefer this over using a GIF as the topmost visual.

```html
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/assets/miku-space/helios-miku-lockup-dark.svg" />
    <source media="(prefers-color-scheme: light)" srcset="public/assets/miku-space/helios-miku-lockup-light.svg" />
    <img
      src="public/assets/miku-space/helios-miku-lockup-dark.svg"
      alt="Helios Observatory — Miku orbital edition"
      width="900"
    />
  </picture>
</p>
```

Below the feature summary, optionally add:

```markdown
### Orbital telemetry mascot

![Helios Observatory Miku orbital telemetry](public/assets/miku-space/animated/helios-miku-mission-control.gif)
```

Do not put more than one large animated GIF above the fold. GitHub README pages become expensive quickly, especially on mobile.

Add a short public disclaimer near the visual identity section:

```markdown
> Helios Observatory is an unofficial project. Space-agency styling and Miku-inspired visual elements do not imply affiliation with or endorsement by NASA, Crypton Future Media, or Piapro.
```

---

## 5. App integration

### 5.1 Add a small brand component

Use the supplied `implementation/react/HeliosMikuBrand.tsx` as the baseline. It chooses a GIF only when animation is requested and the user has not enabled reduced motion.

Recommended placement:

- About/credits dialog
- loading or simulation-ready status **as decoration only**
- empty-state illustration for Moon Catalog / Oort Frontier / Distance Lab
- desktop footer or settings area

Avoid placing the mascot over the Three.js canvas in a way that intercepts pointer input.

### 5.2 Recommended component shape

```tsx
import { useEffect, useState } from "react";

type HeliosMikuBrandProps = {
  animated?: boolean;
  className?: string;
};

export function HeliosMikuBrand({ animated = false, className }: HeliosMikuBrandProps) {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const src = animated && !reduceMotion
    ? "/assets/miku-space/animated/helios-miku-orbit-spinner.gif"
    : "/assets/miku-space/helios-miku-favicon.svg";

  return (
    <img
      src={src}
      width={48}
      height={48}
      alt=""
      aria-hidden="true"
      className={className}
      decoding="async"
    />
  );
}
```

Decorative instances must use `alt=""` and `aria-hidden="true"`. Only a standalone meaningful brand image should have descriptive alt text.

---

## 6. Feature-specific usage

### Moon Catalog

Use `helios-miku-moon-catalog-badge.svg` in the complete-satellite catalogue introduction, not as a substitute for the moon data itself.

Suggested markup:

```tsx
<img
  src="/assets/miku-space/helios-miku-moon-catalog-badge.svg"
  alt=""
  aria-hidden="true"
  className="h-auto w-full max-w-md"
/>
```

### Oort Frontier

Use `helios-miku-oort-frontier-badge.svg` in the Oort Cloud information panel and `helios-miku-signal-scan.gif` only for optional onboarding/empty-state animation.

### Distance Lab

Use `helios-miku-measurement-badge.svg` in the interactive measurement control/help surface. Keep scientific values in semantic DOM text; never bake numbers into decorative graphics.

---

## 7. Asset loading and performance

1. **SVG:** normal `<img>` loading is sufficient. Do not import SVG XML into the React bundle unless the app needs to manipulate individual paths.
2. **GIF:** lazy-load below-the-fold animation:

```tsx
<img
  src="/assets/miku-space/animated/helios-miku-moon-catalog.gif"
  loading="lazy"
  decoding="async"
  alt=""
  aria-hidden="true"
/>
```

3. Do not preload every GIF.
4. Keep the animated spinner small in rendered CSS dimensions; the larger source exists to avoid ugly scaling.
5. For an in-app animation that becomes visible/invisible repeatedly, prefer CSS or a future WebP/AVIF animation conversion rather than repeatedly decoding a large GIF.
6. If bundle/performance budgets reject GIFs, remove them from the app and retain them only in GitHub docs. The SVGs remain canonical.

---

## 8. Accessibility

Required checks:

- No flashing faster than 3 Hz.
- Animated assets contain no essential state.
- `prefers-reduced-motion: reduce` receives static alternatives.
- Decorative images use empty alt text.
- Logo/lockup images used as actual page identity have concise descriptive alt text.
- Do not place light SVGs on insufficient-contrast surfaces.
- Do not use teal/magenta alone to encode scientific categories.

Add a note to `docs/ACCESSIBILITY.md` explaining that mascot animation is decorative and replaced/suppressed under reduced motion.

---

## 9. Documentation updates

Update or create:

```text
README.md
CHANGELOG.md
docs/ASSET_PIPELINE.md
docs/ASSET_ATTRIBUTION.md
docs/ACCESSIBILITY.md
docs/SCREENSHOTS.md
```

`docs/ASSET_PIPELINE.md` must state:

- SVG identity assets are original vector art.
- SVG files contain no raster payloads.
- Miku-derived GIFs are a separate provenance class.
- GIF publication requires source-rights verification.
- GIFs have static fallbacks.

`docs/ASSET_ATTRIBUTION.md` should distinguish:

```text
Original Helios vector assets
Third-party/reference-derived mascot animation
Institutional scientific imagery, if ever added later
```

Do not say "zero third-party imagery" if derived Miku GIFs are actually committed.

---

## 10. Legal / naming guardrails

The current pack avoids official NASA marks. Preserve that decision.

Do not rename a file or visible lockup to `NASA Miku`, `NASA × Miku`, or anything implying a real collaboration unless independently authorized.

Preferred phrases:

- `space-agency inspired`
- `mission-control inspired`
- `Miku orbital edition`
- `unofficial fan-inspired visual identity`

The supplied source archive includes no license file. Record this in the repo's asset attribution docs if any derived GIF is committed.

---

## 11. Asset integrity tests

Add a simple validation script or test that ensures required vectors exist and contain no embedded raster URLs/base64.

Example Node test:

```ts
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

const REQUIRED = [
  "public/assets/miku-space/helios-miku-orbit-mark.svg",
  "public/assets/miku-space/helios-miku-lockup-dark.svg",
  "public/assets/miku-space/helios-miku-lockup-light.svg",
  "public/assets/miku-space/helios-miku-mission-patch.svg",
];

describe("Miku-space SVG assets", () => {
  for (const path of REQUIRED) {
    it(`${path} is scalable vector-only SVG`, async () => {
      const svg = await readFile(path, "utf8");
      assert.match(svg, /<svg\b/);
      assert.match(svg, /viewBox=/);
      assert.doesNotMatch(svg, /data:image\//i);
      assert.doesNotMatch(svg, /<image\b/i);
    });
  }
});
```

If added as `src/...test.ts`, include it in the repository's actual test command rather than leaving an orphan test file.

---

## 12. CI expectations

The integration must pass:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

If CI workflows were added by the larger Helios audit, ensure the asset-integrity test executes there. Do not add a separate workflow solely for artwork unless there is a clear maintenance benefit.

Add a cheap repository-size check if GIF growth becomes material:

```bash
find public/assets/miku-space -type f -size +5M -print -quit | grep -q . \
  && { echo "Miku-space asset exceeds 5 MiB"; exit 1; } \
  || true
```

Tune the threshold only after measuring actual deployment constraints.

---

## 13. Manual visual QA

Inspect at minimum:

- GitHub README light mode
- GitHub README dark mode
- app desktop 1440×900
- app desktop 1280×800
- mobile 390×844
- reduced-motion enabled
- 200% browser zoom

Verify:

- no SVG clipping
- no blurry upscaling
- no text collision with badges
- GIFs do not create layout shift (explicit width/height/aspect ratio)
- mascot does not obscure astronomy data
- dark/light lockups retain adequate contrast
- mobile pages do not horizontally overflow

---

## 14. Suggested commit sequence

1. `chore(brand): add miku-space vector asset family`
2. `docs(brand): integrate helios miku identity and attribution`
3. `feat(ui): add reduced-motion-safe miku brand accents`
4. `chore(github): add CODEOWNERS asset ownership`
5. Only after rights verification: `chore(brand): add approved miku mascot animations`

Keep the derived GIF commit separable so it can be reverted without removing the original SVG identity system.

---

## 15. Definition of done

- [ ] All original SVGs copied into `public/assets/miku-space/`
- [ ] SVGs render cleanly at 16 px, 48 px, 256 px, and README width
- [ ] README uses dark/light SVG lockup
- [ ] Optional animation is below the fold
- [ ] App uses static fallback under reduced motion
- [ ] Moon Catalog, Oort Frontier, and Distance Lab badges are integrated where those features exist
- [ ] `docs/ASSET_PIPELINE.md` and `docs/ASSET_ATTRIBUTION.md` reflect the new provenance model
- [ ] Public disclaimer does not imply NASA/Crypton/Piapro affiliation
- [ ] `.github/CODEOWNERS` exists and owns brand/docs paths
- [ ] asset integrity tests run in normal `npm test`
- [ ] typecheck/lint/test/build all pass
- [ ] desktop/mobile/reduced-motion visual QA passes
- [ ] derived GIF licensing is explicitly approved before public distribution

Do not mark the asset integration complete if the SVGs exist only on disk but are unused, if CODEOWNERS is missing, if documentation still claims zero third-party imagery after GIFs are added, or if reduced-motion users are forced to load/view decorative animation.
