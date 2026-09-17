import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { useSim, simClock } from "@/lib/sim-store";
import { calculateDistance } from "@/lib/measurement";
import { bodyById } from "@/data/registry";

const vA = new THREE.Vector3();
const vB = new THREE.Vector3();
const vMid = new THREE.Vector3();

export function MeasurementLine({
  bodyRefs,
}: {
  bodyRefs: MutableRefObject<Record<string, THREE.Object3D | null>>;
}) {
  const measurement = useSim((s) => s.measurement);
  const lineRef = useRef<any>(null);
  const midGroupRef = useRef<THREE.Group>(null);
  const auTextRef = useRef<HTMLDivElement>(null);
  const kmTextRef = useRef<HTMLSpanElement>(null);
  const lightTextRef = useRef<HTMLSpanElement>(null);

  const { active, sourceId, targetId } = measurement;

  const points = useMemo<[number, number, number][]>(() => {
    return [
      [0, 0, 0],
      [0, 0, 0],
    ];
  }, []);

  useFrame(() => {
    if (!active || !sourceId || !targetId) return;

    const nodeA = bodyRefs.current[sourceId];
    const nodeB = bodyRefs.current[targetId];

    if (!nodeA || !nodeB) return;

    nodeA.getWorldPosition(vA);
    nodeB.getWorldPosition(vB);
    vMid.addVectors(vA, vB).multiplyScalar(0.5);

    if (midGroupRef.current) {
      midGroupRef.current.position.copy(vMid);
    }

    if (lineRef.current) {
      lineRef.current.geometry.setPositions([vA.x, vA.y, vA.z, vB.x, vB.y, vB.z]);
    }

    const data = calculateDistance(sourceId, targetId, simClock.days);
    if (data) {
      if (auTextRef.current) auTextRef.current.textContent = data.formattedAu;
      if (kmTextRef.current) kmTextRef.current.textContent = data.formattedKm;
      if (lightTextRef.current) lightTextRef.current.textContent = data.formattedLightTime;
    }
  });

  if (!active || !sourceId || !targetId) return null;

  const initialData = calculateDistance(sourceId, targetId, simClock.days);
  const sourceName = bodyById(sourceId)?.identity.name ?? sourceId;
  const targetName = bodyById(targetId)?.identity.name ?? targetId;

  return (
    <group>
      <Line
        ref={lineRef}
        points={points}
        color="#38bdf8"
        lineWidth={2}
        dashed
        dashScale={2}
        dashSize={1}
        gapSize={0.5}
        transparent
        opacity={0.85}
      />
      <group ref={midGroupRef} position={[vMid.x, vMid.y, vMid.z]}>
        <Html
          center
          distanceFactor={22}
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          <div
            className="rounded-lg bg-bg/85 backdrop-blur-md px-3 py-1.5 font-mono text-xs text-sky-300 shadow-[var(--shadow-border)] border border-sky-400/40 whitespace-nowrap flex flex-col items-center gap-0.5"
          >
            <div className="font-sans text-[11px] font-medium text-fg/80">
              {sourceName} ↔ {targetName}
            </div>
            <div ref={auTextRef} className="font-bold text-sky-200">
              {initialData?.formattedAu ?? ""}
            </div>
            <div className="text-[10px] text-muted-fg flex gap-1.5">
              <span ref={kmTextRef}>{initialData?.formattedKm ?? ""}</span>
              <span>•</span>
              <span ref={lightTextRef}>{initialData?.formattedLightTime ?? ""}</span>
            </div>
          </div>
        </Html>
      </group>
    </group>
  );
}
