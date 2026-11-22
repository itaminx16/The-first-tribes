import Phaser from 'phaser';

export interface FogViewer {
  x: number;
  y: number;
  radius: number;
}

export class FogOfWarSystem {
  private worldW: number;
  private worldH: number;
  private cellSize = 96;
  private cols: number;
  private rows: number;

  // 0 = unexplored, 1 = explored (shroud), 2 = currently visible
  private grid: Uint8Array;
  private enabled: boolean;

  private textureKey = 'fog-of-war-canvas';
  private canvasTex!: Phaser.Textures.CanvasTexture;
  private fogImage!: Phaser.GameObjects.Image;
  private refreshTimer = 0;

  constructor(scene: Phaser.Scene, worldW: number, worldH: number, enabled = false) {
    this.worldW = worldW;
    this.worldH = worldH;
    this.enabled = enabled;

    this.cols = Math.ceil(worldW / this.cellSize);
    this.rows = Math.ceil(worldH / this.cellSize);
    this.grid = new Uint8Array(this.cols * this.rows);

    if (scene.textures.exists(this.textureKey)) {
      scene.textures.remove(this.textureKey);
    }

    const created = scene.textures.createCanvas(this.textureKey, this.cols, this.rows);
    if (!created) {
      throw new Error('Failed to create FogOfWar CanvasTexture');
    }
    this.canvasTex = created;

    this.fogImage = scene.add
      .image(0, 0, this.textureKey)
      .setOrigin(0, 0)
      .setDisplaySize(this.worldW, this.worldH)
      .setDepth(4200)
      .setVisible(this.enabled);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.fogImage.setVisible(enabled);
    if (enabled) {
      this.renderCanvas();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public revealArea(wx: number, wy: number, radius: number): void {
    const minC = Math.max(0, Math.floor((wx - radius) / this.cellSize));
    const maxC = Math.min(this.cols - 1, Math.floor((wx + radius) / this.cellSize));
    const minR = Math.max(0, Math.floor((wy - radius) / this.cellSize));
    const maxR = Math.min(this.rows - 1, Math.floor((wy + radius) / this.cellSize));
    const rSq = radius * radius;

    for (let r = minR; r <= maxR; r++) {
      const cy = (r + 0.5) * this.cellSize;
      for (let c = minC; c <= maxC; c++) {
        const cx = (c + 0.5) * this.cellSize;
        const dx = cx - wx;
        const dy = cy - wy;
        if (dx * dx + dy * dy <= rSq) {
          this.grid[r * this.cols + c] = 2;
        }
      }
    }
  }

  public update(delta: number, viewers: FogViewer[]): void {
    this.refreshTimer += delta;
    if (this.refreshTimer < 220) return;
    this.refreshTimer = 0;

    // Downgrade previously visible (2) to explored (1)
    for (let i = 0; i < this.grid.length; i++) {
      if (this.grid[i] === 2) {
        this.grid[i] = 1;
      }
    }

    // Mark cells inside viewer sight radii as visible (2)
    for (const v of viewers) {
      this.revealArea(v.x, v.y, v.radius);
    }

    if (this.enabled) {
      this.renderCanvas();
    }
  }

  private renderCanvas(): void {
    const ctx = this.canvasTex.getContext();
    const imgData = ctx.createImageData(this.cols, this.rows);
    const data = imgData.data;

    for (let i = 0; i < this.grid.length; i++) {
      const state = this.grid[i];
      const p = i * 4;
      if (state === 0) {
        // Unexplored dark forest mist
        data[p] = 11;
        data[p + 1] = 16;
        data[p + 2] = 13;
        data[p + 3] = 220;
      } else if (state === 1) {
        // Explored shroud
        data[p] = 14;
        data[p + 1] = 20;
        data[p + 2] = 16;
        data[p + 3] = 110;
      } else {
        // Fully visible
        data[p] = 0;
        data[p + 1] = 0;
        data[p + 2] = 0;
        data[p + 3] = 0;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    this.canvasTex.refresh();
  }

  public isVisibleAt(wx: number, wy: number): boolean {
    if (!this.enabled) return true;
    const c = Phaser.Math.Clamp(Math.floor(wx / this.cellSize), 0, this.cols - 1);
    const r = Phaser.Math.Clamp(Math.floor(wy / this.cellSize), 0, this.rows - 1);
    return this.grid[r * this.cols + c] === 2;
  }

  public isExploredAt(wx: number, wy: number): boolean {
    if (!this.enabled) return true;
    const c = Phaser.Math.Clamp(Math.floor(wx / this.cellSize), 0, this.cols - 1);
    const r = Phaser.Math.Clamp(Math.floor(wy / this.cellSize), 0, this.rows - 1);
    return this.grid[r * this.cols + c] >= 1;
  }

  public destroy(): void {
    this.fogImage.destroy();
  }
}
