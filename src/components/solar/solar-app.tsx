import React, { lazy, Suspense, useEffect, useState } from "react";
import { ObservatoryHud } from "@/components/overlay/hud";
import { hydrateSimSettings } from "@/lib/sim-store";

type CanvasComponent = () => null | React.JSX.Element;

const canvasPromise =
  typeof window !== "undefined"
    ? import("@/components/solar/solar-canvas").then(
        (m): { default: CanvasComponent } => ({ default: m.default }),
      )
    : Promise.resolve({ default: (() => null) as CanvasComponent });

const SolarCanvas = lazy(() => canvasPromise);

function SpaceFallback() {
  return (
    <div className="absolute inset-0 bg-bg">
      <canvas className="absolute inset-0 h-full w-full" aria-hidden="true" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(184,196,212,0.08),transparent_55%)]" />
      <div className="absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(243,194,122,0.55),rgba(243,194,122,0)_70%)]" />
    </div>
  );
}

export function SolarApp() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    hydrateSimSettings();
    setMounted(true);
  }, []);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      {mounted ? (
        <Suspense fallback={<SpaceFallback />}>
          <SolarCanvas />
        </Suspense>
      ) : (
        <SpaceFallback />
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_48%,rgba(7,8,12,0.55)_100%)]"
        aria-hidden="true"
      />
      <ObservatoryHud />
    </div>
  );
}
