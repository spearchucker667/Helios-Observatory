import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useSim } from "@/lib/sim-store";
import { KUIPER_BELT } from "@/data/regions/kuiper-belt";

function skipRaycast() {
  /* non-interactive */
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function KuiperBelt() {
  const showOrbits = useSim((s) => s.showOrbits);
  const scaleMode = useSim((s) => s.scaleMode);
  const meshRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const prng = mulberry32(0x4b554950); // "KUIP"
    const count = 1500;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Semi-major axis between 30 and 50 AU
      const au = 30 + prng() * 20;
      // In presentation mode Neptune is 49.2, so Kuiper Belt spans ~49 to ~75
      const r =
        scaleMode === "distance"
          ? au * 5.2
          : 49.2 + ((au - 30) / 20) * 24.0;

      const angle = prng() * Math.PI * 2;
      // Typical classical/resonant TNO inclinations ~5° to 15°
      const inc = (prng() - 0.5) * 0.22;

      positions[i * 3] = r * Math.cos(angle);
      positions[i * 3 + 1] = r * Math.sin(inc);
      positions[i * 3 + 2] = r * Math.sin(angle);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [scaleMode]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  if (!showOrbits) return null;

  return (
    <points ref={meshRef} geometry={geometry} raycast={skipRaycast}>
      <pointsMaterial
        size={0.3}
        color="#7099c2"
        sizeAttenuation
        transparent
        opacity={0.35}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export { KUIPER_BELT };
