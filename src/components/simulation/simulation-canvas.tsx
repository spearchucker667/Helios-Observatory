import React, { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { SimulationScene } from "./simulation-scene";

export function SimulationCanvas() {
  const camera = useMemo(
    () => ({
      position: [14, 18, 32] as [number, number, number],
      fov: 42,
      near: 0.1,
      far: 1000,
    }),
    []
  );

  return (
    <div className="absolute inset-0 h-full w-full overflow-hidden">
      <Canvas
        className="absolute inset-0 h-full w-full cursor-grab active:cursor-grabbing touch-none"
        camera={camera}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.setClearColor("#07080c", 1);
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <SimulationScene />
      </Canvas>
    </div>
  );
}

export default SimulationCanvas;
