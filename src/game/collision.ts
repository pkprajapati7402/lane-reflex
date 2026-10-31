import { PLAYER } from '../core/constants';
import { Player } from './player';
import { TrafficCar } from './traffic';

export type NearMissCloseness = 'CLOSE' | 'RAZOR' | 'EXTREME';

export interface NearMissResult {
  carId: number;
  closeness: NearMissCloseness;
  scoreBonus: number;
  boostBonus: number;
  lateralDist: number;
}

export interface CollisionResult {
  hasCrashed: boolean;
  crashedWithCarId: number | null;
  crashCause: string;
  nearMisses: NearMissResult[];
}

export class CollisionSystem {
  public checkCollisions(player: Player, trafficCars: TrafficCar[]): CollisionResult {
    const result: CollisionResult = {
      hasCrashed: false,
      crashedWithCarId: null,
      crashCause: '',
      nearMisses: [],
    };

    if (player.isCrashed) {
      return result;
    }

    const pWidth = PLAYER.HITBOX_WIDTH * PLAYER.FORGIVING_RATIO;
    const pLength = PLAYER.HITBOX_LENGTH * PLAYER.FORGIVING_RATIO;

    for (const car of trafficCars) {
      if (!car.active) continue;

      const cWidth = car.width * PLAYER.FORGIVING_RATIO;
      const cLength = car.length * PLAYER.FORGIVING_RATIO;

      const deltaX = Math.abs(player.x - car.x);
      const deltaZ = Math.abs(player.z - car.z);

      const collisionThresholdX = (pWidth + cWidth) / 2;
      const collisionThresholdZ = (pLength + cLength) / 2;

      // 1. Crash Collision Check
      // Only triggers if player drives into a car ahead or collides while abreast.
      // If player has already overtaken the car and is in front (player.z >= car.z + 50),
      // the trailing car brakes and follows; it never causes an unfair game over on the player.
      const isPlayerBehindOrAbreast = player.z < car.z + 50;
      if (deltaX < collisionThresholdX && deltaZ < collisionThresholdZ && isPlayerBehindOrAbreast) {
        result.hasCrashed = true;
        result.crashedWithCarId = car.id;
        result.crashCause = car.type === 'truck' ? 'Heavy Truck Collision' : 'Rear-end Collision';
        return result; // Immediate return on crash
      }

      // 2. Near-Miss Check
      // Only valid if passing the car, player moving faster, not already awarded
      if (
        !car.nearMissAwarded &&
        player.speed > car.speed &&
        deltaZ < PLAYER.NEAR_MISS_Z &&
        deltaX < PLAYER.NEAR_MISS_LATERAL &&
        deltaX >= collisionThresholdX
      ) {
        // Player is alongside or just passing
        if (player.z >= car.z - 200 && player.z <= car.z + 450) {
          car.nearMissAwarded = true;

          // Closeness evaluation
          let closeness: NearMissCloseness = 'CLOSE';
          let scoreBonus = 250;
          let boostBonus = 18;

          const margin = deltaX - collisionThresholdX;
          if (margin < 0.05) {
            closeness = 'EXTREME';
            scoreBonus = 1000;
            boostBonus = 40;
          } else if (margin < 0.12) {
            closeness = 'RAZOR';
            scoreBonus = 500;
            boostBonus = 25;
          }

          result.nearMisses.push({
            carId: car.id,
            closeness,
            scoreBonus,
            boostBonus,
            lateralDist: margin,
          });
        }
      }
    }

    return result;
  }
}

