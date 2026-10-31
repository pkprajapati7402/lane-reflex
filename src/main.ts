import { GameLoop } from './core/loop';
import { PRNG } from './core/prng';
import { ObjectPool } from './core/pool';
import { ROAD, PLAYER, TRAFFIC } from './core/constants';
import { InputManager } from './input/input-manager';
import { Road } from './game/road';
import { Player } from './game/player';
import { TrafficCar, createTrafficCar, resetTrafficCar, updateTrafficCar } from './game/traffic';
import { TrafficSpawner } from './game/spawner';
import { CollisionSystem } from './game/collision';
import { Camera } from './render/camera';
import { SpriteAtlas } from './render/sprites';
import { ParticleSystem } from './render/particles';
import { Renderer } from './render/renderer';
import { AudioSystem } from './audio/audio-system';
import { StatsTracker } from './stats/stats-tracker';
import { HudUI } from './ui/hud';

export type GameMode = 'endless' | 'daily' | 'sprint' | 'drill';

class RedlineGame {
  private prng: PRNG;
  private loop: GameLoop;
  private input: InputManager;
  private road: Road;
  private player: Player;
  private trafficPool: ObjectPool<TrafficCar>;
  private spawner: TrafficSpawner;
  private collision: CollisionSystem;
  private camera: Camera;
  private sprites: SpriteAtlas;
  private particles: ParticleSystem;
  private renderer: Renderer;
  private audio: AudioSystem;
  private stats: StatsTracker;
  private hud: HudUI;

  // Game state
  private activeMode: GameMode = 'endless';
  private isRunningSession: boolean = false;
  private sessionElapsed: number = 0;
  private score: number = 0;
  private comboMultiplier: number = 1.0;
  private comboTimer: number = 0;
  private sprintTimeRemaining: number = 60.0;

  // Reaction drill state
  private drillNextHazardZ: number = 0;
  private drillTrialsCompleted: number = 0;
  private drillMaxTrials: number = 8;

  constructor() {
    this.prng = new PRNG(1337);
    this.road = new Road();
    this.player = new Player();
    this.camera = new Camera();
    this.sprites = new SpriteAtlas();
    this.particles = new ParticleSystem();
    this.collision = new CollisionSystem();
    this.audio = new AudioSystem();
    this.stats = new StatsTracker();
    (window as any)._redlineStatsTracker = this.stats;
    (window as any)._redlineGame = this;

    // Traffic object pool (32 concurrent cars max)
    this.trafficPool = new ObjectPool<TrafficCar>(
      createTrafficCar,
      32,
      resetTrafficCar
    );
    this.spawner = new TrafficSpawner(this.prng, this.trafficPool);

    // Load saved traffic density if set
    try {
      const savedDensity = localStorage.getItem('redline_traffic_density');
      if (savedDensity) {
        this.spawner.setDensityMode(savedDensity as any);
      }
    } catch {}

    // Canvas & Renderer
    const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.renderer = new Renderer(canvas, this.sprites, this.particles);

    // Input manager
    this.input = new InputManager();
    this.input.attachCanvas(canvas);

    // UI & HUD
    const uiContainer = document.getElementById('app-ui') as HTMLElement;
    this.hud = new HudUI(uiContainer, this.input, this.audio);

    this.hud.setCallbacks({
      onStartGame: (mode) => this.startRun(mode),
      onRestart: () => this.restartRun(),
      onResume: () => this.resumeGame(),
      onBiomeChange: (biome) => this.road.setBiome(biome as any),
      onDensityChange: (density) => this.spawner.setDensityMode(density),
      onReturnToMenu: () => {
        this.isRunningSession = false;
        this.audio.silenceEngineAndBoost();
        this.audio.stopMusic();
      },
    });

    // Populate profile initially
    this.hud.populateProgressScreen(this.stats.getProfile());

    // Window resize handling
    window.addEventListener('resize', () => {
      this.renderer.handleResize();
    });

    // Game loop setup
    this.loop = new GameLoop({
      tick: (dt) => this.tick(dt),
      render: (alpha, frameTimeMs) => this.render(alpha, frameTimeMs),
    });

    this.loop.start();
  }

  private getDailySeed(): number {
    const d = new Date();
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }

  public startRun(mode: GameMode): void {
    this.activeMode = mode;
    this.isRunningSession = true;
    this.sessionElapsed = 0;
    this.score = 0;
    this.comboMultiplier = 1.0;
    this.comboTimer = 0;
    this.sprintTimeRemaining = 60.0;

    const seed = mode === 'daily' ? this.getDailySeed() : Math.floor(Math.random() * 1000000);
    this.prng.setSeed(seed);

    this.player.reset();
    this.trafficPool.clear();
    this.spawner.reset(seed);
    this.particles.reset();

    if (mode === 'drill') {
      this.drillTrialsCompleted = 0;
      this.drillNextHazardZ = 4500;
    }

    this.stats.startRun(mode);
    this.hud.showScreen('playing');
    this.audio.resumeIfSuspended();
    this.audio.setComboTier(1);
    this.audio.startMusic();
  }

  public restartRun(): void {
    // Instant frictionless retry in <0.05s!
    this.startRun(this.activeMode);
  }

  public pauseGame(): void {
    if (!this.isRunningSession || this.player.isCrashed) return;
    this.audio.silenceEngineAndBoost();
    this.audio.stopMusic();
    this.loop.pause();
    this.hud.showScreen('pause');
  }

  public resumeGame(): void {
    this.audio.startMusic();
    this.loop.resume();
    this.hud.showScreen('playing');
  }

  /**
   * Fixed 60Hz Physics Simulation Tick
   */
  private tick(dt: number): void {
    // 1. Sample inputs at the start of tick
    const inputState = this.input.sample();

    // Global pause edge trigger
    if (inputState.pause) {
      if (this.hud.getScreen() === 'playing') {
        this.pauseGame();
        return;
      } else if (this.hud.getScreen() === 'pause') {
        this.resumeGame();
        return;
      }
    }

    // Instant restart edge trigger
    if (inputState.restart && (this.isRunningSession || this.player.isCrashed)) {
      this.restartRun();
      return;
    }

    // If on menus or paused, nothing to simulate
    if (!this.isRunningSession || this.loop.paused) {
      return;
    }

    // 2. Handle Crash State
    if (this.player.isCrashed) {
      this.player.update(dt, inputState, false);
      this.particles.update(dt);
      // Wait for hitstop freeze, then show crash screen
      if (this.player.hitstopRemaining <= 0 && this.hud.getScreen() === 'playing') {
        const lastRun = this.stats.endRun('Traffic Collision');
        if (lastRun) {
          this.hud.showCrashResults(lastRun, this.stats.getProfile());
        }
      }
      return;
    }

    this.sessionElapsed += dt;

    // 3. Sprint mode countdown
    if (this.activeMode === 'sprint') {
      this.sprintTimeRemaining -= dt;
      if (this.sprintTimeRemaining <= 0) {
        // Complete Sprint
        this.player.isCrashed = true;
        this.audio.silenceEngineAndBoost();
        this.audio.stopMusic();
        const lastRun = this.stats.endRun('Sprint Time Complete');
        if (lastRun) {
          this.hud.showCrashResults(lastRun, this.stats.getProfile());
        }
        return;
      }
    }

    // 4. Update Player Physics
    const settings = this.input.getSettings();
    this.player.rampDifficulty(this.score, this.sessionElapsed);
    this.player.update(dt, inputState, settings.laneAssist);

    // 5. Update Traffic
    const activeTraffic = this.trafficPool.activeItems;
    for (const car of activeTraffic) {
      updateTrafficCar(car, dt);

      // Register threats into stats reflex tracker
      const nowMs = performance.now();
      this.stats.registerHazardIfThreat(
        car.id,
        car.z,
        car.x,
        this.player.z,
        this.player.x,
        nowMs
      );
    }

    // Evaluate steering reactions for training metrics
    const speedKmh = (this.player.speed / PLAYER.MAX_SPEED) * 200;
    this.stats.evaluatePlayerReaction(inputState.steer, this.player.x, speedKmh, performance.now());

    // 6. Spawner & Reaction Drill Logic
    if (this.activeMode === 'drill') {
      // In reaction drill mode, spawn unexpected hazards directly in player's path
      if (this.player.z > this.drillNextHazardZ - 10000 && this.drillTrialsCompleted < this.drillMaxTrials) {
        // Find player's closest lane
        let closestLane: number = ROAD.LANE_POSITIONS[0];
        let minDiff = 999;
        for (const l of ROAD.LANE_POSITIONS) {
          const diff = Math.abs(this.player.x - l);
          if (diff < minDiff) { minDiff = diff; closestLane = l; }
        }
        const laneIdx = (ROAD.LANE_POSITIONS as readonly number[]).indexOf(closestLane);

        const hazardCar = this.trafficPool.acquire();
        hazardCar.active = true;
        hazardCar.type = this.drillTrialsCompleted % 3 === 2 ? 'truck' : 'sedan';
        hazardCar.lane = laneIdx;
        hazardCar.x = closestLane;
        hazardCar.startX = closestLane;
        hazardCar.targetX = closestLane;
        hazardCar.z = this.player.z + 7800; // ~1.1s biological reaction window
        hazardCar.speed = this.player.speed * 0.35;
        hazardCar.baseSpeed = hazardCar.speed;
        hazardCar.color = '#ef4444';
        hazardCar.isBraking = true; // Brake lights glaring

        this.drillTrialsCompleted++;
        this.drillNextHazardZ = this.player.z + 26000;
        this.hud.flashDrillAlert(`⚠️ DRILL ${this.drillTrialsCompleted}/${this.drillMaxTrials}: HAZARD IN LANE! EVADE!`);
      }

      // Despawn passed cars in drill mode so pool stays clean
      for (let i = 0; i < this.trafficPool.count; i++) {
        const car = this.trafficPool.get(i);
        if (car.active && car.z < this.player.z - TRAFFIC.DESPAWN_BEHIND_DISTANCE) {
          resetTrafficCar(car);
          this.trafficPool.release(i);
          i--;
        }
      }

      // Check drill completion when all trials are passed
      if (this.drillTrialsCompleted >= this.drillMaxTrials && this.trafficPool.count === 0 && !this.player.isCrashed) {
        this.player.isCrashed = true;
        this.audio.silenceEngineAndBoost();
        this.audio.stopMusic();
        const run = this.stats.endRun('Reaction Drill Complete');
        if (run) {
          this.hud.showCrashResults(run, this.stats.getProfile());
        }
        return;
      }
    } else {
      const difficultyTier = Math.min(10, 1 + Math.floor(this.sessionElapsed / 15) + Math.floor(this.score / 5000));
      this.spawner.setDifficultyTier(difficultyTier);
      this.spawner.update(this.player.z, this.player.speed);
    }

    // 7. Collision & Near-Miss Resolution
    const collisionResult = this.collision.checkCollisions(this.player, activeTraffic);

    if (collisionResult.hasCrashed) {
      // CRASH!
      this.player.crash();
      this.camera.triggerShake(28);
      this.input.triggerHaptics(300, 1.0, 1.0); // Heavy controller rumble
      this.audio.handleCrash();

      // Crash debris explosion at player screen position
      this.particles.spawnCrashDebris(this.renderer.width / 2, this.renderer.height - 80, 50);
      return;
    }

    // Handle Near-Miss events
    for (const nm of collisionResult.nearMisses) {
      this.stats.recordNearMiss();
      this.player.addBoost(nm.boostBonus);

      // Combo ramp
      this.comboMultiplier = Math.min(8.0, this.comboMultiplier + 0.5);
      this.comboTimer = 4.0; // 4 second combo grace period
      this.audio.setComboTier(Math.min(5, Math.floor(this.comboMultiplier)));

      // Score bonus with combo
      const addedScore = Math.round(nm.scoreBonus * this.comboMultiplier);
      this.score += addedScore;

      // AV Feedback
      this.renderer.triggerNearMissPulse();
      this.camera.triggerShake(nm.closeness === 'EXTREME' ? 7 : 4);
      this.audio.playNearMissWhoosh(nm.closeness);
      this.input.triggerHaptics(90, 0.5, 0.2); // Light haptic kick

      // Floating text pop
      const label = nm.closeness === 'EXTREME' ? '🔥 EXTREME NEAR-MISS!' : (nm.closeness === 'RAZOR' ? '⚡ RAZOR SHARP!' : 'NEAR MISS!');
      this.particles.spawnFloatingText(
        `${label} +${addedScore}`,
        (this.renderer.width / 2) + (this.player.steerAngle * 40),
        this.renderer.height - 180,
        nm.closeness === 'EXTREME' ? '#ff0055' : '#00f0ff'
      );
    }

    // Combo timer decay: braking immediately drops combo, otherwise decays over 4s
    if (this.player.isBraking) {
      this.comboMultiplier = 1.0;
      this.comboTimer = 0;
      this.audio.setComboTier(1);
    } else if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboMultiplier = Math.max(1.0, this.comboMultiplier - 0.5);
        if (this.comboMultiplier > 1.0) {
          this.comboTimer = 1.5;
        }
        this.audio.setComboTier(Math.min(5, Math.floor(this.comboMultiplier)));
      }
    }

    // Distance score accumulation
    this.score += Math.round((this.player.speed * dt * 0.05) * this.comboMultiplier);

    // Update Particles
    this.particles.update(dt);

    // Update Stats Tracker
    this.stats.updateMetrics(dt, speedKmh, this.score, this.comboMultiplier);

    // Audio Engine Sound modulation
    const speedRatio = Math.min(1.0, this.player.speed / PLAYER.MAX_SPEED);
    this.audio.updateEngine(speedRatio, this.player.isBoosting, this.player.isBraking);
  }

  /**
   * Render interpolation frame
   */
  private render(_alpha: number, _frameTimeMs: number): void {
    const seg = this.road.findSegment(this.player.z);
    this.camera.update(1 / 60, this.player, seg.p1.world.y);

    this.renderer.render(
      this.road,
      this.player,
      this.camera,
      this.trafficPool.activeItems,
      1 / 60
    );

    // Update HUD
    const speedKmh = (this.player.speed / PLAYER.MAX_SPEED) * 200;
    this.hud.updateHud(
      speedKmh,
      this.score,
      this.comboMultiplier,
      this.player.boostMeter,
      this.input.getState().activeDevice,
      performance.now()
    );
  }
}

// Bootstrap on DOM content loaded
window.addEventListener('DOMContentLoaded', () => {
  new RedlineGame();

  // Register PWA service worker if supported
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Ignore SW registration errors in non-PWA environments
    });
  }
});
