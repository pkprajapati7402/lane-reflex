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

export interface RoadProp {
  name: string;
  offset: number; // Normalized road offset (-1.2 is left curb, +1.2 is right curb, 0 is center overhead)
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
  sprites: RoadProp[];
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

    const props: RoadProp[] = [];

    // 1. Neon highway light pillars every 10 segments on both sides
    if (n % 10 === 0) {
      props.push({ name: 'cyber_pillar', offset: -1.25 });
      props.push({ name: 'cyber_pillar', offset: 1.25 });
    }

    // 2. Overhead highway gantry sign arches every 60 segments (drive underneath!)
    if (n % 60 === 30) {
      props.push({ name: 'highway_gantry', offset: 0 });
    }

    // 3. Billboards & Palms on outer landscape
    if (n % 40 === 15) {
      props.push({ name: n % 80 === 15 ? 'billboard_redline' : 'billboard_reflex', offset: -1.65 });
    }
    if (n % 25 === 5) {
      props.push({ name: 'palm_tree', offset: 1.6 });
    }

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
      sprites: props,
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

    // Completely straight multi-lane highway with gentle 3D elevation crests and dips
    // 1. Long high-speed flat straightaway
    this.addRoad(40, 80, 40, 0, 0);

    // 2. Gentle rolling crest hill
    this.addRoad(40, 60, 40, 0, 16);
    this.addRoad(40, 60, 40, 0, -16);

    // 3. Flat straight speedway
    this.addRoad(50, 90, 50, 0, 0);

    // 4. Gentle rolling dip
    this.addRoad(40, 50, 40, 0, -12);
    this.addRoad(40, 50, 40, 0, 12);

    // 5. High-speed elevated viaduct stretch
    this.addRoad(40, 60, 40, 0, 18);
    this.addRoad(50, 70, 50, 0, 0);
    this.addRoad(40, 60, 40, 0, -18);

    // 6. Return straightaway
    this.addRoad(50, 80, 50, 0, 0);

    this.trackLength = this.segments.length * ROAD.SEGMENT_LENGTH;
  }

  public findSegment(z: number): RoadSegment {
    const wrappedZ = ((z % this.trackLength) + this.trackLength) % this.trackLength;
    const index = Math.floor(wrappedZ / ROAD.SEGMENT_LENGTH);
    return this.segments[index];
  }
}
