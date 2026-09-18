/**
 * Semantic Simulation Events
 *
 * Events are emitted during N-body substepping, collisions, close encounters,
 * tidal disruptions, and user commands. They are recorded in the event timeline
 * and used for deterministic replay and screen-reader announcements.
 */

export type SimulationEventType =
  | "body_added"
  | "body_removed"
  | "parameter_changed"
  | "close_encounter"
  | "roche_limit_crossing"
  | "collision"
  | "merge"
  | "fragmentation"
  | "capture"
  | "escape"
  | "ejection"
  | "tidal_disruption"
  | "black_hole_horizon_crossing"
  | "accuracy_warning";

/**
 * Event kinds that are declared by the model but have NO detector wired up.
 * They are reserved: nothing in the engine emits them, and no UI or API may
 * claim they are observed.
 */
export const RESERVED_EVENT_TYPES = ["collision", "capture", "fragmentation"] as const;

export type ReservedSimulationEventType = (typeof RESERVED_EVENT_TYPES)[number];

/** Event kinds with a real, deterministic detector in SimulationWorld. */
export const IMPLEMENTED_EVENT_TYPES = [
  "body_added",
  "body_removed",
  "parameter_changed",
  "close_encounter",
  "roche_limit_crossing",
  "merge",
  "tidal_disruption",
  "black_hole_horizon_crossing",
  "escape",
  "ejection",
  "accuracy_warning",
] as const;

export interface SimulationEvent {
  eventId: string;
  simTimeSeconds: number;
  tick: number;
  eventType: SimulationEventType;
  involvedBodyIds: string[];
  involvedBodyNames: string[];
  summary: string;
  calculatedQuantities?: Record<string, number | string>;
  outcome?: string;
  provenance?: {
    model: string;
    version: string;
    note?: string;
  };
}

export type SimulationEventListener = (event: SimulationEvent) => void;

export class SimulationEventBus {
  private listeners: SimulationEventListener[] = [];
  private history: SimulationEvent[] = [];
  private maxHistory: number;

  constructor(maxHistory = 1000) {
    this.maxHistory = maxHistory;
  }

  emit(event: SimulationEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: SimulationEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getHistory(): SimulationEvent[] {
    return [...this.history];
  }

  clear(): void {
    this.history = [];
  }
}
