import type { SimulationBody } from "../domain/types.ts";
import type { SimulationCommand, LoggedCommand } from "../engine/commands.ts";
import type { SimulationEvent } from "../engine/events.ts";
import type { RenderSnapshot, SimulationCheckpoint, WorldSnapshot } from "../engine/snapshot.ts";
import type { PlaybackState, TimestepQuality, TimestepStats } from "../engine/timestep.ts";
import type { WorkerInboundMessage, WorkerOutboundMessage } from "./protocol.ts";
import { SimulationHost } from "./simulation-host.ts";

export const CLIENT_REQUEST_TIMEOUT_MS = 20000;

interface PendingRequest<T> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class WorkerClient {
  private worker: Worker | null = null;
  private isFallbackMode = false;

  /**
   * In-process host used when `Worker` is unavailable (Node tests, SSR) or when
   * worker construction fails. It is the SAME SimulationHost the browser worker
   * runs, so fallback semantics cannot diverge from browser semantics.
   */
  private host: SimulationHost | null = null;

  private snapshotListeners: ((snap: RenderSnapshot) => void)[] = [];
  private eventListeners: ((event: SimulationEvent) => void)[] = [];
  private trajectoryListeners: ((bodyId: string, points: [number, number, number][]) => void)[] = [];
  private performanceListeners: ((stats: TimestepStats) => void)[] = [];
  private readyListeners: (() => void)[] = [];
  private errorListeners: ((err: string, code?: string) => void)[] = [];
  private worldChangedListeners: ((bodies: SimulationBody[], removedIds: string[], reason: string) => void)[] = [];
  private playbackStateListeners: ((state: PlaybackState) => void)[] = [];
  private haltListeners: ((reason: string, lastGoodTick: number) => void)[] = [];

  private requestTimeoutMs: number = CLIENT_REQUEST_TIMEOUT_MS;
  private checkpointRequests: PendingRequest<SimulationCheckpoint>[] = [];
  private commandLogRequests: PendingRequest<{
    commandLog: LoggedCommand[];
    initialState: WorldSnapshot;
  }>[] = [];

  constructor(options?: { requestTimeoutMs?: number }) {
    if (options?.requestTimeoutMs !== undefined) {
      this.requestTimeoutMs = options.requestTimeoutMs;
    }
    if (typeof Worker !== "undefined") {
      try {
        this.worker = new Worker(new URL("./physics.worker.ts", import.meta.url), {
          type: "module",
        });

        this.worker.onmessage = (e: MessageEvent<WorkerOutboundMessage>) => {
          this.handleWorkerMessage(e.data);
        };

        this.worker.onerror = (err) => {
          this.emitError(err.message ?? "Worker error", "WORKER_ERROR");
        };
      } catch (err) {
        this.initFallback(err instanceof Error ? err.message : String(err));
      }
    } else {
      this.initFallback("Worker unavailable in this environment");
    }
  }

  /** True when running the in-process host instead of a real Web Worker. */
  get fallbackMode(): boolean {
    return this.isFallbackMode;
  }

  private initFallback(reason: string) {
    this.isFallbackMode = true;
    this.host = new SimulationHost({
      emit: (msg) => this.handleWorkerMessage(msg),
    });
    void reason;
  }

  private handleWorkerMessage(msg: WorkerOutboundMessage) {
    if (!msg || typeof msg !== "object") return;

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
      case "playback_state":
        for (const cb of this.playbackStateListeners) cb(msg.state);
        break;
      case "world_changed":
        for (const cb of this.worldChangedListeners) cb(msg.bodies, msg.removedIds, msg.reason);
        break;
      case "checkpoint": {
        const pending = this.checkpointRequests.shift();
        if (pending) {
          clearTimeout(pending.timer);
          pending.resolve(msg.checkpoint);
        }
        break;
      }
      case "command_log": {
        const pending = this.commandLogRequests.shift();
        if (pending) {
          clearTimeout(pending.timer);
          pending.resolve({ commandLog: msg.commandLog, initialState: msg.initialState });
        }
        break;
      }
      case "error":
        this.emitError(msg.error, msg.code);
        break;
      case "simulation_halted": {
        this.rejectAllPending(`Simulation halted: ${msg.reason}`);
        for (const cb of this.haltListeners) cb(msg.reason, msg.lastGoodTick);
        break;
      }
    }
  }

  private emitError(error: string, code?: string) {
    for (const cb of this.errorListeners) cb(error, code);
  }

  private rejectAllPending(reason: string) {
    for (const pending of this.checkpointRequests.splice(0)) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
    for (const pending of this.commandLogRequests.splice(0)) {
      clearTimeout(pending.timer);
      pending.reject(new Error(reason));
    }
  }

  private post(msg: WorkerInboundMessage) {
    if (this.worker && !this.isFallbackMode) {
      this.worker.postMessage(msg);
      return;
    }
    this.host?.handleMessage(msg);
  }

  private request<T>(
    queue: PendingRequest<T>[],
    message: WorkerInboundMessage,
    timeoutMs = this.requestTimeoutMs
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        const index = queue.findIndex((entry) => entry.timer === timer);
        if (index >= 0) queue.splice(index, 1);
        reject(new Error(`Worker request timed out after ${timeoutMs} ms: ${message.type}`));
      }, timeoutMs);
      queue.push({ resolve, reject, timer });
      this.post(message);
    });
  }

  // Public client API
  init(bodies: SimulationBody[], dtSeconds = 900) {
    this.post({ type: "init", bodies, dtSeconds });
  }

  initialize(
    bodies: SimulationBody[],
    dtSeconds = 900,
    simTimeSeconds?: number,
    tick?: number,
    enableRelativity?: boolean
  ) {
    this.post({ type: "init", bodies, dtSeconds, simTimeSeconds, tick, enableRelativity });
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

  requestCheckpoint(): Promise<SimulationCheckpoint> {
    return this.request(this.checkpointRequests, { type: "request_checkpoint" });
  }

  requestCommandLog(): Promise<{ commandLog: LoggedCommand[]; initialState: WorldSnapshot }> {
    return this.request(this.commandLogRequests, { type: "request_command_log" });
  }

  /**
   * Fetches everything needed to persist a truthful scenario document: the
   * authoritative command chronology, the session origin, and a complete
   * restartable checkpoint.
   */
  async requestSession(): Promise<{
    checkpoint: SimulationCheckpoint;
    commandLog: LoggedCommand[];
    initialState: WorldSnapshot;
  }> {
    const [checkpoint, log] = await Promise.all([this.requestCheckpoint(), this.requestCommandLog()]);
    return { checkpoint, commandLog: log.commandLog, initialState: log.initialState };
  }

  loadCheckpoint(checkpoint: SimulationCheckpoint) {
    this.post({ type: "load_checkpoint", checkpoint });
  }

  loadScenario(
    initialState: WorldSnapshot,
    commands: LoggedCommand[],
    finalState: { tick: number; simTimeSeconds: number }
  ) {
    this.post({ type: "load_scenario", initialState, commands, finalState });
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

  onError(cb: (err: string, code?: string) => void): () => void {
    this.errorListeners.push(cb);
    return () => {
      this.errorListeners = this.errorListeners.filter((l) => l !== cb);
    };
  }

  onWorldChanged(
    cb: (bodies: SimulationBody[], removedIds: string[], reason: string) => void
  ): () => void {
    this.worldChangedListeners.push(cb);
    return () => {
      this.worldChangedListeners = this.worldChangedListeners.filter((l) => l !== cb);
    };
  }

  onPlaybackState(cb: (state: PlaybackState) => void): () => void {
    this.playbackStateListeners.push(cb);
    return () => {
      this.playbackStateListeners = this.playbackStateListeners.filter((l) => l !== cb);
    };
  }

  onHalt(cb: (reason: string, lastGoodTick: number) => void): () => void {
    this.haltListeners.push(cb);
    return () => {
      this.haltListeners = this.haltListeners.filter((l) => l !== cb);
    };
  }

  terminate() {
    this.rejectAllPending("Worker client terminated");
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.host?.dispose();
    this.host = null;
  }
}
