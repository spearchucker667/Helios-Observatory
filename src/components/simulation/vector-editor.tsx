import React, { useState } from "react";
import { AU_M } from "@/simulation/domain/constants";
import { cn } from "@/lib/utils";

interface VectorEditorProps {
  label: string;
  value: [number, number, number]; // SI: meters or m/s
  type: "position" | "velocity";
  onChange: (val: [number, number, number]) => void;
  className?: string;
}

export function VectorEditor({
  label,
  value,
  type,
  onChange,
  className,
}: VectorEditorProps) {
  const [unit, setUnit] = useState<"au" | "km" | "kms" | "ms">(
    type === "position" ? "au" : "kms"
  );

  // Convert SI value to selected display unit
  const toDisplay = (si: number): number => {
    if (type === "position") {
      return unit === "au" ? si / AU_M : si / 1000;
    } else {
      return unit === "kms" ? si / 1000 : si;
    }
  };

  // Convert display unit back to SI
  const toSi = (disp: number): number => {
    if (type === "position") {
      return unit === "au" ? disp * AU_M : disp * 1000;
    } else {
      return unit === "kms" ? disp * 1000 : disp;
    }
  };

  const handleComponentChange = (index: 0 | 1 | 2, textVal: string) => {
    const num = parseFloat(textVal);
    if (!Number.isFinite(num)) return;
    const next: [number, number, number] = [...value];
    next[index] = toSi(num);
    onChange(next);
  };

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-muted">{label}</label>
        <div className="flex items-center gap-1 text-[10px] font-mono bg-bg/50 p-0.5 rounded border border-fg/5">
          {type === "position" ? (
            <>
              <button
                type="button"
                onClick={() => setUnit("au")}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  unit === "au" ? "bg-fg/15 text-fg font-semibold" : "text-muted hover:text-fg"
                )}
              >
                AU
              </button>
              <button
                type="button"
                onClick={() => setUnit("km")}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  unit === "km" ? "bg-fg/15 text-fg font-semibold" : "text-muted hover:text-fg"
                )}
              >
                km
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setUnit("kms")}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  unit === "kms" ? "bg-fg/15 text-fg font-semibold" : "text-muted hover:text-fg"
                )}
              >
                km/s
              </button>
              <button
                type="button"
                onClick={() => setUnit("ms")}
                className={cn(
                  "px-1.5 py-0.5 rounded transition-colors",
                  unit === "ms" ? "bg-fg/15 text-fg font-semibold" : "text-muted hover:text-fg"
                )}
              >
                m/s
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["X", "Y", "Z"] as const).map((axis, idx) => (
          <div key={axis} className="flex items-center rounded-lg bg-bg/60 border border-fg/10 px-2 py-1 focus-within:border-primary/60">
            <span className="text-[10px] font-mono text-muted mr-1.5 uppercase select-none">
              {axis}
            </span>
            <input
              type="number"
              step="any"
              aria-label={`${label} ${axis}`}
              value={Number(toDisplay(value[idx]).toPrecision(6))}
              onChange={(e) => handleComponentChange(idx as 0 | 1 | 2, e.target.value)}
              className="w-full bg-transparent font-mono text-xs text-fg outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
