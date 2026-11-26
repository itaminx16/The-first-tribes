import Phaser from 'phaser';
import {
  BUILDING_DEFS,
  BuildingSnapshot,
  BuildingType,
  CombatTarget,
  Gender,
  getBuildingUpgradeCost,
  GRANARY_STORAGE_BONUS,
  MAX_BUILDING_LEVEL,
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

export class TribeBuilding extends Phaser.GameObjects.Container implements CombatTarget {
  public readonly buildingId: string;
  public get id(): string {
    return this.buildingId;
  }
  public readonly faction = 'player' as const;
  public readonly buildingType: Exclude<BuildingType, 'hut' | 'large_hut'>;
  public readonly nameUk: string;
  public readonly descUk: string;
  public readonly profession: ProfessionId | null;
  public readonly maxWorkers: number;

  public hp: number;
  public maxHp: number;
  public level = 1;
  public bridgeAngle = 0;
  public statusNote = '';
  public targetWarriors = 5;

  private progress = 0;
  private completedFired = false;
  private season: Season = 'SPRING';
  private assignedWorkers: Villager[] = [];
  private childrenInside = new Set<Villager>();
  private trainees = new Set<Villager>();
  private readonly maxTrainees = 3;
  private captives: TotemCaptive[] = [];
  private ambientTimer = 1400;
  private towerShootTimer = 900;

  private hoverRing: Phaser.GameObjects.Ellipse;
  private levelTrim: Phaser.GameObjects.Graphics;
  private sprite: Phaser.GameObjects.Image;
  private levelBadge: Phaser.GameObjects.Text;
  private workerBadgeBg: Phaser.GameObjects.Graphics;
  private workerBadgeText: Phaser.GameObjects.Text;
  private progressBg: Phaser.GameObjects.Graphics;
  private progressFill: Phaser.GameObjects.Graphics;

  private onCompleted: (b: TribeBuilding) => void;
  private onDestroyed?: (b: TribeBuilding) => void;
  private onCaptiveConverted?: (captive: TotemCaptive, building: TribeBuilding) => void;
  private findTowerTarget?: (x: number, y: number, range: number) => CombatTarget | null;
  private getWeaponTechTier?: () => number;
  private getWarriorSlots?: () => { used: number; max: number };
  private getToolSummary?: () => { stock: number; equipped: number; target: number };
  private getBridgeBankSpot?: (
    bx: number,
    by: number,
    angle: number,
    fx: number,
    fy: number
  ) => { x: number; y: number };

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    id: string,
    type: Exclude<BuildingType, 'hut' | 'large_hut'>,
    onCompleted: (b: TribeBuilding) => void,
    _onOpenChronicle?: () => void,
    options?: {
      bridgeAngle?: number;
      onOpenTech?: () => void;
      onDestroyed?: (b: TribeBuilding) => void;
      onCaptiveConverted?: (captive: TotemCaptive, building: TribeBuilding) => void;
      findTowerTarget?: (x: number, y: number, range: number) => CombatTarget | null;
      getWeaponTechTier?: () => number;
      getWarriorSlots?: () => { used: number; max: number };
      getToolSummary?: () => { stock: number; equipped: number; target: number };
      getBridgeBankSpot?: (
        bx: number,
        by: number,
        angle: number,
        fx: number,
        fy: number
      ) => { x: number; y: number };
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
    this.maxHp = type === 'palisade' ? 240 : type === 'watchtower' ? 480 : 380;
    this.hp = this.maxHp;
    this.bridgeAngle = options?.bridgeAngle ?? 0;
    this.onCompleted = onCompleted;
    this.onDestroyed = options?.onDestroyed;
    this.onCaptiveConverted = options?.onCaptiveConverted;
    this.findTowerTarget = options?.findTowerTarget;
    this.getWeaponTechTier = options?.getWeaponTechTier;
    this.getWarriorSlots = options?.getWarriorSlots;
    this.getToolSummary = options?.getToolSummary;
    this.getBridgeBankSpot = options?.getBridgeBankSpot;

    const ringW =
      type === 'palisade'
        ? 92
        : type === 'bridge'
          ? 148
          : type === 'training_ground'
            ? 172
            : 132;
    const ringH =
      type === 'palisade'
        ? 42
        : type === 'bridge'
          ? 74
          : type === 'training_ground'
            ? 70
            : 58;
    this.hoverRing = scene.add.ellipse(0, type === 'bridge' ? 0 : 4, ringW, ringH, 0xffe066, 0.16);
    this.hoverRing.setStrokeStyle(2.5, 0xffe066, 0.9);
    this.hoverRing.setVisible(false);
    if (type === 'bridge') {
      this.hoverRing.setRotation(this.bridgeAngle);
    }

    this.levelTrim = scene.add.graphics();
    this.sprite = scene.add.image(0, 0, `building-${type}-0`);
    this.sprite.setOrigin(0.5, type === 'bridge' ? 0.52 : 0.825);
    if (type === 'bridge') {
      this.sprite.setRotation(this.bridgeAngle);
    }
    this.levelBadge = scene.add
      .text(0, type === 'watchtower' ? -112 : -88, '', {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#facc15',
        backgroundColor: '#261a11cc',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5)
      .setVisible(false);

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
      this.levelTrim,
      this.sprite,
      this.levelBadge,
      this.workerBadgeBg,
      this.workerBadgeText,
      this.progressBg,
      this.progressFill,
    ]);
    this.setSize(type === 'bridge' ? 160 : 136, type === 'bridge' ? 110 : 128);
    this.setDepth(type === 'bridge' ? 22 : y);

    const hitCircle = new Phaser.Geom.Circle(
      0,
      type === 'bridge' ? 0 : -18,
      type === 'palisade' ? 42 : 66
    );
    this.setInteractive(hitCircle, Phaser.Geom.Circle.Contains);
    if (this.input) {
      this.input.cursor = CURSORS.build;
    }

    this.on('pointerover', () => this.hoverRing.setVisible(true));
    this.on('pointerout', () => this.hoverRing.setVisible(false));

    this.drawProgressBar();
    scene.add.existing(this);
  }

  public isComplete(): boolean {
    return this.progress >= 100;
  }

  public isAlive(): boolean {
    return Boolean(this.scene) && this.hp > 0;
  }

  public getLevel(): number {
    return this.level;
  }

  public getGranaryBonus(): number {
    return this.buildingType === 'granary' ? this.level * GRANARY_STORAGE_BONUS : 0;
  }

  public setLevel(lvl: number): void {
    const next = Phaser.Math.Clamp(lvl, 1, MAX_BUILDING_LEVEL);
    const delta = next - this.level;
    this.level = next;
    if (delta > 0) {
      const hpStep = this.buildingType === 'watchtower' ? 170 : 120;
      this.maxHp += delta * hpStep;
      this.hp = Math.min(this.maxHp, this.hp + delta * hpStep);
    }
    this.applyLevelVisuals();
  }

  public upgrade(): boolean {
    if (!this.isComplete() || this.level >= MAX_BUILDING_LEVEL) return false;
    this.setLevel(this.level + 1);
    this.playBounce();
    this.spawnBuildChips();
    return true;
  }

  private applyLevelVisuals(): void {
    const scale = 1 + (this.level - 1) * 0.07;
    this.sprite.setScale(scale);
    this.levelTrim.clear();
    if (this.level >= 2) {
      const col = this.level >= 3 ? 0xfacc15 : 0x94a3b8;
      this.levelTrim.lineStyle(3, col, 0.92);
      this.levelTrim.strokeEllipse(0, 2, 108, 38);
      if (this.buildingType === 'watchtower') {
        // Fire brazier ring atop upgraded Watchtower
        this.levelTrim.fillStyle(0xf97316, 0.9);
        this.levelTrim.fillCircle(0, -102, this.level >= 3 ? 8 : 6);
        this.levelTrim.fillStyle(0xfef08a, 0.95);
        this.levelTrim.fillCircle(0, -103, this.level >= 3 ? 4.5 : 3);
      }
      this.levelBadge.setText('★'.repeat(this.level)).setVisible(true);
    } else {
      this.levelBadge.setVisible(false);
    }
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

  public takeDamage(
    dmg: number,
    _attackerX?: number,
    _attackerY?: number,
    _attacker?: CombatTarget
  ): boolean {
    if (!this.scene || this.hp <= 0) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.sprite.setTint(0xff9999);
    this.scene.time.delayedCall(120, () => {
      if (this.sprite.scene) this.sprite.clearTint();
    });
    this.drawHpBarIfDamaged();

    if (this.hp <= 0) {
      this.releaseAllOccupants();
      this.onDestroyed?.(this);
      this.spawnBuildChips();
      this.destroy();
      return true;
    }
    return false;
  }

  public releaseAllOccupants(): void {
    const spot = this.getWorkSpot();
    const workers = [...this.assignedWorkers];
    for (const w of workers) {
      if (w && w.scene) {
        if (this.buildingType === 'watchtower') {
          w.exitWatchtowerGarrison(spot.x, spot.y);
        } else {
          w.unassignFromBuilding();
        }
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
    if (this.buildingType === 'bridge') {
      if (this.getBridgeBankSpot) {
        return this.getBridgeBankSpot(this.x, this.y, this.bridgeAngle, vx, vy);
      }
      const dx = Math.cos(this.bridgeAngle) * 96;
      const dy = Math.sin(this.bridgeAngle) * 96;
      const p1 = { x: this.x + dx, y: this.y + dy };
      const p2 = { x: this.x - dx, y: this.y - dy };
      const d1 = Phaser.Math.Distance.Between(vx, vy, p1.x, p1.y);
      const d2 = Phaser.Math.Distance.Between(vx, vy, p2.x, p2.y);
      return d1 <= d2 ? p1 : p2;
    }
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
    const r = this.buildingType === 'palisade' ? 42 : 68;
    const cy = this.buildingType === 'bridge' ? this.y : this.y - 16;
    return Phaser.Math.Distance.Between(wx, wy, this.x, cy) <= r;
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

  public getTrainees(): Villager[] {
    for (const t of [...this.trainees]) {
      if (!t.scene || t.isDying) {
        this.trainees.delete(t);
      }
    }
    return [...this.trainees];
  }

  public canAcceptTrainee(): boolean {
    return (
      this.buildingType === 'training_ground' &&
      this.isComplete() &&
      this.getTrainees().length < this.maxTrainees
    );
  }

  public enterTraining(v: Villager): boolean {
    if (this.trainees.has(v)) return true;
    if (!this.canAcceptTrainee()) return false;
    this.trainees.add(v);
    this.refreshBadge();
    return true;
  }

  public leaveTraining(v: Villager): void {
    if (this.trainees.delete(v)) {
      this.refreshBadge();
    }
  }

  public getTrainSpotFor(v: Villager): { x: number; y: number } {
    const list = this.getTrainees();
    const idx = Math.max(0, list.indexOf(v));
    const offsets = [
      { dx: -44, dy: 34 },
      { dx: 0, dy: 44 },
      { dx: 44, dy: 34 },
    ];
    const off = offsets[idx % offsets.length];
    return { x: this.x + off.dx, y: this.y + off.dy };
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
          : this.buildingType === 'training_ground'
            ? '🏋️'
            : this.buildingType === 'animal_pen'
              ? '🐗'
              : '🛠️';
      if (this.maxWorkers > 1) {
        label = `${icon} ${workers.map((w) => w.villagerName).join(', ')} (${workers.length}/${this.maxWorkers})`;
      } else {
        label = `${icon} ${workers[0].villagerName}`;
      }
    } else if (this.buildingType === 'training_ground' && this.isComplete()) {
      const tCount = this.getTrainees().length;
      if (tCount > 0) {
        label = `🏋️ Тренуються: ${tCount}/3`;
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
    const tools = this.buildingType === 'workshop' ? this.getToolSummary?.() : undefined;

    const upgradeCost = this.isComplete()
      ? getBuildingUpgradeCost(this.buildingType, this.level)
      : null;
    const upgradeDescUk =
      upgradeCost === null
        ? undefined
        : this.buildingType === 'watchtower'
          ? `Рів.${this.level + 1}: вогняні стріли (+${this.level * 8} урону, +45 дальності й огляду)`
          : this.buildingType === 'granary'
            ? `Рів.${this.level + 1}: +${GRANARY_STORAGE_BONUS} місткості складу й +120 HP`
            : `Рів.${this.level + 1}: зміцнення споруди (+120 HP та посилений ефект)`;

    let computedStatus = this.statusNote || undefined;
    if (!computedStatus && this.isComplete()) {
      if (this.buildingType === 'chief_hut') {
        const pct = 15 + this.level * 5;
        computedStatus = `👑 Аура Вождя Рів.${this.level}: +${pct}% швидкості й сили поруч`;
      } else if (this.buildingType === 'animal_pen' && first) {
        computedStatus = `🐗 Приручені звірі (+4 🍖, +2 🧥 за цикл)`;
      } else if (this.buildingType === 'training_ground') {
        const trainees = this.getTrainees();
        computedStatus =
          trainees.length > 0
            ? `🏋️ Зараз тренуються (${trainees.length}/3): ${trainees.map((t) => t.villagerName).join(', ')}`
            : `🏋️ Вільні жителі самі приходять у вільний час (до 3 осіб, 1 раз/сезон)`;
      }
    }

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
      statusNote: computedStatus,
      warriorSlotsUsed: slots?.used,
      warriorSlotsMax: slots?.max ?? this.targetWarriors,
      targetWarriors: this.buildingType === 'barracks' ? this.targetWarriors : undefined,
      childrenInside: this.buildingType === 'nursery' ? this.getChildrenNames() : undefined,
      captivesCount: this.buildingType === 'totem' ? this.captives.length : undefined,
      hp: this.hp,
      maxHp: this.maxHp,
      canDemolish: true,
      toolsInStock: tools?.stock,
      toolsEquipped: tools?.equipped,
      toolsTarget: tools?.target,
      garrisonedWarriorName:
        this.buildingType === 'watchtower' ? (first?.villagerName ?? null) : undefined,
      requiresWarrior: this.buildingType === 'watchtower',
      level: this.level,
      maxLevel: MAX_BUILDING_LEVEL,
      upgradeCost,
      upgradeDescUk,
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
      const guard = this.getAssignedWorker();
      if (
        guard &&
        guard.isAlive() &&
        guard.warriorClass !== null &&
        guard.state === 'WORKING_STATION'
      ) {
        this.towerShootTimer -= delta;
        const wLvl = guard.getSkillLevel('warrior');
        const fireDelay = Math.max(560, 920 - (wLvl - 1) * 65);
        if (this.towerShootTimer <= 0) {
          this.towerShootTimer = fireDelay;
          const towerRange = 365 + (this.level - 1) * 45;
          const target = this.findTowerTarget(this.x, this.y, towerRange);
          if (target && target.isAlive()) {
            guard.faceWorldPoint(target.x, target.y);
            const techTier = this.getWeaponTechTier?.() ?? 0;
            const mult = [1, 1.2, 1.45, 1.75][techTier] ?? 1;
            const fireBonus = (this.level - 1) * 8;
            const dmg = Math.round((20 + (wLvl - 1) * 3 + fireBonus) * mult);
            SoundFX.playBowShot();
            const startY = this.y - 98;
            const arrow = this.scene.add.image(this.x, startY, 'projectile-arrow');
            if (this.level >= 2) {
              arrow.setTint(0xff7b00);
              arrow.setScale(1.15);
            }
            arrow.setDepth(Math.max(this.y, target.y) + 80);
            arrow.setRotation(
              Phaser.Math.Angle.Between(this.x, startY, target.x, target.y - 16)
            );
            this.scene.tweens.add({
              targets: arrow,
              x: target.x,
              y: target.y - 16,
              duration: 190,
              onComplete: () => arrow.destroy(),
            });
            // Pass the Watchtower itself as attacker so enemies hit the tower before the garrisoned warrior
            const killed = target.takeDamage(dmg, this.x, this.y, this);
            guard.gainProfessionXp('warrior', 3);
            if (killed) {
              guard.deeds.enemiesSlain += 1;
              guard.gainProfessionXp('warrior', 10);
            }
          }
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
    const y = this.buildingType === 'bridge' ? -46 : -94;
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
    const y = this.buildingType === 'bridge' ? -42 : -82;
    this.progressBg.clear();
    this.progressFill.clear();
    this.progressBg.fillStyle(0x16100b, 0.85);
    this.progressBg.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 2);
    this.progressFill.fillStyle(0xef4444, 1);
    this.progressFill.fillRoundedRect(x, y, Math.max(2, (w * this.hp) / this.maxHp), h, 2);
  }
}
