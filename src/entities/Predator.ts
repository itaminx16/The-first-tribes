import Phaser from 'phaser';
import { CombatTarget, ObstacleCircle } from '../types/game';
import {
  createNavAgentState,
  NavigationAgentState,
  resetNavAgentState,
  stepSmartMove,
} from '../systems/NavigationHelper';
import { CURSORS } from '../utils/Cursors';
import { SoundFX } from '../utils/SoundFX';
import type { River } from './River';

export type PredatorSpecies = 'wolf' | 'sabertooth' | 'bear';

export interface PredatorContext {
  worldW: number;
  worldH: number;
  getObstacles: () => ObstacleCircle[];
  getRiver: () => River | null;
  getPotentialPrey: () => CombatTarget[];
  onAttackTarget: (predator: Predator, target: CombatTarget) => void;
  onKilled: (predator: Predator) => void;
}

export class Predator extends Phaser.GameObjects.Container implements CombatTarget {
  public readonly id: string;
  public readonly faction = 'predator' as const;
  public readonly species: PredatorSpecies;
  public readonly nameUk: string;
  public readonly maxHp: number;
  public hp: number;
  public readonly attackDamage: number;
  private readonly moveSpeed: number;

  private ctx: PredatorContext;
  private shadow: Phaser.GameObjects.Ellipse;
  private hoverRing: Phaser.GameObjects.Ellipse;
  private rig: Phaser.GameObjects.Container;
  private backLeg: Phaser.GameObjects.Image;
  private bodySprite: Phaser.GameObjects.Image;
  private frontLeg: Phaser.GameObjects.Image;
  private hpBg: Phaser.GameObjects.Graphics;
  private hpFill: Phaser.GameObjects.Graphics;

  private roamTarget: Phaser.Math.Vector2 | null = null;
  private chaseTarget: CombatTarget | null = null;
  private homeX: number;
  private homeY: number;
  private waitTimer = 1400;
  private scanTimer = 250;
  private attackCooldown = 0;
  private walkPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
  private alive = true;
  private roared = false;
  private navState: NavigationAgentState;

  constructor(
    scene: Phaser.Scene,
    id: string,
    x: number,
    y: number,
    species: PredatorSpecies,
    ctx: PredatorContext
  ) {
    super(scene, x, y);
    this.id = id;
    this.species = species;
    this.ctx = ctx;
    this.homeX = x;
    this.homeY = y;
    this.navState = createNavAgentState(x, y, id.charCodeAt(id.length - 1) || 0);

    if (species === 'wolf') {
      this.nameUk = 'Лютий вовк';
      this.maxHp = 70;
      this.attackDamage = 11;
      this.moveSpeed = 118;
    } else if (species === 'sabertooth') {
      this.nameUk = 'Шаблезубий тигр';
      this.maxHp = 95;
      this.attackDamage = 15;
      this.moveSpeed = 122;
    } else {
      this.nameUk = 'Печерний ведмідь';
      this.maxHp = 135;
      this.attackDamage = 21;
      this.moveSpeed = 96;
    }
    this.hp = this.maxHp;

    this.hoverRing = scene.add.ellipse(0, 4, 72, 32, 0xef4444, 0.2);
    this.hoverRing.setStrokeStyle(2.2, 0xf87171, 0.95);
    this.hoverRing.setVisible(false);

    this.shadow = scene.add.ellipse(0, 6, 52, 18, 0x1a0c08, 0.34);

    this.rig = scene.add.container(0, 0);
    const legKey = `predator-${species}-leg`;
    const bodyKey = `predator-${species}-body`;
    this.backLeg = scene.add.image(-14, -12, legKey).setOrigin(0.5, 0.15).setScale(0.76);
    this.frontLeg = scene.add.image(13, -12, legKey).setOrigin(0.5, 0.15).setScale(0.76);
    this.bodySprite = scene.add.image(0, -21, bodyKey).setScale(0.7);
    this.rig.add([this.backLeg, this.bodySprite, this.frontLeg]);

    this.hpBg = scene.add.graphics();
    this.hpFill = scene.add.graphics();

    this.add([this.hoverRing, this.shadow, this.rig, this.hpBg, this.hpFill]);
    this.setSize(76, 62);
    this.setDepth(y);
    this.drawHpBar();

    const hitCircle = new Phaser.Geom.Circle(0, -18, 38);
    this.setInteractive(hitCircle, Phaser.Geom.Circle.Contains);
    if (this.input) {
      this.input.cursor = CURSORS.attack;
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
    return this.alive && Phaser.Math.Distance.Between(wx, wy, this.x, this.y - 16) <= 42;
  }

  public takeDamage(
    amount: number,
    _attackerX: number,
    _attackerY: number,
    attacker?: CombatTarget
  ): boolean {
    if (!this.alive || !this.scene) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.drawHpBar();

    this.bodySprite.setTint(0xff9999);
    this.scene.time.delayedCall(110, () => {
      if (this.bodySprite.scene) this.bodySprite.clearTint();
    });

    if (attacker && attacker.isAlive() && !this.chaseTarget) {
      this.chaseTarget = attacker;
    }

    if (this.hp <= 0) {
      this.alive = false;
      this.hoverRing.setVisible(false);
      this.disableInteractive();
      this.hpBg.clear();
      this.hpFill.clear();
      this.ctx.onKilled(this);

      this.scene.tweens.add({
        targets: this.rig,
        angle: this.rig.scaleX * 85,
        y: 8,
        alpha: 0,
        duration: 460,
        ease: 'Quad.easeIn',
        onComplete: () => this.destroy()
      });
      return true;
    }
    return false;
  }

  public update(delta: number): void {
    if (!this.alive || !this.scene) return;
    const dt = delta / 1000;
    if (this.attackCooldown > 0) {
      this.attackCooldown = Math.max(0, this.attackCooldown - delta);
    }

    if (this.chaseTarget && !this.chaseTarget.isAlive()) {
      this.chaseTarget = null;
      this.roared = false;
    }

    this.scanTimer -= delta;
    if (!this.chaseTarget && this.scanTimer <= 0) {
      this.scanTimer = 300;
      this.scanForPrey();
    }

    if (this.chaseTarget) {
      const targetPad = 'buildingType' in this.chaseTarget ? 42 : 0;
      const dist = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        this.chaseTarget.x,
        this.chaseTarget.y
      );
      if (dist > 600) {
        this.chaseTarget = null;
        this.roared = false;
      } else if (dist <= 40 + targetPad) {
        resetNavAgentState(this.navState, this.x, this.y);
        this.resetLegs();
        const dx = this.chaseTarget.x - this.x;
        if (Math.abs(dx) > 0.5) this.rig.scaleX = dx >= 0 ? 1 : -1;
        if (this.attackCooldown <= 0) {
          this.attackCooldown = 920;
          this.rig.y = -4;
          this.chaseTarget.takeDamage(this.attackDamage, this.x, this.y, this);
          this.ctx.onAttackTarget(this, this.chaseTarget);
        }
      } else {
        this.stepToward(this.chaseTarget.x, this.chaseTarget.y, dt, this.moveSpeed);
      }
    } else if (this.roamTarget) {
      const dist = Phaser.Math.Distance.Between(this.x, this.y, this.roamTarget.x, this.roamTarget.y);
      if (dist <= 14) {
        this.roamTarget = null;
        this.waitTimer = Phaser.Math.Between(1600, 3400);
        this.resetLegs();
      } else {
        this.stepToward(this.roamTarget.x, this.roamTarget.y, dt, this.moveSpeed * 0.52);
      }
    } else {
      this.resetLegs();
      this.waitTimer -= delta;
      if (this.waitTimer <= 0) {
        this.pickRoamTarget();
      }
    }

    this.setDepth(this.y);
  }

  private scanForPrey(): void {
    let best: CombatTarget | null = null;
    let bestDist = 250;
    for (const candidate of this.ctx.getPotentialPrey()) {
      if (!candidate.isAlive()) continue;
      const d = Phaser.Math.Distance.Between(this.x, this.y, candidate.x, candidate.y);
      if (d < bestDist) {
        bestDist = d;
        best = candidate;
      }
    }
    if (best) {
      this.chaseTarget = best;
      if (!this.roared) {
        this.roared = true;
        SoundFX.playPredatorRoar();
      }
    }
  }

  private stepToward(tx: number, ty: number, dt: number, speed: number): void {
    const res = stepSmartMove(
      this.x,
      this.y,
      tx,
      ty,
      dt,
      speed,
      18,
      10,
      this.ctx.getObstacles(),
      this.ctx.getRiver(),
      this.ctx.worldW,
      this.ctx.worldH,
      this.navState
    );

    this.x = Phaser.Math.Clamp(res.x, 85, this.ctx.worldW - 85);
    this.y = Phaser.Math.Clamp(res.y, 100, this.ctx.worldH - 85);
    if (Math.abs(res.dx) > 0.25) {
      this.rig.scaleX = res.dx >= 0 ? 1 : -1;
    }

    this.walkPhase += dt * (this.chaseTarget ? 16 : 9);
    const s = Math.sin(this.walkPhase);
    this.backLeg.setAngle(s * 24);
    this.frontLeg.setAngle(-s * 24);
    this.rig.y = -Math.abs(s) * 2.5;
  }

  private pickRoamTarget(): void {
    for (let i = 0; i < 10; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const r = Phaser.Math.Between(120, 320);
      const tx = Phaser.Math.Clamp(this.homeX + Math.cos(a) * r, 110, this.ctx.worldW - 110);
      const ty = Phaser.Math.Clamp(this.homeY + Math.sin(a) * r, 120, this.ctx.worldH - 110);
      if (
        this.ctx.getObstacles().some((o) => Phaser.Math.Distance.Between(tx, ty, o.x, o.y) < o.radius + 24)
      ) {
        continue;
      }
      this.roamTarget = new Phaser.Math.Vector2(tx, ty);
      return;
    }
    this.waitTimer = 1400;
  }

  private resetLegs(): void {
    this.backLeg.setAngle(0);
    this.frontLeg.setAngle(0);
    this.rig.y = 0;
  }

  private drawHpBar(): void {
    const w = 42;
    const h = 4.5;
    const x = -w / 2;
    const y = -52;
    this.hpBg.clear();
    this.hpFill.clear();
    this.hpBg.fillStyle(0x16100b, 0.9);
    this.hpBg.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 2);
    this.hpFill.fillStyle(0xef4444, 1);
    this.hpFill.fillRoundedRect(x, y, Math.max(2, (w * this.hp) / this.maxHp), h, 2);
  }
}
