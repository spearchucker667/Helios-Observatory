export type TimestepQuality = "fast" | "standard" | "high";

export const QUALITY_DT: Record<TimestepQuality, number> = {
  fast: 3600, // 1 hour steps
  standard: 900, // 15 minute steps
  high: 120, // 2 minute steps
};

export interface TimestepStats {
  dtSeconds: number;
  timeMultiplier: number;
  requestedRateDaysPerSec: number;
  achievedRateDaysPerSec: number;
  isComputeLimited: boolean;
  quality: TimestepQuality;
  isPaused: boolean;
  currentTick: number;
  simTimeSeconds: number;
}

export class TimestepScheduler {
  private dtSeconds: number = 900;
  private timeMultiplier: number = 86400; // 1 day per real second by default
  private accumulatedSimSeconds: number = 0;
  private isPaused: boolean = true; // start paused
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

  setPaused(paused: boolean): void {
    this.isPaused = paused;
    if (paused) {
      // do not drop fractional time, but reset compute-limited flag
      this.isComputeLimited = false;
    }
  }

  togglePause(): boolean {
    this.setPaused(!this.isPaused);
    return this.isPaused;
  }

  setTimeMultiplier(multiplier: number): void {
    this.timeMultiplier = Math.max(0, multiplier);
  }

  setDt(dtSeconds: number): void {
    this.dtSeconds = Math.max(1, dtSeconds);
  }

  setQuality(quality: TimestepQuality): void {
    this.quality = quality;
    this.dtSeconds = QUALITY_DT[quality];
  }

  /**
   * Advances real wall-clock time and returns how many fixed substeps to execute.
   * @param deltaRealSeconds Real elapsed seconds since last update
   * @returns Number of fixed dt steps to run
   */
  advanceRealTime(deltaRealSeconds: number): number {
    if (this.isPaused || deltaRealSeconds <= 0) {
      this.lastAchievedRate = 0;
      this.isComputeLimited = false;
      return 0;
    }

    // Accumulate simulated seconds
    const requestedSimSeconds = deltaRealSeconds * this.timeMultiplier;
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
    this.lastAchievedRate = deltaRealSeconds > 0 ? (achievedSimSeconds / 86400) / deltaRealSeconds : 0;

    this.currentTick += steps;
    this.simTimeSeconds += achievedSimSeconds;

    return steps;
  }

  stepOnce(): void {
    this.currentTick++;
    this.simTimeSeconds += this.dtSeconds;
  }

  reset(simTimeSeconds = 0, tick = 0): void {
    this.simTimeSeconds = simTimeSeconds;
    this.currentTick = tick;
    this.accumulatedSimSeconds = 0;
    this.isComputeLimited = false;
  }

  getStats(): TimestepStats {
    return {
      dtSeconds: this.dtSeconds,
      timeMultiplier: this.timeMultiplier,
      requestedRateDaysPerSec: this.timeMultiplier / 86400,
      achievedRateDaysPerSec: this.lastAchievedRate,
      isComputeLimited: this.isComputeLimited,
      quality: this.quality,
      isPaused: this.isPaused,
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

  get paused(): boolean {
    return this.isPaused;
  }
}
