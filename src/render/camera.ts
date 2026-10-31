import { CAMERA, ROAD } from '../core/constants';
import { Player } from '../game/player';

export class Camera {
  public x: number = 0;
  public y: number = CAMERA.HEIGHT;
  public z: number = 0;
  public depth: number = CAMERA.DEPTH;

  // Camera Shake
  private shakeIntensity: number = 0;
  private shakeDecay: number = 8.0;
  public shakeOffsetX: number = 0;
  public shakeOffsetY: number = 0;

  // Smooth FOV kick
  private targetDepth: number = CAMERA.DEPTH;
  private currentDepth: number = CAMERA.DEPTH;

  public triggerShake(magnitude: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, magnitude);
  }

  public update(dt: number, player: Player, roadY: number): void {
    // 1. Position follow
    this.z = player.z - CAMERA.DISTANCE_BEHIND;
    this.y = roadY + CAMERA.HEIGHT;

    // 2. Lateral sway with subtle smoothing
    const targetX = player.x * ROAD.ROAD_WIDTH * CAMERA.SWAY_STRENGTH;
    this.x += (targetX - this.x) * Math.min(1.0, 10.0 * dt);

    // 3. FOV kick when boosting
    this.targetDepth = player.isBoosting
      ? CAMERA.DEPTH - CAMERA.BOOST_FOV_EXTRA // Wider FOV (lower depth value in projection formula)
      : CAMERA.DEPTH;

    this.currentDepth += (this.targetDepth - this.currentDepth) * Math.min(1.0, 8.0 * dt);
    this.depth = this.currentDepth;

    // 4. Decay and apply camera shake
    if (this.shakeIntensity > 0.1) {
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeIntensity * this.shakeDecay * dt);
    } else {
      this.shakeIntensity = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }
}

