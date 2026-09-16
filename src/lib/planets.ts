/**
 * Simulation-clock and pace helpers — the only remaining presentation logic
 * from the original monolith. Canonical astronomical data lives in `src/data/`
 * (see docs/ARCHITECTURE.md); scene-scale mapping lives in `scene-scale.ts`.
 */
export const YEAR_SECONDS = 42;

export const DEFAULT_CAMERA = { x: 10.5, y: 12.5, z: 30.5 } as const;

export function formatSimClock(days: number): { years: number; day: number } {
  const years = Math.floor(days / 365.25);
  const day = Math.floor(days % 365.25) + 1;
  return { years, day };
}

export function speedToYearSeconds(speed: number): number {
  return YEAR_SECONDS / speed;
}

export function sliderToSpeed(t: number): number {
  return 0.25 * 2 ** (t * 6);
}

export function speedToSlider(speed: number): number {
  return Math.log2(speed / 0.25) / 6;
}

export function formatYearPace(speed: number): string {
  const sec = speedToYearSeconds(speed);
  if (sec >= 10) return `${sec.toFixed(0)}s / Earth year`;
  if (sec >= 1) return `${sec.toFixed(1)}s / Earth year`;
  return `${(1 / sec).toFixed(1)} years / s`;
}
