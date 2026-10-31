import { TRAFFIC, ROAD } from '../core/constants';

export type TrafficType = 'sedan' | 'sport' | 'truck';

export interface TrafficCar {
  id: number;
  active: boolean;
  type: TrafficType;
  lane: number;
  targetLane: number;
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
  speedModulationTimer: number;

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
    targetLane: 0,
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
    speedModulationTimer: 0,
    nearMissAwarded: false,
    hazardDetectedTime: 0,
  };
}

export function resetTrafficCar(car: TrafficCar): void {
  car.active = false;
  car.type = 'sedan';
  car.lane = 0;
  car.targetLane = 0;
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
  car.speedModulationTimer = 0;
  car.nearMissAwarded = false;
  car.hazardDetectedTime = 0;
}

/**
 * Intelligent Highway Traffic AI System (Rules of the Road).
 *
 * Simulates real highway traffic behaviors:
 * 1. Radar Scanning: Each car monitors vehicles ahead (other traffic and player).
 * 2. Safe Following: Brakes smoothly and maintains a safety buffer if a slower car is ahead.
 * 3. Overtaking & Lane Changes: If stuck behind slower traffic, checks if adjacent lanes are clear,
 *    signals with blinking amber turn indicators for ~0.75s, then eases smoothly into the passing lane.
 * 4. Player Protection: Cars trailing behind the player detect the player, brake, and pass safely
 *    without ramming the player from behind.
 */
export function updateTrafficSystem(
  trafficCars: TrafficCar[],
  player: { x: number; z: number; speed: number; isCrashed: boolean },
  dt: number
): void {
  const activeCars = trafficCars.filter((c) => c.active);

  for (const car of activeCars) {
    // 1. Move car forward along road
    car.z += car.speed * dt;

    // 2. Scan ahead in current lane for obstacles (other traffic or player)
    let closestDist = Infinity;
    let leadSpeed = car.baseSpeed;
    let leadZ = Infinity;
    let leadX = car.x;
    let obstacleFound = false;

    // A. Check player ahead in same lane
    if (!player.isCrashed) {
      const pDeltaX = Math.abs(car.x - player.x);
      const pDeltaZ = player.z - car.z;
      // Player is ahead in same lane within 2400 units
      if (pDeltaZ > 0 && pDeltaZ < 2400 && pDeltaX < 0.32) {
        if (pDeltaZ < closestDist) {
          closestDist = pDeltaZ;
          leadSpeed = player.speed;
          leadZ = player.z;
          leadX = player.x;
          obstacleFound = true;
        }
      }
    }

    // B. Check other traffic cars ahead in same lane
    for (const other of activeCars) {
      if (other.id === car.id) continue;
      const otherDeltaX = Math.abs(car.x - other.x);
      const otherDeltaZ = other.z - car.z;
      // Other car is ahead in same lane within 2400 units
      if (otherDeltaZ > 0 && otherDeltaZ < 2400 && otherDeltaX < 0.32) {
        if (otherDeltaZ < closestDist) {
          closestDist = otherDeltaZ;
          leadSpeed = other.speed;
          leadZ = other.z;
          leadX = other.x;
          obstacleFound = true;
        }
      }
    }

    // 3. Safe Following & Braking Rules (Never Ram or Pass Ghosting!)
    const safeFollowDist = car.type === 'truck' ? 1500 : 1100;
    const minBuffer = car.type === 'truck' ? 280 : 220;

    if (obstacleFound && closestDist < safeFollowDist) {
      car.isBraking = true; // Brake lights on!

      // Newtonian braking deceleration to smoothly match lead vehicle without collision
      const deltaV = Math.max(0, car.speed - leadSpeed);
      const availableDistance = Math.max(30, closestDist - minBuffer);
      // a = (deltaV^2) / (2 * availableDistance) with sensible floor and ceiling
      const neededDecel = Math.max(3600, Math.min(14000, (deltaV * deltaV) / (2 * availableDistance)));

      car.speed = Math.max(0, car.speed - neededDecel * dt);

      // Clamp so following car NEVER penetrates or surpasses lead vehicle in same lane
      if (closestDist <= minBuffer && Math.abs(car.x - leadX) < 0.28) {
        car.z = Math.min(car.z, leadZ - minBuffer);
        car.speed = Math.min(car.speed, leadSpeed);
      }

      // 4. Overtaking: Consider changing lane if held up by a slower vehicle
      if (!car.isChangingLane && car.indicator === 'none' && leadSpeed < car.baseSpeed * 0.95) {
        const candidateLanes: number[] = [];
        // Highway rules: prioritize left passing lane, then right lane
        if (car.lane > 0) candidateLanes.push(car.lane - 1);
        if (car.lane < ROAD.LANES - 1) candidateLanes.push(car.lane + 1);

        for (const targetLane of candidateLanes) {
          const targetX = ROAD.LANE_POSITIONS[targetLane];
          let isClear = true;

          // Check player in target lane
          if (!player.isCrashed) {
            const pX = Math.abs(player.x - targetX);
            const pZ = player.z - car.z;
            if (pX < 0.30 && pZ > -900 && pZ < 1600) {
              isClear = false;
            }
          }

          // Check other traffic in target lane
          if (isClear) {
            for (const other of activeCars) {
              if (other.id === car.id) continue;
              const oX = Math.abs(other.x - targetX);
              const oZ = other.z - car.z;
              if (oX < 0.30 && oZ > -900 && oZ < 1600) {
                isClear = false;
                break;
              }
            }
          }

          if (isClear) {
            // Target lane is clear! Turn on blinker and prepare to change lanes
            car.targetLane = targetLane;
            car.indicator = targetLane < car.lane ? 'left' : 'right';
            car.indicatorTimer = 0;
            car.laneChangeCountdown = 0.75; // 750ms advance telegraph warning
            break;
          }
        }
      }
    } else {
      // Clear road ahead! Turn off brake lights and accelerate back to desired cruising speed
      car.isBraking = false;
      if (car.speed < car.baseSpeed) {
        car.speed = Math.min(car.baseSpeed, car.speed + 1400 * dt);
      }
    }

    // 5. Handle Turn Indicator Blinking
    if (car.indicator !== 'none') {
      car.indicatorTimer += dt;
      car.indicatorFlash = Math.floor(car.indicatorTimer * 8) % 2 === 0;

      if (car.laneChangeCountdown > 0) {
        car.laneChangeCountdown -= dt;
        if (car.laneChangeCountdown <= 0 && !car.isChangingLane) {
          // Verify target lane is still open before initiating transition
          const targetX = ROAD.LANE_POSITIONS[car.targetLane];
          let canExecute = true;
          for (const other of activeCars) {
            if (other.id === car.id) continue;
            if (Math.abs(other.x - targetX) < 0.25 && Math.abs(other.z - car.z) < 600) {
              canExecute = false;
              break;
            }
          }

          if (canExecute) {
            car.isChangingLane = true;
            car.startX = car.x;
            car.targetX = targetX;
            car.lane = car.targetLane;
            car.laneChangeElapsed = 0;
          } else {
            // Abort lane change if space closed up
            car.indicator = 'none';
            car.indicatorFlash = false;
          }
        }
      }
    }

    // 6. Smooth Cosine Ease-In-Out Lane Transition
    if (car.isChangingLane) {
      car.laneChangeElapsed += dt;
      const progress = Math.min(1.0, car.laneChangeElapsed / car.laneChangeDuration);
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
}

export function updateTrafficCar(car: TrafficCar, dt: number): void {
  if (!car.active) return;
  car.z += car.speed * dt;
  if (car.indicator !== 'none') {
    car.indicatorTimer += dt;
    car.indicatorFlash = Math.floor(car.indicatorTimer * 8) % 2 === 0;
  }
}

