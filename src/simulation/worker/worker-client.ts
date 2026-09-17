import type { SimulationBody } from "../domain/types.ts";
import type { SimulationCommand } from "../engine/commands.ts";
import type { SimulationEvent } from "../engine/events.ts";
import type { RenderSnapshot, WorldSnapshot } from "../engine/snapshot.ts";
import type { TimestepQuality, TimestepStats } from "../engine/timestep.ts";
import type { WorkerInboundMessage, WorkerOutboundMessage } from "./protocol.ts";
import { SimulationWorld } from "../engine/world.ts";
import { TimestepScheduler } from "../engine/timestep.ts";

export class WorkerClient {
  private worker: Worker | null = null;
  private isFallbackMode = false;

  // In-process fallback instances (for Node.js or when Worker is unavailable)
  private localWorld: SimulationWorld | null = null;
  private localScheduler: TimestepScheduler = new TimestepScheduler();
  private localTimer: any = null;

  // Listeners
  private snapshotListeners: ((snap: RenderSnapshot) => void)[] = [];
  private eventListeners: ((event: SimulationEvent) => void)[] = [];
  private trajectoryListeners: ((bodyId: string, points: [number, number, number][]) => void)[] = [];
  private performanceListeners: ((stats: TimestepStats) => void)[] = [];
  private readyListeners: (() => void)[] = [];
  private errorListeners: ((err: string) => void)[] = [];

  private checkpointResolvers: ((snapshot: WorldSnapshot) => void)[] = [];

  constructor() {
    if (typeof Worker !== "undefined") {
      try {
        this.worker = new Worker(new URL("./physics.worker.ts", import.meta.url), {
          type: "module",
        });

        this.worker.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => {
          this.handleWorkerMessage(e.data);
        };

        this.worker.onerror = (err) => {
          const msg = err.message ?? "Worker error";
          for (const cb of this.errorListeners) cb(msg);
        };
      } catch {
        this.initFallback();
      }
    } else {
      this.initFallback();
    }
  }

  private initFallback() {
    this.isFallbackMode = true;
  }

  private handleWorkerMessage(msg: WorkerOutboundMessage) {
    switch (msg.type) {
      case "ready":
        for (const cb of this.readyListeners) cb();
        break;
      case "snapshot":
        for (const cb of this.snapshotListeners) cb(msg.data);
        break;
      case "event":
        for (const cb of this.eventListeners) cb(msg.event);
        break;
      case "trajectory_result":
        for (const cb of this.trajectoryListeners) cb(msg.bodyId, msg.trajectory);
        break;
      case "performance_status":
        for (const cb of this.performanceListeners) cb(msg.stats);
        break;
      case "checkpoint": {
        const resolver = this.checkpointResolvers.shift();
        if (resolver) resolver(msg.snapshot);
        break;
      }
      case "error":
        for (const cb of this.errorListeners) cb(msg.error);
        break;
    }
  }

  private post(msg: WorkerInboundMessage) {
    if (this.worker && !this.isFallbackMode) {
      this.worker.postMessage(msg);
    } else {
      this.handleLocalMessage(msg);
    }
  }

  private handleLocalMessage(msg: WorkerInboundMessage) {
    try {
      switch (msg.type) {
        case "init": {
          this.localScheduler = new TimestepScheduler(msg.dtSeconds ?? 900);
          this.localWorld = new SimulationWorld({
            dtSeconds: this.localScheduler.dt,
            initialBodies: msg.bodies,
            initialSimTime: msg.simTimeSeconds ?? 0,
            initialTick: msg.tick ?? 0,
          });

          this.localWorld.eventBus.subscribe((evt) => {
            for (const cb of this.eventListeners) cb(evt);
          });

          for (const cb of this.readyListeners) cb();
          for (const cb of this.snapshotListeners) cb(this.localWorld.getRenderSnapshot());
          break;
        }

        case "command": {
          if (!this.localWorld) throw new Error("World not initialized");
          this.localWorld.executeCommand(msg.command);
          for (const cb of this.snapshotListeners) cb(this.localWorld.getRenderSnapshot());
          break;
        }

        case "pause": {
          this.localScheduler.setPaused(true);
          if (this.localTimer) clearInterval(this.localTimer);
          for (const cb of this.performanceListeners) cb(this.localScheduler.getStats());
          break;
        }

        case "resume": {
          this.localScheduler.setPaused(false);
          for (const cb of this.performanceListeners) cb(this.localScheduler.getStats());
          break;
        }

        case "step_once": {
          if (!this.localWorld) throw new Error("World not initialized");
          this.localScheduler.stepOnce();
          this.localWorld.step(this.localScheduler.dt);
          for (const cb of this.snapshotListeners) cb(this.localWorld.getRenderSnapshot());
          for (const cb of this.performanceListeners) cb(this.localScheduler.getStats());
          break;
        }

        case "set_time_multiplier": {
          this.localScheduler.setTimeMultiplier(msg.multiplier);
          for (const cb of this.performanceListeners) cb(this.localScheduler.getStats());
          break;
        }

        case "set_dt": {
          this.localScheduler.setDt(msg.dtSeconds);
          if (this.localWorld) this.localWorld.setDt(msg.dtSeconds);
          for (const cb of this.performanceListeners) cb(this.localScheduler.getStats());
          break;
        }

        case "set_quality": {
          this.localScheduler.setQuality(msg.quality);
          if (this.localWorld) this.localWorld.setDt(this.localScheduler.dt);
          for (const cb of this.performanceListeners) cb(this.localScheduler.getStats());
          break;
        }

        case "set_relativity": {
          if (this.localWorld) this.localWorld.enableRelativity = msg.enabled;
          break;
        }

        case "request_snapshot": {
          if (!this.localWorld) throw new Error("World not initialized");
          for (const cb of this.snapshotListeners) cb(this.localWorld.getRenderSnapshot());
          break;
        }

        case "request_trajectory": {
          if (!this.localWorld) throw new Error("World not initialized");
          const traj = this.localWorld.predictTrajectory(msg.bodyId, { steps: msg.steps, dt: msg.dt });
          for (const cb of this.trajectoryListeners) cb(msg.bodyId, traj);
          break;
        }

        case "request_checkpoint": {
          if (!this.localWorld) throw new Error("World not initialized");
          const cp = this.localWorld.getSnapshot();
          const resolver = this.checkpointResolvers.shift();
          if (resolver) resolver(cp);
          break;
        }

        case "load_checkpoint": {
          if (!this.localWorld) this.localWorld = new SimulationWorld();
          this.localWorld.restoreSnapshot(msg.snapshot);
          this.localScheduler.reset(msg.snapshot.simTimeSeconds, msg.snapshot.tick);
          for (const cb of this.snapshotListeners) cb(this.localWorld.getRenderSnapshot());
          break;
        }

        case "reset_to_initial": {
          if (!this.localWorld) throw new Error("World not initialized");
          this.localWorld.executeCommand({ type: "reset_to_initial" });
          this.localScheduler.reset();
          for (const cb of this.snapshotListeners) cb(this.localWorld.getRenderSnapshot());
          break;
        }
      }
    } catch (err: any) {
      for (const cb of this.errorListeners) cb(err.message ?? String(err));
    }
  }

  // Public client API
  init(bodies: SimulationBody[], dtSeconds = 900) {
    this.post({ type: "init", bodies, dtSeconds });
  }

  initialize(bodies: SimulationBody[], dtSeconds = 900, _simTimeSeconds?: number, _tick?: number) {
    this.init(bodies, dtSeconds);
  }

  sendCommand(command: SimulationCommand) {
    this.post({ type: "command", command });
  }

  executeCommand(command: SimulationCommand) {
    this.sendCommand(command);
  }

  pause() {
    this.post({ type: "pause" });
  }

  resume() {
    this.post({ type: "resume" });
  }

  stepOnce() {
    this.post({ type: "step_once" });
  }

  setTimeMultiplier(multiplier: number) {
    this.post({ type: "set_time_multiplier", multiplier });
  }

  setQuality(quality: TimestepQuality) {
    this.post({ type: "set_quality", quality });
  }

  setDt(dtSeconds: number) {
    this.post({ type: "set_dt", dtSeconds });
  }

  setRelativity(enabled: boolean) {
    this.post({ type: "set_relativity", enabled });
  }

  requestSnapshot() {
    this.post({ type: "request_snapshot" });
  }

  requestTrajectory(bodyId: string, steps = 512, dt?: number) {
    this.post({ type: "request_trajectory", bodyId, steps, dt });
  }

  requestCheckpoint(): Promise<WorldSnapshot> {
    return new Promise<WorldSnapshot>((resolve) => {
      this.checkpointResolvers.push(resolve);
      this.post({ type: "request_checkpoint" });
    });
  }

  loadCheckpoint(snapshot: WorldSnapshot) {
    this.post({ type: "load_checkpoint", snapshot });
  }

  resetToInitial() {
    this.post({ type: "reset_to_initial" });
  }

  // Subscriptions
  onSnapshot(cb: (snap: RenderSnapshot) => void): () => void {
    this.snapshotListeners.push(cb);
    return () => {
      this.snapshotListeners = this.snapshotListeners.filter((l) => l !== cb);
    };
  }

  onEvent(cb: (evt: SimulationEvent) => void): () => void {
    this.eventListeners.push(cb);
    return () => {
      this.eventListeners = this.eventListeners.filter((l) => l !== cb);
    };
  }

  onTrajectory(cb: (bodyId: string, points: [number, number, number][]) => void): () => void {
    this.trajectoryListeners.push(cb);
    return () => {
      this.trajectoryListeners = this.trajectoryListeners.filter((l) => l !== cb);
    };
  }

  onPerformance(cb: (stats: TimestepStats) => void): () => void {
    this.performanceListeners.push(cb);
    return () => {
      this.performanceListeners = this.performanceListeners.filter((l) => l !== cb);
    };
  }

  onReady(cb: () => void): () => void {
    this.readyListeners.push(cb);
    return () => {
      this.readyListeners = this.readyListeners.filter((l) => l !== cb);
    };
  }

  onError(cb: (err: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => {
      this.errorListeners = this.errorListeners.filter((l) => l !== cb);
    };
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this.localTimer) {
      clearInterval(this.localTimer);
      this.localTimer = null;
    }
  }
}
