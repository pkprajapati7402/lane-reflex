import { PRNG } from '../core/prng';
import { ROAD, TRAFFIC } from '../core/constants';
import { TrafficCar, resetTrafficCar } from './traffic';
import { ObjectPool } from '../core/pool';

export type PatternType =
  | 'SINGLE_GAP_WALL'
  | 'ZIGZAG'
  | 'HEAVY_TRUCK_BLOCK'
  | 'TELEGRAPHED_LANE_CHANGE'
  | 'PINCER'
  | 'OPEN_SPRINT';

export type TrafficDensity = 'low' | 'moderate' | 'high';

export interface TrafficWave {
  type: PatternType;
  openLanes: number[];
  spawnZ: number;
}

export class TrafficSpawner {
  private prng: PRNG;
  private pool: ObjectPool<TrafficCar>;
  private nextSpawnZ: number = 6000;
  private difficultyTier: number = 1;
  private densityMode: TrafficDensity = 'moderate';
  private lastWaveType: PatternType = 'OPEN_SPRINT';

  // Palette of distinct car colors
  private carColors: string[] = [
    '#00e5ff', // Cyan
    '#ffd600', // Yellow
    '#ff0055', // Hot Pink
    '#00e676', // Bright Green
    '#ffffff', // Crisp White
    '#ff9100', // Orange
    '#b388ff', // Lavender
  ];

  constructor(prng: PRNG, pool: ObjectPool<TrafficCar>) {
    this.prng = prng;
    this.pool = pool;
  }

  public setDensityMode(mode: TrafficDensity): void {
    this.densityMode = mode;
  }

  public getDensityMode(): TrafficDensity {
    return this.densityMode;
  }

  public reset(seed?: number): void {
    if (seed !== undefined) {
      this.prng.setSeed(seed);
    }
    this.nextSpawnZ = 6000;
    this.difficultyTier = 1;
    this.lastWaveType = 'OPEN_SPRINT';
  }

  public setDifficultyTier(tier: number): void {
    this.difficultyTier = Math.max(1, Math.min(10, tier));
  }

  public update(playerZ: number, playerSpeed: number): void {
    // Keep waves spawned ahead of the player
    while (this.nextSpawnZ < playerZ + TRAFFIC.SPAWN_AHEAD_DISTANCE) {
      this.spawnNextWave(this.nextSpawnZ);

      // Density spacing multiplier: low has wide gaps, high has frequent clusters
      let densityMultiplier = 1.0;
      if (this.densityMode === 'low') densityMultiplier = 1.85;
      else if (this.densityMode === 'high') densityMultiplier = 0.65;

      // Random jitter so traffic waves arrive unpredictably (random timing)
      const randomJitter = this.prng.rangeFloat(0.85, 1.3);

      const minGapTime = Math.max(0.9, (2.2 - this.difficultyTier * 0.10) * densityMultiplier * randomJitter);
      const speedRef = Math.max(8000, playerSpeed);
      const waveSpacing = speedRef * minGapTime;
      this.nextSpawnZ += waveSpacing;
    }

    // Clean up cars that fell far behind the player
    for (let i = 0; i < this.pool.count; i++) {
      const car = this.pool.get(i);
      if (car.active && car.z < playerZ - TRAFFIC.DESPAWN_BEHIND_DISTANCE) {
        resetTrafficCar(car);
        this.pool.release(i);
        i--;
      }
    }
  }

  private spawnNextWave(baseZ: number): void {
    // Available patterns weighted by density mode
    let patterns: PatternType[] = ['OPEN_SPRINT', 'SINGLE_GAP_WALL', 'ZIGZAG', 'HEAVY_TRUCK_BLOCK', 'TELEGRAPHED_LANE_CHANGE'];
    
    if (this.densityMode === 'low') {
      // In low mode, favor open sprint and single gap walls with lots of breathing room
      patterns = ['OPEN_SPRINT', 'OPEN_SPRINT', 'SINGLE_GAP_WALL', 'HEAVY_TRUCK_BLOCK'];
    } else if (this.densityMode === 'high') {
      // In high mode, favor intense walls, zigzags and lane changers
      patterns = ['SINGLE_GAP_WALL', 'ZIGZAG', 'HEAVY_TRUCK_BLOCK', 'TELEGRAPHED_LANE_CHANGE', 'SINGLE_GAP_WALL'];
    }

    let chosen: PatternType = this.prng.choice(patterns);

    // Random variety: avoid mechanical repetition
    if (chosen === this.lastWaveType && this.prng.nextFloat() < 0.5) {
      chosen = 'OPEN_SPRINT';
    }
    this.lastWaveType = chosen;

    switch (chosen) {
      case 'SINGLE_GAP_WALL':
        this.spawnSingleGapWall(baseZ);
        break;
      case 'ZIGZAG':
        this.spawnZigzag(baseZ);
        break;
      case 'HEAVY_TRUCK_BLOCK':
        this.spawnTruckBlock(baseZ);
        break;
      case 'TELEGRAPHED_LANE_CHANGE':
        this.spawnTelegraphedChange(baseZ);
        break;
      default:
        this.spawnOpenSprint(baseZ);
        break;
    }
  }

  /**
   * Spawns a wall of cars with exactly 1 or 2 clear escape lanes
   */
  public spawnSingleGapWall(baseZ: number): { openLanes: number[] } {
    const totalLanes = ROAD.LANES;
    // Guaranteed open lane
    const openLane = this.prng.rangeInt(0, totalLanes - 1);
    const speed = this.prng.rangeFloat(TRAFFIC.MIN_SPEED, TRAFFIC.MAX_SPEED * 0.85);

    for (let lane = 0; lane < totalLanes; lane++) {
      if (lane === openLane) continue;

      const car = this.pool.acquire();
      car.active = true;
      car.type = 'sedan';
      car.lane = lane;
      car.x = ROAD.LANE_POSITIONS[lane];
      car.targetX = car.x;
      car.z = baseZ;
      car.speed = speed;
      car.baseSpeed = speed;
      car.color = this.prng.choice(this.carColors);
      car.width = TRAFFIC.HITBOX_WIDTH;
      car.length = TRAFFIC.HITBOX_LENGTH;
    }

    return { openLanes: [openLane] };
  }

  /**
   * Spawns two staggered barriers requiring quick weave
   */
  public spawnZigzag(baseZ: number): void {
    const laneA = this.prng.rangeInt(0, 1); // 0 or 1
    const laneB = this.prng.rangeInt(2, 3); // 2 or 3
    const speed = this.prng.rangeFloat(TRAFFIC.MIN_SPEED, TRAFFIC.MAX_SPEED * 0.9);

    // First barrier
    for (let l = 0; l < ROAD.LANES; l++) {
      if (l === laneA) continue; // open at laneA
      const car = this.pool.acquire();
      car.active = true;
      car.lane = l;
      car.x = ROAD.LANE_POSITIONS[l];
      car.targetX = car.x;
      car.z = baseZ;
      car.speed = speed;
      car.baseSpeed = speed;
      car.color = this.prng.choice(this.carColors);
    }

    // Second barrier spaced 1800 units ahead, open at laneB
    const secondZ = baseZ + 2200;
    for (let l = 0; l < ROAD.LANES; l++) {
      if (l === laneB) continue; // open at laneB
      const car = this.pool.acquire();
      car.active = true;
      car.lane = l;
      car.x = ROAD.LANE_POSITIONS[l];
      car.targetX = car.x;
      car.z = secondZ;
      car.speed = speed;
      car.baseSpeed = speed;
      car.color = this.prng.choice(this.carColors);
    }
  }

  /**
   * Spawns a slow wide heavy semi truck with a faster car overtaking
   */
  public spawnTruckBlock(baseZ: number): void {
    const truckLane = this.prng.rangeInt(1, 2); // Center lanes
    const truck = this.pool.acquire();
    truck.active = true;
    truck.type = 'truck';
    truck.lane = truckLane;
    truck.x = ROAD.LANE_POSITIONS[truckLane];
    truck.targetX = truck.x;
    truck.z = baseZ;
    truck.speed = TRAFFIC.TRUCK_SPEED;
    truck.baseSpeed = TRAFFIC.TRUCK_SPEED;
    truck.color = '#ef4444'; // Heavy industrial red
    truck.width = TRAFFIC.TRUCK_HITBOX_WIDTH;
    truck.length = TRAFFIC.TRUCK_HITBOX_LENGTH;

    // Place an overtaker car in an adjacent lane slightly behind
    const sideLane = truckLane === 1 ? 0 : 3;
    const car = this.pool.acquire();
    car.active = true;
    car.type = 'sport';
    car.lane = sideLane;
    car.x = ROAD.LANE_POSITIONS[sideLane];
    car.targetX = car.x;
    car.z = baseZ - 600;
    car.speed = TRAFFIC.FAST_CAR_SPEED;
    car.baseSpeed = TRAFFIC.FAST_CAR_SPEED;
    car.color = '#eab308'; // Sport yellow
  }

  /**
   * Spawns a car that signals with turn blinker, then changes lane
   */
  public spawnTelegraphedChange(baseZ: number): void {
    const startLane = this.prng.rangeInt(1, 2);
    const targetLane = startLane === 1 ? 0 : 3;

    const car = this.pool.acquire();
    car.active = true;
    car.type = 'sport';
    car.lane = targetLane; // Will change to target
    car.x = ROAD.LANE_POSITIONS[startLane];
    car.targetX = ROAD.LANE_POSITIONS[startLane];
    car.z = baseZ;
    car.speed = this.prng.rangeFloat(TRAFFIC.MIN_SPEED * 1.1, TRAFFIC.MAX_SPEED);
    car.baseSpeed = car.speed;
    car.color = '#a855f7'; // Purple sports car
    
    // Set up telegraph: flashes indicator for 0.7s before moving
    car.indicator = targetLane > startLane ? 'right' : 'left';
    car.laneChangeCountdown = 0.7; // 700ms advance warning
    car.indicatorTimer = 0;
  }

  /**
   * Spawns scattered high-speed traffic for near-miss weaving
   */
  public spawnOpenSprint(baseZ: number): void {
    const count = this.prng.rangeInt(2, 3);
    const usedLanes = new Set<number>();

    for (let i = 0; i < count; i++) {
      let lane = this.prng.rangeInt(0, ROAD.LANES - 1);
      if (usedLanes.has(lane)) continue;
      usedLanes.add(lane);

      const car = this.pool.acquire();
      car.active = true;
      car.type = 'sedan';
      car.lane = lane;
      car.x = ROAD.LANE_POSITIONS[lane];
      car.targetX = car.x;
      car.z = baseZ + this.prng.rangeFloat(-400, 400);
      car.speed = this.prng.rangeFloat(TRAFFIC.MIN_SPEED, TRAFFIC.MAX_SPEED);
      car.baseSpeed = car.speed;
      car.color = this.prng.choice(this.carColors);
    }
  }
}

