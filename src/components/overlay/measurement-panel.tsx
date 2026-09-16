import { useMemo } from "react";
import { useSim, simClock } from "@/lib/sim-store";
import { calculateDistance } from "@/lib/measurement";
import { BODIES, MOONS } from "@/data/registry";
import { HeliosMikuBrand } from "@/components/brand/helios-miku-brand";
import { cn } from "@/lib/utils";

export function MeasurementPanel() {
  const measurement = useSim((s) => s.measurement);
  const dateNonce = useSim((s) => s.dateNonce);
  const setMeasurementSource = useSim((s) => s.setMeasurementSource);
  const setMeasurementTarget = useSim((s) => s.setMeasurementTarget);
  const clearMeasurement = useSim((s) => s.clearMeasurement);

  const { active, sourceId, targetId } = measurement;

  const allSelectable = useMemo(() => {
    return [
      ...BODIES.map((b) => ({ id: b.identity.id, name: b.identity.name, kind: b.identity.kind })),
      ...MOONS.map((m) => ({ id: m.identity.id, name: `${m.identity.name} (${m.identity.parentId})`, kind: "moon" })),
    ];
  }, []);

  const distance = useMemo(() => {
    if (!sourceId || !targetId) return null;
    return calculateDistance(sourceId, targetId, simClock.days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceId, targetId, dateNonce]);

  if (!active) return null;

  const handleSwap = () => {
    if (!sourceId || !targetId) return;
    setMeasurementSource(targetId);
    setMeasurementTarget(sourceId);
  };

  return (
    <div
      role="region"
      aria-label="Scientific Distance Measurement Tool"
      className={cn(
        "pointer-events-auto fixed bottom-6 left-6 z-30 flex flex-col gap-3 rounded-2xl border border-sky-500/30 bg-bg/90 p-4 shadow-2xl backdrop-blur-xl transition-all duration-300",
        "w-84 max-w-[calc(100vw-3rem)] font-sans text-fg",
      )}
    >
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span className="font-serif text-sm font-semibold tracking-wide text-fg">
            Astronomical Caliper
          </span>
          <HeliosMikuBrand variant="measurement" className="h-4 w-auto opacity-75" />
        </div>
        <button
          type="button"
          onClick={clearMeasurement}
          className="rounded-lg p-1 text-muted-fg hover:bg-fg/5 hover:text-fg transition-colors"
          title="Close Caliper (Esc)"
          aria-label="Close distance measurement tool"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="flex items-center gap-2">
        {/* Source Body Select */}
        <div className="flex-1">
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-fg mb-1 block">
            Origin
          </label>
          <select
            value={sourceId ?? ""}
            onChange={(e) => setMeasurementSource(e.target.value || null)}
            className="w-full rounded-lg border border-border/60 bg-bg/60 px-2 py-1.5 text-xs text-fg focus:border-sky-400 focus:outline-none"
          >
            <option value="">Select origin...</option>
            {allSelectable.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Swap Button */}
        <button
          type="button"
          onClick={handleSwap}
          disabled={!sourceId || !targetId}
          className="mt-4 rounded-lg p-1.5 text-muted-fg hover:bg-fg/10 hover:text-sky-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          title="Swap Origin and Target"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        </button>

        {/* Target Body Select */}
        <div className="flex-1">
          <label className="text-[10px] uppercase font-bold tracking-wider text-muted-fg mb-1 block">
            Target
          </label>
          <select
            value={targetId ?? ""}
            onChange={(e) => setMeasurementTarget(e.target.value || null)}
            className="w-full rounded-lg border border-border/60 bg-bg/60 px-2 py-1.5 text-xs text-fg focus:border-sky-400 focus:outline-none"
          >
            <option value="">Select target...</option>
            {allSelectable.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Distance Readout Card */}
      {distance ? (
        <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-fg">Separation (AU)</span>
            <span className="font-mono text-base font-bold text-sky-300">
              {distance.formattedAu}
            </span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-fg">Physical Metric</span>
            <span className="font-mono text-xs text-fg/90">
              {distance.formattedKm}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t border-sky-500/15 pt-1.5">
            <span className="text-xs text-muted-fg">Light Travel Time</span>
            <span className="font-mono text-xs font-semibold text-amber-300">
              {distance.formattedLightTime}
            </span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/40 p-3 text-center text-xs text-muted-fg">
          Click any body or select above to calculate 3D Euclidean distance.
        </div>
      )}
    </div>
  );
}
