import React, { useState } from "react";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Zap,
  AlertTriangle,
  Flame,
  Magnet,
  Maximize2,
  Minimize2,
} from "lucide-react";

function formatEventTime(seconds: number): string {
  const days = (seconds / 86400).toFixed(1);
  return `T+${days}d`;
}

export function EventTimeline({ className }: { className?: string }) {
  const { events, selectBody } = useSandboxStore();
  const [collapsed, setCollapsed] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");

  const filteredEvents = events.filter((e) => {
    if (filterType === "all") return true;
    if (filterType === "collision") return e.eventType.includes("collision") || e.eventType.includes("merger");
    if (filterType === "warning") return e.eventType.includes("warning") || e.eventType.includes("roche");
    return true;
  });

  const latestEvent = events[0];

  return (
    <div
      className={cn(
        "pointer-events-auto rounded-2xl bg-surface/90 border border-fg/10 shadow-2xl backdrop-blur-xl font-sans text-xs text-fg transition-all",
        collapsed ? "p-2.5" : "p-4 w-full md:w-96 max-h-96 flex flex-col",
        className
      )}
    >
      {/* Hidden screen-reader live region */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {latestEvent ? `${latestEvent.eventType}: ${latestEvent.summary}` : ""}
      </div>

      {/* Header bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-primary shrink-0" aria-hidden="true" />
          <span className="font-semibold text-xs">Event Timeline</span>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-fg/10 text-muted">
            {events.length}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand event timeline" : "Collapse event timeline"}
            className="size-7"
          >
            {collapsed ? <Maximize2 className="size-3.5" /> : <Minimize2 className="size-3.5" />}
          </Button>
        </div>
      </div>

      {collapsed ? (
        // Collapsed ticker: shows the single latest event
        latestEvent ? (
          <div
            onClick={() => {
              if (latestEvent.involvedBodyIds[0]) {
                selectBody(latestEvent.involvedBodyIds[0]);
              }
            }}
            className="mt-2 flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-bg/50 hover:bg-bg/80 border border-fg/5 cursor-pointer text-[11px]"
          >
            <div className="flex items-center gap-1.5 truncate">
              {latestEvent.eventType.includes("warning") ? (
                <AlertTriangle className="size-3 text-amber-400 shrink-0" />
              ) : latestEvent.eventType.includes("collision") ? (
                <Flame className="size-3 text-rose-400 shrink-0" />
              ) : (
                <Magnet className="size-3 text-primary shrink-0" />
              )}
              <span className="truncate">{latestEvent.summary}</span>
            </div>
            <span className="font-mono text-[10px] text-muted shrink-0">
              {formatEventTime(latestEvent.simTimeSeconds)}
            </span>
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted">No recorded events.</p>
        )
      ) : (
        // Expanded full event list
        <div className="flex-1 flex flex-col min-h-0 mt-3 space-y-2">
          {/* Filter tabs */}
          <div className="flex items-center gap-1">
            {[
              { id: "all", label: "All Events" },
              { id: "collision", label: "Collisions" },
              { id: "warning", label: "Warnings" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterType(tab.id)}
                className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-medium transition-colors",
                  filterType === tab.id
                    ? "bg-primary/20 text-primary border border-primary/30"
                    : "text-muted hover:text-fg hover:bg-fg/5"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Events list */}
          <div className="flex-1 overflow-y-auto helios-scroll space-y-1.5 pr-1">
            {filteredEvents.length === 0 ? (
              <p className="py-6 text-center text-muted text-xs">No matching events.</p>
            ) : (
              filteredEvents.map((evt) => (
                <div
                  key={evt.eventId}
                  onClick={() => {
                    if (evt.involvedBodyIds[0]) selectBody(evt.involvedBodyIds[0]);
                  }}
                  className="p-2 rounded-xl bg-bg/50 hover:bg-bg/80 border border-fg/5 hover:border-fg/15 cursor-pointer transition-all space-y-1 text-[11px]"
                >
                  <div className="flex items-center justify-between font-mono text-[10px]">
                    <span className="text-primary uppercase">{evt.eventType.replace(/_/g, " ")}</span>
                    <span className="text-muted">{formatEventTime(evt.simTimeSeconds)}</span>
                  </div>
                  <p className="text-fg leading-tight">{evt.summary}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
