import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSim } from "@/lib/sim-store";

const ASTEROID_COUNT = 2400;

function skipRaycast() {
  /* disable picking for asteroid belt particles */
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Kirkwood gaps: dips in distribution at resonances with Jupiter (2.50, 2.82, 2.95, 3.27 AU)
function inKirkwoodGap(au: number): boolean {
  return (
    Math.abs(au - 2.5) < 0.035 || // 3:1
    Math.abs(au - 2.82) < 0.025 || // 5:2
    Math.abs(au - 2.95) < 0.02 || // 7:3
    Math.abs(au - 3.27) < 0.035 // 2:1
  );
}

export function AsteroidBelt() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const scaleMode = useSim((s) => s.scaleMode);

  // Shader uniforms ref
  const uniformsRef = useRef({
    uTime: { value: 0 },
    uScaleMode: { value: scaleMode === "distance" ? 1.0 : 0.0 },
  });

  // Keep uScaleMode smoothly tracked or updated
  useEffect(() => {
    uniformsRef.current.uScaleMode.value = scaleMode === "distance" ? 1.0 : 0.0;
  }, [scaleMode]);

  // Generate asteroid orbital parameters and colors once
  const { geometry, colors } = useMemo(() => {

    // Craggy low-poly rock geometry
    const baseGeo = new THREE.IcosahedronGeometry(1, 0);
    const posAttr = baseGeo.attributes.position;
    // Displace vertices slightly for irregular rock shapes
    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const perturb = 1 + (Math.sin(v.x * 5 + v.y * 3) * 0.18 + Math.cos(v.z * 4) * 0.12);
      v.multiplyScalar(perturb);
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    baseGeo.computeVertexNormals();

    const colorArr = new Float32Array(ASTEROID_COUNT * 3);
    const orbitArr = new Float32Array(ASTEROID_COUNT * 4); // rPres, rDist, initAngle, speed
    const tiltArr = new Float32Array(ASTEROID_COUNT * 2); // inclination, nodeAngle
    const sizeArr = new Float32Array(ASTEROID_COUNT); // size

    // Palette: C-type (carbonaceous dark), S-type (stony brown-grey), M-type (metallic sheen)
    const cType = new THREE.Color("#56524c");
    const sType = new THREE.Color("#7e6e5e");
    const mType = new THREE.Color("#9e9b94");
    const tmpCol = new THREE.Color();
    const prng = mulberry32(0x41535445); // "ASTE"

    let i = 0;
    while (i < ASTEROID_COUNT) {
      // Semi-major axis between 2.06 and 3.32 AU
      const au = 2.06 + prng() * 1.26;
      if (inKirkwoodGap(au) && prng() < 0.75) {
        continue; // create authentic Kirkwood gap dip
      }

      // Map to presentation distance (~17.0 to ~23.5)
      const t = (au - 2.06) / 1.26;
      const rPres = 17.0 + t * 6.5 + (prng() - 0.5) * 0.4;
      const rDist = au * 5.2;

      const initAngle = prng() * Math.PI * 2;
      // Keplerian speed: inner asteroids move faster (speed ~ 1 / sqrt(r^3))
      const speed = 0.08 * Math.pow(2.7 / au, 1.5) * (0.95 + prng() * 0.1);

      // Orbital inclination: typical 0° to 12°
      const inclination = (prng() * 12 * Math.PI) / 180 * (prng() < 0.5 ? -1 : 1);
      const nodeAngle = prng() * Math.PI * 2;

      // Power-law size distribution (mostly small rocks, few larger ones)
      const sizePower = Math.pow(prng(), 3.5);
      const size = 0.018 + sizePower * 0.065;

      orbitArr[i * 4] = rPres;
      orbitArr[i * 4 + 1] = rDist;
      orbitArr[i * 4 + 2] = initAngle;
      orbitArr[i * 4 + 3] = speed;

      tiltArr[i * 2] = inclination;
      tiltArr[i * 2 + 1] = nodeAngle;

      sizeArr[i] = size;

      // Color assignment based on taxonomic types
      const typeRand = prng();
      if (typeRand < 0.72) {
        // C-type
        tmpCol.copy(cType).offsetHSL((prng() - 0.5) * 0.04, (prng() - 0.5) * 0.05, (prng() - 0.5) * 0.08);
      } else if (typeRand < 0.9) {
        // S-type
        tmpCol.copy(sType).offsetHSL((prng() - 0.5) * 0.05, (prng() - 0.5) * 0.06, (prng() - 0.5) * 0.06);
      } else {
        // M-type
        tmpCol.copy(mType).offsetHSL((prng() - 0.5) * 0.02, (prng() - 0.5) * 0.04, (prng() - 0.5) * 0.06);
      }

      colorArr[i * 3] = tmpCol.r;
      colorArr[i * 3 + 1] = tmpCol.g;
      colorArr[i * 3 + 2] = tmpCol.b;

      i++;
    }

    baseGeo.setAttribute("aOrbit", new THREE.InstancedBufferAttribute(orbitArr, 4));
    baseGeo.setAttribute("aTilt", new THREE.InstancedBufferAttribute(tiltArr, 2));
    baseGeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizeArr, 1));

    return {
      geometry: baseGeo,
      colors: colorArr,
    };
  }, []);


  // Material with onBeforeCompile for GPU-accelerated orbital motion
  const material = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      roughness: 0.92,
      metalness: 0.08,
      vertexColors: true,
    });

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniformsRef.current.uTime;
      shader.uniforms.uScaleMode = uniformsRef.current.uScaleMode;

      shader.vertexShader = `
        uniform float uTime;
        uniform float uScaleMode;
        attribute vec4 aOrbit;
        attribute vec2 aTilt;
        attribute float aSize;
        ${shader.vertexShader}
      `;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `
        #include <begin_vertex>
        float curR = mix(aOrbit.x, aOrbit.y, uScaleMode);
        float curAngle = aOrbit.z + aOrbit.w * uTime;
        vec3 instanceOffset = vec3(
          curR * cos(curAngle),
          curR * sin(aTilt.x) * sin(curAngle - aTilt.y),
          curR * sin(curAngle)
        );
        transformed *= aSize;
        transformed += instanceOffset;
        `,
      );
    };

    mat.customProgramCacheKey = () => "helios-asteroid-belt-v1";
    return mat;
  }, []);

  // Initialize instanced colors
  useEffect(() => {
    const inst = meshRef.current;
    if (!inst) return;
    const dummy = new THREE.Object3D();
    for (let i = 0; i < ASTEROID_COUNT; i++) {
      dummy.position.set(0, 0, 0);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      inst.setColorAt(
        i,
        new THREE.Color(colors[i * 3], colors[i * 3 + 1], colors[i * 3 + 2]),
      );
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  }, [colors]);

  // Clean up
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  // Advance time uniform smoothly — exactly 1 uniform update per frame, zero CPU matrix math
  useFrame((_, delta) => {
    const { paused, speed } = useSim.getState();
    const d = Math.min(delta, 0.1);
    if (!paused) {
      uniformsRef.current.uTime.value += d * speed * 0.45;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, ASTEROID_COUNT]}
      frustumCulled={false}
      raycast={skipRaycast}
    />
  );
}
