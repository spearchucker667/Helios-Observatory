import React, { useMemo } from "react";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { mapSimPositionToScene } from "./render-adapter";
import { Line } from "@react-three/drei";

export function TrajectoryLayer() {
  const { selectedId, trajectories, showTrajectories, displayMode, bodies } = useSandboxStore();

  const points = useMemo(() => {
    if (!showTrajectories || !selectedId) return null;
    const rawPoints = trajectories[selectedId];
    if (!rawPoints || rawPoints.length < 2) return null;

    const mapped: [number, number, number][] = [];
    for (let i = 0; i < rawPoints.length; i++) {
      mapped.push(mapSimPositionToScene(rawPoints[i], displayMode));
    }
    return mapped;
  }, [selectedId, trajectories, showTrajectories, displayMode]);

  if (!points || points.length < 2) return null;

  const color = (selectedId ? bodies[selectedId]?.color : undefined) ?? "#60a5fa";

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1.5}
      transparent
      opacity={0.65}
      dashed={false}
    />
  );
}
