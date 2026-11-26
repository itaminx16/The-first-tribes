import Phaser from 'phaser';
import { ObstacleCircle } from '../types/game';
import { CURSORS } from '../utils/Cursors';

export type AnimalSpecies = 'boar' | 'deer' | 'mammoth';

export class Animal extends Phaser.GameObjects.Container {
  public readonly species: AnimalSpecies;
  public readonly nameUk: string;
  public readonly maxHp: number;
  public hp: number;
  public readonly meatYield: number;

  private shadow: Phaser.GameObjects.Ellipse;
  private hoverRing: Phaser.GameObjects.Ellipse;
  private rig: Phaser.GameObjects.Container;
  private backLeg: Phaser.GameObjects.Image;
  private bodySprite: Phaser.GameObjects.Image;
  private frontLeg: Phaser.GameObjects.Image;
  private hpBg: Phaser.GameObjects.Graphics;
  private hpFill: Phaser.GameObjects.Graphics;

  private getObstacles: () => ObstacleCircle[];
  private onKilled?: (animal: Animal) => void;
  private onCounterAttack?: (animal: Animal, attackerX: number, attackerY: number) => void;
  private worldW: number;
  private worldH: number;
  private homeX: number;
  private homeY: number;

  private walkTarget: Phaser.Math.Vector2 | null = null;
  private fleeTarget: Phaser.Math.Vector2 | null = null;
  private waitTimer = Phaser.Math.Between(1200, 3200);
  private walkPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
  private counterCooldownMs = 0;
  private alive = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    species: AnimalSpecies,
    worldW: number,
    worldH: number,
    getObstacles: () => ObstacleCircle[],
    onKilled?: (animal: Animal) => void,
    onCounterAttack?: (animal: Animal, attackerX: number, attackerY: number) => void
  ) {
    super(scene, x, y);
    this.species = species;
    this.nameUk =
      species === 'mammoth' ? 'Могутній мамонт' : species === 'boar' ? 'Дикий кабан' : 'Лісовий олень';
    this.maxHp = species === 'mammoth' ? 260 : species === 'boar' ? 45 : 35;
    this.hp = this.maxHp;
    this.meatYield = species === 'mammoth' ? 55 : 15;
    this.worldW = worldW;
    this.worldH = worldH;
    this.homeX = x;
    this.homeY = y;
    this.getObstacles = getObstacles;
    this.onKilled = onKilled;
    this.onCounterAttack = onCounterAttack;

    const isMammoth = species === 'mammoth';
    this.hoverRing = scene.add.ellipse(0, 4, isMammoth ? 108 : 64, isMammoth ? 46 : 28, 0xef4444, 0.16);
    this.hoverRing.setStrokeStyle(2.2, 0xfca5a5, 0.9);
    this.hoverRing.setVisible(false);

    this.shadow = scene.add.ellipse(
      0,
      5,
      isMammoth ? 84 : species === 'boar' ? 44 : 46,
      isMammoth ? 28 : 16,
      0x162612,
      0.32
    );

    this.rig = scene.add.container(0, 0);
    const legKey = `animal-${species}-leg`;
    const bodyKey = `animal-${species}-body`;

    this.backLeg = scene.add
      .image(isMammoth ? -22 : -12, isMammoth ? -16 : -10, legKey)
      .setOrigin(0.5, 0.15)
      .setScale(isMammoth ? 1.02 : 0.75);
    this.frontLeg = scene.add
      .image(isMammoth ? 20 : 11, isMammoth ? -16 : -10, legKey)
      .setOrigin(0.5, 0.15)
      .setScale(isMammoth ? 1.02 : 0.75);
    this.bodySprite = scene.add
      .image(0, isMammoth ? -36 : species === 'boar' ? -16 : -21, bodyKey)
      .setScale(isMammoth ? 0.88 : 0.62);
    this.rig.add([this.backLeg, this.bodySprite, this.frontLeg]);

    this.hpBg = scene.add.graphics();
    this.hpFill = scene.add.graphics();

    this.add([this.hoverRing, this.shadow, this.rig, this.hpBg, this.hpFill]);
    this.setSize(isMammoth ? 116 : 68, isMammoth ? 96 : 56);
    this.setDepth(y);

    const hitCircle = new Phaser.Geom.Circle(0, isMammoth ? -28 : -16, isMammoth ? 52 : 36);
    this.setInteractive(hitCircle, Phaser.Geom.Circle.Contains);
    if (this.input) {
      this.input.cursor = CURSORS.hunt;
    }

    this.on('pointerover', () => {
      if (this.alive) this.hoverRing.setVisible(true);
    });
    this.on('pointerout', () => {
      this.hoverRing.setVisible(false);
    });

    scene.add.existing(this);
  }

  public isAlive(): boolean {
    return this.alive && Boolean(this.scene);
  }

  public isPointInsideClickArea(wx: number, wy: number): boolean {
    return this.alive && Phaser.Math.Distance.Between(wx, wy, this.x, this.y - 14) <= 40;
  }

  public takeDamage(damage: number, attackerX: number, attackerY: number): boolean {
    if (!this.alive || !this.scene) return false;
    this.hp = Math.max(0, this.hp - damage);
    this.drawHpBar();

    // Flash hurt & bounce
    this.bodySprite.setTint(0xff9999);
    this.scene.time.delayedCall(120, () => {
      if (this.bodySprite.scene) this.bodySprite.clearTint();
    });

    this.spawnHitEffect();

    if (this.hp <= 0) {
      this.alive = false;
      this.hoverRing.setVisible(false);
      this.disableInteractive();
      this.hpBg.clear();
      this.hpFill.clear();
      this.onKilled?.(this);

      this.scene.tweens.add({
        targets: this.rig,
        angle: this.rig.scaleX * 84,
        y: 8,
        alpha: 0,
        duration: 480,
        ease: 'Quad.easeIn',
        onComplete: () => this.destroy()
      });
      return true;
    }

    if (this.species === 'mammoth') {
      // Mammoth stands its ground & tusk-swings back!
      if (this.counterCooldownMs <= 0) {
        this.counterCooldownMs = 1500;
        this.onCounterAttack?.(this, attackerX, attackerY);
      }
      const angle = Phaser.Math.Angle.Between(this.x, this.y, attackerX, attackerY);
      const fx = Phaser.Math.Clamp(this.x + Math.cos(angle) * 28, 95, this.worldW - 95);
      const fy = Phaser.Math.Clamp(this.y + Math.sin(angle) * 28, 105, this.worldH - 95);
      this.fleeTarget = new Phaser.Math.Vector2(fx, fy);
      this.walkTarget = null;
      return false;
    }

    // Flee briskly away from hunter while staying catchable in pursuit
    const angle = Phaser.Math.Angle.Between(attackerX, attackerY, this.x, this.y);
    const fleeDist = this.species === 'deer' ? 195 : 165;
    const fx = Phaser.Math.Clamp(this.x + Math.cos(angle) * fleeDist, 95, this.worldW - 95);
    const fy = Phaser.Math.Clamp(this.y + Math.sin(angle) * fleeDist, 105, this.worldH - 95);
    this.fleeTarget = new Phaser.Math.Vector2(fx, fy);
    this.walkTarget = null;
    return false;
  }

  public update(delta: number): void {
    if (!this.alive || !this.scene) return;
    this.counterCooldownMs = Math.max(0, this.counterCooldownMs - delta);
    const dt = delta / 1000;
    const target = this.fleeTarget ?? this.walkTarget;

    if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= 10) {
        if (this.fleeTarget) this.fleeTarget = null;
        else this.walkTarget = null;
        this.waitTimer = Phaser.Math.Between(1400, 3200);
        this.resetLegs();
      } else {
        const isFleeing = Boolean(this.fleeTarget);
        const speed = isFleeing
          ? this.species === 'deer'
            ? 96
            : this.species === 'mammoth'
              ? 68
              : 84
          : this.species === 'deer'
            ? 54
            : this.species === 'mammoth'
              ? 36
              : 44;
        const step = Math.min(dist, speed * dt);
        let nx = this.x + (dx / dist) * step;
        let ny = this.y + (dy / dist) * step;

        // Avoid obstacles cleanly
        for (const obs of this.getObstacles()) {
          const ox = nx - obs.x;
          const oy = ny - obs.y;
          const od = Math.hypot(ox, oy);
          const minSep = obs.radius + 16;
          if (od < minSep && od > 0.01) {
            nx = obs.x + (ox / od) * minSep;
            ny = obs.y + (oy / od) * minSep;
          }
        }

        this.x = Phaser.Math.Clamp(nx, 80, this.worldW - 80);
        this.y = Phaser.Math.Clamp(ny, 95, this.worldH - 80);
        if (Math.abs(dx) > 0.4) {
          this.rig.scaleX = dx >= 0 ? 1 : -1;
        }

        this.walkPhase += dt * (isFleeing ? 18 : 9);
        const s = Math.sin(this.walkPhase);
        this.backLeg.setAngle(s * 24);
        this.frontLeg.setAngle(-s * 24);
        this.rig.y = -Math.abs(s) * 2.5;
      }
    } else {
      this.resetLegs();
      this.waitTimer -= delta;
      if (this.waitTimer <= 0) {
        this.pickWanderPoint();
      }
    }

    this.setDepth(this.y);
  }

  private pickWanderPoint(): void {
    for (let attempt = 0; attempt < 12; attempt++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const r = Phaser.Math.Between(90, 210);
      const tx = Phaser.Math.Clamp(this.homeX + Math.cos(a) * r, 95, this.worldW - 95);
      const ty = Phaser.Math.Clamp(this.homeY + Math.sin(a) * r, 110, this.worldH - 95);
      if (
        this.getObstacles().some(
          (o) => Phaser.Math.Distance.Between(tx, ty, o.x, o.y) < o.radius + 24
        )
      ) {
        continue;
      }
      this.walkTarget = new Phaser.Math.Vector2(tx, ty);
      return;
    }
    this.waitTimer = 1500;
  }

  private resetLegs(): void {
    this.backLeg.setAngle(0);
    this.frontLeg.setAngle(0);
    this.rig.y = 0;
  }

  private drawHpBar(): void {
    const w = 36;
    const h = 4;
    const x = -w / 2;
    const y = -48;
    this.hpBg.clear();
    this.hpFill.clear();
    this.hpBg.fillStyle(0x16100b, 0.88);
    this.hpBg.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 2);
    this.hpFill.fillStyle(0xef4444, 1);
    this.hpFill.fillRoundedRect(x, y, Math.max(2, (w * this.hp) / this.maxHp), h, 2);
  }

  private spawnHitEffect(): void {
    if (!this.scene) return;
    for (let i = 0; i < 4; i++) {
      const p = this.scene.add.circle(
        this.x + Phaser.Math.Between(-8, 8),
        this.y - 16 + Phaser.Math.Between(-6, 6),
        3,
        0xfca5a5,
        0.9
      );
      p.setDepth(this.y + 30);
      this.scene.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-18, 18),
        y: p.y - Phaser.Math.Between(10, 22),
        alpha: 0,
        duration: 280,
        onComplete: () => p.destroy()
      });
    }
  }
}
