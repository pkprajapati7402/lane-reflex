import { describe, it, expect, beforeEach } from 'vitest';
import { CollisionSystem } from '../src/game/collision';
import { Player } from '../src/game/player';
import { TrafficCar, createTrafficCar } from '../src/game/traffic';
import { PLAYER } from '../src/core/constants';

describe('Collision & Near-Miss System', () => {
  let collision: CollisionSystem;
  let player: Player;
  let car: TrafficCar;

  beforeEach(() => {
    collision = new CollisionSystem();
    player = new Player();
    car = createTrafficCar();
    car.active = true;
  });

  it('detects head-on / rear-end crash when overlapping within forgiving hitbox', () => {
    player.x = 0;
    player.z = 1000;
    player.speed = 10000;

    car.x = 0;
    car.z = 1000;
    car.speed = 5000;

    const result = collision.checkCollisions(player, [car]);
    expect(result.hasCrashed).toBe(true);
    expect(result.crashedWithCarId).toBe(car.id);
  });

  it('respects forgiving hitbox margin (near edge does not cause phantom crash)', () => {
    player.x = 0;
    player.z = 1000;
    player.speed = 10000;

    // Place car just outside forgiving threshold (0.126) but inside 100% visual bounding box (0.18)
    const visualHalfWidth = (PLAYER.HITBOX_WIDTH + car.width) / 2; // 0.18
    const forgivingHalfWidth = visualHalfWidth * PLAYER.FORGIVING_RATIO; // 0.126

    // Position laterally at 0.15 (outside 0.126 but inside 0.18)
    car.x = 0.15;
    car.z = 1000;
    car.speed = 5000;

    const result = collision.checkCollisions(player, [car]);
    expect(result.hasCrashed).toBe(false);
  });

  it('awards near-miss when shaving close at higher speed', () => {
    player.x = 0;
    player.z = 1050; // alongside car
    player.speed = 11000; // moving faster than car

    car.x = 0.32; // close lateral shave
    car.z = 1000;
    car.speed = 6000;

    const result = collision.checkCollisions(player, [car]);
    expect(result.hasCrashed).toBe(false);
    expect(result.nearMisses.length).toBe(1);
    expect(result.nearMisses[0].carId).toBe(car.id);
    expect(car.nearMissAwarded).toBe(true);

    // Second check does not award again for same car pass
    const secondResult = collision.checkCollisions(player, [car]);
    expect(secondResult.nearMisses.length).toBe(0);
  });

  it('does NOT award near-miss if player is moving slower than traffic', () => {
    player.x = 0;
    player.z = 1050;
    player.speed = 5000; // slower

    car.x = 0.32;
    car.z = 1000;
    car.speed = 8000; // faster traffic overtaking player

    const result = collision.checkCollisions(player, [car]);
    expect(result.hasCrashed).toBe(false);
    expect(result.nearMisses.length).toBe(0);
  });
});

