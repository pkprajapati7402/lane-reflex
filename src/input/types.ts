export type InputDeviceType = 'keyboard' | 'mouse' | 'gamepad';

export interface InputState {
  steer: number;         // -1.0 (full left) to +1.0 (full right)
  throttle: number;      // 0.0 to 1.0
  brake: number;         // 0.0 to 1.0
  boost: boolean;        // true if boost held
  pause: boolean;        // true once per toggle press
  restart: boolean;      // true once per press
  activeDevice: InputDeviceType;
}

export interface KeyBindings {
  steerLeft: string[];
  steerRight: string[];
  accelerate: string[];
  brake: string[];
  boost: string[];
  restart: string[];
  pause: string[];
}

export interface InputSettings {
  mouseSensitivity: number;
  mouseSmoothing: number;
  gamepadDeadzone: number;
  gamepadResponseCurve: 'linear' | 'exponential';
  keyBindings: KeyBindings;
  laneAssist: boolean;
  hapticsEnabled: boolean;
}

