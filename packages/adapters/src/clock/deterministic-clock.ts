/**
 * Seedable pseudo-random number generator (mulberry32).
 * Used during replay mode to produce deterministic telemetry jitter.
 */
export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Returns a float in [0, 1). */
  next(): number {
    this.state += 0x6d2b79f5;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  }

  /** Returns an integer in [min, max]. */
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Returns a float in [min, max). */
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
}

/**
 * Deterministic clock for replay mode.
 * Advances by `tickMs` each call to `now()` starting from `epochMs`.
 */
export class DeterministicClock {
  private currentMs: number;

  constructor(
    epochMs: number,
    private readonly tickMs: number = 1_000,
  ) {
    this.currentMs = epochMs;
  }

  now(): Date {
    const ts = new Date(this.currentMs);
    this.currentMs += this.tickMs;
    return ts;
  }

  peek(): Date {
    return new Date(this.currentMs);
  }

  advance(ms: number): void {
    this.currentMs += ms;
  }
}

/** Wall-clock implementation for live mode. */
export function wallClockNow(): Date {
  return new Date();
}
