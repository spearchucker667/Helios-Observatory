import React from "react";
import { useSandboxStore, type InspectorTab } from "@/simulation/state/sandbox-store";
import { ProvenanceBadge } from "./provenance-badge";
import { BodyEditor } from "./body-editor";
import { Button } from "@/components/ui/button";
import {
  AU_M,
  EARTH_MASS_KG,
  SOLAR_MASS_KG,
  EARTH_RADIUS_M,
  G_CODATA_2022,
} from "@/simulation/domain/constants";
import { cartesianToOrbitalElements } from "@/simulation/physics/orbital-elements";
import { calculateSchwarzschildRadius } from "@/simulation/engine/compact-objects";
import { computeEquilibriumTemperature } from "@/simulation/environment/temperature";
import { computeRocheDiagnostics } from "@/simulation/collisions/disruption";
import { calculateEinsteinPrecession } from "@/simulation/environment/orbital-derived";
import { cn } from "@/lib/utils";
import {
  Edit3,
  X,
  Orbit,
  Thermometer,
  Zap,
  Globe,
  Compass,
  FileText,
  type LucideIcon,
} from "lucide-react";

function formatSimTime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const years = (days / 365.25).toFixed(2);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  if (days >= 365) return `${years} yrs (${days} d)`;
  return `${days} d ${hours} h`;
}

export function BodyInspector({ className }: { className?: string }) {
  const {
    selectedId,
    bodies,
    isEditing,
    startEditing,
    selectBody,
    inspectorTab,
    setInspectorTab,
    events,
  } = useSandboxStore();

  if (!selectedId) {
    return (
      <div
        className={cn(
          "p-6 rounded-2xl bg-surface/85 border border-fg/10 backdrop-blur-xl text-center text-muted font-sans text-xs",
          className
        )}
      >
        <Orbit className="size-8 mx-auto mb-2 opacity-40 text-primary" aria-hidden="true" />
        <p className="font-medium text-fg">No Object Selected</p>
        <p className="mt-1">Select an astronomical body from the 3D scene or browser to inspect astrophysics.</p>
      </div>
    );
  }

  const body = bodies[selectedId];
  if (!body) {
    return (
      <div className={cn("p-6 rounded-2xl bg-surface/85 border border-fg/10 backdrop-blur-xl text-center text-muted", className)}>
        <p>Object no longer present in simulation.</p>
        <Button variant="ghost" size="sm" onClick={() => selectBody(null)} className="mt-2">
          Dismiss
        </Button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={cn("p-4 rounded-2xl bg-surface/90 border border-fg/10 shadow-2xl backdrop-blur-xl overflow-y-auto helios-scroll max-h-[85vh]", className)}>
        <BodyEditor />
      </div>
    );
  }

  // Derived physics values
  const [x, y, z] = body.position;
  const [vx, vy, vz] = body.velocity;
  const distOriginM = Math.hypot(x, y, z);
  const distOriginAu = distOriginM / AU_M;
  const speedMs = Math.hypot(vx, vy, vz);
  const speedKmS = speedMs / 1000;

  // Mass & radius relative
  const massEarths = (body.mass / EARTH_MASS_KG).toExponential(3);
  const massSuns = (body.mass / SOLAR_MASS_KG).toExponential(3);
  const radiusKm = body.radius / 1000;
  const radiusEarths = (body.radius / EARTH_RADIUS_M).toFixed(3);

  // Surface gravity & escape velocity
  const surfaceGravMs2 = body.radius > 0 ? (G_CODATA_2022 * body.mass) / (body.radius * body.radius) : 0;
  const escapeVelKmS = body.radius > 0 ? Math.sqrt((2 * G_CODATA_2022 * body.mass) / body.radius) / 1000 : 0;
  const volumeM3 = (4 / 3) * Math.PI * Math.pow(body.radius, 3);
  const densityKgM3 = volumeM3 > 0 ? body.mass / volumeM3 : 0;

  // Primary body for orbital elements (Sun or most massive other body)
  const otherBodies = Object.values(bodies).filter((b) => b.id !== body.id && b.gravityRole === "massive");
  const primaryBody = otherBodies.sort((a, b) => b.mass - a.mass)[0];
  const centralMass = primaryBody?.mass ?? SOLAR_MASS_KG;

  // Relative state vector to primary
  const relPos: [number, number, number] = primaryBody
    ? [x - primaryBody.position[0], y - primaryBody.position[1], z - primaryBody.position[2]]
    : [x, y, z];
  const relVel: [number, number, number] = primaryBody
    ? [vx - primaryBody.velocity[0], vy - primaryBody.velocity[1], vz - primaryBody.velocity[2]]
    : [vx, vy, vz];

  const oscElements = cartesianToOrbitalElements(relPos, relVel, centralMass, body.mass);
  const semiMajorAxisAu = oscElements.semiMajorAxisM / AU_M;
  const periodDays = (oscElements.periodSeconds ?? 0) / 86400;
  const periapsisAu = (oscElements.semiMajorAxisM * (1 - oscElements.eccentricity)) / AU_M;
  const apoapsisAu = (oscElements.semiMajorAxisM * (1 + oscElements.eccentricity)) / AU_M;

  const einsteinPrecession = calculateEinsteinPrecession(
    centralMass,
    body.mass,
    oscElements.semiMajorAxisM,
    oscElements.eccentricity
  );
  const relDistM = Math.hypot(relPos[0], relPos[1], relPos[2]);
  const compactnessParam = relDistM > 0 ? (G_CODATA_2022 * centralMass) / (relDistM * 299792458 * 299792458) : 0;

  // Environmental derivation
  const allBodiesList = Object.values(bodies);
  const eqResult = computeEquilibriumTemperature(body, allBodiesList);
  const totalFlux = eqResult.totalIncidentFluxWm2;
  const eqTempK = eqResult.equilibriumTempK ?? 0;
  const eqTempC = eqResult.equilibriumTempC ?? -273.15;

  // Compact metrics
  const isCompact =
    body.classification === "black-hole" ||
    body.classification === "neutron-star" ||
    body.classification === "pulsar" ||
    body.classification === "magnetar" ||
    body.classification === "white-dwarf";
  const rsM = calculateSchwarzschildRadius(body.mass);

  // Roche limits with primary
  const rocheDiag = primaryBody ? computeRocheDiagnostics(primaryBody, body) : null;
  const fluidRocheKm = rocheDiag?.fluidRocheLimitM ? rocheDiag.fluidRocheLimitM / 1000 : 0;
  const rigidRocheKm = rocheDiag?.rigidRocheLimitM ? rocheDiag.rigidRocheLimitM / 1000 : 0;

  // Filter events involving this body
  const bodyEvents = events.filter((e) => e.involvedBodyIds.includes(body.id));

  const TABS: { id: InspectorTab; label: string; icon: LucideIcon }[] = [
    { id: "state", label: "State", icon: Compass },
    { id: "physical", label: "Physical", icon: Globe },
    { id: "orbit", label: "Orbit", icon: Orbit },
    { id: "environment", label: "Env", icon: Thermometer },
    { id: "events", label: "Events", icon: Zap },
    { id: "provenance", label: "Source", icon: FileText },
  ];

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl bg-surface/90 border border-fg/10 shadow-2xl backdrop-blur-xl overflow-hidden font-sans text-xs text-fg max-h-[85vh]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-fg/10 bg-bg/30">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="size-3.5 rounded-full shrink-0 ring-2 ring-fg/20 ring-offset-1 ring-offset-bg"
            style={{ backgroundColor: body.color ?? "#ffffff" }}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2 className="font-semibold text-sm truncate leading-tight">{body.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="font-mono text-[10px] uppercase text-muted tracking-wider">
                {body.classification}
              </span>
              <span className="text-[10px] text-muted font-mono">·</span>
              <span className="font-mono text-[10px] capitalize text-muted">
                {body.gravityRole}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => startEditing(body.id)}
            className="h-8 px-2.5"
            aria-label="Edit object properties"
          >
            <Edit3 className="size-3.5 mr-1" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => selectBody(null)}
            className="size-8"
            aria-label="Close inspector"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex items-center border-b border-fg/10 bg-bg/40 px-2 overflow-x-auto helios-scroll">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = inspectorTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setInspectorTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-colors outline-none",
                active
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-muted hover:text-fg hover:border-fg/20"
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab content area */}
      <div className="p-3.5 overflow-y-auto helios-scroll space-y-3">
        {inspectorTab === "state" && (
          <div className="space-y-2.5 font-mono text-[11px]">
            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Distance to Barycenter:</span>
              <div className="text-right flex items-center gap-2">
                <span>{distOriginAu.toFixed(4)} AU ({(distOriginM / 1e9).toFixed(2)}M km)</span>
                <ProvenanceBadge provenance={body.provenance.state} label="Position" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Current Orbital Speed:</span>
              <div className="text-right flex items-center gap-2">
                <span>{speedKmS.toFixed(3)} km/s</span>
                <ProvenanceBadge provenance={body.provenance.state} label="Velocity" />
              </div>
            </div>

            <div className="pt-1">
              <span className="text-muted font-sans text-xs block mb-1">Position Vector (SI / m):</span>
              <div className="p-2 rounded-lg bg-bg/60 border border-fg/5 text-[10px] space-y-0.5">
                <div>X: {x.toExponential(4)} m</div>
                <div>Y: {y.toExponential(4)} m</div>
                <div>Z: {z.toExponential(4)} m</div>
              </div>
            </div>

            <div className="pt-1">
              <span className="text-muted font-sans text-xs block mb-1">Velocity Vector (SI / m/s):</span>
              <div className="p-2 rounded-lg bg-bg/60 border border-fg/5 text-[10px] space-y-0.5">
                <div>VX: {vx.toFixed(2)} m/s</div>
                <div>VY: vy.toFixed(2) m/s</div>
                <div>VZ: vz.toFixed(2) m/s</div>
              </div>
            </div>
          </div>
        )}

        {inspectorTab === "physical" && (
          <div className="space-y-2.5 font-mono text-[11px]">
            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Mass:</span>
              <div className="text-right flex items-center gap-2">
                <span>{body.mass.toExponential(4)} kg ({massEarths} M⊕ / {massSuns} M☉)</span>
                <ProvenanceBadge provenance={body.provenance.mass} label="Mass" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Radius:</span>
              <div className="text-right flex items-center gap-2">
                <span>{radiusKm.toFixed(1)} km ({radiusEarths} R⊕)</span>
                <ProvenanceBadge provenance={body.provenance.radius} label="Radius" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Mean Density:</span>
              <div className="text-right flex items-center gap-2">
                <span>{densityKgM3.toFixed(0)} kg/m³</span>
                <ProvenanceBadge provenance={body.provenance.density} label="Density" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Surface Gravity:</span>
              <div className="text-right flex items-center gap-2">
                <span>{surfaceGravMs2.toFixed(2)} m/s² ({(surfaceGravMs2 / 9.80665).toFixed(2)} g)</span>
                <ProvenanceBadge provenance={{ kind: "calculated", method: "g = GM / R^2" }} label="Gravity" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Escape Velocity:</span>
              <div className="text-right flex items-center gap-2">
                <span>{escapeVelKmS.toFixed(2)} km/s</span>
                <ProvenanceBadge provenance={{ kind: "calculated", method: "v = sqrt(2GM/R)" }} label="Escape Velocity" />
              </div>
            </div>

            {isCompact && (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 space-y-1">
                <div className="flex justify-between font-semibold">
                  <span>Schwarzschild Radius (rs):</span>
                  <span>{(rsM / 1000).toFixed(3)} km</span>
                </div>
                {body.compact?.magneticFieldTesla && (
                  <div className="flex justify-between">
                    <span>Magnetic Field:</span>
                    <span>{body.compact.magneticFieldTesla.toExponential(2)} T</span>
                  </div>
                )}
                {body.compact?.spinPeriodSeconds && (
                  <div className="flex justify-between">
                    <span>Spin Period:</span>
                    <span>{body.compact.spinPeriodSeconds} s</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {inspectorTab === "orbit" && (
          <div className="space-y-2.5 font-mono text-[11px]">
            <div className="p-2 rounded-lg bg-bg/50 border border-fg/5 text-[10px] text-muted">
              Osculating elements relative to {primaryBody?.name ?? "Barycenter"}
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Semi-major Axis (a):</span>
              <div className="text-right flex items-center gap-2">
                <span>{semiMajorAxisAu.toFixed(4)} AU</span>
                <ProvenanceBadge provenance={{ kind: "calculated", method: "Osculating Keplerian" }} label="Semi-major Axis" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Eccentricity (e):</span>
              <div className="text-right flex items-center gap-2">
                <span>{oscElements.eccentricity.toFixed(5)}</span>
                <ProvenanceBadge provenance={{ kind: "calculated", method: "Runge-Lenz vector" }} label="Eccentricity" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Inclination (i):</span>
              <div className="text-right flex items-center gap-2">
                <span>{oscElements.inclinationDeg.toFixed(2)}°</span>
                <ProvenanceBadge provenance={{ kind: "calculated", method: "Angular momentum vector" }} label="Inclination" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Period (P):</span>
              <div className="text-right flex items-center gap-2">
                <span>{periodDays.toFixed(1)} days ({(periodDays / 365.25).toFixed(2)} yrs)</span>
                <ProvenanceBadge provenance={{ kind: "calculated", method: "Kepler's 3rd Law" }} label="Period" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Periapsis Distance:</span>
              <span>{periapsisAu.toFixed(4)} AU</span>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Apoapsis Distance:</span>
              <span>{apoapsisAu.toFixed(4)} AU</span>
            </div>

            {einsteinPrecession && (
              <div className="flex items-center justify-between py-1 border-b border-fg/5">
                <span className="text-muted">GR Precession (1PN):</span>
                <div className="text-right flex items-center gap-2">
                  <span className="text-amber-400 font-medium">
                    {einsteinPrecession.arcsecPerCentury.toFixed(2)}″ / century
                  </span>
                  <ProvenanceBadge
                    provenance={{ kind: "calculated", method: "1PN Einstein Precession: 6πGM / (a(1-e²)c²)" }}
                    label="GR Precession"
                  />
                </div>
              </div>
            )}

            {compactnessParam > 0 && (
              <div className="flex items-center justify-between py-1 border-b border-fg/5">
                <span className="text-muted">Compactness (GM/rc²):</span>
                <span className={compactnessParam > 0.01 ? "text-amber-400 font-bold" : "text-fg"}>
                  {compactnessParam.toExponential(3)}
                </span>
              </div>
            )}
          </div>
        )}

        {inspectorTab === "environment" && (
          <div className="space-y-2.5 font-mono text-[11px]">
            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Stellar Irradiance:</span>
              <div className="text-right flex items-center gap-2">
                <span>{totalFlux.toFixed(1)} W/m²</span>
                <ProvenanceBadge provenance={{ kind: "calculated", method: "L / (4*pi*r^2) sum" }} label="Flux" />
              </div>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-fg/5">
              <span className="text-muted">Equilibrium Temp (Teq):</span>
              <div className="text-right flex items-center gap-2">
                <span>{eqTempK.toFixed(1)} K ({eqTempC.toFixed(1)} °C)</span>
                <ProvenanceBadge provenance={{ kind: "estimated", method: "Stefan-Boltzmann balance" }} label="Temp" />
              </div>
            </div>

            {primaryBody && (
              <>
                <div className="flex items-center justify-between py-1 border-b border-fg/5">
                  <span className="text-muted">Fluid Roche Limit:</span>
                  <div className="text-right flex items-center gap-2">
                    <span>{fluidRocheKm.toFixed(0)} km</span>
                    <ProvenanceBadge provenance={{ kind: "calculated", method: "2.44 * R * (M/m)^(1/3)" }} label="Roche Fluid" />
                  </div>
                </div>

                <div className="flex items-center justify-between py-1 border-b border-fg/5">
                  <span className="text-muted">Rigid Roche Limit:</span>
                  <div className="text-right flex items-center gap-2">
                    <span>{rigidRocheKm.toFixed(0)} km</span>
                    <ProvenanceBadge provenance={{ kind: "calculated", method: "1.26 * R * (M/m)^(1/3)" }} label="Roche Rigid" />
                  </div>
                </div>
              </>
            )}

            <div className="p-2.5 rounded-lg bg-bg/50 border border-fg/5 text-[10px] text-muted space-y-1">
              <p className="font-semibold text-fg">Model Assumptions:</p>
              <p>• Zero greenhouse warming effect assumed in baseline equilibrium calculation.</p>
              <p>• Fast uniform thermal redistribution across spherical body surface.</p>
              <p>• Bond albedo assumed = 0.306 unless specified otherwise.</p>
            </div>
          </div>
        )}

        {inspectorTab === "events" && (
          <div className="space-y-2">
            {bodyEvents.length === 0 ? (
              <div className="py-6 text-center text-muted font-sans text-xs">
                No recorded collision or close encounter events for this object.
              </div>
            ) : (
              bodyEvents.map((evt) => (
                <div
                  key={evt.eventId}
                  className="p-2.5 rounded-lg bg-bg/60 border border-fg/10 space-y-1 text-[11px] font-mono"
                >
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-primary font-sans uppercase tracking-wide">
                      {evt.eventType.replace(/_/g, " ")}
                    </span>
                    <span className="text-muted">{formatSimTime(evt.simTimeSeconds)}</span>
                  </div>
                  <p className="text-fg text-xs font-sans">{evt.summary}</p>
                  {typeof evt.calculatedQuantities?.relativeVelocityMs === "number" && (
                    <div className="text-muted text-[10px]">
                      Impact Velocity: {(Number(evt.calculatedQuantities.relativeVelocityMs) / 1000).toFixed(2)} km/s
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {inspectorTab === "provenance" && (
          <div className="space-y-3 font-sans text-xs">
            <div className="p-2.5 rounded-lg bg-bg/50 border border-fg/10 space-y-1.5 leading-relaxed">
              <h4 className="font-semibold text-fg">Scientific Provenance Protocol</h4>
              <p className="text-muted text-[11px]">
                In accordance with Helios Observatory isolation architecture, all quantities in the
                simulation sandbox carry explicit provenance tags. Canonical astronomical registry data is
                never overwritten by simulation outcomes.
              </p>
            </div>

            <div className="space-y-1.5 font-mono text-[11px]">
              {Object.entries(body.provenance).map(([key, prov]) => {
                if (!prov) return null;
                return (
                  <div key={key} className="flex items-center justify-between p-2 rounded bg-bg/40 border border-fg/5">
                    <span className="capitalize text-muted">{key}:</span>
                    <ProvenanceBadge provenance={prov} label={key} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
