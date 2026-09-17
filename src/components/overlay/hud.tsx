import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Compass,
  Pause,
  Play,
  RotateCcw,
  Ruler,
  Search,
  Tag,
  Orbit as OrbitIcon,
  GitCompareArrows,
  Calendar,
  Share2,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { Command } from "cmdk";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  BODIES,
  MOONS,
  SATELLITES,
  REGIONS,
  EVENTS,
  bodyById,
  regionById,
} from "@/data/registry";
import { formatYearPace, sliderToSpeed, speedToSlider, YEAR_SECONDS } from "@/lib/planets";
import {
  SCALE_MODE_LABELS,
  formatDiameter,
  formatMass,
  formatGravity,
  formatDensity,
  formatTemperature,
  formatDayLength,
  formatYearLength,
  formatTilt,
  type ScaleMode,
  type UnitSystem,
} from "@/lib/format";
import { buildDeepLink, simClock, useSim } from "@/lib/sim-store";
import {
  formatEpochDisplay,
  formatEpochIso,
  EPOCH_PRESETS,
  EPHEMERIS_MIN_DAYS,
  EPHEMERIS_MAX_DAYS,
  EPHEMERIS_VALID_MIN_DATE,
  EPHEMERIS_VALID_MAX_DATE,
  trySupportedEphemerisDate,
} from "@/lib/ephemeris";
import { BodyDetail } from "@/components/overlay/detail";
import { RegionDetail } from "@/components/overlay/region-detail";
import { MeasurementPanel } from "@/components/overlay/measurement-panel";


function useSimDays() {
  const [days, setDays] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setDays(simClock.days), 120);
    return () => window.clearInterval(id);
  }, []);
  return days;
}

function IconSwap({
  active,
  On,
  Off,
}: {
  active: boolean;
  On: typeof Play;
  Off: typeof Pause;
}) {
  return (
    <span className="relative inline-flex size-5 items-center justify-center">
      <On
        className={cn(
          "absolute size-5 transition-[opacity,transform,filter] duration-(--motion-fast) ease-(--ease-out)",
          active ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]",
        )}
        strokeWidth={1.75}
      />
      <Off
        className={cn(
          "size-5 transition-[opacity,transform,filter] duration-(--motion-fast) ease-(--ease-out)",
          active ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0",
        )}
        strokeWidth={1.75}
      />
    </span>
  );
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-3xl bg-surface/85 p-4 text-fg shadow-[var(--shadow-border)] backdrop-blur-md",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PlanetDot({ color, active }: { color: string; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-block size-2.5 shrink-0 rounded-full",
        active && "ring-2 ring-fg/40 ring-offset-2 ring-offset-surface",
      )}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Search palette                                                      */
/* ------------------------------------------------------------------ */

type SearchHit = {
  id: string;
  label: string;
  group: string;
  target: string;
  kind: "body" | "moon" | "region" | "event";
};

function buildSearchIndex(): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const b of [...BODIES, ...MOONS]) {
    hits.push({
      id: `body-${b.identity.id}`,
      label: b.identity.name,
      group:
        b.identity.kind === "moon"
          ? "Curated Moons"
          : b.identity.kind === "star"
            ? "Star"
            : b.identity.kind === "dwarf-planet"
              ? "Dwarf Planets"
              : "Planets",
      target: b.identity.id,
      kind: b.identity.kind === "moon" ? "moon" : "body",
    });
    for (const f of b.features ?? []) {
      hits.push({
        id: `feature-${f.id}`,
        label: `${f.name} (${f.kind})`,
        group: `Features · ${b.identity.name}`,
        target: b.identity.id,
        kind: b.identity.kind === "moon" ? "moon" : "body",
      });
    }
  }
  for (const s of SATELLITES) {
    if (!MOONS.some((m) => m.identity.id === s.id)) {
      hits.push({
        id: `satellite-${s.id}`,
        label: `${s.name} (${s.parentId})`,
        group: "Natural Satellites",
        target: s.id,
        kind: "moon",
      });
    }
  }
  for (const e of EVENTS) {
    hits.push({
      id: `event-${e.id}`,
      label: `${e.title} (${e.year})`,
      group: "Events",
      target: e.bodyIds[0],
      kind: "event",
    });
  }
  for (const r of REGIONS) {
    hits.push({
      id: `region-${r.id}`,
      label: r.name,
      group: "Deep-Space Regions",
      target: r.id,
      kind: "region",
    });
  }
  return hits;
}

function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const select = useSim((s) => s.select);
  const selectRegion = useSim((s) => s.selectRegion);
  const index = useMemo(buildSearchIndex, []);
  const groups = useMemo(() => {
    const priority = [
      "Star",
      "Planets",
      "Dwarf Planets",
      "Curated Moons",
      "Natural Satellites",
      "Deep-Space Regions",
      "Events",
    ];
    const present = Array.from(new Set(index.map((h) => h.group)));
    return present.sort((a, b) => {
      const idxA = priority.indexOf(a);
      const idxB = priority.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [index]);

  if (!open) return null;
  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-start justify-center bg-bg/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={onClose}>
      <Command
        label="Search the observatory"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border),0_24px_80px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-fg/10 px-4">
          <Search className="size-4 text-muted" aria-hidden="true" />
          <Command.Input
            autoFocus
            placeholder="Search worlds, features, events…"
            className="h-12 w-full bg-transparent font-sans text-sm text-fg outline-none placeholder:text-muted"
          />
          <Button variant="ghost" size="icon" aria-label="Close search" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
        <Command.List className="helios-scroll max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
            Nothing found in the catalogue.
          </Command.Empty>
          {groups.map((group) => (
            <Command.Group
              key={group}
              heading={group}
              className="px-1 py-1 text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:uppercase"
            >
              {index
                .filter((h) => h.group === group)
                .map((h) => (
                  <Command.Item
                    key={h.id}
                    value={h.label}
                    onSelect={() => {
                      if (h.kind === "region") {
                        selectRegion(h.target);
                      } else {
                        select(h.target);
                      }
                      onClose();
                    }}
                    className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg data-[selected=true]:bg-fg/10"
                  >
                    <PlanetDot
                      color={
                        h.kind === "region"
                          ? "#60a5fa"
                          : bodyById(h.target)?.identity.color ?? "#8e939e"
                      }
                    />
                    {h.label}
                  </Command.Item>
                ))}
            </Command.Group>
          ))}
        </Command.List>

      </Command>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Compare mode                                                        */
/* ------------------------------------------------------------------ */

const COMPARE_POOL = [...BODIES, ...MOONS];

function CompareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const units = useSim((s) => s.units);
  const [picks, setPicks] = useState<string[]>(["earth", "mars"]);
  if (!open) return null;

  const toggle = (id: string) =>
    setPicks((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length >= 4 ? p : [...p, id],
    );
  const selected = picks
    .map((id) => bodyById(id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  const rows: { label: string; get: (b: NonNullable<(typeof COMPARE_POOL)[number]>) => string }[] = [
    { label: "Diameter", get: (b) => formatDiameter(b.physical.diameterKm, units) },
    { label: "Mass", get: (b) => formatMass(b.physical.massEarths, b.physical.massKg24, units) },
    { label: "Gravity", get: (b) => formatGravity(b.physical.gravityG, units) },
    { label: "Density", get: (b) => formatDensity(b.physical.densityGCm3) },
    { label: "Mean temp", get: (b) => formatTemperature(b.temperature.meanC) },
    { label: "Day", get: (b) => formatDayLength(b.rotation.periodHours) },
    { label: "Year", get: (b) => (b.orbit ? formatYearLength(b.orbit.periodDays) : "—") },
    { label: "Tilt", get: (b) => formatTilt(b.rotation.axialTiltDeg) },
    { label: "Moons", get: (b) => (b.moonSystem ? String(b.moonSystem.confirmedCount) : "0") },
  ];


  return (
    <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-bg/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <Panel className="max-h-[85vh] w-full max-w-2xl overflow-y-auto" >
        <div onClick={(e) => e.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-2xl text-fg">Compare worlds</h3>
            <Button variant="ghost" size="icon" aria-label="Close compare" onClick={onClose}>
              <X className="size-4" />
            </Button>
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {COMPARE_POOL.map((b) => (
              <button
                key={b.identity.id}
                type="button"
                onClick={() => toggle(b.identity.id)}
                aria-pressed={picks.includes(b.identity.id)}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-full px-3 text-xs transition-colors",
                  picks.includes(b.identity.id) ? "bg-fg text-bg" : "bg-fg/8 text-fg/80 hover:bg-fg/15",
                )}
              >
                <PlanetDot color={b.identity.color} />
                {b.identity.name}
              </button>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Physical characteristics side by side</caption>
              <thead>
                <tr className="border-b border-fg/10 text-left">
                  <th scope="col" className="py-2 pr-4 text-xs font-medium tracking-wide text-muted uppercase">Metric</th>
                  {selected.map((b) => (
                    <th key={b.identity.id} scope="col" className="py-2 pr-4 text-xs font-medium tracking-wide text-fg uppercase">
                      <span className="flex items-center gap-1.5">
                        <PlanetDot color={b.identity.color} />
                        {b.identity.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-fg/5">
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row" className="py-2 pr-4 text-left text-xs text-muted">{r.label}</th>
                    {selected.map((b) => (
                      <td key={b.identity.id} className="py-2 pr-4 text-fg tabular-nums">{r.get(b)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Pick up to four bodies. Figures are canonical values (see the Events & sources tabs).
          </p>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Epoch date control dialog                                           */
/* ------------------------------------------------------------------ */

function EpochDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setDate = useSim((s) => s.setDate);
  const selectedId = useSim((s) => s.selectedId);
  const days = useSimDays();
  const [copied, setCopied] = useState(false);
  const [inputVal, setInputVal] = useState(formatEpochIso(simClock.days));
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setInputVal(formatEpochIso(days));
    setValidationError(null);
  }, [days]);

  if (!open) return null;

  const handleStep = (stepDays: number) => {
    const nextDays = simClock.days + stepDays;
    const clamped = Math.max(EPHEMERIS_MIN_DAYS, Math.min(EPHEMERIS_MAX_DAYS, nextDays));
    setDate(clamped);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputVal(val);
    if (val) {
      const parsedDays = trySupportedEphemerisDate(val);
      if (parsedDays !== null) {
        setValidationError(null);
        setDate(parsedDays);
      } else {
        setValidationError(
          `Date must be between ${EPHEMERIS_VALID_MIN_DATE} and ${EPHEMERIS_VALID_MAX_DATE}.`
        );
      }
    } else {
      setValidationError(null);
    }
  };

  const handleCopyLink = () => {
    if (typeof window === "undefined") return;
    const url =
      window.location.origin +
      buildDeepLink(selectedId, formatEpochIso(simClock.days));
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const daysSinceJ2000 = Math.round(simClock.days);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-bg/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <Panel className="w-full max-w-lg space-y-4">
        <div onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between border-b border-fg/10 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-muted" />
              <h3 className="font-display text-xl text-fg">Epoch Date Control</h3>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close date control"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>

          <div className="mt-4 space-y-4">
            {/* Active date card */}
            <div className="rounded-2xl bg-fg/5 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">
                  Ephemeris Date
                </span>
                <span className="text-xs text-muted tabular-nums">
                  {daysSinceJ2000 >= 0 ? `+${daysSinceJ2000}` : daysSinceJ2000} days from J2000.0
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                <p className="font-display text-2xl text-fg tabular-nums">
                  {formatEpochDisplay(simClock.days)}
                </p>
                <input
                  type="date"
                  value={inputVal}
                  min={EPHEMERIS_VALID_MIN_DATE}
                  max={EPHEMERIS_VALID_MAX_DATE}
                  onChange={handleDateChange}
                  className="rounded-xl border border-fg/15 bg-surface px-3 py-1.5 font-sans text-xs text-fg shadow-sm outline-none transition-colors hover:border-fg/30 focus:border-fg/50"
                  aria-label="Pick simulation date"
                />
              </div>
              {validationError ? (
                <p className="mt-2 text-xs font-medium text-rose-400" role="alert">
                  {validationError}
                </p>
              ) : null}
            </div>

            {/* Step scrubbers */}
            <div>
              <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                Step Simulation Date
              </p>
              <div className="grid grid-cols-6 gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStep(-365.25)}
                  className="rounded-xl bg-fg/8 py-2 text-xs font-medium text-fg/80 transition-colors hover:bg-fg/15 hover:text-fg"
                >
                  -1 yr
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(-30)}
                  className="rounded-xl bg-fg/8 py-2 text-xs font-medium text-fg/80 transition-colors hover:bg-fg/15 hover:text-fg"
                >
                  -30 d
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(-1)}
                  className="rounded-xl bg-fg/8 py-2 text-xs font-medium text-fg/80 transition-colors hover:bg-fg/15 hover:text-fg"
                >
                  -1 d
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(1)}
                  className="rounded-xl bg-fg/8 py-2 text-xs font-medium text-fg/80 transition-colors hover:bg-fg/15 hover:text-fg"
                >
                  +1 d
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(30)}
                  className="rounded-xl bg-fg/8 py-2 text-xs font-medium text-fg/80 transition-colors hover:bg-fg/15 hover:text-fg"
                >
                  +30 d
                </button>
                <button
                  type="button"
                  onClick={() => handleStep(365.25)}
                  className="rounded-xl bg-fg/8 py-2 text-xs font-medium text-fg/80 transition-colors hover:bg-fg/15 hover:text-fg"
                >
                  +1 yr
                </button>
              </div>
            </div>

            {/* Curated Presets */}
            <div>
              <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">
                Historical & Scientific Epochs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {EPOCH_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setDate(p.getDays())}
                    className="rounded-full bg-fg/8 px-3 py-1.5 text-xs text-fg/85 transition-colors hover:bg-fg/15 hover:text-fg"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Share Deep Link */}
            <div className="border-t border-fg/10 pt-3">
              <p className="mb-1 text-xs font-medium tracking-wide text-muted uppercase">
                Shareable Deep Link
              </p>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-fg/5 p-2.5">
                <p className="truncate font-mono text-xs text-fg/80">
                  {buildDeepLink(selectedId, formatEpochIso(simClock.days))}
                </p>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 rounded-xl"
                >
                  {copied ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Share2 className="size-3.5" />
                  )}
                  <span>{copied ? "Copied!" : "Copy link"}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Body list                                                           */
/* ------------------------------------------------------------------ */

function BodyButton({
  id,
  name,
  color,
  selected,
  selectedChildId,
  moons,
  depth,
  onSelect,
}: {
  id: string;
  name: string;
  color: string;
  selected: boolean;
  selectedChildId?: string | null;
  moons?: { id: string; name: string; color: string }[];
  depth?: number;
  onSelect: (id: string) => void;
}) {
  const isChildSelected = Boolean(selectedChildId && moons?.some((m) => m.id === selectedChildId));
  const [open, setOpen] = useState(isChildSelected);
  useEffect(() => {
    if (isChildSelected) setOpen(true);
  }, [isChildSelected]);

  const hasMoons = moons && moons.length > 0;
  return (
    <div style={depth ? { paddingLeft: depth * 14 } : undefined}>
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => onSelect(id)}
          className={cn(
            "flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl px-3 text-left font-sans text-sm transition-[background-color,color] duration-(--motion-quick) ease-(--ease-out)",
            selected ? "bg-fg/10 text-fg" : "text-muted hover:bg-fg/6 hover:text-fg",
          )}
        >
          <PlanetDot color={color} active={selected} />
          <span className="truncate">{name}</span>
        </button>
        {hasMoons ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} moons of ${name}`}
            className="ml-0.5 flex size-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-fg/8 hover:text-fg"
          >
            <Chevronish open={open} />
          </button>
        ) : null}
      </div>
      {hasMoons && open ? (
        <div className="mt-0.5 space-y-0.5">
          {moons!.map((m) => {
            const activeMoon = selectedChildId === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelect(m.id)}
                className={cn(
                  "flex h-8 w-full items-center gap-2.5 rounded-lg px-3 text-left text-xs transition-colors",
                  activeMoon
                    ? "bg-fg/10 font-medium text-fg"
                    : "text-muted hover:bg-fg/6 hover:text-fg",
                )}
                style={{ paddingLeft: 30 }}
              >
                <PlanetDot color={m.color} active={activeMoon} />
                {m.name}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}


function Chevronish({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn("size-3.5 transition-transform duration-(--motion-quick)", open && "rotate-90")}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path d="M6 3.5 L10.5 8 L6 12.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Settings row (units + scale)                                        */
/* ------------------------------------------------------------------ */

function SettingsRow() {
  const units = useSim((s) => s.units);
  const setUnits = useSim((s) => s.setUnits);
  const scaleMode = useSim((s) => s.scaleMode);
  const setScaleMode = useSim((s) => s.setScaleMode);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label="Units" className="flex rounded-full bg-fg/6 p-0.5">
        {(["metric", "astronomical", "earth"] as UnitSystem[]).map((u) => (
          <button
            key={u}
            role="radio"
            aria-checked={units === u}
            onClick={() => setUnits(u)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              units === u ? "bg-fg/15 text-fg" : "text-muted hover:text-fg",
            )}
          >
            {u === "metric" ? "km" : u === "astronomical" ? "AU" : "Earth"}
          </button>
        ))}
      </div>
      <div role="radiogroup" aria-label="Scale mode" className="flex rounded-full bg-fg/6 p-0.5">
        {(["presentation", "relative-size", "distance"] as ScaleMode[]).map((m) => (
          <button
            key={m}
            role="radio"
            aria-checked={scaleMode === m}
            onClick={() => setScaleMode(m)}
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              scaleMode === m ? "bg-fg/15 text-fg" : "text-muted hover:text-fg",
            )}
          >
            {m === "presentation" ? "Presentation" : m === "relative-size" ? "True size" : "True distance"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Main HUD                                                            */
/* ------------------------------------------------------------------ */

function PaceSlider() {
  const speed = useSim((s) => s.speed);
  const setSpeed = useSim((s) => s.setSpeed);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  if (!ready) return <div className="h-11 flex-1" aria-hidden="true" />;
  return (
    <Slider
      className="flex-1"
      min={0}
      max={1}
      step={0.01}
      value={[speedToSlider(speed)]}
      onValueChange={([v]) => setSpeed(sliderToSpeed(v ?? 0))}
    />
  );
}

export function ObservatoryHud() {
  const paused = useSim((s) => s.paused);
  const speed = useSim((s) => s.speed);
  const showLabels = useSim((s) => s.showLabels);
  const showOrbits = useSim((s) => s.showOrbits);
  const selectedId = useSim((s) => s.selectedId);
  const selectedRegionId = useSim((s) => s.selectedRegionId);
  const togglePaused = useSim((s) => s.togglePaused);
  const setShowLabels = useSim((s) => s.setShowLabels);
  const setShowOrbits = useSim((s) => s.setShowOrbits);
  const select = useSim((s) => s.select);
  const resetView = useSim((s) => s.resetView);
  const scaleMode = useSim((s) => s.scaleMode);
  const detailOpen = useSim((s) => s.detailOpen);
  const setDetailOpen = useSim((s) => s.setDetailOpen);
  const measurement = useSim((s) => s.measurement);
  const toggleMeasurement = useSim((s) => s.toggleMeasurement);
  const [searchOpen, setSearchOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [epochOpen, setEpochOpen] = useState(false);
  const [headerCopied, setHeaderCopied] = useState(false);
  const days = useSimDays();
  const selected = selectedId ? bodyById(selectedId) : null;
  const selectedRegion = selectedRegionId ? regionById(selectedRegionId) : null;
  const hasDetail = Boolean(selected || selectedRegion);

  const starBody = useMemo(() => BODIES.find((b) => b.identity.kind === "star"), []);
  const planetBodies = useMemo(() => BODIES.filter((b) => b.identity.kind === "planet"), []);
  const dwarfBodies = useMemo(() => BODIES.filter((b) => b.identity.kind === "dwarf-planet"), []);

  const moonChildren = useMemo(() => {
    const map: Record<string, { id: string; name: string; color: string }[]> = {};
    for (const m of MOONS) {
      (map[m.identity.parentId] ??= []).push({
        id: m.identity.id,
        name: m.identity.name,
        color: m.identity.color,
      });
    }
    return map;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA";
      if ((e.metaKey || e.ctrlKey) && e.code === "KeyK") {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      if (e.code === "Escape") {
        setSearchOpen(false);
        setCompareOpen(false);
        setEpochOpen(false);
        const s = useSim.getState();
        if (s.measurement.active) {
          s.clearMeasurement();
          return;
        }
        if (!inInput) {
          s.select(null);
          s.selectRegion(null);
        }
        return;
      }
      if (inInput) return;
      if (e.code === "Space") {
        e.preventDefault();
        useSim.getState().togglePaused();
      } else if (e.code === "KeyL") {
        const s = useSim.getState();
        s.setShowLabels(!s.showLabels);
      } else if (e.code === "KeyO") {
        const s = useSim.getState();
        s.setShowOrbits(!s.showOrbits);
      } else if (e.code === "KeyM") {
        const s = useSim.getState();
        s.setMoonMode(s.moonMode === "auto" ? "always" : s.moonMode === "always" ? "hidden" : "auto");
      } else if (e.code === "KeyD") {
        useSim.getState().toggleMeasurement();
      } else if (e.code === "KeyC") {

        setCompareOpen((o) => !o);
      } else if (e.code === "KeyT") {
        setEpochOpen((o) => !o);
      } else if (e.code === "KeyR") {
        useSim.getState().resetView();
      } else if (e.code === "Backspace") {
        // Return to parent in the hierarchy.
        const cur = useSim.getState().selectedId;
        if (cur) {
          const body = bodyById(cur);
          if (body?.identity.parentId) select(body.identity.parentId);
        }
      } else if (e.code === "Digit0") {
        select("sun");
      } else if (e.code.startsWith("Digit")) {
        const n = Number(e.code.slice(5));
        const body = BODIES[n];
        if (body) select(body.identity.id);
      } else if (e.code === "BracketLeft") {
        useSim.getState().setSpeed(Math.max(0.25, useSim.getState().speed / 2));
      } else if (e.code === "BracketRight") {
        useSim.getState().setSpeed(Math.min(16, useSim.getState().speed * 2));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  const detailPanel = selected ? (
    <BodyDetail body={selected} onSelectBody={select} />
  ) : selectedRegion ? (
    <RegionDetail region={selectedRegion} />
  ) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 text-fg">
      <header className="pointer-events-auto absolute top-0 right-0 left-0 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))] md:p-5">
        <div className="helios-enter min-w-0">
          <p className="font-sans text-xs font-medium tracking-widest text-muted uppercase">
            Observatory
          </p>
          <h1 className="font-display text-2xl leading-none tracking-tight text-fg sm:text-3xl md:text-4xl">
            Helios
          </h1>
        </div>
        <div className="helios-enter helios-enter-d1 flex items-center gap-0.5 rounded-2xl bg-surface/85 p-1 shadow-[var(--shadow-border)] backdrop-blur-md sm:gap-1">
          <Link
            to="/sandbox"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 text-xs font-medium text-primary shadow-sm backdrop-blur-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            aria-label="Open Simulation Sandbox"
            title="Open Simulation Sandbox"
          >
            <Sparkles className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
            <span className="hidden md:inline">Open Simulation Sandbox</span>
            <span className="md:hidden">Sandbox</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Search (Cmd+K)"
            onClick={(e) => {
              e.stopPropagation();
              setSearchOpen(true);
            }}
          >
            <Search className="size-5" strokeWidth={1.75} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Compare worlds (C)"
            className="hidden sm:inline-flex"
            onClick={(e) => {
              e.stopPropagation();
              setCompareOpen(true);
            }}
          >
            <GitCompareArrows className="size-5" strokeWidth={1.75} />
          </Button>
          <Button
            variant={epochOpen ? "primary" : "ghost"}
            size="icon"
            aria-label="Epoch date control (T)"
            onClick={(e) => {
              e.stopPropagation();
              setEpochOpen(true);
            }}
          >
            <Calendar className="size-5" strokeWidth={1.75} />
          </Button>
          <Button
            variant={measurement.active ? "primary" : "ghost"}
            size="icon"
            aria-label="Distance caliper (D)"
            title="Distance Caliper (D)"
            onClick={(e) => {
              e.stopPropagation();
              toggleMeasurement();
            }}
          >
            <Ruler className="size-5" strokeWidth={1.75} />
          </Button>
          <Button
            variant={headerCopied ? "primary" : "ghost"}
            size="icon"
            aria-label="Share observatory view"
            onClick={(e) => {
              e.stopPropagation();
              if (typeof window === "undefined") return;
              const url =
                window.location.origin +
                buildDeepLink(selectedId, formatEpochIso(simClock.days));
              navigator.clipboard.writeText(url).then(() => {
                setHeaderCopied(true);
                setTimeout(() => setHeaderCopied(false), 2000);
              });
            }}
          >
            {headerCopied ? (
              <Check className="size-5 text-emerald-400" strokeWidth={1.75} />
            ) : (
              <Share2 className="size-5" strokeWidth={1.75} />
            )}
          </Button>
          <Button
            variant={paused ? "primary" : "ghost"}
            size="icon"
            aria-label={paused ? "Resume simulation" : "Pause simulation"}
            onClick={togglePaused}
          >
            <IconSwap active={paused} On={Play} Off={Pause} />
          </Button>
          <Button
            variant={showLabels ? "subtle" : "ghost"}
            size="icon"
            aria-label={showLabels ? "Hide labels" : "Show labels"}
            onClick={() => setShowLabels(!showLabels)}
          >
            <Tag className="size-5" strokeWidth={1.75} />
          </Button>
          <Button
            variant={showOrbits ? "subtle" : "ghost"}
            size="icon"
            aria-label={showOrbits ? "Hide orbital trails" : "Show orbital trails"}
            onClick={() => setShowOrbits(!showOrbits)}
          >
            <OrbitIcon className="size-5" strokeWidth={1.75} />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Reset system view" onClick={resetView}>
            <RotateCcw className="size-5" strokeWidth={1.75} />
          </Button>
        </div>
      </header>

      <nav
        className="pointer-events-auto helios-enter helios-enter-d2 absolute top-24 bottom-36 left-4 hidden w-52 md:block"
        aria-label="Worlds"
      >
        <Panel className="flex h-full flex-col gap-1 overflow-hidden p-2">
          <p className="px-3 pt-2 pb-1 font-sans text-xs font-medium tracking-widest text-muted uppercase">
            Worlds
          </p>
          <div className="helios-scroll flex flex-1 flex-col gap-0.5 overflow-y-auto pr-0.5">
            {starBody ? (
              <BodyButton
                key={starBody.identity.id}
                id={starBody.identity.id}
                name={starBody.identity.name}
                color={starBody.identity.color}
                selected={selectedId === starBody.identity.id}
                selectedChildId={selectedId}
                moons={moonChildren[starBody.identity.id]}
                onSelect={select}
              />
            ) : null}
            <p className="px-3 pt-2 pb-0.5 font-sans text-[11px] font-medium tracking-wider text-muted uppercase">
              Planets
            </p>
            {planetBodies.map((body) => (
              <BodyButton
                key={body.identity.id}
                id={body.identity.id}
                name={body.identity.name}
                color={body.identity.color}
                selected={selectedId === body.identity.id}
                selectedChildId={selectedId}
                moons={moonChildren[body.identity.id]}
                onSelect={select}
              />
            ))}
            {dwarfBodies.length > 0 ? (
              <>
                <p className="px-3 pt-2 pb-0.5 font-sans text-[11px] font-medium tracking-wider text-muted uppercase">
                  Dwarf Planets
                </p>
                {dwarfBodies.map((body) => (
                  <BodyButton
                    key={body.identity.id}
                    id={body.identity.id}
                    name={body.identity.name}
                    color={body.identity.color}
                    selected={selectedId === body.identity.id}
                    selectedChildId={selectedId}
                    moons={moonChildren[body.identity.id]}
                    onSelect={select}
                  />
                ))}
              </>
            ) : null}
          </div>
          <div className="border-t border-fg/8 pt-2">
            <SettingsRow />
          </div>
          <Button
            variant={selectedId ? "ghost" : "subtle"}
            size="sm"
            className="mt-1 w-full justify-start rounded-xl"
            onClick={resetView}
          >
            <Compass className="size-4" strokeWidth={1.75} />
            System view
          </Button>
        </Panel>
      </nav>

      {/* Desktop detail panel */}
      <aside
        className={cn(
          "pointer-events-auto absolute top-24 right-4 bottom-36 hidden w-[22rem] md:block",
          "transition-[opacity,transform] duration-(--motion-fast) ease-(--ease-smooth-out)",
          hasDetail && detailOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
        aria-live="polite"
      >
        {hasDetail ? (
          <Panel className="flex h-full max-h-full flex-col">
            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-lg text-muted hover:bg-fg/8 hover:text-fg"
              aria-label="Collapse detail panel"
            >
              <X className="size-4" />
            </button>
            {detailPanel}
          </Panel>
        ) : null}
      </aside>

      {/* Mobile: selected body bottom sheet */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-0 md:hidden">
        <div
          className={cn(
            "transition-[opacity,transform] duration-(--motion-fast) ease-(--ease-smooth-out)",
            hasDetail && detailOpen ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
          )}
        >
          {hasDetail ? (
            <div className="helios-scroll max-h-[46dvh] overflow-y-auto rounded-t-3xl bg-surface/95 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-border)] backdrop-blur-md">
              <div className="sticky -top-3 -mx-4 z-10 mb-1 flex justify-center bg-gradient-to-b from-surface/95 to-transparent pt-1 pb-2">
                <button
                  type="button"
                  onClick={() => setDetailOpen(false)}
                  className="h-1.5 w-12 rounded-full bg-fg/25"
                  aria-label="Collapse detail sheet"
                />
              </div>
              {detailPanel}
            </div>
          ) : null}
        </div>
      </div>

      <footer
        className={cn(
          "pointer-events-auto absolute right-0 bottom-0 left-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-5",
          // The mobile detail sheet owns the bottom edge when open.
          hasDetail && detailOpen && "invisible md:visible",
        )}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="helios-scroll flex gap-2 overflow-x-auto md:hidden">
            {BODIES.map((body) => (
              <button
                key={body.identity.id}
                type="button"
                onClick={() => select(body.identity.id)}
                className={cn(
                  "flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 font-sans text-sm shadow-[var(--shadow-border)] backdrop-blur-md transition-[background-color,color] duration-(--motion-quick) ease-(--ease-out)",
                  selectedId === body.identity.id
                    ? "bg-fg text-bg"
                    : "bg-surface/85 text-fg hover:bg-fg/10",
                )}
              >
                <PlanetDot color={body.identity.color} />
                {body.identity.name}
              </button>
            ))}
          </div>

          <Panel className="helios-enter helios-enter-d3 flex flex-col gap-2 rounded-3xl px-5 py-3 md:flex-row md:items-center md:gap-6">
            <div className="flex min-w-36 items-baseline justify-between gap-3 md:flex-col md:items-start md:justify-center">
              <span className="font-sans text-xs font-medium tracking-widest text-muted uppercase">
                Pace
              </span>
              <span className="font-sans text-sm text-fg tabular-nums">
                {speed.toFixed(speed < 1 ? 2 : 1)}×
              </span>
            </div>
            <PaceSlider />
            <div className="flex items-center justify-between gap-2 md:flex-col md:items-end md:justify-center">
              <span className="font-sans text-xs text-muted tabular-nums">{formatYearPace(speed)}</span>
              <button
                type="button"
                onClick={() => setEpochOpen(true)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-0.5 font-sans text-xs text-fg/90 transition-colors hover:bg-fg/10 hover:text-fg"
                title="Open Epoch Date Control (T)"
              >
                <Calendar className="size-3 text-muted" />
                <span className="font-medium tabular-nums">{formatEpochDisplay(days)}</span>
                {paused ? <span className="font-medium text-amber-400/90">· Paused</span> : null}
              </button>
            </div>
          </Panel>
          <div className="flex items-center justify-center gap-2">
            <p className="hidden text-center font-sans text-xs text-muted md:block">
              Drag to orbit · scroll to zoom · click a world · ⌘K search · T date control · backspace to parent
            </p>
            <p className="text-center font-sans text-xs text-muted/80 md:hidden">
              {SCALE_MODE_LABELS[scaleMode]}
            </p>
          </div>
        </div>
      </footer>

      {/* Scale-honesty label (desktop, unobtrusive) */}
      <div className="pointer-events-none absolute top-24 left-1/2 hidden -translate-x-1/2 md:block">
        <p className="rounded-full bg-surface/70 px-3 py-1 font-sans text-[11px] tracking-wide text-muted backdrop-blur-md">
          <Ruler className="mr-1 inline size-3" aria-hidden="true" />
          {SCALE_MODE_LABELS[scaleMode]}
        </p>
      </div>

      {/* Re-open detail handle (desktop) */}
      {selected && !detailOpen ? (
        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="pointer-events-auto absolute right-4 bottom-36 hidden items-center gap-2 rounded-xl bg-surface/85 px-3 py-2 text-sm text-fg shadow-[var(--shadow-border)] backdrop-blur-md md:flex"
        >
          <Compass className="size-4" aria-hidden="true" />
          {selected.identity.name} details
        </button>
      ) : null}

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CompareDialog open={compareOpen} onClose={() => setCompareOpen(false)} />
      <EpochDialog open={epochOpen} onClose={() => setEpochOpen(false)} />
      <MeasurementPanel />
    </div>
  );
}

export { YEAR_SECONDS };
