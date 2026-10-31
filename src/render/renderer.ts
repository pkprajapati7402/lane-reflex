import { ROAD, PLAYER, CAMERA } from '../core/constants';
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

    // 2. Project Road Segments Infinitely (Never Disappears)
    const baseIndex = Math.floor(camera.z / ROAD.SEGMENT_LENGTH);

    interface VisibleSeg {
      worldIndex: number;
      template: RoadSegment;
      p1: { x: number; y: number; w: number; scale: number };
      p2: { x: number; y: number; w: number; scale: number };
    }

    const visibleList: VisibleSeg[] = [];

    for (let n = 0; n < ROAD.DRAW_DISTANCE; n++) {
      const worldIndex = baseIndex + n;
      const template = road.segments[((worldIndex % road.segments.length) + road.segments.length) % road.segments.length];

      const z1 = worldIndex * ROAD.SEGMENT_LENGTH;
      const z2 = (worldIndex + 1) * ROAD.SEGMENT_LENGTH;

      const deltaZ1 = z1 - camera.z;
      const deltaZ2 = z2 - camera.z;
      if (deltaZ1 <= 10) continue;

      const scale1 = (camera.depth / deltaZ1) * (this.height / 2);
      const scale2 = (camera.depth / deltaZ2) * (this.height / 2);

      const x1 = Math.round((this.width / 2) - (scale1 * camera.x));
      const y1 = Math.round((this.height / 2) - (scale1 * (template.p1.world.y - camera.y)));
      const w1 = Math.round(scale1 * ROAD.ROAD_WIDTH);

      const x2 = Math.round((this.width / 2) - (scale2 * camera.x));
      const y2 = Math.round((this.height / 2) - (scale2 * (template.p2.world.y - camera.y)));
      const w2 = Math.round(scale2 * ROAD.ROAD_WIDTH);

      // Cache screen projection on template for traffic sampling
      template.p1.screen.x = x1;
      template.p1.screen.y = y1;
      template.p1.screen.w = w1;
      template.p1.screen.scale = scale1;

      visibleList.push({
        worldIndex,
        template,
        p1: { x: x1, y: y1, w: w1, scale: scale1 },
        p2: { x: x2, y: y2, w: w2, scale: scale2 },
      });
    }

    // Bucket active traffic cars by world segment index for true back-to-front depth sorting
    const carsBySegment = new Map<number, TrafficCar[]>();
    for (const car of trafficCars) {
      if (!car.active) continue;
      // Only render cars ahead of or alongside player (culled once cleanly overtaken)
      if (car.z < player.z - 80) continue;
      const deltaZ = car.z - camera.z;
      if (deltaZ <= 20 || deltaZ > 24000) continue;
      const segIndex = Math.floor(car.z / ROAD.SEGMENT_LENGTH);
      let list = carsBySegment.get(segIndex);
      if (!list) {
        list = [];
        carsBySegment.set(segIndex, list);
      }
      list.push(car);
    }

    // 3. Render Road Segments & Traffic & Roadside 3D Scenery Back to Front
    for (let n = visibleList.length - 1; n >= 0; n--) {
      const segData = visibleList[n];
      const p1 = segData.p1;
      const p2 = segData.p2;

      // Ignore segments behind camera or invalid projection
      if (p1.scale <= 0 || p2.scale <= 0 || p1.y <= p2.y) {
        continue;
      }

      // A. Road surface and lane markings
      this.renderSegment(ctx, segData.template, p1, p2);

      // B. Traffic cars on this segment (occluded naturally by foreground hills)
      const carsOnSegment = carsBySegment.get(segData.worldIndex);
      if (carsOnSegment) {
        for (const car of carsOnSegment) {
          this.drawTrafficCar(ctx, car, segData, camera);
        }
      }

      // C. Render 3D Roadside Props & Overhead Highway Gantries
      if (segData.template.sprites && segData.template.sprites.length > 0) {
        for (const prop of segData.template.sprites) {
          const spriteCached = this.sprites.getRoadsideSprite(prop.name);
          if (!spriteCached) continue;

          if (prop.name === 'highway_gantry') {
            // Overhead bridge spans across whole 4-lane road
            const gantryScale = p1.scale * 3.4;
            const gw = spriteCached.width * gantryScale;
            const gh = spriteCached.height * gantryScale;
            const gx = p1.x - gw / 2;
            const gy = p1.y - gh * 0.88; // Elevate overhead above traffic
            ctx.drawImage(spriteCached.canvas, gx, gy, gw, gh);
          } else {
            // Roadside pillars, palms, billboards on shoulder
            const propScale = p1.scale * 2.2;
            const pw = spriteCached.width * propScale;
            const ph = spriteCached.height * propScale;
            const px = p1.x + (prop.offset * p1.w) - pw / 2;
            const py = p1.y - ph;
            ctx.drawImage(spriteCached.canvas, px, py, pw, ph);
          }
        }
      }
    }

    // 4. Interactive 3D Headlight Projection onto Road Surface
    this.renderHeadlights(ctx, player, camera);

    // 5. Render Player Car (in foreground with 1:1 physics alignment)
    this.renderPlayer(ctx, player, camera);

    // 7. Render Particles & Floating Pops
    this.particles.render(ctx);

    // 8. Speed FX: Speed lines & Vignette
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

  private renderHeadlights(ctx: CanvasRenderingContext2D, player: Player, camera: Camera): void {
    const playerDeltaZ = CAMERA.DISTANCE_BEHIND;
    const playerScale = (camera.depth / playerDeltaZ) * (this.height / 2);
    const playerRoadWidth = playerScale * ROAD.ROAD_WIDTH;
    const playerCenterBaseX = (this.width / 2) - (playerScale * camera.x);
    const playerScreenX = playerCenterBaseX + (player.x * playerRoadWidth) + (player.steerAngle * 10);
    const playerScreenY = this.height - 40;

    // Headlight illumination trapezoid shining down road lanes
    const beamLength = 240;
    const beamSpread = 160;
    const headlightY = playerScreenY - beamLength;

    const beamGrad = ctx.createLinearGradient(playerScreenX, playerScreenY - 20, playerScreenX, headlightY);
    const color = player.isBoosting ? 'rgba(0, 240, 255, 0.22)' : 'rgba(255, 255, 220, 0.12)';
    beamGrad.addColorStop(0, color);
    beamGrad.addColorStop(0.7, 'rgba(0, 240, 255, 0.05)');
    beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.save();
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(playerScreenX - 45, playerScreenY - 15);
    ctx.lineTo(playerScreenX - beamSpread, headlightY);
    ctx.lineTo(playerScreenX + beamSpread, headlightY);
    ctx.lineTo(playerScreenX + 45, playerScreenY - 15);
    ctx.closePath();
    ctx.fill();

    // Subtle current-lane guide glow on the asphalt
    const laneWidth = playerRoadWidth / 4;
    ctx.fillStyle = 'rgba(0, 240, 255, 0.07)';
    ctx.fillRect(playerScreenX - laneWidth / 2, playerScreenY - 160, laneWidth, 140);

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

  private drawTrafficCar(
    ctx: CanvasRenderingContext2D,
    car: TrafficCar,
    segData: { worldIndex: number; p1: { x: number; y: number; w: number; scale: number }; p2: { x: number; y: number; w: number; scale: number } },
    camera: Camera
  ): void {
    const deltaZ = car.z - camera.z;
    if (deltaZ <= 20) return;

    // Segment fractional position (0 to 1) for continuous interpolation
    const segZ = segData.worldIndex * ROAD.SEGMENT_LENGTH;
    const t = Math.max(0, Math.min(1.0, (car.z - segZ) / ROAD.SEGMENT_LENGTH));

    const p1 = segData.p1;
    const p2 = segData.p2;

    const scale = p1.scale + (p2.scale - p1.scale) * t;
    const screenBaseX = p1.x + (p2.x - p1.x) * t;
    const screenBaseY = p1.y + (p2.y - p1.y) * t;
    const roadWidthScreen = p1.w + (p2.w - p1.w) * t;

    // Exact horizontal lane position on the road surface
    const screenX = screenBaseX + (car.x * roadWidthScreen);
    const screenY = screenBaseY;

    // Sprite scaled proportionally with road depth perspective
    const cached = this.sprites.getTrafficSprite(car);
    const spriteScale = scale * 2.2;
    const w = cached.width * spriteScale;
    const h = cached.height * spriteScale;

    ctx.save();
    // Atmospheric Fog Fade for distant traffic (prevents popping or showing through distant hills)
    if (deltaZ > 12000) {
      const fogAlpha = Math.max(0, 1 - (deltaZ - 12000) / 12000);
      ctx.globalAlpha = fogAlpha;
    }

    ctx.drawImage(cached.canvas, screenX - w / 2, screenY - h, w, h);
    ctx.restore();
  }

  private renderPlayer(ctx: CanvasRenderingContext2D, player: Player, camera: Camera): void {
    const tilt = Math.abs(player.steerAngle) < 0.15 ? 'center' : (player.steerAngle < 0 ? 'left' : 'right');
    const cached = this.sprites.getPlayerSprite(tilt, player.isBraking, player.isBoosting);

    // Exact 1:1 perspective alignment matching traffic cars
    const playerDeltaZ = CAMERA.DISTANCE_BEHIND;
    const playerScale = (camera.depth / playerDeltaZ) * (this.height / 2);
    const playerRoadWidth = playerScale * ROAD.ROAD_WIDTH;
    const playerCenterBaseX = (this.width / 2) - (playerScale * camera.x);
    const playerScreenX = playerCenterBaseX + (player.x * playerRoadWidth) + (player.steerAngle * 10);
    const playerScreenY = this.height - 40;

    const scale = 0.82; // Crisp, perfectly proportioned foreground size
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
