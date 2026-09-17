import { create } from "zustand";
import type { SimulationBody } from "../domain/types.ts";
import type { SimulationCommand, LoggedCommand } from "../engine/commands.ts";
import type { SimulationEvent } from "../engine/events.ts";
import type { RenderSnapshot } from "../engine/snapshot.ts";
import type { TimestepQuality, TimestepStats } from "../engine/timestep.ts";
import { WorkerClient } from "../worker/worker-client.ts";
import { createCanonicalSolarSystem } from "../initialization/canonical-adapter.ts";
import { PRESETS } from "../domain/presets.ts";
import { evaluateCompactObjectField } from "../engine/compact-objects.ts";
import { saveScenario, listScenarios, loadScenario, deleteScenario } from "../scenarios/storage.ts";
import type { ScenarioDocument } from "../scenarios/schema.ts";
import { serializeScenario, deserializeScenario } from "../scenarios/serialize.ts";
import { createWorldSnapshot } from "../engine/snapshot.ts";

export type DisplayMode = "presentation" | "physical-size" | "distance";
export type InspectorTab = "state" | "physical" | "orbit" | "environment" | "events" | "provenance";

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
  scenarioName: string;
  initialBodies: SimulationBody[];
  history: SimulationCommand[];
  future: SimulationCommand[];
  hasUnsavedChanges: boolean;
  savedScenarios: Array<{ id: string; name: string; updatedAt: string }>;
  scenarioModalOpen: boolean;
  
  // Playback & accuracy
  paused: boolean;
  multiplier: number;
  quality: TimestepQuality;
  strongFieldWarning: boolean;
  enableRelativity: boolean;
  error: string | null;
  
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
  
  undo: () => void;
  redo: () => void;
  resetScenario: () => void;
  
  openScenarioModal: () => void;
  closeScenarioModal: () => void;
  refreshSavedScenarios: () => Promise<void>;
  saveCurrentScenario: (name?: string) => Promise<void>;
  loadScenarioById: (id: string) => Promise<void>;
  loadScenarioDocument: (doc: ScenarioDocument) => void;
  deleteSavedScenario: (id: string) => Promise<void>;
  exportScenarioJson: () => string;
  importScenarioJson: (jsonStr: string) => { success: boolean; error?: string };
}

let activeClient: WorkerClient | null = null;

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
  
  scenarioName: "Default Solar System",
  initialBodies: [],
  history: [],
  future: [],
  hasUnsavedChanges: false,
  savedScenarios: [],
  scenarioModalOpen: false,
  
  paused: false,
  multiplier: 86400, // 1 day / sec
  quality: "standard",
  strongFieldWarning: false,
  enableRelativity: false,
  error: null,
  
  init: () => {
    if (activeClient) {
      activeClient.terminate();
    }
    
    const client = new WorkerClient();
    activeClient = client;
    
    const initial = createCanonicalSolarSystem();
    const bodiesRecord: Record<string, SimulationBody> = {};
    for (const b of initial) {
      bodiesRecord[b.id] = b;
    }
    
    client.onSnapshot((snap) => {
      const currentBodies = { ...get().bodies };
      let anyStrongField = false;
      const activeIds = new Set(snap.bodyIds);
      
      // Remove deleted/absorbed bodies
      for (const id of Object.keys(currentBodies)) {
        if (!activeIds.has(id)) {
          delete currentBodies[id];
        }
      }
      
      for (let i = 0; i < snap.numBodies; i++) {
        const id = snap.bodyIds[i];
        let b = currentBodies[id];
        if (!b) {
          // Newly created body (e.g. tidal debris remnant)
          b = {
            id,
            name: snap.names[i] || id,
            classification: (snap.classes[i] as any) || "asteroid",
            gravityRole: snap.isTracer[i] ? "tracer" : "massive",
            mass: snap.masses[i],
            radius: snap.radii[i],
            position: [snap.positions[i * 3], snap.positions[i * 3 + 1], snap.positions[i * 3 + 2]],
            velocity: [snap.velocities[i * 3], snap.velocities[i * 3 + 1], snap.velocities[i * 3 + 2]],
            color: snap.colors[i] || "#fbbf24",
            provenance: {
              mass: { kind: "calculated", method: "Tidal disruption remnant" },
              radius: { kind: "calculated" },
              state: { kind: "calculated" },
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
      
      set({
        snapshot: snap,
        bodies: currentBodies,
        strongFieldWarning: anyStrongField,
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
      set({ stats });
    });
    
    client.onError((error) => {
      set({ error });
    });
    
    client.init(initial, 900);
    client.setTimeMultiplier(86400);
    
    set({
      client,
      isInitialized: true,
      bodies: bodiesRecord,
      initialBodies: initial,
      paused: false,
      multiplier: 86400,
      quality: "standard",
      selectedId: "earth",
      history: [],
      future: [],
      hasUnsavedChanges: false,
      error: null,
    });
    
    get().refreshSavedScenarios();
  },
  
  cleanup: () => {
    if (activeClient) {
      activeClient.terminate();
      activeClient = null;
    }
    set({ client: null, isInitialized: false });
  },
  
  play: () => {
    const { client } = get();
    if (!client) return;
    client.resume();
    set({ paused: false });
  },
  
  pause: () => {
    const { client } = get();
    if (!client) return;
    client.pause();
    set({ paused: true });
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
    set({ paused: true });
  },
  
  setMultiplier: (mult: number) => {
    const { client } = get();
    if (!client) return;
    const clamped = Math.max(1, Math.min(mult, 86400 * 365));
    client.setTimeMultiplier(clamped);
    set({ multiplier: clamped });
  },
  
  setQuality: (quality: TimestepQuality) => {
    const { client } = get();
    if (!client) return;
    client.setQuality(quality);
    set({ quality });
  },

  setEnableRelativity: (enabled: boolean) => {
    const { client } = get();
    set({ enableRelativity: enabled });
    if (client) {
      client.setRelativity(enabled);
      client.sendCommand({ type: "set_relativity", enabled });
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
    
    // Auto-pause during edit to ensure deterministic condition
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
    const { bodyDraft, client, bodies, history } = get();
    if (!bodyDraft || !client) return false;
    
    const errors: Record<string, string> = {};
    if (!bodyDraft.name.trim()) errors.name = "Name cannot be empty";
    if (bodyDraft.mass <= 0) errors.mass = "Mass must be positive";
    if (bodyDraft.radius <= 0) errors.radius = "Radius must be positive";
    
    if (Object.keys(errors).length > 0) {
      set({ draftErrors: errors });
      return false;
    }
    
    const existing = bodies[bodyDraft.id];
    let cmd: SimulationCommand;
    
    if (existing) {
      cmd = {
        type: "update_body",
        id: bodyDraft.id,
        updates: {
          name: bodyDraft.name,
          classification: bodyDraft.classification,
          gravityRole: bodyDraft.gravityRole,
          mass: bodyDraft.mass,
          radius: bodyDraft.radius,
          position: bodyDraft.position,
          velocity: bodyDraft.velocity,
          color: bodyDraft.color,
          thermal: bodyDraft.thermal,
          rotation: bodyDraft.rotation,
          compact: bodyDraft.compact,
        },
      };
    } else {
      cmd = {
        type: "add_body",
        body: bodyDraft,
      };
    }
    
    client.sendCommand(cmd);
    
    set({
      isEditing: false,
      bodyDraft: null,
      draftErrors: {},
      bodies: {
        ...bodies,
        [bodyDraft.id]: bodyDraft,
      },
      history: [...history, cmd],
      future: [],
      hasUnsavedChanges: true,
    });
    
    return true;
  },
  
  removeBody: (id: string) => {
    const { client, bodies, history, selectedId } = get();
    if (!client) return;
    
    const cmd: SimulationCommand = {
      type: "delete_body",
      id,
    };
    
    client.sendCommand(cmd);
    
    const newBodies = { ...bodies };
    delete newBodies[id];
    
    set({
      bodies: newBodies,
      history: [...history, cmd],
      future: [],
      selectedId: selectedId === id ? null : selectedId,
      hasUnsavedChanges: true,
    });
  },
  
  duplicateBody: (id: string) => {
    const { client, bodies, history } = get();
    const source = bodies[id];
    if (!client || !source) return;
    
    const newId = `${source.id}-copy-${Date.now().toString(36).slice(-4)}`;
    const newBody: SimulationBody = {
      ...structuredClone(source),
      id: newId,
      name: `${source.name} (Copy)`,
      position: [
        source.position[0] * 1.05,
        source.position[1] * 1.05,
        source.position[2],
      ],
      provenance: {
        ...source.provenance,
        state: { kind: "custom", note: `Duplicated from ${source.name}` },
      },
    };
    
    const cmd: SimulationCommand = {
      type: "add_body",
      body: newBody,
    };
    
    client.sendCommand(cmd);
    
    set({
      bodies: {
        ...bodies,
        [newId]: newBody,
      },
      selectedId: newId,
      history: [...history, cmd],
      future: [],
      hasUnsavedChanges: true,
    });
  },
  
  addPreset: (presetKey: string) => {
    const { client, bodies, history } = get();
    if (!client) return;
    
    const preset = PRESETS.find((p) => p.id === presetKey);
    if (!preset) return;
    
    const newBody = preset.createBody({
      id: `${presetKey.replace("preset-", "")}-${Date.now().toString(36).slice(-4)}`,
    });
    
    const cmd: SimulationCommand = {
      type: "add_body",
      body: newBody,
    };
    
    client.sendCommand(cmd);
    
    set({
      bodies: {
        ...bodies,
        [newBody.id]: newBody,
      },
      selectedId: newBody.id,
      history: [...history, cmd],
      future: [],
      hasUnsavedChanges: true,
    });
  },
  
  undo: () => {
    const { history, future, client, initialBodies } = get();
    if (history.length === 0 || !client) return;
    
    const prevHistory = [...history];
    const lastCmd = prevHistory.pop()!;
    
    client.resetToInitial();
    for (const cmd of prevHistory) {
      client.sendCommand(cmd);
    }
    
    const bodiesRecord: Record<string, SimulationBody> = {};
    for (const b of initialBodies) {
      bodiesRecord[b.id] = structuredClone(b);
    }
    for (const cmd of prevHistory) {
      if (cmd.type === "add_body") {
        bodiesRecord[cmd.body.id] = structuredClone(cmd.body);
      } else if (cmd.type === "delete_body") {
        delete bodiesRecord[cmd.id];
      } else if (cmd.type === "update_body") {
        if (bodiesRecord[cmd.id]) {
          Object.assign(bodiesRecord[cmd.id], cmd.updates);
        }
      }
    }
    
    set({
      history: prevHistory,
      future: [lastCmd, ...future],
      bodies: bodiesRecord,
      hasUnsavedChanges: true,
    });
  },
  
  redo: () => {
    const { history, future, client, bodies } = get();
    if (future.length === 0 || !client) return;
    
    const nextFuture = [...future];
    const nextCmd = nextFuture.shift()!;
    
    client.sendCommand(nextCmd);
    
    const newBodies = { ...bodies };
    if (nextCmd.type === "add_body") {
      newBodies[nextCmd.body.id] = structuredClone(nextCmd.body);
    } else if (nextCmd.type === "delete_body") {
      delete newBodies[nextCmd.id];
    } else if (nextCmd.type === "update_body") {
      if (newBodies[nextCmd.id]) {
        Object.assign(newBodies[nextCmd.id], nextCmd.updates);
      }
    }
    
    set({
      history: [...history, nextCmd],
      future: nextFuture,
      bodies: newBodies,
      hasUnsavedChanges: true,
    });
  },
  
  resetScenario: () => {
    const { client, initialBodies } = get();
    if (!client) return;
    
    client.resetToInitial();
    const bodiesRecord: Record<string, SimulationBody> = {};
    for (const b of initialBodies) {
      bodiesRecord[b.id] = structuredClone(b);
    }
    
    set({
      bodies: bodiesRecord,
      history: [],
      future: [],
      hasUnsavedChanges: false,
      events: [],
      trajectories: {},
      selectedId: "earth",
      paused: false,
    });
  },
  
  openScenarioModal: () => set({ scenarioModalOpen: true }),
  closeScenarioModal: () => set({ scenarioModalOpen: false }),
  
  refreshSavedScenarios: async () => {
    try {
      const items = await listScenarios();
      set({
        savedScenarios: items.map((i) => ({
          id: i.id,
          name: i.name,
          updatedAt: i.updatedAt,
        })),
      });
    } catch {
      // Ignored
    }
  },
  
  saveCurrentScenario: async (name?: string) => {
    const { scenarioName, initialBodies, history, refreshSavedScenarios } = get();
    const finalName = (name ?? scenarioName).trim() || "Untitled Scenario";
    const initialSnapshot = createWorldSnapshot(initialBodies, 0, 0, 900);
    
    const loggedCommands: LoggedCommand[] = history.map((cmd, idx) => ({
      tick: idx,
      simTimeSeconds: idx * 900,
      command: cmd,
    }));
    
    const doc: ScenarioDocument = {
      format: "helios-scenario",
      schemaVersion: 1,
      engineVersion: "1.0.0",
      id: `scen-${Date.now().toString(36)}`,
      name: finalName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seed: 12345,
      initialState: initialSnapshot,
      commands: loggedCommands,
    };
    
    await saveScenario(doc);
    set({ scenarioName: finalName, hasUnsavedChanges: false });
    await refreshSavedScenarios();
  },
  
  loadScenarioById: async (id: string) => {
    const doc = await loadScenario(id);
    if (!doc) return;
    get().loadScenarioDocument(doc);
  },
  
  loadScenarioDocument: (doc: ScenarioDocument) => {
    const { client } = get();
    if (!client) return;
    
    const initial = structuredClone(doc.initialState.bodies);
    const bodiesRecord: Record<string, SimulationBody> = {};
    for (const b of initial) {
      bodiesRecord[b.id] = structuredClone(b);
    }
    
    client.init(initial, doc.initialState.dtSeconds ?? 900);
    
    const cmds: SimulationCommand[] = [];
    for (const logCmd of doc.commands) {
      const cmd = logCmd.command;
      cmds.push(cmd);
      client.sendCommand(cmd);
      if (cmd.type === "add_body") {
        bodiesRecord[cmd.body.id] = structuredClone(cmd.body);
      } else if (cmd.type === "delete_body") {
        delete bodiesRecord[cmd.id];
      } else if (cmd.type === "update_body") {
        if (bodiesRecord[cmd.id]) {
          Object.assign(bodiesRecord[cmd.id], cmd.updates);
        }
      }
    }
    
    set({
      scenarioName: doc.name,
      initialBodies: initial,
      bodies: bodiesRecord,
      history: cmds,
      future: [],
      hasUnsavedChanges: false,
      selectedId: Object.keys(bodiesRecord)[0] ?? null,
      scenarioModalOpen: false,
    });
  },
  
  deleteSavedScenario: async (id: string) => {
    await deleteScenario(id);
    await get().refreshSavedScenarios();
  },
  
  exportScenarioJson: () => {
    const { scenarioName, initialBodies, history } = get();
    const initialSnapshot = createWorldSnapshot(initialBodies, 0, 0, 900);
    const loggedCommands: LoggedCommand[] = history.map((cmd, idx) => ({
      tick: idx,
      simTimeSeconds: idx * 900,
      command: cmd,
    }));
    
    const doc: ScenarioDocument = {
      format: "helios-scenario",
      schemaVersion: 1,
      engineVersion: "1.0.0",
      id: `scen-${Date.now().toString(36)}`,
      name: scenarioName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      seed: 12345,
      initialState: initialSnapshot,
      commands: loggedCommands,
    };
    return serializeScenario(doc);
  },
  
  importScenarioJson: (jsonStr: string) => {
    try {
      const doc = deserializeScenario(jsonStr);
      get().loadScenarioDocument(doc);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message ?? String(err) };
    }
  },
}));
