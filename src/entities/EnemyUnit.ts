import Phaser from 'phaser';
import {
  ARMOR_DEFS,
  ArmorType,
  CombatTarget,
  Gender,
  ObstacleCircle,
  ResourceType,
  VillagerAppearanceId,
  WARRIOR_CLASS_WEAPON,
  WarriorClass,
  WEAPON_DEFS,
} from '../types/game';
import { CURSORS } from '../utils/Cursors';
import { SoundFX } from '../utils/SoundFX';
import {
  createNavAgentState,
  NavigationAgentState,
  resetNavAgentState,
  stepSmartMove,
} from '../systems/NavigationHelper';
import type { ResourceNode } from './ResourceNode';
import type { River } from './River';

export type EnemyMode = 'GATHERER' | 'GUARD' | 'RAID' | 'CONVERTING' | 'CAPTIVE';

export interface EnemyUnitContext {
  worldW: number;
  worldH: number;
  getObstacles: () => ObstacleCircle[];
  getRiver: () => River | null;
  findHostileTarget: (unit: EnemyUnit, maxRange: number) => CombatTarget | null;
  findBlockingBarricade: (x: number, y: number, range: number) => {
    x: number;
    y: number;
    isAlive: () => boolean;
    takeDamage: (dmg: number) => void;
  } | null;
  findResourceForGatherer: (unit: EnemyUnit) => ResourceNode | null;
  onDeliverResource: (unit: EnemyUnit, type: ResourceType, amount: number) => void;
  onAttackTarget: (attacker: EnemyUnit, target: CombatTarget) => void;
  onKilled: (unit: EnemyUnit, killer?: CombatTarget) => void;
  onRetreatHome: (unit: EnemyUnit) => void;
}

export class EnemyUnit extends Phaser.GameObjects.Container implements CombatTarget {
  public readonly id: string;
  public readonly unitName: string;
  public readonly faction = 'rival' as const;
  public readonly tribeId: string;
  public readonly tribeColor: number;
  public readonly gender: Gender;
  public readonly appearance: VillagerAppearanceId;
  public warriorClass: WarriorClass | null;
  public armor: ArmorType;
  public mode: EnemyMode;

  public maxHp: number;
  public hp: number;
  private homeX: number;
  private homeY: number;
  private raidDest: { x: number; y: number; tribeId: string } | null;
  private ctx: EnemyUnitContext;

  private ring: Phaser.GameObjects.Ellipse;
  private hoverRing: Phaser.GameObjects.Ellipse;
  private shadow: Phaser.GameObjects.Ellipse;
  private rig: Phaser.GameObjects.Container;
  private backArm: Phaser.GameObjects.Image;
  private leftLeg: Phaser.GameObjects.Image;
  private rightLeg: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private armorOverlay: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private frontArmGroup: Phaser.GameObjects.Container;
  private frontArm: Phaser.GameObjects.Image;
  private weaponSprite: Phaser.GameObjects.Image;
  private carryIcon: Phaser.GameObjects.Image;
  private roleBadge: Phaser.GameObjects.Text;
  private hpBg: Phaser.GameObjects.Graphics;
  private hpFill: Phaser.GameObjects.Graphics;

  private patrolPoint: Phaser.Math.Vector2 | null = null;
  private patrolWait = Phaser.Math.Between(600, 1800);
  private target: CombatTarget | null = null;
  private attackCooldown = 0;
  private scanTimer = Phaser.Math.Between(50, 280);
  private walkPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
  private alive = true;
  private raidTimeoutMs = 95_000;

  // Gatherer economy state
  private targetNode: ResourceNode | null = null;
  private gatherSubState: 'SEEK' | 'MOVE_TO_NODE' | 'WORK' | 'RETURN_HOME' = 'SEEK';
  private workTimerMs = 0;
  private carriedType: ResourceType | null = null;
  private carriedAmount = 0;

  // Captive walk state
  private captiveDest: { x: number; y: number; onArrived: () => void } | null = null;
  private navState: NavigationAgentState;

  constructor(
    scene: Phaser.Scene,
    id: string,
    unitName: string,
    x: number,
    y: number,
    tribeId: string,
    tribeColor: number,
    gender: Gender,
    appearance: VillagerAppearanceId,
    warriorClass: WarriorClass | null,
    armor: ArmorType,
    mode: EnemyMode,
    homeX: number,
    homeY: number,
    raidDest: { x: number; y: number; tribeId: string } | null,
    ctx: EnemyUnitContext
  ) {
    super(scene, x, y);
    this.id = id;
    this.unitName = unitName;
    this.tribeId = tribeId;
    this.tribeColor = tribeColor;
    this.gender = gender;
    this.appearance = appearance;
    this.warriorClass = warriorClass;
    this.armor = armor;
    this.mode = mode;
    this.homeX = homeX;
    this.homeY = homeY;
    this.raidDest = raidDest;
    this.ctx = ctx;
    this.navState = createNavAgentState(x, y, id.charCodeAt(id.length - 1) || 0);

    const wBonus = warriorClass ? WEAPON_DEFS[WARRIOR_CLASS_WEAPON[warriorClass]].bonusHp : 0;
    const aBonus = armor === 'bone_armor' ? 45 : armor === 'hide_armor' ? 20 : 0;
    this.maxHp = 115 + wBonus + aBonus;
    this.hp = this.maxHp;

    this.hoverRing = scene.add.ellipse(0, 6, 52, 22, 0xef4444, 0.22);
    this.hoverRing.setStrokeStyle(2, 0xf87171, 0.95);
    this.hoverRing.setVisible(false);

    this.ring = scene.add.ellipse(0, 6, 40, 16, tribeColor, 0.24);
    this.ring.setStrokeStyle(1.8, tribeColor, 0.92);

    this.shadow = scene.add.ellipse(0, 6, 30, 11, 0x16120c, 0.34);

    this.rig = scene.add.container(0, 0);
    const app = appearance;
    this.backArm = scene.add.image(-12, -21, `v-${app}-arm`).setOrigin(0.5, 0.2).setScale(0.48);
    this.leftLeg = scene.add.image(-5, -8, `v-${app}-leg`).setOrigin(0.5, 0.15).setScale(0.48);
    this.rightLeg = scene.add.image(5, -8, `v-${app}-leg`).setOrigin(0.5, 0.15).setScale(0.48);
    this.torso = scene.add.image(0, -19, `v-${app}-torso-front`).setScale(0.48);
    this.applyTribeTint();

    this.armorOverlay = scene.add
      .image(0, -19, armor === 'bone_armor' ? 'armor-bone-overlay' : 'armor-hide-overlay')
      .setScale(0.48);
    this.armorOverlay.setVisible(armor !== 'none');

    this.head = scene.add.image(0, -35, `v-${app}-head-front`).setOrigin(0.5, 0.65).setScale(0.48);

    this.frontArmGroup = scene.add.container(12, -21);
    this.frontArm = scene.add.image(0, 0, `v-${app}-arm`).setOrigin(0.5, 0.2).setScale(0.48);
    this.weaponSprite = scene.add
      .image(3, 8, this.getToolOrWeaponTexture())
      .setOrigin(0.5, 0.7)
      .setScale(0.46);
    this.frontArmGroup.add([this.frontArm, this.weaponSprite]);

    this.carryIcon = scene.add.image(14, -25, 'carry-wood-1').setScale(0.56).setVisible(false);

    this.rig.add([
      this.leftLeg,
      this.rightLeg,
      this.backArm,
      this.torso,
      this.armorOverlay,
      this.head,
      this.frontArmGroup,
      this.carryIcon,
    ]);

    this.roleBadge = scene.add
      .text(0, -68, '', {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#fef08a',
        backgroundColor: 'rgba(20, 14, 10, 0.75)',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5);
    this.refreshRoleBadge();

    this.hpBg = scene.add.graphics();
    this.hpFill = scene.add.graphics();

    this.add([
      this.hoverRing,
      this.ring,
      this.shadow,
      this.rig,
      this.roleBadge,
      this.hpBg,
      this.hpFill,
    ]);
    this.setSize(52, 66);
    this.setDepth(y);
    this.drawHpBar();

    const hitCircle = new Phaser.Geom.Circle(0, -18, 30);
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

  private applyTribeTint(): void {
    this.torso.setTint(
      Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0xffffff),
        Phaser.Display.Color.ValueToColor(this.tribeColor),
        100,
        36
      ).color
    );
  }

  private getToolOrWeaponTexture(): string {
    if (this.warriorClass === 'archer') return 'tool-bow';
    if (this.warriorClass === 'clubman') return 'tool-bone-club';
    if (this.warriorClass === 'spearman') return 'tool-spear';
    return 'tool-sharp-stone';
  }

  private refreshRoleBadge(): void {
    if (this.mode === 'CAPTIVE') {
      this.roleBadge.setText(`🌀 ${this.unitName} (До Тотема)`);
      this.roleBadge.setColor('#67e8f9');
    } else if (this.mode === 'CONVERTING') {
      this.roleBadge.setText(`🔮 ${this.unitName} (Слухає Шамана)`);
      this.roleBadge.setColor('#c084fc');
    } else if (this.mode === 'GATHERER') {
      this.roleBadge.setText(`🧺 ${this.unitName}`);
      this.roleBadge.setColor('#fde68a');
    } else {
      this.roleBadge.setText(`⚔️ ${this.unitName}`);
      this.roleBadge.setColor('#fca5a5');
    }
  }

  public promoteToWarrior(
    wClass: WarriorClass,
    armor: ArmorType,
    mode: 'GUARD' | 'RAID',
    raidDest: { x: number; y: number; tribeId: string } | null
  ): void {
    this.warriorClass = wClass;
    this.armor = armor;
    this.mode = mode;
    this.raidDest = raidDest;
    this.carriedType = null;
    this.carriedAmount = 0;
    this.carryIcon.setVisible(false);
    this.targetNode = null;

    const wBonus = WEAPON_DEFS[WARRIOR_CLASS_WEAPON[wClass]].bonusHp;
    const aBonus = armor === 'bone_armor' ? 45 : armor === 'hide_armor' ? 20 : 0;
    this.maxHp = 115 + wBonus + aBonus;
    this.hp = this.maxHp;

    this.weaponSprite.setTexture(this.getToolOrWeaponTexture());
    this.armorOverlay.setTexture(
      armor === 'bone_armor' ? 'armor-bone-overlay' : 'armor-hide-overlay'
    );
    this.armorOverlay.setVisible(armor !== 'none');
    this.refreshRoleBadge();
    this.drawHpBar();
  }

  public setRaidOrder(dest: { x: number; y: number; tribeId: string }): void {
    this.mode = 'RAID';
    this.raidDest = dest;
    this.raidTimeoutMs = 95_000;
    this.refreshRoleBadge();
  }

  public canBeConverted(): boolean {
    return this.alive && this.mode === 'GATHERER';
  }

  public beginConversionBy(): void {
    if (!this.alive) return;
    this.mode = 'CONVERTING';
    this.target = null;
    this.targetNode = null;
    this.resetAnim();
    this.refreshRoleBadge();
  }

  public cancelConversion(): void {
    if (!this.alive || this.mode !== 'CONVERTING') return;
    this.mode = 'GATHERER';
    this.gatherSubState = 'SEEK';
    this.refreshRoleBadge();
  }

  public walkToPlayerTotem(totemX: number, totemY: number, onArrived: () => void): void {
    if (!this.alive) return;
    this.mode = 'CAPTIVE';
    this.target = null;
    this.targetNode = null;
    this.carriedType = null;
    this.carriedAmount = 0;
    this.carryIcon.setVisible(false);
    this.captiveDest = { x: totemX, y: totemY, onArrived };
    this.ring.setStrokeStyle(2, 0x38bdf8, 0.95);
    this.refreshRoleBadge();
  }

  public isAlive(): boolean {
    return this.alive && Boolean(this.scene);
  }

  public isPointInsideClickArea(wx: number, wy: number): boolean {
    return this.alive && Phaser.Math.Distance.Between(wx, wy, this.x, this.y - 16) <= 34;
  }

  public takeDamage(
    rawAmount: number,
    _attackerX: number,
    _attackerY: number,
    attacker?: CombatTarget
  ): boolean {
    if (!this.alive || !this.scene || this.mode === 'CAPTIVE') return false;
    const red = this.armor === 'none' ? 0 : ARMOR_DEFS[this.armor].reduction;
    const finalDmg = Math.max(2, Math.round(rawAmount * (1 - red)));
    this.hp = Math.max(0, this.hp - finalDmg);
    this.drawHpBar();

    this.torso.setTint(0xff9999);
    this.head.setTint(0xff9999);
    this.scene.time.delayedCall(110, () => {
      if (this.scene && this.alive) {
        this.head.clearTint();
        this.applyTribeTint();
      }
    });

    if (this.mode === 'CONVERTING') {
      this.cancelConversion();
    }

    if (attacker && attacker.isAlive() && attacker.tribeId !== this.tribeId) {
      this.target = attacker;
    }

    if (this.hp <= 0) {
      this.alive = false;
      this.hoverRing.setVisible(false);
      this.disableInteractive();
      this.hpBg.clear();
      this.hpFill.clear();
      this.ctx.onKilled(this, attacker);

      this.scene.tweens.add({
        targets: this.rig,
        angle: 84,
        y: 8,
        alpha: 0,
        duration: 420,
        onComplete: () => this.destroy(),
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

    // 1. Captive walking peacefully to Shaman Totem
    if (this.mode === 'CAPTIVE' && this.captiveDest) {
      const d = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        this.captiveDest.x,
        this.captiveDest.y
      );
      if (d <= 44) {
        const done = this.captiveDest.onArrived;
        this.captiveDest = null;
        this.alive = false;
        done();
        this.destroy();
      } else {
        this.moveToward(this.captiveDest.x, this.captiveDest.y, dt, 88);
      }
      this.setDepth(this.y);
      return;
    }

    // 2. Listening to Shaman during 20s conversion
    if (this.mode === 'CONVERTING') {
      this.resetAnim();
      this.setDepth(this.y);
      return;
    }

    if (this.target && !this.target.isAlive()) {
      this.target = null;
    }

    this.scanTimer -= delta;
    if (this.scanTimer <= 0) {
      this.scanTimer = 340;
      const scanRange = this.mode === 'RAID' ? 300 : this.mode === 'GUARD' ? 250 : 120;
      const found = this.ctx.findHostileTarget(this, scanRange);
      if (found) {
        this.target = found;
      }
    }

    if (this.target) {
      this.handleCombat(dt);
    } else if (this.mode === 'GATHERER') {
      this.handleGathererAI(delta, dt);
    } else if (this.mode === 'RAID') {
      this.raidTimeoutMs -= delta;
      if (!this.raidDest || this.raidTimeoutMs <= 0) {
        this.mode = 'GUARD';
        this.refreshRoleBadge();
        this.ctx.onRetreatHome(this);
      } else {
        const barrier = this.ctx.findBlockingBarricade(this.x, this.y, 48);
        if (barrier && barrier.isAlive()) {
          this.rig.scaleX = barrier.x >= this.x ? 1 : -1;
          if (this.attackCooldown <= 0) {
            this.attackCooldown = 850;
            this.frontArmGroup.setAngle(-48);
            SoundFX.playCombatHit();
            barrier.takeDamage(18);
          }
        } else {
          const distCamp = Phaser.Math.Distance.Between(
            this.x,
            this.y,
            this.raidDest.x,
            this.raidDest.y
          );
          if (distCamp <= 95) {
            const orbAngle =
              (this.scene.time.now * 0.001 +
                (this.id.charCodeAt(this.id.length - 1) || 0)) %
              (Math.PI * 2);
            const px = this.raidDest.x + Math.cos(orbAngle) * 76;
            const py = this.raidDest.y + Math.sin(orbAngle) * 58;
            this.moveToward(px, py, dt, 98);
          } else {
            this.moveToward(this.raidDest.x, this.raidDest.y, dt, 102);
          }
        }
      }
    } else {
      // GUARD mode patrols near home camp
      if (this.patrolPoint) {
        if (
          Phaser.Math.Distance.Between(
            this.x,
            this.y,
            this.patrolPoint.x,
            this.patrolPoint.y
          ) <= 14
        ) {
          this.patrolPoint = null;
          this.patrolWait = Phaser.Math.Between(1500, 3200);
          this.resetAnim();
        } else {
          this.moveToward(this.patrolPoint.x, this.patrolPoint.y, dt, 62);
        }
      } else {
        this.resetAnim();
        this.patrolWait -= delta;
        if (this.patrolWait <= 0) {
          const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const r = Phaser.Math.Between(60, 155);
          this.patrolPoint = new Phaser.Math.Vector2(
            Phaser.Math.Clamp(this.homeX + Math.cos(a) * r, 90, this.ctx.worldW - 90),
            Phaser.Math.Clamp(this.homeY + Math.sin(a) * r, 100, this.ctx.worldH - 90)
          );
        }
      }
    }

    this.setDepth(this.y);
  }

  private handleGathererAI(delta: number, dt: number): void {
    if (this.gatherSubState === 'SEEK') {
      const node = this.ctx.findResourceForGatherer(this);
      if (node && !node.depleted && node.active) {
        this.targetNode = node;
        this.gatherSubState = 'MOVE_TO_NODE';
      } else {
        // Patrol near camp while waiting for resources
        const distHome = Phaser.Math.Distance.Between(this.x, this.y, this.homeX, this.homeY);
        if (distHome > 160) {
          this.moveToward(this.homeX, this.homeY, dt, 76);
        } else {
          this.resetAnim();
        }
      }
      return;
    }

    if (this.gatherSubState === 'MOVE_TO_NODE') {
      if (!this.targetNode || this.targetNode.depleted || !this.targetNode.active) {
        this.targetNode = null;
        this.gatherSubState = 'SEEK';
        return;
      }
      const dist = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        this.targetNode.x,
        this.targetNode.y
      );
      if (dist <= this.targetNode.interactRadius + 8) {
        this.resetAnim();
        this.gatherSubState = 'WORK';
        this.workTimerMs = 0;
      } else {
        this.moveToward(this.targetNode.x, this.targetNode.y, dt, 86);
      }
      return;
    }

    if (this.gatherSubState === 'WORK') {
      if (!this.targetNode || this.targetNode.depleted || !this.targetNode.active) {
        this.targetNode = null;
        this.gatherSubState = this.carriedAmount > 0 ? 'RETURN_HOME' : 'SEEK';
        return;
      }
      this.rig.scaleX = this.targetNode.x >= this.x ? 1 : -1;
      this.workTimerMs += delta;
      const swing = Math.sin(this.workTimerMs * 0.015) * 38;
      this.frontArmGroup.setAngle(-20 + swing);

      if (this.workTimerMs >= 2600) {
        this.workTimerMs = 0;
        const rType = this.targetNode.resourceType;
        const taken = this.targetNode.harvest(4);
        if (taken > 0) {
          this.carriedType = rType;
          this.carriedAmount = taken;
          const tex =
            rType === 'wood'
              ? 'carry-wood-2'
              : rType === 'stone'
              ? 'carry-stone-2'
              : 'carry-food-2';
          this.carryIcon.setTexture(tex).setVisible(true);
          this.gatherSubState = 'RETURN_HOME';
        } else {
          this.gatherSubState = 'SEEK';
        }
      }
      return;
    }

    if (this.gatherSubState === 'RETURN_HOME') {
      const distHome = Phaser.Math.Distance.Between(this.x, this.y, this.homeX, this.homeY);
      if (distHome <= 75) {
        if (this.carriedType && this.carriedAmount > 0) {
          this.ctx.onDeliverResource(this, this.carriedType, this.carriedAmount);
        }
        this.carriedType = null;
        this.carriedAmount = 0;
        this.carryIcon.setVisible(false);
        this.gatherSubState = 'SEEK';
      } else {
        this.moveToward(this.homeX, this.homeY, dt, 84);
      }
    }
  }

  private handleCombat(dt: number): void {
    if (!this.target) return;
    const wDef = this.warriorClass
      ? WEAPON_DEFS[WARRIOR_CLASS_WEAPON[this.warriorClass]]
      : { damage: 7, range: 46, cooldownMs: 820, ranged: false };

    const targetPad = 'buildingType' in this.target || this.target.id.startsWith('camp-') ? 38 : 0;
    const effRange = wDef.range + targetPad;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.target.x, this.target.y);
    if (dist > 640) {
      this.target = null;
      return;
    }

    if (dist <= effRange) {
      resetNavAgentState(this.navState, this.x, this.y);
      this.resetAnim();
      this.rig.scaleX = this.target.x >= this.x ? 1 : -1;
      if (this.attackCooldown <= 0) {
        this.attackCooldown = wDef.cooldownMs;
        this.frontArmGroup.setAngle(-54);
        this.scene.time.delayedCall(120, () => {
          if (this.frontArmGroup.scene) this.frontArmGroup.setAngle(22);
        });

        if (wDef.ranged) {
          SoundFX.playBowShot();
          const arrow = this.scene.add.image(this.x, this.y - 24, 'projectile-arrow');
          arrow.setDepth(Math.max(this.y, this.target.y) + 40);
          arrow.setRotation(
            Phaser.Math.Angle.Between(this.x, this.y - 24, this.target.x, this.target.y - 18)
          );
          const tx = this.target.x;
          const ty = this.target.y - 18;
          this.scene.tweens.add({
            targets: arrow,
            x: tx,
            y: ty,
            duration: 170,
            onComplete: () => arrow.destroy(),
          });
        } else {
          SoundFX.playCombatHit();
        }

        const hitTarget = this.target;
        hitTarget.takeDamage(wDef.damage, this.x, this.y, this);
        this.ctx.onAttackTarget(this, hitTarget);
      }
    } else {
      this.moveToward(this.target.x, this.target.y, dt, 106);
    }
  }

  private moveToward(tx: number, ty: number, dt: number, speed: number): void {
    const res = stepSmartMove(
      this.x,
      this.y,
      tx,
      ty,
      dt,
      speed,
      14,
      8,
      this.ctx.getObstacles(),
      this.ctx.getRiver(),
      this.ctx.worldW,
      this.ctx.worldH,
      this.navState
    );

    this.x = Phaser.Math.Clamp(res.x, 70, this.ctx.worldW - 70);
    this.y = Phaser.Math.Clamp(res.y, 85, this.ctx.worldH - 70);
    if (Math.abs(res.dx) > 0.25) {
      this.rig.scaleX = res.dx >= 0 ? 1 : -1;
    }

    this.walkPhase += dt * 12;
    const s = Math.sin(this.walkPhase);
    this.leftLeg.setAngle(s * 22);
    this.rightLeg.setAngle(-s * 22);
    this.backArm.setAngle(-s * 18);
    this.frontArmGroup.setAngle(s * 18);
    this.rig.y = -Math.abs(s) * 2;
  }

  private resetAnim(): void {
    this.leftLeg.setAngle(0);
    this.rightLeg.setAngle(0);
    this.backArm.setAngle(0);
    this.rig.y = 0;
  }

  private drawHpBar(): void {
    const w = 32;
    const h = 4;
    const x = -w / 2;
    const y = -58;
    this.hpBg.clear();
    this.hpFill.clear();
    if (this.hp < this.maxHp) {
      this.hpBg.fillStyle(0x16100b, 0.88);
      this.hpBg.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 2);
      this.hpFill.fillStyle(this.tribeColor, 1);
      this.hpFill.fillRoundedRect(x, y, Math.max(2, (w * this.hp) / this.maxHp), h, 2);
    }
  }
}
