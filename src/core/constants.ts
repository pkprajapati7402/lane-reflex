/**
 * Global physics, rendering, and gameplay constants for REDLINE.
 */

export const ROAD = {
  SEGMENT_LENGTH: 200,      // Length of each road segment in world units
  ROAD_WIDTH: 2200,          // Half-width or full width reference
  LANES: 4,                  // Default 4 lanes (-0.75, -0.25, +0.25, +0.75)
  DRAW_DISTANCE: 260,        // Visible segments ahead of camera
  RUMBLE_LENGTH: 3,          // Number of segments per rumble strip band
  LANE_POSITIONS: [-0.75, -0.25, 0.25, 0.75], // Normalized road positions (-1..1)
} as const;

export const CAMERA = {
  HEIGHT: 1000,              // Camera elevation above road
  DISTANCE_BEHIND: 1500,     // Distance behind player car
  DEPTH: 0.84,               // Camera focal depth (corresponds to ~60 deg FOV)
  BOOST_FOV_EXTRA: 0.22,     // Extra camera depth pull during boost
  SWAY_STRENGTH: 0.45,       // Camera lateral sway on steering
} as const;

export const PLAYER = {
  ACCEL: 450,                // Responsive acceleration units/s^2
  BRAKE_DECEL: 950,          // Braking deceleration units/s^2
  COAST_DECEL: 150,          // Natural drag deceleration
  CRUISE_SPEED: 7500,        // Default cruise speed (~125 km/h)
  MAX_SPEED: 12500,          // Base top speed (approx 210 km/h)
  BOOST_SPEED: 16800,        // Boosted top speed (approx 280 km/h)
  MIN_SPEED: 0,
  LATERAL_SPEED: 2.6,        // Lateral speed across road (-1..1) per second at max speed
  HITBOX_WIDTH: 0.28,        // Visual width in road fractions
  HITBOX_LENGTH: 360,        // Visual depth in world units
  FORGIVING_RATIO: 0.85,     // 15% forgiving hitbox margin
  NEAR_MISS_LATERAL: 0.44,   // Near-miss lateral threshold
  NEAR_MISS_Z: 480,          // Near-miss longitudinal threshold
} as const;

export const TRAFFIC = {
  MIN_SPEED: 4500,           // Slowest traffic speed
  MAX_SPEED: 8500,           // Fastest traffic speed
  TRUCK_SPEED: 4000,
  FAST_CAR_SPEED: 9500,
  SPAWN_AHEAD_DISTANCE: 42000, // Spawn distance ahead of player
  DESPAWN_BEHIND_DISTANCE: 3000, // Despawn distance behind player
  HITBOX_WIDTH: 0.28,
  HITBOX_LENGTH: 400,
  TRUCK_HITBOX_WIDTH: 0.38,
  TRUCK_HITBOX_LENGTH: 700,
} as const;

export const TIMESTEP = 1 / 60; // 60 Hz fixed simulation
export const MAX_FRAME_TIME = 0.1; // Safety clamp against spiral of death

