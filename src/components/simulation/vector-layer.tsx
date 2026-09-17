import React, { useMemo } from "react";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { mapSimPositionToScene, mapSimVelocityToSceneVector } from "./render-adapter";
import { Line } from "@react-three/drei";

export function VectorLayer() {
  const { bodies, selectedId, showVectors, displayMode } = useSandboxStore();

  const lines = useMemo(() => {
    if (!showVectors) return [];

    const result: Array<{ id: string; points: [number, number, number][]; color: string }> = [];

    // Focus on selected body or primary bodies
    const targets = selectedId ? [bodies[selectedId]].filter(Boolean) : Object.values(bodies);

    for (const b of targets) {
      const origin = mapSimPositionToScene(b.position, displayMode);
      const vec = mapSimVelocityToSceneVector(b.velocity);
      const tip: [number, number, number] = [
        origin[0] + vec[0],
        origin[1] + vec[1],
        origin[2] + vec[2],
      ];

      result.push({
        id: b.id,
        points: [origin, tip],
        color: b.color ?? "#ffffff",
      });
    }

    return result;
  }, [bodies, selectedId, showVectors, displayMode]);

  if (!showVectors || lines.length === 0) return null;

  return (
    <group>
      {lines.map((l) => (
        <Line
          key={l.id}
          points={l.points}
          color="#38bdf8"
          lineWidth={2}
          transparent
          opacity={0.8}
        />
      ))}
    </group>
  );
}
