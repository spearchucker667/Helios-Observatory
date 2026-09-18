import type { SimulationBody } from "../domain/types.ts";
import { stepSimulation } from "../physics/integrator.ts";
import { detectCollisions, type CollisionPair } from "../collisions/detect.ts";
import { resolveCollision } from "../collisions/resolve.ts";
import { detectRocheInteractions, rochePairKey } from "../collisions/tidal.ts";
import { SimulationEventBus, type SimulationEvent, type SimulationEventType } from "./events.ts";
import type { SimulationCommand, LoggedCommand } from "./commands.ts";
import {
  createWorldSnapshot,
  createRenderSnapshot,
  FORCE_MODEL_NEWTONIAN,
  FORCE_MODEL_PAIRWISE_1PN,
  COLLISION_MODEL_VERSION,
  type WorldSnapshot,
  type RenderSnapshot,
  type SimulationCheckpoint,
  type SimulationConfiguration,
  type DomainStatePatch,
} from "./snapshot.ts";
import { vec3Add, vec3Dist, vec3Mag, type Vector3 } from "../physics/vector.ts";
import { MAX_FULL_GRAVITY_BODIES, MAX_TOTAL_SIMULATION_BODIES } from "../physics/gravity.ts";
import { G_CODATA_2022, AU_M } from "../domain/constants.ts";
import { validateWorldMutation, validateBodyRecord, applyCompactInvariants } from "./mutation-guard.ts";

export interface WorldOptions {
  dtSeconds?: number;
  initialBodies?: SimulationBody[];
  initialSimTime?: number;
  initialTick?: number;
  enableRelativity?: boolean;
}

export interface StepResult {
  renderSnapshot: RenderSnapshot;
  events: SimulationEvent[];
  /** True when authoritative non-render metadata changed (emit WORLD_CHANGED). */
  domainChanged: boolean;
}

/** Deterministic event thresholds, documented in docs/PHYSICS_ENGINE.md. */
export const CLOSE_ENCOUNTER_RADII_MULTIPLE = 10;
export const CLOSE_ENCOUNTER_MIN_RELATIVE_SPEED_MS = 1000;
export const EJECTION_DISTANCE_M = 100 * AU_M;
export const ACCURACY_WARNING_DT_FRACTION = 0.01;

export class SimulationWorld {
  private bodies: Map<string, SimulationBody> = new Map();
  private simTimeSeconds: number = 0;
  private currentTick: number = 0;
  private dtSeconds: number = 900;
  private initialSnapshot: WorldSnapshot | null = null;
  public enableRelativity: boolean = false;

  public readonly eventBus: SimulationEventBus = new SimulationEventBus();
  private commandLog: LoggedCommand[] = [];

  // Continuous-detection / event-detector state, all derived (never authoritative).
  private lastPositions: Map<string, Vector3> = new Map();
  private rocheState: Map<string, boolean> = new Map();
  private encounterState: Map<string, boolean> = new Map();
  private boundState: Map<string, boolean> = new Map();
  private domainDirty: boolean = false;
  private haltedReason: string | null = null;

  constructor(options?: WorldOptions) {
    this.dtSeconds = options?.dtSeconds ?? 900;
    this.simTimeSeconds = options?.initialSimTime ?? 0;
    this.currentTick = options?.initialTick ?? 0;
    this.enableRelativity = options?.enableRelativity ?? false;

    if (options?.initialBodies) {
      for (const b of options.initialBodies) {
        const check = validateBodyRecord(b);
        if (!check.ok) throw new Error(`Invalid initial body: ${check.error}`);
        if (this.bodies.has(b.id)) {
          throw new Error(`Invalid initial state: duplicate body id "${b.id}"`);
        }
        const copy = structuredClone(b);
        applyCompactInvariants(copy, "initial state");
        this.bodies.set(copy.id, copy);
      }
      const massiveCount = this.countMassive();
      if (massiveCount > MAX_FULL_GRAVITY_BODIES) {
        throw new Error(
          `Invalid initial state: ${massiveCount} massive bodies exceeds the ${MAX_FULL_GRAVITY_BODIES} limit`
        );
      }
      if (this.bodies.size > MAX_TOTAL_SIMULATION_BODIES) {
        throw new Error(
          `Invalid initial state: ${this.bodies.size} bodies exceeds the ${MAX_TOTAL_SIMULATION_BODIES} limit`
        );
      }
      this.resetDetectorState();
      this.initialSnapshot = this.getSnapshot();
    }
  }

  // ---------------------------------------------------------------- accessors

  get bodiesList(): SimulationBody[] {
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

  get halted(): string | null {
    return this.haltedReason;
  }

  get bodyCount(): number {
    return this.bodies.size;
  }

  countMassive(): number {
    let n = 0;
    for (const b of this.bodies.values()) if (b.gravityRole === "massive") n++;
    return n;
  }

  /** The mutation context handed to the central validator. */
  private mutationContext = {
    hasBody: (id: string) => this.bodies.has(id),
    getBody: (id: string) => this.bodies.get(id),
    massiveBodyCount: () => this.countMassive(),
    totalBodyCount: () => this.bodies.size,
  };

  setDt(dt: number): boolean {
    if (!Number.isFinite(dt) || dt <= 0) return false;
    this.dtSeconds = dt;
    return true;
  }

  getConfiguration(playbackState: SimulationConfiguration["playbackState"]): SimulationConfiguration {
    return {
      quality: "standard",
      timeMultiplier: 86400,
      enableRelativity: this.enableRelativity,
      playbackState,
      forceModel: this.enableRelativity ? FORCE_MODEL_PAIRWISE_1PN : FORCE_MODEL_NEWTONIAN,
      integrator: this.enableRelativity ? "velocity-verlet-kdk-velocity-dependent" : "velocity-verlet-kdk",
      collisionModelVersion: COLLISION_MODEL_VERSION,
    };
  }

  // ------------------------------------------------------------------ stepping

  /**
   * Executes a single physics step forward in time by this.dtSeconds.
   * The world clock advances only after the integrated state is verified finite.
   */
  step(customDt?: number): StepResult {
    if (this.haltedReason) {
      throw new Error(`World is halted: ${this.haltedReason}`);
    }

    const dt = customDt ?? this.dtSeconds;
    if (!Number.isFinite(dt) || dt <= 0) {
      throw new Error(`Invalid timestep: ${dt}`);
    }

    const bodies = this.bodiesList;
    const numBodies = bodies.length;

    if (numBodies === 0) {
      this.currentTick++;
      this.simTimeSeconds += dt;
      this.domainDirty = true;
      return {
        renderSnapshot: this.getRenderSnapshot(),
        events: [],
        domainChanged: true,
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

    const integrated = stepSimulation(positions, velocities, masses, isTracer, dt, numBodies, undefined, {
      enableRelativity: this.enableRelativity,
    });

    // Refuse to advance a world that has left the finite domain.
    for (let i = 0; i < numBodies * 3; i++) {
      if (!Number.isFinite(integrated.positions[i]) || !Number.isFinite(integrated.velocities[i])) {
        this.haltedReason = `Non-finite state produced at tick ${this.currentTick + 1} (body index ${Math.floor(i / 3)}). Timestep dt=${dt}s is under-resolved; simulation halted.`;
        throw new Error(this.haltedReason);
      }
    }

    const previousPositions = new Map<string, Vector3>();
    for (const b of bodies) {
      previousPositions.set(b.id, [b.position[0], b.position[1], b.position[2]]);
    }

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

    const stepEvents: SimulationEvent[] = [];
    // A body may participate in at most one resolution per step: resolving a
    // pair consumes its bodies (merge/removals), and a second resolution on
    // the same tick would otherwise read stale pre-merge objects and silently
    // destroy the first resolution's conserved mass and momentum.
    const resolvedThisStep = new Set<string>();
    const contactPairs = this.resolveContactCollisions(previousPositions, stepEvents, resolvedThisStep);
    this.resolveRocheInteractions(contactPairs, stepEvents, resolvedThisStep);
    this.detectEventSignals(stepEvents);

    // Track previous positions for the next swept-detection pass.
    for (const b of this.bodiesList) {
      this.lastPositions.set(b.id, [b.position[0], b.position[1], b.position[2]]);
    }

    return {
      renderSnapshot: this.getRenderSnapshot(),
      events: stepEvents,
      domainChanged: this.domainDirty,
    };
  }

  private resolveContactCollisions(
    previousPositions: Map<string, Vector3>,
    stepEvents: SimulationEvent[],
    resolvedThisStep: Set<string>
  ): Set<string> {
    const bodies = this.bodiesList;
    const collisions = detectCollisions(bodies, { previousPositions });
    // Earliest contact first: the pair that touches earliest in the step is
    // resolved first; later pairs involving either body are skipped this step.
    collisions.sort((p, q) => p.contactParameter - q.contactParameter);
    const handled = new Set<string>();

    for (const pair of collisions) {
      if (!this.bodies.has(pair.bodyA.id) || !this.bodies.has(pair.bodyB.id)) continue;
      if (resolvedThisStep.has(pair.bodyA.id) || resolvedThisStep.has(pair.bodyB.id)) continue;
      handled.add(rochePairKey(pair.bodyA.id, pair.bodyB.id));
      this.applyResolution(pair, stepEvents, "contact");
      resolvedThisStep.add(pair.bodyA.id);
      resolvedThisStep.add(pair.bodyB.id);
    }

    return handled;
  }

  private resolveRocheInteractions(
    excludedPairs: Set<string>,
    stepEvents: SimulationEvent[],
    resolvedThisStep: Set<string>
  ): void {
    const bodies = this.bodiesList;
    const { interactions, state } = detectRocheInteractions(bodies, this.rocheState, excludedPairs);
    this.rocheState = state;

    for (const interaction of interactions) {
      if (interaction.isNewCrossing) {
        stepEvents.push(
          this.emitEvent(
            "roche_limit_crossing",
            [interaction.primary, interaction.secondary],
            `${interaction.secondary.name} crossed the fluid Roche limit of ${interaction.primary.name}.`,
            {
              fluidRocheLimitKm: (interaction.diagnostics.fluidRocheLimitM ?? 0) / 1000,
              rigidRocheLimitKm: (interaction.diagnostics.rigidRocheLimitM ?? 0) / 1000,
              separationKm: interaction.diagnostics.currentSeparationM / 1000,
              tidalGradientMs2PerM: interaction.diagnostics.tidalGradientMs2PerM,
            }
          )
        );
      }

      if (!this.bodies.has(interaction.primary.id) || !this.bodies.has(interaction.secondary.id)) {
        continue;
      }
      if (resolvedThisStep.has(interaction.primary.id) || resolvedThisStep.has(interaction.secondary.id)) {
        continue;
      }

      const pair: CollisionPair = {
        bodyA: interaction.primary,
        bodyB: interaction.secondary,
        separationM: interaction.diagnostics.currentSeparationM,
        contactDistanceM: interaction.primary.radius + interaction.secondary.radius,
        relativeVelocityMs: vec3Mag([
          interaction.primary.velocity[0] - interaction.secondary.velocity[0],
          interaction.primary.velocity[1] - interaction.secondary.velocity[1],
          interaction.primary.velocity[2] - interaction.secondary.velocity[2],
        ]),
        isBlackHoleCapture: false,
        contactParameter: 0,
        isSwept: false,
        interactionSource: "roche",
      };

      this.applyResolution(pair, stepEvents, "roche");
      resolvedThisStep.add(interaction.primary.id);
      resolvedThisStep.add(interaction.secondary.id);
    }
  }

  private applyResolution(
    pair: CollisionPair,
    stepEvents: SimulationEvent[],
    source: "contact" | "roche"
  ): void {
    const resolution = resolveCollision(pair);
    const primary = pair.bodyA.mass >= pair.bodyB.mass ? pair.bodyA : pair.bodyB;
    const secondary = pair.bodyA.mass >= pair.bodyB.mass ? pair.bodyB : pair.bodyA;

    for (const removedId of resolution.removedBodyIds) {
      this.bodies.delete(removedId);
      this.lastPositions.delete(removedId);
    }
    this.bodies.set(resolution.survivingBody.id, resolution.survivingBody);

    // Add tidal disruption debris remnants up to max total capacity
    if (resolution.remnantBodies) {
      for (const remnant of resolution.remnantBodies) {
        if (this.bodies.size < MAX_TOTAL_SIMULATION_BODIES && !this.bodies.has(remnant.id)) {
          this.bodies.set(remnant.id, remnant);
          this.lastPositions.set(remnant.id, [...remnant.position]);
        }
      }
    }

    // A surviving massive body must still respect the full-gravity cap.
    if (resolution.survivingBody.gravityRole === "massive" && this.countMassive() > MAX_FULL_GRAVITY_BODIES) {
      const survivor = this.bodies.get(resolution.survivingBody.id);
      if (survivor) survivor.gravityRole = "tracer";
    }

    this.domainDirty = true;

    let eventType: SimulationEventType = "merge";
    let summary = `Inelastic merge of ${secondary.name} into ${primary.name}.`;

    if (resolution.outcome === "black_hole_capture") {
      eventType = "black_hole_horizon_crossing";
      summary = `${secondary.name} crossed the event horizon of ${primary.name}.`;
    } else if (resolution.outcome === "tidal_disruption") {
      eventType = "tidal_disruption";
      const fragCount = resolution.remnantBodies ? resolution.remnantBodies.length : 0;
      const mechanism =
        source === "roche"
          ? "Roche-limit tidal shredding (no physical contact required)"
          : "Physical-contact tidal shredding";
      summary = `${mechanism}: ${secondary.name} shredded by ${primary.name}; ${fragCount} debris remnants generated.`;
    }

    const diagnostics = resolution.diagnostics;
    const event = this.emitEvent(
      eventType,
      [primary, secondary],
      summary,
      {
        relativeVelocityKmS: (diagnostics.relativeVelocityMs / 1000).toFixed(3),
        kineticImpactEnergyJ: diagnostics.supported
          ? diagnostics.kineticImpactEnergyJ.toExponential(4)
          : "unsupported (zero-mass tracer)",
        reducedMassKg: diagnostics.supported ? diagnostics.reducedMassKg.toExponential(4) : "unsupported",
        mergedMassKg: resolution.survivingBody.mass.toExponential(4),
        mergedRadiusKm: (resolution.survivingBody.radius / 1000).toFixed(3),
        remnantCount: resolution.remnantBodies ? resolution.remnantBodies.length : 0,
        contactSource: source,
        contactParameter: pair.contactParameter.toFixed(6),
      },
      `Surviving body: ${resolution.survivingBody.name} (mass: ${resolution.survivingBody.mass.toExponential(2)} kg)`
    );
    stepEvents.push(event);
  }

  /**
   * Deterministic close-encounter / escape / ejection / accuracy detectors.
   * Thresholds are documented in docs/PHYSICS_ENGINE.md.
   */
  private detectEventSignals(stepEvents: SimulationEvent[]): void {
    const bodies = this.bodiesList;
    const massive = bodies.filter((b) => b.mass > 0);
    const n = massive.length;

    // --- Close encounters -------------------------------------------------
    const nextEncounterState = new Map<string, boolean>();
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = massive[i];
        const b = massive[j];
        const key = rochePairKey(a.id, b.id);
        const contact = a.radius + b.radius;
        if (contact <= 0) continue;
        const separation = vec3Dist(a.position, b.position);
        const relSpeed = vec3Mag([
          a.velocity[0] - b.velocity[0],
          a.velocity[1] - b.velocity[1],
          a.velocity[2] - b.velocity[2],
        ]);
        const isNear =
          separation <= CLOSE_ENCOUNTER_RADII_MULTIPLE * contact &&
          relSpeed >= CLOSE_ENCOUNTER_MIN_RELATIVE_SPEED_MS;
        nextEncounterState.set(key, isNear);

        if (isNear && !(this.encounterState.get(key) ?? false)) {
          stepEvents.push(
            this.emitEvent(
              "close_encounter",
              [a, b],
              `${a.name} and ${b.name} closed to ${(separation / 1000).toExponential(3)} km at ${(relSpeed / 1000).toFixed(3)} km/s.`,
              {
                separationKm: separation / 1000,
                relativeVelocityKmS: relSpeed / 1000,
                thresholdRadiiMultiple: CLOSE_ENCOUNTER_RADII_MULTIPLE,
              }
            )
          );
        }
      }
    }
    this.encounterState = nextEncounterState;

    // --- Escape / ejection ------------------------------------------------
    if (n > 0) {
      let primary = massive[0];
      for (const b of massive) if (b.mass > primary.mass) primary = b;

      let mx = 0;
      let my = 0;
      let mz = 0;
      let totalMass = 0;
      for (const b of massive) {
        mx += b.mass * b.position[0];
        my += b.mass * b.position[1];
        mz += b.mass * b.position[2];
        totalMass += b.mass;
      }
      const com: Vector3 = totalMass > 0 ? [mx / totalMass, my / totalMass, mz / totalMass] : [0, 0, 0];

      for (const b of massive) {
        if (b.id === primary.id) continue;
        const relPos: Vector3 = [
          b.position[0] - primary.position[0],
          b.position[1] - primary.position[1],
          b.position[2] - primary.position[2],
        ];
        const relVel: Vector3 = [
          b.velocity[0] - primary.velocity[0],
          b.velocity[1] - primary.velocity[1],
          b.velocity[2] - primary.velocity[2],
        ];
        const r = vec3Mag(relPos);
        const v2 = relVel[0] * relVel[0] + relVel[1] * relVel[1] + relVel[2] * relVel[2];
        const mu = G_CODATA_2022 * (primary.mass + b.mass);
        const specificEnergy = r > 0 ? 0.5 * v2 - mu / r : 0;
        const isBound = specificEnergy < 0;
        const wasBound = this.boundState.get(b.id) ?? true;
        this.boundState.set(b.id, isBound);

        if (wasBound && !isBound) {
          stepEvents.push(
            this.emitEvent(
              "escape",
              [b, primary],
              `${b.name} became gravitationally unbound from ${primary.name} (specific orbital energy ${specificEnergy.toExponential(3)} J/kg).`,
              { specificOrbitalEnergyJkg: specificEnergy }
            )
          );
        }

        const comDistance = vec3Dist(b.position, com);
        if (!isBound && comDistance > EJECTION_DISTANCE_M) {
          stepEvents.push(
            this.emitEvent(
              "ejection",
              [b],
              `${b.name} was ejected from the system (${(comDistance / AU_M).toFixed(2)} AU from the barycenter).`,
              { barycenterDistanceAu: comDistance / AU_M }
            )
          );
        }
      }
    }

    // --- Accuracy warning -------------------------------------------------
    const dtWarning = this.computeAccuracyWarning();
    if (dtWarning) {
      stepEvents.push(
        this.emitEvent("accuracy_warning", [], dtWarning.summary, dtWarning.quantities)
      );
    }
  }

  private computeAccuracyWarning(): { summary: string; quantities: Record<string, number | string> } | null {
    const massive = this.bodiesList.filter((b) => b.mass > 0 && b.radius > 0);
    if (massive.length < 2) return null;

    let totalMass = 0;
    for (const b of massive) totalMass += b.mass;

    let minSeparation = Number.POSITIVE_INFINITY;
    for (let i = 0; i < massive.length; i++) {
      for (let j = i + 1; j < massive.length; j++) {
        const d = vec3Dist(massive[i].position, massive[j].position);
        if (d < minSeparation) minSeparation = d;
      }
    }
    if (!Number.isFinite(minSeparation) || minSeparation <= 0) return null;

    const dynamicalTime = Math.sqrt((minSeparation * minSeparation * minSeparation) / (G_CODATA_2022 * totalMass));
    if (!Number.isFinite(dynamicalTime) || dynamicalTime <= 0) return null;
    if (this.dtSeconds <= ACCURACY_WARNING_DT_FRACTION * dynamicalTime) return null;

    return {
      summary:
        `Timestep dt=${this.dtSeconds}s exceeds ${ACCURACY_WARNING_DT_FRACTION} of the shortest dynamical time ` +
        `(${dynamicalTime.toFixed(3)}s) for the closest massive pair. Reduce the timestep for this configuration.`,
      quantities: {
        dtSeconds: this.dtSeconds,
        dynamicalTimeSeconds: dynamicalTime,
        closestSeparationKm: minSeparation / 1000,
      },
    };
  }

  // ----------------------------------------------------------------- commands

  /**
   * Executes a command on the world deterministically.
   * @returns true when the command was accepted and applied.
   */
  executeCommand(command: SimulationCommand, isReplay = false): boolean {
    if (this.haltedReason) return false;

    const validation = validateWorldMutation(this.mutationContext, command);
    if (!validation.ok) {
      this.eventBus.emit({
        eventId: `cmd-reject-${this.currentTick}-${Date.now()}`,
        simTimeSeconds: this.simTimeSeconds,
        tick: this.currentTick,
        eventType: "accuracy_warning",
        involvedBodyIds: [],
        involvedBodyNames: [],
        summary: `Command rejected (${command.type}): ${validation.error}`,
        calculatedQuantities: { rejectedCommand: command.type },
      });
      return false;
    }

    const applied = this.applyCommand(command);

    // Only successfully applied, deterministic physics commands enter the log.
    // `reset_to_initial` is a session boundary that starts a fresh chronology.
    if (applied && !isReplay && command.type !== "reset_to_initial") {
      this.commandLog.push({
        tick: this.currentTick,
        simTimeSeconds: this.simTimeSeconds,
        command: structuredClone(command),
      });
    }

    return applied;
  }

  private applyCommand(command: SimulationCommand): boolean {
    switch (command.type) {
      case "add_body": {
        const copy = structuredClone(command.body);
        if (copy.gravityRole === "massive" && this.countMassive() >= MAX_FULL_GRAVITY_BODIES) {
          copy.gravityRole = "tracer";
          this.eventBus.emit({
            eventId: `cmd-${this.currentTick}-${copy.id}-cap`,
            simTimeSeconds: this.simTimeSeconds,
            tick: this.currentTick,
            eventType: "accuracy_warning",
            involvedBodyIds: [copy.id],
            involvedBodyNames: [copy.name],
            summary: `Full-gravity body cap (${MAX_FULL_GRAVITY_BODIES}) reached; ${copy.name} admitted as a tracer.`,
          });
        }
        applyCompactInvariants(copy, "body added");
        this.bodies.set(copy.id, copy);
        this.lastPositions.set(copy.id, [...copy.position]);
        this.domainDirty = true;
        this.emitEvent("body_added", [copy], `Added body: ${copy.name} (${copy.classification})`);
        return true;
      }

      case "delete_body": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        this.bodies.delete(command.id);
        this.lastPositions.delete(command.id);
        this.rocheStateCleanup(command.id);
        this.domainDirty = true;
        this.emitEvent("body_removed", [body], `Removed body: ${body.name}`);
        return true;
      }

      case "duplicate_body": {
        const source = this.bodies.get(command.id);
        if (!source) return false;
        const dup = structuredClone(source);
        dup.id = command.newId;
        dup.name = `${source.name} (Copy)`;
        if (command.offsetM) dup.position = vec3Add(dup.position, command.offsetM);
        if (dup.gravityRole === "massive" && this.countMassive() >= MAX_FULL_GRAVITY_BODIES) {
          dup.gravityRole = "tracer";
        }
        applyCompactInvariants(dup, "body duplicated");
        this.bodies.set(dup.id, dup);
        this.lastPositions.set(dup.id, [...dup.position]);
        this.domainDirty = true;
        this.emitEvent("body_added", [dup], `Duplicated body: ${source.name} -> ${dup.name}`);
        return true;
      }

      case "set_name": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        body.name = command.name.trim();
        this.domainDirty = true;
        this.emitEvent("parameter_changed", [body], `Renamed body to ${body.name}`);
        return true;
      }

      case "set_classification": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        body.classification = command.classification;
        if (isCompactClass(command.classification)) {
          body.physicsCapabilityFlags = { ...body.physicsCapabilityFlags, isRelativistic: true };
          if (command.classification === "black-hole" && body.mass > 0) {
            applyCompactInvariants(body, "classification change");
          }
        }
        this.domainDirty = true;
        this.emitEvent(
          "parameter_changed",
          [body],
          `${body.name} reclassified as ${command.classification}`
        );
        return true;
      }

      case "set_gravity_role": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        body.gravityRole = command.gravityRole;
        this.domainDirty = true;
        this.emitEvent(
          "parameter_changed",
          [body],
          `${body.name} gravity role set to ${command.gravityRole}`
        );
        return true;
      }

      case "set_color": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        if (command.color === undefined) delete body.color;
        else body.color = command.color;
        this.domainDirty = true;
        return true;
      }

      case "set_mass": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        body.mass = command.massKg;
        if (body.gravityRole !== "massive" && this.countMassive() < MAX_FULL_GRAVITY_BODIES) {
          body.gravityRole = "massive";
        }
        body.provenance.mass = { kind: "custom", method: "Direct mass edit" };
        if (body.classification === "black-hole") {
          applyCompactInvariants(body, "mass edit");
        }
        this.domainDirty = true;
        this.emitEvent("parameter_changed", [body], `Mass of ${body.name} set to ${command.massKg.toExponential(4)} kg`);
        return true;
      }

      case "set_radius": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        body.radius = command.radiusM;
        body.provenance.radius = { kind: "custom", method: "Direct radius edit" };
        if (body.density !== undefined || body.mass > 0) {
          body.density = body.mass / ((4 / 3) * Math.PI * Math.pow(body.radius, 3));
          body.provenance.density = { kind: "calculated", method: "Uniform sphere density from edited radius" };
        }
        this.domainDirty = true;
        this.emitEvent(
          "parameter_changed",
          [body],
          `Radius of ${body.name} set to ${(command.radiusM / 1000).toFixed(3)} km`
        );
        return true;
      }

      case "set_position": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        body.position = [...command.position];
        body.provenance.state = { kind: "custom", method: "Direct position edit" };
        this.lastPositions.set(body.id, [...body.position]);
        this.domainDirty = true;
        this.emitEvent("parameter_changed", [body], `Position of ${body.name} edited`);
        return true;
      }

      case "set_velocity": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        body.velocity = [...command.velocity];
        body.provenance.state = { kind: "custom", method: "Direct velocity edit" };
        this.domainDirty = true;
        this.emitEvent("parameter_changed", [body], `Velocity of ${body.name} edited`);
        return true;
      }

      case "apply_impulse": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        body.velocity[0] += command.impulseMs[0];
        body.velocity[1] += command.impulseMs[1];
        body.velocity[2] += command.impulseMs[2];
        body.provenance.state = { kind: "custom", method: "Applied velocity impulse" };
        this.domainDirty = true;
        this.emitEvent("parameter_changed", [body], `Velocity impulse applied to ${body.name}`);
        return true;
      }

      case "set_rotation": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        if (command.rotation === undefined) delete body.rotation;
        else body.rotation = structuredClone(command.rotation);
        this.domainDirty = true;
        return true;
      }

      case "set_thermal": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        if (command.thermal === undefined) {
          delete body.thermal;
          body.provenance.thermal = { kind: "unsupported", note: "Thermal record cleared" };
        } else {
          body.thermal = structuredClone(command.thermal);
          const estimated = command.thermal.emissivity === undefined;
          body.provenance.thermal = estimated
            ? {
                kind: "estimated",
                method: "Editor thermal record",
                note: "No emissivity supplied; equilibrium temperature requires an assumed emissivity.",
              }
            : { kind: "custom", method: "Editor thermal record" };
        }
        this.domainDirty = true;
        this.emitEvent("parameter_changed", [body], `Thermal properties of ${body.name} edited`);
        return true;
      }

      case "set_radiative": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        if (command.radiative === undefined) delete body.radiative;
        else body.radiative = structuredClone(command.radiative);
        this.domainDirty = true;
        return true;
      }

      case "set_compact_properties": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        if (command.compact === undefined) {
          delete body.compact;
          body.provenance.compact = { kind: "unsupported", note: "Compact-object record cleared" };
        } else {
          body.compact = structuredClone(command.compact);
          body.provenance.compact = { kind: "custom", method: "Editor compact-object edit" };
        }
        if (body.classification === "black-hole") {
          applyCompactInvariants(body, "compact-property edit");
        }
        this.domainDirty = true;
        this.emitEvent("parameter_changed", [body], `Compact-object parameters of ${body.name} edited`);
        return true;
      }

      case "set_parent_body": {
        const body = this.bodies.get(command.id);
        if (!body) return false;
        if (command.parentBodyId === undefined) delete body.parentBodyId;
        else body.parentBodyId = command.parentBodyId;
        this.domainDirty = true;
        return true;
      }

      case "set_dt": {
        this.setDt(command.dtSeconds);
        return true;
      }

      case "set_time_multiplier":
        // Playback configuration lives in the worker/scheduler; no world effect.
        return true;

      case "set_relativity": {
        this.enableRelativity = command.enabled;
        this.emitEvent(
          "parameter_changed",
          [],
          command.enabled
            ? "Pairwise 1PN Schwarzschild-like correction enabled"
            : "Relativistic corrections disabled (Newtonian mode)"
        );
        return true;
      }

      case "reset_to_initial": {
        if (!this.initialSnapshot) return false;
        this.restoreSnapshot(this.initialSnapshot);
        this.commandLog = [];
        this.haltedReason = null;
        this.domainDirty = true;
        return true;
      }

      default: {
        const exhaustive: never = command;
        throw new Error(`Unhandled command: ${JSON.stringify(exhaustive)}`);
      }
    }
  }

  private rocheStateCleanup(removedId: string): void {
    for (const key of Array.from(this.rocheState.keys())) {
      if (key.split("|").includes(removedId)) this.rocheState.delete(key);
    }
    for (const key of Array.from(this.encounterState.keys())) {
      if (key.split("|").includes(removedId)) this.encounterState.delete(key);
    }
    this.boundState.delete(removedId);
    this.lastPositions.delete(removedId);
  }

  private emitEvent(
    eventType: SimulationEventType,
    involved: SimulationBody[],
    summary: string,
    calculatedQuantities?: Record<string, number | string>,
    outcome?: string
  ): SimulationEvent {
    const event: SimulationEvent = {
      eventId: `evt-${this.currentTick}-${eventType}-${involved.map((b) => b.id).join("_")}`,
      simTimeSeconds: this.simTimeSeconds,
      tick: this.currentTick,
      eventType,
      involvedBodyIds: involved.map((b) => b.id),
      involvedBodyNames: involved.map((b) => b.name),
      summary,
      calculatedQuantities,
      outcome,
      provenance: {
        model: this.enableRelativity ? FORCE_MODEL_PAIRWISE_1PN : FORCE_MODEL_NEWTONIAN,
        version: COLLISION_MODEL_VERSION,
      },
    };
    this.eventBus.emit(event);
    return event;
  }

  // -------------------------------------------------------------- trajectories

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

    const bodies = this.bodiesList;
    const targetIdx = bodies.findIndex((b) => b.id === targetBodyId);
    if (targetIdx === -1) return [];

    const numBodies = bodies.length;
    let positions: Float64Array = new Float64Array(numBodies * 3);
    let velocities: Float64Array = new Float64Array(numBodies * 3);
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
      const next = stepSimulation(positions, velocities, masses, isTracer, dt, numBodies, accel, {
        enableRelativity: this.enableRelativity,
      });
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

  // ------------------------------------------------------------ snapshots/log

  getSnapshot(): WorldSnapshot {
    return createWorldSnapshot(this.bodiesList, this.simTimeSeconds, this.currentTick, this.dtSeconds);
  }

  getRenderSnapshot(): RenderSnapshot {
    return createRenderSnapshot(this.bodiesList, this.simTimeSeconds, this.currentTick, this.dtSeconds);
  }

  restoreSnapshot(snapshot: WorldSnapshot): void {
    this.bodies.clear();
    for (const b of snapshot.bodies) {
      const copy = structuredClone(b);
      const check = validateBodyRecord(copy);
      if (!check.ok) throw new Error(`Invalid checkpoint body: ${check.error}`);
      this.bodies.set(copy.id, copy);
    }
    this.simTimeSeconds = snapshot.simTimeSeconds;
    this.currentTick = snapshot.tick;
    this.dtSeconds = snapshot.dtSeconds;
    this.resetDetectorState();
    this.domainDirty = true;
  }

  getCommandLog(): LoggedCommand[] {
    return structuredClone(this.commandLog);
  }

  /**
   * The authoritative session origin (bodies + epoch), i.e. the state a
   * scenario must be replayed from. Never the UI's own copy.
   */
  getInitialSnapshot(): WorldSnapshot {
    if (this.initialSnapshot) return structuredClone(this.initialSnapshot);
    return this.getSnapshot();
  }

  /** Complete restartable checkpoint, including the authoritative command log. */
  getCheckpoint(playbackState: SimulationConfiguration["playbackState"]): SimulationCheckpoint {
    return {
      ...this.getSnapshot(),
      configuration: this.getConfiguration(playbackState),
      commandLog: this.getCommandLog(),
    };
  }

  restoreCheckpoint(checkpoint: SimulationCheckpoint): SimulationConfiguration {
    this.restoreSnapshot(checkpoint);
    this.commandLog = structuredClone(checkpoint.commandLog ?? []);
    return checkpoint.configuration;
  }

  /** Returns and clears the pending authoritative domain-state patch. */
  takeDomainPatch(reason: string): DomainStatePatch | null {
    if (!this.domainDirty) return null;
    this.domainDirty = false;
    return {
      bodies: this.bodiesList,
      removedIds: [],
      reason,
    };
  }

  peekDomainDirty(): boolean {
    return this.domainDirty;
  }

  private resetDetectorState(): void {
    this.lastPositions.clear();
    this.rocheState.clear();
    this.encounterState.clear();
    this.boundState.clear();
    for (const b of this.bodiesList) {
      this.lastPositions.set(b.id, [b.position[0], b.position[1], b.position[2]]);
    }
  }
}

function isCompactClass(classification: string): boolean {
  return (
    classification === "black-hole" ||
    classification === "neutron-star" ||
    classification === "pulsar" ||
    classification === "magnetar"
  );
}
