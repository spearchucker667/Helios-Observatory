/**
 * Presentation formatting for canonical astronomical quantities.
 *
 * These helpers are the single place where scientific numbers become display
 * strings — components never hand-format physical data. Units follow the
 * user's selection (metric / astronomical / earth-relative) when relevant.
 */

export type UnitSystem = "metric" | "astronomical" | "earth";

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmt(n: number, d: Intl.NumberFormat): string {
  return d.format(n);
}

/** Diameter/distance in km with an Earth-relative companion when asked. */
export function formatDiameter(km: number, units: UnitSystem): string {
  if (units === "earth") {
    return `${fmt(km / 12_742, nf2)} Earth diameters`;
  }
  return `${fmt(km, nf0)} km`;
}

/** Distance: AU for astronomical units, km with M-notation for metric. */
export function formatDistance(
  au: number | undefined,
  km: number | undefined,
  units: UnitSystem,
): string {
  if (units === "astronomical" && au !== undefined) {
    return `${fmt(au, nf2)} AU`;
  }
  if (km !== undefined) {
    if (km >= 1e6) return `${fmt(km / 1e6, nf1)}M km`;
    return `${fmt(km, nf0)} km`;
  }
  if (au !== undefined) {
    const km = au * 149_597_870.7;
    return km >= 1e6 ? `${fmt(km / 1e6, nf1)}M km` : `${fmt(km, nf0)} km`;
  }
  return "—";
}

/** Surface gravity, Earth-relative by nature. */
export function formatGravity(g: number, units: UnitSystem): string {
  if (units === "metric") return `${fmt(g * 9.807, nf1)} m/s²`;
  return `${fmt(g, nf2)} g`;
}

/** Temperature in °C; °F companion available for accessibility. */
export function formatTemperature(c: number): string {
  return `${fmt(c, nf0)} °C`;
}

export function formatTemperatureF(c: number): string {
  return `${fmt((c * 9) / 5 + 32, nf0)} °F`;
}

/** Rotation/sidereal day from hours: handles retrograde and sub-hour bodies. */
export function formatDayLength(hours: number): string {
  const sign = hours < 0 ? "−" : "";
  const h = Math.abs(hours);
  if (h < 1) return `${sign}${fmt(h * 60, nf0)} min`;
  if (h < 48) {
    const whole = Math.floor(h);
    const mins = Math.round((h - whole) * 60);
    return mins === 0
      ? `${sign}${whole} h`
      : `${sign}${whole} h ${fmt(mins, nf0)} m`;
  }
  const days = h / 24;
  return `${sign}${fmt(days, nf1)} days`;
}

/** Orbital period in natural units. */
export function formatYearLength(days: number): string {
  if (days < 400) return `${fmt(days, nf1)} days`;
  return `${fmt(days / 365.25, nf1)} years`;
}

/** Mass, preferring the Earth-relative view. */
export function formatMass(
  earths: number | undefined,
  kg24: number | undefined,
  units: UnitSystem,
): string {
  if (units !== "metric" && earths !== undefined) {
    return `${fmt(earths, nf2)} × Earth`;
  }
  if (kg24 !== undefined) return `${fmt(kg24, nf2)} × 10²⁴ kg`;
  return "—";
}

/**
 * Escape velocity in km/s; adds a friendly comparison above 10 km/s.
 */
export function formatEscapeVelocity(kmS: number): string {
  return `${fmt(kmS, nf2)} km/s`;
}

/** Density in g/cm³. */
export function formatDensity(gCm3: number): string {
  return `${fmt(gCm3, nf2)} g/cm³`;
}

/** Axial tilt in degrees. */
export function formatTilt(deg: number): string {
  return `${fmt(deg, nf1)}°`;
}

/** Orbital eccentricity, 3 decimals. */
export function formatEccentricity(e: number | undefined): string {
  return e === undefined ? "—" : e.toFixed(3);
}

/**
 * A compact "scale honesty" tag: which scale regime the current scene is in.
 * Never implies the default view is physically to scale.
 */
export const SCALE_MODE_LABELS = {
  presentation: "Presentation view — not to scale",
  "relative-size": "Relative size — planet radii true ratio",
  distance: "Orbital distance — spacing true ratio",
} as const;

export type ScaleMode = keyof typeof SCALE_MODE_LABELS;
