import React, { useState } from "react";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { cn } from "@/lib/utils";
import { Activity, AlertTriangle, ChevronDown, ShieldCheck } from "lucide-react";
import type { TimestepQuality } from "@/simulation/engine/timestep";

export function AccuracyIndicator({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { quality, setQuality, stats, snapshot, strongFieldWarning, multiplier, enableRelativity, setEnableRelativity } = useSandboxStore();

  let massiveCount = 0;
  let tracerCount = 0;
  if (snapshot) {
    for (let i = 0; i < snapshot.numBodies; i++) {
      if (snapshot.isTracer[i] === 1) tracerCount++;
      else massiveCount++;
    }
  }

  const requestedWarpDays = (multiplier / 86400).toFixed(1);
  const achievedWarpDays = stats?.achievedRateDaysPerSec != null
    ? stats.achievedRateDaysPerSec.toFixed(1)
    : requestedWarpDays;

  return (
    <div className={cn("relative inline-block text-left", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label="Simulation Accuracy and Integrator Diagnostics"
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-medium transition-all backdrop-blur-md outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          strongFieldWarning
            ? "bg-amber-950/50 border-amber-500/50 text-amber-300 animate-pulse"
            : "bg-surface/80 border-fg/10 text-fg hover:border-fg/20"
        )}
      >
        {strongFieldWarning ? (
          <AlertTriangle className="size-3.5 text-amber-400 shrink-0" aria-hidden="true" />
        ) : (
          <ShieldCheck className="size-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
        )}
        <span>{quality.toUpperCase()} ACCURACY</span>
        <ChevronDown className="size-3 opacity-60 ml-0.5" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Accuracy Details"
          className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-surface/95 border border-fg/10 p-4 shadow-2xl backdrop-blur-xl z-50 text-xs font-sans text-fg space-y-3.5 animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between border-b border-fg/10 pb-2.5">
            <div className="flex items-center gap-1.5 font-medium">
              <Activity className="size-4 text-primary" aria-hidden="true" />
              <span>Astrophysical Model State</span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted hover:text-fg text-[11px] px-1.5 py-0.5 rounded border border-fg/10"
            >
              Close
            </button>
          </div>

          {strongFieldWarning && (
            <div
              role="alert"
              className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] leading-relaxed flex items-start gap-2"
            >
              <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Strong-Field Regime Warning</p>
                <p className="mt-0.5 opacity-90">
                  GM / (r · c²) &gt; 0.01. Relativistic gravitational curvature dominates.
                  Newtonian trajectory approximations are no longer scientifically reliable.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2 font-mono text-[11px]">
            <div className="flex justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Physics Model:</span>
              <span className={cn("font-medium", enableRelativity ? "text-amber-400" : "text-fg")}>
                {enableRelativity
                  ? "Pairwise 1PN Schwarzschild-like correction"
                  : "Newtonian all-pairs O(N²)"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Integrator:</span>
              <span className={cn("font-medium", enableRelativity ? "text-amber-300" : "text-fg")}>
                {enableRelativity
                  ? "Velocity-dependent KDK (symplectic guarantee not claimed)"
                  : "Velocity Verlet (KDK) — symplectic"}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Dynamic Bodies:</span>
              <span className="text-fg font-medium">
                {massiveCount} massive + {tracerCount} tracers (cap 256 / 1024)
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Base Step (dt):</span>
              <span className="text-fg font-medium">
                {stats?.dtSeconds ?? 900} s ({( (stats?.dtSeconds ?? 900) / 60 ).toFixed(0)} min)
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Warp (req / ach):</span>
              <span className="text-fg font-medium">
                {requestedWarpDays} d/s / {achievedWarpDays} d/s
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Collision Engine:</span>
              <span className="text-fg font-medium">Swept contact / Roche tidal / BH capture</span>
            </div>
            <div className="flex justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Environmental:</span>
              <span className="text-fg font-medium">Irradiance + Teq equilibrium model</span>
            </div>
          </div>

          <div className="pt-2 border-t border-fg/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-muted">Pairwise 1PN correction:</span>
              <button
                type="button"
                onClick={() => setEnableRelativity(!enableRelativity)}
                className={cn(
                  "px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase border transition-all",
                  enableRelativity
                    ? "bg-amber-500/20 border-amber-500 text-amber-300"
                    : "bg-fg/5 border-fg/10 text-muted hover:text-fg"
                )}
              >
                {enableRelativity ? "Active (1PN pair)" : "Newtonian"}
              </button>
            </div>

            <span className="text-[11px] font-medium text-muted block mb-1">Accuracy Preset:</span>
            <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Accuracy Preset">
              {(["fast", "standard", "high"] as TimestepQuality[]).map((q) => (
                <button
                  key={q}
                  type="button"
                  role="radio"
                  aria-checked={quality === q}
                  onClick={() => setQuality(q)}
                  className={cn(
                    "px-2 py-1 rounded-lg text-xs font-mono font-medium uppercase border transition-all text-center",
                    quality === q
                      ? "bg-primary/20 border-primary text-primary"
                      : "bg-fg/5 border-fg/10 text-muted hover:bg-fg/10 hover:text-fg"
                  )}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
