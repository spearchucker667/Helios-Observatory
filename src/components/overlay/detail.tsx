import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock3,
  Globe2,
  Layers,
  Library,
  Orbit,
  Sparkles,
  Thermometer,
} from "lucide-react";
import { bodyById, eventsForBody, moonsOf } from "@/data/registry";
import type { AnyBody, AstronomicalEvent, MoonBody, SourceRef, SourceRecord } from "@/data/types";
import { SOURCES } from "@/data/sources";
import {
  formatDayLength,
  formatDiameter,
  formatDistance,
  formatEccentricity,
  formatGravity,
  formatMass,
  formatTemperature,
  formatTemperatureF,
  formatTilt,
  formatYearLength,
} from "@/lib/format";
import { useSim } from "@/lib/sim-store";
import { cn } from "@/lib/utils";

type TabId = "overview" | "physical" | "orbit" | "surface" | "moons" | "events";

const TABS: { id: TabId; label: string; icon: typeof Globe2 }[] = [
  { id: "overview", label: "Overview", icon: Sparkles },
  { id: "physical", label: "Physical", icon: Layers },
  { id: "orbit", label: "Orbit", icon: Orbit },
  { id: "surface", label: "Surface", icon: Globe2 },
  { id: "moons", label: "Moons", icon: ChevronRight },
  { id: "events", label: "Events", icon: Clock3 },
];

function tabsFor(body: AnyBody): TabId[] {
  const tabs: TabId[] = ["overview", "physical", "orbit"];
  const isPlanet = body.identity.kind === "planet";
  if (isPlanet || body.identity.kind === "moon") tabs.push("surface");
  if (moonsOf(body.identity.id).length > 0) tabs.push("moons");
  tabs.push("events");
  return tabs;
}

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
      <h4 className="font-sans text-[11px] font-medium tracking-widest text-muted uppercase">{title}</h4>
      {children}
    </section>
  );
}

function SourceList({ ids }: { ids: string[] }) {
  return (
    <Section title="Sources">
      <ul className="space-y-1">
        {ids.map((id) => {
          const s: SourceRecord | undefined = SOURCES[id];
          if (!s) return null;
          return (
            <li key={id} className="text-xs leading-snug text-muted">
              {s.organization} —{" "}
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="text-fg/85 underline decoration-fg/25 underline-offset-2 hover:decoration-fg/60"
              >
                {s.title}
              </a>{" "}
              <span className="text-muted/70">(retrieved {s.retrieved})</span>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function EventCard({ event, onSelectBody }: { event: AstronomicalEvent; onSelectBody: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const bodies = event.bodyIds.map((id) => bodyById(id)).filter(Boolean) as AnyBody[];
  return (
    <li className="relative pl-6">
      <span
        className="absolute top-1.5 left-[7px] size-2 rounded-full bg-fg/40 ring-2 ring-bg"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full rounded-lg text-left transition-colors hover:bg-fg/5"
      >
        <p className="font-sans text-xs text-muted tabular-nums">{event.date ?? event.year}</p>
        <p className="text-sm font-medium text-fg">{event.title}</p>
      </button>
      {open ? (
        <div className="mt-1 space-y-2 rounded-xl bg-fg/4 p-3">
          <p className="text-sm leading-normal text-fg/85">{event.summary}</p>
          <p className="text-sm leading-normal text-muted">
            <span className="font-medium tracking-wide text-fg/70 uppercase">Why it matters — </span>
            {event.significance}
          </p>
          <p className="text-xs text-muted">
            {event.mission ? `${event.mission} · ` : ""}
            {event.category}
          </p>
          {bodies.length > 1 ? (
            <div className="flex flex-wrap gap-1.5">
              {bodies.map((b) => (
                <button
                  key={b.identity.id}
                  type="button"
                  onClick={() => onSelectBody(b.identity.id)}
                  className="rounded-full bg-fg/8 px-2 py-0.5 text-xs text-fg/85 transition-colors hover:bg-fg/15"
                >
                  {b.identity.name}
                </button>
              ))}
            </div>
          ) : null}
          <SourceList ids={event.sourceIds} />
        </div>
      ) : null}
    </li>
  );
}

export function BodyDetail({
  body,
  onSelectBody,
}: {
  body: AnyBody;
  onSelectBody: (id: string | null) => void;
}) {
  const units = useSim((s) => s.units);
  const select = useSim((s) => s.select);
  const available = tabsFor(body);
  const [tab, setTab] = useState<TabId>("overview");
  const active = available.includes(tab) ? tab : "overview";
  const id = body.identity.id;
  const events = useMemo(() => eventsForBody(id), [id]);
  const moons = useMemo(() => moonsOf(id), [id]);
  const parent = body.identity.parentId ? bodyById(body.identity.parentId) : undefined;

  return (
    <div className="flex min-h-0 flex-col gap-3">
      {/* Breadcrumb — planets sit directly in the solar system; moons nest under their planet. */}
      <nav aria-label="Hierarchy" className="flex flex-wrap items-center gap-1 text-xs text-muted">
        <button type="button" onClick={() => onSelectBody(null)} className="hover:text-fg">
          Solar System
        </button>
        {body.identity.kind === "moon" && parent ? (
          <>
            <ChevronRight className="size-3" aria-hidden="true" />
            <button type="button" onClick={() => onSelectBody(parent.identity.id)} className="hover:text-fg">
              {parent.identity.name}
            </button>
          </>
        ) : null}
        <ChevronRight className="size-3" aria-hidden="true" />
        <span className="text-fg/90">{body.identity.name}</span>
      </nav>

      {/* Header */}
      <div>
        <p className="font-sans text-xs font-medium tracking-widest text-muted uppercase">{body.identity.category}</p>
        <h2 className="mt-0.5 font-display text-3xl font-medium leading-tight tracking-tight text-fg">
          {body.identity.name}
        </h2>
        <p className="mt-0.5 text-sm text-muted">{body.identity.epithet}</p>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={`${body.identity.name} details`}
        className="flex flex-wrap gap-1 rounded-xl bg-fg/5 p-1"
      >
        {available.map((t) => {
          const Icon = TABS.find((x) => x.id === t)?.icon ?? Sparkles;
          return (
            <button
              key={t}
              role="tab"
              aria-selected={active === t}
              onClick={() => setTab(t)}
              className={cn(
                "flex min-w-16 flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
                active === t ? "bg-fg/12 text-fg" : "text-muted hover:text-fg",
              )}
            >
              <Icon className="size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              <span>{t === "moons" ? `Moons${moons.length ? ` (${moons.length})` : ""}` : TABS.find((x) => x.id === t)?.label}</span>
            </button>
          );
        })}
      </div>

      {/* Panels */}
      <div className="helios-scroll min-h-0 flex-1 space-y-4 overflow-y-auto pr-1" role="tabpanel">
        {active === "overview" ? (
          <>
            <p className="text-sm leading-relaxed text-fg/85">{body.blurb}</p>
            <div className="grid grid-cols-2 gap-x-4">
              <Row label="Diameter" value={formatDiameter(body.physical.diameterKm, units)} />
              <Row label="Gravity" value={formatGravity(body.physical.gravityG, units)} />
              <Row label="Mean temp" value={formatTemperature(body.temperature.meanC)} />
              <Row label="Day" value={formatDayLength(body.rotation.periodHours)} />
              {body.orbit ? <Row label="Year" value={formatYearLength(body.orbit.periodDays)} /> : null}
              {moons.length > 0 ? <Row label="Major moons" value={String(moons.length)} /> : null}
            </div>
            {body.identity.discovery ? (
              <Section title="Discovery">
                <p className="text-sm text-fg/80">
                  {body.identity.discovery.year} — {body.identity.discovery.discoverer}
                </p>
                {body.identity.discovery.note ? (
                  <p className="text-xs leading-snug text-muted">{body.identity.discovery.note}</p>
                ) : null}
              </Section>
            ) : null}
            <SourceList ids={body.sources.map((s: SourceRef) => s.id)} />
          </>
        ) : null}

        {active === "physical" ? (
          <>
            <DataGroup title="Dimensions & mass">
              <Row label="Mean radius" value={`${body.physical.meanRadiusKm.toLocaleString()} km`} />
              <Row label="Diameter" value={formatDiameter(body.physical.diameterKm, units)} />
              <Row label="Mass" value={formatMass(body.physical.massEarths, body.physical.massKg24, units)} />
              <Row label="Density" value={`${body.physical.densityGCm3} g/cm³`} />
            </DataGroup>
            <DataGroup title="Gravity">
              <Row label="Surface gravity" value={formatGravity(body.physical.gravityG, units)} />
              <Row label="Escape velocity" value={`${body.physical.escapeVelocityKmS} km/s`} />
            </DataGroup>
            <DataGroup title="Rotation & tilt">
              <Row label="Day (sidereal)" value={formatDayLength(body.rotation.periodHours)} />
              <Row label="Axial tilt" value={formatTilt(body.rotation.axialTiltDeg)} />
            </DataGroup>
            <DataGroup title="Temperature">
              <Row label="Mean" value={formatTemperature(body.temperature.meanC)} />
              <Row label="Mean (°F)" value={formatTemperatureF(body.temperature.meanC)} />
              {body.temperature.noteC ? (
                <Row
                  label="Range"
                  value={`${formatTemperature(body.temperature.noteC.min)} to ${formatTemperature(body.temperature.noteC.max)}`}
                />
              ) : null}
            </DataGroup>
            {body.interior ? (
              <Section title="Interior">
                <p className="text-sm leading-normal text-fg/85">{body.interior}</p>
              </Section>
            ) : null}
            {body.magneticField ? (
              <Section title="Magnetic field">
                <p className="text-sm leading-normal text-fg/85">{body.magneticField}</p>
              </Section>
            ) : null}
            <SourceList ids={body.sources.map((s: SourceRef) => s.id)} />
          </>
        ) : null}

        {active === "orbit" ? (
          body.orbit ? (
            <>
              <DataGroup title="Path">
                {body.orbit.semiMajorAxisAu !== undefined ? (
                  <Row label="Distance" value={formatDistance(body.orbit.semiMajorAxisAu, undefined, units)} />
                ) : null}
                {body.orbit.semiMajorAxisKm !== undefined ? (
                  <Row label="Distance" value={formatDistance(undefined, body.orbit.semiMajorAxisKm, units)} />
                ) : null}
                <Row label="Year" value={formatYearLength(body.orbit.periodDays)} />
                <Row label="Eccentricity" value={formatEccentricity(body.orbit.eccentricity)} />
                <Row label="Inclination" value={formatTilt(body.orbit.inclinationDeg)} />
                {body.orbit.orbitalSpeedKmS ? (
                  <Row label="Mean speed" value={`${body.orbit.orbitalSpeedKmS} km/s`} />
                ) : null}
                {body.orbit.retrograde ? <Row label="Direction" value="Retrograde" /> : null}
                {body.orbit.tidallyLocked ? <Row label="Rotation" value="Tidally locked" /> : null}
              </DataGroup>
              <p className="text-xs leading-snug text-muted">
                Positions shown by the simulation are circular-orbit approximations for education, not
                ephemeris-accurate coordinates (see docs/ASTRONOMICAL_DATA.md).
              </p>
            </>
          ) : (
            <p className="text-sm text-muted">The Sun orbits the barycentre of the solar system.</p>
          )
        ) : null}

        {active === "surface" ? (
          <>
            {body.notes?.surface ? (
              <Section title="Surface">
                <p className="text-sm leading-normal text-fg/85">{body.notes.surface}</p>
              </Section>
            ) : null}
            {body.notes?.climate ? (
              <Section title="Climate">
                <p className="text-sm leading-normal text-fg/85">{body.notes.climate}</p>
              </Section>
            ) : null}
            {body.atmosphere ? (
              <Section title="Atmosphere">
                <dl className="space-y-1">
                  {body.atmosphere.composition.map((c) => (
                    <Row key={c.name} label={c.name} value={c.share} />
                  ))}
                  {body.atmosphere.pressureBars !== undefined ? (
                    <Row
                      label="Pressure"
                      value={
                        body.atmosphere.pressureBars < 0.001
                          ? `${body.atmosphere.pressureBars.toExponential(1)} bar`
                          : `${body.atmosphere.pressureBars} bar`
                      }
                    />
                  ) : null}
                </dl>
                {body.atmosphere.note ? (
                  <p className="text-xs leading-snug text-muted">{body.atmosphere.note}</p>
                ) : null}
              </Section>
            ) : null}
            {body.features?.length ? (
              <Section title="Notable features">
                <ul className="space-y-2.5">
                  {body.features.map((f) => (
                    <li key={f.id} className="rounded-xl bg-fg/4 p-3">
                      <p className="text-sm font-medium text-fg">{f.name}</p>
                      <p className="mt-0.5 text-xs leading-snug text-muted">{f.summary}</p>
                      {f.lat !== undefined && f.lon !== undefined ? (
                        <p className="mt-1 font-sans text-[11px] text-muted/80 tabular-nums">
                          {Math.abs(f.lat)}°{f.lat >= 0 ? "N" : "S"} {Math.abs(f.lon)}°{f.lon >= 0 ? "E" : "W"}
                          {f.approximateLocation ? " · approx." : ""}
                        </p>
                      ) : f.approximateLocation ? (
                        <p className="mt-1 font-sans text-[11px] text-muted/80">approximate location</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
            {body.rings ? (
              <Section title="Rings">
                <p className="text-sm leading-normal text-fg/85">{body.rings.composition}</p>
                {body.rings.divisions?.length ? (
                  <ul className="mt-1 space-y-1">
                    {body.rings.divisions.map((dv) => (
                      <li key={dv.name} className="text-xs text-muted">
                        <span className="text-fg/80">{dv.name}</span> — {dv.note}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </Section>
            ) : null}
            <SourceList ids={body.sources.map((s: SourceRef) => s.id)} />
          </>
        ) : null}

        {active === "moons" ? (
          moons.length > 0 ? (
            <ul className="space-y-1.5">
              {moons.map((m: MoonBody) => (
                <li key={m.identity.id}>
                  <button
                    type="button"
                    onClick={() => select(m.identity.id)}
                    className="flex w-full items-center gap-3 rounded-xl bg-fg/4 px-3 py-2.5 text-left transition-colors hover:bg-fg/10"
                  >
                    <span
                      className="size-3 shrink-0 rounded-full ring-1 ring-fg/20"
                      style={{ backgroundColor: m.identity.color }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">{m.identity.name}</span>
                      <span className="block truncate text-xs text-muted">{m.identity.epithet}</span>
                    </span>
                    <span className="shrink-0 font-sans text-xs text-muted tabular-nums">
                      {formatYearLength(m.orbit?.periodDays ?? 27)}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">
              {body.moonSystem
                ? `${body.moonSystem.confirmedCount} confirmed — the minor satellites are catalogued but not rendered at full detail.`
                : "No known natural satellites."}
            </p>
          )
        ) : null}

        {active === "events" ? (
          events.length > 0 ? (
            <>
              <p className="text-xs text-muted">
                {events.length} milestone{events.length === 1 ? "" : "s"} — chronological
              </p>
              <ol className="relative space-y-4 border-l border-fg/10 pl-4">
                {events.map((e) => (
                  <EventCard key={e.id} event={e} onSelectBody={(bid) => onSelectBody(bid)} />
                ))}
              </ol>
            </>
          ) : (
            <p className="text-sm text-muted">No tracked events for this body yet.</p>
          )
        ) : null}
      </div>

      {body.notes?.exploration && active === "overview" ? (
        <Section title="Exploration">
          <p className="text-sm leading-normal text-fg/85">{body.notes.exploration}</p>
        </Section>
      ) : null}
    </div>
  );
}

/** Breadcrumb bar used above the panel when deep in the hierarchy. */
export function Breadcrumb({
  path,
  onNavigate,
}: {
  path: string[];
  onNavigate: (id: string | null) => void;
}) {
  return (
    <nav aria-label="Location" className="flex items-center gap-1 text-xs">
      {path.map((p, i) => (
        <span key={`${p}-${i}`} className="flex items-center gap-1">
          {i > 0 ? <ChevronRight className="size-3 text-muted" aria-hidden="true" /> : null}
          {i === path.length - 1 ? (
            <span className="text-fg">{p}</span>
          ) : (
            <button type="button" className="text-muted hover:text-fg" onClick={() => onNavigate(i === 0 ? null : p.toLowerCase())}>
              {p}
            </button>
          )}
        </span>
      ))}
    </nav>
  );
}

export { ArrowLeft as BackIcon, Library, Thermometer };
