/**
 * Time management class with fixed timestep accumulator for deterministic physics
 * and variable delta time for rendering and animations.
 */
export class Time {
  public delta: number = 0;
  public elapsed: number = 0;
  public readonly fixedDelta: number = 1 / 60; // 60Hz physics step
  public accumulator: number = 0;

  private lastTime: number = 0;
  private readonly maxSubSteps: number = 5;
  private remainingSubSteps: number = 5;

  constructor() {
    this.lastTime = performance.now();
  }

  /**
   * Advances frame delta. Only accumulates physics time when `accumulatePhysics` is true
   * (prevents physics burst when unpausing or returning from menus).
   */
  public update(accumulatePhysics: boolean = true): void {
    const now = performance.now();
    // Cap delta at 100ms to avoid spiral of death when window loses focus
    this.delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (accumulatePhysics) {
      this.elapsed += this.delta;
      this.accumulator += this.delta;
    }
  }

  public resetSubSteps(): void {
    this.remainingSubSteps = this.maxSubSteps;
  }

  public shouldDoPhysicsStep(): boolean {
    if (this.accumulator >= this.fixedDelta && this.remainingSubSteps > 0) {
      this.accumulator -= this.fixedDelta;
      this.remainingSubSteps--;
      return true;
    }
    return false;
  }

  public resetAccumulator(): void {
    this.accumulator = 0;
    this.lastTime = performance.now();
  }
}
