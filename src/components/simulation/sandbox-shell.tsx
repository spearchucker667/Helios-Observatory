import React, { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { AccuracyIndicator } from "./accuracy-indicator";
import { TransportBar } from "./transport-bar";
import { ObjectBrowser } from "./object-browser";
import { BodyInspector } from "./body-inspector";
import { EventTimeline } from "./event-timeline";
import { ScenarioManager } from "./scenario-manager";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FolderOpen,
  Undo2,
  Redo2,
  Menu,
  SlidersHorizontal,
} from "lucide-react";

interface SandboxShellProps {
  canvasElement: React.ReactNode;
}

export function SandboxShell({ canvasElement }: SandboxShellProps) {
  const {
    scenarioName,
    openScenarioModal,
    canUndo,
    canRedo,
    undo,
    redo,
  } = useSandboxStore();

  const [mobileBrowserOpen, setMobileBrowserOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg font-sans text-fg select-none">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0">{canvasElement}</div>

      {/* Top Navigation & Mode Indicator Bar */}
      <header className="pointer-events-auto absolute top-0 right-0 left-0 z-20 flex items-center justify-between gap-3 p-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] md:p-4 bg-gradient-to-b from-bg/90 via-bg/40 to-transparent backdrop-blur-xs">
        {/* Mode Indicator & Exit to Observatory */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface/85 hover:bg-surface border border-fg/10 text-xs font-medium text-fg shadow-sm backdrop-blur-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/60 shrink-0"
            aria-label="Return to Observatory mode"
          >
            <ArrowLeft className="size-4 text-muted" aria-hidden="true" />
            <span className="hidden sm:inline">Return to Observatory</span>
            <span className="sm:hidden">Observatory</span>
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-amber-400 animate-pulse shrink-0" aria-hidden="true" />
              <p className="font-mono text-xs font-bold tracking-wider text-amber-300 uppercase truncate">
                SIMULATION SANDBOX
              </p>
            </div>
            <p className="hidden sm:block text-[10px] text-muted font-sans truncate">
              Calculated / custom state · Immutable canonical astronomy preserved
            </p>
          </div>
        </div>

        {/* Center/Right Toolbar: Scenario, Undo/Redo, Accuracy */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Scenario Name & Manager */}
          <Button
            variant="outline"
            size="sm"
            onClick={openScenarioModal}
            className="h-9 px-2.5 sm:px-3 text-xs flex items-center gap-1.5 max-w-[140px] sm:max-w-[200px]"
            title="Open Scenario Manager"
          >
            <FolderOpen className="size-4 text-primary shrink-0" aria-hidden="true" />
            <span className="truncate">{scenarioName}</span>
          </Button>

          {/* Undo / Redo */}
          <div className="hidden sm:flex items-center bg-surface/80 p-0.5 rounded-xl border border-fg/10 shadow-sm backdrop-blur-md">
            <Button
              variant="ghost"
              size="icon"
              disabled={!canUndo}
              onClick={undo}
              className="size-8"
              aria-label="Undo last action"
              title="Undo (Cmd+Z)"
            >
              <Undo2 className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              disabled={!canRedo}
              onClick={redo}
              className="size-8"
              aria-label="Redo last action"
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 className="size-3.5" />
            </Button>
          </div>

          {/* Accuracy Indicator */}
          <AccuracyIndicator />

          {/* Mobile Drawers Toggles */}
          <div className="flex lg:hidden items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMobileBrowserOpen(!mobileBrowserOpen)}
              className="size-9"
              aria-label="Toggle objects drawer"
            >
              <Menu className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMobileInspectorOpen(!mobileInspectorOpen)}
              className="size-9"
              aria-label="Toggle inspector drawer"
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Desktop Left Sidebar: Object Browser */}
      <aside className="pointer-events-auto hidden lg:block absolute left-4 top-20 bottom-28 md:bottom-32 z-10 w-80">
        <ObjectBrowser className="h-full" />
      </aside>

      {/* Desktop Right Sidebar: Body Inspector */}
      <aside className="pointer-events-auto hidden lg:block absolute right-4 top-20 bottom-28 md:bottom-32 z-10 w-88 xl:w-96">
        <BodyInspector className="h-full" />
      </aside>

      {/* Bottom Floating Control Bar */}
      <footer className="pointer-events-none absolute bottom-0 right-0 left-0 z-20 p-3 md:p-4 flex flex-col md:flex-row items-end md:items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <EventTimeline className="w-full sm:w-80 md:w-88" />
        <TransportBar className="w-full md:w-auto grow max-w-2xl" />
      </footer>

      {/* Mobile Object Browser Drawer */}
      {mobileBrowserOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Celestial Objects Drawer"
          className="fixed inset-0 z-40 flex lg:hidden bg-bg/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setMobileBrowserOpen(false)}
        >
          <div
            className="w-80 max-w-[85vw] h-full p-4 bg-surface border-r border-fg/10 shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end mb-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileBrowserOpen(false)}
                className="size-8"
              >
                ✕
              </Button>
            </div>
            <ObjectBrowser />
          </div>
        </div>
      )}

      {/* Mobile Body Inspector Bottom Sheet */}
      {mobileInspectorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Body Inspector Sheet"
          className="fixed inset-0 z-40 flex flex-col justify-end lg:hidden bg-bg/60 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setMobileInspectorOpen(false)}
        >
          <div
            className="w-full max-h-[80vh] p-4 bg-surface border-t border-fg/10 rounded-t-3xl shadow-2xl overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-2 border-b border-fg/10 pb-2">
              <span className="font-semibold text-xs text-muted uppercase tracking-wider">
                Object Inspector
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileInspectorOpen(false)}
                className="size-8"
              >
                ✕
              </Button>
            </div>
            <BodyInspector />
          </div>
        </div>
      )}

      {/* Scenario Manager Modal */}
      <ScenarioManager />
    </div>
  );
}
