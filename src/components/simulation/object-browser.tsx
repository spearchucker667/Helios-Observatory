import React, { useState, useMemo } from "react";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { PRESETS } from "@/simulation/domain/presets";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Search,
  Plus,
  Trash2,
  Copy,
  Eye,
  Orbit,
  Compass,
  Tag,
  ChevronRight,
  Sparkles,
} from "lucide-react";

export function ObjectBrowser({ className }: { className?: string }) {
  const {
    bodies,
    selectedId,
    selectBody,
    removeBody,
    duplicateBody,
    addPreset,
    showTrajectories,
    toggleTrajectories,
    showVectors,
    toggleVectors,
    showLabels,
    toggleLabels,
    showOrbits,
    toggleOrbits,
  } = useSandboxStore();

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [presetModalOpen, setPresetModalOpen] = useState(false);

  const bodiesList = useMemo(() => Object.values(bodies), [bodies]);

  const filteredBodies = useMemo(() => {
    return bodiesList.filter((b) => {
      const matchesSearch =
        b.name.toLowerCase().includes(search.toLowerCase()) ||
        b.classification.toLowerCase().includes(search.toLowerCase());

      if (!matchesSearch) return false;

      if (filterCategory === "all") return true;
      if (filterCategory === "star") return b.classification === "star";
      if (filterCategory === "planet")
        return b.classification === "planet" || b.classification === "dwarf-planet";
      if (filterCategory === "moon") return b.classification === "moon";
      if (filterCategory === "compact")
        return (
          b.classification === "black-hole" ||
          b.classification === "neutron-star" ||
          b.classification === "pulsar" ||
          b.classification === "magnetar" ||
          b.classification === "white-dwarf"
        );
      if (filterCategory === "tracer") return b.gravityRole === "tracer";
      return true;
    });
  }, [bodiesList, search, filterCategory]);

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl bg-surface/90 border border-fg/10 shadow-2xl backdrop-blur-xl overflow-hidden font-sans text-xs text-fg max-h-[85vh]",
        className
      )}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between p-3.5 border-b border-fg/10 bg-bg/30">
        <div>
          <h2 className="font-semibold text-sm">Celestial Objects</h2>
          <p className="text-[11px] text-muted">{bodiesList.length} active bodies in simulation</p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={() => setPresetModalOpen(true)}
          className="h-8 px-3 text-xs"
        >
          <Plus className="size-3.5 mr-1" />
          Add Object
        </Button>
      </div>

      {/* Search and Category Filter */}
      <div className="p-3 border-b border-fg/10 space-y-2 bg-bg/20">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-bg/60 border border-fg/10 text-muted focus-within:border-primary/60">
          <Search className="size-3.5 shrink-0" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search celestial bodies…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-fg outline-none text-xs"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto helios-scroll py-0.5">
          {[
            { id: "all", label: "All" },
            { id: "star", label: "Stars" },
            { id: "planet", label: "Planets" },
            { id: "moon", label: "Moons" },
            { id: "compact", label: "Compact" },
            { id: "tracer", label: "Tracers" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setFilterCategory(cat.id)}
              className={cn(
                "px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap",
                filterCategory === cat.id
                  ? "bg-primary/20 text-primary border border-primary/30 font-semibold"
                  : "text-muted hover:text-fg hover:bg-fg/5"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* View Layer Toggles */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-fg/10 bg-bg/40 text-[11px] font-mono text-muted">
        <span>Layers:</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTrajectories}
            title="Toggle Trajectory Predictions"
            className={cn(
              "px-2 py-0.5 rounded transition-colors flex items-center gap-1",
              showTrajectories ? "text-primary bg-primary/10" : "text-muted hover:text-fg"
            )}
          >
            <Orbit className="size-3" />
            <span>Traj</span>
          </button>
          <button
            type="button"
            onClick={toggleVectors}
            title="Toggle Velocity Vectors"
            className={cn(
              "px-2 py-0.5 rounded transition-colors flex items-center gap-1",
              showVectors ? "text-primary bg-primary/10" : "text-muted hover:text-fg"
            )}
          >
            <Compass className="size-3" />
            <span>Vel</span>
          </button>
          <button
            type="button"
            onClick={toggleLabels}
            title="Toggle Names and Labels"
            className={cn(
              "px-2 py-0.5 rounded transition-colors flex items-center gap-1",
              showLabels ? "text-primary bg-primary/10" : "text-muted hover:text-fg"
            )}
          >
            <Tag className="size-3" />
            <span>Lbl</span>
          </button>
          <button
            type="button"
            onClick={toggleOrbits}
            title="Toggle Orbital Reference Guides"
            className={cn(
              "px-2 py-0.5 rounded transition-colors flex items-center gap-1",
              showOrbits ? "text-primary bg-primary/10" : "text-muted hover:text-fg"
            )}
          >
            <Eye className="size-3" />
            <span>Orb</span>
          </button>
        </div>
      </div>

      {/* Body List */}
      <div className="p-2 overflow-y-auto helios-scroll flex-1 space-y-1">
        {filteredBodies.length === 0 ? (
          <div className="py-8 text-center text-muted font-sans text-xs">
            No celestial bodies match the search criteria.
          </div>
        ) : (
          filteredBodies.map((b) => {
            const isSelected = selectedId === b.id;
            return (
              <div
                key={b.id}
                onClick={() => selectBody(b.id)}
                className={cn(
                  "group flex items-center justify-between p-2 rounded-xl transition-all cursor-pointer border",
                  isSelected
                    ? "bg-primary/15 border-primary/40 text-fg shadow-sm"
                    : "bg-bg/40 hover:bg-bg/80 border-transparent hover:border-fg/10 text-fg"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className="size-3 rounded-full shrink-0 ring-1 ring-fg/20 ring-offset-1 ring-offset-bg"
                    style={{ backgroundColor: b.color ?? "#ffffff" }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-xs truncate">{b.name}</p>
                    <div className="flex items-center gap-1 text-[10px] font-mono text-muted">
                      <span className="uppercase">{b.classification}</span>
                      {b.gravityRole === "tracer" && (
                        <span className="text-amber-400 font-semibold">(Tracer)</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0 opacity-80 hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateBody(b.id);
                    }}
                    title="Duplicate Object"
                    aria-label={`Duplicate ${b.name}`}
                    className="p-1.5 rounded-lg text-muted hover:text-fg hover:bg-fg/10"
                  >
                    <Copy className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBody(b.id);
                    }}
                    title="Delete Object"
                    aria-label={`Delete ${b.name}`}
                    className="p-1.5 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                  <ChevronRight className="size-3.5 text-muted ml-0.5" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Preset Modal */}
      {presetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Add Astronomical Preset"
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-4 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div className="w-full max-w-lg rounded-2xl bg-surface border border-fg/10 shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col font-sans">
            <div className="flex items-center justify-between border-b border-fg/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h3 className="font-semibold text-base text-fg">Spawn Astronomical Preset</h3>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setPresetModalOpen(false)}
                className="size-8"
              >
                ✕
              </Button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Inject custom astrophysical bodies into the current gravitational field. All presets include
              physically realistic initial masses, radii, and thermal properties.
            </p>

            <div className="overflow-y-auto helios-scroll space-y-2 flex-1 pr-1">
              {PRESETS.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => {
                    addPreset(preset.id);
                    setPresetModalOpen(false);
                  }}
                  className="p-3 rounded-xl bg-bg/50 hover:bg-bg border border-fg/5 hover:border-primary/40 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-fg">{preset.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded uppercase bg-fg/5 text-muted">
                      {preset.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted leading-relaxed">{preset.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
