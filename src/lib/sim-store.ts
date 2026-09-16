import { create } from "zustand";
import type { ScaleMode, UnitSystem } from "@/lib/format";
import { dateToJ2000Days, formatEpochIso, tryDateToJ2000Days } from "@/lib/ephemeris";
import { bodyById } from "@/data/registry";


export const simClock = {
  days: dateToJ2000Days(Date.now()),
};

export function buildDeepLink(selectedId: string | null, dateIso?: string): string {
  if (!selectedId) {
    return dateIso ? `/?date=${encodeURIComponent(dateIso)}` : "/";
  }
  const body = bodyById(selectedId);
  const params = new URLSearchParams();
  if (body?.identity.kind === "moon" && body.identity.parentId) {
    params.set("body", body.identity.parentId);
    params.set("moon", selectedId);
  } else {
    params.set("body", selectedId);
  }
  if (dateIso) {
    params.set("date", dateIso);
  }
  return `/?${params.toString()}`;
}

export function syncDeepLinkToUrl(selectedId: string | null, includeDate?: boolean) {
  if (typeof window === "undefined") return;
  const currentParams = new URLSearchParams(window.location.search);
  const hasExistingDate = currentParams.has("date");
  const dateIso =
    includeDate || hasExistingDate ? formatEpochIso(simClock.days) : undefined;
  const nextUrl = buildDeepLink(selectedId, dateIso);
  if (window.location.pathname + window.location.search !== nextUrl) {
    window.history.replaceState(null, "", nextUrl);
  }
}

type SimState = {
  paused: boolean;
  speed: number;
  showLabels: boolean;
  showOrbits: boolean;
  /** Moon-system visibility: auto (on parent focus), always, or never. */
  moonMode: "auto" | "always" | "hidden";
  /** Selected body id — planets, dwarf planets, sun, and moons alike. */
  selectedId: string | null;
  hoverId: string | null;
  resetNonce: number;
  dateNonce: number;
  /** UI preferences */
  units: UnitSystem;
  scaleMode: ScaleMode;
  /** Detail panel open state (progressive disclosure). */
  detailOpen: boolean;
  /** Scientific distance measurement system (P1-004) */
  measurement: {
    active: boolean;
    sourceId: string | null;
    targetId: string | null;
  };
  toggleMeasurement: () => void;
  setMeasurementSource: (id: string | null) => void;
  setMeasurementTarget: (id: string | null) => void;
  clearMeasurement: () => void;
  setPaused: (paused: boolean) => void;

  togglePaused: () => void;
  setSpeed: (speed: number) => void;
  setShowLabels: (show: boolean) => void;
  setShowOrbits: (show: boolean) => void;
  setMoonMode: (mode: SimState["moonMode"]) => void;
  select: (id: string | null) => void;
  setDate: (dateOrDays: string | number | Date) => void;
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
  dateNonce: 0,
  units: "metric",
  scaleMode: "presentation",
  detailOpen: true,
  measurement: {
    active: false,
    sourceId: null,
    targetId: null,
  },
  toggleMeasurement: () =>
    set((s) => ({
      measurement: {
        ...s.measurement,
        active: !s.measurement.active,
        sourceId: !s.measurement.active
          ? (s.measurement.sourceId ?? s.selectedId ?? "earth")
          : s.measurement.sourceId,
      },
    })),
  setMeasurementSource: (sourceId) =>
    set((s) => ({
      measurement: { ...s.measurement, sourceId },
    })),
  setMeasurementTarget: (targetId) =>
    set((s) => ({
      measurement: { ...s.measurement, targetId },
    })),
  clearMeasurement: () =>
    set({
      measurement: { active: false, sourceId: null, targetId: null },
    }),
  setPaused: (paused) => set({ paused }),

  togglePaused: () => set((s) => ({ paused: !s.paused })),
  setSpeed: (speed) => set({ speed }),
  setShowLabels: (showLabels) => set({ showLabels }),
  setShowOrbits: (showOrbits) => set({ showOrbits }),
  setMoonMode: (moonMode) => set({ moonMode }),
  select: (selectedId) => {
    set({ selectedId, detailOpen: true });
    syncDeepLinkToUrl(selectedId);
  },
  setDate: (dateOrDays) => {
    const days =
      typeof dateOrDays === "number" ? dateOrDays : dateToJ2000Days(dateOrDays);
    simClock.days = days;
    set((s) => ({ dateNonce: s.dateNonce + 1 }));
    syncDeepLinkToUrl(useSim.getState().selectedId, true);
  },
  setHover: (hoverId) => set({ hoverId }),
  setUnits: (units) => set({ units }),
  setScaleMode: (scaleMode) => set({ scaleMode }),
  setDetailOpen: (detailOpen) => set({ detailOpen }),
  resetView: () => {
    set((s) => ({
      selectedId: null,
      resetNonce: s.resetNonce + 1,
    }));
    syncDeepLinkToUrl(null);
  },
}));

export function parseDeepLinkParams(): { targetId: string | null; dateDays: number | null } {
  if (typeof window === "undefined") return { targetId: null, dateDays: null };
  try {
    const params = new URLSearchParams(window.location.search);
    const body = params.get("body")?.toLowerCase().trim();
    const moon = params.get("moon")?.toLowerCase().trim();
    const date = params.get("date")?.trim();

    let targetId: string | null = null;
    if (moon && bodyById(moon)) {
      targetId = moon;
    } else if (body && bodyById(body)) {
      targetId = body;
    }

    let dateDays: number | null = null;
    if (date) {
      dateDays = tryDateToJ2000Days(date);
    }

    return { targetId, dateDays };

  } catch {
    return { targetId: null, dateDays: null };
  }
}

export function hydrateSimSettings() {
  const loaded = loadSettings();
  if (Object.values(loaded).some((v) => v !== undefined)) {
    useSim.setState(loaded);
  }

  // Restore deep link target and date on initial load
  const { targetId, dateDays } = parseDeepLinkParams();
  if (dateDays !== null) {
    simClock.days = dateDays;
  }
  if (targetId) {
    useSim.setState({ selectedId: targetId, detailOpen: true });
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
