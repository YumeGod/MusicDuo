export const clamp = (v: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export class EMA {
  private previous?: number;
  constructor(
    private alpha = 0.2,
    private deadZone = 0.006,
  ) {}
  next(value: number) {
    if (this.previous === undefined) this.previous = value;
    else if (Math.abs(value - this.previous) > this.deadZone)
      this.previous = lerp(this.previous, value, this.alpha);
    return this.previous;
  }
}
export class Dwell {
  private since?: number;
  update(condition: boolean, now: number, duration: number) {
    if (!condition) {
      this.since = undefined;
      return false;
    }
    this.since ??= now;
    return now - this.since >= duration;
  }
  reset() {
    this.since = undefined;
  }
}
