/**
 * Training & Reflex Measurement System for REDLINE.
 * Tracks per-event reaction latency, decision accuracy, near-miss frequency,
 * and maintains versioned session history with export/import capabilities.
 */

export interface ReactionEvent {
  id: number;
  timestamp: number;
  hazardCarId: number;
  reactionTimeMs: number; // Latency from threat entry to player avoidance steering
  successful: boolean;    // Avoided vs crashed
  avoidanceDirection: 'left' | 'right';
  playerSpeedKmh: number;
}

export interface RunStats {
  id: string;
  timestamp: number;
  mode: 'endless' | 'daily' | 'sprint' | 'drill';
  score: number;
  durationSec: number;
  distanceMeters: number;
  maxSpeedKmh: number;
  avgSpeedKmh: number;
  nearMissCount: number;
  nearMissRatePerMin: number;
  bestCombo: number;
  avgReactionTimeMs: number;
  bestReactionTimeMs: number;
  decisionAccuracyPct: number;
  crashCause: string | null;
  reactionEvents: ReactionEvent[];
}

export interface PlayerHistoryProfile {
  schemaVersion: number;
  runs: RunStats[];
  personalBests: {
    highScore: number;
    longestSurvivalSec: number;
    highestSpeedKmh: number;
    fastestReactionMs: number;
    highestCombo: number;
    mostNearMisses: number;
  };
}

const STORAGE_KEY = 'redline_player_history_v1';
const CURRENT_SCHEMA_VERSION = 1;

export class StatsTracker {
  private profile: PlayerHistoryProfile;
  private currentRun: RunStats | null = null;
  private trackedHazards: Map<number, { detectedAt: number; initialPlayerLane: number; initialPlayerX: number }> = new Map();
  private speedSamples: number[] = [];
  private speedSampleTimer: number = 0;

  constructor() {
    this.profile = this.loadProfile();
  }

  public startRun(mode: 'endless' | 'daily' | 'sprint' | 'drill'): void {
    this.currentRun = {
      id: `run_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: Date.now(),
      mode,
      score: 0,
      durationSec: 0,
      distanceMeters: 0,
      maxSpeedKmh: 0,
      avgSpeedKmh: 0,
      nearMissCount: 0,
      nearMissRatePerMin: 0,
      bestCombo: 1,
      avgReactionTimeMs: 0,
      bestReactionTimeMs: 9999,
      decisionAccuracyPct: 100,
      crashCause: null,
      reactionEvents: [],
    };
    this.trackedHazards.clear();
    this.speedSamples = [];
    this.speedSampleTimer = 0;
  }

  /**
   * Monitor potential hazards entering player's critical reflex horizon
   * (within 12000 world units ~ 1.0-1.5s ahead in the player's lane)
   */
  public registerHazardIfThreat(
    carId: number,
    carZ: number,
    carX: number,
    playerZ: number,
    playerX: number,
    nowMs: number
  ): void {
    if (!this.currentRun) return;
    if (this.trackedHazards.has(carId)) return;

    const deltaZ = carZ - playerZ;
    const deltaX = Math.abs(carX - playerX);

    // Hazard criteria: car is ahead within reflex window and in same lane corridor
    if (deltaZ > 500 && deltaZ < 11000 && deltaX < 0.22) {
      this.trackedHazards.set(carId, {
        detectedAt: nowMs,
        initialPlayerLane: Math.round(playerX * 2),
        initialPlayerX: playerX,
      });
    }
  }

  /**
   * Evaluates if current player steering input represents a reaction to an active threat
   */
  public evaluatePlayerReaction(playerSteerInput: number, playerX: number, playerSpeedKmh: number, nowMs: number): void {
    if (!this.currentRun || Math.abs(playerSteerInput) < 0.25) return;

    for (const [carId, threat] of this.trackedHazards.entries()) {
      const reactionTimeMs = Math.round(nowMs - threat.detectedAt);

      // Reasonable biological human reflex window (100ms to 1800ms)
      if (reactionTimeMs >= 90 && reactionTimeMs <= 1800) {
        // Player steered away from original position
        const lateralDisplacement = playerX - threat.initialPlayerX;
        const steerDir = Math.sign(playerSteerInput) > 0 ? 'right' : 'left';

        // Check if steer is away from collision course
        if (Math.abs(lateralDisplacement) > 0.08 || Math.abs(playerSteerInput) > 0.35) {
          const event: ReactionEvent = {
            id: this.currentRun.reactionEvents.length + 1,
            timestamp: nowMs,
            hazardCarId: carId,
            reactionTimeMs,
            successful: true, // tentatively successful until crash check
            avoidanceDirection: steerDir,
            playerSpeedKmh,
          };
          this.currentRun.reactionEvents.push(event);
          this.trackedHazards.delete(carId);

          if (reactionTimeMs < this.currentRun.bestReactionTimeMs) {
            this.currentRun.bestReactionTimeMs = reactionTimeMs;
          }
          break;
        }
      }
    }
  }

  public recordNearMiss(): void {
    if (!this.currentRun) return;
    this.currentRun.nearMissCount++;
  }

  public updateMetrics(dt: number, currentSpeedKmh: number, score: number, combo: number): void {
    if (!this.currentRun) return;

    this.currentRun.durationSec += dt;
    this.currentRun.score = score;
    this.currentRun.bestCombo = Math.max(this.currentRun.bestCombo, combo);
    this.currentRun.maxSpeedKmh = Math.max(this.currentRun.maxSpeedKmh, currentSpeedKmh);

    // Speed sampling every 0.25s for stable average
    this.speedSampleTimer += dt;
    if (this.speedSampleTimer >= 0.25) {
      this.speedSampleTimer = 0;
      this.speedSamples.push(currentSpeedKmh);
    }
  }

  public endRun(crashCause?: string): RunStats | null {
    if (!this.currentRun) return null;

    const run = this.currentRun;
    run.crashCause = crashCause || null;

    // Calculate averages
    if (this.speedSamples.length > 0) {
      const sumSpeed = this.speedSamples.reduce((a, b) => a + b, 0);
      run.avgSpeedKmh = Math.round(sumSpeed / this.speedSamples.length);
    } else {
      run.avgSpeedKmh = run.maxSpeedKmh;
    }

    const durationMins = run.durationSec / 60;
    run.nearMissRatePerMin = durationMins > 0.05 ? Math.round((run.nearMissCount / durationMins) * 10) / 10 : run.nearMissCount;

    // Reaction times
    if (run.reactionEvents.length > 0) {
      const sum = run.reactionEvents.reduce((acc, ev) => acc + ev.reactionTimeMs, 0);
      run.avgReactionTimeMs = Math.round(sum / run.reactionEvents.length);
    } else {
      run.avgReactionTimeMs = 0;
      run.bestReactionTimeMs = 0;
    }

    // Decision accuracy (% of recognized hazards avoided without crash)
    const totalDecisions = run.reactionEvents.length + (crashCause ? 1 : 0);
    run.decisionAccuracyPct = totalDecisions > 0
      ? Math.round((run.reactionEvents.length / totalDecisions) * 100)
      : 100;

    // Update Personal Bests
    const pb = this.profile.personalBests;
    pb.highScore = Math.max(pb.highScore, run.score);
    pb.longestSurvivalSec = Math.max(pb.longestSurvivalSec, Math.round(run.durationSec));
    pb.highestSpeedKmh = Math.max(pb.highestSpeedKmh, Math.round(run.maxSpeedKmh));
    pb.highestCombo = Math.max(pb.highestCombo, run.bestCombo);
    pb.mostNearMisses = Math.max(pb.mostNearMisses, run.nearMissCount);

    if (run.bestReactionTimeMs > 0 && run.bestReactionTimeMs < pb.fastestReactionMs) {
      pb.fastestReactionMs = run.bestReactionTimeMs;
    }

    // Save into history (keep latest 50 runs)
    this.profile.runs.unshift(run);
    if (this.profile.runs.length > 50) {
      this.profile.runs.pop();
    }
    this.saveProfile();

    this.currentRun = null;
    return run;
  }

  public getCurrentRun(): RunStats | null {
    return this.currentRun;
  }

  public getProfile(): PlayerHistoryProfile {
    return this.profile;
  }

  public exportDataAsJson(): string {
    return JSON.stringify(this.profile, null, 2);
  }

  public importDataFromJson(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (data && typeof data === 'object' && Array.isArray(data.runs)) {
        this.profile = data;
        this.saveProfile();
        return true;
      }
    } catch {
      // invalid JSON
    }
    return false;
  }

  private loadProfile(): PlayerHistoryProfile {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.schemaVersion === CURRENT_SCHEMA_VERSION) {
          return parsed;
        }
      }
    } catch {
      // Fallback
    }

    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      runs: [],
      personalBests: {
        highScore: 0,
        longestSurvivalSec: 0,
        highestSpeedKmh: 0,
        fastestReactionMs: 9999,
        highestCombo: 1,
        mostNearMisses: 0,
      },
    };
  }

  private saveProfile(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch {
      // ignore
    }
  }
}

