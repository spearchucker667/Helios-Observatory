export type TimestepQuality = "fast" | "standard" | "high";

export const QUALITY_DT: Record<TimestepQuality, number> = {
  fast: 3600, // 1 hour steps
  standard: 900, // 15 minute steps
  high: 120, // 2 minute steps
};

/**
 * Authoritative playback state machine.
 *
 * The worker (see physics.worker.ts) owns this state; the UI must only ever
 * *reflect* it. Zustand is not permitted to invent playback state of its own.
 */
export type PlaybackState =
  | "uninitialized"
  | "paused"
  | "running"
  | "stepping"
  | "halted"
  | "replaying";

export interface TimestepStats {
  dtSeconds: number;
  timeMultiplier: number;
  requestedRateDaysPerSec: number;
  achievedRateDaysPerSec: number;
  isComputeLimited: boolean;
  quality: TimestepQuality;
  /** Authoritative worker playback state. */
  state: PlaybackState;
  /** Derived convenience flag: state === "paused" */
  isPaused: boolean;
  currentTick: number;
  simTimeSeconds: number;
}

export const MAX_TIME_MULTIPLIER = 86400 * 365;
export const MIN_TIME_MULTIPLIER = 0;
export const MIN_DT_SECONDS = 0.001;
export const MAX_DT_SECONDS = 86400 * 365;

/** True only for values usable as simulation inputs (rejects NaN and ±Infinity). */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Plans fixed-size work budgets for the physics loop.
 *
 * IMPORTANT: this class deliberately does NOT advance its own tick/simulated
 * time. `SimulationWorld` is the single clock authority; after each executed
 * step the worker calls `syncClock(world.tick, world.simTime)`. That removes
 * the class of bug where the scheduler raced ahead of the world because a
 * world step threw part-way through a batch.
 */
export class TimestepScheduler {
  private dtSeconds: number = 900;
  private timeMultiplier: number = 86400; // 1 day per real second by default
  private accumulatedSimSeconds: number = 0;
  private state: PlaybackState = "uninitialized";
  private currentTick: number = 0;
  private simTimeSeconds: number = 0;
  private quality: TimestepQuality = "standard";

  private maxStepsPerUpdate: number = 500;
  private lastAchievedRate: number = 0;
  private isComputeLimited: boolean = false;

  constructor(dtSeconds = 900, quality: TimestepQuality = "standard") {
    this.dtSeconds = dtSeconds;
    this.quality = quality;
  }

  /** Sets the playback state directly (used by the worker state machine). */
  setState(state: PlaybackState): void {
    this.state = state;
    if (state !== "running") {
      this.isComputeLimited = false;
      this.lastAchievedRate = 0;
    }
  }

  getState(): PlaybackState {
    return this.state;
  }

  /** True while the loop is allowed to execute automatic physics steps. */
  get isAdvancing(): boolean {
    return this.state === "running";
  }

  /**
   * @returns true when the multiplier was accepted. Non-finite or negative
   * values are rejected outright — `Math.max(0, NaN)` is NaN, which would
   * silently poison the scheduling state.
   */
  setTimeMultiplier(multiplier: number): boolean {
    if (!isFiniteNumber(multiplier) || multiplier < MIN_TIME_MULTIPLIER) return false;
    this.timeMultiplier = multiplier;
    return true;
  }

  /** @returns true when the timestep was accepted (finite and > 0). */
  setDt(dtSeconds: number): boolean {
    if (!isFiniteNumber(dtSeconds) || dtSeconds < MIN_DT_SECONDS || dtSeconds > MAX_DT_SECONDS) {
      return false;
    }
    this.dtSeconds = dtSeconds;
    return true;
  }

  setQuality(quality: TimestepQuality): boolean {
    if (!(quality in QUALITY_DT)) return false;
    this.quality = quality;
    this.dtSeconds = QUALITY_DT[quality];
    return true;
  }

  /**
   * Computes how many fixed dt steps should be executed for an elapsed real
   * interval. Commits NOTHING: no tick, no simulated time.
   *
   * @param deltaRealSeconds Real elapsed seconds since last update
   * @returns Number of fixed dt steps to run
   */
  planSteps(deltaRealSeconds: number): number {
    if (!isFiniteNumber(deltaRealSeconds) || deltaRealSeconds <= 0) {
      this.lastAchievedRate = 0;
      return 0;
    }

    if (!this.isAdvancing) {
      this.lastAchievedRate = 0;
      return 0;
    }

    const requestedSimSeconds = deltaRealSeconds * this.timeMultiplier;
    if (!isFiniteNumber(requestedSimSeconds)) {
      // Overflow guard: reject rather than propagate Infinity into the clock.
      this.isComputeLimited = true;
      this.accumulatedSimSeconds = 0;
      return 0;
    }

    this.accumulatedSimSeconds += requestedSimSeconds;

    let steps = Math.floor(this.accumulatedSimSeconds / this.dtSeconds);

    if (steps > this.maxStepsPerUpdate) {
      this.isComputeLimited = true;
      steps = this.maxStepsPerUpdate;
      // Drop excess accumulator so we don't build an unbounded lag backlog
      this.accumulatedSimSeconds = 0;
    } else {
      this.isComputeLimited = false;
      this.accumulatedSimSeconds -= steps * this.dtSeconds;
    }

    const achievedSimSeconds = steps * this.dtSeconds;
    this.lastAchievedRate = (achievedSimSeconds / 86400) / deltaRealSeconds;

    return steps;
  }

  /**
   * Mirrors the authoritative world clock. This is the ONLY place scheduler
   * tick/time move.
   */
  syncClock(tick: number, simTimeSeconds: number): void {
    if (!isFiniteNumber(tick) || !isFiniteNumber(simTimeSeconds)) return;
    this.currentTick = tick;
    this.simTimeSeconds = simTimeSeconds;
  }

  reset(simTimeSeconds = 0, tick = 0): void {
    this.simTimeSeconds = simTimeSeconds;
    this.currentTick = tick;
    this.accumulatedSimSeconds = 0;
    this.isComputeLimited = false;
    this.lastAchievedRate = 0;
  }

  getStats(): TimestepStats {
    return {
      dtSeconds: this.dtSeconds,
      timeMultiplier: this.timeMultiplier,
      requestedRateDaysPerSec: this.timeMultiplier / 86400,
      achievedRateDaysPerSec: this.lastAchievedRate,
      isComputeLimited: this.isComputeLimited,
      quality: this.quality,
      state: this.state,
      isPaused: this.state !== "running",
      currentTick: this.currentTick,
      simTimeSeconds: this.simTimeSeconds,
    };
  }

  get dt(): number {
    return this.dtSeconds;
  }

  get tick(): number {
    return this.currentTick;
  }

  get time(): number {
    return this.simTimeSeconds;
  }

  get timeMultiplierValue(): number {
    return this.timeMultiplier;
  }

  get qualityValue(): TimestepQuality {
    return this.quality;
  }
}
