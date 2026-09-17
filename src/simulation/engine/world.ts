import type { SimulationBody } from "../domain/types.ts";
import { stepSimulation } from "../physics/integrator.ts";
import { detectCollisions } from "../collisions/detect.ts";
import { resolveCollision } from "../collisions/resolve.ts";
import { SimulationEventBus, type SimulationEvent } from "./events.ts";
import type { SimulationCommand, LoggedCommand } from "./commands.ts";
import {
  createWorldSnapshot,
  createRenderSnapshot,
  type WorldSnapshot,
  type RenderSnapshot,
} from "./snapshot.ts";
import { vec3Add } from "../physics/vector.ts";

export interface WorldOptions {
  dtSeconds?: number;
  initialBodies?: SimulationBody[];
  initialSimTime?: number;
  initialTick?: number;
}

export class SimulationWorld {
  private bodies: Map<string, SimulationBody> = new Map();
  private simTimeSeconds: number = 0;
  private currentTick: number = 0;
  private dtSeconds: number = 900;
  private initialSnapshot: WorldSnapshot | null = null;

  public readonly eventBus: SimulationEventBus = new SimulationEventBus();
  private commandLog: LoggedCommand[] = [];

  constructor(options?: WorldOptions) {
    this.dtSeconds = options?.dtSeconds ?? 900;
    this.simTimeSeconds = options?.initialSimTime ?? 0;
    this.currentTick = options?.initialTick ?? 0;

    if (options?.initialBodies) {
      for (const b of options.initialBodies) {
        this.bodies.set(b.id, structuredClone(b));
      }
      this.initialSnapshot = this.getSnapshot();
    }
  }

  get bodiesList(): SimulationBody[] {
    // Deterministic sort by ID
    return Array.from(this.bodies.values()).sort((a, b) => a.id.localeCompare(b.id));
  }

  getBody(id: string): SimulationBody | undefined {
    const b = this.bodies.get(id);
    return b ? structuredClone(b) : undefined;
  }

  get simTime(): number {
    return this.simTimeSeconds;
  }

  get tick(): number {
    return this.currentTick;
  }

  get dt(): number {
    return this.dtSeconds;
  }

  setDt(dt: number): void {
    this.dtSeconds = Math.max(1, dt);
  }

  /**
   * Executes a single physics step forward in time by this.dtSeconds.
   */
  step(customDt?: number): { renderSnapshot: RenderSnapshot; events: SimulationEvent[] } {
    const dt = customDt ?? this.dtSeconds;
    const bodies = this.bodiesList;
    const numBodies = bodies.length;

    if (numBodies === 0) {
      this.currentTick++;
      this.simTimeSeconds += dt;
      return {
        renderSnapshot: createRenderSnapshot([], this.simTimeSeconds, this.currentTick),
        events: [],
      };
    }

    const positions = new Float64Array(numBodies * 3);
    const velocities = new Float64Array(numBodies * 3);
    const masses = new Float64Array(numBodies);
    const isTracer = new Uint8Array(numBodies);

    for (let i = 0; i < numBodies; i++) {
      const b = bodies[i];
      positions[i * 3] = b.position[0];
      positions[i * 3 + 1] = b.position[1];
      positions[i * 3 + 2] = b.position[2];

      velocities[i * 3] = b.velocity[0];
      velocities[i * 3 + 1] = b.velocity[1];
      velocities[i * 3 + 2] = b.velocity[2];

      masses[i] = b.mass;
      isTracer[i] = b.gravityRole === "tracer" ? 1 : 0;
    }

    // Advance symplectic Velocity Verlet
    const integrated = stepSimulation(positions, velocities, masses, isTracer, dt, numBodies);

    // Update body states
    for (let i = 0; i < numBodies; i++) {
      const b = bodies[i];
      b.position = [
        integrated.positions[i * 3],
        integrated.positions[i * 3 + 1],
        integrated.positions[i * 3 + 2],
      ];
      b.velocity = [
        integrated.velocities[i * 3],
        integrated.velocities[i * 3 + 1],
        integrated.velocities[i * 3 + 2],
      ];
    }

    this.currentTick++;
    this.simTimeSeconds += dt;

    // Detect and resolve collisions during this substep
    const collisions = detectCollisions(bodies);
    const stepEvents: SimulationEvent[] = [];

    for (const pair of collisions) {
      // Check if both bodies still exist (could have been removed in earlier pair of this step)
      if (!this.bodies.has(pair.bodyA.id) || !this.bodies.has(pair.bodyB.id)) {
        continue;
      }

      const resolution = resolveCollision(pair);

      // Apply resolution to world state
      for (const removedId of resolution.removedBodyIds) {
        this.bodies.delete(removedId);
      }
      this.bodies.set(resolution.survivingBody.id, resolution.survivingBody);

      // Emit event
      const event: SimulationEvent = {
        eventId: `evt-${this.currentTick}-${pair.bodyA.id}-${pair.bodyB.id}`,
        simTimeSeconds: this.simTimeSeconds,
        tick: this.currentTick,
        eventType: resolution.outcome === "black_hole_capture" ? "black_hole_horizon_crossing" : "merge",
        involvedBodyIds: [pair.bodyA.id, pair.bodyB.id],
        involvedBodyNames: [pair.bodyA.name, pair.bodyB.name],
        summary:
          resolution.outcome === "black_hole_capture"
            ? `${pair.bodyA.name} and ${pair.bodyB.name} merged across the event horizon.`
            : `Physical collision and merge between ${pair.bodyA.name} and ${pair.bodyB.name}.`,
        calculatedQuantities: {
          relativeVelocityKmS: (resolution.diagnostics.relativeVelocityMs / 1000).toFixed(2),
          kineticImpactEnergyJoules: resolution.diagnostics.kineticImpactEnergyJ.toExponential(4),
          reducedMassKg: resolution.diagnostics.reducedMassKg.toExponential(4),
          mergedMassKg: resolution.survivingBody.mass.toExponential(4),
          mergedRadiusKm: (resolution.survivingBody.radius / 1000).toFixed(2),
        },
        outcome: `Surviving body: ${resolution.survivingBody.name} (mass: ${resolution.survivingBody.mass.toExponential(2)} kg)`,
      };

      this.eventBus.emit(event);
      stepEvents.push(event);
    }

    return {
      renderSnapshot: this.getRenderSnapshot(),
      events: stepEvents,
    };
  }

  /**
   * Executes a command on the world deterministically.
   */
  executeCommand(command: SimulationCommand, isReplay = false): void {
    if (!isReplay) {
      this.commandLog.push({
        tick: this.currentTick,
        simTimeSeconds: this.simTimeSeconds,
        command,
      });
    }

    switch (command.type) {
      case "add_body": {
        const copy = structuredClone(command.body);
        this.bodies.set(copy.id, copy);
        this.eventBus.emit({
          eventId: `cmd-${this.currentTick}-${copy.id}-add`,
          simTimeSeconds: this.simTimeSeconds,
          tick: this.currentTick,
          eventType: "body_added",
          involvedBodyIds: [copy.id],
          involvedBodyNames: [copy.name],
          summary: `Added body: ${copy.name} (${copy.classification})`,
        });
        break;
      }
      case "delete_body": {
        const body = this.bodies.get(command.id);
        if (body) {
          this.bodies.delete(command.id);
          this.eventBus.emit({
            eventId: `cmd-${this.currentTick}-${command.id}-del`,
            simTimeSeconds: this.simTimeSeconds,
            tick: this.currentTick,
            eventType: "body_removed",
            involvedBodyIds: [command.id],
            involvedBodyNames: [body.name],
            summary: `Removed body: ${body.name}`,
          });
        }
        break;
      }
      case "duplicate_body": {
        const source = this.bodies.get(command.id);
        if (source) {
          const dup = structuredClone(source);
          dup.id = command.newId;
          dup.name = `${source.name} (Copy)`;
          if (command.offsetM) {
            dup.position = vec3Add(dup.position, command.offsetM);
          }
          this.bodies.set(dup.id, dup);
          this.eventBus.emit({
            eventId: `cmd-${this.currentTick}-${dup.id}-dup`,
            simTimeSeconds: this.simTimeSeconds,
            tick: this.currentTick,
            eventType: "body_added",
            involvedBodyIds: [dup.id],
            involvedBodyNames: [dup.name],
            summary: `Duplicated body: ${source.name} -> ${dup.name}`,
          });
        }
        break;
      }
      case "update_body": {
        const body = this.bodies.get(command.id);
        if (body) {
          Object.assign(body, command.updates);
          this.eventBus.emit({
            eventId: `cmd-${this.currentTick}-${command.id}-upd`,
            simTimeSeconds: this.simTimeSeconds,
            tick: this.currentTick,
            eventType: "parameter_changed",
            involvedBodyIds: [command.id],
            involvedBodyNames: [body.name],
            summary: `Updated parameters for ${body.name}`,
          });
        }
        break;
      }
      case "set_position": {
        const body = this.bodies.get(command.id);
        if (body) {
          body.position = [...command.position];
          body.provenance.state = { kind: "custom", method: "Direct position edit" };
        }
        break;
      }
      case "set_velocity": {
        const body = this.bodies.get(command.id);
        if (body) {
          body.velocity = [...command.velocity];
          body.provenance.state = { kind: "custom", method: "Direct velocity edit" };
        }
        break;
      }
      case "apply_impulse": {
        const body = this.bodies.get(command.id);
        if (body) {
          body.velocity[0] += command.impulseMs[0];
          body.velocity[1] += command.impulseMs[1];
          body.velocity[2] += command.impulseMs[2];
          body.provenance.state = { kind: "custom", method: "Applied velocity impulse" };
        }
        break;
      }
      case "set_mass": {
        const body = this.bodies.get(command.id);
        if (body && command.massKg > 0) {
          body.mass = command.massKg;
          body.gravityRole = "massive";
          body.provenance.mass = { kind: "custom", method: "Direct mass edit" };
        }
        break;
      }
      case "set_radius": {
        const body = this.bodies.get(command.id);
        if (body && command.radiusM > 0) {
          body.radius = command.radiusM;
          body.provenance.radius = { kind: "custom", method: "Direct radius edit" };
        }
        break;
      }
      case "set_dt": {
        this.setDt(command.dtSeconds);
        break;
      }
      case "reset_to_initial": {
        if (this.initialSnapshot) {
          this.restoreSnapshot(this.initialSnapshot);
        }
        break;
      }
    }
  }

  /**
   * Generates trajectory prediction for a target body on an isolated world clone.
   * Does NOT mutate or advance authoritative world state!
   */
  predictTrajectory(
    targetBodyId: string,
    options?: { steps?: number; dt?: number }
  ): [number, number, number][] {
    const steps = Math.min(2048, options?.steps ?? 512);
    const dt = options?.dt ?? this.dtSeconds;

    // Create lightweight clone of positions and velocities
    const bodies = this.bodiesList;
    const targetIdx = bodies.findIndex((b) => b.id === targetBodyId);
    if (targetIdx === -1) return [];

    const numBodies = bodies.length;
    let positions: Float64Array<any> = new Float64Array(numBodies * 3);
    let velocities: Float64Array<any> = new Float64Array(numBodies * 3);
    const masses = new Float64Array(numBodies);
    const isTracer = new Uint8Array(numBodies);

    for (let i = 0; i < numBodies; i++) {
      const b = bodies[i];
      positions[i * 3] = b.position[0];
      positions[i * 3 + 1] = b.position[1];
      positions[i * 3 + 2] = b.position[2];

      velocities[i * 3] = b.velocity[0];
      velocities[i * 3 + 1] = b.velocity[1];
      velocities[i * 3 + 2] = b.velocity[2];

      masses[i] = b.mass;
      isTracer[i] = b.gravityRole === "tracer" ? 1 : 0;
    }

    const trajectoryPoints: [number, number, number][] = [];
    trajectoryPoints.push([
      positions[targetIdx * 3],
      positions[targetIdx * 3 + 1],
      positions[targetIdx * 3 + 2],
    ]);

    let accel: Float64Array | undefined = undefined;

    for (let s = 0; s < steps; s++) {
      const next = stepSimulation(positions, velocities, masses, isTracer, dt, numBodies, accel);
      positions = next.positions;
      velocities = next.velocities;
      accel = next.accelerations;

      trajectoryPoints.push([
        positions[targetIdx * 3],
        positions[targetIdx * 3 + 1],
        positions[targetIdx * 3 + 2],
      ]);
    }

    return trajectoryPoints;
  }

  getSnapshot(): WorldSnapshot {
    return createWorldSnapshot(this.bodiesList, this.simTimeSeconds, this.currentTick, this.dtSeconds);
  }

  getRenderSnapshot(): RenderSnapshot {
    return createRenderSnapshot(this.bodiesList, this.simTimeSeconds, this.currentTick);
  }

  restoreSnapshot(snapshot: WorldSnapshot): void {
    this.bodies.clear();
    for (const b of snapshot.bodies) {
      this.bodies.set(b.id, structuredClone(b));
    }
    this.simTimeSeconds = snapshot.simTimeSeconds;
    this.currentTick = snapshot.tick;
    this.dtSeconds = snapshot.dtSeconds;
  }

  getCommandLog(): LoggedCommand[] {
    return [...this.commandLog];
  }
}
