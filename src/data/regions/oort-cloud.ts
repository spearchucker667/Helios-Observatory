import type { SolarSystemRegion } from "../types.ts";

export const OORT_CLOUD: SolarSystemRegion = {
  id: "oort-cloud",
  name: "Oort Cloud",
  kind: "shell",
  radialAu: {
    innerMin: 2000,
    innerMax: 5000,
    outer: 100000,
  },
  observationalStatus: "inferred",
  summary:
    "Hypothesized isotropic spherical cloud of trillions of icy planetesimals surrounding the Sun from ~2,000–5,000 AU out to ~100,000 AU. Inferred from long-period comet orbital mechanics; never directly imaged.",
  sourceIds: ["nasa-oort-cloud", "nasa-solar-system-exploration"],
  retrieved: "2026-08-15",
};
