export const KM_PER_AU = 149597870.7;
export const M_PER_AU = 149597870700;
export const SECONDS_PER_DAY = 86400;

export function auToMeters(au: number): number {
  return au * M_PER_AU;
}

export function metersToAu(m: number): number {
  return m / M_PER_AU;
}

export function auPerDayToMetersPerSecond(auPerDay: number): number {
  return (auPerDay * M_PER_AU) / SECONDS_PER_DAY;
}

export function metersPerSecondToAuPerDay(mPerS: number): number {
  return (mPerS * SECONDS_PER_DAY) / M_PER_AU;
}
