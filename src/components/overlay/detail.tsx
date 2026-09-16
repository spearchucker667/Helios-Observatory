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
  Share2,
  Check,
  Search,
} from "lucide-react";
import { bodyById, eventsForBody, moonsOf, satellitesOf, hasMoons } from "@/data/registry";
import type { AnyBody, AstronomicalEvent, MoonBody, SourceRef, SourceRecord } from "@/data/types";
import type { SatelliteCatalogueEntry, SatelliteFidelity } from "@/data/satellites/schema";
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
import { buildDeepLink, simClock, useSim } from "@/lib/sim-store";
import { formatEpochDisplay, formatEpochIso } from "@/lib/ephemeris";
import { HeliosMikuBrand } from "@/components/brand/helios-miku-brand";
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
  const hasSurface =
    body.identity.kind === "planet" ||
    body.identity.kind === "dwarf-planet" ||
    body.identity.kind === "moon";
  if (hasSurface) tabs.push("surface");
  if (hasMoons(body.identity.id)) tabs.push("moons");
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

function SatelliteCatalogueView({
  parentId: _parentId,
  satellites,
  curatedMoons,
  onSelectMoon,
}: {
  parentId?: string;
  satellites: SatelliteCatalogueEntry[];
  curatedMoons: MoonBody[];
  onSelectMoon: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"all" | SatelliteFidelity>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const curatedMap = useMemo(() => {
    const map = new Map<string, MoonBody>();
    for (const m of curatedMoons) map.set(m.identity.id, m);
    return map;
  }, [curatedMoons]);

  const counts = useMemo(() => {
    let major = 0;
    let regular = 0;
    let irregular = 0;
    for (const s of satellites) {
      if (s.fidelity === "major") major++;
      else if (s.fidelity === "regular") regular++;
      else irregular++;
    }
    return { major, regular, irregular };
  }, [satellites]);

  const filtered = useMemo(() => {
    return satellites.filter((s) => {
      if (filter !== "all" && s.fidelity !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = s.name.toLowerCase().includes(q);
        const matchesDesig = Boolean(s.designation && s.designation.toLowerCase().includes(q));
        const matchesFamily = Boolean(s.family && s.family.toLowerCase().includes(q));
        const matchesDiscoverer = Boolean(s.discovery?.discoverer && s.discovery.discoverer.toLowerCase().includes(q));
        return matchesName || matchesDesig || matchesFamily || matchesDiscoverer;
      }
      return true;
    });
  }, [satellites, filter, search]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fg/8 pb-2">
        <span className="font-sans text-xs text-muted">
          {satellites.length} confirmed natural satellites
        </span>
        <span className="font-sans text-[11px] text-muted/70">
          NASA/JPL/MPC Aug 2026
        </span>
      </div>

      <div className="flex justify-center">
        <HeliosMikuBrand
          variant="moon-catalog"
          className="h-auto w-full max-w-[280px] rounded-xl opacity-90"
        />
      </div>

      {/* Filter and search controls */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute top-2.5 left-2.5 size-3.5 text-muted" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter satellites by name or designation…"
            className="w-full rounded-xl bg-fg/6 py-1.5 pr-3 pl-8 font-sans text-xs text-fg placeholder:text-muted focus:bg-fg/10 focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-lg px-2.5 py-1 font-sans text-[11px] font-medium transition-colors",
              filter === "all" ? "bg-fg/15 text-fg" : "bg-fg/5 text-muted hover:bg-fg/10 hover:text-fg",
            )}
          >
            All ({satellites.length})
          </button>
          {counts.major > 0 ? (
            <button
              type="button"
              onClick={() => setFilter("major")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-sans text-[11px] font-medium transition-colors",
                filter === "major" ? "bg-cyan-500/20 text-cyan-300" : "bg-fg/5 text-muted hover:bg-fg/10 hover:text-fg",
              )}
            >
              Major ({counts.major})
            </button>
          ) : null}
          {counts.regular > 0 ? (
            <button
              type="button"
              onClick={() => setFilter("regular")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-sans text-[11px] font-medium transition-colors",
                filter === "regular" ? "bg-emerald-500/20 text-emerald-300" : "bg-fg/5 text-muted hover:bg-fg/10 hover:text-fg",
              )}
            >
              Regular ({counts.regular})
            </button>
          ) : null}
          {counts.irregular > 0 ? (
            <button
              type="button"
              onClick={() => setFilter("irregular")}
              className={cn(
                "rounded-lg px-2.5 py-1 font-sans text-[11px] font-medium transition-colors",
                filter === "irregular" ? "bg-amber-500/20 text-amber-300" : "bg-fg/5 text-muted hover:bg-fg/10 hover:text-fg",
              )}
            >
              Irregular ({counts.irregular})
            </button>
          ) : null}
        </div>
      </div>

      {/* Satellite list */}
      <ul className="space-y-1.5">
        {filtered.map((s) => {
          const curated = curatedMap.get(s.id);
          const isExpanded = expandedId === s.id;

          return (
            <li key={s.id} className="rounded-xl bg-fg/4 transition-colors hover:bg-fg/7">
              <div className="flex items-center gap-2 px-3 py-2">
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    s.fidelity === "major"
                      ? "bg-cyan-400 ring-2 ring-cyan-400/20"
                      : s.fidelity === "regular"
                        ? "bg-emerald-400"
                        : "bg-fg/40",
                  )}
                  style={curated ? { backgroundColor: curated.identity.color } : undefined}
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-sans text-sm font-medium text-fg">{s.name}</span>
                    {s.designation && s.designation !== s.name ? (
                      <span className="font-sans text-xs text-muted">({s.designation})</span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 font-sans text-[11px] text-muted">
                    <span>{s.orbit.semiMajorAxisKm.toLocaleString()} km</span>
                    <span>·</span>
                    <span>{s.orbit.periodDays.toFixed(s.orbit.periodDays < 10 ? 2 : 1)} d</span>
                    {s.orbit.retrograde ? (
                      <>
                        <span>·</span>
                        <span className="text-amber-400/90">Retrograde</span>
                      </>
                    ) : null}
                    {s.family ? (
                      <>
                        <span>·</span>
                        <span>{s.family}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {curated ? (
                    <button
                      type="button"
                      onClick={() => onSelectMoon(curated.identity.id)}
                      className="rounded-lg bg-fg/10 px-2 py-1 font-sans text-xs font-medium text-fg hover:bg-fg/20"
                      title="View 3D globe and orbit"
                    >
                      3D Focus
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : s.id)}
                      className="rounded-lg px-2 py-1 font-sans text-xs text-muted hover:bg-fg/10 hover:text-fg"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? "Less" : "Orbit"}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded ? (
                <div className="border-t border-fg/6 px-3 py-2 text-xs text-muted">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    <div>
                      <span className="font-medium text-fg/80">Eccentricity: </span>
                      <span className="tabular-nums">{s.orbit.eccentricity.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="font-medium text-fg/80">Inclination: </span>
                      <span className="tabular-nums">{s.orbit.inclinationDeg.toFixed(2)}°</span>
                    </div>
                    {s.discovery?.year ? (
                      <div className="col-span-2">
                        <span className="font-medium text-fg/80">Discovered: </span>
                        <span>{s.discovery.year} {s.discovery.discoverer ? `by ${s.discovery.discoverer}` : ""}</span>
                      </div>
                    ) : null}
                    {s.physical?.meanRadiusKm ? (
                      <div>
                        <span className="font-medium text-fg/80">Mean radius: </span>
                        <span className="tabular-nums">{s.physical.meanRadiusKm} km</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
      {filtered.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">No satellites match the current filter.</p>
      ) : null}
    </div>
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
  const [copied, setCopied] = useState(false);
  const [copyStatus, setCopyStatus] = useState("");
  const active = available.includes(tab) ? tab : "overview";
  const id = body.identity.id;
  const events = useMemo(() => eventsForBody(id), [id]);
  const moons = useMemo(() => moonsOf(id), [id]);
  const satellites = useMemo(() => satellitesOf(id), [id]);
  const parent = body.identity.parentId ? bodyById(body.identity.parentId) : undefined;

  const copyLink = async () => {
    if (typeof window === "undefined") return;
    const epochIso = formatEpochIso(simClock.days);
    const url = window.location.origin + buildDeepLink(id, epochIso);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setCopyStatus("Shareable link copied to clipboard");
        setTimeout(() => {
          setCopied(false);
          setCopyStatus("");
        }, 2000);
      } else {
        throw new Error("Clipboard API unavailable");
      }
    } catch {
      window.prompt("Shareable link:", url);
      setCopied(true);
      setCopyStatus("Link ready to copy");
      setTimeout(() => {
        setCopied(false);
        setCopyStatus("");
      }, 2000);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <span className="sr-only" aria-live="polite">{copyStatus}</span>

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
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-sans text-xs font-medium tracking-widest text-muted uppercase">{body.identity.category}</p>
          <h2 className="mt-0.5 font-display text-3xl font-medium leading-tight tracking-tight text-fg">
            {body.identity.name}
          </h2>
          <p className="mt-0.5 text-sm text-muted">{body.identity.epithet}</p>
        </div>
        <button
          type="button"
          onClick={copyLink}
          className="mt-1 flex shrink-0 items-center gap-1.5 rounded-xl bg-fg/6 px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-fg/12 hover:text-fg"
          title="Copy shareable deep link"
          aria-label="Copy shareable deep link"
        >
          {copied ? <Check className="size-3.5 text-emerald-400" /> : <Share2 className="size-3.5" />}
          <span>{copied ? "Copied" : "Share"}</span>
        </button>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label={`${body.identity.name} details`}
        className="flex flex-wrap gap-1 rounded-xl bg-fg/5 p-1"
      >
        {available.map((t) => {
          const Icon = TABS.find((x) => x.id === t)?.icon ?? Sparkles;
          const moonBadgeCount = satellites.length > 0 ? satellites.length : moons.length;
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
              <span>
                {t === "moons"
                  ? `Moons${moonBadgeCount ? ` (${moonBadgeCount})` : ""}`
                  : TABS.find((x) => x.id === t)?.label}
              </span>
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
              {satellites.length > 0 ? (
                <Row label="Satellites" value={`${satellites.length} confirmed`} />
              ) : moons.length > 0 ? (
                <Row label="Major moons" value={String(moons.length)} />
              ) : null}
              <Row label="Epoch" value={`${formatEpochDisplay(simClock.days)} (${formatEpochIso(simClock.days)})`} />
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
              <Row
                label="Mean radius"
                value={
                  body.physical.meanRadiusKm !== undefined
                    ? `${body.physical.meanRadiusKm.toLocaleString()} km`
                    : "Unknown / unmeasured"
                }
              />
              <Row label="Diameter" value={formatDiameter(body.physical.diameterKm, units)} />
              <Row label="Mass" value={formatMass(body.physical.massEarths, body.physical.massKg24, units)} />
              <Row
                label="Density"
                value={
                  body.physical.densityGCm3 !== undefined
                    ? `${body.physical.densityGCm3} g/cm³`
                    : "Unknown / unmeasured"
                }
              />
            </DataGroup>
            <DataGroup title="Gravity">
              <Row label="Surface gravity" value={formatGravity(body.physical.gravityG, units)} />
              <Row
                label="Escape velocity"
                value={
                  body.physical.escapeVelocityKmS !== undefined
                    ? `${body.physical.escapeVelocityKmS} km/s`
                    : "Unknown"
                }
              />
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
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-fg">{f.name}</p>
                        <span className="rounded-full bg-fg/8 px-2 py-0.5 font-sans text-[10px] text-muted uppercase">
                          {f.kind}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-muted">{f.summary}</p>
                      {f.lat !== undefined && f.lon !== undefined ? (
                        <p className="mt-1 font-sans text-[11px] text-muted/80 tabular-nums">
                          {Math.abs(f.lat)}°{f.lat >= 0 ? "N" : "S"} {Math.abs(f.lon)}°{f.lon >= 0 ? "E" : "W"}
                          {f.approximateLocation ? " · approx." : " · 3D marker on globe"}
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
          satellites.length > 0 ? (
            <SatelliteCatalogueView
              parentId={id}
              satellites={satellites}
              curatedMoons={moons}
              onSelectMoon={(moonId) => select(moonId)}
            />
          ) : moons.length > 0 ? (
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
                ? `${body.moonSystem.confirmedCount} confirmed — the minor satellites are catalogued.`
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
