import { PLAYER, ROAD } from '../core/constants';
import { InputState } from '../input/types';

export class Player {
  public x: number = 0;              // -1.0 to 1.0 (road center is 0)
  public z: number = 0;              // World distance along track
  public speed: number = 0;          // Current forward speed (units/s)
  public targetSpeed: number = PLAYER.MAX_SPEED;
  public steerVelocity: number = 0;  // Lateral velocity
  public steerAngle: number = 0;     // Visual yaw tilt (-1 to 1)

  // Boost mechanic
  public boostMeter: number = 40;    // 0 to 100
  public isBoosting: boolean = false;
  public isBraking: boolean = false;

  // Collision / Crash
  public isCrashed: boolean = false;
  public hitstopRemaining: number = 0; // seconds of hitstop freeze

  // Performance / Progression
  public distanceTraveled: number = 0;
  public baseMaxSpeed: number = PLAYER.MAX_SPEED;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.x = 0;
    this.z = 0;
    this.speed = 1000; // Start with gentle roll
    this.steerVelocity = 0;
    this.steerAngle = 0;
    this.boostMeter = 50;
    this.isBoosting = false;
    this.isBraking = false;
    this.isCrashed = false;
    this.hitstopRemaining = 0;
    this.distanceTraveled = 0;
    this.baseMaxSpeed = PLAYER.MAX_SPEED;
  }

  /**
   * Continuous speed ramp: as player drives further, baseMaxSpeed increases
   */
  public rampDifficulty(score: number, elapsedSec: number): void {
    // Gradually ramp max speed by up to 35% over time to intensify reflex demands
    const rampFactor = Math.min(1.35, 1.0 + (elapsedSec * 0.003) + (score * 0.000005));
    this.baseMaxSpeed = PLAYER.MAX_SPEED * rampFactor;
  }

  public addBoost(amount: number): void {
    this.boostMeter = Math.min(100, this.boostMeter + amount);
  }

  public crash(): void {
    if (this.isCrashed) return;
    this.isCrashed = true;
    this.speed = 0;
    this.hitstopRemaining = 0.15; // 150ms punchy hitstop freeze
  }

  public update(dt: number, input: InputState, laneAssistEnabled: boolean): void {
    if (this.isCrashed) {
      if (this.hitstopRemaining > 0) {
        this.hitstopRemaining -= dt;
      }
      return;
    }

    // 1. Boost evaluation
    if (input.boost && this.boostMeter > 0) {
      this.isBoosting = true;
      this.boostMeter = Math.max(0, this.boostMeter - 28 * dt);
    } else {
      this.isBoosting = false;
    }

    // 2. Longitudinal Acceleration & Braking
    const effectiveMaxSpeed = this.isBoosting ? PLAYER.BOOST_SPEED : this.baseMaxSpeed;

    if (input.brake > 0.05) {
      this.isBraking = true;
      const decel = PLAYER.BRAKE_DECEL * 14 * input.brake;
      this.speed = Math.max(0, this.speed - decel * dt);
    } else {
      this.isBraking = false;
      if (input.throttle > 0.5) {
        // Active acceleration (Forward Arrow / W / Gamepad RT)
        const accelMultiplier = this.isBoosting ? 2.2 : 1.0;
        const accel = PLAYER.ACCEL * 16 * input.throttle * accelMultiplier;
        if (this.speed < effectiveMaxSpeed) {
          this.speed = Math.min(effectiveMaxSpeed, this.speed + accel * dt);
        } else if (!this.isBoosting && this.speed > this.baseMaxSpeed) {
          this.speed = Math.max(this.baseMaxSpeed, this.speed - PLAYER.COAST_DECEL * 10 * dt);
        }
      } else {
        // Cruising / Coasting when throttle is not held
        const cruiseTarget = this.isBoosting ? effectiveMaxSpeed : PLAYER.CRUISE_SPEED;
        if (this.speed > cruiseTarget) {
          // Coast down to cruise speed
          this.speed = Math.max(cruiseTarget, this.speed - PLAYER.COAST_DECEL * 8 * dt);
        } else if (this.speed < cruiseTarget) {
          // Recover up to cruise speed
          this.speed = Math.min(cruiseTarget, this.speed + PLAYER.ACCEL * 6 * dt);
        }
      }
    }

    // Off-road shoulder drag penalty if steered too far outside road bounds
    if (Math.abs(this.x) > 1.0) {
      this.speed = Math.max(1200, this.speed - PLAYER.BRAKE_DECEL * 8 * dt);
    }

    // 3. Lateral Steering Dynamics
    // Minimum authority so car never feels unresponsive or unresponsive when slowing down
    const speedRatio = Math.max(0.45, Math.min(1.0, this.speed / (PLAYER.MAX_SPEED * 0.4)));
    const targetSteerVel = input.steer * PLAYER.LATERAL_SPEED * speedRatio;

    // Instant, razor-sharp steering attack with smooth dampening
    const steerResponsiveness = 24.0;
    this.steerVelocity += (targetSteerVel - this.steerVelocity) * Math.min(1.0, steerResponsiveness * dt);

    // Optional lane assist: subtle magnetic centering when near lane centers and player not actively steering
    if (laneAssistEnabled && Math.abs(input.steer) < 0.1 && speedRatio > 0.3) {
      let closestLane: number = ROAD.LANE_POSITIONS[0];
      let minDiff = 999;
      for (const lane of ROAD.LANE_POSITIONS) {
        const diff = Math.abs(this.x - lane);
        if (diff < minDiff) {
          minDiff = diff;
          closestLane = lane;
        }
      }
      if (minDiff < 0.12) {
        this.steerVelocity += (closestLane - this.x) * 1.5 * dt;
      }
    }

    this.x += this.steerVelocity * dt;

    // Hard boundary clamping
    this.x = Math.max(-1.3, Math.min(1.3, this.x));

    // Visual yaw tilt: immediate response to current steering input
    const targetTilt = input.steer;
    this.steerAngle += (targetTilt - this.steerAngle) * Math.min(1.0, 20.0 * dt);

    // 4. Forward World Progress
    const deltaZ = this.speed * dt;
    this.z += deltaZ;
    this.distanceTraveled += deltaZ;
  }
}
