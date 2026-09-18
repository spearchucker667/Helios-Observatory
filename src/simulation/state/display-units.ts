import {
  EARTH_MASS_KG,
  EARTH_RADIUS_M,
  SOLAR_MASS_KG,
  SOLAR_RADIUS_M,
} from "../domain/constants.ts";

export type MassDisplayUnit = "kg" | "earth" | "sun";
export type RadiusDisplayUnit = "m" | "km" | "earth" | "sun";

/** Converts an SI mass (kg) into the requested display unit. */
export function massToDisplay(kg: number, unit: MassDisplayUnit): number {
  switch (unit) {
    case "earth":
      return kg / EARTH_MASS_KG;
    case "sun":
      return kg / SOLAR_MASS_KG;
    case "kg":
    default:
      return kg;
  }
}

/** Converts a display-unit mass back into SI kilograms. */
export function massFromDisplay(value: number, unit: MassDisplayUnit): number {
  switch (unit) {
    case "earth":
      return value * EARTH_MASS_KG;
    case "sun":
      return value * SOLAR_MASS_KG;
    case "kg":
    default:
      return value;
  }
}

/** Converts an SI radius (m) into the requested display unit. */
export function radiusToDisplay(meters: number, unit: RadiusDisplayUnit): number {
  switch (unit) {
    case "km":
      return meters / 1000;
    case "earth":
      return meters / EARTH_RADIUS_M;
    case "sun":
      return meters / SOLAR_RADIUS_M;
    case "m":
    default:
      return meters;
  }
}

/** Converts a display-unit radius back into SI metres. */
export function radiusFromDisplay(value: number, unit: RadiusDisplayUnit): number {
  switch (unit) {
    case "km":
      return value * 1000;
    case "earth":
      return value * EARTH_RADIUS_M;
    case "sun":
      return value * SOLAR_RADIUS_M;
    case "m":
    default:
      return value;
  }
}
