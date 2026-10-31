/**
 * Procedural Vector Sprite Generator & Atlas.
 * Pre-renders high-contrast arcade vehicles, roadside objects, and scenery
 * into offscreen canvases for zero-overhead, 60+ FPS rendering.
 */

export interface CachedSprite {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export class SpriteAtlas {
  private playerCarSprites: Map<string, CachedSprite> = new Map();
  private trafficSprites: Map<string, CachedSprite> = new Map();
  private roadsideSprites: Map<string, CachedSprite> = new Map();

  constructor() {
    this.generateAllSprites();
  }

  private createCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    return [canvas, ctx];
  }

  private generateAllSprites(): void {
    // 1. Player car variants (straight, left tilt, right tilt, braking, boosting)
    const tilts = ['center', 'left', 'right'];
    for (const tilt of tilts) {
      for (const brake of [false, true]) {
        for (const boost of [false, true]) {
          const key = `player_${tilt}_${brake ? 'brake' : 'norm'}_${boost ? 'boost' : 'norm'}`;
          this.playerCarSprites.set(key, this.renderPlayerCar(tilt, brake, boost));
        }
      }
    }

    // 2. Traffic car sprites (sedan, sport, truck) with various colors and indicator states
    const colors = ['#00e5ff', '#ffd600', '#ff0055', '#00e676', '#ffffff', '#ff9100', '#a855f7', '#ef4444'];
    for (const c of colors) {
      this.trafficSprites.set(`sedan_${c}`, this.renderSedan(c, false, false));
      this.trafficSprites.set(`sedan_${c}_brake`, this.renderSedan(c, true, false));
      this.trafficSprites.set(`sport_${c}`, this.renderSportCar(c, false, false));
      this.trafficSprites.set(`sport_${c}_left`, this.renderSportCar(c, false, true, 'left'));
      this.trafficSprites.set(`sport_${c}_right`, this.renderSportCar(c, false, true, 'right'));
    }

    // Heavy truck
    this.trafficSprites.set('truck_red', this.renderTruck('#ef4444'));

    // 3. Roadside scenery
    this.roadsideSprites.set('cyber_pillar', this.renderCyberPillar());
    this.roadsideSprites.set('highway_gantry', this.renderHighwayGantry());
    this.roadsideSprites.set('palm_tree', this.renderPalmTree());
    this.roadsideSprites.set('billboard_redline', this.renderBillboard('REDLINE'));
    this.roadsideSprites.set('billboard_reflex', this.renderBillboard('REFLEX'));
  }

  // --- PLAYER CAR ---
  private renderPlayerCar(tilt: string, brake: boolean, boost: boolean): CachedSprite {
    const [canvas, ctx] = this.createCanvas(320, 180);
    const cx = 160;
    const cy = 130;

    ctx.save();
    if (tilt === 'left') {
      ctx.translate(cx, cy);
      ctx.rotate(-0.06);
      ctx.translate(-cx, -cy);
    } else if (tilt === 'right') {
      ctx.translate(cx, cy);
      ctx.rotate(0.06);
      ctx.translate(-cx, -cy);
    }

    // Car shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, 162, 130, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Underglow (Cyan or Hot Orange during boost)
    const underglowColor = boost ? 'rgba(255, 100, 0, 0.7)' : 'rgba(0, 240, 255, 0.6)';
    ctx.shadowColor = boost ? '#ff6600' : '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = underglowColor;
    ctx.beginPath();
    ctx.ellipse(cx, 155, 110, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Rear tires
    ctx.fillStyle = '#111116';
    ctx.fillRect(cx - 132, 115, 34, 45); // Left tire
    ctx.fillRect(cx + 98, 115, 34, 45);  // Right tire
    // Tire tread detail
    ctx.fillStyle = '#22222a';
    ctx.fillRect(cx - 128, 118, 26, 38);
    ctx.fillRect(cx + 102, 118, 26, 38);

    // Main wedge chassis (Scarlet Red Cyber Wedge)
    const bodyGrad = ctx.createLinearGradient(0, 50, 0, 150);
    bodyGrad.addColorStop(0, '#e60033');
    bodyGrad.addColorStop(0.5, '#cc0029');
    bodyGrad.addColorStop(1, '#80001a');
    ctx.fillStyle = bodyGrad;

    ctx.beginPath();
    ctx.moveTo(cx - 110, 148);
    ctx.lineTo(cx - 125, 120);
    ctx.lineTo(cx - 95, 85);
    ctx.lineTo(cx - 70, 70);
    ctx.lineTo(cx + 70, 70);
    ctx.lineTo(cx + 95, 85);
    ctx.lineTo(cx + 125, 120);
    ctx.lineTo(cx + 110, 148);
    ctx.closePath();
    ctx.fill();

    // Sharp aerodynamic contour bevels
    ctx.strokeStyle = '#ff3366';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Rear diffuser
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(cx - 85, 138, 170, 16);
    // Diffuser fins
    ctx.fillStyle = '#22222a';
    for (let f = -60; f <= 60; f += 30) {
      ctx.fillRect(cx + f - 2, 138, 4, 16);
    }

    // Rear Cabin / Cockpit Roof (Tinted dark cyber glass)
    const glassGrad = ctx.createLinearGradient(0, 45, 0, 85);
    glassGrad.addColorStop(0, '#101728');
    glassGrad.addColorStop(1, '#060a12');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.moveTo(cx - 65, 72);
    ctx.lineTo(cx - 50, 42);
    ctx.lineTo(cx + 50, 42);
    ctx.lineTo(cx + 65, 72);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Windshield reflection streak
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 35, 45);
    ctx.lineTo(cx - 20, 68);
    ctx.stroke();

    // Rear Wing / Spoiler
    ctx.fillStyle = '#1a1a24';
    ctx.fillRect(cx - 115, 62, 230, 8);
    ctx.fillStyle = '#e60033';
    ctx.fillRect(cx - 118, 56, 10, 18);
    ctx.fillRect(cx + 108, 56, 10, 18);

    // Cyber Lightbar (Continuous high-tech LED bar across rear)
    const lightColor = brake ? '#ffffff' : (boost ? '#00ffff' : '#ff0044');
    ctx.fillStyle = lightColor;
    ctx.shadowColor = lightColor;
    ctx.shadowBlur = brake ? 20 : 12;
    ctx.fillRect(cx - 96, 96, 192, 10);
    ctx.shadowBlur = 0;

    // Dual Twin Exhausts
    ctx.fillStyle = '#1c1c24';
    ctx.fillRect(cx - 45, 140, 24, 12);
    ctx.fillRect(cx + 21, 140, 24, 12);

    if (boost) {
      // Boost flame plume
      const flameGrad = ctx.createLinearGradient(0, 145, 0, 178);
      flameGrad.addColorStop(0, '#ffffff');
      flameGrad.addColorStop(0.3, '#00f0ff');
      flameGrad.addColorStop(1, 'rgba(0, 100, 255, 0)');
      ctx.fillStyle = flameGrad;
      ctx.beginPath();
      ctx.moveTo(cx - 45, 150);
      ctx.lineTo(cx - 33, 176);
      ctx.lineTo(cx - 21, 150);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(cx + 21, 150);
      ctx.lineTo(cx + 33, 176);
      ctx.lineTo(cx + 45, 150);
      ctx.fill();
    }

    ctx.restore();
    return { canvas, width: 320, height: 180 };
  }

  // --- TRAFFIC SEDAN ---
  private renderSedan(color: string, brake: boolean, _indicator: boolean): CachedSprite {
    const [canvas, ctx] = this.createCanvas(300, 170);
    const cx = 150;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, 152, 115, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tires
    ctx.fillStyle = '#15151c';
    ctx.fillRect(cx - 116, 115, 28, 38);
    ctx.fillRect(cx + 88, 115, 28, 38);

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 100, 142);
    ctx.lineTo(cx - 112, 115);
    ctx.lineTo(cx - 90, 85);
    ctx.lineTo(cx - 65, 75);
    ctx.lineTo(cx + 65, 75);
    ctx.lineTo(cx + 90, 85);
    ctx.lineTo(cx + 112, 115);
    ctx.lineTo(cx + 100, 142);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#111118';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Cabin
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.moveTo(cx - 60, 75);
    ctx.lineTo(cx - 48, 48);
    ctx.lineTo(cx + 48, 48);
    ctx.lineTo(cx + 60, 75);
    ctx.closePath();
    ctx.fill();

    // Rear bumper & license plate
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(cx - 80, 130, 160, 14);
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(cx - 24, 132, 48, 10);

    // Taillights
    const tlColor = brake ? '#ffffff' : '#ef4444';
    ctx.fillStyle = tlColor;
    ctx.shadowColor = tlColor;
    ctx.shadowBlur = brake ? 16 : 8;
    ctx.fillRect(cx - 96, 95, 36, 14);
    ctx.fillRect(cx + 60, 95, 36, 14);
    ctx.shadowBlur = 0;

    return { canvas, width: 300, height: 170 };
  }

  // --- TRAFFIC SPORT COUPE ---
  private renderSportCar(color: string, brake: boolean, hasIndicator: boolean, dir: 'left' | 'right' = 'left'): CachedSprite {
    const [canvas, ctx] = this.createCanvas(310, 175);
    const cx = 155;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, 155, 120, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tires
    ctx.fillStyle = '#111115';
    ctx.fillRect(cx - 124, 115, 30, 42);
    ctx.fillRect(cx + 94, 115, 30, 42);

    // Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx - 105, 145);
    ctx.lineTo(cx - 118, 110);
    ctx.lineTo(cx - 92, 80);
    ctx.lineTo(cx - 62, 65);
    ctx.lineTo(cx + 62, 65);
    ctx.lineTo(cx + 92, 80);
    ctx.lineTo(cx + 118, 110);
    ctx.lineTo(cx + 105, 145);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#050508';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Low Roofline
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.moveTo(cx - 58, 65);
    ctx.lineTo(cx - 44, 40);
    ctx.lineTo(cx + 44, 40);
    ctx.lineTo(cx + 58, 65);
    ctx.closePath();
    ctx.fill();

    // Spoiler
    ctx.fillStyle = '#181822';
    ctx.fillRect(cx - 105, 55, 210, 8);

    // Taillights
    const tlColor = brake ? '#ffffff' : '#dc2626';
    ctx.fillStyle = tlColor;
    ctx.shadowColor = tlColor;
    ctx.shadowBlur = 10;
    ctx.fillRect(cx - 96, 92, 42, 12);
    ctx.fillRect(cx + 54, 92, 42, 12);
    ctx.shadowBlur = 0;

    // Turn indicator (Blinking amber)
    if (hasIndicator) {
      ctx.fillStyle = '#f59e0b';
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur = 16;
      if (dir === 'left') {
        ctx.fillRect(cx - 102, 90, 16, 16);
      } else {
        ctx.fillRect(cx + 86, 90, 16, 16);
      }
      ctx.shadowBlur = 0;
    }

    return { canvas, width: 310, height: 175 };
  }

  // --- HEAVY TRUCK ---
  private renderTruck(_color: string): CachedSprite {
    const [canvas, ctx] = this.createCanvas(400, 290);
    const cx = 200;

    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.ellipse(cx, 270, 175, 18, 0, 0, Math.PI * 2);
    ctx.fill();

    // Massive double tires
    ctx.fillStyle = '#101016';
    ctx.fillRect(cx - 170, 205, 42, 65);
    ctx.fillRect(cx + 128, 205, 42, 65);

    // Trailer Box (Tall, wide, industrial)
    ctx.fillStyle = '#262635';
    ctx.fillRect(cx - 150, 40, 300, 195);
    ctx.strokeStyle = '#3f3f56';
    ctx.lineWidth = 4;
    ctx.strokeRect(cx - 150, 40, 300, 195);

    // Cargo Door vertical seam & locks
    ctx.strokeStyle = '#181822';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, 40);
    ctx.lineTo(cx, 235);
    ctx.stroke();

    // Red & White Reflective Safety Chevron bar along bumper
    const chevronY = 222;
    const barWidth = 280;
    const barHeight = 16;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - 140, chevronY, barWidth, barHeight);
    ctx.clip();
    for (let x = cx - 160; x < cx + 160; x += 22) {
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(x, chevronY, 11, barHeight);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 11, chevronY, 11, barHeight);
    }
    ctx.restore();

    // Truck roof clearance markers (Amber LEDs)
    ctx.fillStyle = '#fbbf24';
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 8;
    for (let x = -120; x <= 120; x += 60) {
      ctx.beginPath();
      ctx.arc(cx + x, 48, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    // Lower taillights
    ctx.fillStyle = '#dc2626';
    ctx.shadowColor = '#dc2626';
    ctx.shadowBlur = 12;
    ctx.fillRect(cx - 135, 200, 35, 14);
    ctx.fillRect(cx + 100, 200, 35, 14);
    ctx.shadowBlur = 0;

    return { canvas, width: 400, height: 290 };
  }

  // --- HIGHWAY OVERHEAD GANTRY BRIDGE ---
  private renderHighwayGantry(): CachedSprite {
    const [canvas, ctx] = this.createCanvas(760, 260);

    // Left and Right Industrial Truss Columns
    ctx.fillStyle = '#1e1b2e';
    ctx.fillRect(40, 60, 28, 200);
    ctx.fillRect(692, 60, 28, 200);

    // Cross-bracing struts on columns
    ctx.strokeStyle = '#383058';
    ctx.lineWidth = 3;
    for (let y = 70; y < 240; y += 40) {
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(68, y + 30);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(692, y);
      ctx.lineTo(720, y + 30);
      ctx.stroke();
    }

    // Overhead Horizontal Bridge Span
    ctx.fillStyle = '#181524';
    ctx.fillRect(20, 20, 720, 55);
    ctx.strokeStyle = '#3b325c';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, 720, 55);

    // Digital Highway VMS Display Boards (3 overhead lane signage displays)
    const boardWidth = 180;
    const boardHeight = 36;
    const boardYs = 30;

    for (let i = 0; i < 3; i++) {
      const bx = 90 + i * 210;
      ctx.fillStyle = '#06060c';
      ctx.fillRect(bx, boardYs, boardWidth, boardHeight);
      ctx.strokeStyle = '#ff0055';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, boardYs, boardWidth, boardHeight);

      // Glowing Cyan / Amber Digital Matrix Text
      ctx.fillStyle = i === 1 ? '#00f0ff' : '#ffcc00';
      ctx.shadowColor = i === 1 ? '#00f0ff' : '#ffcc00';
      ctx.shadowBlur = 8;
      ctx.font = '900 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = i === 0 ? 'SPEED: FREE' : (i === 1 ? '⚡ REDLINE' : 'NITRO ZONE');
      ctx.fillText(label, bx + boardWidth / 2, boardYs + boardHeight / 2);
      ctx.shadowBlur = 0;
    }

    return { canvas, width: 760, height: 260 };
  }

  // --- ROADSIDE OBJECTS ---
  private renderCyberPillar(): CachedSprite {
    const [canvas, ctx] = this.createCanvas(60, 240);
    // Glowing neon highway pillar
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(20, 20, 20, 220);

    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fillRect(26, 30, 8, 200);
    ctx.shadowBlur = 0;

    return { canvas, width: 60, height: 240 };
  }

  private renderPalmTree(): CachedSprite {
    const [canvas, ctx] = this.createCanvas(120, 220);
    // Retro synthwave palm silhouette
    ctx.strokeStyle = '#2e1065';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(60, 220);
    ctx.quadraticCurveTo(50, 120, 60, 40);
    ctx.stroke();

    // Fronds
    ctx.fillStyle = '#4c1d95';
    const angles = [-1.8, -1.2, -0.6, 0.6, 1.2, 1.8];
    for (const a of angles) {
      ctx.save();
      ctx.translate(60, 40);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(35, 0, 40, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    return { canvas, width: 120, height: 220 };
  }

  private renderBillboard(text: string): CachedSprite {
    const [canvas, ctx] = this.createCanvas(240, 160);
    // Posts
    ctx.fillStyle = '#181822';
    ctx.fillRect(45, 90, 14, 70);
    ctx.fillRect(181, 90, 14, 70);

    // Board
    ctx.fillStyle = '#09090f';
    ctx.fillRect(10, 15, 220, 75);
    ctx.strokeStyle = '#ff0055';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 15, 220, 75);

    // Glowing Text
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.font = 'bold 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 120, 52);
    ctx.shadowBlur = 0;

    return { canvas, width: 240, height: 160 };
  }

  public getPlayerSprite(tilt: 'left' | 'right' | 'center', brake: boolean, boost: boolean): CachedSprite {
    const key = `player_${tilt}_${brake ? 'brake' : 'norm'}_${boost ? 'boost' : 'norm'}`;
    return this.playerCarSprites.get(key) || this.playerCarSprites.get('player_center_norm_norm')!;
  }

  public getTrafficSprite(car: { type: string; color: string; isBraking: boolean; indicator: string; indicatorFlash: boolean }): CachedSprite {
    if (car.type === 'truck') {
      return this.trafficSprites.get('truck_red')!;
    }
    if (car.type === 'sport') {
      if (car.indicator !== 'none' && car.indicatorFlash) {
        const key = `sport_${car.color}_${car.indicator}`;
        return this.trafficSprites.get(key) || this.trafficSprites.get(`sport_${car.color}`) || this.trafficSprites.get('sport_#ffd600')!;
      }
      return this.trafficSprites.get(`sport_${car.color}`) || this.trafficSprites.get('sport_#ffd600')!;
    }
    // Sedan
    if (car.isBraking) {
      return this.trafficSprites.get(`sedan_${car.color}_brake`) || this.trafficSprites.get(`sedan_${car.color}`) || this.trafficSprites.get('sedan_#00e5ff')!;
    }
    return this.trafficSprites.get(`sedan_${car.color}`) || this.trafficSprites.get('sedan_#00e5ff')!;
  }

  public getRoadsideSprite(name: string): CachedSprite {
    return this.roadsideSprites.get(name) || this.roadsideSprites.get('cyber_pillar')!;
  }
}
