import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { moonsOf, bodyById } from "@/data/registry";
import type { AnyBody } from "@/data/types";
import { sceneMoonOrbit, sceneMoonRadius } from "@/lib/scene-scale";
import { simClock, useSim } from "@/lib/sim-store";
import type { TextureCache } from "@/components/solar/textures";

const tmpV = new THREE.Vector3();
void tmpV;

function MoonLabel({ name, radius }: { name: string; radius: number }) {
  const show = useSim((s) => s.showLabels);
  const selectedId = useSim((s) => s.selectedId);
  if (!show) return null;
  // Selected body's own label is redundant with the detail panel.
  if (selectedId === name.toLowerCase()) return null;
  return (
    <Html
      position={[0, radius + 0.12, 0]}
      center
      sprite
      distanceFactor={16}
      occlude={false}
      zIndexRange={[9, 0]}
      wrapperClass="helios-label-wrap"
      className="helios-label"
      style={{ pointerEvents: "none", userSelect: "none", background: "transparent" }}
    >
      <div
        className="rounded-full bg-bg/75 px-2 py-0.5 font-sans text-[11px] tracking-wide whitespace-nowrap text-fg/90 shadow-[var(--shadow-border)]"
      >
        {name}
      </div>
    </Html>
  );
}

function MoonBody({
  moon,
  parentRadius,
  tex,
  bodyRefs,
}: {
  moon: AnyBody;
  parentRadius: number;
  tex: TextureCache;
  bodyRefs: MutableRefObject<Record<string, THREE.Object3D | null>>;
}) {
  const mover = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const select = useSim((s) => s.select);
  const setHover = useSim((s) => s.setHover);
  const showOrbits = useSim((s) => s.showOrbits);
  const map = useMemo(() => tex.get(moon.identity.id, "low"), [tex, moon.identity.id]);

  const orbitR = sceneMoonOrbit(moon, parentRadius);
  const radius = sceneMoonRadius(moon, parentRadius);
  const periodDays = moon.orbit?.periodDays ?? 27;
  const inclination = ((moon.orbit?.inclinationDeg ?? 0) * Math.PI) / 180;
  const retrograde = moon.orbit?.retrograde ?? false;

  const orbitPts = useMemo(() => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push([Math.cos(a) * orbitR, 0, Math.sin(a) * orbitR]);
    }
    return pts;
  }, [orbitR]);

  useFrame((_, delta) => {
    const node = mover.current;
    if (!node) return;
    const { paused, speed } = useSim.getState();
    const theta =
      (simClock.days / periodDays) * Math.PI * 2 * (retrograde ? -1 : 1);
    node.position.set(
      Math.cos(theta) * orbitR,
      Math.sin(theta) * Math.sin(inclination) * orbitR * 0.3,
      Math.sin(theta) * orbitR,
    );
    if (spin.current && !paused) {
      // Tidal locking: rotation period equals orbit period.
      spin.current.rotation.y = theta;
      void delta;
      void speed;
    }
  });

  return (
    <group>
      {showOrbits ? (
        <Line points={orbitPts} color={moon.identity.color} transparent opacity={0.16} lineWidth={1} />
      ) : null}
      <group
        ref={(n) => {
          mover.current = n;
          bodyRefs.current[moon.identity.id] = n;
        }}
      >
        <group ref={spin}>
          <mesh
            onClick={(e) => {
              e.stopPropagation();
              select(moon.identity.id);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHover(moon.identity.id);
              document.body.style.cursor = "pointer";
            }}
            onPointerOut={() => {
              setHover(null);
              document.body.style.cursor = "";
            }}
          >
            <sphereGeometry args={[radius, 24, 24]} />
            <meshStandardMaterial map={map} roughness={0.9} metalness={0.02} />
          </mesh>
          <MoonLabel name={moon.identity.name} radius={radius} />
        </group>
      </group>
    </group>
  );
}

/**
 * Renders the parent planet's moon system. Mounted inside the planet's
 * frame-of-reference group; visibility follows moonMode:
 *   auto   — visible when the parent (or one of its moons) is selected
 *   always — visible whenever the parent is on screen
 *   hidden — never (moons appear only as catalogue data)
 */
export function MoonSystem({
  parent,
  parentRadius,
  tex,
  bodyRefs,
}: {
  parent: AnyBody;
  parentRadius: number;
  tex: TextureCache;
  bodyRefs: MutableRefObject<Record<string, THREE.Object3D | null>>;
}) {
  const moonMode = useSim((s) => s.moonMode);
  const selectedId = useSim((s) => s.selectedId);
  const moons = useMemo(() => moonsOf(parent.identity.id), [parent.identity.id]);
  if (moons.length === 0) return null;

  const focusIds = [parent.identity.id, ...moons.map((m) => m.identity.id)];
  const selected = selectedId ? focusIds.includes(selectedId) : false;
  const visible = moonMode === "always" || (moonMode === "auto" && selected);
  if (!visible) return null;

  return (
    <group>
      {moons.map((m) => (
        <MoonBody
          key={m.identity.id}
          moon={m}
          parentRadius={parentRadius}
          tex={tex}
          bodyRefs={bodyRefs}
        />
      ))}
    </group>
  );
}

/* eslint-disable react-refresh/only-export-components -- pure helpers, colocated with the scene they frame */
/**
 * Non-component helpers colocated with the scene for cohesion; excluded from
 * the fast-refresh rule because they are pure functions, not exports the
 * HMR boundary needs to preserve.
 */

/** Helper for camera framing: preferred distance for a selected body. */
export function focusDistance(body: AnyBody, sceneR: number): number {
  void body;
  return Math.max(sceneR * 6.5, 1.1);
}

export function parentOf(id: string): AnyBody | undefined {
  const body = bodyById(id);
  return body?.identity.parentId ? bodyById(body.identity.parentId) : undefined;
}
/* eslint-enable react-refresh/only-export-components */
