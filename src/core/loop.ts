import { TIMESTEP, MAX_FRAME_TIME } from './constants';

export interface GameLoopCallbacks {
  tick: (dt: number) => void;
  render: (alpha: number, frameTimeMs: number) => void;
}

export class GameLoop {
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private lastTime: number = 0;
  private accumulator: number = 0;
  private rafId: number | null = null;
  private callbacks: GameLoopCallbacks;
  private autoPauseOnBlur: boolean = true;

  constructor(callbacks: GameLoopCallbacks) {
    this.callbacks = callbacks;
    this.onVisibilityChange = this.onVisibilityChange.bind(this);
    this.frame = this.frame.bind(this);
    window.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.frame);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    if (!this.isRunning) {
      this.start();
      return;
    }
    this.isPaused = false;
    this.lastTime = performance.now();
    this.accumulator = 0;
  }

  public togglePause(): boolean {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
    return this.isPaused;
  }

  public get paused(): boolean {
    return this.isPaused;
  }

  private onVisibilityChange(): void {
    if (!this.autoPauseOnBlur) return;
    if (document.hidden) {
      this.pause();
    }
  }

  private frame(currentTime: number): void {
    if (!this.isRunning) return;

    let delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;

    // Guard against large frame spikes or debugging pauses
    if (delta > MAX_FRAME_TIME) {
      delta = MAX_FRAME_TIME;
    }

    if (!this.isPaused) {
      this.accumulator += delta;

      // Fixed 60Hz updates
      while (this.accumulator >= TIMESTEP) {
        this.callbacks.tick(TIMESTEP);
        this.accumulator -= TIMESTEP;
      }

      // Interpolation alpha between previous and next physics state
      const alpha = this.accumulator / TIMESTEP;
      this.callbacks.render(alpha, delta * 1000);
    } else {
      // Still render while paused (e.g. for pause menu/overlay)
      this.callbacks.render(1.0, delta * 1000);
    }

    this.rafId = requestAnimationFrame(this.frame);
  }

  public destroy(): void {
    this.stop();
    window.removeEventListener('visibilitychange', this.onVisibilityChange);
  }
}

