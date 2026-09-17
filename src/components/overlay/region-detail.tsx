import type { SolarSystemRegion } from "@/data/types";
import { SOURCES } from "@/data/sources";
import { formatDistance, type UnitSystem } from "@/lib/format";
import { useSim } from "@/lib/sim-store";
import { Library } from "lucide-react";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="shrink-0 text-xs font-medium tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-right font-sans text-sm text-fg tabular-nums">{value}</dd>
    </div>
  );
}

function DataGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-fg/8 pb-3 last:border-0">
      <p className="mb-1 font-sans text-[11px] font-medium tracking-widest text-muted uppercase">{title}</p>
      <dl className="divide-y divide-fg/5">{children}</dl>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h4 className="font-sans text-xs font-medium tracking-widest text-muted uppercase">{title}</h4>
      {children}
    </section>
  );
}

export function RegionDetail({
  region,
}: {
  region: SolarSystemRegion;
}) {
  const units = useSim((s) => s.units) as UnitSystem;

  const innerStr =
    region.radialAu.innerMax && region.radialAu.innerMax !== region.radialAu.innerMin
      ? `${region.radialAu.innerMin}–${region.radialAu.innerMax} AU`
      : `${region.radialAu.innerMin} AU`;
  const outerStr = `${region.radialAu.outer.toLocaleString()} AU`;
  const spanAu = region.radialAu.outer - region.radialAu.innerMin;
  const outerKm = region.radialAu.outer * 149_597_870.7;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-sans text-[11px] font-medium tracking-widest text-muted uppercase">
            {region.kind === "belt" ? "Circumstellar Disc / Belt" : "Hypothesized Outer Shell"}
          </span>
          <span
            className={
              region.observationalStatus === "observed"
                ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400"
                : "rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-400"
            }
          >
            {region.observationalStatus === "observed" ? "Observed" : "Inferred"}
          </span>
        </div>
        <h2 className="font-display text-3xl tracking-tight text-fg">{region.name}</h2>
      </header>

      <p className="text-sm leading-relaxed text-fg/90">{region.summary}</p>

      <div className="space-y-3">
        <DataGroup title="Radial Boundaries">
          <Row label="Inner Boundary" value={innerStr} />
          <Row label="Outer Extent" value={outerStr} />
          <Row label="Radial Breadth" value={`${spanAu.toLocaleString()} AU`} />
          <Row label="Distance" value={formatDistance(region.radialAu.outer, outerKm, units)} />
        </DataGroup>
      </div>

      <Section title="Institutional Sources">
        <div className="space-y-2">
          {region.sourceIds.map((sid) => {
            const src = SOURCES[sid];
            return (
              <div key={sid} className="rounded-xl border border-fg/8 bg-fg/3 p-3 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-fg">{src ? src.title : sid}</p>
                    {src ? <p className="text-muted">{src.organization}</p> : null}
                  </div>
                  {src?.url ? (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted hover:text-fg"
                      aria-label={`Open source link for ${src.title}`}
                    >
                      <Library className="size-3.5" />
                    </a>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] text-muted">Retrieved: {region.retrieved}</p>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}
