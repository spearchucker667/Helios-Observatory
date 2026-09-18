import { create } from "zustand";
import type { SimulationBody } from "../domain/types.ts";
import type { SimulationCommand } from "../engine/commands.ts";
import type { SimulationEvent } from "../engine/events.ts";
import type { RenderSnapshot, SimulationCheckpoint, WorldSnapshot } from "../engine/snapshot.ts";
import { ENGINE_VERSION } from "../engine/engine-version.ts";
import type { PlaybackState, TimestepQuality, TimestepStats } from "../engine/timestep.ts";
import { WorkerClient } from "../worker/worker-client.ts";
import { createCanonicalSolarSystem } from "../initialization/canonical-adapter.ts";
import { PRESETS } from "../domain/presets.ts";
import { evaluateCompactObjectField } from "../engine/compact-objects.ts";
import { saveScenario, listScenarios, loadScenario, deleteScenario } from "../scenarios/storage.ts";
import { ScenarioDocumentSchema, type ScenarioDocument } from "../scenarios/schema.ts";
import { serializeScenario, deserializeScenario } from "../scenarios/serialize.ts";
import { buildBodyEditCommands, validateEditCommands } from "./edit-commands.ts";
import { recordSnapshotFrame } from "./render-interpolation.ts";
import { validateBodyDraft, normalizeCompactInvariants } from "./editor-validation.ts";

export type DisplayMode = "presentation" | "relative-size" | "distance";
export type InspectorTab = "state" | "physical" | "orbit" | "environment" | "events" | "provenance";

interface UndoEntry {
  checkpoint: SimulationCheckpoint;
  commands: SimulationCommand[];
  label: string;
}

export interface SandboxState {
  client: WorkerClient | null;
  isInitialized: boolean;
  snapshot: RenderSnapshot | null;
  bodies: Record<string, SimulationBody>;
  stats: TimestepStats | null;
  events: SimulationEvent[];
  trajectories: Record<string, [number, number, number][]>;

  // Selection & UI navigation
  selectedId: string | null;
  hoverId: string | null;
  inspectorTab: InspectorTab;
  displayMode: DisplayMode;
  showTrajectories: boolean;
  showVectors: boolean;
  showLabels: boolean;
  showOrbits: boolean;

  // Editing state
  isEditing: boolean;
  bodyDraft: SimulationBody | null;
  draftErrors: Record<string, string>;

  // Scenario state
  scenarioId: string;
  scenarioName: string;
  initialBodies: SimulationBody[];
  initialSnapshot: WorldSnapshot | null;
  canUndo: boolean;
  canRedo: boolean;
  hasUnsavedChanges: boolean;
  savedScenarios: Array<{ id: string; name: string; updatedAt: string }>;
  scenarioModalOpen: boolean;
  storageWarning: string | null;

  // Playback & accuracy (mirrors of authoritative worker state)
  playbackState: PlaybackState;
  paused: boolean;
  multiplier: number;
  quality: TimestepQuality;
  strongFieldWarning: boolean;
  enableRelativity: boolean;
  error: string | null;
  haltedReason: string | null;

  // Actions
  init: () => void;
  cleanup: () => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepOnce: () => void;
  setMultiplier: (mult: number) => void;
  setQuality: (quality: TimestepQuality) => void;
  setEnableRelativity: (enabled: boolean) => void;

  selectBody: (id: string | null) => void;
  hoverBody: (id: string | null) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  setDisplayMode: (mode: DisplayMode) => void;
  toggleTrajectories: () => void;
  toggleVectors: () => void;
  toggleLabels: () => void;
  toggleOrbits: () => void;
  requestTrajectory: (id: string) => void;

  startEditing: (bodyId?: string) => void;
  cancelEditing: () => void;
  updateDraft: (patch: Partial<SimulationBody>) => void;
  saveDraft: () => boolean;

  removeBody: (id: string) => void;
  duplicateBody: (id: string) => void;
  addPreset: (presetKey: string) => void;
  applyImpulse: (id: string, impulseMs: [number, number, number]) => void;

  undo: () => void;
  redo: () => void;
  resetScenario: () => void;

  openScenarioModal: () => void;
  closeScenarioModal: () => void;
  refreshSavedScenarios: () => Promise<void>;
  saveCurrentScenario: (name?: string) => Promise<void>;
  loadScenarioById: (id: string) => Promise<void>;
  loadScenarioDocument: (doc: ScenarioDocument) => { success: boolean; error?: string };
  deleteSavedScenario: (id: string) => Promise<void>;
  exportScenarioJson: () => Promise<string>;
  importScenarioJson: (jsonStr: string) => { success: boolean; error?: string };
}

let activeClient: WorkerClient | null = null;
let undoStack: UndoEntry[] = [];
let redoStack: UndoEntry[] = [];

function bodiesToRecord(bodies: SimulationBody[]): Record<string, SimulationBody> {
  const record: Record<string, SimulationBody> = {};
  for (const b of bodies) record[b.id] = b;
  return record;
}

function newScenarioId(): string {
  return `scen-${Date.now().toString(36)}`;
}

export const useSandboxStore = create<SandboxState>((set, get) => ({
  client: null,
  isInitialized: false,
  snapshot: null,
  bodies: {},
  stats: null,
  events: [],
  trajectories: {},

  selectedId: null,
  hoverId: null,
  inspectorTab: "state",
  displayMode: "presentation",
  showTrajectories: true,
  showVectors: true,
  showLabels: true,
  showOrbits: true,

  isEditing: false,
  bodyDraft: null,
  draftErrors: {},

  scenarioId: newScenarioId(),
  scenarioName: "Default Solar System",
  initialBodies: [],
  initialSnapshot: null,
  canUndo: false,
  canRedo: false,
  hasUnsavedChanges: false,
  savedScenarios: [],
  scenarioModalOpen: false,
  storageWarning: null,

  playbackState: "uninitialized",
  paused: true,
  multiplier: 86400, // 1 day / sec
  quality: "standard",
  strongFieldWarning: false,
  enableRelativity: false,
  error: null,
  haltedReason: null,

  init: () => {
    if (activeClient) {
      activeClient.terminate();
    }
    undoStack = [];
    redoStack = [];

    const client = new WorkerClient();
    activeClient = client;

    const initial = createCanonicalSolarSystem();

    client.onSnapshot((snap) => {
      const currentBodies = { ...get().bodies };
      let anyStrongField = false;
      const activeIds = new Set(snap.bodyIds);

      for (const id of Object.keys(currentBodies)) {
        if (!activeIds.has(id)) {
          delete currentBodies[id];
        }
      }

      for (let i = 0; i < snap.numBodies; i++) {
        const id = snap.bodyIds[i];
        let b = currentBodies[id];
        if (!b) {
          // The render snapshot is render-only; authoritative metadata arrives
          // via WORLD_CHANGED. Until then this placeholder is explicitly
          // marked unsupported rather than invented.
          b = {
            id,
            name: snap.names[i] || id,
            classification: (snap.classes[i] as SimulationBody["classification"]) || "asteroid",
            gravityRole: snap.isTracer[i] ? "tracer" : "massive",
            mass: snap.masses[i],
            radius: snap.radii[i],
            position: [snap.positions[i * 3], snap.positions[i * 3 + 1], snap.positions[i * 3 + 2]],
            velocity: [snap.velocities[i * 3], snap.velocities[i * 3 + 1], snap.velocities[i * 3 + 2]],
            color: snap.colors[i] || "#fbbf24",
            provenance: {
              mass: { kind: "unsupported", note: "Awaiting authoritative domain state (WORLD_CHANGED)" },
              radius: { kind: "unsupported", note: "Awaiting authoritative domain state (WORLD_CHANGED)" },
              state: { kind: "unsupported", note: "Awaiting authoritative domain state (WORLD_CHANGED)" },
            },
          };
          currentBodies[id] = b;
        } else {
          b.position = [snap.positions[i * 3], snap.positions[i * 3 + 1], snap.positions[i * 3 + 2]];
          b.velocity = [snap.velocities[i * 3], snap.velocities[i * 3 + 1], snap.velocities[i * 3 + 2]];
          b.mass = snap.masses[i];
          b.radius = snap.radii[i];
        }

        if (
          b.classification === "black-hole" ||
          b.classification === "neutron-star" ||
          b.classification === "pulsar" ||
          b.classification === "magnetar"
        ) {
          for (let j = 0; j < snap.numBodies; j++) {
            if (i === j) continue;
            const dx = snap.positions[i * 3] - snap.positions[j * 3];
            const dy = snap.positions[i * 3 + 1] - snap.positions[j * 3 + 1];
            const dz = snap.positions[i * 3 + 2] - snap.positions[j * 3 + 2];
            const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (evaluateCompactObjectField(b, dist).isStrongFieldRegime) {
              anyStrongField = true;
            }
          }
        }
      }

      // Feed the view-only interpolation buffer (render smoothing only).
      recordSnapshotFrame(currentBodies, Date.now());

      set({
        snapshot: snap,
        bodies: currentBodies,
        strongFieldWarning: anyStrongField,
      });
    });

    // Authoritative domain state: full body records including provenance and
    // derived compact fields, emitted whenever world structure changes.
    client.onWorldChanged((bodies) => {
      const record = bodiesToRecord(bodies);
      const selectedId = get().selectedId;
      set({
        bodies: record,
        selectedId: selectedId && record[selectedId] ? selectedId : (Object.keys(record)[0] ?? null),
      });
    });

    client.onEvent((event) => {
      set((s) => ({
        events: [event, ...s.events].slice(0, 200),
      }));
    });

    client.onTrajectory((bodyId, trajectory) => {
      set((s) => ({
        trajectories: {
          ...s.trajectories,
          [bodyId]: trajectory,
        },
      }));
    });

    client.onPerformance((stats) => {
      set({
        stats,
        playbackState: stats.state,
        paused: stats.state !== "running",
        multiplier: stats.timeMultiplier,
        quality: stats.quality,
      });
    });

    client.onPlaybackState((state) => {
      set({ playbackState: state, paused: state !== "running" });
    });

    client.onError((error, code) => {
      set({ error });
      if (code === "HALTED" || code === "NOT_INITIALIZED") {
        set({ haltedReason: error });
      }
    });

    client.onHalt((reason) => {
      set({ haltedReason: reason, error: reason, paused: true, playbackState: "halted" });
    });

    client.initialize(initial, 900, 0, 0, false);
    client.setTimeMultiplier(86400);

    set({
      client,
      isInitialized: true,
      bodies: bodiesToRecord(initial),
      initialBodies: initial.map((b) => structuredClone(b)),
      initialSnapshot: null,
      scenarioId: newScenarioId(),
      scenarioName: "Default Solar System",
      paused: true,
      playbackState: "paused",
      multiplier: 86400,
      quality: "standard",
      selectedId: "earth",
      canUndo: false,
      canRedo: false,
      hasUnsavedChanges: false,
      error: null,
      haltedReason: null,
    });

    get().refreshSavedScenarios();
  },

  cleanup: () => {
    if (activeClient) {
      activeClient.terminate();
      activeClient = null;
    }
    undoStack = [];
    redoStack = [];
    set({ client: null, isInitialized: false, canUndo: false, canRedo: false });
  },

  play: () => {
    const { client } = get();
    if (!client) return;
    client.resume();
  },

  pause: () => {
    const { client } = get();
    if (!client) return;
    client.pause();
  },

  togglePlay: () => {
    const { paused, play, pause } = get();
    if (paused) play();
    else pause();
  },

  stepOnce: () => {
    const { client } = get();
    if (!client) return;
    client.stepOnce();
  },

  setMultiplier: (mult: number) => {
    const { client } = get();
    if (!client) return;
    if (!Number.isFinite(mult)) return;
    const clamped = Math.max(1, Math.min(mult, 86400 * 365));
    client.setTimeMultiplier(clamped);
  },

  setQuality: (quality: TimestepQuality) => {
    const { client } = get();
    if (!client) return;
    client.setQuality(quality);
  },

  setEnableRelativity: (enabled: boolean) => {
    const { client } = get();
    set({ enableRelativity: enabled });
    if (client) {
      // Configuration change travels as an authoritative, replayable command.
      client.sendCommand({ type: "set_relativity", enabled });
      client.setRelativity(enabled);
    }
    if (get().selectedId) {
      get().requestTrajectory(get().selectedId!);
    }
  },

  selectBody: (id: string | null) => {
    set({ selectedId: id });
    if (id) {
      get().requestTrajectory(id);
    }
  },

  hoverBody: (id: string | null) => {
    set({ hoverId: id });
  },

  setInspectorTab: (tab: InspectorTab) => {
    set({ inspectorTab: tab });
  },

  setDisplayMode: (mode: DisplayMode) => {
    set({ displayMode: mode });
  },

  toggleTrajectories: () => set((s) => ({ showTrajectories: !s.showTrajectories })),
  toggleVectors: () => set((s) => ({ showVectors: !s.showVectors })),
  toggleLabels: () => set((s) => ({ showLabels: !s.showLabels })),
  toggleOrbits: () => set((s) => ({ showOrbits: !s.showOrbits })),

  requestTrajectory: (id: string) => {
    const { client } = get();
    if (!client) return;
    client.requestTrajectory(id, 200, 3600);
  },

  startEditing: (bodyId?: string) => {
    const targetId = bodyId ?? get().selectedId;
    if (!targetId) return;
    const body = get().bodies[targetId];
    if (!body) return;

    // Edits are only ever made from a paused, checkpointed world so undo can
    // restore exact authoritative state.
    get().pause();

    set({
      isEditing: true,
      bodyDraft: structuredClone(body),
      draftErrors: {},
    });
  },

  cancelEditing: () => {
    set({ isEditing: false, bodyDraft: null, draftErrors: {} });
  },

  updateDraft: (patch: Partial<SimulationBody>) => {
    const { bodyDraft } = get();
    if (!bodyDraft) return;
    set({
      bodyDraft: {
        ...bodyDraft,
        ...patch,
      },
    });
  },

  saveDraft: () => {
    const { bodyDraft, client, bodies } = get();
    if (!bodyDraft || !client) return false;

    const validation = validateBodyDraft(bodyDraft);
    if (!validation.valid) {
      set({ draftErrors: validation.errors });
      return false;
    }

    const normalized = normalizeCompactInvariants(bodyDraft);
    const existing = bodies[normalized.id];
    const commands = buildBodyEditCommands(existing, normalized);

    const guard = validateEditCommands(commands, new Set(Object.keys(bodies)));
    if (!guard.ok) {
      set({ draftErrors: { draft: guard.error } });
      return false;
    }

    get().pause();

    // Checkpoint BEFORE the edit so undo restores the exact pre-edit world,
    // including simulation time that had already elapsed.
    void recordUndoCheckpoint(commands, `edit ${normalized.name}`)
      .then(() => {
        if (commands.length === 0) {
          // A no-op save still created a checkpoint; discard it.
          undoStack.pop();
          syncUndoFlags();
          set({ isEditing: false, bodyDraft: null, draftErrors: {} });
          return;
        }
        for (const command of commands) client.sendCommand(command);
        // Authoritative state arrives via WORLD_CHANGED; the store never
        // applies its own optimistic copy of a physics edit.
        set({
          isEditing: false,
          bodyDraft: null,
          draftErrors: {},
          hasUnsavedChanges: true,
        });
      })
      .catch((err: unknown) => {
        set({ draftErrors: { draft: err instanceof Error ? err.message : String(err) } });
      });

    return true;
  },

  removeBody: (id: string) => {
    const { client, bodies, selectedId } = get();
    if (!client) return;
    const commands: SimulationCommand[] = [{ type: "delete_body", id }];
    get().pause();
    void recordUndoCheckpoint(commands, `delete ${bodies[id]?.name ?? id}`).then(() => {
      client.sendCommand(commands[0]);
      const newBodies = { ...bodies };
      delete newBodies[id];
      set({
        bodies: newBodies,
        selectedId: selectedId === id ? null : selectedId,
        hasUnsavedChanges: true,
      });
    });
  },

  duplicateBody: (id: string) => {
    const { client, bodies } = get();
    const source = bodies[id];
    if (!client || !source) return;

    const newId = `${source.id}-copy-${Date.now().toString(36).slice(-4)}`;
    const newBody: SimulationBody = {
      ...structuredClone(source),
      id: newId,
      name: `${source.name} (Copy)`,
      position: [source.position[0] * 1.05, source.position[1] * 1.05, source.position[2]],
      provenance: {
        ...source.provenance,
        state: { kind: "custom", note: `Duplicated from ${source.name}` },
      },
    };

    const commands: SimulationCommand[] = [
      {
        type: "add_body",
        body: newBody,
      },
    ];

    get().pause();
    void recordUndoCheckpoint(commands, `duplicate ${source.name}`)
      .then(() => {
        client.sendCommand(commands[0]);
        set({
          bodies: {
            ...bodies,
            [newId]: newBody,
          },
          selectedId: newId,
          hasUnsavedChanges: true,
        });
      })
      .catch((err: unknown) => {
        set({ error: err instanceof Error ? err.message : String(err) });
      });
  },

  addPreset: (presetKey: string) => {
    const { client, bodies } = get();
    if (!client) return;

    const preset = PRESETS.find((p) => p.id === presetKey);
    if (!preset) return;

    const newBody = preset.createBody({
      id: `${presetKey.replace("preset-", "")}-${Date.now().toString(36).slice(-4)}`,
    });

    const commands: SimulationCommand[] = [{ type: "add_body", body: newBody }];

    get().pause();
    void recordUndoCheckpoint(commands, `add ${newBody.name}`)
      .then(() => {
        client.sendCommand(commands[0]);
        set({
          bodies: {
            ...bodies,
            [newBody.id]: newBody,
          },
          selectedId: newBody.id,
          hasUnsavedChanges: true,
        });
      })
      .catch((err: unknown) => {
        set({ error: err instanceof Error ? err.message : String(err) });
      });
  },

  applyImpulse: (id: string, impulseMs: [number, number, number]) => {
    const { client, bodies } = get();
    if (!client || !bodies[id]) return;
    if (!impulseMs.every((v) => Number.isFinite(v))) return;
    const commands: SimulationCommand[] = [{ type: "apply_impulse", id, impulseMs }];
    get().pause();
    void recordUndoCheckpoint(commands, `impulse ${bodies[id].name}`)
      .then(() => {
        client.sendCommand(commands[0]);
        set({ hasUnsavedChanges: true });
      })
      .catch((err: unknown) => {
        set({ error: err instanceof Error ? err.message : String(err) });
      });
  },

  undo: () => {
    const { client } = get();
    if (!client || undoStack.length === 0) return;
    const entry = undoStack.pop()!;
    redoStack.push(entry);
    client.loadCheckpoint(entry.checkpoint);
    set({
      bodies: bodiesToRecord(entry.checkpoint.bodies),
      hasUnsavedChanges: true,
    });
    syncUndoFlags();
  },

  redo: () => {
    const { client } = get();
    if (!client || redoStack.length === 0) return;
    const entry = redoStack.pop()!;
    // Re-checkpoint the current state so undo remains well defined.
    void recordUndoCheckpoint(entry.commands, `redo ${entry.label}`)
      .then(() => {
        for (const command of entry.commands) client.sendCommand(command);
        set({ hasUnsavedChanges: true });
      })
      .catch((err: unknown) => {
        set({ error: err instanceof Error ? err.message : String(err) });
      });
  },

  resetScenario: () => {
    const { client } = get();
    if (!client) return;
    undoStack = [];
    redoStack = [];
    client.resetToInitial();
    set({
      events: [],
      trajectories: {},
      hasUnsavedChanges: false,
      canUndo: false,
      canRedo: false,
    });
  },

  openScenarioModal: () => set({ scenarioModalOpen: true }),
  closeScenarioModal: () => set({ scenarioModalOpen: false }),

  refreshSavedScenarios: async () => {
    try {
      const result = await listScenarios();
      set({
        savedScenarios: result.scenarios.map((i) => ({
          id: i.id,
          name: i.name,
          updatedAt: i.updatedAt,
        })),
        storageWarning:
          result.skippedInvalid > 0
            ? `${result.skippedInvalid} stored scenario(s) failed validation and were not listed.`
            : null,
      });
    } catch (err) {
      set({ storageWarning: err instanceof Error ? err.message : String(err) });
    }
  },

  /**
   * Persists a scenario built from the AUTHORITATIVE worker session: the
   * recorded command chronology (real ticks and simulated times), the
   * authoritative session origin, and an explicit final state.
   */
  saveCurrentScenario: async (name?: string) => {
    const { client, scenarioName, scenarioId, refreshSavedScenarios } = get();
    if (!client) return;
    const finalName = (name ?? scenarioName).trim() || "Untitled Scenario";

    const session = await client.requestSession();
    const now = new Date().toISOString();

    const doc: ScenarioDocument = {
      format: "helios-scenario",
      schemaVersion: 2,
      engineVersion: ENGINE_VERSION,
      id: scenarioId,
      name: finalName,
      createdAt: now,
      updatedAt: now,
      initialState: session.initialState,
      commands: session.commandLog,
      finalState: {
        tick: session.checkpoint.tick,
        simTimeSeconds: session.checkpoint.simTimeSeconds,
      },
      checkpoint: session.checkpoint,
    };

    const validated = ScenarioDocumentSchema.safeParse(doc);
    if (!validated.success) {
      throw new Error(`Refusing to save an invalid scenario: ${validated.error.issues[0]?.message ?? "unknown"}`);
    }

    await saveScenario(validated.data as ScenarioDocument);
    set({
      scenarioName: finalName,
      initialBodies: session.initialState.bodies.map((b) => structuredClone(b)),
      initialSnapshot: session.initialState,
      hasUnsavedChanges: false,
    });
    await refreshSavedScenarios();
  },

  loadScenarioById: async (id: string) => {
    const doc = await loadScenario(id);
    if (!doc) return;
    get().loadScenarioDocument(doc);
  },

  /**
   * Loading never re-dispatches commands one by one: the worker replays the
   * authoritative command chronology from the initial state and stops at the
   * documented final tick.
   */
  loadScenarioDocument: (doc: ScenarioDocument) => {
    const { client } = get();
    if (!client) return { success: false, error: "Simulation is not initialized" };

    const validation = ScenarioDocumentSchema.safeParse(doc);
    if (!validation.success) {
      return { success: false, error: validation.error.issues[0]?.message ?? "Invalid scenario document" };
    }
    const scenario = validation.data as ScenarioDocument;

    undoStack = [];
    redoStack = [];

    const bodyRecord = bodiesToRecord(scenario.initialState.bodies.map((b) => structuredClone(b)));

    client.loadScenario(scenario.initialState, scenario.commands, scenario.finalState);

    set({
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      initialBodies: scenario.initialState.bodies.map((b) => structuredClone(b)),
      initialSnapshot: scenario.initialState,
      bodies: bodyRecord,
      events: [],
      trajectories: {},
      canUndo: false,
      canRedo: false,
      hasUnsavedChanges: false,
      selectedId: Object.keys(bodyRecord)[0] ?? null,
      scenarioModalOpen: false,
      error: null,
      haltedReason: null,
    });

    return { success: true };
  },

  deleteSavedScenario: async (id: string) => {
    await deleteScenario(id);
    await get().refreshSavedScenarios();
  },

  exportScenarioJson: async () => {
    const { client, scenarioName, scenarioId } = get();
    if (!client) throw new Error("Simulation is not initialized");

    const session = await client.requestSession();
    const now = new Date().toISOString();

    const doc: ScenarioDocument = {
      format: "helios-scenario",
      schemaVersion: 2,
      engineVersion: ENGINE_VERSION,
      id: scenarioId,
      name: scenarioName,
      createdAt: now,
      updatedAt: now,
      initialState: session.initialState,
      commands: session.commandLog,
      finalState: {
        tick: session.checkpoint.tick,
        simTimeSeconds: session.checkpoint.simTimeSeconds,
      },
      checkpoint: session.checkpoint,
    };

    return serializeScenario(doc);
  },

  importScenarioJson: (jsonStr: string) => {
    try {
      const doc = deserializeScenario(jsonStr);
      return get().loadScenarioDocument(doc);
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
}));

/** Requests a pre-edit checkpoint and pushes it onto the undo stack. */
async function recordUndoCheckpoint(commands: SimulationCommand[], label: string): Promise<void> {
  const client = activeClient;
  if (!client) throw new Error("Simulation is not initialized");
  const checkpoint = await client.requestCheckpoint();
  undoStack.push({ checkpoint, commands, label });
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
  syncUndoFlags();
}

function syncUndoFlags(): void {
  useSandboxStore.setState({ canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 });
}

/** Test-only introspection of the undo/redo stacks. */
export function __getEditHistorySizes(): { undo: number; redo: number } {
  return { undo: undoStack.length, redo: redoStack.length };
}
