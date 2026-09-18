import { SimulationWorld } from "../engine/world.ts";
import { TimestepScheduler, isFiniteNumber, type PlaybackState } from "../engine/timestep.ts";
import { ENGINE_VERSION } from "../engine/engine-version.ts";
import { replaySimulation } from "../engine/replay.ts";
import type { WorldSnapshot } from "../engine/snapshot.ts";
import type { SimulationCommand } from "../engine/commands.ts";
import type { WorkerInboundMessage, WorkerOutboundMessage } from "./protocol.ts";
import { WorkerInboundMessageSchema, validateOutboundMessage } from "./worker-schemas.ts";

export const SNAPSHOT_INTERVAL_MS = 33; // ~30 Hz render snapshot cadence
export const LAST_GOOD_SNAPSHOT_INTERVAL_MS = 1000;

export interface SimulationHostOptions {
  emit: (msg: WorkerOutboundMessage, transfer?: Transferable[]) => void;
  /** When true, every outbound message is validated (tests / dev). */
  validateOutbound?: boolean;
}

/**
 * The authoritative simulation host.
 *
 * It is shared verbatim between the real Web Worker and the in-process
 * fallback client, so "fallback mode" cannot drift semantically from browser
 * mode. It owns the single source of truth for playback state; consumers only
 * reflect what it reports.
 */
export class SimulationHost {
  private world: SimulationWorld | null = null;
  private scheduler = new TimestepScheduler();
  private state: PlaybackState = "uninitialized";
  private lastWallClockTimeMs: number = Date.now();
  private lastGoodSnapshotAtMs: number = 0;
  private lastGoodSnapshot: WorldSnapshot | null = null;
  private haltReason: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeEvents: (() => void) | null = null;
  private readonly options: SimulationHostOptions;

  constructor(options: SimulationHostOptions) {
    this.options = options;
  }

  // ------------------------------------------------------------- lifecycle

  start(): void {
    this.stop();
    this.lastWallClockTimeMs = Date.now();
    this.timer = setInterval(() => this.tickLoop(), SNAPSHOT_INTERVAL_MS);
    // Do not hold a Node test process open.
    (this.timer as unknown as { unref?: () => void }).unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  dispose(): void {
    this.stop();
    if (this.unsubscribeEvents) {
      this.unsubscribeEvents();
      this.unsubscribeEvents = null;
    }
    this.world = null;
    this.state = "uninitialized";
  }

  getPlaybackState(): PlaybackState {
    return this.state;
  }

  getWorld(): SimulationWorld | null {
    return this.world;
  }

  // -------------------------------------------------------------- messaging

  private post(msg: WorkerOutboundMessage, transfer?: Transferable[]): void {
    if (this.options.validateOutbound) {
      const check = validateOutboundMessage(msg);
      if (!check.ok) {
        this.options.emit({ type: "error", error: `Internal protocol violation: ${check.error}`, code: "OUTBOUND_INVALID" });
        return;
      }
    }
    this.options.emit(msg, transfer);
  }

  private setState(state: PlaybackState): void {
    this.state = state;
    this.scheduler.setState(state);
    this.post({ type: "playback_state", state });
  }

  private postStats(): void {
    this.post({ type: "performance_status", stats: this.scheduler.getStats() });
  }

  private postSnapshot(): void {
    if (!this.world) return;
    const snapshot = this.world.getRenderSnapshot();
    const transfer: Transferable[] = [
      snapshot.positions.buffer,
      snapshot.velocities.buffer,
      snapshot.masses.buffer,
      snapshot.radii.buffer,
      snapshot.isTracer.buffer,
    ];
    this.post({ type: "snapshot", data: snapshot }, transfer);
  }

  private postDomainPatch(reason: string): void {
    if (!this.world) return;
    const patch = this.world.takeDomainPatch(reason);
    if (!patch) return;
    this.post({ type: "world_changed", bodies: patch.bodies, removedIds: patch.removedIds, reason: patch.reason });
  }

  /** Validates and dispatches one inbound message. Never throws. */
  handleMessage(raw: unknown): void {
    const parsed = WorkerInboundMessageSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path?.join(".") ?? "message";
      this.post({
        type: "error",
        error: `Rejected malformed worker message at "${path}": ${issue?.message ?? "invalid payload"}`,
        code: "INVALID_MESSAGE",
      });
      return;
    }

    try {
      this.dispatch(parsed.data as unknown as WorkerInboundMessage);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.halt(message, "MESSAGE_HANDLER_ERROR");
    }
  }

  private dispatch(msg: WorkerInboundMessage): void {
    switch (msg.type) {
      case "init": {
        this.stop();
        if (this.unsubscribeEvents) {
          this.unsubscribeEvents();
          this.unsubscribeEvents = null;
        }

        const dt = msg.dtSeconds ?? 900;
        if (!isFiniteNumber(dt) || dt <= 0) {
          this.post({ type: "error", error: `Invalid initial timestep: ${dt}`, code: "INVALID_DT" });
          return;
        }

        this.scheduler = new TimestepScheduler(dt);
        this.haltReason = null;
        this.world = new SimulationWorld({
          dtSeconds: dt,
          initialBodies: msg.bodies,
          initialSimTime: msg.simTimeSeconds ?? 0,
          initialTick: msg.tick ?? 0,
          enableRelativity: msg.enableRelativity ?? false,
        });
        this.subscribeEvents();

        // Initial state is explicitly PAUSED: the interface must never look
        // like it is running while the authoritative scheduler is paused.
        this.scheduler.reset(this.world.simTime, this.world.tick);
        this.setState("paused");

        this.post({ type: "ready", engineVersion: ENGINE_VERSION });
        this.postSnapshot();
        this.postDomainPatch("init");
        this.postStats();
        this.start();
        break;
      }

      case "command": {
        const world = this.requireWorld();
        if (!world) return;
        const applied = world.executeCommand(msg.command as SimulationCommand);
        if (!applied) {
          // The world also emits an accuracy_warning event; surface it as a
          // protocol-level rejection so callers can react.
          this.post({ type: "error", error: `Command rejected: ${msg.command.type}`, code: "COMMAND_REJECTED" });
        }
        this.postSnapshot();
        this.postDomainPatch(`command:${msg.command.type}`);
        break;
      }

      case "pause": {
        if (!this.world) return;
        this.lastWallClockTimeMs = Date.now();
        this.setState("paused");
        this.postStats();
        break;
      }

      case "resume": {
        if (!this.world) return;
        if (this.haltReason) {
          this.post({ type: "error", error: `Cannot resume: ${this.haltReason}`, code: "HALTED" });
          return;
        }
        this.lastWallClockTimeMs = Date.now();
        this.setState("running");
        this.postStats();
        break;
      }

      case "step_once": {
        const world = this.requireWorld();
        if (!world) return;
        // Atomic single-step: pause, execute exactly one dt, emit, stay paused.
        this.setState("stepping");
        const result = world.step(world.dt);
        this.scheduler.syncClock(world.tick, world.simTime);
        this.lastWallClockTimeMs = Date.now();
        void result;
        this.postSnapshot();
        this.postDomainPatch("step_once");
        this.setState("paused");
        this.postStats();
        break;
      }

      case "set_time_multiplier": {
        if (!this.scheduler.setTimeMultiplier(msg.multiplier)) {
          this.post({ type: "error", error: `Rejected time multiplier: ${msg.multiplier}`, code: "INVALID_MULTIPLIER" });
          return;
        }
        this.postStats();
        break;
      }

      case "set_dt": {
        const accepted = this.scheduler.setDt(msg.dtSeconds);
        if (!accepted || !this.world?.setDt(msg.dtSeconds)) {
          this.post({ type: "error", error: `Rejected timestep: ${msg.dtSeconds}`, code: "INVALID_DT" });
          return;
        }
        this.postStats();
        break;
      }

      case "set_quality": {
        if (!this.scheduler.setQuality(msg.quality)) {
          this.post({ type: "error", error: `Rejected quality: ${msg.quality}`, code: "INVALID_QUALITY" });
          return;
        }
        this.world?.setDt(this.scheduler.dt);
        this.postStats();
        break;
      }

      case "set_relativity": {
        if (!this.world) return;
        this.world.enableRelativity = msg.enabled;
        break;
      }

      case "request_snapshot": {
        if (!this.world) return;
        this.postSnapshot();
        this.postDomainPatch("request_snapshot");
        break;
      }

      case "request_trajectory": {
        const world = this.requireWorld();
        if (!world) return;
        const trajectory = world.predictTrajectory(msg.bodyId, { steps: msg.steps, dt: msg.dt });
        this.post({ type: "trajectory_result", bodyId: msg.bodyId, trajectory });
        break;
      }

      case "request_checkpoint": {
        const world = this.requireWorld();
        if (!world) return;
        this.post({ type: "checkpoint", checkpoint: world.getCheckpoint(this.state) });
        break;
      }

      case "request_command_log": {
        const world = this.requireWorld();
        if (!world) return;
        this.post({
          type: "command_log",
          commandLog: world.getCommandLog(),
          initialState: world.getInitialSnapshot(),
        });
        break;
      }

      case "load_checkpoint": {
        const checkpoint = msg.checkpoint;
        if (!this.world) {
          this.world = new SimulationWorld({ dtSeconds: checkpoint.dtSeconds });
          this.subscribeEvents();
        }
        const configuration = this.world.restoreCheckpoint(checkpoint);

        // Restore the FULL execution configuration, including scheduler dt.
        this.scheduler.setQuality(configuration.quality);
        this.scheduler.setDt(checkpoint.dtSeconds);
        this.scheduler.setTimeMultiplier(configuration.timeMultiplier);
        this.scheduler.reset(checkpoint.simTimeSeconds, checkpoint.tick);
        this.haltReason = null;
        this.lastWallClockTimeMs = Date.now();
        this.setState("paused");

        this.postSnapshot();
        this.postDomainPatch("load_checkpoint");
        this.postStats();
        break;
      }

      case "load_scenario": {
        this.stop();
        const { world, matchesFinalState, timeDeltaSeconds } = replaySimulation({
          initialSnapshot: msg.initialState,
          commands: msg.commands,
          finalState: msg.finalState,
        });

        if (!matchesFinalState) {
          this.post({
            type: "error",
            error:
              `Scenario replay did not reach the documented final time ` +
              `(delta ${timeDeltaSeconds.toExponential(3)} s at tick ${msg.finalState.tick}).`,
            code: "REPLAY_MISMATCH",
          });
        }

        if (this.unsubscribeEvents) {
          this.unsubscribeEvents();
          this.unsubscribeEvents = null;
        }
        this.world = world;
        this.subscribeEvents();
        this.haltReason = null;
        this.scheduler.reset(world.simTime, world.tick);
        this.scheduler.setDt(world.dt);
        this.setState("paused");

        this.postSnapshot();
        this.postDomainPatch("load_scenario");
        this.postStats();
        this.start();
        break;
      }

      case "reset_to_initial": {
        const world = this.requireWorld();
        if (!world) return;
        world.executeCommand({ type: "reset_to_initial" });
        this.haltReason = null;
        this.scheduler.reset(world.simTime, world.tick);
        this.scheduler.setDt(world.dt);
        this.lastWallClockTimeMs = Date.now();
        this.setState("paused");
        this.postSnapshot();
        this.postDomainPatch("reset_to_initial");
        this.postStats();
        break;
      }

      default: {
        const exhaustive: never = msg;
        this.post({ type: "error", error: `Unknown worker message: ${JSON.stringify(exhaustive)}`, code: "UNKNOWN_MESSAGE" });
      }
    }
  }

  private requireWorld(): SimulationWorld | null {
    if (!this.world) {
      this.post({ type: "error", error: "World not initialized", code: "NOT_INITIALIZED" });
      return null;
    }
    if (this.haltReason) {
      this.post({ type: "error", error: `World is halted: ${this.haltReason}`, code: "HALTED" });
      return null;
    }
    return this.world;
  }

  private subscribeEvents(): void {
    if (!this.world) return;
    this.unsubscribeEvents = this.world.eventBus.subscribe((event) => {
      this.post({ type: "event", event });
    });
  }

  // ------------------------------------------------------------- tick loop

  /** Periodic loop. Physics exceptions are contained and reported. */
  tickLoop(): void {
    const now = Date.now();
    const deltaRealSeconds = Math.max(0, (now - this.lastWallClockTimeMs) / 1000);
    this.lastWallClockTimeMs = now;

    if (!this.world || this.state !== "running") return;

    const stepsToRun = this.scheduler.planSteps(deltaRealSeconds);
    if (stepsToRun <= 0) return;

    try {
      for (let s = 0; s < stepsToRun; s++) {
        this.world.step();
        // Commit the authoritative clock only after a successful step.
        this.scheduler.syncClock(this.world.tick, this.world.simTime);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.halt(message, "PHYSICS_ERROR");
      return;
    }

    if (now - this.lastGoodSnapshotAtMs >= LAST_GOOD_SNAPSHOT_INTERVAL_MS) {
      this.lastGoodSnapshotAtMs = now;
      this.lastGoodSnapshot = this.world.getSnapshot();
    }

    this.postSnapshot();
    this.postDomainPatch("step");
    this.postStats();
  }

  /** Stops the loop, reports the halt and refuses to continue. */
  private halt(reason: string, code: string): void {
    this.haltReason = reason;
    this.stop();
    this.setState("halted");
    if (!this.lastGoodSnapshot && this.world) {
      this.lastGoodSnapshot = this.world.getSnapshot();
    }
    this.post({ type: "error", error: reason, code });
    this.post({
      type: "simulation_halted",
      reason,
      lastGoodTick: this.lastGoodSnapshot?.tick ?? 0,
      lastGoodSnapshot: this.lastGoodSnapshot,
    });
    this.postStats();
  }
}
