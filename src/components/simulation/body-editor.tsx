import React, { useState } from "react";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { VectorEditor } from "./vector-editor";
import { Button } from "@/components/ui/button";
import {
  EARTH_MASS_KG,
  SOLAR_MASS_KG,
  EARTH_RADIUS_M,
  SOLAR_RADIUS_M,
} from "@/simulation/domain/constants";
import { calculateSchwarzschildRadius } from "@/simulation/engine/compact-objects";
import type { SimulationBodyClass, GravityRole } from "@/simulation/domain/types";
import { cn } from "@/lib/utils";
import { AlertCircle, Check, X } from "lucide-react";

const CLASS_OPTIONS: { value: SimulationBodyClass; label: string }[] = [
  { value: "star", label: "Star" },
  { value: "planet", label: "Planet" },
  { value: "dwarf-planet", label: "Dwarf Planet" },
  { value: "moon", label: "Moon" },
  { value: "asteroid", label: "Asteroid" },
  { value: "comet", label: "Comet" },
  { value: "white-dwarf", label: "White Dwarf" },
  { value: "neutron-star", label: "Neutron Star" },
  { value: "pulsar", label: "Pulsar" },
  { value: "magnetar", label: "Magnetar" },
  { value: "black-hole", label: "Black Hole (Schwarzschild)" },
  { value: "artificial", label: "Artificial Object" },
];

const PRESET_COLORS = [
  "#fdb813", // Sun
  "#9ca3af", // Mercury
  "#e5c158", // Venus
  "#4b8bf5", // Earth
  "#e05338", // Mars
  "#c88b3a", // Jupiter
  "#dfd195", // Saturn
  "#73cbf0", // Uranus
  "#3f54ba", // Neptune
  "#a855f7", // Pulsar/Exotic
  "#0a0a0c", // Black hole
  "#ffffff", // White dwarf
];

export function BodyEditor({ className }: { className?: string }) {
  const {
    bodyDraft,
    updateDraft,
    saveDraft,
    cancelEditing,
    draftErrors,
  } = useSandboxStore();

  const [massUnit, setMassUnit] = useState<"kg" | "earth" | "sun">("earth");
  const [radiusUnit, setRadiusUnit] = useState<"km" | "m" | "earth" | "sun">("earth");

  if (!bodyDraft) return null;

  // Mass display conversions
  const toDisplayMass = (kg: number) => {
    if (massUnit === "earth") return kg / EARTH_MASS_KG;
    if (massUnit === "sun") return kg / SOLAR_MASS_KG;
    return kg;
  };
  const fromDisplayMass = (val: number) => {
    if (massUnit === "earth") return val * EARTH_MASS_KG;
    if (massUnit === "sun") return val * SOLAR_MASS_KG;
    return val;
  };

  // Radius display conversions
  const toDisplayRadius = (m: number) => {
    if (radiusUnit === "km") return m / 1000;
    if (radiusUnit === "earth") return m / EARTH_RADIUS_M;
    if (radiusUnit === "sun") return m / SOLAR_RADIUS_M;
    return m;
  };
  const fromDisplayRadius = (val: number) => {
    if (radiusUnit === "km") return val * 1000;
    if (radiusUnit === "earth") return val * EARTH_RADIUS_M;
    if (radiusUnit === "sun") return val * SOLAR_RADIUS_M;
    return val;
  };

  // Calculate density
  const volumeM3 = (4 / 3) * Math.PI * Math.pow(bodyDraft.radius, 3);
  const densityKgM3 = volumeM3 > 0 ? bodyDraft.mass / volumeM3 : 0;
  const isCompact =
    bodyDraft.classification === "black-hole" ||
    bodyDraft.classification === "neutron-star" ||
    bodyDraft.classification === "pulsar" ||
    bodyDraft.classification === "magnetar" ||
    bodyDraft.classification === "white-dwarf";

  const rsM = calculateSchwarzschildRadius(bodyDraft.mass);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveDraft();
      }}
      className={cn("space-y-4 text-xs font-sans text-fg", className)}
    >
      <div className="flex items-center justify-between border-b border-fg/10 pb-2.5">
        <h3 className="font-semibold text-sm">Edit Object Properties</h3>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={cancelEditing}
            className="h-8 px-2.5"
          >
            <X className="size-3.5 mr-1" />
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            className="h-8 px-3"
          >
            <Check className="size-3.5 mr-1" />
            Save Changes
          </Button>
        </div>
      </div>

      {Object.keys(draftErrors).length > 0 && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1">
          {Object.entries(draftErrors).map(([key, msg]) => (
            <div key={key} className="flex items-center gap-1.5 text-xs">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Name and Classification */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <label htmlFor="body-name" className="text-muted font-medium">Name</label>
          <input
            id="body-name"
            type="text"
            value={bodyDraft.name}
            onChange={(e) => updateDraft({ name: e.target.value })}
            className="w-full px-3 py-1.5 rounded-lg bg-bg/60 border border-fg/10 text-fg outline-none focus:border-primary/60 font-sans text-xs"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="body-class" className="text-muted font-medium">Classification</label>
          <select
            id="body-class"
            value={bodyDraft.classification}
            onChange={(e) => {
              const nextClass = e.target.value as SimulationBodyClass;
              updateDraft({
                classification: nextClass,
                compact: nextClass === "black-hole" ? { schwarzschildRadiusM: calculateSchwarzschildRadius(bodyDraft.mass) } : bodyDraft.compact,
              });
            }}
            className="w-full px-2.5 py-1.5 rounded-lg bg-surface border border-fg/10 text-fg outline-none focus:border-primary/60 font-sans text-xs"
          >
            {CLASS_OPTIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Gravity Role & Color */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
        <div className="space-y-1">
          <span className="text-muted font-medium block">Gravity Role</span>
          <div className="flex items-center gap-2">
            {(["massive", "tracer"] as GravityRole[]).map((r) => (
              <label key={r} className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="gravityRole"
                  value={r}
                  checked={bodyDraft.gravityRole === r}
                  onChange={() => updateDraft({ gravityRole: r })}
                  className="accent-primary"
                />
                <span className="capitalize font-mono text-xs">{r}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <span className="text-muted font-medium block">Color</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESET_COLORS.map((col) => (
              <button
                key={col}
                type="button"
                onClick={() => updateDraft({ color: col })}
                style={{ backgroundColor: col }}
                aria-label={`Color ${col}`}
                className={cn(
                  "size-5 rounded-full border border-fg/20 transition-transform",
                  bodyDraft.color === col && "ring-2 ring-primary ring-offset-1 ring-offset-bg scale-110"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Mass with unit selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="body-mass" className="text-muted font-medium">Mass</label>
          <div className="flex items-center gap-1 text-[10px] font-mono bg-bg/50 p-0.5 rounded border border-fg/5">
            {(["earth", "sun", "kg"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setMassUnit(u)}
                className={cn(
                  "px-1.5 py-0.5 rounded uppercase transition-colors",
                  massUnit === u ? "bg-fg/15 text-fg font-semibold" : "text-muted hover:text-fg"
                )}
              >
                {u === "earth" ? "M⊕" : u === "sun" ? "M☉" : "kg"}
              </button>
            ))}
          </div>
        </div>
        <input
          id="body-mass"
          type="number"
          step="any"
          value={Number(toDisplayMass(bodyDraft.mass).toPrecision(6))}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (Number.isFinite(val) && val >= 0) {
              updateDraft({ mass: fromDisplayMass(val) });
            }
          }}
          className="w-full px-3 py-1.5 rounded-lg bg-bg/60 border border-fg/10 text-fg font-mono text-xs outline-none focus:border-primary/60"
        />
      </div>

      {/* Radius with unit selector */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label htmlFor="body-radius" className="text-muted font-medium">Radius</label>
          <div className="flex items-center gap-1 text-[10px] font-mono bg-bg/50 p-0.5 rounded border border-fg/5">
            {(["earth", "sun", "km", "m"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setRadiusUnit(u)}
                className={cn(
                  "px-1.5 py-0.5 rounded uppercase transition-colors",
                  radiusUnit === u ? "bg-fg/15 text-fg font-semibold" : "text-muted hover:text-fg"
                )}
              >
                {u === "earth" ? "R⊕" : u === "sun" ? "R☉" : u}
              </button>
            ))}
          </div>
        </div>
        <input
          id="body-radius"
          type="number"
          step="any"
          value={Number(toDisplayRadius(bodyDraft.radius).toPrecision(6))}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (Number.isFinite(val) && val >= 0) {
              updateDraft({ radius: fromDisplayRadius(val) });
            }
          }}
          className="w-full px-3 py-1.5 rounded-lg bg-bg/60 border border-fg/10 text-fg font-mono text-xs outline-none focus:border-primary/60"
        />
        <div className="flex items-center justify-between text-[11px] font-mono text-muted pt-0.5">
          <span>Density: {densityKgM3.toExponential(2)} kg/m³</span>
          {isCompact && (
            <span className="text-amber-300">rs = {(rsM / 1000).toFixed(2)} km</span>
          )}
        </div>
      </div>

      {/* Position Vector */}
      <VectorEditor
        label="Barycentric Position"
        value={bodyDraft.position}
        type="position"
        onChange={(pos) => updateDraft({ position: pos })}
      />

      {/* Velocity Vector */}
      <VectorEditor
        label="Barycentric Velocity"
        value={bodyDraft.velocity}
        type="velocity"
        onChange={(vel) => updateDraft({ velocity: vel })}
      />
    </form>
  );
}
