import { create } from "zustand";
import type { ScaleMode, UnitSystem } from "@/lib/format";

export const simClock = {
  days: 0,
};

type SimState = {
  paused: boolean;
  speed: number;
  showLabels: boolean;
  showOrbits: boolean;
  /** Moon-system visibility: auto (on parent focus), always, or never. */
  moonMode: "auto" | "always" | "hidden";
  /** Selected body id — planets and moons alike. */
  selectedId: string | null;
  hoverId: string | null;
  resetNonce: number;
  /** UI preferences */
  units: UnitSystem;
  scaleMode: ScaleMode;
  /** Detail panel open state (progressive disclosure). */
  detailOpen: boolean;
  setPaused: (paused: boolean) => void;
  togglePaused: () => void;
  setSpeed: (speed: number) => void;
  setShowLabels: (show: boolean) => void;
  setShowOrbits: (show: boolean) => void;
  setMoonMode: (mode: SimState["moonMode"]) => void;
  select: (id: string | null) => void;
  setHover: (id: string | null) => void;
  setUnits: (units: UnitSystem) => void;
  setScaleMode: (mode: ScaleMode) => void;
  setDetailOpen: (open: boolean) => void;
  resetView: () => void;
};

const STORAGE_KEY = "helios-settings-v2";

type Persisted = Pick<
  SimState,
  "speed" | "showLabels" | "showOrbits" | "moonMode" | "units" | "scaleMode"
>;

function loadSettings(): Partial<Persisted> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      speed:
        typeof parsed.speed === "number" && parsed.speed > 0
          ? Math.min(16, Math.max(0.25, parsed.speed))
          : undefined,
      showLabels: typeof parsed.showLabels === "boolean" ? parsed.showLabels : undefined,
      showOrbits: typeof parsed.showOrbits === "boolean" ? parsed.showOrbits : undefined,
      moonMode:
        parsed.moonMode === "auto" || parsed.moonMode === "always" || parsed.moonMode === "hidden"
          ? parsed.moonMode
          : undefined,
      units:
        parsed.units === "metric" || parsed.units === "astronomical" || parsed.units === "earth"
          ? parsed.units
          : undefined,
      scaleMode:
        parsed.scaleMode === "presentation" ||
        parsed.scaleMode === "relative-size" ||
        parsed.scaleMode === "distance"
          ? parsed.scaleMode
          : undefined,
    };
  } catch {
    return {};
  }
}

export const useSim = create<SimState>((set) => ({
  paused: false,
  speed: 1,
  showLabels: true,
  showOrbits: true,
  moonMode: "auto",
  selectedId: null,
  hoverId: null,
  resetNonce: 0,
  units: "metric",
  scaleMode: "presentation",
  detailOpen: true,
  setPaused: (paused) => set({ paused }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setSpeed: (speed) => set({ speed }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setShowOrbits: (showOrbits) => set({ showOrbits }),
  setMoonMode: (moonMode) => set({ moonMode }),
  select: (selectedId) => set({ selectedId, detailOpen: true }),
  setHover: (hoverId) => set({ hoverId }),
  setUnits: (units) => set({ units }),
  setScaleMode: (scaleMode) => set({ scaleMode }),
  setDetailOpen: (detailOpen) => set({ detailOpen }),
  resetView: () =>
    set((s) => ({
      selectedId: null,
      resetNonce: s.resetNonce + 1,
    })),
}));

export function hydrateSimSettings() {
  const loaded = loadSettings();
  if (Object.values(loaded).some((v) => v !== undefined)) {
    useSim.setState(loaded);
  }
}

if (typeof window !== "undefined") {
  useSim.subscribe((state) => {
    try {
      const persisted: Persisted = {
        speed: state.speed,
        showLabels: state.showLabels,
        showOrbits: state.showOrbits,
        moonMode: state.moonMode,
        units: state.units,
        scaleMode: state.scaleMode,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted));
    } catch {
      /* ignore quota */
    }
  });
}
