import type { SolarSystemRegion } from "../types.ts";

export const KUIPER_BELT: SolarSystemRegion = {
  id: "kuiper-belt",
  name: "Kuiper Belt",
  kind: "belt",
  radialAu: {
    innerMin: 30,
    innerMax: 39.5,
    outer: 50,
  },
  observationalStatus: "observed",
  summary:
    "Circumstellar disc of icy bodies, resonant and classical trans-Neptunian objects extending past Neptune (~30–50 AU), home to Pluto, Haumea, Makemake, and Arrokoth.",
  sourceIds: ["nasa-solar-system-exploration"],
  retrieved: "2026-08-15",
};
