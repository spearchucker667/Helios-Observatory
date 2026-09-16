import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";
import { useFrame } from "@react-three/fiber";
import { Billboard, Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { BODIES, bodyById } from "@/data/registry";
import type { AnyBody } from "@/data/types";
import { YEAR_SECONDS } from "@/lib/planets";
import { simClock, useSim } from "@/lib/sim-store";
import { sceneRadius } from "@/lib/scene-scale";
import {
  createTextureCache,
  disposeTextureCache,
  type TextureCache,
} from "@/components/solar/textures";
import { createRingTexture } from "@/components/solar/ring-systems";
import { MoonSystem } from "@/components/solar/moons";
import {
  computeEphemerisPosition,
  computeOrbitPath,
  EPHEMERIS_MIN_DAYS,
  EPHEMERIS_MAX_DAYS,
} from "@/lib/ephemeris";
import { AsteroidBelt } from "@/components/solar/asteroid-belt";
import { KuiperBelt } from "@/components/solar/kuiper-belt";
import { OortCloud } from "@/components/solar/oort-cloud";
import { MeasurementLine } from "@/components/solar/measurement-line";
import { FeatureMarkers } from "@/components/solar/feature-markers";
import { cn } from "@/lib/utils";



const TRAIL_LEN = 72;
const tmp = new THREE.Vector3();

const SUN_VERT = /* glsl */ `
varying vec3 vPos;
varying vec3 vN;
void main() {
  vPos = position;
  vN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SUN_FRAG = /* glsl */ `
uniform float uTime;
varying vec3 vPos;
varying vec3 vN;

float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
        mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
    mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
        mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
    f.z
  );
}


float fbm(vec3 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * noise(p);
    p *= 2.03;
    a *= 0.5;
  }
  return s;
}

void main() {
  float n = fbm(vPos * 1.7 + vec3(uTime * 0.11, uTime * 0.07, 0.0));
  vec3 dark = vec3(0.78, 0.28, 0.04);
  vec3 mid = vec3(1.0, 0.58, 0.12);
  vec3 hot = vec3(1.0, 0.93, 0.7);
  vec3 col = mix(dark, mid, n);
  col = mix(col, hot, smoothstep(0.52, 0.82, n));
  float limb = pow(abs(dot(normalize(vN), vec3(0.0, 0.0, 1.0))), 0.55);
  col *= 0.5 + 0.5 * limb;
  gl_FragColor = vec4(col, 1.0);
}
`;

function skipRaycast() {
  /* disable picking */
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function SimulationDriver() {
  useFrame((_, delta) => {
    const { paused, speed } = useSim.getState();
    if (paused) return;
    const d = Math.min(delta, 0.1);
    const nextDays = simClock.days + (d * speed * 365.25) / YEAR_SECONDS;
    if (nextDays >= EPHEMERIS_MAX_DAYS) {
      simClock.days = EPHEMERIS_MAX_DAYS;
      useSim.getState().setPaused(true);
    } else if (nextDays <= EPHEMERIS_MIN_DAYS) {
      simClock.days = EPHEMERIS_MIN_DAYS;
      useSim.getState().setPaused(true);
    } else {
      simClock.days = nextDays;
    }
  });
  return null;
}

function Starfield() {
  const positions = useMemo(() => {
    const prng = mulberry32(0x48656c69); // "Heli"
    const n = 3800;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 190 + prng() * 260;
      const theta = prng() * Math.PI * 2;
      const phi = Math.acos(2 * prng() - 1);
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      arr[i * 3 + 1] = r * Math.cos(phi);
      arr[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return arr;
  }, []);


  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} raycast={skipRaycast}>
      <pointsMaterial
        size={0.34}
        color="#e6edf6"
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
      />
    </points>
  );
}

function usePick(id: string) {
  const select = useSim((s) => s.select);
  const setHover = useSim((s) => s.setHover);
  return {
    onClick: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      const state = useSim.getState();
      if (state.measurement.active) {
        if (!state.measurement.sourceId) {
          state.setMeasurementSource(id);
        } else if (state.measurement.sourceId !== id) {
          state.setMeasurementTarget(id);
        }
        return;
      }
      select(id);
    },
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation();
      setHover(id);
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      setHover(null);
      document.body.style.cursor = "";
    },
  };
}



function Sun({
  tex,
  bodyRefs,
}: {
  tex: TextureCache;
  bodyRefs: MutableRefObject<Record<string, THREE.Object3D | null>>;
}) {
  const mat = useRef<THREE.ShaderMaterial>(null);
  const group = useRef<THREE.Group>(null);
  const pick = usePick("sun");
  const sceneR = sceneRadius(bodyById("sun")!, useSim((s) => s.scaleMode));

  useFrame((_, delta) => {
    const { paused, speed } = useSim.getState();
    const d = Math.min(delta, 0.1);
    if (mat.current && !paused) {
      mat.current.uniforms.uTime.value += d * speed;
    }
    if (group.current && !paused) {
      group.current.rotation.y += d * speed * 0.04;
    }
  });

  return (
    <group
      ref={(n) => {
        group.current = n;
        bodyRefs.current.sun = n;
      }}
    >
      <mesh {...pick}>
        <sphereGeometry args={[sceneR, 64, 64]} />
        <shaderMaterial
          ref={mat}
          uniforms={{ uTime: { value: 0 } }}
          vertexShader={SUN_VERT}
          fragmentShader={SUN_FRAG}
        />
      </mesh>
      <Billboard>
        <mesh raycast={skipRaycast}>
          <planeGeometry args={[sceneR * 5.5, sceneR * 5.5]} />
          <meshBasicMaterial
            map={tex.shared.glow}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>
      <pointLight color="#fff4d6" intensity={2.15} decay={0} />
      <Label body={bodyById("sun")!} radius={sceneR} />
    </group>
  );
}

function Label({ body, radius }: { body: AnyBody; radius: number }) {
  const show = useSim((s) => s.showLabels);
  const selectedId = useSim((s) => s.selectedId);
  const hoverId = useSim((s) => s.hoverId);
  if (!show) return null;
  // The selected body's name is in the detail panel — drop its world label
  // so inspection views aren't obscured.
  if (selectedId === body.identity.id) return null;
  const active = hoverId === body.identity.id;
  const dim = Boolean(selectedId && selectedId !== body.identity.id && !active);
  return (
    <Html
      position={[0, radius + 0.42, 0]}
      center
      sprite
      distanceFactor={18}
      occlude={false}
      zIndexRange={[9, 0]}
      wrapperClass="helios-label-wrap"
      className="helios-label"
      style={{ pointerEvents: "none", userSelect: "none", background: "transparent" }}
    >
      <div
        className={cn(
          "rounded-full bg-bg/70 px-2.5 py-1 font-sans text-xs tracking-wide whitespace-nowrap text-fg shadow-[var(--shadow-border)]",
          "transition-[opacity,transform] duration-(--motion-quick) ease-(--ease-out)",
          dim ? "opacity-35" : "opacity-100",
          active ? "scale-100" : "scale-[0.98]",
        )}
      >
        {body.identity.name}
      </div>
    </Html>
  );
}

function Wake({
  color,
  mover,
  visible,
}: {
  color: string;
  mover: RefObject<THREE.Group | null>;
  visible: boolean;
}) {
  const positions = useMemo(() => new Float32Array(TRAIL_LEN * 3), []);
  const line = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    return new THREE.Line(geometry, material);
  }, [positions, color]);
  const primed = useRef(false);

  useEffect(
    () => () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    },
    [line],
  );

  useFrame(() => {
    const node = mover.current;
    if (!node || !visible) return;
    tmp.copy(node.position);
    if (!primed.current) {
      for (let i = 0; i < TRAIL_LEN; i++) {
        positions[i * 3] = tmp.x;
        positions[i * 3 + 1] = tmp.y;
        positions[i * 3 + 2] = tmp.z;
      }
      primed.current = true;
    } else {
      positions.copyWithin(0, 3);
      positions[TRAIL_LEN * 3 - 3] = tmp.x;
      positions[TRAIL_LEN * 3 - 2] = tmp.y;
      positions[TRAIL_LEN * 3 - 1] = tmp.z;
    }
    const attr = line.geometry.getAttribute("position");
    attr.needsUpdate = true;
  });

  if (!visible) return null;
  return <primitive object={line} raycast={skipRaycast} />;
}

/** Ring mesh built from the ring-system module; UVs remapped radially. */
function RingMesh({ planetId, planetSceneR, pick }: { planetId: string; planetSceneR: number; pick: Record<string, unknown> }) {
  const map = useMemo(() => createRingTexture(planetId), [planetId]);
  useEffect(() => () => map.dispose(), [map]);
  const geometry = useMemo(() => {
    const ringData = bodyById(planetId)?.rings;
    if (!ringData) return null;
    const inner = ringData.innerRadiusPlanetary * planetSceneR;
    const outer = ringData.outerRadiusPlanetary * planetSceneR;
    const geo = new THREE.RingGeometry(inner, outer, 160, 1);
    // RingGeometry ships planar UVs; remap so u spans the radial profile
    // (inner edge → outer edge) and v wraps the circumference.
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const v3 = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i);
      const r = v3.length();
      const t = (r - inner) / (outer - inner);
      const theta = Math.atan2(v3.y, v3.x);
      uv.setXY(i, t, (theta / (Math.PI * 2) + 1) % 1);
    }
    uv.needsUpdate = true;
    return geo;
  }, [planetId, planetSceneR]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2} {...pick}>
      <meshStandardMaterial
        map={map}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        roughness={0.75}
        metalness={0.04}
      />
    </mesh>
  );
}

function Planet({
  body,
  tex,
  bodyRefs,
}: {
  body: AnyBody;
  tex: TextureCache;
  bodyRefs: MutableRefObject<Record<string, THREE.Object3D | null>>;
}) {
  const mover = useRef<THREE.Group>(null);
  const spin = useRef<THREE.Group>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const showOrbits = useSim((s) => s.showOrbits);
  const selectedId = useSim((s) => s.selectedId);
  const scaleMode = useSim((s) => s.scaleMode);
  const dateNonce = useSim((s) => s.dateNonce);
  const pick = usePick(body.identity.id);
  const id = body.identity.id;
  const sceneR = sceneRadius(body, scaleMode);

  // LOD: HIGH inspection texture only when the camera is close.
  const tier = useLodTier(mover, sceneR, id);
  const highMap = useMemo(
    () => (tier === "high" ? tex.get(id, "high") : null),
    [tex, id, tier],
  );
  const lowMap = useMemo(() => tex.get(id, "low"), [tex, id]);
  const map = highMap ?? lowMap;

  const ringPts = useMemo(
    () => computeOrbitPath(id, simClock.days, scaleMode),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, scaleMode, dateNonce],
  );
  const hitRadius = Math.max(sceneR * 2.6, 0.6);
  const isGas = body.identity.category === "Gas giant" || body.identity.category === "Ice giant";

  useFrame((_, delta) => {
    const node = mover.current;
    if (!node) return;
    const { paused, speed } = useSim.getState();
    const pos = computeEphemerisPosition(id, simClock.days, scaleMode);
    if (pos) {
      node.position.set(pos.x, pos.y, pos.z);
    }
    if (paused || !spin.current) return;
    const visualDay = 11;
    const periodHours = body.rotation.periodHours ?? 24;
    const rel = 24 / Math.max(Math.abs(periodHours), 4);
    const dir = periodHours < 0 ? -1 : 1;
    spin.current.rotation.y += (dir * (Math.PI * 2 * rel * speed * d(delta))) / visualDay;
    if (clouds.current) {
      clouds.current.rotation.y += (Math.PI * 2 * speed * d(delta)) / (visualDay * 0.72);
    }
  });

  return (
    <group>
      {showOrbits ? (
        <Line points={ringPts} color={body.identity.color} transparent opacity={0.28} lineWidth={1} />
      ) : null}
      <Wake color={body.identity.color} mover={mover} visible={showOrbits} />
      <group
        ref={(n) => {
          mover.current = n;
          bodyRefs.current[id] = n;
        }}
      >
        <group rotation={[(((body.rotation.axialTiltDeg ?? 0) * Math.PI) / 180), 0, 0]}>
          <group ref={spin}>
            <mesh {...pick}>
              <sphereGeometry args={[sceneR, 48, 48]} />
              <meshStandardMaterial
                map={map}
                roughness={isGas ? 0.48 : 0.82}
                metalness={0.04}
              />
            </mesh>
            <FeatureMarkers
              features={body.features}
              radius={sceneR}
              visible={selectedId === id}
            />

            {/* Earth: clouds + atmosphere + night lights on approach */}
            {id === "earth" ? (
              <>
                <mesh ref={clouds} raycast={skipRaycast}>
                  <sphereGeometry args={[sceneR * 1.02, 48, 48]} />
                  <meshStandardMaterial
                    map={tier === "high" ? tex.shared.cloudsHigh : tex.shared.clouds}
                    transparent
                    opacity={0.55}
                    depthWrite={false}
                    roughness={1}
                  />
                </mesh>
                <mesh scale={1.055} raycast={skipRaycast}>
                  <sphereGeometry args={[sceneR, 32, 32]} />
                  <meshBasicMaterial
                    color="#7ec4ff"
                    transparent
                    opacity={0.13}
                    side={THREE.BackSide}
                    depthWrite={false}
                  />
                </mesh>
              </>
            ) : null}

            {/* Venus: opaque haze shell; radar surface appears on inspection */}
            {id === "venus" ? (
              <mesh scale={tier === "high" ? 1.012 : 1.04} raycast={skipRaycast}>
                <sphereGeometry args={[sceneR, 32, 32]} />
                <meshBasicMaterial
                  color="#e6c98a"
                  transparent
                  opacity={tier === "high" ? 0.28 : 0.16}
                  side={THREE.BackSide}
                  depthWrite={false}
                />
              </mesh>
            ) : null}

            {/* Ring systems for all four ringed planets */}
            {body.rings ? <RingMesh planetId={id} planetSceneR={sceneR} pick={pick} /> : null}
          </group>
        </group>

        {/* Moon system (visibility governed by MoonSystem itself) */}
        <MoonSystem parent={body} parentRadius={sceneR} tex={tex} bodyRefs={bodyRefs} />

        <mesh {...pick}>
          <sphereGeometry args={[hitRadius, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        <Label body={body} radius={sceneR} />
      </group>
    </group>
  );
}

/* Small helpers kept below the component for readability. */

function d(delta: number): number {
  return Math.min(delta, 0.1);
}

/**
 * Camera-distance LOD: switches to the HIGH inspection texture when the
 * camera comes within ~12 planet radii. Re-render only on tier flips.
 */
function useLodTier(
  nodeRef: RefObject<THREE.Group | null>,
  sceneR: number,
  bodyId: string,
): "low" | "high" {
  const [tier, setTier] = useState<"low" | "high">("low");
  const tierRef = useRef(tier);
  useFrame(({ camera }) => {
    const node = nodeRef.current;
    if (!node || sceneR <= 0) return;
    if (!HIGH_CAPABLE.has(bodyId)) return;
    node.getWorldPosition(tmp);
    const dist = camera.position.distanceTo(tmp);
    const next: "low" | "high" = dist < sceneR * 12 ? "high" : "low";
    if (next !== tierRef.current) {
      tierRef.current = next;
      setTier(next);
    }
  });
  return tier;
}

const HIGH_CAPABLE = new Set([
  "mercury",
  "venus",
  "earth",
  "mars",
  "ceres",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
]);

export function SolarSystem({
  bodyRefs,
}: {
  bodyRefs: MutableRefObject<Record<string, THREE.Object3D | null>>;
}) {
  const tex = useMemo(() => createTextureCache(), []);
  useEffect(() => () => disposeTextureCache(tex), [tex]);

  return (

    <>
      <SimulationDriver />
      <Starfield />
      <ambientLight intensity={0.07} />
      <hemisphereLight args={["#8ea0b8", "#07080c", 0.18]} />
      <Sun tex={tex} bodyRefs={bodyRefs} />
      {BODIES.filter(
        (b) => b.identity.kind === "planet" || b.identity.kind === "dwarf-planet",
      ).map((p) => (
        <Planet key={p.identity.id} body={p} tex={tex} bodyRefs={bodyRefs} />
      ))}
      <AsteroidBelt />
      <KuiperBelt />
      <OortCloud />
      <MeasurementLine bodyRefs={bodyRefs} />
    </>
  );
}


