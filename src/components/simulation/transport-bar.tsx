import React, { useState } from "react";
import { useSandboxStore, type DisplayMode } from "@/simulation/state/sandbox-store";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Clock,
} from "lucide-react";

const WARP_PRESETS = [
  { label: "1 h/s", value: 3600 },
  { label: "1 d/s", value: 86400 },
  { label: "7 d/s", value: 86400 * 7 },
  { label: "30 d/s", value: 86400 * 30 },
  { label: "1 yr/s", value: 86400 * 365 },
];

function formatSimTime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const years = (days / 365.25).toFixed(2);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  
  if (days >= 365) {
    return `${years} yrs (${days} d)`;
  }
  return `${days} d ${hours} h`;
}

export function TransportBar({ className }: { className?: string }) {
  const {
    paused,
    play,
    pause,
    stepOnce,
    resetScenario,
    multiplier,
    setMultiplier,
    snapshot,
    displayMode,
    setDisplayMode,
    stats,
  } = useSandboxStore();

  const [confirmReset, setConfirmReset] = useState(false);

  const simTimeSec = snapshot?.simTimeSeconds ?? 0;
  const elapsedFormatted = formatSimTime(simTimeSec);
  const achievedWarp = stats?.achievedRateDaysPerSec != null
    ? stats.achievedRateDaysPerSec.toFixed(1)
    : (multiplier / 86400).toFixed(1);

  const handleReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
      return;
    }
    resetScenario();
    setConfirmReset(false);
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-surface/90 border border-fg/10 shadow-2xl backdrop-blur-xl text-fg font-sans",
        className
      )}
    >
      {/* Playback playback buttons */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          variant={paused ? "outline" : "primary"}
          size="icon"
          aria-label={paused ? "Play simulation (Space)" : "Pause simulation (Space)"}
          title={paused ? "Play (Space)" : "Pause (Space)"}
          onClick={paused ? play : pause}
          className="size-10 sm:size-11"
        >
          {paused ? <Play className="size-5" /> : <Pause className="size-5" />}
        </Button>

        <Button
          variant="outline"
          size="icon"
          aria-label="Step simulation forward one step (Period)"
          title="Single Step (Period)"
          onClick={stepOnce}
          className="size-10 sm:size-11"
        >
          <SkipForward className="size-5" />
        </Button>

        <Button
          variant={confirmReset ? "primary" : "ghost"}
          size="icon"
          aria-label={confirmReset ? "Click again to confirm reset" : "Reset scenario to initial state"}
          title={confirmReset ? "Confirm Reset?" : "Reset Scenario"}
          onClick={handleReset}
          className={cn(
            "size-10 sm:size-11 transition-colors",
            confirmReset && "bg-rose-600 hover:bg-rose-700 text-white border-rose-500"
          )}
        >
          <RotateCcw className="size-5" />
        </Button>
      </div>

      {/* Elapsed time & achieved warp */}
      <div className="flex items-center gap-4 px-2 py-1 rounded-xl bg-bg/50 border border-fg/5 text-xs font-mono shrink-0">
        <div className="flex items-center gap-1.5 text-fg">
          <Clock className="size-3.5 text-muted shrink-0" aria-hidden="true" />
          <span className="font-medium">{elapsedFormatted}</span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-muted border-l border-fg/10 pl-3">
          <span>Rate:</span>
          <span className="text-fg font-medium">{achievedWarp} d/s</span>
        </div>
      </div>

      {/* Time-scale warp presets */}
      <div className="hidden md:flex items-center gap-1 bg-bg/40 p-1 rounded-xl border border-fg/5">
        {WARP_PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setMultiplier(p.value)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all",
              multiplier === p.value
                ? "bg-primary/20 text-primary border border-primary/30"
                : "text-muted hover:text-fg hover:bg-fg/5"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Warp slider for fine control */}
      <div className="hidden lg:flex items-center gap-2 w-32 xl:w-40">
        <Slider
          min={1}
          max={86400 * 365}
          step={100}
          value={[multiplier]}
          onValueChange={([val]) => setMultiplier(val)}
          aria-label="Simulation Time Warp Speed"
        />
      </div>

      {/* Display scale mode selector */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="hidden xl:inline text-xs text-muted font-mono mr-1">Scale:</span>
        <div className="flex items-center bg-bg/40 p-0.5 rounded-xl border border-fg/5">
          {(
            [
              { mode: "presentation", label: "Visual" },
              { mode: "physical-size", label: "Size" },
              { mode: "distance", label: "Dist" },
            ] as { mode: DisplayMode; label: string }[]
          ).map((m) => (
            <button
              key={m.mode}
              type="button"
              onClick={() => setDisplayMode(m.mode)}
              title={`Display scale: ${m.mode}`}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-sans font-medium transition-all",
                displayMode === m.mode
                  ? "bg-fg/15 text-fg shadow-sm"
                  : "text-muted hover:text-fg hover:bg-fg/5"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
