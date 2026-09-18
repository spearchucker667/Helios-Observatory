import { useSandboxStore } from "./sandbox-store";
import type { SimulationBody } from "../domain/types.ts";

/**
 * Read-only browser QA bridge for the simulation sandbox.
 *
 * The sandbox's authoritative state lives in a Web Worker, so a browser
 * acceptance script cannot observe it through the DOM alone. When the page is
 * opened with `?qa=1`, this bridge exposes a *read-only* JSON view of the
 * main-thread mirror of worker state (`window.__heliosSandbox`).
 *
 * It never mutates simulation state and is never installed in normal use: the
 * explicit `qa` query parameter gates it.
 */

const HASH_DIGITS = 12;

function quantize(value: number): number {
  if (!Number.isFinite(value)) return Number.NaN;
  return Number(value.toPrecision(HASH_DIGITS));
}

function bodyHash(body: SimulationBody): string {
  const v = (vec: [number, number, number]) => vec.map(quantize).join(",");
  return [
    body.id,
    quantize(body.mass),
    quantize(body.radius),
    v(body.position),
    v(body.velocity),
    body.classification,
    body.gravityRole,
    body.provenance.mass.kind,
    body.provenance.radius.kind,
    body.provenance.state.kind,
  ].join("|");
}

export interface SandboxQaBody {
  id: string;
  name: string;
  classification: string;
  gravityRole: string;
  mass: number;
  radius: number;
  position: [number, number, number];
  velocity: [number, number, number];
  provenance: { mass: string; radius: string; state: string };
  schwarzschildRadiusM: number | null;
}

export interface SandboxQaSummary {
  /** Which transport is driving the authoritative world: a real Web Worker, the in-process host, or nothing yet. */
  transport: "worker" | "fallback" | "none";
  isInitialized: boolean;
  playbackState: string;
  paused: boolean;
  error: string | null;
  haltedReason: string | null;
  tick: number | null;
  simTimeSeconds: number | null;
  dtSeconds: number | null;
  multiplier: number;
  quality: string;
  achievedRateDaysPerSec: number | null;
  requestedRateDaysPerSec: number | null;
  isComputeLimited: boolean;
  enableRelativity: boolean;
  bodyCount: number;
  bodyIds: string[];
  scenarioId: string;
  scenarioName: string;
  hasUnsavedChanges: boolean;
  canUndo: boolean;
  canRedo: boolean;
  savedScenarios: Array<{ id: string; name: string }>;
  storageWarning: string | null;
  eventTypes: string[];
  worldHash: string;
  bodies: Record<string, SandboxQaBody>;
}

/** Serializes the current main-thread mirror of authoritative worker state. */
export function readSandboxQaSummary(): SandboxQaSummary {
  const s = useSandboxStore.getState();
  const bodies = Object.values(s.bodies).sort((a, b) => a.id.localeCompare(b.id));

  return {
    transport: s.client ? (s.client.fallbackMode ? "fallback" : "worker") : "none",
    isInitialized: s.isInitialized,
    playbackState: s.playbackState,
    paused: s.paused,
    error: s.error,
    haltedReason: s.haltedReason,
    tick: s.stats?.currentTick ?? s.snapshot?.tick ?? null,
    simTimeSeconds: s.stats?.simTimeSeconds ?? s.snapshot?.simTimeSeconds ?? null,
    dtSeconds: s.stats?.dtSeconds ?? s.snapshot?.dtSeconds ?? null,
    multiplier: s.multiplier,
    quality: s.quality,
    achievedRateDaysPerSec: s.stats?.achievedRateDaysPerSec ?? null,
    requestedRateDaysPerSec: s.stats?.requestedRateDaysPerSec ?? null,
    isComputeLimited: s.stats?.isComputeLimited ?? false,
    enableRelativity: s.enableRelativity,
    bodyCount: bodies.length,
    bodyIds: bodies.map((b) => b.id),
    scenarioId: s.scenarioId,
    scenarioName: s.scenarioName,
    hasUnsavedChanges: s.hasUnsavedChanges,
    canUndo: s.canUndo,
    canRedo: s.canRedo,
    savedScenarios: s.savedScenarios.map((x) => ({ id: x.id, name: x.name })),
    storageWarning: s.storageWarning ?? null,
    eventTypes: s.events.map((e) => e.eventType),
    worldHash: bodies.map(bodyHash).join("\n"),
    bodies: Object.fromEntries(
      bodies.map((b) => [
        b.id,
        {
          id: b.id,
          name: b.name,
          classification: b.classification,
          gravityRole: b.gravityRole,
          mass: b.mass,
          radius: b.radius,
          position: [b.position[0], b.position[1], b.position[2]] as [number, number, number],
          velocity: [b.velocity[0], b.velocity[1], b.velocity[2]] as [number, number, number],
          provenance: {
            mass: b.provenance.mass.kind,
            radius: b.provenance.radius.kind,
            state: b.provenance.state.kind,
          },
          schwarzschildRadiusM: b.compact?.schwarzschildRadiusM ?? null,
        },
      ]),
    ),
  };
}

export interface SandboxQaSession {
  checkpoint: { tick: number; simTimeSeconds: number; dtSeconds: number };
  initialState: { tick: number; simTimeSeconds: number; numBodies: number };
  commands: Array<{ tick: number; simTimeSeconds: number; type: string }>;
}

export interface SandboxQaBridge {
  summary: () => SandboxQaSummary;
  session: () => Promise<SandboxQaSession>;
}

declare global {
  interface Window {
    __heliosSandbox?: SandboxQaBridge;
  }
}

/** Installs the bridge only when the page was opened with `?qa=1`. */
export function installSandboxQaBridge(): () => void {
  if (typeof window === "undefined") return () => {};
  const params = new URLSearchParams(window.location.search);
  if (!params.has("qa")) return () => {};

  window.__heliosSandbox = {
    summary: readSandboxQaSummary,
    session: async () => {
      const client = useSandboxStore.getState().client;
      if (!client) throw new Error("Sandbox worker is not initialized");
      const session = await client.requestSession();
      return {
        checkpoint: {
          tick: session.checkpoint.tick,
          simTimeSeconds: session.checkpoint.simTimeSeconds,
          dtSeconds: session.checkpoint.dtSeconds,
        },
        initialState: {
          tick: session.initialState.tick,
          simTimeSeconds: session.initialState.simTimeSeconds,
          numBodies: session.initialState.bodies.length,
        },
        commands: session.commandLog.map((c) => ({
          tick: c.tick,
          simTimeSeconds: c.simTimeSeconds,
          type: c.command.type,
        })),
      };
    },
  };

  return () => {
    delete window.__heliosSandbox;
  };
}
