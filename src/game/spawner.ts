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
  }

  public setDifficultyTier(tier: number): void {
    this.difficultyTier = Math.max(1, Math.min(10, tier));
  }

  public update(playerZ: number, _playerSpeed: number): void {
    // Keep traffic continuously populated ahead of the player without desert gaps
    while (this.nextSpawnZ < playerZ + TRAFFIC.SPAWN_AHEAD_DISTANCE) {
      this.spawnNextWave(this.nextSpawnZ);

      // Organic cadence: continuous stream instead of massive bursty waves
      let baseInterval = 3400;
      if (this.densityMode === 'low') baseInterval = 5000;
      else if (this.densityMode === 'high') baseInterval = 2400;

      // Progressive difficulty and random natural jitter
      const diffScale = Math.max(0.75, 1.0 - (this.difficultyTier - 1) * 0.035);
      const jitter = this.prng.rangeFloat(0.85, 1.25);
      const step = baseInterval * diffScale * jitter;

      this.nextSpawnZ += step;
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
    // Organic traffic mix weighted by density mode
    const roll = this.prng.nextFloat();

    if (this.densityMode === 'low') {
      // In low mode: mostly single cruisers and generous gaps
      if (roll < 0.55) {
        this.spawnOrganicFlow(baseZ, 1);
      } else if (roll < 0.80) {
        this.spawnTruckBlock(baseZ);
      } else {
        this.spawnTelegraphedChange(baseZ);
      }
    } else if (this.densityMode === 'high') {
      // In high mode: continuous reflex scanning with lane changers and staggered pairs
      if (roll < 0.35) {
        this.spawnOrganicFlow(baseZ, 2);
      } else if (roll < 0.60) {
        this.spawnTelegraphedChange(baseZ);
      } else if (roll < 0.85) {
        this.spawnSingleGapWall(baseZ);
      } else {
        this.spawnTruckBlock(baseZ);
      }
    } else {
      // Moderate: balanced blend of single cars, trucks, and telegraphed lane changers
      if (roll < 0.45) {
        this.spawnOrganicFlow(baseZ, this.prng.nextFloat() < 0.65 ? 1 : 2);
      } else if (roll < 0.68) {
        this.spawnTruckBlock(baseZ);
      } else if (roll < 0.88) {
        this.spawnTelegraphedChange(baseZ);
      } else {
        this.spawnSingleGapWall(baseZ);
      }
    }
  }

  /**
   * Spawns 1 or 2 organic cruisers with diverse speeds and colors,
   * guaranteeing at least 2 open overtaking lanes.
   */
  public spawnOrganicFlow(baseZ: number, carCount: number = 1): void {
    const lanes: number[] = [0, 1, 2, 3];
    // Shuffle lanes to pick distinct random positions
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = this.prng.rangeInt(0, i);
      const temp = lanes[i];
      lanes[i] = lanes[j];
      lanes[j] = temp;
    }

    const count = Math.min(2, Math.max(1, carCount));
    for (let i = 0; i < count; i++) {
      const lane = lanes[i];
      const car = this.pool.acquire();
      car.active = true;

      const isSport = this.prng.nextFloat() < 0.25;
      const isTruck = !isSport && this.prng.nextFloat() < 0.20 && (lane === 0 || lane === 3);

      if (isTruck) {
        car.type = 'truck';
        car.width = TRAFFIC.TRUCK_HITBOX_WIDTH;
        car.length = TRAFFIC.TRUCK_HITBOX_LENGTH;
        car.color = '#ef4444';
        const truckSpeed = this.prng.rangeFloat(TRAFFIC.TRUCK_SPEED, TRAFFIC.TRUCK_SPEED * 1.25);
        car.speed = truckSpeed;
        car.baseSpeed = truckSpeed;
      } else if (isSport) {
        car.type = 'sport';
        car.width = TRAFFIC.HITBOX_WIDTH;
        car.length = TRAFFIC.HITBOX_LENGTH;
        car.color = this.prng.choice(this.carColors);
        const sportSpeed = this.prng.rangeFloat(TRAFFIC.MAX_SPEED * 0.9, TRAFFIC.FAST_CAR_SPEED);
        car.speed = sportSpeed;
        car.baseSpeed = sportSpeed;
      } else {
        car.type = 'sedan';
        car.width = TRAFFIC.HITBOX_WIDTH;
        car.length = TRAFFIC.HITBOX_LENGTH;
        car.color = this.prng.choice(this.carColors);
        const sedanSpeed = this.prng.rangeFloat(TRAFFIC.MIN_SPEED * 1.1, TRAFFIC.MAX_SPEED * 0.85);
        car.speed = sedanSpeed;
        car.baseSpeed = sedanSpeed;
      }

      car.lane = lane;
      car.x = ROAD.LANE_POSITIONS[lane];
      car.startX = car.x;
      car.targetX = car.x;

      // Stagger longitudinally so cars NEVER form an abreast block
      const stagger = i === 0 ? this.prng.rangeFloat(-200, 200) : this.prng.rangeFloat(600, 1200);
      car.z = baseZ + stagger;
    }
  }

  /**
   * Spawns traffic with staggered longitudinal spacing and diverse speeds,
   * guaranteeing at least 2 clear overtaking lanes.
   */
  public spawnSingleGapWall(baseZ: number): { openLanes: number[] } {
    const totalLanes = ROAD.LANES;
    // Guarantee 2 wide escape lanes so player can always overtake
    const openLaneA = this.prng.rangeInt(0, 1);
    const openLaneB = this.prng.rangeInt(2, 3);
    const baseSpeed = this.prng.rangeFloat(TRAFFIC.MIN_SPEED, TRAFFIC.MAX_SPEED * 0.85);

    for (let lane = 0; lane < totalLanes; lane++) {
      if (lane === openLaneA || lane === openLaneB) continue;

      const car = this.pool.acquire();
      car.active = true;
      car.type = 'sedan';
      car.lane = lane;
      car.x = ROAD.LANE_POSITIONS[lane];
      car.startX = car.x;
      car.targetX = car.x;
      // Stagger longitudinally so cars NEVER form an unbroken rigid line
      car.z = baseZ + this.prng.rangeFloat(-500, 500);
      // Individual speed variation so cars naturally disperse over time
      const carSpeed = baseSpeed + this.prng.rangeFloat(-700, 700);
      car.speed = carSpeed;
      car.baseSpeed = carSpeed;
      car.color = this.prng.choice(this.carColors);
      car.width = TRAFFIC.HITBOX_WIDTH;
      car.length = TRAFFIC.HITBOX_LENGTH;
    }

    return { openLanes: [openLaneA, openLaneB] };
  }

  /**
   * Spawns staggered barriers with dynamic longitudinal spacing
   */
  public spawnZigzag(baseZ: number): void {
    const laneA = this.prng.rangeInt(0, 1); // open at laneA
    const laneB = this.prng.rangeInt(2, 3); // open at laneB
    const speed = this.prng.rangeFloat(TRAFFIC.MIN_SPEED, TRAFFIC.MAX_SPEED * 0.9);

    // First barrier
    for (let l = 0; l < ROAD.LANES; l++) {
      if (l === laneA) continue;
      const car = this.pool.acquire();
      car.active = true;
      car.lane = l;
      car.x = ROAD.LANE_POSITIONS[l];
      car.startX = car.x;
      car.targetX = car.x;
      car.z = baseZ + this.prng.rangeFloat(-300, 300);
      const carSpeed = speed + this.prng.rangeFloat(-500, 500);
      car.speed = carSpeed;
      car.baseSpeed = carSpeed;
      car.color = this.prng.choice(this.carColors);
    }

    // Second barrier spaced 2400 units ahead, open at laneB
    const secondZ = baseZ + 2400;
    for (let l = 0; l < ROAD.LANES; l++) {
      if (l === laneB) continue;
      const car = this.pool.acquire();
      car.active = true;
      car.lane = l;
      car.x = ROAD.LANE_POSITIONS[l];
      car.startX = car.x;
      car.targetX = car.x;
      car.z = secondZ + this.prng.rangeFloat(-300, 300);
      const carSpeed = speed + this.prng.rangeFloat(-600, 600);
      car.speed = carSpeed;
      car.baseSpeed = carSpeed;
      car.color = this.prng.choice(this.carColors);
    }
  }

  /**
   * Spawns a slow wide heavy semi truck with faster traffic alongside
   */
  public spawnTruckBlock(baseZ: number): void {
    const truckLane = this.prng.rangeInt(1, 2); // Center lanes
    const truck = this.pool.acquire();
    truck.active = true;
    truck.type = 'truck';
    truck.lane = truckLane;
    truck.x = ROAD.LANE_POSITIONS[truckLane];
    truck.startX = truck.x;
    truck.targetX = truck.x;
    truck.z = baseZ;
    truck.speed = TRAFFIC.TRUCK_SPEED;
    truck.baseSpeed = TRAFFIC.TRUCK_SPEED;
    truck.color = '#ef4444'; // Heavy industrial red
    truck.width = TRAFFIC.TRUCK_HITBOX_WIDTH;
    truck.length = TRAFFIC.TRUCK_HITBOX_LENGTH;

    // Place an overtaker sports car in an adjacent lane pulling ahead
    const sideLane = truckLane === 1 ? 0 : 3;
    const car = this.pool.acquire();
    car.active = true;
    car.type = 'sport';
    car.lane = sideLane;
    car.x = ROAD.LANE_POSITIONS[sideLane];
    car.startX = car.x;
    car.targetX = car.x;
    car.z = baseZ + 800; // Pulling ahead to open gap behind it
    car.speed = TRAFFIC.FAST_CAR_SPEED;
    car.baseSpeed = TRAFFIC.FAST_CAR_SPEED;
    car.color = '#eab308'; // Sport yellow
  }

  /**
   * Spawns a car that signals with turn blinker, then changes lane smoothly
   */
  public spawnTelegraphedChange(baseZ: number): void {
    const startLane = this.prng.rangeInt(1, 2);
    const targetLane = startLane === 1 ? 0 : 3;

    const car = this.pool.acquire();
    car.active = true;
    car.type = 'sport';
    car.lane = targetLane; // Will change to target
    car.x = ROAD.LANE_POSITIONS[startLane];
    car.startX = car.x;
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
   * Spawns scattered high-speed traffic with wide overtaking pockets
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
      car.startX = car.x;
      car.targetX = car.x;
      // Stagger longitudinally across 1400 units
      car.z = baseZ + this.prng.rangeFloat(-700, 700);
      car.speed = this.prng.rangeFloat(TRAFFIC.MIN_SPEED, TRAFFIC.MAX_SPEED);
      car.baseSpeed = car.speed;
      car.color = this.prng.choice(this.carColors);
    }
  }
}

