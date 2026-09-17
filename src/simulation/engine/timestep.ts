

export class TimestepScheduler {
  private dtSeconds: number = 3600;
  private timeMultiplier: number = 1;
  private accumulatedRealTime: number = 0;
  private isPaused: boolean = false;
  private currentTick: number = 0;

  constructor(dtSeconds: number = 3600) {
    this.dtSeconds = dtSeconds;
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  setTimeMultiplier(m: number) {
    this.timeMultiplier = m;
  }

  // Returns number of fixed simulation steps to run based on real delta time
  advanceRealTime(deltaMs: number): number {
    if (this.isPaused) return 0;
    
    // deltaMs is real time elapsed, we multiply by time multiplier
    // representing simulation time elapsed
    const simTimeMs = deltaMs * this.timeMultiplier;
    this.accumulatedRealTime += simTimeMs;
    
    const dtMs = this.dtSeconds * 1000;
    const steps = Math.floor(this.accumulatedRealTime / dtMs);
    this.accumulatedRealTime -= steps * dtMs;
    
    return steps;
  }

  stepOnce() {
    this.currentTick++;
  }

  get dt() {
    return this.dtSeconds;
  }
}
