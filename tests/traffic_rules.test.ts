import { describe, it, expect, beforeEach } from 'vitest';
import { TrafficCar, createTrafficCar, updateTrafficSystem } from '../src/game/traffic';
import { ROAD } from '../src/core/constants';

describe('Intelligent Traffic AI & Highway Road Rules', () => {
  let fastCar: TrafficCar;
  let slowCar: TrafficCar;

  beforeEach(() => {
    fastCar = createTrafficCar();
    fastCar.id = 1;
    fastCar.active = true;
    fastCar.lane = 1;
    fastCar.x = ROAD.LANE_POSITIONS[1];
    fastCar.z = 1000;
    fastCar.speed = 8500;
    fastCar.baseSpeed = 8500;

    slowCar = createTrafficCar();
    slowCar.id = 2;
    slowCar.active = true;
    slowCar.lane = 1;
    slowCar.x = ROAD.LANE_POSITIONS[1];
    slowCar.z = 1800; // 800 units ahead in same lane
    slowCar.speed = 5000;
    slowCar.baseSpeed = 5000;
  });

  it('brakes and decelerates behind a slower car instead of ghosting through it', () => {
    const player = { x: 0.75, z: 5000, speed: 10000, isCrashed: false };

    // Update for 0.5 seconds
    for (let i = 0; i < 30; i++) {
      updateTrafficSystem([fastCar, slowCar], player, 1 / 60);
    }

    // Fast car should have engaged brakes and slowed down
    expect(fastCar.isBraking).toBe(true);
    expect(fastCar.speed).toBeLessThan(8500);
    // Fast car must still be behind the slow car (not surpassed or ghosted through)
    expect(fastCar.z).toBeLessThan(slowCar.z);
  });

  it('indicates and smoothly changes lane to overtake when an adjacent lane is clear', () => {
    const player = { x: 0.75, z: 5000, speed: 10000, isCrashed: false };

    // Update for 1.2 seconds: enough time to detect obstacle, signal indicator, and begin lane change
    for (let i = 0; i < 75; i++) {
      updateTrafficSystem([fastCar, slowCar], player, 1 / 60);
    }

    // Fast car should have initiated turn signal or lane change
    expect(fastCar.indicator !== 'none' || fastCar.isChangingLane).toBe(true);
  });

  it('brakes behind player when player is in front and driving slow', () => {
    // Player is in front of fast car in same lane, driving slow
    const slowPlayer = { x: fastCar.x, z: fastCar.z + 600, speed: 3000, isCrashed: false };

    for (let i = 0; i < 30; i++) {
      slowPlayer.z += slowPlayer.speed * (1 / 60);
      updateTrafficSystem([fastCar], slowPlayer, 1 / 60);
    }

    // Fast car should detect player ahead, apply brakes, and slow down
    expect(fastCar.isBraking).toBe(true);
    expect(fastCar.speed).toBeLessThan(8500);
    // Fast car must remain behind the player
    expect(fastCar.z).toBeLessThan(slowPlayer.z);
  });
});
