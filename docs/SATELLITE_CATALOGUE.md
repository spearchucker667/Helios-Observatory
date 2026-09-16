# Natural Satellite Catalogue Architecture

This document describes the design, ingestion pipeline, schema, and rendering architecture of Helios Observatory's natural satellite catalogue (`src/data/satellites/`).

---

## 1. Census Baseline (August 2026)

Helios incorporates the official natural satellite census across all eight major planets and Pluto as confirmed by the **International Astronomical Union (IAU) Minor Planet Center (MPC)** and the **NASA/JPL Solar System Dynamics Group**:

| Parent Body | Confirmed Satellites | Major / Tier-1 (3D Globe) | Regular Satellites | Irregular Satellites |
| :--- | :--- | :--- | :--- | :--- |
| **Earth** | 1 | 1 (Moon) | 0 | 0 |
| **Mars** | 2 | 2 (Phobos, Deimos) | 0 | 0 |
| **Jupiter** | 115 | 4 (Io, Europa, Ganymede, Callisto) | 4 (Amalthea group, etc.) | 107 (Himalia, Carme, Ananke, etc.) |
| **Saturn** | 293 | 7 (Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Iapetus) | 10 | 276 (Inuit, Gallic, Norse groups) |
| **Uranus** | 29 | 5 (Miranda, Ariel, Umbriel, Titania, Oberon) | 13 | 11 |
| **Neptune** | 16 | 1 (Triton) | 7 | 8 |
| **Pluto** | 5 | 1 (Charon) | 4 (Nix, Hydra, Kerberos, Styx) | 0 |
| **Total** | **461** | **21** | **38** | **402** |

---

## 2. Ingestion & Build Pipeline

The catalogue is built deterministically by `scripts/build-satellite-catalogue.mjs` and verified by `scripts/verify-satellite-catalogue.mjs`:
1. **Raw Snapshot Generation:** Compiles all 461 records into `src/data/satellites/generated/snapshot.json`.
2. **TypeScript Code Generation:** Emits `src/data/satellites/generated/catalogue.ts` containing the inlined, strongly typed TypeScript constant. This eliminates any Node ESM JSON import attribute incompatibilities between native Node test execution and Vite web bundling.
3. **Automated Verification:** The test suite `src/data/satellites/catalogue.test.ts` executes automatically during every `npm test` run to verify:
   - Exactly 461 total satellites (456 planetary + 5 Pluto).
   - Zero duplicated IDs.
   - Exact fidelity tier distribution: 21 Major (Tier 1), 38 Regular (Tier 2), and 402 Irregular (Tier 3).
   - All orbital semi-major axes $> 0\text{ km}$ and periods $> 0\text{ days}$.
   - All orbital eccentricities $0 \le e < 1$.
   - Valid lookups by parent ID (`satellitesOf`) and satellite ID (`satelliteById`).

---

## 3. Data Schema

Each satellite is modeled by `SatelliteCatalogueEntry` (`src/data/satellites/schema.ts`):
```typescript
export type SatelliteFidelity = "major" | "regular" | "irregular";

export type SatelliteCatalogueEntry = {
  id: string;
  name: string;
  designation?: string;
  parentId: string;
  fidelity: SatelliteFidelity;
  named: boolean;
  provisional: boolean;
  family?: string;
  discovery?: {
    year?: number;
    discoverer?: string;
  };
  orbit: {
    semiMajorAxisKm: number;
    periodDays: number;
    eccentricity: number;
    inclinationDeg: number;
    retrograde: boolean;
  };
  physical?: {
    meanRadiusKm?: number;
    diameterKm?: number;
    albedo?: number;
  };
  sourceIds: string[];
  asOf: string;
};
```

---

## 4. Tiered Rendering & Exploration

To balance visual performance with scientific completeness:
- **Tier 1 (Major Moons — 21 bodies):** Rendered in the 3D scene with custom procedural textures, surface feature markers, tidal locking, orbital trails, and direct camera tracking.
- **Tier 2 (Regular Satellites — 38 bodies):** Prograde, low-inclination satellites catalogued with physical estimates and orbital families.
- **Tier 3 (Irregular Satellites — 402 bodies):** Distant, eccentric, often retrograde captured planetesimals organized into dynamical families (e.g. Norse, Inuit, Pasiphae).
- **Explorer UI:** The **Moons** tab in the planet detail sheet provides instant filtering by fidelity tier, fuzzy search by name or designation, and one-click 3D camera focusing for major moons.

---

## 5. Scientific Data Integrity & Sparse Satellite Policy

Helios maintains institutional scientific honesty:
- **No Fabricated Telemetry:** Sparse and irregular satellites do NOT manufacture placeholder constants for unmeasured physical properties. Quantities like mass, surface gravity, escape velocity, mean density, rotation period, axial tilt, and mean surface temperature are strictly `undefined` if unobserved by instruments.
- **Honest UI Representation:** The UI inspection panels and formatters render unmeasured quantities as `"Unknown"` or `"—"`, refusing to mislead users with synthetic numbers.
- **Source Attribution:** Every satellite entry references institutional data sources (NASA/JPL SSD or MPC) with explicit timestamped provenance (`asOf`).
