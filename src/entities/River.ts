import Phaser from 'phaser';
import { ObstacleCircle, RiverLayout, Season } from '../types/game';

interface RiverSegment {
  x: number;
  y: number;
  radius: number;
  isFord: boolean;
  tangentAngle: number;
}

export interface RiverBridgeInfo {
  id: string;
  x: number;
  y: number;
  radius: number;
  angle: number;
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
  private fordCenters: Array<{ x: number; y: number; radius: number }> = [];
  private fordLabels: Array<{ label: Phaser.GameObjects.Text; x: number; y: number }> = [];
  private bridges: RiverBridgeInfo[] = [];
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
    this.fordCenters = [];
    this.obstacles = [];
    for (const item of this.fordLabels) item.label.destroy();
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
        const tangent = curve.getTangent(t);
        const tangentAngle = Math.atan2(tangent.y, tangent.x);

        let isFord = false;
        for (const f of fordFractions) {
          if (Math.abs(t - f) < 0.045) {
            isFord = true;
            break;
          }
        }

        const r = baseRadius + Math.sin(i * 0.45) * 8;
        this.segments.push({ x: pt.x, y: pt.y, radius: r, isFord, tangentAngle });
      }

      for (const f of fordFractions) {
        const pt = curve.getPoint(f);
        this.fordCenters.push({ x: pt.x, y: pt.y, radius: baseRadius + 16 });
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
        this.fordLabels.push({ label: lbl, x: pt.x, y: pt.y });
      }
    };

    const cx = this.worldW / 2;
    const cy = this.worldH / 2;

    if (this.layout === 'single') {
      // Winding river across the world passing through central plains while leaving all 4 corners spacious
      addRiverPath(
        [
          { x: 180, y: cy - 680 },
          { x: cx - 720, y: cy - 320 },
          { x: cx - 420, y: cy + 280 },
          { x: cx + 220, y: cy + 560 },
          { x: cx + 860, y: cy + 320 },
          { x: this.worldW - 140, y: cy - 220 },
        ],
        62,
        [0.24, 0.52, 0.78]
      );
    } else if (this.layout === 'twin') {
      addRiverPath(
        [
          { x: 140, y: cy - 420 },
          { x: cx - 540, y: cy - 340 },
          { x: cx - 440, y: cy + 240 },
          { x: cx - 220, y: this.worldH - 140 },
        ],
        58,
        [0.28, 0.68]
      );
      addRiverPath(
        [
          { x: cx + 260, y: 140 },
          { x: cx + 480, y: cy - 220 },
          { x: cx + 520, y: cy + 380 },
          { x: this.worldW - 140, y: cy + 520 },
        ],
        58,
        [0.32, 0.72]
      );
    } else if (this.layout === 'coastal') {
      // Coastal shoreline along the far south-east edge
      addRiverPath(
        [
          { x: cx + 260, y: this.worldH - 120 },
          { x: cx + 880, y: this.worldH - 220 },
          { x: this.worldW - 260, y: cy + 620 },
          { x: this.worldW - 120, y: cy - 80 },
        ],
        96,
        [0.45]
      );
    } else if (this.layout === 'oasis') {
      // Central oasis stream loop
      addRiverPath(
        [
          { x: cx - 520, y: cy - 180 },
          { x: cx - 220, y: cy + 120 },
          { x: cx + 180, y: cy - 80 },
          { x: cx + 460, y: cy + 220 },
        ],
        56,
        [0.5]
      );
    }

    this.rebuildObstacles();
  }

  private isSegmentCoveredByBridge(seg: RiverSegment): boolean {
    for (const br of this.bridges) {
      if (Phaser.Math.Distance.Between(seg.x, seg.y, br.x, br.y) <= br.radius + seg.radius * 0.42) {
        return true;
      }
    }
    return false;
  }

  private rebuildObstacles(): void {
    this.obstacles = [];
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      if (seg.isFord || this.isSegmentCoveredByBridge(seg)) {
        continue;
      }
      if (i % 2 === 0) {
        this.obstacles.push({
          x: seg.x,
          y: seg.y,
          radius: seg.radius * 0.76,
        });
      }
    }
  }

  public addBridge(id: string, x: number, y: number, radius = 90, angle = 0): void {
    const existing = this.bridges.find((b) => b.id === id);
    if (existing) {
      existing.x = x;
      existing.y = y;
      existing.radius = radius;
      existing.angle = angle;
    } else {
      this.bridges.push({ id, x, y, radius, angle });
    }
    this.rebuildObstacles();
  }

  public removeBridge(id: string): void {
    const prevLen = this.bridges.length;
    this.bridges = this.bridges.filter((b) => b.id !== id);
    if (this.bridges.length !== prevLen) {
      this.rebuildObstacles();
    }
  }

  public getBridges(): RiverBridgeInfo[] {
    return this.bridges;
  }

  public getCrossings(): Array<{ x: number; y: number; radius: number; kind: 'ford' | 'bridge' }> {
    const out: Array<{ x: number; y: number; radius: number; kind: 'ford' | 'bridge' }> = [];
    for (const f of this.fordCenters) {
      out.push({ x: f.x, y: f.y, radius: f.radius, kind: 'ford' });
    }
    for (const b of this.bridges) {
      out.push({ x: b.x, y: b.y, radius: b.radius, kind: 'bridge' });
    }
    return out;
  }

  public getNearestSegmentInfo(wx: number, wy: number): {
    x: number;
    y: number;
    radius: number;
    dist: number;
    isFord: boolean;
    crossAngle: number;
  } | null {
    if (this.segments.length === 0) return null;
    let best = this.segments[0];
    let bestDist = Infinity;
    for (const seg of this.segments) {
      const d = Phaser.Math.Distance.Between(wx, wy, seg.x, seg.y);
      if (d < bestDist) {
        bestDist = d;
        best = seg;
      }
    }
    // Perpendicular to river tangent so the bridge spans across both banks
    let crossAngle = best.tangentAngle + Math.PI / 2;
    if (crossAngle > Math.PI / 2) crossAngle -= Math.PI;
    if (crossAngle < -Math.PI / 2) crossAngle += Math.PI;
    return {
      x: best.x,
      y: best.y,
      radius: best.radius,
      dist: bestDist,
      isFord: best.isFord,
      crossAngle,
    };
  }

  public getBankSpotFor(
    bx: number,
    by: number,
    crossAngle: number,
    fromX: number,
    fromY: number
  ): { x: number; y: number } {
    const offset = 96;
    const dx = Math.cos(crossAngle) * offset;
    const dy = Math.sin(crossAngle) * offset;
    const p1 = { x: bx + dx, y: by + dy };
    const p2 = { x: bx - dx, y: by - dy };
    const b1 = this.isPointInBlockedWater(p1.x, p1.y);
    const b2 = this.isPointInBlockedWater(p2.x, p2.y);
    if (!b1 && b2) return p1;
    if (!b2 && b1) return p2;
    const d1 = Phaser.Math.Distance.Between(fromX, fromY, p1.x, p1.y);
    const d2 = Phaser.Math.Distance.Between(fromX, fromY, p2.x, p2.y);
    return d1 <= d2 ? p1 : p2;
  }

  public setVisibilityCheck(isExplored: (x: number, y: number) => boolean): void {
    for (const item of this.fordLabels) {
      item.label.setVisible(isExplored(item.x, item.y));
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

  public isPointInBlockedWater(wx: number, wy: number): boolean {
    for (const seg of this.segments) {
      if (seg.isFord) continue;
      if (this.isSegmentCoveredByBridge(seg)) continue;
      const d = Phaser.Math.Distance.Between(wx, wy, seg.x, seg.y);
      if (d <= seg.radius * 0.84) {
        return true;
      }
    }
    return false;
  }

  public isPointNearAnyWater(wx: number, wy: number, pad = 0): boolean {
    for (const seg of this.segments) {
      const d = Phaser.Math.Distance.Between(wx, wy, seg.x, seg.y);
      if (d <= seg.radius + pad) {
        return true;
      }
    }
    return false;
  }

  public segmentCrossesBlockedRiver(x1: number, y1: number, x2: number, y2: number): boolean {
    if (this.segments.length === 0) return false;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    if (dist < 40) return false;
    const samples = Math.min(28, Math.max(3, Math.ceil(dist / 42)));
    for (let i = 1; i < samples; i++) {
      const t = i / samples;
      const sx = x1 + (x2 - x1) * t;
      const sy = y1 + (y2 - y1) * t;
      if (this.isPointInBlockedWater(sx, sy)) {
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
    for (const item of this.fordLabels) item.label.destroy();
    this.fordLabels = [];
    this.fordCenters = [];
    this.bridges = [];
    this.segments = [];
    this.obstacles = [];
  }
}
