import { useEffect, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";
import { bodyById } from "@/data/registry";
import { sceneBodyRadius } from "@/lib/scene-scale";
import { useSim } from "@/lib/sim-store";

const tmpWorld = new THREE.Vector3();
const tmpDelta = new THREE.Vector3();
const tmpDir = new THREE.Vector3();
const origin = new THREE.Vector3();

/** System-view home position; far enough for Neptune in distance mode. */
function homePosition(scaleMode: string): THREE.Vector3 {
  return scaleMode === "distance"
    ? new THREE.Vector3(24, 30, 72)
    : new THREE.Vector3(10.5, 12.5, 30.5);
}

export function CameraRig({
  bodyRefs,
}: {
  bodyRefs: MutableRefObject<Record<string, THREE.Object3D | null>>;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const lastTarget = useRef(new THREE.Vector3());
  const tracking = useRef(false);
  const returning = useRef(false);
  const { camera } = useThree();
  const resetNonce = useSim((s) => s.resetNonce);
  const scaleMode = useSim((s) => s.scaleMode);
  const selectedRegionId = useSim((s) => s.selectedRegionId);
  const defaultPos = useRef(homePosition(scaleMode));
  const initialSnap = useRef(true);
  const regionFraming = useRef(false);

  useEffect(() => {
    returning.current = true;
    tracking.current = false;
    initialSnap.current = false;
    regionFraming.current = false;
  }, [resetNonce]);

  useEffect(() => {
    if (selectedRegionId) {
      regionFraming.current = true;
      returning.current = false;
      tracking.current = false;
    }
  }, [selectedRegionId]);

  // Keep the home position in sync with scale mode.
  useEffect(() => {
    defaultPos.current = homePosition(scaleMode);
  }, [scaleMode]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.1);
    const controls = controlsRef.current;
    if (!controls) return;

    // Respect reduced-motion: snap instead of glide.
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const k = reduced ? 1 : 1 - Math.exp(-3.4 * d);
    const kReturn = reduced ? 1 : 1 - Math.exp(-2.4 * d);

    const selectedId = useSim.getState().selectedId;
    const currentRegionId = useSim.getState().selectedRegionId;
    const body = selectedId ? bodyById(selectedId) : null;

    if (body && selectedId && bodyRefs.current[selectedId]) {
      returning.current = false;
      regionFraming.current = false;
      const node = bodyRefs.current[selectedId]!;
      node.getWorldPosition(tmpWorld);

      const parent =
        body.identity.kind === "moon" && body.identity.parentId
          ? bodyById(body.identity.parentId)
          : null;
      const sceneR = sceneBodyRadius(body, useSim.getState().scaleMode, parent);
      const desired =
        body.identity.kind === "star"
          ? sceneR * 7.2
          : Math.max(sceneR * 8.4, 0.9);

      if (initialSnap.current) {
        controls.target.copy(tmpWorld);
        tmpDir.set(0.2, 0.35, 1).normalize().multiplyScalar(desired);
        camera.position.copy(tmpWorld).add(tmpDir);
        controls.minDistance = Math.max(sceneR * 1.6, 0.12);
        lastTarget.current.copy(tmpWorld);
        tracking.current = true;
        initialSnap.current = false;
        controls.update();
        return;
      }

      if (tracking.current) {
        tmpDelta.copy(tmpWorld).sub(lastTarget.current);
        camera.position.add(tmpDelta);
      }
      // Moons orbit in seconds of wall time — a lerped target lags them out
      // of frame. Track them exactly; the camera-delta follow keeps it smooth.
      const isMoon = body.identity.kind === "moon";
      controls.target.lerp(tmpWorld, isMoon ? 1 : k);
      tmpDir.copy(camera.position).sub(controls.target);
      if (tmpDir.lengthSq() < 1e-8) tmpDir.set(0.2, 0.35, 1);
      const dist = THREE.MathUtils.lerp(tmpDir.length(), desired, k);
      tmpDir.normalize().multiplyScalar(dist);
      camera.position.copy(controls.target).add(tmpDir);
      controls.minDistance = Math.max(sceneR * 1.6, 0.12);
      lastTarget.current.copy(tmpWorld);
      tracking.current = true;
    } else if (currentRegionId) {
      tracking.current = false;
      returning.current = false;
      controls.target.lerp(origin, kReturn);
      controls.minDistance = 1.0;

      if (regionFraming.current) {
        const isOort = currentRegionId === "oort-cloud";
        const targetDist = isOort
          ? (scaleMode === "distance" ? 240 : 180)
          : (scaleMode === "distance" ? 180 : 80);
        tmpDir.copy(camera.position).sub(origin);
        if (tmpDir.lengthSq() < 1e-4) tmpDir.set(0.35, 0.5, 0.75);
        tmpDir.normalize().multiplyScalar(targetDist);
        camera.position.lerp(tmpDir, kReturn);
        if (camera.position.distanceTo(tmpDir) < 0.5) {
          regionFraming.current = false;
        }
      }
      lastTarget.current.copy(controls.target);
    } else {
      tracking.current = false;
      controls.target.lerp(origin, kReturn);
      controls.minDistance = 0.6;
      if (returning.current) {
        camera.position.lerp(defaultPos.current, kReturn);
        if (camera.position.distanceTo(defaultPos.current) < 0.08) returning.current = false;
      }
      lastTarget.current.copy(controls.target);
    }

    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minDistance={0.6}
      maxDistance={260}
      minPolarAngle={0.02}
      maxPolarAngle={Math.PI - 0.02}
      makeDefault
    />
  );
}
