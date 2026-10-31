import { ObjectPool } from '../core/pool';

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  active: boolean;
  text: string;
  x: number;
  y: number;
  vy: number;
  color: string;
  alpha: number;
  scale: number;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private particlePool: ObjectPool<Particle>;
  private textPool: ObjectPool<FloatingText>;

  constructor() {
    this.particlePool = new ObjectPool<Particle>(
      () => ({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 4,
        color: '#ffffff',
        alpha: 1,
        life: 0,
        maxLife: 1,
      }),
      250,
      (p) => {
        p.active = false;
      }
    );

    this.textPool = new ObjectPool<FloatingText>(
      () => ({
        active: false,
        text: '',
        x: 0,
        y: 0,
        vy: -40,
        color: '#00f0ff',
        alpha: 1,
        scale: 1,
        life: 0,
        maxLife: 0.8,
      }),
      40,
      (t) => {
        t.active = false;
      }
    );
  }

  public reset(): void {
    this.particlePool.clear();
    this.textPool.clear();
  }

  public spawnTireSmoke(x: number, y: number, count: number = 3): void {
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.acquire();
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 30;
      p.y = y + (Math.random() - 0.5) * 8;
      p.vx = (Math.random() - 0.5) * 40;
      p.vy = -Math.random() * 25;
      p.size = 8 + Math.random() * 8;
      p.color = 'rgba(200, 220, 255, 0.4)';
      p.alpha = 0.6;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.2;
    }
  }

  public spawnBoostParticles(x: number, y: number): void {
    for (let i = 0; i < 4; i++) {
      const p = this.particlePool.acquire();
      p.active = true;
      p.x = x + (Math.random() - 0.5) * 40;
      p.y = y;
      p.vx = (Math.random() - 0.5) * 50;
      p.vy = 40 + Math.random() * 60;
      p.size = 5 + Math.random() * 5;
      p.color = Math.random() > 0.4 ? '#00f0ff' : '#ff0055';
      p.alpha = 0.9;
      p.life = 0;
      p.maxLife = 0.2 + Math.random() * 0.15;
    }
  }

  public spawnCrashDebris(x: number, y: number, count: number = 40): void {
    for (let i = 0; i < count; i++) {
      const p = this.particlePool.acquire();
      p.active = true;
      p.x = x;
      p.y = y;
      const angle = Math.random() * Math.PI * 2;
      const speed = 120 + Math.random() * 320;
      p.vx = Math.cos(angle) * speed;
      p.vy = Math.sin(angle) * speed - 60; // slight upward pop
      p.size = 6 + Math.random() * 8;
      const colors = ['#e60033', '#ffffff', '#ff9900', '#22222a', '#00f0ff'];
      p.color = colors[Math.floor(Math.random() * colors.length)];
      p.alpha = 1.0;
      p.life = 0;
      p.maxLife = 0.6 + Math.random() * 0.5;
    }
  }

  public spawnFloatingText(text: string, x: number, y: number, color: string = '#00f0ff'): void {
    const t = this.textPool.acquire();
    t.active = true;
    t.text = text;
    t.x = x;
    t.y = y;
    t.vy = -65;
    t.color = color;
    t.alpha = 1.0;
    t.scale = 1.2;
    t.life = 0;
    t.maxLife = 0.75;
  }

  public update(dt: number): void {
    // Update particles
    for (let i = 0; i < this.particlePool.count; i++) {
      const p = this.particlePool.get(i);
      if (!p.active) continue;

      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.particlePool.release(i);
        i--;
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      p.size += 6 * dt; // expand slightly
    }

    // Update floating texts
    for (let i = 0; i < this.textPool.count; i++) {
      const t = this.textPool.get(i);
      if (!t.active) continue;

      t.life += dt;
      if (t.life >= t.maxLife) {
        t.active = false;
        this.textPool.release(i);
        i--;
        continue;
      }

      t.y += t.vy * dt;
      t.alpha = Math.max(0, 1 - Math.pow(t.life / t.maxLife, 2));
      t.scale = 1.0 + 0.3 * (1 - t.life / t.maxLife);
    }
  }

  public render(ctx: CanvasRenderingContext2D): void {
    // Render particles
    for (let i = 0; i < this.particlePool.count; i++) {
      const p = this.particlePool.get(i);
      if (!p.active) continue;

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render floating texts
    for (let i = 0; i < this.textPool.count; i++) {
      const t = this.textPool.get(i);
      if (!t.active) continue;

      ctx.save();
      ctx.globalAlpha = t.alpha;
      ctx.fillStyle = t.color;
      ctx.shadowColor = t.color;
      ctx.shadowBlur = 10;
      ctx.font = `italic 900 ${Math.floor(22 * t.scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    }
  }
}

