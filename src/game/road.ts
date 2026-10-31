import { ROAD } from '../core/constants';

export interface RoadColorTheme {
  grassDark: string;
  grassLight: string;
  roadDark: string;
  roadLight: string;
  rumbleDark: string;
  rumbleLight: string;
  lane: string;
  fog: string;
}

export const BIOMES: Record<string, RoadColorTheme> = {
  metropolis: {
    grassDark: '#0c0822',
    grassLight: '#140e34',
    roadDark: '#202035',
    roadLight: '#2a2a44',
    rumbleDark: '#ff0055',
    rumbleLight: '#00ffff',
    lane: '#00f0ff',
    fog: '#080614',
  },
  sunset: {
    grassDark: '#321019',
    grassLight: '#441420',
    roadDark: '#2d2436',
    roadLight: '#392e44',
    rumbleDark: '#ff5500',
    rumbleLight: '#ffd200',
    lane: '#ffffff',
    fog: '#2d1117',
  },
  coastal: {
    grassDark: '#051828',
    grassLight: '#0b243b',
    roadDark: '#1a2736',
    roadLight: '#223347',
    rumbleDark: '#00b4d8',
    rumbleLight: '#90e0ef',
    lane: '#ffffff',
    fog: '#04111c',
  },
  cyberStorm: {
    grassDark: '#09101c',
    grassLight: '#101c30',
    roadDark: '#1a2233',
    roadLight: '#243048',
    rumbleDark: '#2563eb',
    rumbleLight: '#60a5fa',
    lane: '#38bdf8',
    fog: '#060a10',
  },
};

export interface ScreenPoint {
  x: number;
  y: number;
  w: number;
  scale: number;
}

export interface RoadSegment {
  index: number;
  p1: {
    world: { x: number; y: number; z: number };
    screen: ScreenPoint;
  };
  p2: {
    world: { x: number; y: number; z: number };
    screen: ScreenPoint;
  };
  curve: number;
  clip: number; // For occlusion culling hills
  color: {
    grass: string;
    road: string;
    rumble: string;
    lane: string;
  };
}

export class Road {
  public segments: RoadSegment[] = [];
  public trackLength: number = 0;
  private currentBiome: RoadColorTheme = BIOMES.metropolis;

  constructor() {
    this.buildTrack();
  }

  public setBiome(themeName: keyof typeof BIOMES): void {
    if (BIOMES[themeName]) {
      this.currentBiome = BIOMES[themeName];
      this.recolorSegments();
    }
  }

  public getBiome(): RoadColorTheme {
    return this.currentBiome;
  }

  private recolorSegments(): void {
    for (let i = 0; i < this.segments.length; i++) {
      const isEven = Math.floor(i / ROAD.RUMBLE_LENGTH) % 2 === 0;
      this.segments[i].color = {
        grass: isEven ? this.currentBiome.grassDark : this.currentBiome.grassLight,
        road: isEven ? this.currentBiome.roadDark : this.currentBiome.roadLight,
        rumble: isEven ? this.currentBiome.rumbleDark : this.currentBiome.rumbleLight,
        lane: isEven ? this.currentBiome.lane : 'transparent',
      };
    }
  }

  private addSegment(curve: number, y: number): void {
    const n = this.segments.length;
    const isEven = Math.floor(n / ROAD.RUMBLE_LENGTH) % 2 === 0;

    const seg: RoadSegment = {
      index: n,
      p1: {
        world: {
          x: 0,
          y: this.getLastY(),
          z: n * ROAD.SEGMENT_LENGTH,
        },
        screen: { x: 0, y: 0, w: 0, scale: 0 },
      },
      p2: {
        world: {
          x: 0,
          y: y,
          z: (n + 1) * ROAD.SEGMENT_LENGTH,
        },
        screen: { x: 0, y: 0, w: 0, scale: 0 },
      },
      curve: curve,
      clip: 0,
      color: {
        grass: isEven ? this.currentBiome.grassDark : this.currentBiome.grassLight,
        road: isEven ? this.currentBiome.roadDark : this.currentBiome.roadLight,
        rumble: isEven ? this.currentBiome.rumbleDark : this.currentBiome.rumbleLight,
        lane: isEven ? this.currentBiome.lane : 'transparent',
      },
    };

    this.segments.push(seg);
  }

  private getLastY(): number {
    return this.segments.length === 0 ? 0 : this.segments[this.segments.length - 1].p2.world.y;
  }

  private addRoad(enter: number, hold: number, leave: number, curve: number, yChange: number): void {
    const startY = this.getLastY();
    const endY = startY + yChange * ROAD.SEGMENT_LENGTH;
    const total = enter + hold + leave;

    for (let i = 0; i < enter; i++) {
      const ease = (1 - Math.cos((i / enter) * Math.PI)) / 2;
      this.addSegment(curve * ease, startY + (endY - startY) * (i / total));
    }
    for (let i = 0; i < hold; i++) {
      this.addSegment(curve, startY + (endY - startY) * ((enter + i) / total));
    }
    for (let i = 0; i < leave; i++) {
      const ease = (1 + Math.cos((i / leave) * Math.PI)) / 2;
      this.addSegment(curve * ease, startY + (endY - startY) * ((enter + hold + i) / total));
    }
  }

  private buildTrack(): void {
    this.segments = [];

    // Build an engaging sequence of straightaways, sweeping turns, and gentle elevation waves
    // Straight warm-up section
    this.addRoad(50, 50, 50, 0, 0);

    // Gentle S-curve
    this.addRoad(40, 60, 40, 1.2, 5);
    this.addRoad(30, 40, 30, -1.5, -5);

    // Crest hill
    this.addRoad(50, 50, 50, 0, 25);
    this.addRoad(50, 50, 50, 0, -25);

    // Right curve with dip
    this.addRoad(40, 80, 40, 2.0, -15);
    this.addRoad(40, 80, 40, 0, 15);

    // Fast technical chicane
    this.addRoad(30, 40, 30, -2.2, 0);
    this.addRoad(30, 40, 30, 2.2, 0);
    this.addRoad(30, 40, 30, -1.0, 0);

    // Long high-speed straight with rolling bumps
    this.addRoad(60, 100, 60, 0, 10);
    this.addRoad(40, 80, 40, 0, -10);

    // Sweeping left turn
    this.addRoad(50, 90, 50, -1.8, 15);
    this.addRoad(40, 60, 40, 0, -15);

    // Smooth return to straight
    this.addRoad(50, 50, 50, 0, 0);

    this.trackLength = this.segments.length * ROAD.SEGMENT_LENGTH;
  }

  public findSegment(z: number): RoadSegment {
    const wrappedZ = ((z % this.trackLength) + this.trackLength) % this.trackLength;
    const index = Math.floor(wrappedZ / ROAD.SEGMENT_LENGTH);
    return this.segments[index];
  }
}
