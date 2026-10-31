import { RunStats, PlayerHistoryProfile } from '../stats/stats-tracker';
import { InputManager } from '../input/input-manager';
import { AudioSystem } from '../audio/audio-system';

export type UiScreen = 'menu' | 'playing' | 'crash' | 'pause' | 'progress' | 'settings' | 'tutorial';

export class HudUI {
  private container: HTMLElement;
  private currentScreen: UiScreen = 'menu';
  private lastDomUpdate: number = 0;

  // HUD elements
  private speedEl!: HTMLElement;
  private scoreEl!: HTMLElement;
  private comboEl!: HTMLElement;
  private boostFillEl!: HTMLElement;
  private reactionFlashEl!: HTMLElement;
  private activeDevicePillEl!: HTMLElement;

  // Overlay Screens
  private menuScreenEl!: HTMLElement;
  private crashScreenEl!: HTMLElement;
  private pauseScreenEl!: HTMLElement;
  private progressScreenEl!: HTMLElement;
  private settingsScreenEl!: HTMLElement;
  private tutorialScreenEl!: HTMLElement;

  // Callbacks
  private onStartGameCallback?: (mode: 'endless' | 'daily' | 'sprint' | 'drill') => void;
  private onRestartCallback?: () => void;
  private onResumeCallback?: () => void;
  private onBiomeChangeCallback?: (biome: string) => void;
  private onDensityChangeCallback?: (density: 'low' | 'moderate' | 'high') => void;

  constructor(
    container: HTMLElement,
    private inputManager: InputManager,
    private audioSystem: AudioSystem
  ) {
    this.container = container;
    this.buildDom();
    this.bindEvents();
  }

  public setCallbacks(callbacks: {
    onStartGame: (mode: 'endless' | 'daily' | 'sprint' | 'drill') => void;
    onRestart: () => void;
    onResume: () => void;
    onBiomeChange?: (biome: string) => void;
    onDensityChange?: (density: 'low' | 'moderate' | 'high') => void;
  }): void {
    this.onStartGameCallback = callbacks.onStartGame;
    this.onRestartCallback = callbacks.onRestart;
    this.onResumeCallback = callbacks.onResume;
    this.onBiomeChangeCallback = callbacks.onBiomeChange;
    this.onDensityChangeCallback = callbacks.onDensityChange;
  }

  private buildDom(): void {
    this.container.innerHTML = `
      <!-- IN-GAME HUD -->
      <div id="hud-root" class="hud-layer hidden">
        <!-- Top Left: Score & Multiplier -->
        <div class="hud-top-left">
          <div class="hud-label">SCORE</div>
          <div id="hud-score" class="hud-value-large">000000</div>
          <div id="hud-combo-badge" class="hud-combo-badge">x1.0 COMBO</div>
        </div>

        <!-- Top Right: Reflex Alert Flash -->
        <div class="hud-top-right">
          <div id="hud-reaction-flash" class="reaction-flash-card hidden">
            <span class="reaction-tag">REFLEX</span>
            <span id="hud-reaction-value" class="reaction-ms">210ms</span>
          </div>
          <div id="hud-device-pill" class="device-pill">⌨️ KEYBOARD</div>
        </div>

        <!-- Center Alert Banner for Drills & Warnings -->
        <div id="hud-drill-banner" class="drill-alert-banner hidden">
          <span id="drill-banner-text">⚠️ HAZARD DETECTED! EVADE!</span>
        </div>

        <!-- Bottom Left: Speedometer -->
        <div class="hud-bottom-left">
          <div class="speed-cluster">
            <span id="hud-speed-num" class="speed-digits">000</span>
            <span class="speed-unit">KM/H</span>
          </div>
          <div class="speed-bar-track">
            <div id="hud-speed-bar" class="speed-bar-fill"></div>
          </div>
        </div>

        <!-- Bottom Right: Boost Gauge -->
        <div class="hud-bottom-right">
          <div class="hud-label">NITRO BOOST [SPACE]</div>
          <div class="boost-gauge-container">
            <div id="hud-boost-bar" class="boost-gauge-fill" style="width: 50%"></div>
          </div>
        </div>
      </div>

      <!-- MAIN MENU -->
      <div id="screen-menu" class="overlay-screen active">
        <div class="brand-container">
          <h1 class="game-logo">RED<span class="text-neon-cyan">LINE</span></h1>
          <p class="game-tagline">SPLIT-SECOND REFLEX & TRAFFIC DECISION TRAINER</p>
        </div>

        <div class="menu-buttons-group">
          <button id="btn-play-endless" class="arcade-btn primary-btn">
            <span class="btn-icon">⚡</span> ENDLESS SURVIVAL
          </button>
          <button id="btn-play-daily" class="arcade-btn">
            <span class="btn-icon">📅</span> DAILY CHALLENGE (SEEDED)
          </button>
          <button id="btn-play-sprint" class="arcade-btn">
            <span class="btn-icon">⏱️</span> 60-SEC SPRINT ATTACK
          </button>
          <button id="btn-play-drill" class="arcade-btn">
            <span class="btn-icon">🎯</span> REACTION DRILL
          </button>
          
          <div class="menu-secondary-row">
            <button id="btn-open-progress" class="arcade-btn small-btn">📊 STATS</button>
            <button id="btn-open-tutorial" class="arcade-btn small-btn">📖 HOW TO PLAY</button>
            <button id="btn-open-settings" class="arcade-btn small-btn">⚙️ SETTINGS</button>
          </div>
        </div>

        <div class="menu-footer">
          <span class="footer-tip">CONTROLS: [A/D] or [←/→] STEER &nbsp;|&nbsp; [SPACE] BOOST &nbsp;|&nbsp; [S/↓] BRAKE</span>
        </div>
      </div>

      <!-- CRASH RESULTS OVERLAY -->
      <div id="screen-crash" class="overlay-screen hidden">
        <div class="crash-card">
          <div class="crash-header">
            <div class="crash-badge">VEHICLE COMPROMISED</div>
            <h2 id="crash-title" class="crash-title">REAR-END IMPACT</h2>
          </div>

          <div class="results-grid">
            <div class="result-tile">
              <span class="tile-label">FINAL SCORE</span>
              <span id="res-score" class="tile-val">0</span>
            </div>
            <div class="result-tile">
              <span class="tile-label">SURVIVAL TIME</span>
              <span id="res-time" class="tile-val">00:00</span>
            </div>
            <div class="result-tile">
              <span class="tile-label">AVG REFLEX</span>
              <span id="res-reaction" class="tile-val">0ms</span>
            </div>
            <div class="result-tile">
              <span class="tile-label">NEAR MISSES</span>
              <span id="res-nearmiss" class="tile-val">0</span>
            </div>
            <div class="result-tile">
              <span class="tile-label">TOP SPEED</span>
              <span id="res-speed" class="tile-val">0 KM/H</span>
            </div>
            <div class="result-tile">
              <span class="tile-label">DECISION ACCURACY</span>
              <span id="res-accuracy" class="tile-val">0%</span>
            </div>
          </div>

          <div class="instant-retry-box">
            <button id="btn-instant-retry" class="arcade-btn primary-btn large-btn">
              PRESS [R] OR CLICK TO RETRY
            </button>
            <button id="btn-crash-menu" class="arcade-btn small-btn">MAIN MENU</button>
          </div>
        </div>
      </div>

      <!-- PAUSE OVERLAY -->
      <div id="screen-pause" class="overlay-screen hidden">
        <div class="dialog-card">
          <h2 class="dialog-title">SIMULATION PAUSED</h2>
          <div class="menu-buttons-group">
            <button id="btn-pause-resume" class="arcade-btn primary-btn">RESUME [ESC]</button>
            <button id="btn-pause-restart" class="arcade-btn">RESTART RUN [R]</button>
            <button id="btn-pause-settings" class="arcade-btn">SETTINGS</button>
            <button id="btn-pause-menu" class="arcade-btn">MAIN MENU</button>
          </div>
        </div>
      </div>

      <!-- PROGRESS / STATS SCREEN -->
      <div id="screen-progress" class="overlay-screen hidden">
        <div class="dialog-card wide-dialog">
          <div class="dialog-header-row">
            <h2 class="dialog-title">TRAINING & REFLEX ANALYTICS</h2>
            <button id="btn-close-progress" class="close-x-btn">✕</button>
          </div>

          <!-- Personal Bests Bar -->
          <div class="pb-banner">
            <div class="pb-stat"><span class="pb-lbl">BEST SCORE</span><span id="pb-score" class="pb-val">0</span></div>
            <div class="pb-stat"><span class="pb-lbl">FASTEST REFLEX</span><span id="pb-reaction" class="pb-val">--</span></div>
            <div class="pb-stat"><span class="pb-lbl">MAX SURVIVAL</span><span id="pb-time" class="pb-val">0s</span></div>
            <div class="pb-stat"><span class="pb-lbl">MAX SPEED</span><span id="pb-speed" class="pb-val">0 km/h</span></div>
          </div>

          <!-- Chart Area -->
          <div class="chart-container">
            <div class="chart-title">REACTION TIME TREND (RECENT SESSIONS - LOWER IS FASTER)</div>
            <canvas id="reaction-chart-canvas" width="600" height="180"></canvas>
          </div>

          <div class="export-import-row">
            <button id="btn-export-json" class="arcade-btn small-btn">EXPORT JSON</button>
            <button id="btn-import-json" class="arcade-btn small-btn">IMPORT JSON</button>
            <input type="file" id="import-file-input" class="hidden" accept=".json" />
          </div>
        </div>
      </div>

      <!-- SETTINGS MODAL -->
      <div id="screen-settings" class="overlay-screen hidden">
        <div class="dialog-card wide-dialog">
          <div class="dialog-header-row">
            <h2 class="dialog-title">SYSTEM & CONTROL SETTINGS</h2>
            <button id="btn-close-settings" class="close-x-btn">✕</button>
          </div>

          <div class="settings-grid">
            <!-- Audio -->
            <div class="settings-group">
              <h3 class="group-title">AUDIO</h3>
              <label class="setting-item">
                <span>Master Volume</span>
                <input type="range" id="vol-master" min="0" max="1" step="0.05" value="0.8" />
              </label>
              <label class="setting-item">
                <span>Sound FX</span>
                <input type="range" id="vol-sfx" min="0" max="1" step="0.05" value="0.85" />
              </label>
              <label class="setting-item">
                <span>Synth Music</span>
                <input type="range" id="vol-music" min="0" max="1" step="0.05" value="0.65" />
              </label>
              <label class="setting-item">
                <span>Mute All Audio</span>
                <input type="checkbox" id="chk-mute" />
              </label>
            </div>

            <!-- Controls & Feel -->
            <div class="settings-group">
              <h3 class="group-title">INPUT DYNAMICS</h3>
              <label class="setting-item">
                <span>Mouse Sensitivity</span>
                <input type="range" id="mouse-sens" min="0.5" max="2.0" step="0.1" value="1.0" />
              </label>
              <label class="setting-item">
                <span>Gamepad Deadzone</span>
                <input type="range" id="gp-deadzone" min="0.05" max="0.35" step="0.02" value="0.15" />
              </label>
              <label class="setting-item">
                <span>Light Lane Assist</span>
                <input type="checkbox" id="chk-lane-assist" />
              </label>
              <label class="setting-item">
                <span>Controller Rumble</span>
                <input type="checkbox" id="chk-haptics" checked />
              </label>
            </div>

            <!-- Accessibility & Biomes -->
            <div class="settings-group">
              <h3 class="group-title">ACCESSIBILITY & GRAPHICS</h3>
              <label class="setting-item">
                <span>Traffic Density</span>
                <select id="sel-density">
                  <option value="low">Low (Spacious Gaps)</option>
                  <option value="moderate" selected>Moderate (Standard Waves)</option>
                  <option value="high">High (Dense Adrenaline)</option>
                </select>
              </label>
              <label class="setting-item">
                <span>Visual Biome</span>
                <select id="sel-biome">
                  <option value="metropolis">Neon Metropolis</option>
                  <option value="sunset">Sunset Ridge</option>
                  <option value="coastal">Coastal Midnight</option>
                  <option value="cyberStorm">Cyber Storm</option>
                </select>
              </label>
              <label class="setting-item">
                <span>Reduced Motion</span>
                <input type="checkbox" id="chk-reduced-motion" />
              </label>
              <label class="setting-item">
                <span>High-Contrast Colorblind Mode</span>
                <input type="checkbox" id="chk-colorblind" />
              </label>
            </div>
          </div>
        </div>
      </div>

      <!-- 30-SECOND TUTORIAL SCREEN -->
      <div id="screen-tutorial" class="overlay-screen hidden">
        <div class="dialog-card wide-dialog">
          <div class="dialog-header-row">
            <h2 class="dialog-title">REDLINE FLIGHT MANUAL (30-SECOND GUIDE)</h2>
            <button id="btn-close-tutorial" class="close-x-btn">✕</button>
          </div>

          <div class="tutorial-steps">
            <div class="tut-step-card">
              <div class="step-num">01</div>
              <h4>STEER PRECISELY</h4>
              <p>Use [A]/[D] or [←]/[→] to dodge. Controls are instantaneous with razor responsiveness.</p>
            </div>
            <div class="tut-step-card">
              <div class="step-num">02</div>
              <h4>NEAR-MISS TO SURGE</h4>
              <p>Passing traffic at shaved proximity charges your Nitro Boost and multiplies score combos!</p>
            </div>
            <div class="tut-step-card">
              <div class="step-num">03</div>
              <h4>BRAKE VS BOOST</h4>
              <p>Press [SPACE] to boost into supersonic overdrive. Press [S] / [↓] to brake if blocked (resets combo!).</p>
            </div>
            <div class="tut-step-card">
              <div class="step-num">04</div>
              <h4>READ TELEGRAPHS</h4>
              <p>Watch for blinking amber indicators and brake lights before cars switch lanes.</p>
            </div>
          </div>

          <div class="center-cta">
            <button id="btn-tut-start" class="arcade-btn primary-btn large-btn">I AM READY TO REDLINE</button>
          </div>
        </div>
      </div>
    `;

    // Query HUD elements
    this.speedEl = this.container.querySelector('#hud-speed-num')!;
    this.scoreEl = this.container.querySelector('#hud-score')!;
    this.comboEl = this.container.querySelector('#hud-combo-badge')!;
    this.boostFillEl = this.container.querySelector('#hud-boost-bar')!;
    this.reactionFlashEl = this.container.querySelector('#hud-reaction-flash')!;
    this.activeDevicePillEl = this.container.querySelector('#hud-device-pill')!;

    // Query screens
    this.menuScreenEl = this.container.querySelector('#screen-menu')!;
    this.crashScreenEl = this.container.querySelector('#screen-crash')!;
    this.pauseScreenEl = this.container.querySelector('#screen-pause')!;
    this.progressScreenEl = this.container.querySelector('#screen-progress')!;
    this.settingsScreenEl = this.container.querySelector('#screen-settings')!;
    this.tutorialScreenEl = this.container.querySelector('#screen-tutorial')!;
  }

  private bindEvents(): void {
    // Mode Buttons
    this.container.querySelector('#btn-play-endless')?.addEventListener('click', () => {
      this.audioSystem.init();
      this.audioSystem.playUiBlip();
      this.onStartGameCallback?.('endless');
    });

    this.container.querySelector('#btn-play-daily')?.addEventListener('click', () => {
      this.audioSystem.init();
      this.audioSystem.playUiBlip();
      this.onStartGameCallback?.('daily');
    });

    this.container.querySelector('#btn-play-sprint')?.addEventListener('click', () => {
      this.audioSystem.init();
      this.audioSystem.playUiBlip();
      this.onStartGameCallback?.('sprint');
    });

    this.container.querySelector('#btn-play-drill')?.addEventListener('click', () => {
      this.audioSystem.init();
      this.audioSystem.playUiBlip();
      this.onStartGameCallback?.('drill');
    });

    // Sub-menus
    this.container.querySelector('#btn-open-progress')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.showScreen('progress');
    });
    this.container.querySelector('#btn-close-progress')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.showScreen('menu');
    });

    this.container.querySelector('#btn-open-tutorial')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.showScreen('tutorial');
    });
    this.container.querySelector('#btn-close-tutorial')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.showScreen('menu');
    });
    this.container.querySelector('#btn-tut-start')?.addEventListener('click', () => {
      this.audioSystem.init();
      this.audioSystem.playUiBlip();
      this.onStartGameCallback?.('endless');
    });

    this.container.querySelector('#btn-open-settings')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.showScreen('settings');
    });
    this.container.querySelector('#btn-close-settings')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.showScreen(this.previousScreenBeforeSettings);
    });

    // Crash instant retry
    this.container.querySelector('#btn-instant-retry')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.onRestartCallback?.();
    });
    this.container.querySelector('#btn-crash-menu')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.showScreen('menu');
    });

    // Pause menu
    this.container.querySelector('#btn-pause-resume')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.onResumeCallback?.();
    });
    this.container.querySelector('#btn-pause-restart')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.onRestartCallback?.();
    });
    this.container.querySelector('#btn-pause-settings')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.showScreen('settings');
    });
    this.container.querySelector('#btn-pause-menu')?.addEventListener('click', () => {
      this.audioSystem.playUiBlip();
      this.showScreen('menu');
    });

    // Settings controls bindings
    const volMaster = this.container.querySelector('#vol-master') as HTMLInputElement;
    volMaster?.addEventListener('input', (e) => {
      this.audioSystem.setMasterVolume(parseFloat((e.target as HTMLInputElement).value));
    });
    const volSfx = this.container.querySelector('#vol-sfx') as HTMLInputElement;
    volSfx?.addEventListener('input', (e) => {
      this.audioSystem.setSfxVolume(parseFloat((e.target as HTMLInputElement).value));
    });
    const volMusic = this.container.querySelector('#vol-music') as HTMLInputElement;
    volMusic?.addEventListener('input', (e) => {
      this.audioSystem.setMusicVolume(parseFloat((e.target as HTMLInputElement).value));
    });
    const chkMute = this.container.querySelector('#chk-mute') as HTMLInputElement;
    chkMute?.addEventListener('change', () => {
      this.audioSystem.toggleMute();
    });

    const mouseSens = this.container.querySelector('#mouse-sens') as HTMLInputElement;
    mouseSens?.addEventListener('input', (e) => {
      this.inputManager.updateSettings({ mouseSensitivity: parseFloat((e.target as HTMLInputElement).value) });
    });
    const gpDeadzone = this.container.querySelector('#gp-deadzone') as HTMLInputElement;
    gpDeadzone?.addEventListener('input', (e) => {
      this.inputManager.updateSettings({ gamepadDeadzone: parseFloat((e.target as HTMLInputElement).value) });
    });
    const chkLaneAssist = this.container.querySelector('#chk-lane-assist') as HTMLInputElement;
    chkLaneAssist?.addEventListener('change', (e) => {
      this.inputManager.updateSettings({ laneAssist: (e.target as HTMLInputElement).checked });
    });
    const chkHaptics = this.container.querySelector('#chk-haptics') as HTMLInputElement;
    chkHaptics?.addEventListener('change', (e) => {
      this.inputManager.updateSettings({ hapticsEnabled: (e.target as HTMLInputElement).checked });
    });

    const chkReducedMotion = this.container.querySelector('#chk-reduced-motion') as HTMLInputElement;
    chkReducedMotion?.addEventListener('change', (e) => {
      document.body.classList.toggle('reduced-motion', (e.target as HTMLInputElement).checked);
    });

    const chkColorblind = this.container.querySelector('#chk-colorblind') as HTMLInputElement;
    chkColorblind?.addEventListener('change', (e) => {
      document.body.classList.toggle('colorblind-mode', (e.target as HTMLInputElement).checked);
    });

    const selDensity = this.container.querySelector('#sel-density') as HTMLSelectElement;
    // Load saved density if present
    const savedDensity = localStorage.getItem('redline_traffic_density');
    if (savedDensity && selDensity) {
      selDensity.value = savedDensity;
    }
    selDensity?.addEventListener('change', (e) => {
      const val = (e.target as HTMLSelectElement).value as 'low' | 'moderate' | 'high';
      try { localStorage.setItem('redline_traffic_density', val); } catch {}
      this.onDensityChangeCallback?.(val);
    });

    const selBiome = this.container.querySelector('#sel-biome') as HTMLSelectElement;
    selBiome?.addEventListener('change', (e) => {
      this.onBiomeChangeCallback?.((e.target as HTMLSelectElement).value);
    });

    // Export / Import JSON
    this.container.querySelector('#btn-export-json')?.addEventListener('click', () => {
      const statsTracker = (window as any)._redlineStatsTracker;
      if (statsTracker) {
        const json = statsTracker.exportDataAsJson();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `redline-reflex-stats-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });

    const fileInput = this.container.querySelector('#import-file-input') as HTMLInputElement;
    this.container.querySelector('#btn-import-json')?.addEventListener('click', () => {
      fileInput?.click();
    });
    fileInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          const statsTracker = (window as any)._redlineStatsTracker;
          if (statsTracker && typeof reader.result === 'string') {
            const ok = statsTracker.importDataFromJson(reader.result);
            if (ok) {
              alert('Stats successfully imported!');
              this.populateProgressScreen(statsTracker.getProfile());
            } else {
              alert('Failed to parse stats JSON file.');
            }
          }
        };
        reader.readAsText(file);
      }
    });
  }

  private previousScreenBeforeSettings: UiScreen = 'menu';

  public showScreen(screen: UiScreen): void {
    if (screen === 'settings' && this.currentScreen !== 'settings') {
      this.previousScreenBeforeSettings = this.currentScreen;
    }
    this.currentScreen = screen;

    const hudRoot = this.container.querySelector('#hud-root');
    hudRoot?.classList.toggle('hidden', screen !== 'playing');

    this.menuScreenEl.classList.toggle('hidden', screen !== 'menu');
    this.crashScreenEl.classList.toggle('hidden', screen !== 'crash');
    this.pauseScreenEl.classList.toggle('hidden', screen !== 'pause');
    this.progressScreenEl.classList.toggle('hidden', screen !== 'progress');
    this.settingsScreenEl.classList.toggle('hidden', screen !== 'settings');
    this.tutorialScreenEl.classList.toggle('hidden', screen !== 'tutorial');
  }

  public getScreen(): UiScreen {
    return this.currentScreen;
  }

  /**
   * Fast HUD refresh (~10Hz for DOM efficiency)
   */
  public updateHud(
    speedKmh: number,
    score: number,
    combo: number,
    boostPct: number,
    activeDevice: string,
    now: number
  ): void {
    if (this.currentScreen !== 'playing') return;
    if (now - this.lastDomUpdate < 95) return; // ~10Hz limit
    this.lastDomUpdate = now;

    this.speedEl.textContent = Math.round(speedKmh).toString().padStart(3, '0');
    this.scoreEl.textContent = Math.round(score).toString().padStart(6, '0');
    this.comboEl.textContent = `x${combo.toFixed(1)} COMBO`;
    this.boostFillEl.style.width = `${Math.min(100, Math.max(0, boostPct))}%`;

    const icon = activeDevice === 'gamepad' ? '🎮 GAMEPAD' : (activeDevice === 'mouse' ? '🖱️ MOUSE' : '⌨️ KEYBOARD');
    this.activeDevicePillEl.textContent = icon;
  }

  public flashReactionTime(ms: number): void {
    const valEl = this.container.querySelector('#hud-reaction-value');
    if (valEl) valEl.textContent = `${ms}ms`;
    this.reactionFlashEl.classList.remove('hidden');
    setTimeout(() => {
      this.reactionFlashEl.classList.add('hidden');
    }, 1200);
  }

  public flashDrillAlert(text: string, isSuccess: boolean = false): void {
    const banner = this.container.querySelector('#hud-drill-banner') as HTMLElement;
    const textEl = this.container.querySelector('#drill-banner-text') as HTMLElement;
    if (banner && textEl) {
      textEl.textContent = text;
      banner.classList.toggle('drill-success', isSuccess);
      banner.classList.remove('hidden');
      setTimeout(() => {
        banner.classList.add('hidden');
      }, isSuccess ? 1400 : 1800);
    }
  }

  public showCrashResults(run: RunStats, profile: PlayerHistoryProfile): void {
    this.showScreen('crash');

    const titleEl = this.container.querySelector('#crash-title');
    if (titleEl) titleEl.textContent = run.crashCause?.toUpperCase() || 'CRASH DETECTED';

    const mins = Math.floor(run.durationSec / 60);
    const secs = Math.floor(run.durationSec % 60);
    const timeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    this.container.querySelector('#res-score')!.textContent = run.score.toLocaleString();
    this.container.querySelector('#res-time')!.textContent = timeStr;
    this.container.querySelector('#res-reaction')!.textContent = run.avgReactionTimeMs > 0 ? `${run.avgReactionTimeMs}ms` : '--';
    this.container.querySelector('#res-nearmiss')!.textContent = run.nearMissCount.toString();
    this.container.querySelector('#res-speed')!.textContent = `${Math.round(run.maxSpeedKmh)} KM/H`;
    this.container.querySelector('#res-accuracy')!.textContent = `${run.decisionAccuracyPct}%`;

    // Populate progress
    this.populateProgressScreen(profile);
  }

  public populateProgressScreen(profile: PlayerHistoryProfile): void {
    const pb = profile.personalBests;
    this.container.querySelector('#pb-score')!.textContent = pb.highScore.toLocaleString();
    this.container.querySelector('#pb-reaction')!.textContent = pb.fastestReactionMs < 9000 ? `${pb.fastestReactionMs}ms` : '--';
    this.container.querySelector('#pb-time')!.textContent = `${pb.longestSurvivalSec}s`;
    this.container.querySelector('#pb-speed')!.textContent = `${pb.highestSpeedKmh} km/h`;

    // Draw Reaction Trend Chart
    const canvas = this.container.querySelector('#reaction-chart-canvas') as HTMLCanvasElement;
    if (canvas) {
      this.drawReactionTrendChart(canvas, profile.runs);
    }
  }

  private drawReactionTrendChart(canvas: HTMLCanvasElement, runs: RunStats[]): void {
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.fillStyle = '#0e0b1a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#221d3b';
    ctx.lineWidth = 1;
    for (let y = 30; y < h; y += 35) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();
    }

    // Filter runs with valid avg reaction time
    const dataPoints = runs
      .filter((r) => r.avgReactionTimeMs > 0)
      .slice(0, 15)
      .reverse();

    if (dataPoints.length < 2) {
      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Complete more runs to view your reaction learning curve.', w / 2, h / 2);
      return;
    }

    const minMs = 150;
    const maxMs = 500;
    const paddingX = 50;
    const paddingY = 25;
    const stepX = (w - paddingX - 30) / (dataPoints.length - 1);

    // Draw line
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const points: [number, number][] = [];
    dataPoints.forEach((d, idx) => {
      const px = paddingX + idx * stepX;
      const normalized = Math.max(0, Math.min(1, (d.avgReactionTimeMs - minMs) / (maxMs - minMs)));
      const py = (h - paddingY) - (1 - normalized) * (h - paddingY * 2);
      points.push([px, py]);
      if (idx === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Draw dots and values
    points.forEach(([px, py], i) => {
      ctx.fillStyle = '#ff0055';
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${dataPoints[i].avgReactionTimeMs}ms`, px, py - 8);
    });
  }
}
