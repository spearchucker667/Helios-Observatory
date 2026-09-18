import React, { lazy, Suspense, useEffect, useState } from "react";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { installSandboxQaBridge } from "@/simulation/state/qa-bridge";
import { SandboxShell } from "./sandbox-shell";

type CanvasComponent = () => null | React.JSX.Element;

const canvasPromise =
  typeof window !== "undefined"
    ? import("@/components/simulation/simulation-canvas").then(
        (m): { default: CanvasComponent } => ({ default: m.default }),
      )
    : Promise.resolve({ default: (() => null) as CanvasComponent });

const SimulationCanvas = lazy(() => canvasPromise);

function SimulationFallback() {
  return (
    <div className="absolute inset-0 bg-bg flex items-center justify-center">
      <div className="size-20 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
    </div>
  );
}

export function SimulationApp() {
  const {
    init,
    cleanup,
    togglePlay,
    stepOnce,
    setMultiplier,
    multiplier,
    undo,
    redo,
    selectBody,
    startEditing,
    openScenarioModal,
    setInspectorTab,
    closeScenarioModal,
    scenarioModalOpen,
    hoverId,
    selectedId,
    bodies,
  } = useSandboxStore();

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    init();
    setMounted(true);
    // Read-only acceptance-test hook; only installed for `?qa=1` loads.
    const removeQaBridge = installSandboxQaBridge();
    return () => {
      removeQaBridge();
      cleanup();
    };
  }, [init, cleanup]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is inside an input or textarea
      const target = e.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT"
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === ".") {
        e.preventDefault();
        stepOnce();
      } else if (e.key === "[") {
        e.preventDefault();
        setMultiplier(Math.max(1, multiplier / 2));
      } else if (e.key === "]") {
        e.preventDefault();
        setMultiplier(Math.min(86400 * 365, multiplier * 2));
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key.toLowerCase() === "i" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // I - focus the Object Inspector on the hovered (or first) body.
        e.preventDefault();
        const target = hoverId ?? selectedId ?? Object.keys(bodies)[0] ?? null;
        if (target) selectBody(target);
        setInspectorTab("state");
      } else if (e.key.toLowerCase() === "e" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // E - open the object editor (which owns the velocity vector fields).
        e.preventDefault();
        startEditing();
      } else if (e.key.toLowerCase() === "s" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // S - open the Scenario Manager (save / export / import).
        e.preventDefault();
        openScenarioModal();
      } else if (e.key === "Escape") {
        if (scenarioModalOpen) {
          closeScenarioModal();
        } else {
          selectBody(null);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlay,
    stepOnce,
    setMultiplier,
    multiplier,
    undo,
    redo,
    selectBody,
    startEditing,
    openScenarioModal,
    setInspectorTab,
    hoverId,
    selectedId,
    bodies,
    closeScenarioModal,
    scenarioModalOpen,
  ]);

  const canvasNode = mounted ? (
    <Suspense fallback={<SimulationFallback />}>
      <SimulationCanvas />
    </Suspense>
  ) : (
    <SimulationFallback />
  );

  return <SandboxShell canvasElement={canvasNode} />;
}

export default SimulationApp;
