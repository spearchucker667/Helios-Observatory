import { Html } from "@react-three/drei";
import type { SurfaceFeature } from "@/data/types";

export function FeatureMarkers({
  features,
  radius,
  visible,
}: {
  features?: SurfaceFeature[];
  radius: number;
  visible: boolean;
}) {
  if (!visible || !features || features.length === 0) return null;

  return (
    <group>
      {features.map((f) => {
        if (f.lat === undefined || f.lon === undefined) return null;
        const phi = (f.lat * Math.PI) / 180;
        const theta = (f.lon * Math.PI) / 180;
        const r = radius * 1.018;
        const y = r * Math.sin(phi);
        const rCos = r * Math.cos(phi);
        const x = -rCos * Math.sin(theta);
        const z = rCos * Math.cos(theta);

        return (
          <group key={f.id} position={[x, y, z]}>
            <mesh>
              <sphereGeometry args={[Math.max(radius * 0.018, 0.015), 12, 12]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
            <Html
              position={[0, Math.max(radius * 0.025, 0.02), 0]}
              center
              sprite
              distanceFactor={14}
              occlude={false}
              zIndexRange={[25, 10]}
              style={{ pointerEvents: "none", userSelect: "none" }}
            >
              <div className="flex items-center gap-1 rounded-md bg-bg/85 px-1.5 py-0.5 font-sans text-[10px] text-fg shadow-[var(--shadow-border)] backdrop-blur-sm">
                <span className="size-1 rounded-full bg-cyan-400" />
                <span className="font-medium whitespace-nowrap">{f.name}</span>
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
