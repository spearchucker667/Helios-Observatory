import React, { useState } from "react";
import type { SimulationFieldProvenance, SimulationProvenanceKind } from "@/simulation/domain/provenance";
import { cn } from "@/lib/utils";
import { Info } from "lucide-react";

interface ProvenanceBadgeProps {
  provenance?: SimulationFieldProvenance;
  label?: string;
  className?: string;
}

const BADGE_CONFIG: Record<
  SimulationProvenanceKind,
  { label: string; bg: string; text: string; border: string; desc: string }
> = {
  canonical: {
    label: "CANONICAL",
    bg: "bg-sky-950/40",
    text: "text-sky-300",
    border: "border-sky-500/30",
    desc: "Derived directly from immutable IAU/NASA astronomical observational records.",
  },
  calculated: {
    label: "CALCULATED",
    bg: "bg-emerald-950/40",
    text: "text-emerald-300",
    border: "border-emerald-500/30",
    desc: "Numerically computed in real time via the symplectic Velocity Verlet physics engine.",
  },
  estimated: {
    label: "ESTIMATED",
    bg: "bg-amber-950/40",
    text: "text-amber-300",
    border: "border-amber-500/30",
    desc: "Analytical approximation based on astrophysical equilibrium models.",
  },
  custom: {
    label: "CUSTOM",
    bg: "bg-purple-950/40",
    text: "text-purple-300",
    border: "border-purple-500/30",
    desc: "User-defined parameter or modified experimental condition.",
  },
  unsupported: {
    label: "UNSUPPORTED",
    bg: "bg-zinc-900/60",
    text: "text-zinc-400",
    border: "border-zinc-700/40",
    desc: "Quantity not modeled by the current Newtonian N-body simulation engine.",
  },
};

export function ProvenanceBadge({ provenance, label, className }: ProvenanceBadgeProps) {
  const [open, setOpen] = useState(false);
  const kind: SimulationProvenanceKind = provenance?.kind ?? "calculated";
  const config = BADGE_CONFIG[kind] ?? BADGE_CONFIG.calculated;

  return (
    <div className={cn("relative inline-flex items-center", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onBlur={() => setOpen(false)}
        aria-expanded={open}
        aria-label={`Provenance: ${config.label}. Click for details.`}
        className={cn(
          "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium tracking-wider uppercase border transition-colors outline-none focus-visible:ring-1 focus-visible:ring-primary/60",
          config.bg,
          config.text,
          config.border
        )}
      >
        <span>{config.label}</span>
        <Info className="size-2.5 opacity-70" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="tooltip"
          className="absolute z-50 bottom-full left-0 mb-1.5 w-64 p-2.5 rounded-lg bg-surface border border-fg/10 shadow-xl backdrop-blur-md text-xs font-sans text-fg space-y-1.5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-fg/10 pb-1">
            <span className="font-semibold text-fg">{label ?? "Provenance"}</span>
            <span className={cn("text-[10px] font-mono px-1 rounded", config.bg, config.text)}>
              {config.label}
            </span>
          </div>
          <p className="text-muted leading-relaxed">{config.desc}</p>
          {provenance?.method && (
            <div className="text-[11px] text-muted">
              <span className="font-medium text-fg">Method:</span> {provenance.method}
            </div>
          )}
          {provenance?.sourceIds && provenance.sourceIds.length > 0 && (
            <div className="text-[11px] text-muted">
              <span className="font-medium text-fg">Sources:</span>{" "}
              {provenance.sourceIds.join(", ")}
            </div>
          )}
          {provenance?.note && (
            <div className="text-[11px] text-muted italic">
              <span className="font-medium not-italic text-fg">Note:</span> {provenance.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
