/**
 * Deterministic PRNG using Mulberry32 algorithm.
 * 32-bit state, fast, high quality for game simulation and seeded daily runs.
 */
export class PRNG {
  private state: number;

  constructor(seed: number = 1337) {
    this.state = seed >>> 0;
  }

  public setSeed(seed: number): void {
    this.state = seed >>> 0;
  }

  public getSeed(): number {
    return this.state;
  }

  /**
   * Returns a pseudo-random 32-bit unsigned integer.
   */
  public nextInt(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0);
  }

  /**
   * Returns a float in [0, 1).
   */
  public nextFloat(): number {
    return this.nextInt() / 4294967296;
  }

  /**
   * Returns a float in [min, max).
   */
  public rangeFloat(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  /**
   * Returns an integer in [min, max] inclusive.
   */
  public rangeInt(min: number, max: number): number {
    return Math.floor(this.rangeFloat(min, max + 1));
  }

  /**
   * Returns a random element from an array.
   */
  public choice<T>(array: T[]): T {
    const idx = Math.floor(this.nextFloat() * array.length);
    return array[idx];
  }
}

