import {
  AU_M,
  KM_PER_AU,
  DAY_S,
  SOLAR_MASS_KG,
  EARTH_MASS_KG,
  JUPITER_MASS_KG,
  SOLAR_RADIUS_M,
  EARTH_RADIUS_M,
  JUPITER_RADIUS_M,
} from "./constants.ts";

export { KM_PER_AU };
export const M_PER_AU = AU_M;
export const SECONDS_PER_DAY = DAY_S;

// Distance conversions
export function auToMeters(au: number): number {
  return au * AU_M;
}

export function metersToAu(m: number): number {
  return m / AU_M;
}

export function kmToMeters(km: number): number {
  return km * 1000;
}

export function metersToKm(m: number): number {
  return m / 1000;
}

export function metersToEarthRadii(m: number): number {
  return m / EARTH_RADIUS_M;
}

export function metersToSolarRadii(m: number): number {
  return m / SOLAR_RADIUS_M;
}

export function metersToJupiterRadii(m: number): number {
  return m / JUPITER_RADIUS_M;
}

// Velocity conversions
export function auPerDayToMetersPerSecond(auPerDay: number): number {
  return (auPerDay * AU_M) / DAY_S;
}

export function metersPerSecondToAuPerDay(mPerS: number): number {
  return (mPerS * DAY_S) / AU_M;
}

export function kmPerSecondToMetersPerSecond(kmS: number): number {
  return kmS * 1000;
}

export function metersPerSecondToKmPerSecond(mPerS: number): number {
  return mPerS / 1000;
}

// Mass conversions
export function kgToSolarMasses(kg: number): number {
  return kg / SOLAR_MASS_KG;
}

export function solarMassesToKg(mSun: number): number {
  return mSun * SOLAR_MASS_KG;
}

export function kgToEarthMasses(kg: number): number {
  return kg / EARTH_MASS_KG;
}

export function earthMassesToKg(mEarth: number): number {
  return mEarth * EARTH_MASS_KG;
}

export function kgToJupiterMasses(kg: number): number {
  return kg / JUPITER_MASS_KG;
}

export function jupiterMassesToKg(mJup: number): number {
  return mJup * JUPITER_MASS_KG;
}

// Temperature conversions
export function kelvinToCelsius(k: number): number {
  return k - 273.15;
}

export function celsiusToKelvin(c: number): number {
  return c + 273.15;
}

// Density calculations
export function calculateDensity(massKg: number, radiusM: number): number {
  if (radiusM <= 0) return 0;
  const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
  return massKg / volume;
}

export function calculateRadiusFromDensity(massKg: number, densityKgM3: number): number {
  if (densityKgM3 <= 0 || massKg <= 0) return 0;
  const volume = massKg / densityKgM3;
  return Math.cbrt((3 * volume) / (4 * Math.PI));
}

export function calculateMassFromDensity(radiusM: number, densityKgM3: number): number {
  if (radiusM <= 0 || densityKgM3 <= 0) return 0;
  const volume = (4 / 3) * Math.PI * Math.pow(radiusM, 3);
  return volume * densityKgM3;
}
