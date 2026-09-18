import type { SimulationBody } from "../domain/types.ts";
import { SNAPSHOT_INTERVAL_MS } from "../worker/simulation-host.ts";

interface BodyTrack {
  prev: [number, number, number] | null;
  prevAtMs: number;
  curr: [number, number, number];
  currAtMs: number;
}

/**
 * View-only render interpolation.
 *
 * The worker publishes authoritative state at ~30 Hz while the renderer may
 * paint at 60+ Hz, so body transforms are interpolated between the previous and
 * current authoritative snapshots. Interpolated values are NEVER written back
 * into simulation state — the physics only ever sees authoritative samples.
 */
const tracks = new Map<string, BodyTrack>();

/** Expected wall-clock gap between two authoritative snapshots. */
let referenceFrameMs = SNAPSHOT_INTERVAL_MS;

export function recordSnapshotFrame(
  bodies: Record<string, SimulationBody>,
  receivedAtMs: number
): void {
  for (const [id, body] of Object.entries(bodies)) {
    const curr: [number, number, number] = [body.position[0], body.position[1], body.position[2]];
    const existing = tracks.get(id);
    if (existing) {
      const gap = receivedAtMs - existing.currAtMs;
      if (gap > 0.5 && gap < 500) referenceFrameMs = gap;
      existing.prev = existing.curr;
      existing.prevAtMs = existing.currAtMs;
      existing.curr = curr;
      existing.currAtMs = receivedAtMs;
    } else {
      tracks.set(id, { prev: null, prevAtMs: receivedAtMs, curr, currAtMs: receivedAtMs });
    }
  }

  // Drop tracks for bodies that no longer exist.
  for (const id of Array.from(tracks.keys())) {
    if (!(id in bodies)) tracks.delete(id);
  }
}

/**
 * Samples an interpolated position for rendering.
 * @returns null when no authoritative sample exists for this body.
 */
export function sampleInterpolatedPosition(
  bodyId: string,
  nowMs: number,
  fallback: [number, number, number]
): [number, number, number] {
  const track = tracks.get(bodyId);
  if (!track) return fallback;
  if (!track.prev) return track.curr;

  const alpha = Math.max(0, Math.min(1, (nowMs - track.currAtMs) / referenceFrameMs));
  return [
    track.prev[0] + (track.curr[0] - track.prev[0]) * alpha,
    track.prev[1] + (track.curr[1] - track.prev[1]) * alpha,
    track.prev[2] + (track.curr[2] - track.prev[2]) * alpha,
  ];
}

/** Test/diagnostic helper. */
export function __getInterpolationReferenceMs(): number {
  return referenceFrameMs;
}

export function __resetInterpolation(): void {
  tracks.clear();
  referenceFrameMs = SNAPSHOT_INTERVAL_MS;
}
