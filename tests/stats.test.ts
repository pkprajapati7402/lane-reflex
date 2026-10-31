import { describe, it, expect, beforeEach } from 'vitest';
import { StatsTracker } from '../src/stats/stats-tracker';

// In-memory mock for localStorage in node environment
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (key: string) => storageMap.get(key) || null,
  setItem: (key: string, val: string) => storageMap.set(key, val),
  removeItem: (key: string) => storageMap.delete(key),
  clear: () => storageMap.clear(),
};
(globalThis as any).localStorage = localStorageMock;

describe('StatsTracker & Reflex Metrics', () => {
  let stats: StatsTracker;

  beforeEach(() => {
    storageMap.clear();
    stats = new StatsTracker();
  });

  it('accurately tracks reaction time latency for avoidance maneuver', () => {
    stats.startRun('endless');

    const hazardCarId = 101;
    const initialPlayerX = 0;
    const threatTime = 1000; // ms

    // Hazard enters scanning zone
    stats.registerHazardIfThreat(hazardCarId, 5000, 0, 0, initialPlayerX, threatTime);

    // Player reacts 240ms later with decisive steer
    const reactionTime = 1240;
    stats.evaluatePlayerReaction(0.65, 0.25, 180, reactionTime);

    const run = stats.endRun();
    expect(run).not.toBeNull();
    expect(run?.reactionEvents.length).toBe(1);
    expect(run?.reactionEvents[0].reactionTimeMs).toBe(240);
    expect(run?.avgReactionTimeMs).toBe(240);
    expect(run?.bestReactionTimeMs).toBe(240);
    expect(run?.decisionAccuracyPct).toBe(100);
  });

  it('updates personal bests when records are broken', () => {
    stats.startRun('endless');
    stats.updateMetrics(25.0, 220, 15000, 4.0);
    stats.recordNearMiss();
    stats.recordNearMiss();
    stats.endRun();

    const pb = stats.getProfile().personalBests;
    expect(pb.highScore).toBe(15000);
    expect(pb.highestSpeedKmh).toBe(220);
    expect(pb.mostNearMisses).toBe(2);
    expect(pb.highestCombo).toBe(4.0);
  });

  it('exports and imports profile data as valid JSON', () => {
    stats.startRun('endless');
    stats.updateMetrics(10.0, 180, 5000, 2.0);
    stats.endRun();

    const json = stats.exportDataAsJson();
    expect(json).toContain('"highScore": 5000');

    const newStatsTracker = new StatsTracker();
    const imported = newStatsTracker.importDataFromJson(json);
    expect(imported).toBe(true);
    expect(newStatsTracker.getProfile().personalBests.highScore).toBe(5000);
  });
});
