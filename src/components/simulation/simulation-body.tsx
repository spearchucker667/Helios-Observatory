import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html } from "@react-three/drei";
import * as THREE from "three";
import type { SimulationBody } from "@/simulation/domain/types";
import { useSandboxStore } from "@/simulation/state/sandbox-store";
import { mapSimPositionToScene, mapSimRadiusToScene } from "./render-adapter";
import {
  BlackHoleVisual,
  PulsarVisual,
  MagnetarVisual,
} from "./compact-object-visuals";
import { cn } from "@/lib/utils";

interface SimulationBodyProps {
  body: SimulationBody;
}

export function SimulationBodyMesh({ body }: SimulationBodyProps) {
  const mover = useRef<THREE.Group>(null);
  const {
    selectedId,
    hoverId,
    selectBody,
    hoverBody,
    showLabels,
    displayMode,
  } = useSandboxStore();

  const isSelected = selectedId === body.id;
  const isHovered = hoverId === body.id;

  const sceneR = mapSimRadiusToScene(body.radius, body.classification, displayMode);
  const isStar = body.classification === "star";
  const isBlackHole = body.classification === "black-hole";
  const isPulsar = body.classification === "pulsar";
  const isMagnetar = body.classification === "magnetar";

  useFrame(() => {
    if (!mover.current) return;
    const targetPos = mapSimPositionToScene(body.position, displayMode);
    // Direct transform update
    mover.current.position.set(targetPos[0], targetPos[1], targetPos[2]);
  });

  return (
    <group ref={mover}>
      {/* Visual Mesh / Compact visuals */}
      {isBlackHole ? (
        <BlackHoleVisual body={body} sceneRadius={sceneR} />
      ) : isPulsar ? (
        <group>
          <mesh>
            <sphereGeometry args={[sceneR, 32, 32]} />
            <meshBasicMaterial color="#a855f7" />
          </mesh>
          <PulsarVisual body={body} sceneRadius={sceneR} />
        </group>
      ) : isMagnetar ? (
        <group>
          <mesh>
            <sphereGeometry args={[sceneR, 32, 32]} />
            <meshStandardMaterial color="#c084fc" roughness={0.3} metalness={0.6} />
          </mesh>
          <MagnetarVisual sceneRadius={sceneR} />
        </group>
      ) : isStar ? (
        <mesh>
          <sphereGeometry args={[sceneR, 32, 32]} />
          <meshBasicMaterial color={body.color ?? "#ffcc44"} />
        </mesh>
      ) : (
        <mesh>
          <sphereGeometry args={[sceneR, 32, 32]} />
          <meshStandardMaterial
            color={body.color ?? "#8899aa"}
            roughness={0.7}
            metalness={0.1}
          />
        </mesh>
      )}

      {/* Invisible Touch / Click Hit Proxy */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          selectBody(body.id);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          hoverBody(body.id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          hoverBody(null);
        }}
        visible={false}
      >
        <sphereGeometry args={[Math.max(sceneR * 2.5, 0.5), 16, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* Selection Halo / Ring */}
      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[sceneR * 1.5, sceneR * 1.7, 48]} />
          <meshBasicMaterial
            color="#60a5fa"
            side={THREE.DoubleSide}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {/* Hover Halo */}
      {isHovered && !isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[sceneR * 1.35, sceneR * 1.45, 32]} />
          <meshBasicMaterial
            color="#ffffff"
            side={THREE.DoubleSide}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}

      {/* Billboard Name Label */}
      {showLabels && (
        <Billboard position={[0, sceneR + 0.35, 0]}>
          <Html
            center
            distanceFactor={30}
            className="pointer-events-none select-none whitespace-nowrap"
          >
            <div
              className={cn(
                "px-2 py-0.5 rounded text-[11px] font-sans font-medium transition-all backdrop-blur-sm border shadow-sm",
                isSelected
                  ? "bg-primary text-bg font-semibold border-primary scale-110"
                  : "bg-surface/80 text-fg/90 border-fg/15"
              )}
            >
              {body.name}
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  );
}
