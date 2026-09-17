import type { SimulationBody } from "../domain/types.ts";
import type { SystemInvariants } from "../physics/invariants.ts";
import { computeSystemInvariants } from "../physics/invariants.ts";
import { ENGINE_VERSION } from "./engine-version.ts";

export interface WorldSnapshot {
  engineVersion: string;
  schemaVersion: number;
  simTimeSeconds: number;
  tick: number;
  dtSeconds: number;
  bodies: SimulationBody[];
  invariants: SystemInvariants;
}

/**
 * Optimized flat transferable arrays for worker -> main-thread transfer.
 */
export interface RenderSnapshot {
  engineVersion: string;
  simTimeSeconds: number;
  tick: number;
  numBodies: number;
  bodyIds: string[];
  names: string[];
  classes: string[];
  colors: string[];
  positions: Float64Array; // [x0, y0, z0, x1, y1, z1, ...]
  velocities: Float64Array; // [vx0, vy0, vz0, ...]
  masses: Float64Array; // [m0, m1, ...]
  radii: Float64Array; // [r0, r1, ...]
  isTracer: Uint8Array; // [0, 1, ...]
}

export function createWorldSnapshot(
  bodies: SimulationBody[],
  simTimeSeconds: number,
  tick: number,
  dtSeconds: number
): WorldSnapshot {
  const safeBodies = structuredClone(bodies);
  return {
    engineVersion: ENGINE_VERSION,
    schemaVersion: 1,
    simTimeSeconds,
    tick,
    dtSeconds,
    bodies: safeBodies,
    invariants: computeSystemInvariants(safeBodies),
  };
}

export function createRenderSnapshot(
  bodies: SimulationBody[],
  simTimeSeconds: number,
  tick: number
): RenderSnapshot {
  const numBodies = bodies.length;
  const positions = new Float64Array(numBodies * 3);
  const velocities = new Float64Array(numBodies * 3);
  const masses = new Float64Array(numBodies);
  const radii = new Float64Array(numBodies);
  const isTracer = new Uint8Array(numBodies);

  const bodyIds: string[] = new Array(numBodies);
  const names: string[] = new Array(numBodies);
  const classes: string[] = new Array(numBodies);
  const colors: string[] = new Array(numBodies);

  for (let i = 0; i < numBodies; i++) {
    const b = bodies[i];
    bodyIds[i] = b.id;
    names[i] = b.name;
    classes[i] = b.classification;
    colors[i] = b.color ?? "#ffffff";

    positions[i * 3] = b.position[0];
    positions[i * 3 + 1] = b.position[1];
    positions[i * 3 + 2] = b.position[2];

    velocities[i * 3] = b.velocity[0];
    velocities[i * 3 + 1] = b.velocity[1];
    velocities[i * 3 + 2] = b.velocity[2];

    masses[i] = b.mass;
    radii[i] = b.radius;
    isTracer[i] = b.gravityRole === "tracer" ? 1 : 0;
  }

  return {
    engineVersion: ENGINE_VERSION,
    simTimeSeconds,
    tick,
    numBodies,
    bodyIds,
    names,
    classes,
    colors,
    positions,
    velocities,
    masses,
    radii,
    isTracer,
  };
}
