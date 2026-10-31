/**
 * Frame delta & elapsed game clock manager.
 * Caps frame delta to prevent integration jumps on tab blur and pauses cleanly in menus.
 */
export class Time {
  public delta: number = 0;
  public elapsed: number = 0;

  private lastTime: number = 0;

  constructor() {
    this.lastTime = performance.now();
  }

  /**
   * Advances frame delta. Only advances elapsed match time when `active` is true.
   */
  public update(active: boolean = true): void {
    const now = performance.now();
    // Cap delta at 100ms to avoid large spatial jumps when window loses focus
    this.delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    if (active) {
      this.elapsed += this.delta;
    }
  }

  public reset(): void {
    this.delta = 0;
    this.lastTime = performance.now();
  }
}
