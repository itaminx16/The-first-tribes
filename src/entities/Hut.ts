import Phaser from 'phaser';
import {
  BREED_DURATION_MS,
  HUT_POP_BONUS,
  LARGE_HUT_POP_BONUS,
  MAX_BUILDING_LEVEL,
  Season,
} from '../types/game';
import { CURSORS } from '../utils/Cursors';
import type { Villager } from './Villager';

export class Hut extends Phaser.GameObjects.Container {
  public readonly isLarge: boolean;
  public level = 1;
  private progress = 0;
  private completedFired = false;
  private season: Season = 'SPRING';
  private smokeTimer = 700;

  private hoverRing: Phaser.GameObjects.Ellipse;
  private doorGlow: Phaser.GameObjects.Ellipse;
  private upgradeTrim: Phaser.GameObjects.Graphics;
  private sprite: Phaser.GameObjects.Image;
  private levelBadge: Phaser.GameObjects.Text;
  private progressBg: Phaser.GameObjects.Graphics;
  private progressFill: Phaser.GameObjects.Graphics;

  private sleepers = new Set<Villager>();
  private maxSleepers: number;
  private zzzTimer = 400;

  private breedingPair: [Villager, Villager] | null = null;
  private breedingEntered = new Set<Villager>();
  private breedingTimer = 0;
  private heartTimer = 300;

  private onCompleted: (hut: Hut) => void;
  private onBirthReady: (hut: Hut, parentA: Villager, parentB: Villager) => void;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    onCompleted: (hut: Hut) => void,
    onBirthReady: (hut: Hut, parentA: Villager, parentB: Villager) => void,
    isLarge = false
  ) {
    super(scene, x, y);
    this.isLarge = isLarge;
    this.maxSleepers = isLarge ? 6 : 3;
    this.onCompleted = onCompleted;
    this.onBirthReady = onBirthReady;

    const ringW = isLarge ? 168 : 132;
    const ringH = isLarge ? 74 : 58;
    this.hoverRing = scene.add.ellipse(0, 4, ringW, ringH, 0xffe066, 0.16);
    this.hoverRing.setStrokeStyle(2.5, 0xffe066, 0.9);
    this.hoverRing.setVisible(false);

    const initTex = isLarge ? 'building-large_hut-0' : 'hut-stage-0';
    this.upgradeTrim = scene.add.graphics();
    this.sprite = scene.add.image(0, 0, initTex);
    this.sprite.setOrigin(0.5, 0.825);
    this.levelBadge = scene.add
      .text(0, isLarge ? -104 : -88, '', {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#facc15',
        backgroundColor: '#261a11cc',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.doorGlow = scene.add.ellipse(0, -14, isLarge ? 38 : 30, isLarge ? 36 : 32, 0xffa94d, 0.42);
    this.doorGlow.setVisible(false);

    this.progressBg = scene.add.graphics();
    this.progressFill = scene.add.graphics();

    this.add([
      this.hoverRing,
      this.upgradeTrim,
      this.sprite,
      this.doorGlow,
      this.levelBadge,
      this.progressBg,
      this.progressFill,
    ]);
    this.setSize(isLarge ? 176 : 136, isLarge ? 148 : 128);
    this.setDepth(y);

    const hitRadius = isLarge ? 76 : 64;
    const hitCircle = new Phaser.Geom.Circle(0, -16, hitRadius);
    this.setInteractive(hitCircle, Phaser.Geom.Circle.Contains);
    if (this.input) {
      this.input.cursor = CURSORS.build;
    }

    this.on('pointerover', () => {
      this.hoverRing.setVisible(true);
    });
    this.on('pointerout', () => {
      this.hoverRing.setVisible(false);
    });

    this.drawProgressBar();
    scene.add.existing(this);
  }

  public getPopBonus(): number {
    const base = this.isLarge ? LARGE_HUT_POP_BONUS : HUT_POP_BONUS;
    const perLvl = this.isLarge ? 3 : 2;
    return base + (this.level - 1) * perLvl;
  }

  public getMaxSleepers(): number {
    return this.maxSleepers;
  }

  public setLevel(lvl: number): void {
    this.level = Phaser.Math.Clamp(lvl, 1, MAX_BUILDING_LEVEL);
    this.maxSleepers = (this.isLarge ? 6 : 3) + (this.level - 1) * 2;
    this.applyLevelVisuals();
  }

  public upgrade(): boolean {
    if (!this.isComplete() || this.level >= MAX_BUILDING_LEVEL) return false;
    this.setLevel(this.level + 1);
    this.playBuildBounce();
    this.spawnBuildParticles();
    return true;
  }

  private applyLevelVisuals(): void {
    const scale = 1 + (this.level - 1) * 0.08;
    this.sprite.setScale(scale);
    this.upgradeTrim.clear();
    if (this.level >= 2) {
      const rx = this.isLarge ? 66 : 52;
      const ry = this.isLarge ? 24 : 18;
      this.upgradeTrim.lineStyle(3, this.level >= 3 ? 0xfacc15 : 0x94a3b8, 0.9);
      this.upgradeTrim.strokeEllipse(0, 2, rx * 2, ry * 2);
      this.levelBadge.setText('★'.repeat(this.level)).setVisible(true);
    } else {
      this.levelBadge.setVisible(false);
    }
  }

  public getProgress(): number {
    return this.progress;
  }

  public isComplete(): boolean {
    return this.progress >= 100;
  }

  private getStageTexture(progress: number, season: Season): string {
    if (this.isLarge) {
      const stage = progress >= 100 ? 2 : progress >= 50 ? 1 : 0;
      if (stage === 2 && season === 'WINTER') {
        return 'building-large_hut-2-winter';
      }
      return `building-large_hut-${stage}`;
    }
    const stage =
      progress >= 100 ? 3 : progress >= 66 ? 2 : progress >= 33 ? 1 : 0;
    if (stage === 3 && season === 'WINTER') {
      return 'hut-stage-3-winter';
    }
    return `hut-stage-${stage}`;
  }

  public setSeason(season: Season): void {
    this.season = season;
    if (this.isComplete()) {
      this.sprite.setTexture(this.getStageTexture(100, season));
    }
  }

  public addBuildWork(deltaProgress = 10): boolean {
    if (this.progress >= 100) {
      return true;
    }

    const step = this.isLarge ? deltaProgress * 0.75 : deltaProgress;
    this.progress = Math.min(100, this.progress + step);
    this.sprite.setTexture(this.getStageTexture(this.progress, this.season));

    this.playBuildBounce();
    this.spawnBuildParticles();

    if (this.progress >= 100) {
      this.progressBg.clear();
      this.progressFill.clear();
      if (this.input) {
        this.input.cursor = CURSORS.pointer;
      }
      if (!this.completedFired) {
        this.completedFired = true;
        this.onCompleted(this);
      }
      return true;
    }

    this.drawProgressBar();
    return false;
  }

  public getDoorPoint(): { x: number; y: number } {
    return { x: this.x, y: this.y + (this.isLarge ? 48 : 42) };
  }

  public getBuildSpotFor(vx: number, vy: number): { x: number; y: number } {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, vx, vy);
    const rx = this.isLarge ? 74 : 60;
    const ry = this.isLarge ? 62 : 52;
    return {
      x: this.x + Math.cos(angle) * rx,
      y: this.y + Math.sin(angle) * ry,
    };
  }

  public isPointInsideClickArea(worldX: number, worldY: number): boolean {
    const r = this.isLarge ? 76 : 64;
    return Phaser.Math.Distance.Between(worldX, worldY, this.x, this.y - 12) <= r;
  }

  public canAcceptSleeper(): boolean {
    return this.isComplete() && this.sleepers.size < this.maxSleepers && !this.isBreeding();
  }

  public enterSleep(v: Villager): void {
    this.sleepers.add(v);
  }

  public leaveSleep(v: Villager): void {
    this.sleepers.delete(v);
  }

  public isBreeding(): boolean {
    return this.breedingPair !== null;
  }

  public canBreedNow(): boolean {
    return this.isComplete() && !this.isBreeding() && this.sleepers.size === 0;
  }

  public reserveBreeding(a: Villager, b: Villager): void {
    this.breedingPair = [a, b];
    this.breedingEntered.clear();
    this.breedingTimer = 0;
    this.heartTimer = 300;
  }

  public notifyBreederEntered(v: Villager): void {
    if (!this.breedingPair) return;
    if (this.breedingPair[0] === v || this.breedingPair[1] === v) {
      this.breedingEntered.add(v);
    }
  }

  public abortBreeding(): void {
    const pair = this.breedingPair;
    this.breedingPair = null;
    this.breedingEntered.clear();
    this.breedingTimer = 0;
    this.sprite.setAngle(0);
    this.sprite.setScale(1, 1);
    if (pair) {
      for (const p of pair) {
        if (p.scene) {
          p.cancelBreedingFromHut(this.getDoorPoint());
        }
      }
    }
  }

  public update(delta: number): void {
    this.doorGlow.setVisible(this.sleepers.size > 0 || this.breedingEntered.size > 0);
    if (this.doorGlow.visible) {
      this.doorGlow.setAlpha(0.32 + Math.sin(this.scene.time.now * 0.008) * 0.12);
    }

    if (this.sleepers.size > 0) {
      this.zzzTimer -= delta;
      if (this.zzzTimer <= 0) {
        this.zzzTimer = 1100;
        this.spawnRoofFloat('Zzz', '#bae6fd', '13px');
      }
    }

    if (this.isComplete() && this.season === 'WINTER') {
      this.smokeTimer -= delta;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = Phaser.Math.Between(650, 1050);
        this.spawnChimneySmoke();
      }
    }

    if (this.breedingPair && this.breedingEntered.size === 2) {
      this.breedingTimer += delta;
      const t = this.scene ? this.scene.time.now : 0;
      this.sprite.setAngle(Math.sin(t * 0.011) * 5.2);
      const squash = Math.sin(t * 0.022) * 0.045;
      this.sprite.setScale(1 + squash, 1 - squash);

      this.heartTimer -= delta;
      if (this.heartTimer <= 0) {
        this.heartTimer = 900;
        this.spawnRoofFloat('❤️', '#fda4af', '16px');
      }

      if (this.breedingTimer >= BREED_DURATION_MS) {
        const [a, b] = this.breedingPair;
        this.breedingPair = null;
        this.breedingEntered.clear();
        this.breedingTimer = 0;
        this.sprite.setAngle(0);
        this.sprite.setScale(1, 1);
        this.onBirthReady(this, a, b);
      }
    } else if (this.sprite.angle !== 0 && !this.scene?.tweens.isTweening(this.sprite)) {
      this.sprite.setAngle(0);
      this.sprite.setScale(1, 1);
    }
  }

  private spawnChimneySmoke(): void {
    if (!this.scene) return;
    const smoke = this.scene.add.image(
      this.x + Phaser.Math.Between(-4, 4),
      this.y - (this.isLarge ? 92 : 78),
      'particle-smoke'
    );
    smoke.setScale(0.35);
    smoke.setAlpha(0.55);
    smoke.setDepth(this.y + 42);

    this.scene.tweens.add({
      targets: smoke,
      x: smoke.x + Phaser.Math.Between(8, 22),
      y: smoke.y - Phaser.Math.Between(36, 54),
      scale: 0.95,
      alpha: 0,
      duration: 1800,
      ease: 'Sine.easeOut',
      onComplete: () => smoke.destroy(),
    });
  }

  private spawnRoofFloat(label: string, color: string, fontSize: string): void {
    if (!this.scene) return;
    const ox = Phaser.Math.Between(-14, 14);
    const t = this.scene.add
      .text(this.x + ox, this.y - (this.isLarge ? 72 : 58), label, {
        fontSize,
        fontStyle: 'bold',
        color,
        stroke: '#2b1e14',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(this.y + 40);

    this.scene.tweens.add({
      targets: t,
      y: this.y - (this.isLarge ? 112 : 96),
      x: t.x + Phaser.Math.Between(-8, 12),
      alpha: 0,
      duration: 1300,
      ease: 'Cubic.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  private playBuildBounce(): void {
    if (!this.scene) return;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(1, 1);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.06,
      scaleY: 0.94,
      duration: 95,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private spawnBuildParticles(): void {
    if (!this.scene) return;
    for (let i = 0; i < 6; i++) {
      const chip = this.scene.add.image(
        this.x + Phaser.Math.Between(-30, 30),
        this.y - Phaser.Math.Between(10, 42),
        'particle-chip-wood'
      );
      chip.setDepth(this.y + 30);
      chip.setAngle(Phaser.Math.Between(0, 360));
      this.scene.tweens.add({
        targets: chip,
        x: chip.x + Phaser.Math.Between(-24, 24),
        y: chip.y - Phaser.Math.Between(10, 24),
        alpha: 0,
        duration: 360,
        ease: 'Quad.easeOut',
        onComplete: () => chip.destroy(),
      });
    }
  }

  private drawProgressBar(): void {
    const w = 54;
    const h = 6;
    const x = -w / 2;
    const y = -94;

    this.progressBg.clear();
    this.progressFill.clear();

    this.progressBg.fillStyle(0x16100b, 0.85);
    this.progressBg.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 3);

    this.progressFill.fillStyle(0xfbbf24, 1);
    this.progressFill.fillRoundedRect(x, y, Math.max(3, (w * this.progress) / 100), h, 2.5);
  }
}
