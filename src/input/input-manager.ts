import { InputDeviceType, InputSettings, InputState, KeyBindings } from './types';

const DEFAULT_KEY_BINDINGS: KeyBindings = {
  steerLeft: ['ArrowLeft', 'KeyA'],
  steerRight: ['ArrowRight', 'KeyD'],
  accelerate: ['ArrowUp', 'KeyW'],
  brake: ['ArrowDown', 'KeyS'],
  boost: ['Space', 'ShiftLeft', 'ShiftRight'],
  restart: ['KeyR'],
  pause: ['Escape', 'KeyP'],
};

const DEFAULT_SETTINGS: InputSettings = {
  mouseSensitivity: 1.0,
  mouseSmoothing: 0.18,
  gamepadDeadzone: 0.15,
  gamepadResponseCurve: 'exponential',
  keyBindings: DEFAULT_KEY_BINDINGS,
  laneAssist: false,
  hapticsEnabled: true,
};

export class InputManager {
  private settings: InputSettings;
  private activeDevice: InputDeviceType = 'keyboard';
  private keysDown: Set<string> = new Set();
  
  // Edge-detection buffers
  private pausePressedPrevious: boolean = false;
  private restartPressedPrevious: boolean = false;

  // Mouse state
  private canvasElement: HTMLCanvasElement | null = null;
  private mouseTargetSteer: number = 0;
  private mouseSmoothedSteer: number = 0;
  private mouseLeftDown: boolean = false;
  private mouseRightDown: boolean = false;

  // Gamepad state
  private activeGamepadIndex: number | null = null;

  // Current output state
  private currentState: InputState = {
    steer: 0,
    throttle: 1, // Default auto-accelerate or responsive throttle
    brake: 0,
    boost: false,
    pause: false,
    restart: false,
    activeDevice: 'keyboard',
  };

  constructor(customSettings?: Partial<InputSettings>) {
    this.settings = { ...DEFAULT_SETTINGS, ...customSettings };
    this.loadSettings();

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onContextMenu = this.onContextMenu.bind(this);
    this.onGamepadConnected = this.onGamepadConnected.bind(this);
    this.onGamepadDisconnected = this.onGamepadDisconnected.bind(this);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  public attachCanvas(canvas: HTMLCanvasElement): void {
    this.canvasElement = canvas;
    canvas.addEventListener('mousemove', this.onMouseMove);
    canvas.addEventListener('mousedown', this.onMouseDown);
    canvas.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  private onKeyDown(e: KeyboardEvent): void {
    this.keysDown.add(e.code);
    this.activeDevice = 'keyboard';
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.code);
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.canvasElement) return;
    this.activeDevice = 'mouse';

    const rect = this.canvasElement.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const centerX = rect.width / 2;
    // Map central 72% of screen to full 4-lane road span (-1 to +1)
    const normalizedX = (mouseX - centerX) / (rect.width * 0.36);
    this.mouseTargetSteer = Math.max(-1, Math.min(1, normalizedX * this.settings.mouseSensitivity));
  }

  private onMouseDown(e: MouseEvent): void {
    this.activeDevice = 'mouse';
    if (e.button === 0) {
      this.mouseLeftDown = true; // Boost
    } else if (e.button === 2) {
      this.mouseRightDown = true; // Brake
    }
  }

  private onMouseUp(e: MouseEvent): void {
    if (e.button === 0) {
      this.mouseLeftDown = false;
    } else if (e.button === 2) {
      this.mouseRightDown = false;
    }
  }

  private onContextMenu(e: MouseEvent): void {
    // Prevent right click context menu so right click braking works smoothly
    e.preventDefault();
  }

  private onGamepadConnected(e: GamepadEvent): void {
    if (this.activeGamepadIndex === null) {
      this.activeGamepadIndex = e.gamepad.index;
      this.activeDevice = 'gamepad';
    }
  }

  private onGamepadDisconnected(e: GamepadEvent): void {
    if (this.activeGamepadIndex === e.gamepad.index) {
      this.activeGamepadIndex = null;
      this.activeDevice = 'keyboard';
    }
  }

  private isKeyActionActive(actionKeys: string[]): boolean {
    for (const code of actionKeys) {
      if (this.keysDown.has(code)) return true;
    }
    return false;
  }

  /**
   * Samples all inputs at the start of a 60Hz physics tick without adding lag.
   */
  public sample(): InputState {
    const kb = this.settings.keyBindings;

    // 1. Keyboard sampling
    let kbSteer = 0;
    if (this.isKeyActionActive(kb.steerLeft)) kbSteer -= 1;
    if (this.isKeyActionActive(kb.steerRight)) kbSteer += 1;

    const isKbAccelerating = this.isKeyActionActive(kb.accelerate);
    const isKbBraking = this.isKeyActionActive(kb.brake);

    // Forward arrow (ArrowUp/W) actively accelerates to max speed; release cruises at steady ~125 km/h
    let kbThrottle = 0.3;
    if (isKbAccelerating) {
      kbThrottle = 1.0;
    } else if (isKbBraking) {
      kbThrottle = 0.0;
    }

    const kbBrake = isKbBraking ? 1.0 : 0.0;
    const kbBoost = this.isKeyActionActive(kb.boost);
    const kbPause = this.isKeyActionActive(kb.pause);
    const kbRestart = this.isKeyActionActive(kb.restart);

    // 2. Gamepad sampling
    let gpSteer = 0;
    let gpThrottle = 0.3; // Default cruise throttle
    let gpBrake = 0;
    let gpBoost = false;
    let gpPause = false;
    let gpRestart = false;
    let gpActive = false;

    if (typeof navigator !== 'undefined' && navigator.getGamepads) {
      const gamepads = navigator.getGamepads();
      for (let i = 0; i < gamepads.length; i++) {
        const gp = gamepads[i];
        if (!gp) continue;

        // Stick X axis
        const axisX = gp.axes[0] ?? 0;
        const deadzone = this.settings.gamepadDeadzone;
        if (Math.abs(axisX) > deadzone) {
          gpActive = true;
          let val = (Math.abs(axisX) - deadzone) / (1 - deadzone);
          if (this.settings.gamepadResponseCurve === 'exponential') {
            val = val * val;
          }
          gpSteer = Math.sign(axisX) * val;
        }

        // D-Pad Left/Right fallback
        if (gp.buttons[14]?.pressed) { gpSteer = -1; gpActive = true; }
        if (gp.buttons[15]?.pressed) { gpSteer = 1; gpActive = true; }

        // Triggers: RT (accelerate) and LT (brake)
        const rt = gp.buttons[7]?.value ?? (gp.buttons[7]?.pressed ? 1 : 0);
        const lt = gp.buttons[6]?.value ?? (gp.buttons[6]?.pressed ? 1 : 0);

        if (rt > 0.08) {
          gpActive = true;
          gpThrottle = rt; // Active throttle from trigger
        } else if (lt > 0.08) {
          gpActive = true;
          gpBrake = lt;
          gpThrottle = 0.0;
        } else {
          gpThrottle = 0.3; // Cruise when neither trigger held
        }

        if (gp.buttons[0]?.pressed || gp.buttons[1]?.pressed || gp.buttons[2]?.pressed || gp.buttons[3]?.pressed) {
          gpActive = true;
        }

        gpBoost = (gp.buttons[0]?.pressed ?? false) || (gp.buttons[2]?.pressed ?? false); // A or X
        gpPause = gp.buttons[9]?.pressed ?? false; // Start / Menu
        gpRestart = (gp.buttons[1]?.pressed && gpBrake > 0) || (gp.buttons[3]?.pressed ?? false); // Y

        if (gpActive) {
          this.activeGamepadIndex = gp.index;
          this.activeDevice = 'gamepad';
          break;
        }
      }
    }

    // 3. Mouse smoothing
    this.mouseSmoothedSteer += (this.mouseTargetSteer - this.mouseSmoothedSteer) * this.settings.mouseSmoothing;

    // Detect active device & blend output
    if (kbSteer !== 0 || isKbAccelerating || isKbBraking) {
      this.activeDevice = 'keyboard';
    }

    let finalSteer = 0;
    let finalThrottle = 0.3;
    let finalBrake = 0;
    let finalBoost = false;
    let rawPause = false;
    let rawRestart = false;

    if (this.activeDevice === 'gamepad' && gpActive) {
      finalSteer = gpSteer;
      finalThrottle = gpThrottle;
      finalBrake = gpBrake;
      finalBoost = gpBoost;
      rawPause = gpPause;
      rawRestart = gpRestart;
    } else if (this.activeDevice === 'mouse') {
      finalSteer = this.mouseSmoothedSteer;
      finalThrottle = this.mouseRightDown ? 0.0 : (isKbAccelerating ? 1.0 : 0.4);
      finalBrake = this.mouseRightDown ? 1.0 : 0.0;
      finalBoost = this.mouseLeftDown || kbBoost;
      rawPause = kbPause;
      rawRestart = kbRestart;
    } else {
      // Keyboard default
      finalSteer = kbSteer;
      finalThrottle = kbThrottle;
      finalBrake = kbBrake;
      finalBoost = kbBoost;
      rawPause = kbPause;
      rawRestart = kbRestart;
    }

    // Edge triggering for pause and restart
    const pauseTriggered = rawPause && !this.pausePressedPrevious;
    this.pausePressedPrevious = rawPause;

    const restartTriggered = rawRestart && !this.restartPressedPrevious;
    this.restartPressedPrevious = rawRestart;

    this.currentState = {
      steer: Math.max(-1, Math.min(1, finalSteer)),
      throttle: Math.max(0, Math.min(1, finalThrottle)),
      brake: Math.max(0, Math.min(1, finalBrake)),
      boost: finalBoost,
      pause: pauseTriggered,
      restart: restartTriggered,
      activeDevice: this.activeDevice,
    };

    return this.currentState;
  }

  public getState(): InputState {
    return this.currentState;
  }

  /**
   * Triggers haptic feedback rumble on connected gamepad if enabled.
   */
  public triggerHaptics(durationMs: number = 80, weakMagnitude: number = 0.4, strongMagnitude: number = 0.2): void {
    if (!this.settings.hapticsEnabled || typeof navigator === 'undefined' || !navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;
      // standard vibrationActuator API
      const actuator = (gp as any).vibrationActuator;
      if (actuator && typeof actuator.playEffect === 'function') {
        actuator.playEffect('dual-rumble', {
          startDelay: 0,
          duration: durationMs,
          weakMagnitude,
          strongMagnitude,
        }).catch(() => {
          // Ignore haptic promise rejections
        });
      }
    }
  }

  public getSettings(): InputSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<InputSettings>): void {
    this.settings = { ...this.settings, ...partial };
    this.saveSettings();
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('redline_input_settings', JSON.stringify(this.settings));
    } catch {
      // localStorage may fail in private mode
    }
  }

  private loadSettings(): void {
    try {
      const data = localStorage.getItem('redline_input_settings');
      if (data) {
        this.settings = { ...this.settings, ...JSON.parse(data) };
      }
    } catch {
      // Fallback to default
    }
  }

  public destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    if (this.canvasElement) {
      this.canvasElement.removeEventListener('mousemove', this.onMouseMove);
      this.canvasElement.removeEventListener('mousedown', this.onMouseDown);
      this.canvasElement.removeEventListener('mouseup', this.onMouseUp);
      this.canvasElement.removeEventListener('contextmenu', this.onContextMenu);
    }
  }
}
