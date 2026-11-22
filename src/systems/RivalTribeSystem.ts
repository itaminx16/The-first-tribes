import Phaser from 'phaser';
import {
  ArmorType,
  BuildingType,
  CombatTarget,
  FEMALE_NAMES_UK,
  Gender,
  MALE_NAMES_UK,
  ObstacleCircle,
  RESOURCE_LABELS_UK,
  RIVAL_RAID_THRESHOLDS,
  ResourceInventory,
  ResourceType,
  RivalTribeSnapshot,
  TreatyType,
  VillagerAppearanceId,
  WarriorClass,
} from '../types/game';
import { SoundFX } from '../utils/SoundFX';
import { EnemyUnit, EnemyUnitContext } from '../entities/EnemyUnit';
import { StorageZone } from '../entities/StorageZone';
import type { ResourceNode } from '../entities/ResourceNode';

export interface RivalBuildingVisual {
  type: BuildingType;
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
}

export interface RivalCampState {
  id: string;
  nameUk: string;
  color: number;
  colorHex: string;
  x: number;
  y: number;
  population: number;
  popCap: number;
  resources: ResourceInventory;
  hp: number;
  maxHp: number;
  alive: boolean;
  discovered: boolean;
  treaty: TreatyType;
  treatySeasonsLeft: number;
  relationScore: number;
  interTribeStatusUk: string;
  hasBarracks: boolean;
  breedingTimerMs: number;
  isBreedingNow: boolean;
  buildCheckTimerMs: number;
  raidTimerMs: number;
  banner: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  buildings: RivalBuildingVisual[];
  fireGlow: Phaser.GameObjects.Ellipse;
  storages: Record<ResourceType, StorageZone>;
  storagePathDecals: Phaser.GameObjects.Image[];
  storagesHidden: boolean;
}

export interface RivalSystemContext {
  worldW: number;
  worldH: number;
  rivalCount: number;
  getPlayerCampPos: () => { x: number; y: number };
  getPlayerPop: () => number;
  getPlayerTargets: () => CombatTarget[];
  getResourceNodes: () => ResourceNode[];
  getObstacles: () => ObstacleCircle[];
  findBlockingBarricade: EnemyUnitContext['findBlockingBarricade'];
  onAttackTarget: (attacker: EnemyUnit, target: CombatTarget) => void;
  onEnemyKilled: (unit: EnemyUnit, killer?: CombatTarget) => void;
  onRaidPlayerStarted: (
    tribeNameUk: string,
    squadSize: number,
    originX: number,
    originY: number
  ) => void;
  onRivalDefeated: (tribeNameUk: string, x: number, y: number) => void;
  onTribeDiscovered: (camp: RivalCampState) => void;
  onInterTribeEvent: (messageUk: string) => void;
}

const RIVAL_TEMPLATE_DEFS = [
  {
    id: 'rival-1',
    nameUk: 'Червоне Ікло',
    color: 0xef4444,
    colorHex: '#ef4444',
    fx: 0.17,
    fy: 0.18,
    firstRaidMs: 165_000,
  },
  {
    id: 'rival-2',
    nameUk: 'Попелясті Скелі',
    color: 0xa855f7,
    colorHex: '#a855f7',
    fx: 0.82,
    fy: 0.19,
    firstRaidMs: 195_000,
  },
  {
    id: 'rival-3',
    nameUk: 'Чорний Кіготь',
    color: 0xf97316,
    colorHex: '#f97316',
    fx: 0.81,
    fy: 0.81,
    firstRaidMs: 225_000,
  },
] as const;

const BUILD_SEQUENCE: Array<{
  type: BuildingType;
  wood: number;
  stone: number;
  popBonus: number;
}> = [
  { type: 'hut', wood: 20, stone: 10, popBonus: 4 },
  { type: 'gatherer_hut', wood: 25, stone: 10, popBonus: 0 },
  { type: 'hut', wood: 20, stone: 10, popBonus: 4 },
  { type: 'granary', wood: 35, stone: 20, popBonus: 0 },
  { type: 'barracks', wood: 40, stone: 30, popBonus: 0 },
  { type: 'large_hut', wood: 45, stone: 25, popBonus: 8 },
  { type: 'workshop', wood: 30, stone: 20, popBonus: 0 },
  { type: 'watchtower', wood: 35, stone: 25, popBonus: 0 },
  { type: 'large_hut', wood: 45, stone: 25, popBonus: 8 },
  { type: 'large_hut', wood: 45, stone: 25, popBonus: 8 },
];

export class RivalTribeSystem {
  private scene: Phaser.Scene;
  private ctx: RivalSystemContext;
  public readonly camps: RivalCampState[] = [];
  public units: EnemyUnit[] = [];
  private unitCounter = 0;
  private discoveryCheckTimer = 600;
  private interTribeTimer = 38_000;

  // Matrix of relations between rival tribes: key = "id1:id2" -> 'peace' | 'alliance' | 'war'
  private interTribeRelations = new Map<string, 'peace' | 'alliance' | 'war'>();

  constructor(scene: Phaser.Scene, ctx: RivalSystemContext) {
    this.scene = scene;
    this.ctx = ctx;

    const count = Phaser.Math.Clamp(ctx.rivalCount, 0, 3);
    const activeDefs = RIVAL_TEMPLATE_DEFS.slice(0, count);

    for (const def of activeDefs) {
      const cx = Math.round(ctx.worldW * def.fx);
      const cy = Math.round(ctx.worldH * def.fy);

      const fireGlow = scene.add
        .ellipse(cx, cy + 8, 96, 44, def.color, 0.24)
        .setDepth(cy - 10);
      const fireBase = scene.add
        .image(cx, cy, 'campfire-base')
        .setScale(0.95)
        .setDepth(cy);
      fireBase.setTint(0xffedd5);
      scene.add.image(cx, cy - 24, 'flame-0').setScale(0.86).setDepth(cy + 1);

      const banner = scene.add
        .image(cx - 58, cy - 18, 'rival-banner')
        .setOrigin(0.5, 0.85)
        .setDepth(cy - 18)
        .setTint(def.color);

      const label = scene.add
        .text(cx, cy - 116, '', {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#fef08a',
          backgroundColor: '#23170ecc',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(cy + 140);

      // Create 5 starting resource storage zones around rival campfire (same as player!)
      const spots: Record<ResourceType, { x: number; y: number }> = {
        wood: { x: cx - 134, y: cy - 44 },
        stone: { x: cx + 134, y: cy - 44 },
        food: { x: cx, y: cy + 106 },
        bone: { x: cx - 122, y: cy + 78 },
        hide: { x: cx + 122, y: cy + 78 },
      };
      const storagePathDecals: Phaser.GameObjects.Image[] = [];
      for (const target of Object.values(spots)) {
        for (let step = 1; step <= 3; step++) {
          const t = step / 4;
          const px = Phaser.Math.Linear(cx, target.x, t);
          const py = Phaser.Math.Linear(cy, target.y, t);
          const patch = scene.add.image(px, py + 8, 'decal-dirt-path');
          patch.setDepth(-996).setAlpha(0.72).setScale(0.76);
          storagePathDecals.push(patch);
        }
      }
      const storages: Record<ResourceType, StorageZone> = {
        wood: new StorageZone(scene, spots.wood.x, spots.wood.y, 'wood', RESOURCE_LABELS_UK.wood),
        stone: new StorageZone(scene, spots.stone.x, spots.stone.y, 'stone', RESOURCE_LABELS_UK.stone),
        food: new StorageZone(scene, spots.food.x, spots.food.y, 'food', RESOURCE_LABELS_UK.food),
        bone: new StorageZone(scene, spots.bone.x, spots.bone.y, 'bone', RESOURCE_LABELS_UK.bone),
        hide: new StorageZone(scene, spots.hide.x, spots.hide.y, 'hide', RESOURCE_LABELS_UK.hide),
      };

      // Each rival tribe starts identically to the player: 1 Woman + 2 Men, 1 starting Hut (popCap = 4)
      const camp: RivalCampState = {
        id: def.id,
        nameUk: def.nameUk,
        color: def.color,
        colorHex: def.colorHex,
        x: cx,
        y: cy,
        population: 3,
        popCap: 4,
        resources: {
          wood: 20,
          stone: 15,
          food: 25,
          bone: 0,
          hide: 0,
        },
        hp: 340,
        maxHp: 340,
        alive: true,
        discovered: false,
        treaty: 'none',
        treatySeasonsLeft: 0,
        relationScore: 50,
        interTribeStatusUk: 'Розвиває поселення',
        hasBarracks: false,
        breedingTimerMs: 18_000,
        isBreedingNow: false,
        buildCheckTimerMs: 4500,
        raidTimerMs: def.firstRaidMs,
        banner,
        label,
        buildings: [],
        fireGlow,
        storages,
        storagePathDecals,
        storagesHidden: false,
      };

      this.syncCampStorages(camp);
      // Place initial starting small hut
      this.placeCampBuilding(camp, 'hut', 0);
      this.updateCampLabel(camp);
      this.camps.push(camp);

      // Spawn the initial 1 female + 2 males as real gatherers!
      this.spawnTribeGatherer(camp, 'female');
      this.spawnTribeGatherer(camp, 'male');
      this.spawnTribeGatherer(camp, 'male');
    }
  }

  private placeCampBuilding(
    camp: RivalCampState,
    type: BuildingType,
    popBonus: number
  ): void {
    const offsets = [
      { ox: -230, oy: -68 },
      { ox: 230, oy: -64 },
      { ox: -215, oy: 112 },
      { ox: 215, oy: 112 },
      { ox: 10, oy: -175 },
      { ox: -310, oy: 25 },
      { ox: 310, oy: 25 },
      { ox: 0, oy: 195 },
      { ox: -265, oy: -155 },
      { ox: 265, oy: -155 },
    ];
    const off = offsets[camp.buildings.length % offsets.length];
    const bx = camp.x + off.ox;
    const by = camp.y + off.oy;
    const tex =
      type === 'hut'
        ? 'hut-stage-3'
        : `building-${type}-2`;

    const sprite = this.scene.add
      .image(bx, by, this.scene.textures.exists(tex) ? tex : 'rival-hut')
      .setOrigin(0.5, 0.82)
      .setDepth(by);

    camp.buildings.push({ type, sprite, x: bx, y: by });
    camp.popCap += popBonus;
    if (type === 'barracks') {
      camp.hasBarracks = true;
    }
    if (type === 'granary' && !camp.storagesHidden) {
      camp.storagesHidden = true;
      for (const st of Object.values(camp.storages)) {
        st.setVisible(false);
        st.disableInteractive();
      }
      for (const d of camp.storagePathDecals) {
        d.setVisible(false);
      }
    }
  }

  public syncCampStorages(camp: RivalCampState): void {
    camp.storages.wood.setAmount(camp.resources.wood);
    camp.storages.stone.setAmount(camp.resources.stone);
    camp.storages.food.setAmount(camp.resources.food);
    camp.storages.bone.setAmount(camp.resources.bone);
    camp.storages.hide.setAmount(camp.resources.hide);
  }

  private spawnTribeGatherer(camp: RivalCampState, gender: Gender): EnemyUnit {
    this.unitCounter += 1;
    const namePool = gender === 'female' ? FEMALE_NAMES_UK : MALE_NAMES_UK;
    const unitName = namePool[this.unitCounter % namePool.length];
    const appearance: VillagerAppearanceId =
      gender === 'female'
        ? 'female'
        : this.unitCounter % 2 === 0
        ? 'male-1'
        : 'male-2';

    const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const r = Phaser.Math.Between(55, 115);
    const ux = Phaser.Math.Clamp(camp.x + Math.cos(a) * r, 90, this.ctx.worldW - 90);
    const uy = Phaser.Math.Clamp(camp.y + Math.sin(a) * r, 90, this.ctx.worldH - 90);

    const unit = new EnemyUnit(
      this.scene,
      `enemy-${this.unitCounter}`,
      unitName,
      ux,
      uy,
      camp.id,
      camp.color,
      gender,
      appearance,
      null,
      'none',
      'GATHERER',
      camp.x,
      camp.y,
      null,
      {
        worldW: this.ctx.worldW,
        worldH: this.ctx.worldH,
        getObstacles: () => this.ctx.getObstacles(),
        findHostileTarget: (seeker, maxRange) =>
          this.findHostileForEnemy(seeker, maxRange),
        findBlockingBarricade: this.ctx.findBlockingBarricade,
        findResourceForGatherer: (seeker) =>
          this.findNearestResourceForCamp(camp, seeker),
        onDeliverResource: (_u, rType, amount) => {
          camp.resources[rType] += amount;
          if (rType === 'food' && Math.random() < 0.35) {
            camp.resources.bone += 1;
            camp.resources.hide += 1;
          }
          this.syncCampStorages(camp);
          this.updateCampLabel(camp);
        },
        onAttackTarget: this.ctx.onAttackTarget,
        onKilled: (killed, killer) => {
          camp.population = Math.max(0, camp.population - 1);
          this.updateCampLabel(camp);
          this.ctx.onEnemyKilled(killed, killer);
        },
        onRetreatHome: () => {
          // Remains guard near own camp
        },
      }
    );

    this.units.push(unit);
    return unit;
  }

  private findNearestResourceForCamp(
    camp: RivalCampState,
    seeker: EnemyUnit
  ): ResourceNode | null {
    const nodes = this.ctx.getResourceNodes();
    if (nodes.length === 0) return null;

    // Prioritize whatever resource the camp has least of
    let preferred: ResourceType = 'wood';
    if (
      camp.resources.food <= camp.resources.wood &&
      camp.resources.food <= camp.resources.stone
    ) {
      preferred = 'food';
    } else if (camp.resources.stone < camp.resources.wood * 0.65) {
      preferred = 'stone';
    }

    let best: ResourceNode | null = null;
    let bestScore = Infinity;

    for (const n of nodes) {
      if (n.depleted || !n.active || n.isSapling) continue;
      const d = Phaser.Math.Distance.Between(camp.x, camp.y, n.x, n.y);
      if (d > 1450) continue;
      const typePenalty = n.resourceType === preferred ? 0.65 : 1.15;
      const score = (d + Phaser.Math.Distance.Between(seeker.x, seeker.y, n.x, n.y) * 0.35) * typePenalty;
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }

    return best;
  }

  public removeUnitFromTribe(unit: EnemyUnit): void {
    const camp = this.camps.find((c) => c.id === unit.tribeId);
    if (camp && camp.alive) {
      camp.population = Math.max(0, camp.population - 1);
      this.updateCampLabel(camp);
    }
  }

  public getObstacles(): ObstacleCircle[] {
    const out: ObstacleCircle[] = [];
    for (const c of this.camps) {
      if (!c.alive) continue;
      out.push({ x: c.x, y: c.y, radius: 52, owner: c });
      for (const b of c.buildings) {
        out.push({ x: b.x, y: b.y, radius: 40, owner: b.sprite });
      }
    }
    return out;
  }

  public onSeasonChanged(): void {
    for (const camp of this.camps) {
      if (!camp.alive) continue;
      if (camp.treaty === 'non_aggression') {
        camp.treatySeasonsLeft = Math.max(0, camp.treatySeasonsLeft - 1);
        if (camp.treatySeasonsLeft === 0) {
          camp.treaty = 'none';
        }
      }
      this.updateCampLabel(camp);
    }
  }

  public getSquadSizeForPopulation(pop: number): number {
    for (const tier of RIVAL_RAID_THRESHOLDS) {
      if (pop >= tier.pop) {
        return tier.squad;
      }
    }
    return 0;
  }

  public damageCampNear(x: number, y: number, dmg: number): boolean {
    for (const camp of this.camps) {
      if (!camp.alive) continue;
      if (Phaser.Math.Distance.Between(x, y, camp.x, camp.y) <= 130) {
        camp.hp = Math.max(0, camp.hp - dmg);
        camp.fireGlow.setAlpha(0.45);
        if (camp.treaty !== 'war') {
          camp.treaty = 'war';
          camp.relationScore = Math.max(0, camp.relationScore - 35);
        }
        this.updateCampLabel(camp);
        if (camp.hp <= 0) {
          camp.alive = false;
          camp.label.setText(`🏳️ ${camp.nameUk} розбито`);
          camp.banner.setAlpha(0.35);
          this.ctx.onRivalDefeated(camp.nameUk, camp.x, camp.y);
          return true;
        }
      }
    }
    return false;
  }

  public update(delta: number): void {
    // 1. Check discovery when player units meet rival units or camps
    this.discoveryCheckTimer -= delta;
    if (this.discoveryCheckTimer <= 0) {
      this.discoveryCheckTimer = 650;
      this.checkTribeDiscovery();
    }

    // 2. Inter-tribe diplomacy & skirmishes between AI tribes
    this.interTribeTimer -= delta;
    if (this.interTribeTimer <= 0) {
      this.interTribeTimer = Phaser.Math.Between(36_000, 52_000);
      this.stepInterTribeInteractions();
    }

    // 3. Per-camp real economy, construction, breeding, warrior arming, and raids
    for (const camp of this.camps) {
      if (!camp.alive) continue;

      const campUnits = this.units.filter(
        (u) => u.isAlive() && u.tribeId === camp.id && u.mode !== 'CAPTIVE'
      );
      camp.population = campUnits.length;

      // Rocking animation on first hut while a couple is breeding
      const primaryHut = camp.buildings[0]?.sprite;
      if (camp.isBreedingNow && primaryHut) {
        const t = this.scene.time.now;
        primaryHut.setAngle(Math.sin(t * 0.012) * 5);
      } else if (primaryHut && primaryHut.angle !== 0) {
        primaryHut.setAngle(0);
      }

      // A. Construction AI
      camp.buildCheckTimerMs -= delta;
      if (camp.buildCheckTimerMs <= 0) {
        camp.buildCheckTimerMs = 4500;
        const nextIdx = camp.buildings.length - 1; // index 0 was starting hut
        if (nextIdx >= 0 && nextIdx < BUILD_SEQUENCE.length) {
          const plan = BUILD_SEQUENCE[nextIdx];
          if (
            camp.resources.wood >= plan.wood &&
            camp.resources.stone >= plan.stone
          ) {
            camp.resources.wood -= plan.wood;
            camp.resources.stone -= plan.stone;
            this.syncCampStorages(camp);
            this.placeCampBuilding(camp, plan.type, plan.popBonus);
            camp.interTribeStatusUk = `Збудували: ${plan.type === 'large_hut' ? 'Велику хатину' : plan.type === 'barracks' ? 'Казарму' : 'нову споруду'}`;
          }
        }
        // Also arm gatherers into guards if Barracks is built and resources allow
        this.tryArmWarriors(camp, campUnits);
        this.updateCampLabel(camp);
      }

      // B. Romance & Breeding AI (requires 1 male + 1 female, food >= 14, pop < popCap)
      camp.breedingTimerMs -= delta;
      if (camp.breedingTimerMs <= 0 && !camp.isBreedingNow) {
        camp.breedingTimerMs = 20_000;
        const hasFemale = campUnits.some((u) => u.gender === 'female');
        const hasMale = campUnits.some((u) => u.gender === 'male');
        if (
          hasFemale &&
          hasMale &&
          camp.population < camp.popCap &&
          camp.resources.food >= 12
        ) {
          camp.resources.food -= 10;
          this.syncCampStorages(camp);
          camp.isBreedingNow = true;

          // Spawn heart above rival hut
          if (primaryHut) {
            const heart = this.scene.add
              .text(primaryHut.x, primaryHut.y - 54, '❤️', { fontSize: '16px' })
              .setOrigin(0.5)
              .setDepth(primaryHut.y + 40);
            this.scene.tweens.add({
              targets: heart,
              y: heart.y - 34,
              alpha: 0,
              duration: 1400,
              onComplete: () => heart.destroy(),
            });
          }

          this.scene.time.delayedCall(7500, () => {
            if (!camp.alive) return;
            camp.isBreedingNow = false;
            const newGender: Gender = Math.random() < 0.5 ? 'female' : 'male';
            this.spawnTribeGatherer(camp, newGender);
            camp.population = this.units.filter(
              (u) => u.isAlive() && u.tribeId === camp.id && u.mode !== 'CAPTIVE'
            ).length;
            this.updateCampLabel(camp);
          });
        }
      }

      // C. Raiding AI (only if population >= 25 or warring against another tribe)
      if (camp.hasBarracks && camp.population >= 10) {
        camp.raidTimerMs -= delta;
        if (camp.raidTimerMs <= 0) {
          camp.raidTimerMs = Phaser.Math.Between(120_000, 165_000);
          this.launchRaidFromCamp(camp);
        }
      }
    }

    for (const u of [...this.units]) {
      if (u.isAlive()) {
        u.update(delta);
      }
    }
    this.units = this.units.filter((u) => u.isAlive());
  }

  private tryArmWarriors(camp: RivalCampState, campUnits: EnemyUnit[]): void {
    if (!camp.hasBarracks) return;
    const gatherers = campUnits.filter((u) => u.mode === 'GATHERER');
    const guards = campUnits.filter((u) => u.mode === 'GUARD' || u.mode === 'RAID');
    // Always keep at least 3 gatherers for economy & breeding
    if (gatherers.length <= 3) return;

    const desiredWarriors = Math.max(2, Math.floor((camp.population - 3) * 0.55));
    if (guards.length >= desiredWarriors) return;

    if (camp.resources.wood >= 10 && camp.resources.stone >= 6) {
      camp.resources.wood -= 10;
      camp.resources.stone -= 6;
      const recruit = gatherers[gatherers.length - 1];
      const classes: WarriorClass[] = ['spearman', 'archer', 'clubman'];
      const wClass = classes[guards.length % classes.length];
      let armor: ArmorType = 'none';
      if (camp.resources.bone >= 6 && camp.resources.hide >= 4) {
        camp.resources.bone -= 6;
        camp.resources.hide -= 4;
        armor = 'bone_armor';
      } else if (camp.resources.hide >= 4) {
        camp.resources.hide -= 4;
        armor = 'hide_armor';
      }
      this.syncCampStorages(camp);
      recruit.promoteToWarrior(wClass, armor, 'GUARD', null);
    }
  }

  private checkTribeDiscovery(): void {
    const playerUnits = this.ctx.getPlayerTargets();
    for (const camp of this.camps) {
      if (!camp.alive || camp.discovered) continue;

      for (const pu of playerUnits) {
        if (!pu.isAlive()) continue;
        if (Phaser.Math.Distance.Between(pu.x, pu.y, camp.x, camp.y) <= 420) {
          camp.discovered = true;
          this.ctx.onTribeDiscovered(camp);
          break;
        }
        const metUnit = this.units.some(
          (eu) =>
            eu.isAlive() &&
            eu.tribeId === camp.id &&
            Phaser.Math.Distance.Between(pu.x, pu.y, eu.x, eu.y) <= 310
        );
        if (metUnit) {
          camp.discovered = true;
          this.ctx.onTribeDiscovered(camp);
          break;
        }
      }
    }
  }

  private getPairKey(idA: string, idB: string): string {
    return idA < idB ? `${idA}:${idB}` : `${idB}:${idA}`;
  }

  private stepInterTribeInteractions(): void {
    const aliveCamps = this.camps.filter((c) => c.alive);
    if (aliveCamps.length < 2) return;

    const a = Phaser.Math.RND.pick(aliveCamps);
    const others = aliveCamps.filter((c) => c !== a);
    const b = Phaser.Math.RND.pick(others);
    const key = this.getPairKey(a.id, b.id);

    const roll = Phaser.Math.Between(1, 100);
    if (roll <= 35) {
      this.interTribeRelations.set(key, 'alliance');
      a.interTribeStatusUk = `Союз і торгівля з «${b.nameUk}»`;
      b.interTribeStatusUk = `Союз і торгівля з «${a.nameUk}»`;
      a.resources.wood += 12;
      b.resources.food += 12;
      if (a.discovered || b.discovered) {
        this.ctx.onInterTribeEvent(
          `🤝 Племена «${a.nameUk}» та «${b.nameUk}» уклали торговий союз!`
        );
      }
    } else if (roll <= 70) {
      this.interTribeRelations.set(key, 'peace');
      a.interTribeStatusUk = `Пакт про ненапад із «${b.nameUk}»`;
      b.interTribeStatusUk = `Пакт про ненапад із «${a.nameUk}»`;
    } else {
      this.interTribeRelations.set(key, 'war');
      a.interTribeStatusUk = `Воює проти «${b.nameUk}»`;
      b.interTribeStatusUk = `Воює проти «${a.nameUk}»`;
      if (a.discovered || b.discovered) {
        this.ctx.onInterTribeEvent(
          `⚔️ Між племенами «${a.nameUk}» та «${b.nameUk}» спалахнула сутичка!`
        );
      }
    }
  }

  private launchRaidFromCamp(camp: RivalCampState): void {
    const availableGuards = this.units.filter(
      (u) => u.isAlive() && u.tribeId === camp.id && u.mode === 'GUARD'
    );
    if (availableGuards.length < 2) return;

    const candidates: Array<{ x: number; y: number; tribeId: string }> = [];
    for (const other of this.camps) {
      if (other !== camp && other.alive) {
        const rel = this.interTribeRelations.get(this.getPairKey(camp.id, other.id));
        if (rel !== 'alliance') {
          candidates.push({ x: other.x, y: other.y, tribeId: other.id });
        }
      }
    }

    // Only raid the player if no treaty (non_aggression or alliance) and population threshold met
    const canRaidPlayer =
      camp.treaty !== 'non_aggression' &&
      camp.treaty !== 'alliance' &&
      camp.population >= 25;

    if (canRaidPlayer) {
      const pCamp = this.ctx.getPlayerCampPos();
      candidates.push({ x: pCamp.x, y: pCamp.y, tribeId: 'player' });
    }

    if (candidates.length === 0) return;

    const chosen = Phaser.Math.RND.pick(candidates);
    const desiredSquad =
      chosen.tribeId === 'player'
        ? this.getSquadSizeForPopulation(camp.population)
        : Math.min(availableGuards.length - 1, 4);
    const raiders = availableGuards.slice(0, Math.max(1, desiredSquad));

    for (const r of raiders) {
      r.setRaidOrder({ x: chosen.x, y: chosen.y, tribeId: chosen.tribeId });
    }

    if (chosen.tribeId === 'player' && raiders.length > 0) {
      SoundFX.playAlarmHorn();
      this.ctx.onRaidPlayerStarted(camp.nameUk, raiders.length, camp.x, camp.y);
    }
  }

  private findHostileForEnemy(
    seeker: EnemyUnit,
    maxRange: number
  ): CombatTarget | null {
    const seekerCamp = this.camps.find((c) => c.id === seeker.tribeId);
    let best: CombatTarget | null = null;
    let bestDist = maxRange;

    // Attack player targets only if not bound by non-aggression or alliance
    const peacefulWithPlayer =
      seekerCamp &&
      (seekerCamp.treaty === 'non_aggression' || seekerCamp.treaty === 'alliance');

    if (!peacefulWithPlayer) {
      for (const pt of this.ctx.getPlayerTargets()) {
        if (!pt.isAlive()) continue;
        const d = Phaser.Math.Distance.Between(seeker.x, seeker.y, pt.x, pt.y);
        if (d < bestDist) {
          bestDist = d;
          best = pt;
        }
      }
    }

    for (const other of this.units) {
      if (!other.isAlive() || other.tribeId === seeker.tribeId || other.mode === 'CAPTIVE')
        continue;
      if (seekerCamp) {
        const rel = this.interTribeRelations.get(
          this.getPairKey(seeker.tribeId, other.tribeId)
        );
        if (rel === 'alliance') continue;
      }
      const d = Phaser.Math.Distance.Between(seeker.x, seeker.y, other.x, other.y);
      if (d < bestDist) {
        bestDist = d;
        best = other;
      }
    }

    return best;
  }

  // --- Diplomacy & Trade API for Player ---
  public proposeNonAggression(tribeId: string): { ok: boolean; messageUk: string } {
    const camp = this.camps.find((c) => c.id === tribeId && c.alive);
    if (!camp) return { ok: false, messageUk: 'Плем’я не знайдено.' };
    if (camp.treaty === 'alliance') {
      return { ok: false, messageUk: `Ви вже у союзі з племенем «${camp.nameUk}»!` };
    }
    camp.treaty = 'non_aggression';
    camp.treatySeasonsLeft = 4;
    camp.relationScore = Math.min(100, Math.max(60, camp.relationScore + 20));
    this.updateCampLabel(camp);
    return {
      ok: true,
      messageUk: `🕊️ Укладено Пакт про ненапад на 4 сезони з племенем «${camp.nameUk}»!`,
    };
  }

  public proposeAlliance(tribeId: string): { ok: boolean; messageUk: string } {
    const camp = this.camps.find((c) => c.id === tribeId && c.alive);
    if (!camp) return { ok: false, messageUk: 'Плем’я не знайдено.' };
    camp.treaty = 'alliance';
    camp.treatySeasonsLeft = 99;
    camp.relationScore = 95;
    this.updateCampLabel(camp);
    return {
      ok: true,
      messageUk: `🤝 Укладено Вічний Союз із племенем «${camp.nameUk}»! Торгівля відкрита.`,
    };
  }

  public getSnapshots(): RivalTribeSnapshot[] {
    return this.camps.map((c) => {
      const warriors = this.units.filter(
        (u) =>
          u.isAlive() &&
          u.tribeId === c.id &&
          (u.mode === 'GUARD' || u.mode === 'RAID')
      ).length;
      const attitudeUk =
        c.treaty === 'alliance'
          ? '🤝 Вірні союзники'
          : c.treaty === 'non_aggression'
          ? `🕊️ Ненапад (${c.treatySeasonsLeft} сез.)`
          : c.treaty === 'war'
          ? '⚔️ Вороже'
          : c.relationScore >= 60
          ? '🙂 Прихильне'
          : '😐 Обережне';

      return {
        id: c.id,
        nameUk: c.nameUk,
        color: c.color,
        colorHex: c.colorHex,
        population: c.population,
        popCap: c.popCap,
        warriors,
        warriorsCount: warriors,
        buildingsCount: c.buildings.length,
        discovered: c.discovered,
        alive: c.alive,
        treaty: c.treaty,
        treatySeasonsLeft: c.treatySeasonsLeft,
        attitudeUk,
        relationScore: c.relationScore,
        resources: { ...c.resources },
        interTribeStatusUk: c.interTribeStatusUk,
      };
    });
  }

  private updateCampLabel(camp: RivalCampState): void {
    const treatyIcon =
      camp.treaty === 'alliance'
        ? '🤝 '
        : camp.treaty === 'non_aggression'
        ? '🕊️ '
        : '';
    const warriors = this.units.filter(
      (u) =>
        u.isAlive() &&
        u.tribeId === camp.id &&
        (u.mode === 'GUARD' || u.mode === 'RAID')
    ).length;
    const warInfo = warriors > 0 ? ` • ⚔️${warriors}` : '';
    camp.label.setText(
      `${treatyIcon}🏴 ${camp.nameUk} • 👥 ${camp.population}/${camp.popCap}${warInfo}`
    );
  }
}
