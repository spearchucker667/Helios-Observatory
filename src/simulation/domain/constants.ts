/**
/**
 * Authoritative Physical and Astronomical Constants
 *
 * References:
 * - IAU 2012 Resolution B2: Exact definition of the Astronomical Unit (149,597,870,700 m)
 * - NIST / CODATA 2022 recommended values:
 *     G = 6.67430(15) x 10^-11 m^3 kg^-1 s^-2
 *     c = 299,792,458 m s^-1 (exact SI definition)
 *     sigma = 5.670374419 x 10^-8 W m^-2 K^-4 (exact SI definition)
 * - NASA Planetary Fact Sheet / JPL Solar System Dynamics standards
 */

// Exact SI definitions
export const C_M_S = 299792458; // Speed of light in vacuum (m/s)
export const C_KM_S = 299792.458; // Speed of light (km/s)
export const DAY_S = 86400; // Standard ephemeris day in seconds
export const AU_M = 149597870700; // 1 AU in meters (IAU 2012 exact)
export const KM_PER_AU = 149597870.7; // 1 AU in kilometers

// Measured fundamental constants
export const G_CODATA_2022 = 6.67430e-11; // Universal gravitational constant (m^3 kg^-1 s^-2)
export const STEFAN_BOLTZMANN = 5.670374419e-8; // Stefan-Boltzmann constant (W m^-2 K^-4)

// Standard astrophysical reference constants (SI)
export const SOLAR_MASS_KG = 1.98847e30; // Solar mass M_sun (kg)
export const SOLAR_RADIUS_M = 6.957e8; // Solar nominal radius R_sun (m)
export const SOLAR_LUMINOSITY_W = 3.828e26; // Solar nominal luminosity L_sun (W)

export const EARTH_MASS_KG = 5.9722e24; // Earth mass M_earth (kg)
export const EARTH_RADIUS_M = 6.371e6; // Earth volumetric mean radius (m)

export const JUPITER_MASS_KG = 1.89813e27; // Jupiter mass M_jup (kg)
export const JUPITER_RADIUS_M = 6.9911e7; // Jupiter volumetric mean radius (m)

export const MOON_MASS_KG = 7.342e22; // Moon mass (kg)
export const MOON_RADIUS_M = 1.7374e6; // Moon mean radius (m)
