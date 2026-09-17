import React, { useRef } from "react";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { SimulationBodyMesh } from "./simulation-body";
import { TrajectoryLayer } from "./trajectory-layer";
import { VectorLayer } from "./vector-layer";
import { OrbitControls, Stars } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

export function SimulationScene() {
  const { bodies, selectBody } = useSandboxStore();
  const controlsRef = useRef<OrbitControlsImpl>(null);

  const bodiesList = Object.values(bodies);

  return (
    <>
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.5}
        maxDistance={500}
      />

      {/* Lighting */}
      <ambientLight intensity={0.25} />
      <pointLight position={[0, 0, 0]} intensity={2.5} decay={0.5} color="#fff8e7" />
      <directionalLight position={[10, 20, 15]} intensity={0.5} />

      {/* Background Stars */}
      <Stars radius={250} depth={60} count={3500} factor={4} saturation={0} fade speed={0.5} />

      {/* Subtle Ecliptic Reference Plane Grid */}
      <gridHelper args={[120, 60, "#222736", "#141822"]} position={[0, -0.01, 0]} />

      {/* Trajectory & Vector Layers */}
      <TrajectoryLayer />
      <VectorLayer />

      {/* Celestial Bodies */}
      <group onPointerMissed={() => selectBody(null)}>
        {bodiesList.map((body) => (
          <SimulationBodyMesh key={body.id} body={body} />
        ))}
      </group>
    </>
  );
}
