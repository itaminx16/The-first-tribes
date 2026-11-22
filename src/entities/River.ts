import Phaser from 'phaser';
import { ObstacleCircle, RiverLayout, Season } from '../types/game';

interface RiverSegment {
  x: number;
  y: number;
  radius: number;
  isFord: boolean;
}

export class River {
  private scene: Phaser.Scene;
  private worldW: number;
  private worldH: number;
  private layout: RiverLayout;
  private season: Season;

  private graphics: Phaser.GameObjects.Graphics;
  private rippleTimer = 0;
  private segments: RiverSegment[] = [];
  private fordLabels: Phaser.GameObjects.Text[] = [];
  private obstacles: ObstacleCircle[] = [];

  constructor(
    scene: Phaser.Scene,
    worldW: number,
    worldH: number,
    layout: RiverLayout,
    season: Season
  ) {
    this.scene = scene;
    this.worldW = worldW;
    this.worldH = worldH;
    this.layout = layout;
    this.season = season;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(18);

    this.buildSegments();
    this.drawRiver(0);
  }

  private buildSegments(): void {
    this.segments = [];
    this.obstacles = [];
    for (const lbl of this.fordLabels) lbl.destroy();
    this.fordLabels = [];

    const addRiverPath = (
      points: Array<{ x: number; y: number }>,
      baseRadius: number,
      fordFractions: number[]
    ) => {
      const steps = 68;
      const curve = new Phaser.Curves.Spline(points.map((p) => new Phaser.Math.Vector2(p.x, p.y)));

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const pt = curve.getPoint(t);

        let isFord = false;
        for (const f of fordFractions) {
          if (Math.abs(t - f) < 0.042) {
            isFord = true;
            break;
          }
        }

        const r = baseRadius + Math.sin(i * 0.45) * 8;
        this.segments.push({ x: pt.x, y: pt.y, radius: r, isFord });

        if (!isFord && i % 2 === 0) {
          this.obstacles.push({
            x: pt.x,
            y: pt.y,
            radius: r * 0.76,
          });
        }
      }

      for (const f of fordFractions) {
        const pt = curve.getPoint(f);
        const lbl = this.scene.add
          .text(pt.x, pt.y - 8, '🪨 Брід', {
            fontFamily: 'Segoe UI, sans-serif',
            fontSize: '12px',
            fontStyle: 'bold',
            color: '#fff3c4',
            stroke: '#1b140c',
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(24)
          .setAlpha(0.85);
        this.fordLabels.push(lbl);
      }
    };

    const cx = this.worldW / 2;
    const cy = this.worldH / 2;

    if (this.layout === 'single') {
      // Winding river across the world passing safely around the central player village
      addRiverPath(
        [
          { x: 180, y: cy - 680 },
          { x: cx - 720, y: cy - 320 },
          { x: cx - 560, y: cy + 340 },
          { x: cx + 220, y: cy + 680 },
          { x: cx + 920, y: cy + 520 },
          { x: this.worldW - 140, y: cy + 880 },
        ],
        62,
        [0.24, 0.52, 0.78]
      );
    } else if (this.layout === 'twin') {
      addRiverPath(
        [
          { x: 140, y: cy - 520 },
          { x: cx - 640, y: cy - 420 },
          { x: cx - 540, y: cy + 280 },
          { x: cx - 220, y: this.worldH - 140 },
        ],
        58,
        [0.28, 0.68]
      );
      addRiverPath(
        [
          { x: cx + 340, y: 140 },
          { x: cx + 560, y: cy - 220 },
          { x: cx + 640, y: cy + 440 },
          { x: this.worldW - 140, y: cy + 720 },
        ],
        58,
        [0.32, 0.72]
      );
    } else if (this.layout === 'coastal') {
      // South-east coastal shoreline
      addRiverPath(
        [
          { x: cx + 200, y: this.worldH - 180 },
          { x: cx + 820, y: this.worldH - 360 },
          { x: this.worldW - 520, y: cy + 560 },
          { x: this.worldW - 220, y: cy - 120 },
        ],
        115,
        [0.45]
      );
    } else if (this.layout === 'oasis') {
      // Oasis stream loop in the south-west quadrant
      addRiverPath(
        [
          { x: cx - 680, y: cy + 360 },
          { x: cx - 440, y: cy + 540 },
          { x: cx - 120, y: cy + 480 },
          { x: cx + 180, y: cy + 620 },
        ],
        56,
        [0.5]
      );
    }
  }

  public setSeason(season: Season): void {
    if (this.season === season) return;
    this.season = season;
    this.drawRiver(this.rippleTimer);
  }

  public update(delta: number): void {
    if (this.segments.length === 0) return;
    this.rippleTimer += delta * 0.002;
    // Redraw water ripples ~6 times per second for crisp performance
    if (Math.floor((this.rippleTimer - delta * 0.002) * 6) !== Math.floor(this.rippleTimer * 6)) {
      this.drawRiver(this.rippleTimer);
    }
  }

  private drawRiver(phase: number): void {
    this.graphics.clear();
    if (this.segments.length === 0) return;

    const isWinter = this.season === 'WINTER';
    const bankColor = isWinter ? 0xcbd5e1 : 0xc2a878;
    const shallowColor = isWinter ? 0x6ea8c8 : 0x2b8cbe;
    const deepColor = isWinter ? 0x4a7c9b : 0x166496;

    // 1. Sandy/snowy banks
    this.graphics.fillStyle(bankColor, 0.85);
    for (const seg of this.segments) {
      this.graphics.fillCircle(seg.x, seg.y, seg.radius + 15);
    }

    // 2. Shallow water body
    this.graphics.fillStyle(shallowColor, 0.94);
    for (const seg of this.segments) {
      this.graphics.fillCircle(seg.x, seg.y, seg.radius);
    }

    // 3. Deep water channel
    this.graphics.fillStyle(deepColor, 0.88);
    for (const seg of this.segments) {
      if (!seg.isFord) {
        this.graphics.fillCircle(seg.x, seg.y, seg.radius * 0.68);
      }
    }

    // 4. Stepping stones at shallow Fords (Брід) and animated water ripples
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (seg.isFord) {
        this.graphics.fillStyle(0x7c7265, 0.95);
        this.graphics.fillEllipse(seg.x - 16, seg.y - 6, 22, 14);
        this.graphics.fillEllipse(seg.x + 14, seg.y + 8, 24, 15);
        this.graphics.fillStyle(0xa89f91, 0.9);
        this.graphics.fillEllipse(seg.x, seg.y + 1, 18, 12);
      } else if (i % 3 === 0) {
        const waveOffset = Math.sin(phase + i * 0.7) * 8;
        this.graphics.lineStyle(2, 0xbbe6ff, 0.35);
        this.graphics.strokeEllipse(seg.x + waveOffset, seg.y, seg.radius * 0.75, seg.radius * 0.32);
      }
    }
  }

  public getObstacles(): ObstacleCircle[] {
    return this.obstacles;
  }

  public getMinimapPoints(): Array<{ x: number; y: number; radius: number; isFord: boolean }> {
    return this.segments.map((s) => ({
      x: s.x,
      y: s.y,
      radius: s.radius,
      isFord: s.isFord,
    }));
  }

  public isPointInFishableWater(wx: number, wy: number): boolean {
    for (const seg of this.segments) {
      const d = Phaser.Math.Distance.Between(wx, wy, seg.x, seg.y);
      if (d <= seg.radius + 14) {
        return true;
      }
    }
    return false;
  }

  public getNearestWadeSpot(vx: number, vy: number): { x: number; y: number } | null {
    if (this.segments.length === 0) return null;
    let bestSeg = this.segments[0];
    let bestDist = Infinity;

    for (const seg of this.segments) {
      const d = Phaser.Math.Distance.Between(vx, vy, seg.x, seg.y);
      if (d < bestDist) {
        bestDist = d;
        bestSeg = seg;
      }
    }

    const angle = Phaser.Math.Angle.Between(bestSeg.x, bestSeg.y, vx, vy);
    const wadeR = bestSeg.radius * 0.78;
    return {
      x: bestSeg.x + Math.cos(angle) * wadeR,
      y: bestSeg.y + Math.sin(angle) * wadeR,
    };
  }

  public destroy(): void {
    this.graphics.destroy();
    for (const lbl of this.fordLabels) lbl.destroy();
    this.fordLabels = [];
    this.segments = [];
    this.obstacles = [];
  }
}
