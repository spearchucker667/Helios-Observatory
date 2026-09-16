import type { SolarSystemRegion } from "../types.ts";
import { KUIPER_BELT } from "./kuiper-belt.ts";
import { OORT_CLOUD } from "./oort-cloud.ts";

export const REGIONS: SolarSystemRegion[] = [KUIPER_BELT, OORT_CLOUD];

export const REGION_BY_ID: Record<string, SolarSystemRegion> = Object.fromEntries(
  REGIONS.map((r) => [r.id, r])
);

export function regionById(id: string): SolarSystemRegion | undefined {
  return REGION_BY_ID[id];
}
