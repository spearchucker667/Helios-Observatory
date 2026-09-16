import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useSim } from "@/lib/sim-store";
import { auToDeepSpaceRadius } from "@/lib/deep-space-scale";
import { OORT_CLOUD } from "@/data/regions/oort-cloud";

function skipRaycast() {
  /* non-interactive cloud background */
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function OortCloud() {
  const showOrbits = useSim((s) => s.showOrbits);
  const meshRef = useRef<THREE.Points>(null);

  // In presentation or distance mode, deep space points provide context when zoomed out
  const { geometry, geometryInner } = useMemo(() => {
    const prng = mulberry32(0x4f4f5254); // "OORT"

    // 1. Outer Spherical Shell: isotropic distribution (~20,000 to 100,000 AU)
    const outerCount = 1800;
    const outerPos = new Float32Array(outerCount * 3);
    for (let i = 0; i < outerCount; i++) {
      const au = 20000 + prng() * 80000;
      const r = auToDeepSpaceRadius(au);
      const theta = prng() * Math.PI * 2;
      const phi = Math.acos(2 * prng() - 1);
      outerPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      outerPos[i * 3 + 1] = r * Math.cos(phi);
      outerPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const outerGeo = new THREE.BufferGeometry();
    outerGeo.setAttribute("position", new THREE.BufferAttribute(outerPos, 3));

    // 2. Inner Hills Cloud: flattened torus-like cloud (~2,000 to 20,000 AU)
    const innerCount = 1200;
    const innerPos = new Float32Array(innerCount * 3);
    for (let i = 0; i < innerCount; i++) {
      const au = 2000 + prng() * 18000;
      const r = auToDeepSpaceRadius(au);
      const theta = prng() * Math.PI * 2;
      // Flattened towards ecliptic plane
      const phi = Math.PI / 2 + (prng() - 0.5) * 0.75;
      innerPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      innerPos[i * 3 + 1] = r * Math.cos(phi);
      innerPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const inGeo = new THREE.BufferGeometry();
    inGeo.setAttribute("position", new THREE.BufferAttribute(innerPos, 3));

    return { geometry: outerGeo, geometryInner: inGeo };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
      geometryInner.dispose();
    };
  }, [geometry, geometryInner]);

  if (!showOrbits) return null;

  return (
    <group raycast={skipRaycast}>
      {/* Outer spherical Oort cloud shell */}
      <points ref={meshRef} geometry={geometry} raycast={skipRaycast}>
        <pointsMaterial
          size={0.42}
          color="#a8c4e0"
          sizeAttenuation
          transparent
          opacity={0.32}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Inner disc-shaped Hills cloud */}
      <points geometry={geometryInner} raycast={skipRaycast}>
        <pointsMaterial
          size={0.38}
          color="#8cb0d8"
          sizeAttenuation
          transparent
          opacity={0.38}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}

export { OORT_CLOUD };
