/**
 * Satellite catalogue schema and fidelity tiers
 */

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
