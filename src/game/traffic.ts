import { TRAFFIC, ROAD } from '../core/constants';

export type TrafficType = 'sedan' | 'sport' | 'truck';

export interface TrafficCar {
  id: number;
  active: boolean;
  type: TrafficType;
  lane: number;
  x: number;
  startX: number;
  targetX: number;
  z: number;
  speed: number;
  baseSpeed: number;
  color: string;
  width: number;
  length: number;

  // Telegraphing & behaviors
  isBraking: boolean;
  indicator: 'none' | 'left' | 'right';
  indicatorTimer: number;
  indicatorFlash: boolean;
  laneChangeCountdown: number;
  isChangingLane: boolean;
  laneChangeElapsed: number;
  laneChangeDuration: number;

  // Near-miss tracking
  nearMissAwarded: boolean;
  hazardDetectedTime: number; // for reaction time tracking
}

let nextCarId = 1;

export function createTrafficCar(): TrafficCar {
  return {
    id: nextCarId++,
    active: false,
    type: 'sedan',
    lane: 0,
    x: 0,
    startX: 0,
    targetX: 0,
    z: 0,
    speed: 6000,
    baseSpeed: 6000,
    color: '#00e5ff',
    width: TRAFFIC.HITBOX_WIDTH,
    length: TRAFFIC.HITBOX_LENGTH,
    isBraking: false,
    indicator: 'none',
    indicatorTimer: 0,
    indicatorFlash: false,
    laneChangeCountdown: 0,
    isChangingLane: false,
    laneChangeElapsed: 0,
    laneChangeDuration: 1.1,
    nearMissAwarded: false,
    hazardDetectedTime: 0,
  };
}

export function resetTrafficCar(car: TrafficCar): void {
  car.active = false;
  car.type = 'sedan';
  car.lane = 0;
  car.x = 0;
  car.startX = 0;
  car.targetX = 0;
  car.z = 0;
  car.speed = 6000;
  car.baseSpeed = 6000;
  car.color = '#00e5ff';
  car.width = TRAFFIC.HITBOX_WIDTH;
  car.length = TRAFFIC.HITBOX_LENGTH;
  car.isBraking = false;
  car.indicator = 'none';
  car.indicatorTimer = 0;
  car.indicatorFlash = false;
  car.laneChangeCountdown = 0;
  car.isChangingLane = false;
  car.laneChangeElapsed = 0;
  car.laneChangeDuration = 1.1;
  car.nearMissAwarded = false;
  car.hazardDetectedTime = 0;
}

export function updateTrafficCar(car: TrafficCar, dt: number): void {
  if (!car.active) return;

  // 1. Move forward along road
  car.z += car.speed * dt;

  // 2. Handle turn indicator blinking (4 Hz blink)
  if (car.indicator !== 'none') {
    car.indicatorTimer += dt;
    car.indicatorFlash = Math.floor(car.indicatorTimer * 8) % 2 === 0;

    if (car.laneChangeCountdown > 0) {
      car.laneChangeCountdown -= dt;
      if (car.laneChangeCountdown <= 0) {
        // Start smooth lateral transition
        car.isChangingLane = true;
        car.startX = car.x;
        car.targetX = ROAD.LANE_POSITIONS[car.lane];
        car.laneChangeElapsed = 0;
      }
    }
  }

  // 3. Silky smooth Ease-in-Out lateral transition
  if (car.isChangingLane) {
    car.laneChangeElapsed += dt;
    const progress = Math.min(1.0, car.laneChangeElapsed / car.laneChangeDuration);
    // Standard cosine ease-in-out curve: (1 - cos(pi * t)) / 2
    const ease = (1 - Math.cos(progress * Math.PI)) / 2;
    car.x = car.startX + (car.targetX - car.startX) * ease;

    if (progress >= 1.0) {
      car.x = car.targetX;
      car.isChangingLane = false;
      car.indicator = 'none';
      car.indicatorFlash = false;
    }
  }
}

