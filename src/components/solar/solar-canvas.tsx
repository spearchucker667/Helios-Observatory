import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { DEFAULT_CAMERA } from "@/lib/planets";
import { CameraRig } from "@/components/solar/camera-rig";
import { SolarSystem } from "@/components/solar/bodies";

export function SolarCanvas() {
  const bodyRefs = useRef<Record<string, THREE.Object3D | null>>({});
  const camera = useMemo(
    () => ({
      position: [DEFAULT_CAMERA.x, DEFAULT_CAMERA.y, DEFAULT_CAMERA.z] as [number, number, number],
      fov: 42,
      near: 0.1,
      far: 400,
    }),
    [],
  );

  return (
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
        gl.toneMappingExposure = 1.08;
      }}
    >
      <SolarSystem bodyRefs={bodyRefs} />
      <CameraRig bodyRefs={bodyRefs} />
    </Canvas>
  );
}

export default SolarCanvas;
