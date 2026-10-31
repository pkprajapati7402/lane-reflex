import { describe, it, expect } from 'vitest';
import { TrafficSpawner } from '../src/game/spawner';
import { PRNG } from '../src/core/prng';
import { ObjectPool } from '../src/core/pool';
import { TrafficCar, createTrafficCar, resetTrafficCar } from '../src/game/traffic';
import { ROAD } from '../src/core/constants';

describe('Traffic Spawner & Guaranteed Escape Routes', () => {
  it('guarantees at least one open lane in single-gap walls across 100 seeds', () => {
    const prng = new PRNG(777);
    const pool = new ObjectPool<TrafficCar>(createTrafficCar, 32, resetTrafficCar);
    const spawner = new TrafficSpawner(prng, pool);

    for (let i = 0; i < 100; i++) {
      pool.clear();
      const wave = spawner.spawnSingleGapWall(10000 + i * 5000);

      // Verify wave has open lane
      expect(wave.openLanes.length).toBeGreaterThanOrEqual(1);
      const openLane = wave.openLanes[0];
      expect(openLane).toBeGreaterThanOrEqual(0);
      expect(openLane).toBeLessThan(ROAD.LANES);

      // Verify no spawned cars in open lane
      const activeCars = pool.activeItems;
      for (const car of activeCars) {
        expect(car.lane).not.toBe(openLane);
      }
    }
  });

  it('generates deterministic traffic given identical seeds', () => {
    const prngA = new PRNG(12345);
    const poolA = new ObjectPool<TrafficCar>(createTrafficCar, 32, resetTrafficCar);
    const spawnerA = new TrafficSpawner(prngA, poolA);

    const prngB = new PRNG(12345);
    const poolB = new ObjectPool<TrafficCar>(createTrafficCar, 32, resetTrafficCar);
    const spawnerB = new TrafficSpawner(prngB, poolB);

    spawnerA.update(0, 10000);
    spawnerB.update(0, 10000);

    expect(poolA.count).toBe(poolB.count);
    for (let i = 0; i < poolA.count; i++) {
      const carA = poolA.get(i);
      const carB = poolB.get(i);
      expect(carA.lane).toBe(carB.lane);
      expect(carA.z).toBeCloseTo(carB.z, 0.001);
      expect(carA.speed).toBeCloseTo(carB.speed, 0.001);
      expect(carA.color).toBe(carB.color);
    }
  });
});

