import { describe, it, expect } from 'vitest';
import { PRNG } from '../src/core/prng';

describe('PRNG Determinism', () => {
  it('generates identical sequences for identical seeds', () => {
    const prngA = new PRNG(4242);
    const prngB = new PRNG(4242);

    for (let i = 0; i < 100; i++) {
      expect(prngA.nextInt()).toBe(prngB.nextInt());
      expect(prngA.nextFloat()).toBe(prngB.nextFloat());
    }
  });

  it('generates different sequences for different seeds', () => {
    const prngA = new PRNG(1001);
    const prngB = new PRNG(2002);

    let matches = 0;
    for (let i = 0; i < 50; i++) {
      if (prngA.nextInt() === prngB.nextInt()) {
        matches++;
      }
    }
    expect(matches).toBeLessThan(3);
  });

  it('bounds rangeInt and rangeFloat correctly', () => {
    const prng = new PRNG(999);
    for (let i = 0; i < 200; i++) {
      const intVal = prng.rangeInt(3, 7);
      expect(intVal).toBeGreaterThanOrEqual(3);
      expect(intVal).toBeLessThanOrEqual(7);

      const floatVal = prng.rangeFloat(10.5, 20.5);
      expect(floatVal).toBeGreaterThanOrEqual(10.5);
      expect(floatVal).toBeLessThan(20.5);
    }
  });
});

