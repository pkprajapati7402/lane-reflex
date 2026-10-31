import { ROAD, PLAYER } from '../core/constants';
import { Road, RoadSegment } from '../game/road';
import { Player } from '../game/player';
import { TrafficCar } from '../game/traffic';
import { Camera } from './camera';
import { SpriteAtlas } from './sprites';
import { ParticleSystem } from './particles';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sprites: SpriteAtlas;
  private particles: ParticleSystem;

  // Viewport
  public width: number = 1280;
  public height: number = 720;
  public dpr: number = 1;

  // Visual juice state
  public nearMissPulse: number = 0; // decays to 0
  private speedLineTimer: number = 0;

  constructor(canvas: HTMLCanvasElement, sprites: SpriteAtlas, particles: ParticleSystem) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.sprites = sprites;
    this.particles = particles;
    this.handleResize();
  }

  public handleResize(): void {
    const rect = this.canvas.parentElement?.getBoundingClientRect() || { width: 1280, height: 720 };
    // Cap resolution to avoid excessive fillrate on 4K displays while maintaining crisp look
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.width = Math.floor(rect.width);
    this.height = Math.floor(rect.height);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);
  }

  public triggerNearMissPulse(): void {
    this.nearMissPulse = 1.0;
  }

  private project(
    point: { world: { x: number; y: number; z: number }; screen: { x: number; y: number; w: number; scale: number } },
    camera: Camera
  ): void {
    const camZ = camera.z;
    const camX = camera.x;
    const camY = camera.y;

    const deltaZ = point.world.z - camZ;
    if (deltaZ <= 0) {
      point.screen.scale = 0;
      return;
    }

    point.screen.scale = (camera.depth / deltaZ) * (this.height / 2);
    point.screen.x = Math.round((this.width / 2) + (point.screen.scale * (point.world.x - camX)));
    point.screen.y = Math.round((this.height / 2) - (point.screen.scale * (point.world.y - camY)));
    point.screen.w = Math.round(point.screen.scale * ROAD.ROAD_WIDTH);
  }

  public render(
    road: Road,
    player: Player,
    camera: Camera,
    trafficCars: TrafficCar[],
    dt: number
  ): void {
    const ctx = this.ctx;
    ctx.save();

    // Clear whole frame buffer to prevent visual trails
    ctx.clearRect(0, 0, this.width, this.height);

    // Apply camera shake
    ctx.translate(camera.shakeOffsetX, camera.shakeOffsetY);

    // 1. Draw Sky & Distant Horizon
    this.drawSky(road, camera, player);

    // 2. Project Road Segments
    const baseSegment = road.findSegment(camera.z);
    const basePercent = (camera.z % ROAD.SEGMENT_LENGTH) / ROAD.SEGMENT_LENGTH;

    let x = 0;
    let dx = -(baseSegment.curve * basePercent);

    // Track visible segments for sprite sorting
    const visibleSegments: RoadSegment[] = [];

    for (let n = 0; n < ROAD.DRAW_DISTANCE; n++) {
      const segIndex = (baseSegment.index + n) % road.segments.length;
      const segment = road.segments[segIndex];
      const looped = segment.index < baseSegment.index;

      segment.p1.world.x = x;
      segment.p1.world.z = (segment.index + (looped ? road.segments.length : 0)) * ROAD.SEGMENT_LENGTH;
      this.project(segment.p1, camera);

      x += dx;
      dx += segment.curve;

      segment.p2.world.x = x;
      segment.p2.world.z = (segment.index + 1 + (looped ? road.segments.length : 0)) * ROAD.SEGMENT_LENGTH;
      this.project(segment.p2, camera);

      visibleSegments.push(segment);
    }

    // 3. Render Road Segments Back to Front
    for (let n = visibleSegments.length - 1; n >= 0; n--) {
      const segment = visibleSegments[n];
      const p1 = segment.p1.screen;
      const p2 = segment.p2.screen;

      // Ignore segments behind camera or invalid projection
      if (p1.scale <= 0 || p2.scale <= 0 || p1.y <= p2.y) {
        continue;
      }

      this.renderSegment(ctx, segment, p1, p2);
    }

    // 4. Render Traffic Cars Back to Front
    this.renderTraffic(ctx, trafficCars, camera, road);

    // 5. Render Player Car (in foreground)
    this.renderPlayer(ctx, player);

    // 6. Render Particles & Floating Pops
    this.particles.render(ctx);

    // 7. Speed FX: Speed lines & Vignette
    this.renderSpeedEffects(ctx, player, dt);

    // 8. Near-Miss Screen Flash / Pulse
    if (this.nearMissPulse > 0) {
      ctx.fillStyle = `rgba(0, 240, 255, ${this.nearMissPulse * 0.18})`;
      ctx.fillRect(0, 0, this.width, this.height);
      this.nearMissPulse = Math.max(0, this.nearMissPulse - 3.5 * dt);
    }

    // 9. Crash Redout / Flash
    if (player.isCrashed) {
      ctx.fillStyle = 'rgba(230, 0, 50, 0.28)';
      ctx.fillRect(0, 0, this.width, this.height);
    }

    ctx.restore();
  }

  private drawSky(road: Road, camera: Camera, _player: Player): void {
    const ctx = this.ctx;
    const biome = road.getBiome();

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.height / 2);
    skyGrad.addColorStop(0, biome.grassDark);
    skyGrad.addColorStop(0.7, biome.fog);
    skyGrad.addColorStop(1, '#0e0b1a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.width, this.height / 2);

    // Distant Cyber Sun / Neon Glow
    const sunX = (this.width / 2) - (camera.x * 0.05);
    const sunY = (this.height / 2) - 30;

    const sunGrad = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 140);
    sunGrad.addColorStop(0, 'rgba(255, 0, 128, 0.9)');
    sunGrad.addColorStop(0.4, 'rgba(255, 100, 0, 0.5)');
    sunGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 140, 0, Math.PI * 2);
    ctx.fill();

    // Mountain / Skyline Silhouettes
    ctx.fillStyle = '#0a0815';
    ctx.beginPath();
    ctx.moveTo(0, this.height / 2);
    for (let i = 0; i <= this.width; i += 60) {
      const peakH = 25 + Math.sin(i * 0.015 + camera.x * 0.0005) * 18 + Math.cos(i * 0.04) * 12;
      ctx.lineTo(i, (this.height / 2) - peakH);
    }
    ctx.lineTo(this.width, this.height / 2);
    ctx.closePath();
    ctx.fill();

    // Fill ground base below horizon
    ctx.fillStyle = biome.grassDark;
    ctx.fillRect(0, this.height / 2, this.width, this.height / 2);
  }

  private renderSegment(
    ctx: CanvasRenderingContext2D,
    segment: RoadSegment,
    p1: { x: number; y: number; w: number },
    p2: { x: number; y: number; w: number }
  ): void {
    const r1 = Math.max(2, p1.w * 0.12); // Rumble strip width
    const r2 = Math.max(1, p2.w * 0.12);
    const l1 = Math.max(1, p1.w * 0.02); // Lane marker width
    const l2 = Math.max(1, p2.w * 0.02);

    // Left and Right Alternating Ground
    this.drawPolygon(ctx, 0, p1.y, p1.x - p1.w - r1, p1.y, p2.x - p2.w - r2, p2.y, 0, p2.y, segment.color.grass);
    this.drawPolygon(ctx, p1.x + p1.w + r1, p1.y, this.width, p1.y, this.width, p2.y, p2.x + p2.w + r2, p2.y, segment.color.grass);

    // Rumble Strips
    this.drawPolygon(ctx, p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, segment.color.rumble);
    this.drawPolygon(ctx, p1.x + p1.w, p1.y, p1.x + p1.w + r1, p1.y, p2.x + p2.w + r2, p2.y, p2.x + p2.w, p2.y, segment.color.rumble);

    // Road Surface
    this.drawPolygon(ctx, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, segment.color.road);

    // Lane Dividers (for 4 lanes, dividers are at -0.5, 0.0, +0.5)
    if (segment.color.lane !== 'transparent') {
      const laneDividers = [-0.5, 0.0, 0.5];
      for (const div of laneDividers) {
        const lx1 = p1.x + (p1.w * div);
        const lx2 = p2.x + (p2.w * div);
        this.drawPolygon(ctx, lx1 - l1 / 2, p1.y, lx1 + l1 / 2, p1.y, lx2 + l2 / 2, p2.y, lx2 - l2 / 2, p2.y, segment.color.lane);
      }
    }
  }

  private drawPolygon(
    ctx: CanvasRenderingContext2D,
    x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    x4: number, y4: number,
    color: string
  ): void {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x3, y3);
    ctx.lineTo(x4, y4);
    ctx.closePath();
    ctx.fill();
  }

  private renderTraffic(
    ctx: CanvasRenderingContext2D,
    cars: TrafficCar[],
    camera: Camera,
    road: Road
  ): void {
    // Sort cars by distance descending (draw furthest first)
    const maxDrawZ = camera.z + (ROAD.DRAW_DISTANCE * ROAD.SEGMENT_LENGTH);
    const sorted = cars
      .filter((c) => c.active && c.z > camera.z && c.z < maxDrawZ)
      .sort((a, b) => b.z - a.z);

    for (const car of sorted) {
      const deltaZ = car.z - camera.z;
      if (deltaZ <= 100) continue;

      // Find segment index along visible stretch
      const segIndex = Math.floor(car.z / ROAD.SEGMENT_LENGTH) % road.segments.length;
      const seg = road.segments[segIndex];

      // Calculate exact screen projection that follows road curves
      // seg.p1.screen is already computed in the segment projection loop
      const segPercent = (car.z % ROAD.SEGMENT_LENGTH) / ROAD.SEGMENT_LENGTH;
      const scale = (camera.depth / deltaZ) * (this.height / 2);

      // Interpolate curved road center and width
      let screenCenterX = (this.width / 2) + (scale * (seg.p1.world.x - camera.x));
      let screenY = (this.height / 2) - (scale * (seg.p1.world.y - camera.y));
      let roadWidthScreen = scale * ROAD.ROAD_WIDTH;

      if (seg.p1.screen.scale > 0 && seg.p2.screen.scale > 0) {
        screenCenterX = seg.p1.screen.x + (seg.p2.screen.x - seg.p1.screen.x) * segPercent;
        screenY = seg.p1.screen.y + (seg.p2.screen.y - seg.p1.screen.y) * segPercent;
        roadWidthScreen = seg.p1.screen.w + (seg.p2.screen.w - seg.p1.screen.w) * segPercent;
      }

      // Exact lane position on the road surface
      const screenX = screenCenterX + (car.x * roadWidthScreen);

      const cached = this.sprites.getTrafficSprite(car);
      // Scale sprite proportionally with road depth
      const spriteScale = scale * 2.2;
      const w = cached.width * spriteScale;
      const h = cached.height * spriteScale;

      ctx.drawImage(cached.canvas, screenX - w / 2, screenY - h, w, h);
    }
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, player: Player): void {
    const tilt = Math.abs(player.steerAngle) < 0.15 ? 'center' : (player.steerAngle < 0 ? 'left' : 'right');
    const cached = this.sprites.getPlayerSprite(tilt, player.isBraking, player.isBoosting);

    // Player car in foreground with dynamic lane tracking across screen
    const playerScreenY = this.height - 40;
    const roadHalfWidthForeground = this.width * 0.36;
    const playerScreenX = (this.width / 2) + (player.x * roadHalfWidthForeground * 0.55) + (player.steerAngle * 14);

    const scale = 0.85; // Crisp foreground size
    const w = cached.width * scale;
    const h = cached.height * scale;

    ctx.drawImage(cached.canvas, playerScreenX - w / 2, playerScreenY - h, w, h);

    // Spawn tire smoke if steering hard at high speed
    if (Math.abs(player.steerVelocity) > 1.2 && player.speed > 5000 && !player.isCrashed) {
      const sideX = playerScreenX + (player.steerAngle > 0 ? -w * 0.35 : w * 0.35);
      this.particles.spawnTireSmoke(sideX, playerScreenY - 10, 2);
    }

    // Spawn boost particles if boosting
    if (player.isBoosting && !player.isCrashed) {
      this.particles.spawnBoostParticles(playerScreenX, playerScreenY - 15);
    }
  }

  private renderSpeedEffects(ctx: CanvasRenderingContext2D, player: Player, dt: number): void {
    const speedRatio = Math.min(1.0, player.speed / PLAYER.MAX_SPEED);

    // 1. Tightening Vignette at high speed
    if (speedRatio > 0.4) {
      const vigIntensity = (speedRatio - 0.4) / 0.6;
      const vigGrad = ctx.createRadialGradient(
        this.width / 2, this.height / 2, this.width * 0.3,
        this.width / 2, this.height / 2, this.width * 0.75
      );
      vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vigGrad.addColorStop(1, `rgba(0, 0, 0, ${vigIntensity * 0.65})`);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, this.width, this.height);
    }

    // 2. High-speed warp streaks on screen flanks (clean, non-obtrusive)
    if (speedRatio > 0.70 || player.isBoosting) {
      this.speedLineTimer += dt;
      const numLines = player.isBoosting ? 12 : 6;
      ctx.save();
      ctx.strokeStyle = player.isBoosting ? 'rgba(0, 240, 255, 0.45)' : 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = player.isBoosting ? 2.5 : 1.5;

      const originX = this.width / 2;
      const originY = this.height / 2 - 20;

      // Draw streaks mostly on left and right flanks so central traffic view remains crystal clear
      for (let i = 0; i < numLines; i++) {
        // Angles between 140-220 deg (left) and 320-40 deg (right)
        const isLeft = i % 2 === 0;
        const baseAngle = isLeft ? Math.PI : 0;
        const spread = ((i / numLines) - 0.5) * 0.9;
        const angle = baseAngle + spread + Math.sin(this.speedLineTimer * 6 + i) * 0.1;

        const innerRadius = this.width * 0.25 + ((this.speedLineTimer * 1200 + i * 150) % (this.width * 0.2));
        const outerRadius = innerRadius + 80 + (player.isBoosting ? 70 : 0);

        ctx.beginPath();
        ctx.moveTo(originX + Math.cos(angle) * innerRadius, originY + Math.sin(angle) * innerRadius);
        ctx.lineTo(originX + Math.cos(angle) * outerRadius, originY + Math.sin(angle) * outerRadius);
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}
