import Phaser from 'phaser';
import { Season } from '../types/game';
import { CURSORS } from '../utils/Cursors';

interface RippleAnim {
  sprite: Phaser.GameObjects.Image;
  baseX: number;
  baseY: number;
  phase: number;
}

interface LilyPadAnim {
  sprite: Phaser.GameObjects.Image;
  baseY: number;
  phase: number;
}

function buildWaterHitPolygon(scale = 0.96): Phaser.Geom.Polygon {
  const cx = 180;
  const cy = 120;
  const segments: Array<[number, number, number, number, number, number, number, number]> = [
    [-144, 0, -148, -86, -46, -102, 18, -92],
    [18, -92, 104, -98, 154, -54, 148, 8],
    [148, 8, 144, 78, 58, 102, -22, 94],
    [-22, 94, -104, 98, -142, 58, -144, 0]
  ];

  const points: Phaser.Math.Vector2[] = [];
  const stepsPerSeg = 5;
  for (const [x0, y0, x1, y1, x2, y2, x3, y3] of segments) {
    for (let i = 0; i < stepsPerSeg; i++) {
      const t = i / stepsPerSeg;
      const u = 1 - t;
      const px =
        u * u * u * x0 +
        3 * u * u * t * x1 +
        3 * u * t * t * x2 +
        t * t * t * x3;
      const py =
        u * u * u * y0 +
        3 * u * u * t * y1 +
        3 * u * t * t * y2 +
        t * t * t * y3;
      points.push(new Phaser.Math.Vector2(cx + px * scale, cy + py * scale));
    }
  }
  return new Phaser.Geom.Polygon(points);
}

export class Lake extends Phaser.GameObjects.Container {
  private season: Season;
  private hoverGlow: Phaser.GameObjects.Ellipse;
  private waterSprite: Phaser.GameObjects.Image;
  private waterPoly: Phaser.Geom.Polygon;
  private lilyPads: LilyPadAnim[] = [];
  private ripples: RippleAnim[] = [];
  private fishSplashTimer = 1800;

  constructor(scene: Phaser.Scene, x: number, y: number, initialSeason: Season = 'SPRING') {
    super(scene, x, y);
    this.season = initialSeason;

    this.hoverGlow = scene.add.ellipse(0, 2, 286, 184, 0x38bdf8, 0.14);
    this.hoverGlow.setStrokeStyle(3, 0x7dd3fc, 0.9);
    this.hoverGlow.setVisible(false);

    const initialTex =
      initialSeason === 'WINTER'
        ? 'lake-winter'
        : initialSeason === 'AUTUMN'
          ? 'lake-autumn'
          : 'lake-summer';
    this.waterSprite = scene.add.image(0, 0, initialTex);
    this.waterPoly = buildWaterHitPolygon(0.95);
    this.waterSprite.setInteractive(this.waterPoly, Phaser.Geom.Polygon.Contains);

    this.add([this.hoverGlow, this.waterSprite]);

    // 5 animated water shimmer ripples
    const rippleOffsets = [
      { x: -64, y: -32 },
      { x: 46, y: -44 },
      { x: -18, y: 12 },
      { x: 76, y: 18 },
      { x: -58, y: 46 }
    ];
    rippleOffsets.forEach((pos, idx) => {
      const sprite = scene.add.image(pos.x, pos.y, 'lake-ripple');
      sprite.setAlpha(0.45);
      sprite.setScale(0.85 + (idx % 2) * 0.2);
      this.ripples.push({
        sprite,
        baseX: pos.x,
        baseY: pos.y,
        phase: idx * 1.3
      });
      this.add(sprite);
    });

    // 4 floating lily pads
    const padOffsets = [
      { x: -94, y: 22, angle: -12 },
      { x: -74, y: 40, angle: 18 },
      { x: 96, y: -26, angle: 24 },
      { x: 78, y: 52, angle: -22 }
    ];
    padOffsets.forEach((pos, idx) => {
      const sprite = scene.add.image(pos.x, pos.y, 'lily-pad');
      sprite.setAngle(pos.angle);
      this.lilyPads.push({
        sprite,
        baseY: pos.y,
        phase: idx * 1.5
      });
      this.add(sprite);
    });

    // Keep water beneath shore characters and trees
    this.setDepth(-900);

    this.applySeasonVisuals();

    this.waterSprite.on('pointerover', () => {
      if (this.isFishable()) {
        this.hoverGlow.setVisible(true);
      }
    });
    this.waterSprite.on('pointerout', () => {
      this.hoverGlow.setVisible(false);
    });

    scene.add.existing(this);
  }

  public getHitTarget(): Phaser.GameObjects.Image {
    return this.waterSprite;
  }

  public setSeason(season: Season): void {
    this.season = season;
    this.applySeasonVisuals();
  }

  public getSeason(): Season {
    return this.season;
  }

  public isFishable(): boolean {
    return this.season !== 'WINTER';
  }

  public isPointInsideClickArea(worldX: number, worldY: number): boolean {
    return Phaser.Geom.Polygon.Contains(
      this.waterPoly,
      worldX - this.x + 180,
      worldY - this.y + 120
    );
  }

  public getShoreSpotFor(vx: number, vy: number): { x: number; y: number } {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, vx, vy);
    return {
      x: this.x + Math.cos(angle) * 156,
      y: this.y + Math.sin(angle) * 102
    };
  }

  public getWadeSpotFor(vx: number, vy: number): { x: number; y: number } {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, vx, vy);
    return {
      x: this.x + Math.cos(angle) * 92,
      y: this.y + Math.sin(angle) * 58
    };
  }

  public spawnSplashAt(worldX: number, worldY: number): void {
    if (!this.scene) return;

    const ring = this.scene.add.ellipse(worldX, worldY, 16, 8, 0xe0f2fe, 0.25);
    ring.setStrokeStyle(2, 0xffffff, 0.85);
    ring.setDepth(-890);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.6,
      scaleY: 2.6,
      alpha: 0,
      duration: 560,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });

    const count = Phaser.Math.Between(6, 8);
    for (let i = 0; i < count; i++) {
      const drop = this.scene.add.image(
        worldX + Phaser.Math.Between(-6, 6),
        worldY + Phaser.Math.Between(-3, 3),
        'particle-splash'
      );
      drop.setDepth(-885);
      const dx = Phaser.Math.Between(-24, 24);
      const peakY = worldY - Phaser.Math.Between(14, 28);
      const endY = worldY + Phaser.Math.Between(0, 8);

      this.scene.tweens.add({
        targets: drop,
        x: drop.x + dx,
        y: peakY,
        duration: 180,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (!drop.scene) return;
          this.scene.tweens.add({
            targets: drop,
            y: endY,
            alpha: 0,
            duration: 210,
            ease: 'Quad.easeIn',
            onComplete: () => drop.destroy()
          });
        }
      });
    }
  }

  public update(delta: number): void {
    if (!this.isFishable()) {
      return;
    }

    const now = this.scene.time.now * 0.002;
    for (const r of this.ripples) {
      r.sprite.x = r.baseX + Math.sin(now + r.phase) * 8;
      r.sprite.setAlpha(0.25 + (Math.sin(now * 1.4 + r.phase) + 1) * 0.24);
    }

    for (const pad of this.lilyPads) {
      pad.sprite.y = pad.baseY + Math.sin(now * 1.2 + pad.phase) * 1.8;
    }

    this.fishSplashTimer -= delta;
    if (this.fishSplashTimer <= 0) {
      this.fishSplashTimer = Phaser.Math.Between(2200, 3800);
      const sx = this.x + Phaser.Math.Between(-95, 95);
      const sy = this.y + Phaser.Math.Between(-50, 50);
      this.spawnAmbientRing(sx, sy);
    }
  }

  private spawnAmbientRing(worldX: number, worldY: number): void {
    const ring = this.scene.add.ellipse(worldX, worldY, 12, 6, 0xe0f2fe, 0.15);
    ring.setStrokeStyle(1.6, 0xe0f2fe, 0.78);
    ring.setDepth(-892);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.3,
      scaleY: 2.3,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });
  }

  private applySeasonVisuals(): void {
    const fishable = this.isFishable();
    const tex =
      this.season === 'WINTER'
        ? 'lake-winter'
        : this.season === 'AUTUMN'
          ? 'lake-autumn'
          : 'lake-summer';
    this.waterSprite.setTexture(tex);
    for (const r of this.ripples) {
      r.sprite.setVisible(fishable);
    }
    for (const pad of this.lilyPads) {
      pad.sprite.setVisible(fishable);
    }
    if (!fishable) {
      this.hoverGlow.setVisible(false);
    }
    if (this.waterSprite.input) {
      this.waterSprite.input.cursor = fishable ? CURSORS.fish : CURSORS.blocked;
    }
  }
}
