import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { SimulationBody } from "@/simulation/domain/types";

export function BlackHoleVisual({
  body: _body,
  sceneRadius,
}: {
  body?: SimulationBody;
  sceneRadius: number;
}) {
  const horizonRadius = Math.max(sceneRadius, 0.15);
  const photonSphereRadius = horizonRadius * 1.5;
  const accretionInner = horizonRadius * 3.0;
  const accretionOuter = horizonRadius * 5.0;

  return (
    <group>
      {/* Event Horizon (Pure Black Sphere) */}
      <mesh renderOrder={10}>
        <sphereGeometry args={[horizonRadius, 32, 32]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Photon Sphere Ring / Gravitational Lensing Glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[photonSphereRadius * 0.95, photonSphereRadius * 1.08, 64]} />
        <meshBasicMaterial
          color="#ffaa44"
          side={THREE.DoubleSide}
          transparent
          opacity={0.65}
        />
      </mesh>

      {/* Accretion Disk visualization */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[accretionInner, accretionOuter, 64]} />
        <meshBasicMaterial
          color="#ffa855"
          side={THREE.DoubleSide}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}

export function PulsarVisual({
  body,
  sceneRadius,
}: {
  body: SimulationBody;
  sceneRadius: number;
}) {
  const beamGroup = useRef<THREE.Group>(null);
  const spinPeriod = body.compact?.spinPeriodSeconds ?? 1.5;
  const beamLength = sceneRadius * 18;
  const beamAngle = THREE.MathUtils.degToRad(body.compact?.magneticAxisTiltDeg ?? 30);

  useFrame((_, delta) => {
    if (beamGroup.current) {
      // Rapid beam rotation
      const sweepRate = (Math.PI * 2) / Math.max(0.1, spinPeriod);
      beamGroup.current.rotation.y += sweepRate * delta * 0.5;
    }
  });

  return (
    <group ref={beamGroup}>
      {/* Upper Radiation Cone */}
      <group rotation={[beamAngle, 0, 0]}>
        <mesh position={[0, beamLength / 2, 0]}>
          <coneGeometry args={[sceneRadius * 2.2, beamLength, 16, 1, true]} />
          <meshBasicMaterial
            color="#88ccff"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Lower Radiation Cone (Opposite Jet) */}
      <group rotation={[-beamAngle, Math.PI, 0]}>
        <mesh position={[0, beamLength / 2, 0]}>
          <coneGeometry args={[sceneRadius * 2.2, beamLength, 16, 1, true]} />
          <meshBasicMaterial
            color="#88ccff"
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

export function MagnetarVisual({
  sceneRadius,
}: {
  sceneRadius: number;
}) {
  const fieldRadius = sceneRadius * 4;

  return (
    <group>
      {/* Dipolar magnetic field loop representations */}
      <mesh rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[fieldRadius, 0.02, 16, 64]} />
        <meshBasicMaterial color="#b388ff" transparent opacity={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 4, 0, 0]}>
        <torusGeometry args={[fieldRadius, 0.02, 16, 64]} />
        <meshBasicMaterial color="#b388ff" transparent opacity={0.4} />
      </mesh>
    </group>
  );
}
