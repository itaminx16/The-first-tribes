import Phaser from 'phaser';
import {
  BUILDING_DEFS,
  BuildingSnapshot,
  BuildingType,
  CombatTarget,
  Gender,
  PROFESSION_LABELS_UK,
  ProfessionId,
  SEASON_DURATION_MS,
  Season,
  VillagerAppearanceId,
} from '../types/game';
import { CURSORS } from '../utils/Cursors';
import { SoundFX } from '../utils/SoundFX';
import type { Villager } from './Villager';

export interface TotemCaptive {
  id: string;
  name: string;
  gender: Gender;
  appearance: VillagerAppearanceId;
  remainingMs: number;
  badge: Phaser.GameObjects.Text;
}

export class TribeBuilding extends Phaser.GameObjects.Container {
  public readonly buildingId: string;
  public readonly buildingType: Exclude<BuildingType, 'hut' | 'large_hut'>;
  public readonly nameUk: string;
  public readonly descUk: string;
  public readonly profession: ProfessionId | null;
  public readonly maxWorkers: number;

  public hp: number;
  public readonly maxHp: number;
  public statusNote = '';
  public targetWarriors = 5;

  private progress = 0;
  private completedFired = false;
  private season: Season = 'SPRING';
  private assignedWorkers: Villager[] = [];
  private childrenInside = new Set<Villager>();
  private captives: TotemCaptive[] = [];
  private ambientTimer = 1400;
  private towerShootTimer = 900;

  private hoverRing: Phaser.GameObjects.Ellipse;
  private sprite: Phaser.GameObjects.Image;
  private workerBadgeBg: Phaser.GameObjects.Graphics;
  private workerBadgeText: Phaser.GameObjects.Text;
  private progressBg: Phaser.GameObjects.Graphics;
  private progressFill: Phaser.GameObjects.Graphics;

  private onCompleted: (b: TribeBuilding) => void;
  private onOpenChronicle?: () => void;
  private onCaptiveConverted?: (captive: TotemCaptive, building: TribeBuilding) => void;
  private findTowerTarget?: (x: number, y: number, range: number) => CombatTarget | null;
  private getWeaponTechTier?: () => number;
  private getWarriorSlots?: () => { used: number; max: number };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    id: string,
    type: Exclude<BuildingType, 'hut' | 'large_hut'>,
    onCompleted: (b: TribeBuilding) => void,
    onOpenChronicle?: () => void,
    options?: {
      onOpenTech?: () => void;
      onCaptiveConverted?: (captive: TotemCaptive, building: TribeBuilding) => void;
      findTowerTarget?: (x: number, y: number, range: number) => CombatTarget | null;
      getWeaponTechTier?: () => number;
      getWarriorSlots?: () => { used: number; max: number };
    }
  ) {
    super(scene, x, y);
    this.buildingId = id;
    this.buildingType = type;
    const def = BUILDING_DEFS[type];
    this.nameUk = def.nameUk;
    this.descUk = def.descUk;
    this.profession = def.profession;
    this.maxWorkers = def.maxWorkers;
    this.maxHp = type === 'palisade' ? 240 : 380;
    this.hp = this.maxHp;
    this.onCompleted = onCompleted;
    this.onOpenChronicle = onOpenChronicle;
    this.onCaptiveConverted = options?.onCaptiveConverted;
    this.findTowerTarget = options?.findTowerTarget;
    this.getWeaponTechTier = options?.getWeaponTechTier;
    this.getWarriorSlots = options?.getWarriorSlots;

    const ringW = type === 'palisade' ? 92 : 132;
    const ringH = type === 'palisade' ? 42 : 58;
    this.hoverRing = scene.add.ellipse(0, 4, ringW, ringH, 0xffe066, 0.16);
    this.hoverRing.setStrokeStyle(2.5, 0xffe066, 0.9);
    this.hoverRing.setVisible(false);

    this.sprite = scene.add.image(0, 0, `building-${type}-0`);
    this.sprite.setOrigin(0.5, 0.825);

    this.workerBadgeBg = scene.add.graphics();
    this.workerBadgeBg.setVisible(false);
    this.workerBadgeText = scene.add
      .text(0, 26, '', {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fde68a',
      })
      .setOrigin(0.5);
    this.workerBadgeText.setVisible(false);

    this.progressBg = scene.add.graphics();
    this.progressFill = scene.add.graphics();

    this.add([
      this.hoverRing,
      this.sprite,
      this.workerBadgeBg,
      this.workerBadgeText,
      this.progressBg,
      this.progressFill,
    ]);
    this.setSize(136, 128);
    this.setDepth(y);

    const hitCircle = new Phaser.Geom.Circle(0, -18, type === 'palisade' ? 42 : 64);
    this.setInteractive(hitCircle, Phaser.Geom.Circle.Contains);
    if (this.input) {
      this.input.cursor = CURSORS.build;
    }

    this.on('pointerover', () => this.hoverRing.setVisible(true));
    this.on('pointerout', () => this.hoverRing.setVisible(false));
    this.on('pointerdown', () => {
      if (this.isComplete() && this.buildingType === 'burial_mound' && this.onOpenChronicle) {
        this.onOpenChronicle();
      }
    });

    this.drawProgressBar();
    scene.add.existing(this);
  }

  public isComplete(): boolean {
    return this.progress >= 100;
  }

  public isAlive(): boolean {
    return Boolean(this.scene) && this.hp > 0;
  }

  public getProgress(): number {
    return this.progress;
  }

  public setTargetWarriors(n: number): void {
    this.targetWarriors = Phaser.Math.Clamp(n, 0, 30);
    this.refreshBadge();
  }

  public setSeason(season: Season): void {
    this.season = season;
    if (this.isComplete()) {
      this.sprite.setTexture(
        season === 'WINTER'
          ? `building-${this.buildingType}-2-winter`
          : `building-${this.buildingType}-2`
      );
    }
  }

  public takeDamage(dmg: number): boolean {
    if (!this.scene || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.sprite.setTint(0xff9999);
    this.scene.time.delayedCall(120, () => {
      if (this.sprite.scene) this.sprite.clearTint();
    });
    this.drawHpBarIfDamaged();

    if (this.hp <= 0) {
      this.releaseAllOccupants();
      this.spawnBuildChips();
      this.destroy();
      return true;
    }
    return false;
  }

  public releaseAllOccupants(): void {
    const workers = [...this.assignedWorkers];
    for (const w of workers) {
      if (w && w.scene) {
        w.unassignFromBuilding();
      }
    }
    this.assignedWorkers = [];

    const kids = [...this.childrenInside];
    for (const k of kids) {
      if (k && k.scene) {
        this.leaveNursery(k);
        k.setVisible(true);
      }
    }
    this.childrenInside.clear();

    for (const c of this.captives) {
      c.badge.destroy();
    }
    this.captives = [];
  }

  public addBuildWork(deltaProgress = 10): boolean {
    if (this.progress >= 100) return true;
    const step = this.buildingType === 'palisade' ? deltaProgress * 2.5 : deltaProgress;
    this.progress = Math.min(100, this.progress + step);
    const stage = this.progress >= 100 ? 2 : this.progress >= 50 ? 1 : 0;
    if (stage === 2 && this.season === 'WINTER') {
      this.sprite.setTexture(`building-${this.buildingType}-2-winter`);
    } else {
      this.sprite.setTexture(`building-${this.buildingType}-${stage}`);
    }

    this.playBounce();
    this.spawnBuildChips();

    if (this.progress >= 100) {
      this.progressBg.clear();
      this.progressFill.clear();
      if (this.input) {
        this.input.cursor =
          this.buildingType === 'burial_mound'
            ? CURSORS.pointer
            : this.profession
            ? CURSORS.work
            : CURSORS.pointer;
      }
      if (!this.completedFired) {
        this.completedFired = true;
        this.onCompleted(this);
      }
      this.refreshBadge();
      return true;
    }

    this.drawProgressBar();
    return false;
  }

  public getBuildSpotFor(vx: number, vy: number): { x: number; y: number } {
    const angle = Phaser.Math.Angle.Between(this.x, this.y, vx, vy);
    const rx = this.buildingType === 'palisade' ? 42 : 62;
    const ry = this.buildingType === 'palisade' ? 36 : 54;
    return {
      x: this.x + Math.cos(angle) * rx,
      y: this.y + Math.sin(angle) * ry,
    };
  }

  public getWorkSpot(): { x: number; y: number } {
    return { x: this.x + 8, y: this.y + 42 };
  }

  public isPointInsideClickArea(wx: number, wy: number): boolean {
    const r = this.buildingType === 'palisade' ? 42 : 66;
    return Phaser.Math.Distance.Between(wx, wy, this.x, this.y - 16) <= r;
  }

  public getAssignedWorkers(): Villager[] {
    this.assignedWorkers = this.assignedWorkers.filter((w) => w && w.scene);
    return this.assignedWorkers;
  }

  public getAssignedWorker(): Villager | null {
    const list = this.getAssignedWorkers();
    return list[0] ?? null;
  }

  public hasWorker(v: Villager): boolean {
    return this.getAssignedWorkers().includes(v);
  }

  public canAcceptMoreWorkers(): boolean {
    return this.getAssignedWorkers().length < this.maxWorkers;
  }

  public assignWorker(v: Villager): Villager | null {
    this.getAssignedWorkers();
    if (this.assignedWorkers.includes(v)) {
      this.refreshBadge();
      return null;
    }
    let displaced: Villager | null = null;
    if (this.assignedWorkers.length >= this.maxWorkers && this.maxWorkers > 0) {
      displaced = this.assignedWorkers.shift() ?? null;
    }
    this.assignedWorkers.push(v);
    this.refreshBadge();
    return displaced;
  }

  public removeWorker(v: Villager): void {
    this.assignedWorkers = this.assignedWorkers.filter((w) => w !== v && w && w.scene);
    this.refreshBadge();
  }

  public setAssignedWorker(v: Villager | null): void {
    if (v === null) {
      this.assignedWorkers = [];
      this.refreshBadge();
    } else {
      this.assignWorker(v);
    }
  }

  // --- Nursery (Ясла) children management ---
  public enterNursery(child: Villager): void {
    this.childrenInside.add(child);
    this.refreshBadge();
  }

  public leaveNursery(child: Villager): void {
    this.childrenInside.delete(child);
    this.refreshBadge();
  }

  public getChildrenNames(): string[] {
    for (const c of [...this.childrenInside]) {
      if (!c.scene || !c.isChild) {
        this.childrenInside.delete(c);
      }
    }
    return [...this.childrenInside].map((c) => `${c.villagerName} (${c.ageYears} р.)`);
  }

  // --- Shaman Totem Captives (Навернені збирачі) ---
  public addCaptive(
    id: string,
    name: string,
    gender: Gender,
    appearance: VillagerAppearanceId
  ): void {
    const idx = this.captives.length;
    const ox = -24 + (idx % 3) * 24;
    const badge = this.scene.add
      .text(ox, 42, `🌀 ${name}`, {
        fontFamily: 'Segoe UI, sans-serif',
        fontSize: '10px',
        fontStyle: 'bold',
        color: '#67e8f9',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5);
    this.add(badge);

    this.captives.push({
      id,
      name,
      gender,
      appearance,
      // 1 full season (or converts on season transition)
      remainingMs: SEASON_DURATION_MS,
      badge,
    });
    this.refreshBadge();
  }

  public onSeasonChanged(): void {
    if (this.captives.length === 0) return;
    const ready = [...this.captives];
    this.captives = [];
    for (const c of ready) {
      c.badge.destroy();
      this.onCaptiveConverted?.(c, this);
    }
    this.refreshBadge();
  }

  private refreshBadge(): void {
    const workers = this.getAssignedWorkers();
    let label = '';

    if (workers.length > 0) {
      const icon =
        this.buildingType === 'watchtower' || this.buildingType === 'barracks'
          ? '⚔️'
          : this.buildingType === 'gatherer_hut'
          ? '🧺'
          : '🛠️';
      if (this.maxWorkers > 1) {
        label = `${icon} ${workers.map((w) => w.villagerName).join(', ')} (${workers.length}/${this.maxWorkers})`;
      } else {
        label = `${icon} ${workers[0].villagerName}`;
      }
    } else if (this.buildingType === 'nursery' && this.childrenInside.size > 0) {
      label = `👶 Дітей: ${this.childrenInside.size}`;
    } else if (this.buildingType === 'totem' && this.captives.length > 0) {
      label = `🌀 Навернення: ${this.captives.length}`;
    } else if (this.buildingType === 'barracks' && this.isComplete()) {
      label = `⚔️ Ліміт: ${this.targetWarriors}`;
    }

    if (label) {
      this.workerBadgeText.setText(label);
      const padW = Math.max(70, this.workerBadgeText.width + 18);
      this.workerBadgeBg.clear();
      this.workerBadgeBg.fillStyle(0x23170e, 0.9);
      this.workerBadgeBg.fillRoundedRect(-padW / 2, 16, padW, 20, 8);
      this.workerBadgeBg.lineStyle(1.4, 0xc98a4b, 0.95);
      this.workerBadgeBg.strokeRoundedRect(-padW / 2, 16, padW, 20, 8);
      this.workerBadgeBg.setVisible(true);
      this.workerBadgeText.setVisible(true);
    } else {
      this.workerBadgeBg.setVisible(false);
      this.workerBadgeText.setVisible(false);
    }
  }

  public getSnapshot(): BuildingSnapshot {
    const workers = this.getAssignedWorkers();
    const first = workers[0] ?? null;
    const prof = this.profession;
    const firstLevel = first && prof ? first.getSkillLevel(prof) : 0;
    const slots = this.getWarriorSlots?.();

    return {
      id: this.buildingId,
      type: this.buildingType,
      nameUk: this.nameUk,
      descUk: this.descUk,
      isComplete: this.isComplete(),
      progress: this.progress,
      profession: prof,
      professionLabel: prof ? PROFESSION_LABELS_UK[prof] : null,
      assignedWorkerId: first ? first.id : null,
      assignedWorkerName: first ? first.villagerName : null,
      assignedWorkerLevel: firstLevel,
      assignedWorkers: workers.map((w) => ({
        id: w.id,
        name: w.villagerName,
        level: prof ? w.getSkillLevel(prof) : 1,
      })),
      maxWorkers: this.maxWorkers,
      statusNote: this.statusNote || undefined,
      warriorSlotsUsed: slots?.used,
      warriorSlotsMax: slots?.max ?? this.targetWarriors,
      targetWarriors: this.buildingType === 'barracks' ? this.targetWarriors : undefined,
      childrenInside: this.buildingType === 'nursery' ? this.getChildrenNames() : undefined,
      captivesCount: this.buildingType === 'totem' ? this.captives.length : undefined,
      hp: this.hp,
      maxHp: this.maxHp,
      canDemolish: true,
    };
  }

  public update(delta: number): void {
    if (!this.isComplete() || !this.scene) return;

    // Captive countdown at Shaman Totem
    if (this.captives.length > 0) {
      const remaining: TotemCaptive[] = [];
      for (const c of this.captives) {
        c.remainingMs -= delta;
        if (c.remainingMs <= 0) {
          c.badge.destroy();
          this.onCaptiveConverted?.(c, this);
        } else {
          remaining.push(c);
        }
      }
      if (remaining.length !== this.captives.length) {
        this.captives = remaining;
        this.refreshBadge();
      }
    }

    if (
      this.buildingType === 'totem' ||
      this.buildingType === 'burial_mound' ||
      this.buildingType === 'smokehouse' ||
      this.buildingType === 'nursery'
    ) {
      this.ambientTimer -= delta;
      if (this.ambientTimer <= 0) {
        this.ambientTimer = Phaser.Math.Between(1200, 2200);
        if (this.buildingType === 'smokehouse') {
          const smoke = this.scene.add.image(this.x - 2, this.y - 60, 'particle-smoke');
          smoke.setScale(0.32).setAlpha(0.55).setDepth(this.y + 30);
          this.scene.tweens.add({
            targets: smoke,
            x: smoke.x + Phaser.Math.Between(8, 18),
            y: smoke.y - 36,
            scale: 0.85,
            alpha: 0,
            duration: 1300,
            onComplete: () => smoke.destroy(),
          });
        } else if (this.buildingType === 'nursery' && this.childrenInside.size > 0) {
          const icon = Math.random() < 0.5 ? '🧸' : '🍼';
          const bubble = this.scene.add
            .text(this.x + Phaser.Math.Between(-16, 16), this.y - 54, icon, {
              fontSize: '14px',
            })
            .setOrigin(0.5)
            .setDepth(this.y + 35);
          this.scene.tweens.add({
            targets: bubble,
            y: bubble.y - 28,
            alpha: 0,
            duration: 1200,
            onComplete: () => bubble.destroy(),
          });
        } else if (this.buildingType !== 'nursery') {
          const col = this.buildingType === 'totem' ? 0x67e8f9 : 0xfbbf24;
          const orb = this.scene.add.circle(
            this.x + Phaser.Math.Between(-16, 16),
            this.y - (this.buildingType === 'totem' ? 68 : 22),
            2.6,
            col,
            0.78
          );
          orb.setDepth(this.y + 30);
          this.scene.tweens.add({
            targets: orb,
            y: orb.y - 34,
            alpha: 0,
            duration: 1400,
            onComplete: () => orb.destroy(),
          });
        }
      }
    }

    if (this.buildingType === 'watchtower' && this.findTowerTarget) {
      this.towerShootTimer -= delta;
      const fireDelay = this.getAssignedWorker() ? 950 : 1550;
      if (this.towerShootTimer <= 0) {
        this.towerShootTimer = fireDelay;
        const target = this.findTowerTarget(this.x, this.y, 325);
        if (target && target.isAlive()) {
          const techTier = this.getWeaponTechTier?.() ?? 0;
          const mult = [1, 1.2, 1.45, 1.75][techTier] ?? 1;
          const dmg = Math.round((this.getAssignedWorker() ? 20 : 14) * mult);
          SoundFX.playBowShot();
          const startY = this.y - 98;
          const arrow = this.scene.add.image(this.x, startY, 'projectile-arrow');
          arrow.setDepth(this.y + 80);
          arrow.setRotation(Phaser.Math.Angle.Between(this.x, startY, target.x, target.y - 16));
          this.scene.tweens.add({
            targets: arrow,
            x: target.x,
            y: target.y - 16,
            duration: 190,
            onComplete: () => arrow.destroy(),
          });
          target.takeDamage(dmg, this.x, this.y);
        }
      }
    }
  }

  private playBounce(): void {
    if (!this.scene) return;
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(1, 1);
    this.scene.tweens.add({
      targets: this.sprite,
      scaleX: 1.05,
      scaleY: 0.95,
      duration: 95,
      yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  private spawnBuildChips(): void {
    if (!this.scene) return;
    for (let i = 0; i < 5; i++) {
      const chip = this.scene.add.image(
        this.x + Phaser.Math.Between(-28, 28),
        this.y - Phaser.Math.Between(12, 42),
        'particle-chip-wood'
      );
      chip.setDepth(this.y + 30);
      this.scene.tweens.add({
        targets: chip,
        x: chip.x + Phaser.Math.Between(-22, 22),
        y: chip.y - Phaser.Math.Between(10, 22),
        alpha: 0,
        duration: 340,
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

  private drawHpBarIfDamaged(): void {
    if (this.hp >= this.maxHp) {
      this.progressBg.clear();
      this.progressFill.clear();
      return;
    }
    const w = 48;
    const h = 5;
    const x = -w / 2;
    const y = -82;
    this.progressBg.clear();
    this.progressFill.clear();
    this.progressBg.fillStyle(0x16100b, 0.85);
    this.progressBg.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 2);
    this.progressFill.fillStyle(0xef4444, 1);
    this.progressFill.fillRoundedRect(x, y, Math.max(2, (w * this.hp) / this.maxHp), h, 2);
  }
}
