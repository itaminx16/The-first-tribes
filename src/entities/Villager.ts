import Phaser from 'phaser';
import {
  ADULT_AGE,
  AncestorRecord,
  ARMOR_DEFS,
  ArmorType,
  CarryVisualType,
  CombatTarget,
  ELDER_AGE,
  FacingView,
  FREE_TIME_DURATION_MS,
  Gender,
  LifeStage,
  MAX_BIRTHS_PER_WOMAN_PER_SEASON,
  MAX_NATURAL_DEATH_AGE,
  MIN_NATURAL_DEATH_AGE,
  ObstacleCircle,
  PROFESSION_LABELS_UK,
  ProfessionId,
  ResourceType,
  SEASON_DURATION_MS,
  Season,
  SHAMAN_CONVERT_DURATION_MS,
  SKILL_LEVEL_TITLES_UK,
  SKILL_XP_THRESHOLDS,
  STATE_LABELS_UK,
  TechState,
  VillagerAppearanceId,
  VillagerDeeds,
  VillagerRosterItem,
  VillagerSnapshot,
  VillagerState,
  VillagerStats,
  WARRIOR_CLASS_LABELS_UK,
  WarriorClass,
  WEAPON_DEFS,
  WeaponType
} from '../types/game';
import { SoundFX } from '../utils/SoundFX';
import {
  createNavAgentState,
  NavigationAgentState,
  resetNavAgentState,
  stepSmartMove,
} from '../systems/NavigationHelper';
import type { Animal } from './Animal';
import type { AnimalCarcass } from './AnimalCarcass';
import { Campfire } from './Campfire';
import type { EnemyUnit } from './EnemyUnit';
import { Hut } from './Hut';
import { Lake } from './Lake';
import { ResourceNode } from './ResourceNode';
import type { River } from './River';
import type { TribeBuilding } from './TribeBuilding';

export interface FamilySeedInfo {
  familyId: string;
  familyName: string;
  spouseId?: string | null;
  spouseName?: string | null;
  parentNames?: string[];
  childrenNames?: string[];
}

export interface VillagerCallbacks {
  getWorldBounds: () => { width: number; height: number };
  getTechLevels: () => TechState;
  getArmoryOrStoragePoint: () => { x: number; y: number };
  getNearestCarcass: (x: number, y: number, maxRadius: number) => AnimalCarcass | null;
  canStationCraftNext: (building: TribeBuilding) => { canWork: boolean; statusText: string };
  isDefenseAlarmActive: () => boolean;
  triggerTribeAlarm: (threat: CombatTarget, caller: Villager) => void;
  findNearestHostile: (x: number, y: number, maxRange: number) => CombatTarget | null;
  tryBorrowDefenseGear: (v: Villager) => boolean;
  returnBorrowedDefenseGear: (v: Villager) => void;
  findNearestBerryBush: (x: number, y: number) => ResourceNode | null;
  findNearestResourceOfType: (
    type: ResourceType,
    x: number,
    y: number,
    maxRadius: number
  ) => ResourceNode | null;
  findNearbyIdleVillager: (requester: Villager, maxRadius: number) => Villager | null;
  findAvailableSleepHut: (x: number, y: number) => Hut | null;
  findCompletedNursery: (x: number, y: number) => TribeBuilding | null;
  findGathererTask: (
    hut: TribeBuilding,
    v: Villager
  ) => { clearNode?: ResourceNode; gatherNode?: ResourceNode; carcass?: AnimalCarcass } | null;
  onEnemyConvertedToCaptive: (enemy: EnemyUnit, shaman: Villager) => void;
  findUnfinishedBuilding: (x: number, y: number) => Hut | TribeBuilding | null;
  getObstacles: () => ObstacleCircle[];
  getRiver: () => River | null;
  getStoragePoint: (type: ResourceType) => { x: number; y: number };
  isStorageFull: (type: ResourceType) => boolean;
  hasFoodInStorage: () => boolean;
  consumeStorageFood: () => boolean;
  getLake: () => Lake | null;
  getSeason: () => Season;
  getYear: () => number;
  getVillagers: () => Villager[];
  hasChief: () => boolean;
  hasTotem: () => boolean;
  onDepositResource: (type: ResourceType, amount: number, x: number, y: number) => void;
  onStationCycleComplete: (villager: Villager, building: TribeBuilding) => void;
  onGrewUp: (villager: Villager) => void;
  onVillagerStartedDying: (villager: Villager) => void;
  onVillagerDied: (villager: Villager, record: AncestorRecord) => void;
  onVillagerKilledInCombat: (villager: Villager, record: AncestorRecord, causeUk: string) => void;
}

const CHAT_EMOJIS = ['💬', '😊', '☀️', '🍖', '🔥'];
const PLAY_EMOJIS = ['✨', '😊', '🦋', '🌸'];
const MOURN_EMOJIS = ['💬', '❤️', '😢', '🕯️'];

export class Villager extends Phaser.GameObjects.Container implements CombatTarget {
  public readonly id: string;
  public readonly faction = 'player' as const;
  public readonly villagerName: string;
  public readonly gender: Gender;
  public readonly appearance: VillagerAppearanceId;
  public state: VillagerState = 'IDLE_WANDER';
  public stats: VillagerStats = {
    health: 120,
    satiety: 90,
    energy: 100
  };
  public maxHealth = 120;
  public isChild: boolean;
  public age: number;
  public get ageYears(): number {
    return this.age;
  }
  public lifeStage: LifeStage;
  public isChief = false;
  public breedCooldown = 0;
  public birthsThisSeason = 0;
  public isFreeTime = false;
  public freeTimeStartMs = Phaser.Math.Between(
    35_000,
    SEASON_DURATION_MS - FREE_TIME_DURATION_MS - 15_000
  );

  public warriorClass: WarriorClass | null = null;
  public equippedWeapon: WeaponType | null = null;
  public equippedArmor: ArmorType = 'none';
  public isMilitiaArmed = false;

  public familyId: string;
  public familyName: string;
  public spouseId: string | null = null;
  public spouseName: string | null = null;
  public parentNames: string[] = [];
  public childrenNames: string[] = [];
  public readonly bornYear: number;
  public readonly naturalDeathAge: number;
  public hasCraftedTools = false;
  public isDying = false;

  public assignedBuilding: TribeBuilding | null = null;
  public assignedProfession: ProfessionId | null = null;
  public activeProfession: ProfessionId | null = null;
  public skills: Record<ProfessionId, { level: number; xp: number }> = {
    lumberjack: { level: 1, xp: 0 },
    miner: { level: 1, xp: 0 },
    fisher: { level: 1, xp: 0 },
    hunter: { level: 1, xp: 0 },
    gatherer: { level: 1, xp: 0 },
    builder: { level: 1, xp: 0 },
    crafter: { level: 1, xp: 0 },
    armorer: { level: 1, xp: 0 },
    keeper: { level: 1, xp: 0 },
    shaman: { level: 1, xp: 0 },
    smoker: { level: 1, xp: 0 },
    warrior: { level: 1, xp: 0 }
  };
  public deeds: VillagerDeeds = {
    woodGathered: 0,
    stoneGathered: 0,
    foodGathered: 0,
    boneGathered: 0,
    hideGathered: 0,
    fishCaught: 0,
    animalsHunted: 0,
    enemiesSlain: 0,
    buildingsBuilt: 0,
    toolsCrafted: 0,
    knowledgeGenerated: 0
  };

  private selectionRing: Phaser.GameObjects.Image;
  private chiefAura: Phaser.GameObjects.Ellipse;
  private wadeRipple: Phaser.GameObjects.Image;
  private shadowOuter: Phaser.GameObjects.Ellipse;
  private shadowCore: Phaser.GameObjects.Ellipse;
  private rig: Phaser.GameObjects.Container;
  private backArm: Phaser.GameObjects.Image;
  private leftLeg: Phaser.GameObjects.Image;
  private rightLeg: Phaser.GameObjects.Image;
  private torso: Phaser.GameObjects.Image;
  private armorOverlay: Phaser.GameObjects.Image;
  private head: Phaser.GameObjects.Image;
  private crownSprite: Phaser.GameObjects.Image;
  private frontArmGroup: Phaser.GameObjects.Container;
  private frontArm: Phaser.GameObjects.Image;
  private toolSprite: Phaser.GameObjects.Image;
  private carrySprite: Phaser.GameObjects.Image;

  private progressBg: Phaser.GameObjects.Graphics;
  private progressFill: Phaser.GameObjects.Graphics;
  private hasProgressBar = false;
  private taskBadgeContainer: Phaser.GameObjects.Container;
  private taskBadgeBg: Phaser.GameObjects.Graphics;
  private taskBadgeText: Phaser.GameObjects.Text;
  private lastTaskBadgeKey = '';
  private bubbleContainer: Phaser.GameObjects.Container;
  private bubbleText: Phaser.GameObjects.Text;
  private navState: NavigationAgentState;

  private campfire: Campfire;
  private callbacks: VillagerCallbacks;

  private moveTarget: Phaser.Math.Vector2 | null = null;
  private targetNode: ResourceNode | null = null;
  private targetLake: Lake | null = null;
  private lakeWadeSpot: Phaser.Math.Vector2 | null = null;
  private targetAnimal: Animal | null = null;
  private targetCarcass: AnimalCarcass | null = null;
  private targetBuild: Hut | TribeBuilding | null = null;
  private buildSpot: Phaser.Math.Vector2 | null = null;
  private workBuilding: TribeBuilding | null = null;
  private nurseryBuilding: TribeBuilding | null = null;
  private convertTarget: EnemyUnit | null = null;
  private convertChantTimer = 0;
  private sleepHut: Hut | null = null;
  private breedHut: Hut | null = null;
  private breedPartner: Villager | null = null;

  private lastResourceType: ResourceType | null = null;
  private savedWorkNode: ResourceNode | null = null;
  private savedWorkLake: Lake | null = null;
  private savedWorkAnimal: Animal | null = null;
  private savedWorkCarcass: AnimalCarcass | null = null;
  private savedWorkBuild: Hut | TribeBuilding | null = null;
  private savedWorkBuilding: TribeBuilding | null = null;
  private savedWorkType: ResourceType | null = null;
  private isAutonomousEat = false;
  private isWading = false;

  private combatTarget: CombatTarget | null = null;
  private patrolAnchor: Phaser.Math.Vector2 | null = null;
  private attackCooldownTimer = 0;
  private combatScanTimer = 250;
  private freeTimeWaitTimer = 0;
  private rallyWaitTimer = 0;

  private chatPartner: Villager | null = null;
  private chatStandTarget: Phaser.Math.Vector2 | null = null;
  private chatTimer = 0;
  private chatBubbleTimer = 0;
  private warmTimer = 0;
  private scratchTimer = 0;
  private temporaryBubbleTimer = 0;
  private playWaitTimer = 1400;

  private dyingTimer = 0;
  private dyingBubbleTimer = 2000;
  private mournTarget: Villager | null = null;
  private mournSpot: Phaser.Math.Vector2 | null = null;
  private mournBubbleTimer = 1200;

  private carrying: ResourceType | null = null;
  private carryVisual: CarryVisualType | null = null;
  private carryAmount = 0;
  private carryCapacity = 5;

  private readonly speed = 104;
  private readonly strikeIntervalMs = 900;
  private readonly fishIntervalMs = 1900;
  private readonly huntIntervalMs = 580;
  private readonly workCycleMs = 4200;
  private readonly eatDurationMs = 2000;
  private actionTimer = 0;
  private idleWaitTimer = 5000;
  private walkPhase = 0;
  private blinkTimer = Phaser.Math.Between(2400, 4600);
  private isBlinking = false;

  private currentView: FacingView = 'front';
  private facingDir = 1;
  private headingLockTimer = 0;
  private forwardLean = 0;
  private isMovingFrame = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    id: string,
    name: string,
    gender: Gender,
    appearance: VillagerAppearanceId,
    campfire: Campfire,
    callbacks: VillagerCallbacks,
    initialAge = 22,
    familySeed?: FamilySeedInfo,
    bornYear?: number
  ) {
    super(scene, x, y);
    this.id = id;
    this.villagerName = name;
    this.gender = gender;
    this.appearance = appearance;
    this.campfire = campfire;
    this.callbacks = callbacks;
    this.age = initialAge;
    this.lifeStage = this.computeLifeStage(initialAge);
    this.isChild = this.lifeStage === 'CHILD';

    const curYear = bornYear ?? callbacks.getYear();
    this.bornYear = curYear - initialAge;
    this.naturalDeathAge = Phaser.Math.Between(MIN_NATURAL_DEATH_AGE, MAX_NATURAL_DEATH_AGE);
    this.familyId = familySeed?.familyId ?? `fam-${id}`;
    this.familyName = familySeed?.familyName ?? `Рід ${name}`;
    this.spouseId = familySeed?.spouseId ?? null;
    this.spouseName = familySeed?.spouseName ?? null;
    this.parentNames = familySeed?.parentNames ? [...familySeed.parentNames] : [];
    this.childrenNames = familySeed?.childrenNames ? [...familySeed.childrenNames] : [];
    this.navState = createNavAgentState(x, y, id.charCodeAt(id.length - 1) || 0);

    this.selectionRing = scene.add.image(0, 6, 'selection-ring');
    this.selectionRing.setVisible(false);

    this.chiefAura = scene.add.ellipse(0, 6, 46, 18, 0xfbbf24, 0.22);
    this.chiefAura.setStrokeStyle(1.8, 0xfef08a, 0.72);
    this.chiefAura.setVisible(false);

    this.wadeRipple = scene.add.image(0, -3, 'wade-water-ring');
    this.wadeRipple.setVisible(false);

    this.shadowOuter = scene.add.ellipse(0, 6, 38, 15, 0x162612, 0.24);
    this.shadowCore = scene.add.ellipse(0, 6, 23, 9.5, 0x101c0d, 0.36);

    // Modular 2x-oversampled 3D rig (0.5 scale) with front/side/back views
    this.rig = scene.add.container(0, 0);

    this.backArm = scene.add.image(-13, -21, `v-${appearance}-arm`);
    this.backArm.setOrigin(0.5, 0.2);
    this.backArm.setScale(0.5);

    this.leftLeg = scene.add.image(-5.5, -8, `v-${appearance}-leg`);
    this.leftLeg.setOrigin(0.5, 0.15);
    this.leftLeg.setScale(0.5);

    this.rightLeg = scene.add.image(5.5, -8, `v-${appearance}-leg`);
    this.rightLeg.setOrigin(0.5, 0.15);
    this.rightLeg.setScale(0.5);

    this.torso = scene.add.image(0, -19, `v-${appearance}-torso-front`);
    this.torso.setOrigin(0.5, 0.5);
    this.torso.setScale(0.5);

    this.armorOverlay = scene.add.image(0, -19, 'armor-hide-overlay');
    this.armorOverlay.setOrigin(0.5, 0.5);
    this.armorOverlay.setScale(0.5);
    this.armorOverlay.setVisible(false);

    this.head = scene.add.image(0, -36, `${this.getHeadTexturePrefix()}-head-front`);
    this.head.setOrigin(0.5, 0.65);
    this.head.setScale(0.5);

    this.crownSprite = scene.add.image(0, -52, 'chief-crown');
    this.crownSprite.setScale(0.52);
    this.crownSprite.setVisible(false);

    this.frontArmGroup = scene.add.container(13, -22);
    this.frontArm = scene.add.image(0, 0, `v-${appearance}-arm`);
    this.frontArm.setOrigin(0.5, 0.2);
    this.frontArm.setScale(0.5);
    this.toolSprite = scene.add.image(2, 11, 'tool-sharp-stone');
    this.toolSprite.setOrigin(0.35, 0.65);
    this.toolSprite.setScale(0.5);
    this.toolSprite.setAngle(22);
    this.frontArmGroup.add([this.frontArm, this.toolSprite]);

    this.carrySprite = scene.add.image(0, -16, 'carry-wood-1');
    this.carrySprite.setScale(0.5);
    this.carrySprite.setVisible(false);

    this.rig.add([
      this.leftLeg,
      this.rightLeg,
      this.backArm,
      this.torso,
      this.armorOverlay,
      this.head,
      this.crownSprite,
      this.frontArmGroup,
      this.carrySprite
    ]);

    // Minimalist overhead progress bar (visible only while working/building/eating)
    this.progressBg = scene.add.graphics();
    this.progressFill = scene.add.graphics();

    // Overhead activity indicator above head showing current task
    this.taskBadgeContainer = scene.add.container(0, -60);
    this.taskBadgeBg = scene.add.graphics();
    this.taskBadgeText = scene.add
      .text(0, 0, '', { fontSize: '11px', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.taskBadgeContainer.add([this.taskBadgeBg, this.taskBadgeText]);

    // Emotion/chat bubble above head
    this.bubbleContainer = scene.add.container(0, -88);
    const bubbleBg = scene.add.image(0, 0, 'bubble-bg');
    this.bubbleText = scene.add
      .text(0, -4, '💬', {
        fontSize: '15px'
      })
      .setOrigin(0.5);
    this.bubbleContainer.add([bubbleBg, this.bubbleText]);
    this.bubbleContainer.setVisible(false);

    this.add([
      this.chiefAura,
      this.selectionRing,
      this.shadowOuter,
      this.shadowCore,
      this.rig,
      this.wadeRipple,
      this.progressBg,
      this.progressFill,
      this.taskBadgeContainer,
      this.bubbleContainer
    ]);
    this.setSize(52, 66);
    this.setDepth(y);

    const hitCircle = new Phaser.Geom.Circle(0, -18, 30);
    this.setInteractive(hitCircle, Phaser.Geom.Circle.Contains);
    if (this.input) {
      this.input.cursor = 'pointer';
    }

    if (this.isChild) {
      this.setScale(0.62);
      this.state = 'CHILD_PLAYING';
      this.toolSprite.setVisible(false);
    } else {
      this.refreshLifeVisuals();
      this.updateHeldTool();
    }

    this.applyView('front');
    scene.add.existing(this);
  }

  public setSelected(selected: boolean): void {
    this.selectionRing.setVisible(selected);
  }

  public isAlive(): boolean {
    return Boolean(this.scene) && !this.isDying && this.stats.health > 0;
  }

  public isInCombat(): boolean {
    return (
      this.state === 'FLEEING_TO_CAMPFIRE' ||
      this.state === 'GRABBING_GEAR' ||
      this.state === 'COMBAT_CHASE' ||
      this.state === 'COMBAT_ATTACK'
    );
  }

  public isIdleFree(): boolean {
    return (
      !this.isChild &&
      !this.isDying &&
      !this.assignedBuilding &&
      this.warriorClass === null &&
      (this.state === 'IDLE_WANDER' ||
        this.state === 'FREE_TIME' ||
        this.state === 'WARMING' ||
        this.state === 'SCRATCHING' ||
        this.state === 'CHATTING')
    );
  }

  public isAvailableForChat(): boolean {
    return (
      !this.isChild &&
      !this.isDying &&
      (this.state === 'IDLE_WANDER' || this.state === 'FREE_TIME') &&
      !this.moveTarget &&
      !this.chatPartner &&
      this.stats.satiety >= 35
    );
  }

  public isAvailableForBuild(): boolean {
    return (
      !this.isChild &&
      !this.isDying &&
      !this.isFreeTime &&
      !this.assignedBuilding &&
      this.warriorClass === null &&
      (this.state === 'IDLE_WANDER' || this.state === 'SCRATCHING' || this.state === 'CHATTING')
    );
  }

  public isAvailableForBreeding(): boolean {
    if (this.lifeStage !== 'ADULT' || this.isDying || this.isInCombat()) {
      return false;
    }
    if (this.gender === 'female' && this.birthsThisSeason >= MAX_BIRTHS_PER_WOMAN_PER_SEASON) {
      return false;
    }
    if (this.assignedBuilding && !this.isFreeTime) {
      return false;
    }
    const validState =
      this.state === 'IDLE_WANDER' ||
      this.state === 'FREE_TIME' ||
      this.state === 'WARMING' ||
      this.state === 'SCRATCHING' ||
      this.state === 'CHATTING';
    return (
      validState &&
      this.breedCooldown <= 0 &&
      this.stats.satiety >= 50 &&
      this.stats.energy >= 40 &&
      this.stats.health >= 55
    );
  }

  public onNewSeason(sharedSpouseStartMs?: number): void {
    this.birthsThisSeason = 0;
    this.freeTimeStartMs =
      sharedSpouseStartMs ??
      Phaser.Math.Between(35_000, SEASON_DURATION_MS - FREE_TIME_DURATION_MS - 15_000);
  }

  public checkPersonalFreeTime(seasonElapsedMs: number): void {
    if (this.isChild || this.isDying || this.isGarrisonedInWatchtower()) return;
    const shouldBeFree =
      seasonElapsedMs >= this.freeTimeStartMs &&
      seasonElapsedMs < this.freeTimeStartMs + FREE_TIME_DURATION_MS;
    if (shouldBeFree && !this.isFreeTime) {
      this.enterFreeTime();
    } else if (!shouldBeFree && this.isFreeTime) {
      this.exitFreeTimeAndResume();
    }
  }

  public isGarrisonedInWatchtower(): boolean {
    return Boolean(
      this.assignedBuilding &&
        this.assignedBuilding.scene &&
        this.assignedBuilding.buildingType === 'watchtower' &&
        this.assignedBuilding.isComplete() &&
        this.warriorClass !== null
    );
  }

  public faceWorldPoint(wx: number, wy: number): void {
    this.setHeading(wx - this.x, wy - this.y);
  }

  public exitWatchtowerGarrison(dropX: number, dropY: number): void {
    this.assignedBuilding = null;
    this.assignedProfession = null;
    this.workBuilding = null;
    this.shadowOuter.setVisible(true);
    this.shadowCore.setVisible(true);
    this.rig.y = 0;
    this.setPosition(dropX, dropY);
    this.clearProgressBar();
    this.resetPose();
    this.state = this.warriorClass ? 'PATROLLING' : 'IDLE_WANDER';
    this.updateHeldTool();
  }

  public isShaman(): boolean {
    return (
      !this.isChild &&
      !this.isDying &&
      (this.assignedProfession === 'shaman' ||
        this.activeProfession === 'shaman' ||
        this.assignedBuilding?.buildingType === 'totem')
    );
  }

  public getRosterItem(): VillagerRosterItem {
    const top = this.getTopProfession();
    return {
      id: this.id,
      name: this.villagerName,
      gender: this.gender,
      appearance: this.appearance,
      age: this.age,
      lifeStage: this.lifeStage,
      isChief: this.isChief,
      stateLabel: this.getActionLabel(),
      assignedBuildingName: this.assignedBuilding ? this.assignedBuilding.nameUk : null,
      warriorClass: this.warriorClass,
      topProfessionLabel: top.label,
      topProfessionLevel: top.level,
      skills: {
        lumberjack: this.getSkillLevel('lumberjack'),
        miner: this.getSkillLevel('miner'),
        fisher: this.getSkillLevel('fisher'),
        hunter: this.getSkillLevel('hunter'),
        gatherer: this.getSkillLevel('gatherer'),
        builder: this.getSkillLevel('builder'),
        crafter: this.getSkillLevel('crafter'),
        armorer: this.getSkillLevel('armorer'),
        keeper: this.getSkillLevel('keeper'),
        shaman: this.getSkillLevel('shaman'),
        smoker: this.getSkillLevel('smoker'),
        warrior: this.getSkillLevel('warrior')
      }
    };
  }

  public enterFreeTime(): void {
    if (
      this.isChild ||
      this.isDying ||
      this.isGarrisonedInWatchtower() ||
      this.isInCombat() ||
      this.state === 'MOVING_TO_BREED' ||
      this.state === 'BREEDING_IN_HUT' ||
      this.state === 'DYING_LYING' ||
      this.state === 'MOVING_TO_MOURN' ||
      this.state === 'MOURNING_SITTING'
    ) {
      this.isFreeTime = !this.isChild && !this.isDying;
      return;
    }
    this.isFreeTime = true;
    this.endChat();
    this.leaveHutIfOccupied();
    this.setWadingVisual(false);
    this.saveCurrentWorkForResume();
    this.targetNode = null;
    this.targetLake = null;
    this.lakeWadeSpot = null;
    this.targetAnimal = null;
    this.targetCarcass = null;
    this.targetBuild = null;
    this.buildSpot = null;
    this.workBuilding = null;
    this.moveTarget = null;
    this.clearProgressBar();
    this.resetPose();
    this.state = 'FREE_TIME';
    this.freeTimeWaitTimer = Phaser.Math.Between(300, 1400);
    this.showTemporaryBubble('☀️', 2000);
    this.updateHeldTool();
  }

  public exitFreeTimeAndResume(): void {
    this.isFreeTime = false;
    if (
      this.isChild ||
      this.isDying ||
      this.isInCombat() ||
      this.state === 'MOVING_TO_BREED' ||
      this.state === 'BREEDING_IN_HUT' ||
      this.state === 'DYING_LYING' ||
      this.state === 'MOVING_TO_MOURN' ||
      this.state === 'MOURNING_SITTING'
    ) {
      return;
    }
    if (
      this.state === 'FREE_TIME' ||
      this.state === 'IDLE_WANDER' ||
      this.state === 'WARMING' ||
      this.state === 'SCRATCHING' ||
      this.state === 'CHATTING'
    ) {
      this.endChat();
      this.hideBubble();
      if (this.assignedBuilding && this.assignedBuilding.scene && this.assignedBuilding.isComplete()) {
        this.workBuilding = this.assignedBuilding;
        this.activeProfession = this.assignedProfession;
        this.state = 'MOVING_TO_WORK';
        this.updateHeldTool();
      } else if (this.warriorClass) {
        this.state = 'PATROLLING';
        this.updateHeldTool();
      } else {
        this.finishEatingAndResume();
      }
    }
  }

  public refreshMaxHealth(): void {
    const tech = this.callbacks.getTechLevels();
    const healBonus = [0, 20, 45, 75][tech.healing] ?? 0;
    const classBonus =
      this.warriorClass === 'clubman'
        ? 35
        : this.warriorClass === 'spearman'
        ? 10
        : 0;
    const armorBonus =
      this.equippedArmor === 'bone_armor'
        ? 45
        : this.equippedArmor === 'hide_armor'
        ? 20
        : 0;
    const prevMax = this.maxHealth;
    this.maxHealth = 120 + healBonus + classBonus + armorBonus;
    if (this.maxHealth > prevMax) {
      this.stats.health = Math.min(this.maxHealth, this.stats.health + (this.maxHealth - prevMax));
    } else {
      this.stats.health = Math.min(this.maxHealth, this.stats.health);
    }
  }

  public setWarriorRole(
    wClass: WarriorClass,
    weapon: WeaponType | null,
    armor: ArmorType,
    barracksBuilding: TribeBuilding | null
  ): void {
    if (this.isChild || this.isDying) return;
    this.unassignFromBuilding();
    this.interruptForPlayerOrder();
    this.warriorClass = wClass;
    this.equippedWeapon = weapon;
    this.equippedArmor = armor;
    this.isMilitiaArmed = false;
    this.activeProfession = 'warrior';
    if (weapon) {
      this.hasCraftedTools = true;
    }
    this.patrolAnchor = barracksBuilding
      ? new Phaser.Math.Vector2(barracksBuilding.x, barracksBuilding.y + 42)
      : new Phaser.Math.Vector2(this.campfire.x, this.campfire.y + 52);
    this.refreshMaxHealth();
    this.updateArmorVisual();
    this.updateHeldTool();
    this.state = 'PATROLLING';
    if (this.scene) {
      this.spawnSparkleBurst(0xef4444);
      this.showTemporaryBubble('⚔️', 2000);
    }
  }

  public equipArmor(armor: ArmorType): void {
    this.equippedArmor = armor;
    this.refreshMaxHealth();
    this.updateArmorVisual();
  }

  public equipWeapon(weapon: WeaponType | null): void {
    this.equippedWeapon = weapon;
    this.updateHeldTool();
  }

  private updateArmorVisual(): void {
    if (!this.armorOverlay) return;
    if (this.equippedArmor === 'none' || this.isChild || this.isDying) {
      this.armorOverlay.setVisible(false);
    } else {
      this.armorOverlay.setTexture(
        this.equippedArmor === 'bone_armor' ? 'armor-bone-overlay' : 'armor-hide-overlay'
      );
      this.armorOverlay.setVisible(true);
    }
  }

  public startChatWith(partner: Villager, standX: number, standY: number): void {
    this.clearProgressBar();
    this.moveTarget = null;
    this.chatPartner = partner;
    this.chatStandTarget = new Phaser.Math.Vector2(standX, standY);
    this.chatTimer = Phaser.Math.Between(3800, 5200);
    this.chatBubbleTimer = 0;
    this.state = 'CHATTING';
    this.resetPose();
  }

  public endChat(): void {
    const partner = this.chatPartner;
    this.chatPartner = null;
    this.chatStandTarget = null;
    this.hideBubble();
    if (this.state === 'CHATTING') {
      this.state = this.isFreeTime ? 'FREE_TIME' : 'IDLE_WANDER';
      this.idleWaitTimer = 5000;
      this.resetPose();
    }
    if (partner && partner.chatPartner === this) {
      partner.endChat();
    }
  }

  public startBreedingAt(hut: Hut, partner: Villager): void {
    this.endChat();
    this.leaveHutIfOccupied();
    this.setWadingVisual(false);
    this.saveCurrentWorkForResume();
    this.targetNode = null;
    this.targetLake = null;
    this.targetAnimal = null;
    this.targetCarcass = null;
    this.targetBuild = null;
    this.workBuilding = null;
    this.moveTarget = null;
    this.breedHut = hut;
    this.breedPartner = partner;
    this.state = 'MOVING_TO_BREED';
    this.actionTimer = 0;
    this.clearProgressBar();
    this.showBubble('❤️');
    this.updateHeldTool();
  }

  public cancelBreedingFromHut(exitSpot: { x: number; y: number }): void {
    if (this.state === 'BREEDING_IN_HUT' || this.state === 'MOVING_TO_BREED') {
      if (!this.visible) {
        this.setPosition(exitSpot.x, exitSpot.y);
        this.setVisible(true);
        this.setInteractive(new Phaser.Geom.Circle(0, -18, 30), Phaser.Geom.Circle.Contains);
      }
      this.breedHut = null;
      this.breedPartner = null;
      this.hideBubble();
      if (this.isFreeTime) {
        this.state = 'FREE_TIME';
      } else {
        this.finishEatingAndResume();
        return;
      }
      this.idleWaitTimer = 3000;
      this.resetPose();
      this.updateHeldTool();
    }
  }

  public finishBreedingExit(exitX: number, exitY: number): void {
    this.setPosition(exitX, exitY);
    this.setVisible(true);
    this.setInteractive(new Phaser.Geom.Circle(0, -18, 30), Phaser.Geom.Circle.Contains);
    if (this.gender === 'female') {
      this.birthsThisSeason += 1;
    }
    this.breedHut = null;
    this.breedPartner = null;
    this.breedCooldown = 28_000;
    this.hideBubble();
    if (this.isFreeTime) {
      this.state = 'FREE_TIME';
      this.freeTimeWaitTimer = 2500;
      this.resetPose();
      this.updateHeldTool();
    } else {
      this.finishEatingAndResume();
    }
  }

  public issueMoveOrder(x: number, y: number): void {
    if (this.isDying) return;
    // Never pull an assigned station specialist or watchtower warrior off work on a ground tap!
    if (this.assignedBuilding && this.assignedBuilding.scene && this.assignedBuilding.isComplete()) {
      return;
    }
    this.interruptForPlayerOrder();
    this.moveTarget = new Phaser.Math.Vector2(x, y);
    if (this.warriorClass) {
      this.patrolAnchor = new Phaser.Math.Vector2(x, y);
      this.activeProfession = 'warrior';
    } else {
      this.activeProfession = null;
    }
    if (!this.isChild) {
      this.state = 'MOVING';
    } else {
      this.state = 'CHILD_PLAYING';
    }
    this.actionTimer = 0;
    this.clearProgressBar();
    this.updateCarryVisual();
    this.updateHeldTool();
  }

  public issueGatherOrder(node: ResourceNode): void {
    if (this.isChild || this.isDying) return;
    this.unassignFromBuilding();
    this.interruptForPlayerOrder();
    this.targetNode = node;
    this.lastResourceType = node.resourceType;
    this.activeProfession =
      node.resourceType === 'wood'
        ? 'lumberjack'
        : node.resourceType === 'stone'
          ? 'miner'
          : null;
    this.state = 'MOVING_TO_RESOURCE';
    this.actionTimer = 0;
    this.clearProgressBar();
    this.updateCarryVisual();
    this.updateHeldTool();
  }

  public issueFishOrder(lake: Lake): void {
    if (this.isChild || this.isDying) return;
    this.unassignFromBuilding();
    this.interruptForPlayerOrder();
    this.targetLake = lake;
    const spot = lake.getWadeSpotFor(this.x, this.y);
    this.lakeWadeSpot = new Phaser.Math.Vector2(spot.x, spot.y);
    this.lastResourceType = 'food';
    this.activeProfession = 'fisher';
    this.state = 'MOVING_TO_LAKE';
    this.actionTimer = 0;
    this.clearProgressBar();
    this.updateCarryVisual();
    this.updateHeldTool();
  }

  public issueHuntOrder(animal: Animal): void {
    if (this.isChild || this.isDying || !animal.isAlive()) return;
    this.unassignFromBuilding();
    this.interruptForPlayerOrder();
    this.targetAnimal = animal;
    this.lastResourceType = 'food';
    this.activeProfession = 'hunter';
    this.state = 'MOVING_TO_HUNT';
    this.actionTimer = 0;
    this.clearProgressBar();
    this.updateCarryVisual();
    this.updateHeldTool();
  }

  public issueCarcassOrder(carcass: AnimalCarcass): void {
    if (this.isChild || this.isDying || carcass.isEmpty()) return;
    this.unassignFromBuilding();
    this.interruptForPlayerOrder();
    this.targetCarcass = carcass;
    this.activeProfession = 'hunter';
    this.state = 'MOVING_TO_CARCASS';
    this.actionTimer = 0;
    this.clearProgressBar();
    this.updateCarryVisual();
    this.updateHeldTool();
  }

  public issueCombatOrder(target: CombatTarget): void {
    if (this.isChild || this.isDying || !target.isAlive() || this.isGarrisonedInWatchtower()) return;
    if (!this.isInCombat()) {
      this.saveCurrentWorkForResume();
    }
    this.endChat();
    this.leaveHutIfOccupied();
    this.setWadingVisual(false);
    this.combatTarget = target;
    this.activeProfession = 'warrior';
    this.state = 'COMBAT_CHASE';
    this.actionTimer = 0;
    this.clearProgressBar();
    this.updateHeldTool();
  }

  public respondToAlarm(threat: CombatTarget | null, isMandatoryAlarm: boolean): void {
    if (this.isChild || this.isDying || this.isGarrisonedInWatchtower()) return;
    if (this.warriorClass) {
      const enemy = threat && threat.isAlive() ? threat : this.callbacks.findNearestHostile(this.x, this.y, 1800);
      if (enemy) {
        this.issueCombatOrder(enemy);
      } else if (isMandatoryAlarm) {
        this.issueCombatOrderFallbackRally();
      }
      return;
    }

    if (this.isInCombat() && this.combatTarget && this.combatTarget.isAlive()) {
      return;
    }

    this.endChat();
    this.leaveHutIfOccupied();
    this.setWadingVisual(false);
    this.saveCurrentWorkForResume();
    this.targetNode = null;
    this.targetLake = null;
    this.targetAnimal = null;
    this.targetCarcass = null;
    this.targetBuild = null;
    this.workBuilding = null;
    this.moveTarget = null;
    this.combatTarget = threat;
    this.rallyWaitTimer = 6000;
    this.state = this.equippedWeapon ? 'COMBAT_CHASE' : 'GRABBING_GEAR';
    this.clearProgressBar();
    this.showTemporaryBubble('🚨', 2200);
    this.updateHeldTool();
  }

  public cancelAlarmDuty(): void {
    if (this.warriorClass) {
      if (!this.combatTarget || !this.combatTarget.isAlive()) {
        this.state = 'PATROLLING';
      }
      return;
    }
    if (this.isMilitiaArmed) {
      this.callbacks.returnBorrowedDefenseGear(this);
    }
    if (this.isInCombat()) {
      this.combatTarget = null;
      this.hideBubble();
      if (this.isFreeTime) {
        this.state = 'FREE_TIME';
        this.resetPose();
        this.updateHeldTool();
      } else {
        this.finishEatingAndResume();
      }
    }
  }

  private issueCombatOrderFallbackRally(): void {
    this.patrolAnchor = new Phaser.Math.Vector2(this.campfire.x, this.campfire.y + 62);
    this.state = 'PATROLLING';
  }

  public takeDamage(
    rawAmount: number,
    attackerX: number,
    attackerY: number,
    attacker?: CombatTarget
  ): boolean {
    if (this.isDying || !this.scene) return false;
    // Garrisoned warrior is protected by the Watchtower: building absorbs all hits until destroyed
    if (
      this.isGarrisonedInWatchtower() &&
      this.state === 'WORKING_STATION' &&
      this.assignedBuilding &&
      this.assignedBuilding.isAlive()
    ) {
      this.assignedBuilding.takeDamage(rawAmount, attackerX, attackerY, attacker);
      return false;
    }
    const tech = this.callbacks.getTechLevels();
    const armorBase = this.equippedArmor === 'none' ? 0 : ARMOR_DEFS[this.equippedArmor].reduction;
    const armorTech = [0, 0.12, 0.25, 0.4][tech.armor] ?? 0;
    const totalRed = Math.min(0.75, armorBase + armorTech);
    const dmg = Math.max(1, Math.round(rawAmount * (1 - totalRed)));

    this.stats.health = Math.max(0, this.stats.health - dmg);
    this.torso.setTint(0xff8888);
    this.head.setTint(0xff8888);
    SoundFX.playCombatHit();
    this.scene.time.delayedCall(110, () => {
      if (this.scene && !this.isDying) {
        this.torso.clearTint();
        this.head.clearTint();
      }
    });

    if (this.stats.health <= 0) {
      this.isDying = true;
      this.endChat();
      this.leaveHutIfOccupied();
      this.setWadingVisual(false);
      this.unassignFromBuilding();
      if (this.isMilitiaArmed) {
        this.callbacks.returnBorrowedDefenseGear(this);
      }
      const causeUk =
        attacker?.faction === 'predator' ? 'загинув у сутичці зі звіром' : 'поліг у бою за племʼя';
      const record: AncestorRecord = {
        id: this.id,
        name: this.villagerName,
        gender: this.gender,
        appearance: this.appearance,
        familyName: this.familyName,
        bornYear: this.bornYear,
        diedYear: this.callbacks.getYear(),
        ageAtDeath: this.age,
        wasChief: this.isChief,
        topProfessionLabel: this.getTopProfession().label,
        topProfessionLevel: this.getTopProfession().level,
        biographyUk: `${this.villagerName} із роду «${this.familyName}» героїчно ${causeUk}. (${this.bornYear}–${this.callbacks.getYear()} рр.)`
      };
      this.callbacks.onVillagerKilledInCombat(this, record, causeUk);
      return true;
    }

    // Defensive response when attacked!
    if (!this.isChild && attacker && attacker.isAlive()) {
      if (this.warriorClass || this.equippedWeapon) {
        if (this.state !== 'COMBAT_CHASE' && this.state !== 'COMBAT_ATTACK') {
          this.issueCombatOrder(attacker);
        }
        this.callbacks.triggerTribeAlarm(attacker, this);
      } else if (this.state !== 'FLEEING_TO_CAMPFIRE' && this.state !== 'GRABBING_GEAR') {
        this.endChat();
        this.leaveHutIfOccupied();
        this.setWadingVisual(false);
        this.saveCurrentWorkForResume();
        this.targetNode = null;
        this.targetLake = null;
        this.targetAnimal = null;
        this.targetCarcass = null;
        this.targetBuild = null;
        this.workBuilding = null;
        this.moveTarget = null;
        this.combatTarget = attacker;
        this.rallyWaitTimer = 5500;
        this.state = 'FLEEING_TO_CAMPFIRE';
        this.clearProgressBar();
        this.showTemporaryBubble('🚨', 2400);
        this.callbacks.triggerTribeAlarm(attacker, this);
      }
    } else if (this.isChild && attacker) {
      // Child runs toward campfire safety
      const angle = Phaser.Math.Angle.Between(attackerX, attackerY, this.campfire.x, this.campfire.y);
      this.moveTarget = new Phaser.Math.Vector2(
        this.campfire.x + Math.cos(angle) * 32,
        this.campfire.y + Math.sin(angle) * 28
      );
      this.showTemporaryBubble('😨', 1800);
    }

    return false;
  }

  public issueBuildOrder(target: Hut | TribeBuilding): void {
    if (this.isChild || this.isDying || target.isComplete()) return;
    this.unassignFromBuilding();
    this.interruptForPlayerOrder();
    this.targetBuild = target;
    const spot = target.getBuildSpotFor(this.x, this.y);
    this.buildSpot = new Phaser.Math.Vector2(spot.x, spot.y);
    this.activeProfession = 'builder';
    this.state = 'MOVING_TO_BUILD';
    this.actionTimer = 0;
    this.clearProgressBar();
    this.updateCarryVisual();
    this.updateHeldTool();
  }

  public issueAssignBuilding(building: TribeBuilding): boolean {
    if (this.isChild || this.isDying || !building.isComplete() || !building.profession) {
      return false;
    }
    if (building.buildingType === 'watchtower' && !this.warriorClass) {
      return false;
    }
    if (this.assignedBuilding && this.assignedBuilding !== building) {
      this.unassignFromBuilding();
    }
    const displaced = building.assignWorker(this);
    if (displaced && displaced !== this) {
      displaced.assignedBuilding = null;
      displaced.assignedProfession = null;
      displaced.workBuilding = null;
      displaced.shadowOuter.setVisible(true);
      displaced.shadowCore.setVisible(true);
      displaced.rig.y = 0;
    }
    this.isFreeTime = false;
    this.interruptForPlayerOrder();
    this.assignedBuilding = building;
    this.assignedProfession = building.profession;
    this.workBuilding = building;
    this.activeProfession = building.profession;
    this.state = 'MOVING_TO_WORK';
    this.actionTimer = 0;
    this.clearProgressBar();
    this.updateCarryVisual();
    this.updateHeldTool();
    return true;
  }

  public issueConvertOrder(target: EnemyUnit): boolean {
    if (!this.isShaman() || !target.canBeConverted()) return false;
    this.endChat();
    this.leaveHutIfOccupied();
    this.setWadingVisual(false);
    this.cancelActiveConversion();
    this.convertTarget = target;
    this.state = 'MOVING_TO_CONVERT';
    this.actionTimer = 0;
    this.convertChantTimer = 0;
    this.clearProgressBar();
    this.showTemporaryBubble('🌀', 2200);
    this.updateHeldTool();
    return true;
  }

  private cancelActiveConversion(): void {
    if (this.convertTarget) {
      this.convertTarget.cancelConversion();
      this.convertTarget = null;
    }
  }

  public unassignFromBuilding(): void {
    const prev = this.assignedBuilding;
    if (prev) {
      prev.removeWorker(this);
      this.assignedBuilding = null;
    }
    this.assignedProfession = null;
    this.workBuilding = null;
    this.shadowOuter.setVisible(true);
    this.shadowCore.setVisible(true);
    if (prev && prev.scene && prev.buildingType === 'watchtower') {
      const spot = prev.getWorkSpot();
      this.rig.y = 0;
      this.setPosition(spot.x, spot.y);
      if (this.state === 'WORKING_STATION') {
        this.state = this.warriorClass ? 'PATROLLING' : 'IDLE_WANDER';
      }
      this.updateHeldTool();
    }
  }

  public getSkillLevel(prof: ProfessionId): number {
    return this.skills[prof]?.level ?? 1;
  }

  public getSkillXpRatio(prof: ProfessionId): number {
    const sk = this.skills[prof];
    if (!sk) return 0;
    if (sk.level >= 5) return 1;
    const curMin = SKILL_XP_THRESHOLDS[sk.level - 1] ?? 0;
    const nextMin = SKILL_XP_THRESHOLDS[sk.level] ?? 270;
    return Phaser.Math.Clamp((sk.xp - curMin) / Math.max(1, nextMin - curMin), 0, 1);
  }

  public gainProfessionXp(prof: ProfessionId, baseXp: number): void {
    const sk = this.skills[prof];
    if (!sk || sk.level >= 5) return;
    const mult = this.callbacks.hasTotem() ? 1.25 : 1;
    sk.xp += baseXp * mult;

    let leveledUp = false;
    while (sk.level < 5 && sk.xp >= SKILL_XP_THRESHOLDS[sk.level]) {
      sk.level += 1;
      leveledUp = true;
    }

    if (leveledUp && this.scene) {
      SoundFX.playLevelUp();
      this.spawnSparkleBurst(0xfde047);
      this.showTemporaryBubble('⭐', 2000);
    }
  }

  public equipCraftedTools(): boolean {
    if (this.isChild || this.isDying || this.hasCraftedTools) return false;
    this.hasCraftedTools = true;
    this.updateHeldTool();
    if (this.scene) {
      this.spawnSparkleBurst(0x38bdf8);
      this.showTemporaryBubble('🛠️', 2000);
    }
    return true;
  }

  public getTopProfession(): { prof: ProfessionId; label: string; level: number } {
    let bestProf: ProfessionId = this.assignedProfession ?? this.activeProfession ?? 'lumberjack';
    let bestScore = -1;
    (Object.keys(this.skills) as ProfessionId[]).forEach((p) => {
      const score = this.skills[p].level * 1000 + this.skills[p].xp;
      if (score > bestScore) {
        bestScore = score;
        bestProf = p;
      }
    });
    return {
      prof: bestProf,
      label: PROFESSION_LABELS_UK[bestProf],
      level: this.skills[bestProf].level
    };
  }

  public buildBiographyUk(diedYear: number): string {
    const top = this.getTopProfession();
    const parts: string[] = [];
    parts.push(`${this.villagerName} із роду «${this.familyName}»`);
    if (this.isChief) {
      parts.push('був мудрим Вождем племені');
    } else if (this.warriorClass) {
      parts.push(`захищав племʼя як ${WARRIOR_CLASS_LABELS_UK[this.warriorClass].toLowerCase()}`);
    } else if (top.level >= 2) {
      const rank = SKILL_LEVEL_TITLES_UK[top.level] ?? '';
      parts.push(`прославився як ${top.label.toLowerCase()} (${rank})`);
    } else {
      parts.push('чесно служив племені');
    }

    const statsParts: string[] = [];
    if (this.deeds.woodGathered > 0) statsParts.push(`зрубав ${this.deeds.woodGathered} дер.`);
    if (this.deeds.stoneGathered > 0) statsParts.push(`видобув ${this.deeds.stoneGathered} кам.`);
    if (this.deeds.fishCaught > 0) statsParts.push(`наловив ${this.deeds.fishCaught} риби`);
    if (this.deeds.animalsHunted > 0) statsParts.push(`уполював ${this.deeds.animalsHunted} звірів`);
    if (this.deeds.enemiesSlain > 0) statsParts.push(`здолав ${this.deeds.enemiesSlain} ворогів`);
    if (this.deeds.buildingsBuilt > 0) statsParts.push(`допоміг у ${this.deeds.buildingsBuilt} буд.`);
    if (this.deeds.toolsCrafted > 0) statsParts.push(`скував ${this.deeds.toolsCrafted} інстр.`);

    if (statsParts.length > 0) {
      parts.push(`— ${statsParts.slice(0, 3).join(', ')}`);
    }
    if (this.spouseName) {
      parts.push(`Сімʼя: ${this.spouseName}`);
    }
    if (this.childrenNames.length > 0) {
      parts.push(`Діти: ${this.childrenNames.slice(0, 3).join(', ')}`);
    }
    return `${parts.join('. ')}. (${this.bornYear}–${diedYear} рр.)`;
  }

  public getActionLabel(): string {
    if (this.state === 'GATHERING' && this.targetNode) {
      if (this.targetNode.resourceType === 'wood') return 'Рубає дерево';
      if (this.targetNode.resourceType === 'stone') return 'Добуває камінь';
      return 'Збирає ягоди';
    }
    if (this.state === 'FISHING') {
      return this.hasCraftedTools ? 'Ловить рибу списом' : 'Ловить рибу руками';
    }
    if (this.state === 'PATROLLING' && this.warriorClass) {
      return `${WARRIOR_CLASS_LABELS_UK[this.warriorClass]} на сторожі`;
    }
    if (this.state === 'WORKING_STATION' && this.workBuilding) {
      if (this.workBuilding.buildingType === 'workshop') return 'Працює в майстерні';
      if (this.workBuilding.buildingType === 'armory') return 'Кує зброю та броню';
      if (this.workBuilding.buildingType === 'granary') return 'Впорядковує комору';
      if (this.workBuilding.buildingType === 'smokehouse') return 'Коптить припаси';
      if (this.workBuilding.buildingType === 'watchtower') return 'Чатує на вежі';
      if (this.workBuilding.buildingType === 'totem') return 'Вивчає технології';
      if (this.workBuilding.buildingType === 'gatherer_hut') return 'Шукає ресурси та пні';
    }
    return STATE_LABELS_UK[this.state];
  }

  public getSnapshot(): VillagerSnapshot {
    const hasWisdomBuff = this.hasWisdomAura();
    const hasChiefBuff = this.hasChiefAura();
    const prof = this.assignedProfession ?? this.activeProfession;
    return {
      id: this.id,
      name: this.villagerName,
      gender: this.gender,
      appearance: this.appearance,
      state: this.state,
      actionLabel: this.getActionLabel(),
      stats: { ...this.stats },
      maxHealth: this.maxHealth,
      carrying: this.carrying,
      carryAmount: this.carryAmount,
      carryCapacity: this.carryCapacity,
      isChild: this.isChild,
      age: this.age,
      lifeStage: this.lifeStage,
      isChief: this.isChief,
      hasWisdomBuff,
      hasChiefBuff,
      canElectChief: !this.isChild && !this.isChief && !this.isDying && !this.callbacks.hasChief(),
      familyName: this.familyName,
      hasCraftedTools: this.hasCraftedTools,
      warriorClass: this.warriorClass,
      equippedWeapon: this.equippedWeapon,
      equippedArmor: this.equippedArmor,
      birthsThisSeason: this.birthsThisSeason,
      isFreeTime: this.isFreeTime,
      isIdleFree: this.isIdleFree(),
      activeProfession: prof,
      activeProfessionLabel: prof ? PROFESSION_LABELS_UK[prof] : null,
      activeProfessionLevel: prof ? this.getSkillLevel(prof) : 1,
      activeProfessionXpRatio: prof ? this.getSkillXpRatio(prof) : 0,
      assignedBuildingName: this.assignedBuilding ? this.assignedBuilding.nameUk : null,
      isDying: this.isDying
    };
  }

  public setChief(chief: boolean): void {
    this.isChief = chief;
    this.carryCapacity = chief ? 7 : 5;
    this.crownSprite.setVisible(chief);
    this.chiefAura.setVisible(chief);
    if (chief && this.scene) {
      this.spawnSparkleBurst(0xfbbf24);
      this.showTemporaryBubble('💀', 2200);
    }
  }

  public advanceAge(years: number): boolean {
    if (!this.scene || this.isDying) return false;
    const prevStage = this.lifeStage;
    this.age += years;
    const nextStage = this.computeLifeStage(this.age);
    this.lifeStage = nextStage;
    this.isChild = nextStage === 'CHILD';

    if (prevStage === 'CHILD' && nextStage !== 'CHILD') {
      this.growUpIntoAdult();
    } else if (prevStage !== 'ELDER' && nextStage === 'ELDER') {
      this.refreshHeadTexture();
      this.refreshLifeVisuals();
      this.updateHeldTool();
      this.showTemporaryBubble('🕯️', 2200);
    }

    if (this.age >= this.naturalDeathAge) {
      this.startDyingSequence();
      return true;
    }
    return false;
  }

  private startDyingSequence(): void {
    if (this.isDying || !this.scene) return;
    this.isDying = true;
    this.endChat();
    this.leaveHutIfOccupied();
    if (this.breedHut && (this.state === 'MOVING_TO_BREED' || this.state === 'BREEDING_IN_HUT')) {
      this.breedHut.abortBreeding();
    }
    this.unassignFromBuilding();
    this.setWadingVisual(false);

    // If dying while standing inside lake water, step onto the shore first
    const lake = this.targetLake ?? this.callbacks.getLake();
    if (lake && lake.isPointInsideClickArea(this.x, this.y)) {
      const shore = lake.getShoreSpotFor(this.x, this.y);
      this.setPosition(shore.x, shore.y);
    }

    this.targetNode = null;
    this.targetLake = null;
    this.lakeWadeSpot = null;
    this.targetAnimal = null;
    this.targetBuild = null;
    this.buildSpot = null;
    this.moveTarget = null;
    this.clearSavedWork();
    this.clearProgressBar();

    this.state = 'DYING_LYING';
    this.dyingTimer = 11_000;
    this.dyingBubbleTimer = 2400;
    this.isBlinking = true;
    this.refreshHeadTexture();
    this.toolSprite.setVisible(false);
    this.carrySprite.setVisible(false);
    this.resetPose();
    this.showBubble('🕯️');

    this.scene.tweens.add({
      targets: this.rig,
      angle: 86,
      y: 12,
      duration: 750,
      ease: 'Sine.easeOut'
    });

    this.callbacks.onVillagerStartedDying(this);
  }

  public startMourningFor(dying: Villager, sitX: number, sitY: number): void {
    if (this.isDying || !this.scene) return;
    this.endChat();
    this.leaveHutIfOccupied();
    this.setWadingVisual(false);
    if (this.breedHut && (this.state === 'MOVING_TO_BREED' || this.state === 'BREEDING_IN_HUT')) {
      this.breedHut.abortBreeding();
    }
    this.saveCurrentWorkForResume();
    this.targetNode = null;
    this.targetLake = null;
    this.lakeWadeSpot = null;
    this.targetAnimal = null;
    this.targetBuild = null;
    this.buildSpot = null;
    this.workBuilding = null;
    this.moveTarget = null;
    this.mournTarget = dying;
    this.mournSpot = new Phaser.Math.Vector2(sitX, sitY);
    this.mournBubbleTimer = 600;
    this.state = 'MOVING_TO_MOURN';
    this.clearProgressBar();
    this.showBubble('🕯️');
    this.updateHeldTool();
  }

  public finishMourning(): void {
    if (this.state !== 'MOVING_TO_MOURN' && this.state !== 'MOURNING_SITTING') {
      return;
    }
    this.mournTarget = null;
    this.mournSpot = null;
    this.hideBubble();
    this.resetPose();
    this.finishEatingAndResume();
  }

  public disposeOnDeath(): void {
    this.endChat();
    this.leaveHutIfOccupied();
    this.setWadingVisual(false);
    this.unassignFromBuilding();
    if (this.breedHut && (this.state === 'MOVING_TO_BREED' || this.state === 'BREEDING_IN_HUT')) {
      this.breedHut.abortBreeding();
    }
    this.clearProgressBar();
    this.hideBubble();
    if (this.scene) {
      this.scene.tweens.killTweensOf(this);
      this.scene.tweens.killTweensOf(this.rig);
    }
    this.destroy();
  }

  public hasWisdomAura(): boolean {
    if (this.lifeStage === 'ELDER' || !this.visible) {
      return false;
    }
    for (const other of this.callbacks.getVillagers()) {
      if (
        other !== this &&
        other.scene &&
        other.visible &&
        other.lifeStage === 'ELDER' &&
        Phaser.Math.Distance.Between(this.x, this.y, other.x, other.y) <= 160
      ) {
        return true;
      }
    }
    return false;
  }

  public hasChiefAura(): boolean {
    if (this.isChief || !this.visible) {
      return false;
    }
    for (const other of this.callbacks.getVillagers()) {
      if (
        other !== this &&
        other.scene &&
        other.visible &&
        other.isChief &&
        Phaser.Math.Distance.Between(this.x, this.y, other.x, other.y) <= 160
      ) {
        return true;
      }
    }
    return false;
  }

  private getMoveSpeed(): number {
    let sp = this.speed;
    if (this.lifeStage === 'ELDER') sp *= 0.7;
    if (this.isChief) sp *= 1.2;
    return sp;
  }

  private getWorkMultiplier(
    isHeavyLabor: boolean,
    prof: ProfessionId | null = this.activeProfession,
    bypassUnarmedPenalty = false
  ): number {
    let mult = 1;
    if (!bypassUnarmedPenalty && !this.hasCraftedTools) {
      mult *= 0.5;
    }
    if (this.lifeStage === 'ELDER' && isHeavyLabor) mult *= 0.7;
    if (prof) {
      mult *= 1 + (this.getSkillLevel(prof) - 1) * 0.15;
    }
    const tech = this.callbacks.getTechLevels();
    mult *= [1, 1.15, 1.35, 1.55][tech.craft] ?? 1;
    if (this.isChief) mult *= 1.4;
    else if (this.hasChiefAura()) mult *= 1.1;
    if (this.hasWisdomAura()) mult *= 1.2;
    return mult;
  }

  private computeLifeStage(age: number): LifeStage {
    if (age < ADULT_AGE) return 'CHILD';
    if (age < ELDER_AGE) return 'ADULT';
    return 'ELDER';
  }

  public update(delta: number): void {
    if (!this.scene) return;
    const dt = delta / 1000;
    this.isMovingFrame = false;
    if (this.breedCooldown > 0) {
      this.breedCooldown = Math.max(0, this.breedCooldown - delta);
    }
    if (this.attackCooldownTimer > 0) {
      this.attackCooldownTimer = Math.max(0, this.attackCooldownTimer - delta);
    }

    this.updateTemporaryBubble(delta);
    if (this.headingLockTimer > 0) {
      this.headingLockTimer = Math.max(0, this.headingLockTimer - delta);
    }
    this.updateBlink(delta);
    this.updateNeeds(dt);
    this.updateBehavior(delta, dt);
    if (!this.scene) return;
    this.updateInertialRig(dt);
    const inWatchtower = this.isGarrisonedInWatchtower() && this.state === 'WORKING_STATION';
    this.setDepth(inWatchtower && this.assignedBuilding ? this.assignedBuilding.y + 6 : this.y);
    this.updateOverheadTaskBadge();
  }

  private growUpIntoAdult(): void {
    if (this.nurseryBuilding) {
      const exit = this.nurseryBuilding.getWorkSpot();
      this.nurseryBuilding.leaveNursery(this);
      this.nurseryBuilding = null;
      this.setPosition(exit.x, exit.y);
      this.setVisible(true);
      this.setInteractive(new Phaser.Geom.Circle(0, -18, 30), Phaser.Geom.Circle.Contains);
    }
    this.isChild = false;
    this.lifeStage = 'ADULT';
    if (
      this.state === 'CHILD_PLAYING' ||
      this.state === 'MOVING_TO_NURSERY' ||
      this.state === 'IN_NURSERY'
    ) {
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 3000;
      this.moveTarget = null;
    }
    this.refreshHeadTexture();
    this.refreshLifeVisuals();
    this.updateHeldTool();
    this.spawnSparkleBurst(0xfde047);
    this.showTemporaryBubble('🎉', 2400);
    SoundFX.playFanfare();
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 600,
      ease: 'Back.easeOut'
    });
    this.callbacks.onGrewUp(this);
  }

  private spawnSparkleBurst(color: number): void {
    if (!this.scene) return;
    for (let i = 0; i < 10; i++) {
      const star = this.scene.add.star(
        this.x + Phaser.Math.Between(-16, 16),
        this.y - Phaser.Math.Between(12, 46),
        4,
        2,
        5,
        color,
        0.95
      );
      star.setDepth(this.y + 40);
      this.scene.tweens.add({
        targets: star,
        x: star.x + Phaser.Math.Between(-24, 24),
        y: star.y - Phaser.Math.Between(22, 46),
        angle: Phaser.Math.Between(-160, 160),
        alpha: 0,
        duration: 850,
        ease: 'Cubic.easeOut',
        onComplete: () => star.destroy()
      });
    }
  }

  private interruptForPlayerOrder(): void {
    this.endChat();
    this.leaveHutIfOccupied();
    this.setWadingVisual(false);
    this.cancelActiveConversion();
    if (this.breedHut && (this.state === 'MOVING_TO_BREED' || this.state === 'BREEDING_IN_HUT')) {
      this.breedHut.abortBreeding();
    }
    this.hideBubble();
    this.targetNode = null;
    this.targetLake = null;
    this.lakeWadeSpot = null;
    this.targetAnimal = null;
    this.targetCarcass = null;
    this.targetBuild = null;
    this.buildSpot = null;
    this.workBuilding = null;
    this.combatTarget = null;
    this.mournTarget = null;
    this.mournSpot = null;
    this.lastResourceType = null;
    if (this.navState) {
      resetNavAgentState(this.navState, this.x, this.y);
    }
    this.clearSavedWork();
    this.isAutonomousEat = false;
  }

  private clearSavedWork(): void {
    this.savedWorkNode = null;
    this.savedWorkLake = null;
    this.savedWorkAnimal = null;
    this.savedWorkCarcass = null;
    this.savedWorkBuild = null;
    this.savedWorkBuilding = null;
    this.savedWorkType = null;
  }

  private setWadingVisual(wading: boolean): void {
    if (this.isWading === wading) return;
    this.isWading = wading;
    if (wading) {
      this.shadowOuter.setVisible(false);
      this.shadowCore.setVisible(false);
      this.leftLeg.setVisible(false);
      this.rightLeg.setVisible(false);
      this.torso.setCrop(0, 0, 104, 60);
      this.armorOverlay.setCrop(0, 0, 72, 42);
      this.wadeRipple.setVisible(true);
    } else {
      this.shadowOuter.setVisible(true);
      this.shadowCore.setVisible(true);
      this.leftLeg.setVisible(true);
      this.rightLeg.setVisible(true);
      this.torso.setCrop();
      this.armorOverlay.setCrop();
      this.wadeRipple.setVisible(false);
    }
  }

  private leaveHutIfOccupied(): void {
    if (this.sleepHut) {
      const door = this.sleepHut.getDoorPoint();
      this.sleepHut.leaveSleep(this);
      this.sleepHut = null;
      if (!this.visible) {
        this.setPosition(door.x, door.y);
        this.setVisible(true);
        this.setInteractive(new Phaser.Geom.Circle(0, -18, 30), Phaser.Geom.Circle.Contains);
      }
    }
  }

  private updateTemporaryBubble(delta: number): void {
    if (this.temporaryBubbleTimer > 0) {
      this.temporaryBubbleTimer -= delta;
      if (this.temporaryBubbleTimer <= 0) {
        this.temporaryBubbleTimer = 0;
        if (
          this.state !== 'WARMING' &&
          this.state !== 'SCRATCHING' &&
          this.state !== 'CHATTING' &&
          this.state !== 'EATING_STORAGE' &&
          this.state !== 'EATING_BERRIES' &&
          this.state !== 'MOVING_TO_BREED'
        ) {
          this.hideBubble();
        }
      }
    }
  }

  private updateInertialRig(dt: number): void {
    if (!this.scene) return;
    // Keep full 3D proportions at all times (never squish to a thin sliver mid-turn)
    const targetScaleX = this.currentView === 'side' ? this.facingDir : 1;
    this.rig.setScale(targetScaleX, 1);

    if (this.isGarrisonedInWatchtower() && this.state === 'WORKING_STATION') {
      this.rig.y = -82;
      this.rig.setAngle(0);
      this.shadowOuter.setVisible(false);
      this.shadowCore.setVisible(false);
      return;
    }

    if (this.isWading) {
      const shimmer = 0.94 + Math.sin(this.scene.time.now * 0.008) * 0.08;
      this.wadeRipple.setScale(shimmer);
    }

    if (this.state === 'DYING_LYING') {
      const breath = 1 + Math.sin(this.scene.time.now * 0.004) * 0.018;
      this.rig.setScale(targetScaleX * breath, 1);
      return;
    }

    const baseStoop =
      this.state === 'MOURNING_SITTING' ? 8 : this.lifeStage === 'ELDER' ? 5 : 0;
    const targetLean =
      baseStoop + (this.isMovingFrame ? (this.currentView === 'side' ? 7.5 : 3.5) : 0);
    this.forwardLean = Phaser.Math.Linear(this.forwardLean, targetLean, Math.min(1, dt * 11));
    this.rig.setAngle(this.forwardLean);

    const bounceFactor = Phaser.Math.Clamp(Math.abs(this.rig.y) / 4, 0, 1);
    const shScale = 1 - bounceFactor * 0.16;
    this.shadowOuter.setScale(shScale);
    this.shadowCore.setScale(shScale);
  }

  private updateBlink(delta: number): void {
    if (this.state === 'DYING_LYING') {
      return;
    }
    this.blinkTimer -= delta;
    if (this.blinkTimer <= 0) {
      if (!this.isBlinking) {
        this.isBlinking = true;
        this.refreshHeadTexture();
        this.blinkTimer = 130;
      } else {
        this.isBlinking = false;
        this.refreshHeadTexture();
        this.blinkTimer = Phaser.Math.Between(2800, 5000);
      }
    }
  }

  private getHeadTexturePrefix(): string {
    if (this.lifeStage === 'CHILD') {
      return `v-${this.appearance}-child`;
    }
    if (this.lifeStage === 'ELDER') {
      return `v-${this.appearance}-elder`;
    }
    return `v-${this.appearance}`;
  }

  private refreshHeadTexture(): void {
    const prefix = this.getHeadTexturePrefix();
    if (this.currentView === 'back') {
      this.head.setTexture(`${prefix}-head-back`);
      return;
    }
    const suffix = this.isBlinking ? '-blink' : '';
    this.head.setTexture(`${prefix}-head-${this.currentView}${suffix}`);
  }

  private refreshLifeVisuals(): void {
    if (this.lifeStage === 'ELDER') {
      this.torso.setPosition(0, -18);
      this.armorOverlay.setPosition(0, -18);
      this.head.setPosition(1, -34);
      this.crownSprite.setPosition(1, -50);
    } else {
      this.torso.setPosition(0, -19);
      this.armorOverlay.setPosition(0, -19);
      this.head.setPosition(0, -36);
      this.crownSprite.setPosition(0, -52);
    }
    this.crownSprite.setVisible(this.isChief);
    this.chiefAura.setVisible(this.isChief);
    this.updateArmorVisual();
  }

  private applyView(view: FacingView): void {
    this.currentView = view;
    this.refreshHeadTexture();
    this.torso.setTexture(`v-${this.appearance}-torso-${view}`);

    if (view === 'front') {
      this.backArm.setPosition(-13, -21);
      this.backArm.clearTint();
      this.frontArmGroup.setPosition(13, -22);
      this.leftLeg.setPosition(-5.5, -8);
      this.leftLeg.clearTint();
      this.rightLeg.setPosition(5.5, -8);
      this.carrySprite.setPosition(0, -16);
      this.rig.bringToTop(this.leftLeg);
      this.rig.bringToTop(this.rightLeg);
      this.rig.bringToTop(this.backArm);
      this.rig.bringToTop(this.torso);
      this.rig.bringToTop(this.armorOverlay);
      this.rig.bringToTop(this.head);
      this.rig.bringToTop(this.crownSprite);
      this.rig.bringToTop(this.frontArmGroup);
      this.rig.bringToTop(this.carrySprite);
    } else if (view === 'back') {
      this.backArm.setPosition(-13, -21);
      this.backArm.clearTint();
      this.frontArmGroup.setPosition(13, -22);
      this.leftLeg.setPosition(-5.5, -8);
      this.leftLeg.clearTint();
      this.rightLeg.setPosition(5.5, -8);
      this.carrySprite.setPosition(0, -18);
      this.rig.bringToTop(this.carrySprite);
      this.rig.bringToTop(this.frontArmGroup);
      this.rig.bringToTop(this.backArm);
      this.rig.bringToTop(this.leftLeg);
      this.rig.bringToTop(this.rightLeg);
      this.rig.bringToTop(this.torso);
      this.rig.bringToTop(this.armorOverlay);
      this.rig.bringToTop(this.head);
      this.rig.bringToTop(this.crownSprite);
    } else {
      this.backArm.setPosition(-9, -21);
      this.backArm.setTint(0xcbc0b6);
      this.frontArmGroup.setPosition(9, -22);
      this.leftLeg.setPosition(-4.5, -8);
      this.leftLeg.setTint(0xd6ccc2);
      this.rightLeg.setPosition(4.5, -8);
      this.carrySprite.setPosition(13, -18);
      this.rig.bringToTop(this.backArm);
      this.rig.bringToTop(this.leftLeg);
      this.rig.bringToTop(this.rightLeg);
      this.rig.bringToTop(this.torso);
      this.rig.bringToTop(this.armorOverlay);
      this.rig.bringToTop(this.head);
      this.rig.bringToTop(this.crownSprite);
      this.rig.bringToTop(this.frontArmGroup);
      this.rig.bringToTop(this.carrySprite);
    }
  }

  private updateNeeds(dt: number): void {
    if (
      this.state === 'BREEDING_IN_HUT' ||
      this.state === 'IN_NURSERY' ||
      this.state === 'DYING_LYING' ||
      this.state === 'MOVING_TO_MOURN' ||
      this.state === 'MOURNING_SITTING'
    ) {
      if (this.state === 'IN_NURSERY') {
        this.stats.satiety = Math.max(85, this.stats.satiety);
        this.stats.energy = Math.max(90, this.stats.energy);
      }
      return;
    }

    if (this.isGarrisonedInWatchtower() && this.state === 'WORKING_STATION') {
      this.stats.satiety = Math.max(70, this.stats.satiety);
      this.stats.energy = Math.max(80, this.stats.energy);
      this.stats.health = Math.min(this.maxHealth, this.stats.health + 2.5 * dt);
      return;
    }

    if (this.state === 'SLEEPING_IN_HUT') {
      this.stats.energy = Math.min(100, this.stats.energy + 20 * dt);
      this.stats.health = Math.min(this.maxHealth, this.stats.health + 8 * dt);
      this.stats.satiety = Math.max(0, this.stats.satiety - 0.35 * dt);
      return;
    }

    const tech = this.callbacks.getTechLevels();
    const working =
      this.state === 'GATHERING' ||
      this.state === 'FISHING' ||
      this.state === 'HUNTING' ||
      this.state === 'BUTCHERING' ||
      this.state === 'BUILDING' ||
      this.state === 'WORKING_STATION';
    const hungerMult = tech.healing >= 2 ? 0.78 : 1;
    const hungerRate = (this.isChild ? 0.45 : working ? 1.15 : 0.72) * hungerMult;
    this.stats.satiety = Math.max(0, this.stats.satiety - hungerRate * dt);

    if (working) {
      this.stats.energy = Math.max(0, this.stats.energy - 1.9 * dt);
    } else if (this.state === 'WARMING') {
      this.stats.energy = Math.min(100, this.stats.energy + 10.5 * dt);
    } else if (
      this.state === 'IDLE_WANDER' ||
      this.state === 'FREE_TIME' ||
      this.state === 'PATROLLING' ||
      this.state === 'SCRATCHING' ||
      this.state === 'CHATTING' ||
      this.state === 'CHILD_PLAYING'
    ) {
      this.stats.energy = Math.min(100, this.stats.energy + 3.5 * dt);
    }

    // Winter cold drain when far from campfire
    if (this.callbacks.getSeason() === 'WINTER') {
      const distToFire = Phaser.Math.Distance.Between(
        this.x,
        this.y,
        this.campfire.x,
        this.campfire.y
      );
      if (distToFire > 155) {
        const coldRate = 1.65 * (this.isChief ? 0.75 : 1);
        this.stats.energy = Math.max(0, this.stats.energy - coldRate * dt);
      } else if (distToFire <= 130) {
        this.stats.energy = Math.min(100, this.stats.energy + 1.2 * dt);
      }
    }

    if (this.stats.satiety <= 0) {
      this.stats.health = Math.max(5, this.stats.health - 1.8 * dt);
    } else if (this.stats.satiety > 50 && (this.state === 'WARMING' || this.state === 'FREE_TIME')) {
      this.stats.health = Math.min(this.maxHealth, this.stats.health + 2.0 * dt);
    }
  }

  private updateBehavior(delta: number, dt: number): void {
    if (this.state === 'DYING_LYING') {
      this.handleDyingLying(delta);
      return;
    }
    if (this.state === 'MOVING_TO_MOURN') {
      this.handleMovingToMourn(dt);
      return;
    }
    if (this.state === 'MOURNING_SITTING') {
      this.handleMourningSitting(delta);
      return;
    }

    // Autonomous hunger check (paused while fighting, fleeing, or garrisoned on watchtower)
    if (
      !this.isAutonomousEat &&
      !this.isDying &&
      !this.isInCombat() &&
      !this.isGarrisonedInWatchtower() &&
      this.state !== 'EATING_BERRIES' &&
      this.state !== 'EATING_STORAGE' &&
      this.state !== 'MOVING_TO_EAT_STORAGE' &&
      this.state !== 'RETURNING' &&
      this.state !== 'SLEEPING_IN_HUT' &&
      this.state !== 'IN_NURSERY' &&
      this.state !== 'MOVING_TO_NURSERY' &&
      this.state !== 'CONVERTING_ENEMY' &&
      this.state !== 'BREEDING_IN_HUT' &&
      this.state !== 'MOVING_TO_BREED' &&
      this.stats.satiety < 30
    ) {
      this.endChat();
      this.leaveHutIfOccupied();
      this.setWadingVisual(false);
      this.saveCurrentWorkForResume();

      if (this.callbacks.hasFoodInStorage()) {
        this.targetNode = null;
        this.targetLake = null;
        this.targetAnimal = null;
        this.targetCarcass = null;
        this.targetBuild = null;
        this.workBuilding = null;
        this.lakeWadeSpot = null;
        this.buildSpot = null;
        this.isAutonomousEat = true;
        this.moveTarget = null;
        this.state = 'MOVING_TO_EAT_STORAGE';
        this.actionTimer = 0;
        this.clearProgressBar();
        this.updateHeldTool();
        return;
      }

      const bush = this.callbacks.findNearestBerryBush(this.x, this.y);
      if (bush) {
        this.targetNode = bush;
        this.targetLake = null;
        this.targetAnimal = null;
        this.targetCarcass = null;
        this.targetBuild = null;
        this.workBuilding = null;
        this.lakeWadeSpot = null;
        this.buildSpot = null;
        this.isAutonomousEat = true;
        this.moveTarget = null;
        this.state = 'MOVING_TO_RESOURCE';
        this.actionTimer = 0;
        this.clearProgressBar();
        this.updateHeldTool();
        return;
      }
    }

    // Autonomous low-energy check -> sleep in Small Hut (if available)
    if (
      !this.isChild &&
      !this.isDying &&
      !this.isInCombat() &&
      !this.isGarrisonedInWatchtower() &&
      this.stats.energy < 25 &&
      this.state !== 'MOVING_TO_SLEEP' &&
      this.state !== 'SLEEPING_IN_HUT' &&
      this.state !== 'RETURNING' &&
      this.state !== 'BREEDING_IN_HUT' &&
      this.state !== 'MOVING_TO_BREED' &&
      this.state !== 'EATING_STORAGE' &&
      this.state !== 'EATING_BERRIES' &&
      this.state !== 'MOVING_TO_EAT_STORAGE'
    ) {
      const hut = this.callbacks.findAvailableSleepHut(this.x, this.y);
      if (hut) {
        this.endChat();
        this.setWadingVisual(false);
        this.saveCurrentWorkForResume();
        this.targetNode = null;
        this.targetLake = null;
        this.targetAnimal = null;
        this.targetCarcass = null;
        this.targetBuild = null;
        this.workBuilding = null;
        this.moveTarget = null;
        this.sleepHut = hut;
        this.state = 'MOVING_TO_SLEEP';
        this.clearProgressBar();
        this.updateHeldTool();
        return;
      }
    }

    switch (this.state) {
      case 'CHILD_PLAYING':
        this.handleChildPlaying(delta, dt);
        break;
      case 'MOVING_TO_NURSERY':
        this.handleMovingToNursery(dt);
        break;
      case 'IN_NURSERY':
        this.handleInNursery();
        break;
      case 'IDLE_WANDER':
        this.handleIdleWander(delta, dt);
        break;
      case 'FREE_TIME':
        this.handleFreeTime(delta, dt);
        break;
      case 'WARMING':
        this.handleWarming(delta, dt);
        break;
      case 'SCRATCHING':
        this.handleScratching(delta);
        break;
      case 'CHATTING':
        this.handleChatting(delta, dt);
        break;
      case 'MOVING':
        this.handleMoving(dt);
        break;
      case 'MOVING_TO_RESOURCE':
        this.handleMovingToResource(dt);
        break;
      case 'CLEARING_STUMP':
        this.handleClearingStump(delta);
        break;
      case 'MOVING_TO_CONVERT':
        this.handleMovingToConvert(dt);
        break;
      case 'CONVERTING_ENEMY':
        this.handleConvertingEnemy(delta);
        break;
      case 'MOVING_TO_LAKE':
        this.handleMovingToLake(dt);
        break;
      case 'MOVING_TO_HUNT':
        this.handleMovingToHunt(dt);
        break;
      case 'MOVING_TO_CARCASS':
        this.handleMovingToCarcass(dt);
        break;
      case 'MOVING_TO_BUILD':
        this.handleMovingToBuild(dt);
        break;
      case 'MOVING_TO_WORK':
        this.handleMovingToWork(dt);
        break;
      case 'GATHERING':
        this.handleGathering(delta);
        break;
      case 'FISHING':
        this.handleFishing(delta);
        break;
      case 'HUNTING':
        this.handleHunting(delta, dt);
        break;
      case 'BUTCHERING':
        this.handleButchering(delta);
        break;
      case 'BUILDING':
        this.handleBuilding(delta);
        break;
      case 'WORKING_STATION':
        this.handleWorkingStation(delta);
        break;
      case 'RETURNING':
        this.handleReturning(dt);
        break;
      case 'MOVING_TO_EAT_STORAGE':
        this.handleMovingToEatStorage(dt);
        break;
      case 'EATING_STORAGE':
        this.handleEatingStorage(delta);
        break;
      case 'EATING_BERRIES':
        this.handleEatingBerries(delta);
        break;
      case 'MOVING_TO_SLEEP':
        this.handleMovingToSleep(dt);
        break;
      case 'SLEEPING_IN_HUT':
        this.handleSleepingInHut();
        break;
      case 'MOVING_TO_BREED':
        this.handleMovingToBreed(dt);
        break;
      case 'BREEDING_IN_HUT':
        break;
      case 'FLEEING_TO_CAMPFIRE':
        this.handleFleeingToCampfire(delta, dt);
        break;
      case 'GRABBING_GEAR':
        this.handleGrabbingGear(delta, dt);
        break;
      case 'COMBAT_CHASE':
        this.handleCombatChase(dt);
        break;
      case 'COMBAT_ATTACK':
        this.handleCombatAttack(delta, dt);
        break;
      case 'PATROLLING':
        this.handlePatrolling(delta, dt);
        break;
    }
  }

  private saveCurrentWorkForResume(): void {
    if (this.assignedBuilding && this.assignedBuilding.isComplete()) {
      this.savedWorkBuilding = this.assignedBuilding;
    } else if (this.targetBuild && !this.targetBuild.isComplete()) {
      this.savedWorkBuild = this.targetBuild;
    } else if (this.targetCarcass && !this.targetCarcass.isEmpty()) {
      this.savedWorkCarcass = this.targetCarcass;
    } else if (this.targetAnimal && this.targetAnimal.isAlive()) {
      this.savedWorkAnimal = this.targetAnimal;
    } else if (this.targetLake && this.targetLake.isFishable()) {
      this.savedWorkLake = this.targetLake;
      this.savedWorkType = 'food';
    } else if (this.targetNode && this.targetNode.scene && !this.targetNode.isDepleted()) {
      this.savedWorkNode = this.targetNode;
      this.savedWorkType = this.targetNode.resourceType;
    } else if (this.lastResourceType) {
      this.savedWorkType = this.lastResourceType;
    }
  }

  private handleChildPlaying(delta: number, dt: number): void {
    this.clearProgressBar();
    const nursery = this.callbacks.findCompletedNursery(this.x, this.y);
    if (nursery) {
      this.nurseryBuilding = nursery;
      this.moveTarget = null;
      this.state = 'MOVING_TO_NURSERY';
      return;
    }

    if (this.moveTarget) {
      const arrived = this.moveToward(this.moveTarget.x, this.moveTarget.y, dt, 10, 0.95);
      if (arrived) {
        this.moveTarget = null;
        this.playWaitTimer = Phaser.Math.Between(1200, 2600);
        this.resetPose();
      }
    } else {
      this.resetPose();
      this.playWaitTimer -= delta;
      if (this.playWaitTimer <= 0) {
        if (Phaser.Math.Between(0, 100) < 35) {
          this.showTemporaryBubble(Phaser.Math.RND.pick(PLAY_EMOJIS), 1500);
        }
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist = Phaser.Math.Between(75, 220);
        this.moveTarget = new Phaser.Math.Vector2(
          this.campfire.x + Math.cos(angle) * dist,
          this.campfire.y + Math.sin(angle) * dist * 0.78
        );
      }
    }
  }

  private handleMovingToNursery(dt: number): void {
    this.clearProgressBar();
    if (
      !this.isChild ||
      !this.nurseryBuilding ||
      !this.nurseryBuilding.scene ||
      !this.nurseryBuilding.isComplete()
    ) {
      this.nurseryBuilding = null;
      this.state = this.isChild ? 'CHILD_PLAYING' : 'IDLE_WANDER';
      return;
    }

    const door = this.nurseryBuilding.getWorkSpot();
    const dist = Phaser.Math.Distance.Between(this.x, this.y, door.x, door.y);
    const arrived =
      dist <= 22 ||
      this.moveToward(door.x, door.y, dt, 12, 0.95, this.nurseryBuilding);

    if (arrived) {
      this.resetPose();
      this.nurseryBuilding.enterNursery(this);
      this.setVisible(false);
      this.disableInteractive();
      this.state = 'IN_NURSERY';
    }
  }

  private handleInNursery(): void {
    if (
      !this.isChild ||
      !this.nurseryBuilding ||
      !this.nurseryBuilding.scene ||
      !this.nurseryBuilding.isComplete()
    ) {
      if (this.nurseryBuilding) {
        this.nurseryBuilding.leaveNursery(this);
        this.nurseryBuilding = null;
      }
      this.setVisible(true);
      this.setInteractive(new Phaser.Geom.Circle(0, -18, 30), Phaser.Geom.Circle.Contains);
      this.state = this.isChild ? 'CHILD_PLAYING' : 'IDLE_WANDER';
    }
  }

  private handleClearingStump(delta: number): void {
    if (!this.targetNode || !this.targetNode.scene || this.targetNode.isDepleted()) {
      this.clearProgressBar();
      this.targetNode = null;
      this.resetPose();
      if (this.carryAmount > 0) {
        this.state = 'RETURNING';
        this.updateCarryVisual();
      } else if (this.assignedBuilding && this.assignedBuilding.isComplete()) {
        this.workBuilding = this.assignedBuilding;
        this.state = 'MOVING_TO_WORK';
      } else {
        this.state = 'IDLE_WANDER';
      }
      this.updateHeldTool();
      return;
    }

    this.setHeading(this.targetNode.x - this.x, this.targetNode.y - this.y);
    this.actionTimer += delta * this.getWorkMultiplier(false, 'gatherer');
    const clearMs = 1400;
    const p = Phaser.Math.Clamp(this.actionTimer / clearMs, 0, 1);
    const swing = Math.sin(p * Math.PI * 4) * 34;
    this.frontArmGroup.setAngle(-22 + swing);
    this.backArm.setAngle(-swing * 0.35);
    this.drawProgressBar(p, 0xd97706);

    if (this.actionTimer >= clearMs) {
      this.actionTimer = 0;
      this.clearProgressBar();
      const node = this.targetNode;
      this.targetNode = null;
      const bonusWood = node.clearNode();
      SoundFX.playChop();
      this.gainProfessionXp('gatherer', 5);
      if (bonusWood > 0 && !this.callbacks.isStorageFull('wood')) {
        this.carrying = 'wood';
        this.carryVisual = 'wood';
        this.carryAmount += bonusWood;
        this.deeds.woodGathered += bonusWood;
        this.resetPose();
        this.state = 'RETURNING';
        this.updateCarryVisual();
      } else if (this.assignedBuilding && this.assignedBuilding.isComplete()) {
        this.workBuilding = this.assignedBuilding;
        this.state = 'MOVING_TO_WORK';
      } else {
        this.state = 'IDLE_WANDER';
      }
      this.updateHeldTool();
    }
  }

  private handleMovingToConvert(dt: number): void {
    this.clearProgressBar();
    if (!this.convertTarget || !this.convertTarget.canBeConverted()) {
      this.cancelActiveConversion();
      if (this.assignedBuilding && this.assignedBuilding.isComplete()) {
        this.workBuilding = this.assignedBuilding;
        this.state = 'MOVING_TO_WORK';
      } else {
        this.state = 'IDLE_WANDER';
      }
      this.updateHeldTool();
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.convertTarget.x,
      this.convertTarget.y
    );
    const arrived =
      dist <= 58 ||
      this.moveToward(
        this.convertTarget.x,
        this.convertTarget.y,
        dt,
        46,
        1.05
      );

    if (arrived) {
      this.resetPose();
      this.convertTarget.beginConversionBy();
      this.actionTimer = 0;
      this.convertChantTimer = 0;
      this.state = 'CONVERTING_ENEMY';
      this.showBubble('🌀');
      SoundFX.playShamanChant();
      this.updateHeldTool();
    }
  }

  private handleConvertingEnemy(delta: number): void {
    if (!this.convertTarget || !this.convertTarget.isAlive() || this.convertTarget.mode !== 'CONVERTING') {
      this.clearProgressBar();
      this.hideBubble();
      this.cancelActiveConversion();
      if (this.assignedBuilding && this.assignedBuilding.isComplete()) {
        this.workBuilding = this.assignedBuilding;
        this.state = 'MOVING_TO_WORK';
      } else {
        this.state = 'IDLE_WANDER';
      }
      this.updateHeldTool();
      return;
    }

    this.setHeading(this.convertTarget.x - this.x, this.convertTarget.y - this.y);
    this.actionTimer += delta;
    this.convertChantTimer += delta;
    if (this.convertChantTimer >= 4200) {
      this.convertChantTimer = 0;
      SoundFX.playShamanChant();
      this.showBubble(Math.random() < 0.5 ? '🌀' : '🔮');
    }

    const p = Phaser.Math.Clamp(this.actionTimer / SHAMAN_CONVERT_DURATION_MS, 0, 1);
    const wave = Math.sin(this.actionTimer * 0.009);
    this.frontArmGroup.setAngle(-54 + wave * 18);
    this.backArm.setAngle(-42 - wave * 18);
    this.torso.setAngle(wave * 5);
    this.drawProgressBar(p, 0xc084fc);

    if (this.actionTimer >= SHAMAN_CONVERT_DURATION_MS) {
      this.actionTimer = 0;
      this.clearProgressBar();
      this.hideBubble();
      const converted = this.convertTarget;
      this.convertTarget = null;
      this.gainProfessionXp('shaman', 18);
      this.callbacks.onEnemyConvertedToCaptive(converted, this);
      this.spawnSparkleBurst(0x67e8f9);
      this.resetPose();
      if (this.assignedBuilding && this.assignedBuilding.isComplete()) {
        this.workBuilding = this.assignedBuilding;
        this.state = 'MOVING_TO_WORK';
      } else {
        this.state = 'IDLE_WANDER';
      }
      this.updateHeldTool();
    }
  }

  private handleIdleWander(delta: number, dt: number): void {
    this.clearProgressBar();
    if (this.isFreeTime && !this.isChild && !this.isDying && !this.isGarrisonedInWatchtower()) {
      this.state = 'FREE_TIME';
      return;
    }

    // Return to permanently assigned workstation (including garrisoned Watchtower!) before wandering or patrolling
    if (this.assignedBuilding && this.assignedBuilding.isComplete()) {
      this.workBuilding = this.assignedBuilding;
      this.activeProfession = this.assignedProfession;
      this.state = 'MOVING_TO_WORK';
      this.updateHeldTool();
      return;
    }

    if (this.warriorClass) {
      this.state = 'PATROLLING';
      this.updateHeldTool();
      return;
    }

    if (this.stats.energy < 28) {
      const sleepHut = this.callbacks.findAvailableSleepHut(this.x, this.y);
      if (sleepHut) {
        this.sleepHut = sleepHut;
        this.state = 'MOVING_TO_SLEEP';
        return;
      }
      this.startWarming();
      return;
    }

    // Automatically help build an unfinished building if idle
    const unfinished = this.callbacks.findUnfinishedBuilding(this.x, this.y);
    if (unfinished) {
      this.issueBuildOrder(unfinished);
      return;
    }

    if (this.moveTarget) {
      const arrived = this.moveToward(this.moveTarget.x, this.moveTarget.y, dt, 8, 0.55);
      if (arrived) {
        this.moveTarget = null;
        this.idleWaitTimer = 5000;
        this.resetPose();
      }
    } else {
      this.resetPose();
      this.idleWaitTimer -= delta;
      if (this.idleWaitTimer <= 0) {
        this.pickAutonomousIdleActivity();
      }
    }
  }

  private handleFreeTime(delta: number, dt: number): void {
    this.clearProgressBar();
    if (!this.isFreeTime) {
      this.exitFreeTimeAndResume();
      return;
    }

    if (this.moveTarget) {
      const arrived = this.moveToward(this.moveTarget.x, this.moveTarget.y, dt, 10, 0.72);
      if (arrived) {
        this.moveTarget = null;
        this.freeTimeWaitTimer = Phaser.Math.Between(1800, 3400);
        this.resetPose();
      }
    } else {
      this.resetPose();
      this.freeTimeWaitTimer -= delta;
      if (this.freeTimeWaitTimer <= 0) {
        const partner = this.callbacks.findNearbyIdleVillager(this, 260);
        if (partner && Phaser.Math.Between(1, 100) <= 45) {
          const midX = (this.x + partner.x) / 2;
          const midY = (this.y + partner.y) / 2;
          const angle = Phaser.Math.Angle.Between(midX, midY, this.x, this.y);
          this.startChatWith(partner, midX + Math.cos(angle) * 24, midY + Math.sin(angle) * 18);
          partner.startChatWith(this, midX - Math.cos(angle) * 24, midY - Math.sin(angle) * 18);
          return;
        }
        const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const dist = Phaser.Math.Between(65, 175);
        this.moveTarget = new Phaser.Math.Vector2(
          this.campfire.x + Math.cos(angle) * dist,
          this.campfire.y + Math.sin(angle) * dist * 0.76
        );
      }
    }
  }

  private pickAutonomousIdleActivity(): void {
    const roll = Phaser.Math.Between(1, 100);

    if (roll <= 28) {
      const partner = this.callbacks.findNearbyIdleVillager(this, 240);
      if (partner) {
        const midX = (this.x + partner.x) / 2;
        const midY = (this.y + partner.y) / 2;
        const angle = Phaser.Math.Angle.Between(midX, midY, this.x, this.y);
        const offset = 24;
        this.startChatWith(
          partner,
          midX + Math.cos(angle) * offset,
          midY + Math.sin(angle) * offset * 0.7
        );
        partner.startChatWith(
          this,
          midX - Math.cos(angle) * offset,
          midY - Math.sin(angle) * offset * 0.7
        );
        return;
      }
    }

    if (roll <= 52) {
      this.startWarming();
      return;
    }

    if (roll <= 70) {
      this.state = 'SCRATCHING';
      this.scratchTimer = 2800;
      this.applyView('front');
      this.showBubble(Phaser.Math.RND.pick(['💭', '❓', '🌿']));
      return;
    }

    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const dist = Phaser.Math.Between(82, 195);
    this.moveTarget = new Phaser.Math.Vector2(
      this.campfire.x + Math.cos(angle) * dist,
      this.campfire.y + Math.sin(angle) * dist * 0.75
    );
  }

  private startWarming(): void {
    this.state = 'WARMING';
    this.moveTarget = null;
    this.warmTimer = Phaser.Math.Between(4800, 6800);
    this.hideBubble();
  }

  private handleWarming(delta: number, dt: number): void {
    this.clearProgressBar();
    const distToFire = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.campfire.x,
      this.campfire.y
    );

    if (distToFire > 106) {
      const angle = Phaser.Math.Angle.Between(this.campfire.x, this.campfire.y, this.x, this.y);
      this.moveToward(
        this.campfire.x + Math.cos(angle) * 82,
        this.campfire.y + Math.sin(angle) * 62,
        dt,
        10,
        0.75
      );
      return;
    }

    this.setHeading(this.campfire.x - this.x, this.campfire.y - this.y);
    const sway = Math.sin(this.scene.time.now * 0.006);
    this.rig.y = 3;
    this.leftLeg.setAngle(16);
    this.rightLeg.setAngle(-16);
    this.frontArmGroup.setAngle(-54 + sway * 6);
    this.backArm.setAngle(-46 - sway * 6);
    this.torso.setAngle(5);
    this.showBubble('🔥');

    this.warmTimer -= delta;
    if (this.warmTimer <= 0 && this.stats.energy >= 75) {
      this.hideBubble();
      this.resetPose();
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 5000;
    }
  }

  private handleScratching(delta: number): void {
    this.scratchTimer -= delta;
    const t = this.scene.time.now * 0.012;
    this.frontArmGroup.setAngle(-135 + Math.sin(t) * 10);
    this.head.setAngle(-6 + Math.sin(t * 0.5) * 4);
    this.backArm.setAngle(6);

    if (this.scratchTimer <= 0) {
      this.hideBubble();
      this.resetPose();
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 5000;
    }
  }

  private handleChatting(delta: number, dt: number): void {
    if (!this.chatPartner || !this.chatPartner.scene || this.chatPartner.chatPartner !== this) {
      this.endChat();
      return;
    }

    if (this.chatStandTarget) {
      const arrived = this.moveToward(
        this.chatStandTarget.x,
        this.chatStandTarget.y,
        dt,
        6,
        0.7
      );
      if (!arrived) {
        return;
      }
      this.chatStandTarget = null;
      this.resetPose();
    }

    this.setHeading(this.chatPartner.x - this.x, this.chatPartner.y - this.y);
    const t = this.scene.time.now * 0.008;
    this.head.setAngle(Math.sin(t) * 6);
    this.frontArmGroup.setAngle(-28 + Math.sin(t * 1.4) * 14);
    this.backArm.setAngle(Math.cos(t) * 8);

    this.chatBubbleTimer -= delta;
    if (this.chatBubbleTimer <= 0) {
      this.chatBubbleTimer = 1600;
      this.showBubble(Phaser.Math.RND.pick(CHAT_EMOJIS));
    }

    this.chatTimer -= delta;
    if (this.chatTimer <= 0) {
      this.endChat();
    }
  }

  private handleMoving(dt: number): void {
    this.clearProgressBar();
    if (this.moveTarget) {
      const arrived = this.moveToward(this.moveTarget.x, this.moveTarget.y, dt, 8);
      if (arrived) {
        this.moveTarget = null;
        this.state = this.warriorClass ? 'PATROLLING' : this.isFreeTime ? 'FREE_TIME' : 'IDLE_WANDER';
        this.idleWaitTimer = 5000;
        this.resetPose();
      }
    } else {
      this.state = this.warriorClass ? 'PATROLLING' : this.isFreeTime ? 'FREE_TIME' : 'IDLE_WANDER';
      this.idleWaitTimer = 5000;
    }
  }

  private handleMovingToResource(dt: number): void {
    this.clearProgressBar();
    if (!this.targetNode || !this.targetNode.scene || this.targetNode.isDepleted()) {
      if (!this.isAutonomousEat && this.lastResourceType) {
        if (this.callbacks.isStorageFull(this.lastResourceType)) {
          this.stopWorkStorageFull();
          return;
        }
        const next = this.callbacks.findNearestResourceOfType(
          this.lastResourceType,
          this.x,
          this.y,
          750
        );
        if (next) {
          this.targetNode = next;
          return;
        }
      }
      this.targetNode = null;
      this.isAutonomousEat = false;
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 5000;
      this.resetPose();
      this.updateHeldTool();
      return;
    }

    if (!this.isAutonomousEat && this.callbacks.isStorageFull(this.targetNode.resourceType)) {
      this.stopWorkStorageFull();
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.targetNode.x,
      this.targetNode.y
    );
    const arrived =
      dist <= this.targetNode.interactRadius ||
      this.moveToward(
        this.targetNode.x,
        this.targetNode.y,
        dt,
        this.targetNode.arrivalRadius,
        1,
        this.targetNode
      );

    if (arrived) {
      this.resetPose();
      this.actionTimer = 0;
      this.state = this.isAutonomousEat
        ? 'EATING_BERRIES'
        : this.targetNode.isStump
        ? 'CLEARING_STUMP'
        : 'GATHERING';
      this.updateHeldTool();
    }
  }

  private handleMovingToLake(dt: number): void {
    this.clearProgressBar();
    if (!this.targetLake || !this.targetLake.isFishable()) {
      this.setWadingVisual(false);
      this.targetLake = null;
      this.lakeWadeSpot = null;
      this.lastResourceType = null;
      this.showTemporaryBubble('❄️', 1600);
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 5000;
      this.resetPose();
      this.updateHeldTool();
      return;
    }

    if (this.callbacks.isStorageFull('food')) {
      this.stopWorkStorageFull();
      return;
    }

    if (!this.lakeWadeSpot) {
      const spot = this.targetLake.getWadeSpotFor(this.x, this.y);
      this.lakeWadeSpot = new Phaser.Math.Vector2(spot.x, spot.y);
    }

    // Submerge waist-deep as soon as feet enter the blue lake water contour
    if (this.targetLake.isPointInsideClickArea(this.x, this.y)) {
      this.setWadingVisual(true);
    }

    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.lakeWadeSpot.x,
      this.lakeWadeSpot.y
    );
    const arrived =
      dist <= 20 ||
      this.moveToward(
        this.lakeWadeSpot.x,
        this.lakeWadeSpot.y,
        dt,
        10,
        0.88,
        this.targetLake
      );

    if (arrived) {
      this.setWadingVisual(true);
      this.resetPose();
      this.actionTimer = 0;
      this.state = 'FISHING';
      this.updateHeldTool();
    }
  }

  private handleMovingToHunt(dt: number): void {
    this.clearProgressBar();
    if (!this.targetAnimal || !this.targetAnimal.isAlive()) {
      this.targetAnimal = null;
      this.activeProfession = null;
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 4000;
      this.resetPose();
      this.updateHeldTool();
      return;
    }

    if (this.callbacks.isStorageFull('food')) {
      this.stopWorkStorageFull();
      return;
    }

    const range =
      this.equippedWeapon === 'bow' ? 195 : this.hasCraftedTools ? 105 : 74;
    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.targetAnimal.x,
      this.targetAnimal.y
    );
    const arrived =
      dist <= range ||
      this.moveToward(this.targetAnimal.x, this.targetAnimal.y, dt, range - 14, 1.24);

    if (arrived) {
      this.resetPose();
      this.actionTimer = 0;
      this.state = 'HUNTING';
      this.updateHeldTool();
    }
  }

  private handleMovingToBuild(dt: number): void {
    this.clearProgressBar();
    if (!this.targetBuild || !this.targetBuild.scene || this.targetBuild.isComplete()) {
      this.targetBuild = null;
      this.buildSpot = null;
      this.activeProfession = null;
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 5000;
      this.resetPose();
      this.updateHeldTool();
      return;
    }

    if (!this.buildSpot) {
      const spot = this.targetBuild.getBuildSpotFor(this.x, this.y);
      this.buildSpot = new Phaser.Math.Vector2(spot.x, spot.y);
    }

    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.buildSpot.x, this.buildSpot.y);
    const arrived =
      dist <= 24 ||
      this.moveToward(this.buildSpot.x, this.buildSpot.y, dt, 14, 1, this.targetBuild);

    if (arrived) {
      this.resetPose();
      this.actionTimer = 0;
      this.state = 'BUILDING';
      this.updateHeldTool();
    }
  }

  private handleMovingToWork(dt: number): void {
    this.clearProgressBar();
    if (!this.workBuilding || !this.workBuilding.scene || !this.workBuilding.isComplete()) {
      this.unassignFromBuilding();
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 4000;
      this.resetPose();
      this.updateHeldTool();
      return;
    }

    const spot = this.workBuilding.getWorkSpot();
    const dist = Phaser.Math.Distance.Between(this.x, this.y, spot.x, spot.y);
    const arrived =
      dist <= 22 ||
      this.moveToward(spot.x, spot.y, dt, 10, 1, this.workBuilding);

    if (arrived) {
      this.resetPose();
      this.actionTimer = 0;
      this.state = 'WORKING_STATION';
      this.updateHeldTool();
    }
  }

  private handleGathering(delta: number): void {
    if (!this.targetNode || !this.targetNode.scene || this.targetNode.isDepleted()) {
      this.clearProgressBar();
      if (this.carryAmount > 0) {
        this.state = 'RETURNING';
        this.updateCarryVisual();
        this.updateHeldTool();
      } else if (this.lastResourceType && !this.callbacks.isStorageFull(this.lastResourceType)) {
        const next = this.callbacks.findNearestResourceOfType(
          this.lastResourceType,
          this.x,
          this.y,
          750
        );
        if (next) {
          this.targetNode = next;
          this.state = 'MOVING_TO_RESOURCE';
        } else {
          this.targetNode = null;
          this.state = 'IDLE_WANDER';
          this.idleWaitTimer = 5000;
        }
        this.updateHeldTool();
      } else {
        this.targetNode = null;
        this.state = 'IDLE_WANDER';
        this.idleWaitTimer = 5000;
        this.updateHeldTool();
      }
      this.resetPose();
      return;
    }

    if (this.callbacks.isStorageFull(this.targetNode.resourceType)) {
      this.clearProgressBar();
      if (this.carryAmount > 0) {
        this.state = 'RETURNING';
        this.updateCarryVisual();
        this.updateHeldTool();
      } else {
        this.stopWorkStorageFull();
      }
      return;
    }

    this.setHeading(this.targetNode.x - this.x, this.targetNode.y - this.y);
    const isHeavy =
      this.targetNode.resourceType === 'wood' || this.targetNode.resourceType === 'stone';
    this.actionTimer += delta * this.getWorkMultiplier(isHeavy);

    const swingP = Phaser.Math.Clamp(this.actionTimer / this.strikeIntervalMs, 0, 1);
    let armAngle = 0;
    if (swingP < 0.45) {
      armAngle = Phaser.Math.Linear(-15, -62, swingP / 0.45);
    } else if (swingP < 0.85) {
      armAngle = Phaser.Math.Linear(-62, 48, (swingP - 0.45) / 0.4);
    } else {
      armAngle = Phaser.Math.Linear(48, -10, (swingP - 0.85) / 0.15);
    }
    this.frontArmGroup.setAngle(armAngle);
    this.backArm.setAngle(-armAngle * 0.35);
    this.torso.setAngle(armAngle * 0.14);
    this.rig.y = -Math.abs(Math.sin(swingP * Math.PI)) * 2;

    const totalProgress = Phaser.Math.Clamp(
      (this.carryAmount * this.strikeIntervalMs + this.actionTimer) /
        (this.carryCapacity * this.strikeIntervalMs),
      0,
      1
    );
    this.drawProgressBar(totalProgress, 0x70e000);

    if (this.actionTimer >= this.strikeIntervalMs) {
      this.actionTimer = 0;
      const resType = this.targetNode.resourceType;
      const harvested = this.targetNode.harvest(1);
      if (harvested > 0) {
        this.targetNode.spawnHitParticles();
        this.playGatherSound(resType);
        this.carrying = resType;
        this.carryVisual = resType;
        this.carryAmount += harvested;
        if (resType === 'wood') {
          this.deeds.woodGathered += harvested;
          this.gainProfessionXp('lumberjack', 3);
        } else if (resType === 'stone') {
          this.deeds.stoneGathered += harvested;
          this.gainProfessionXp('miner', 3);
        } else {
          this.deeds.foodGathered += harvested;
        }
      }

      if (this.carryAmount >= this.carryCapacity || this.targetNode.isDepleted()) {
        this.clearProgressBar();
        this.resetPose();
        this.state = 'RETURNING';
        this.updateCarryVisual();
        this.updateHeldTool();
      }
    }
  }

  private handleFishing(delta: number): void {
    if (!this.targetLake || !this.targetLake.isFishable()) {
      this.clearProgressBar();
      this.setWadingVisual(false);
      if (this.carryAmount > 0) {
        this.state = 'RETURNING';
        this.updateCarryVisual();
        this.updateHeldTool();
      } else {
        this.targetLake = null;
        this.lakeWadeSpot = null;
        this.showTemporaryBubble('❄️', 1600);
        this.state = 'IDLE_WANDER';
        this.idleWaitTimer = 5000;
        this.updateHeldTool();
      }
      this.resetPose();
      return;
    }

    if (this.callbacks.isStorageFull('food')) {
      this.clearProgressBar();
      this.setWadingVisual(false);
      if (this.carryAmount > 0) {
        this.state = 'RETURNING';
        this.updateCarryVisual();
        this.updateHeldTool();
      } else {
        this.stopWorkStorageFull();
      }
      return;
    }

    this.setWadingVisual(true);
    this.setHeading(this.targetLake.x - this.x, this.targetLake.y - this.y);
    this.actionTimer += delta * this.getWorkMultiplier(false, 'fisher');

    const swingP = Phaser.Math.Clamp(this.actionTimer / this.fishIntervalMs, 0, 1);
    if (!this.hasCraftedTools) {
      // Unique bare-hand wading scoop animation: crouch hands in water -> rapid upward catch
      if (swingP < 0.52) {
        const searchSway = Math.sin(swingP * Math.PI * 4) * 14;
        this.frontArmGroup.setAngle(-34 + searchSway);
        this.backArm.setAngle(-30 - searchSway);
        this.torso.setAngle(10);
        this.rig.y = 4;
      } else if (swingP < 0.78) {
        const p = (swingP - 0.52) / 0.26;
        const scoop = Phaser.Math.Linear(-34, 48, p);
        this.frontArmGroup.setAngle(scoop);
        this.backArm.setAngle(-scoop * 0.85);
        this.torso.setAngle(-6);
        this.rig.y = -4 * Math.sin(p * Math.PI);
      } else {
        this.frontArmGroup.setAngle(12);
        this.backArm.setAngle(-12);
        this.torso.setAngle(2);
        this.rig.y = 1;
      }
    } else {
      // Crafted fishing spear strike animation
      let armAngle = -20;
      if (swingP < 0.6) {
        armAngle = Phaser.Math.Linear(-20, -64, swingP / 0.6);
      } else if (swingP < 0.88) {
        armAngle = Phaser.Math.Linear(-64, 34, (swingP - 0.6) / 0.28);
      } else {
        armAngle = Phaser.Math.Linear(34, -20, (swingP - 0.88) / 0.12);
      }
      this.frontArmGroup.setAngle(armAngle);
      this.backArm.setAngle(-armAngle * 0.28);
      this.torso.setAngle(armAngle * 0.12);
      this.rig.y = -Math.abs(Math.sin(swingP * Math.PI)) * 1.8;
    }

    const totalProgress = Phaser.Math.Clamp(
      (this.carryAmount * this.fishIntervalMs + this.actionTimer) /
        (this.carryCapacity * this.fishIntervalMs),
      0,
      1
    );
    this.drawProgressBar(totalProgress, 0x38bdf8);

    if (this.actionTimer >= this.fishIntervalMs) {
      this.actionTimer = 0;
      const sx = Phaser.Math.Linear(this.x, this.targetLake.x, 0.22);
      const sy = Phaser.Math.Linear(this.y, this.targetLake.y, 0.22);
      this.targetLake.spawnSplashAt(sx, sy);
      SoundFX.playSplash();

      this.carrying = 'food';
      this.carryVisual = 'fish';
      this.carryAmount += 1;
      this.deeds.fishCaught += 1;
      this.gainProfessionXp('fisher', 4);

      if (this.carryAmount >= this.carryCapacity) {
        this.clearProgressBar();
        this.resetPose();
        this.state = 'RETURNING';
        this.updateCarryVisual();
        this.updateHeldTool();
      }
    }
  }

  private handleHunting(delta: number, dt: number): void {
    if (!this.targetAnimal || !this.targetAnimal.isAlive()) {
      this.clearProgressBar();
      this.resetPose();
      if (this.carryAmount > 0) {
        this.state = 'RETURNING';
        this.updateCarryVisual();
      } else {
        this.targetAnimal = null;
        this.state = 'IDLE_WANDER';
        this.idleWaitTimer = 3500;
      }
      this.updateHeldTool();
      return;
    }

    if (this.callbacks.isStorageFull('food')) {
      this.clearProgressBar();
      this.stopWorkStorageFull();
      return;
    }

    const range =
      this.equippedWeapon === 'bow' ? 195 : this.hasCraftedTools ? 105 : 74;
    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.targetAnimal.x,
      this.targetAnimal.y
    );

    if (dist > range + 85) {
      this.state = 'MOVING_TO_HUNT';
      return;
    }

    // Continuously pursue fleeing prey while attacking on the move!
    if (dist > range * 0.68) {
      this.moveToward(this.targetAnimal.x, this.targetAnimal.y, dt, range * 0.5, 1.2);
    } else {
      this.setHeading(this.targetAnimal.x - this.x, this.targetAnimal.y - this.y);
    }

    this.actionTimer += delta * this.getWorkMultiplier(false, 'hunter');

    const p = Phaser.Math.Clamp(this.actionTimer / this.huntIntervalMs, 0, 1);
    const throwAngle =
      p < 0.5 ? Phaser.Math.Linear(-20, -78, p / 0.5) : Phaser.Math.Linear(-78, 52, (p - 0.5) / 0.5);
    this.frontArmGroup.setAngle(throwAngle);
    this.backArm.setAngle(-throwAngle * 0.3);
    this.torso.setAngle(throwAngle * 0.14);
    this.drawProgressBar(p, 0xef4444);

    if (this.actionTimer >= this.huntIntervalMs) {
      this.actionTimer = 0;
      const animal = this.targetAnimal;
      const tech = this.callbacks.getTechLevels();
      const weaponMult = [1, 1.2, 1.45, 1.75][tech.weapons] ?? 1;
      const baseDmg =
        this.equippedWeapon === 'bow'
          ? 16
          : this.equippedWeapon
            ? WEAPON_DEFS[this.equippedWeapon].damage
            : this.hasCraftedTools
              ? 20
              : 13;
      const dmg = Math.round(baseDmg * weaponMult);

      const texKey =
        this.equippedWeapon === 'bow'
          ? 'projectile-arrow'
          : this.hasCraftedTools
            ? 'projectile-spear'
            : 'projectile-stone';
      if (this.equippedWeapon === 'bow') SoundFX.playBowShot();
      else SoundFX.playThrow();

      const proj = this.scene.add.image(this.x, this.y - 22, texKey);
      proj.setDepth(Math.max(this.y, animal.y) + 40);
      proj.setRotation(Phaser.Math.Angle.Between(this.x, this.y - 22, animal.x, animal.y - 16));
      this.scene.tweens.add({
        targets: proj,
        x: animal.x,
        y: animal.y - 16,
        duration: 150,
        ease: 'Linear',
        onComplete: () => proj.destroy()
      });

      const killed = animal.takeDamage(dmg, this.x, this.y);
      this.gainProfessionXp('hunter', 5);

      if (killed) {
        this.clearProgressBar();
        this.deeds.animalsHunted += 1;
        this.gainProfessionXp('hunter', 12);
        const carcass = this.callbacks.getNearestCarcass(animal.x, animal.y, 95);
        this.targetAnimal = null;
        this.resetPose();
        if (carcass) {
          this.targetCarcass = carcass;
          this.state = 'MOVING_TO_CARCASS';
        } else {
          this.carrying = 'food';
          this.carryVisual = 'meat';
          this.carryAmount = Math.min(this.carryCapacity, animal.meatYield);
          this.state = 'RETURNING';
          this.updateCarryVisual();
        }
        this.updateHeldTool();
      }
    }
  }

  private handleMovingToCarcass(dt: number): void {
    this.clearProgressBar();
    if (!this.targetCarcass || !this.targetCarcass.scene || this.targetCarcass.isEmpty()) {
      this.targetCarcass = null;
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 3500;
      this.resetPose();
      this.updateHeldTool();
      return;
    }

    const nextType = this.targetCarcass.getNextAvailableType((t) => this.callbacks.isStorageFull(t));
    if (!nextType) {
      this.stopWorkStorageFull();
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.targetCarcass.x,
      this.targetCarcass.y
    );
    const arrived =
      dist <= this.targetCarcass.interactRadius ||
      this.moveToward(
        this.targetCarcass.x,
        this.targetCarcass.y,
        dt,
        this.targetCarcass.arrivalRadius
      );

    if (arrived) {
      this.resetPose();
      this.actionTimer = 0;
      this.state = 'BUTCHERING';
      this.updateHeldTool();
    }
  }

  private handleButchering(delta: number): void {
    if (!this.targetCarcass || !this.targetCarcass.scene || this.targetCarcass.isEmpty()) {
      this.clearProgressBar();
      if (this.carryAmount > 0) {
        this.state = 'RETURNING';
        this.updateCarryVisual();
      } else {
        this.targetCarcass = null;
        this.state = 'IDLE_WANDER';
        this.idleWaitTimer = 3500;
      }
      this.resetPose();
      this.updateHeldTool();
      return;
    }

    const activeType =
      this.carrying &&
      (this.carrying === 'food' || this.carrying === 'bone' || this.carrying === 'hide') &&
      this.targetCarcass.getAmount(this.carrying) > 0 &&
      !this.callbacks.isStorageFull(this.carrying)
        ? this.carrying
        : this.targetCarcass.getNextAvailableType((t) => this.callbacks.isStorageFull(t));

    if (!activeType) {
      this.clearProgressBar();
      if (this.carryAmount > 0) {
        this.state = 'RETURNING';
        this.updateCarryVisual();
      } else {
        this.stopWorkStorageFull();
      }
      return;
    }

    if (this.carrying && this.carrying !== activeType && this.carryAmount > 0) {
      this.clearProgressBar();
      this.state = 'RETURNING';
      this.updateCarryVisual();
      return;
    }

    this.setHeading(this.targetCarcass.x - this.x, this.targetCarcass.y - this.y);
    this.actionTimer += delta * this.getWorkMultiplier(false, 'hunter');

    const p = Phaser.Math.Clamp(this.actionTimer / 650, 0, 1);
    const armAngle = -24 + Math.sin(p * Math.PI * 2) * 32;
    this.frontArmGroup.setAngle(armAngle);
    this.backArm.setAngle(-armAngle * 0.4);
    this.torso.setAngle(8);
    this.rig.y = 2;

    const totalP = Phaser.Math.Clamp(
      (this.carryAmount * 650 + this.actionTimer) / (this.carryCapacity * 650),
      0,
      1
    );
    this.drawProgressBar(totalP, activeType === 'bone' ? 0xfef08a : activeType === 'hide' ? 0xd99b66 : 0xef4444);

    if (this.actionTimer >= 650) {
      this.actionTimer = 0;
      const got = this.targetCarcass.harvest(activeType, 1);
      if (got > 0) {
        this.targetCarcass.spawnHarvestChips();
        SoundFX.playForage();
        this.carrying = activeType;
        this.carryVisual = activeType === 'food' ? 'meat' : activeType;
        this.lastResourceType = activeType;
        this.carryAmount += got;
        if (activeType === 'food') this.deeds.foodGathered += got;
        else if (activeType === 'bone') this.deeds.boneGathered += got;
        else this.deeds.hideGathered += got;
        this.gainProfessionXp('hunter', 2);
      }

      if (
        this.carryAmount >= this.carryCapacity ||
        this.targetCarcass.isEmpty() ||
        this.targetCarcass.getAmount(activeType) <= 0
      ) {
        this.clearProgressBar();
        this.resetPose();
        this.state = 'RETURNING';
        this.updateCarryVisual();
        this.updateHeldTool();
      }
    }
  }

  private handleBuilding(delta: number): void {
    if (!this.targetBuild || !this.targetBuild.scene || this.targetBuild.isComplete()) {
      this.clearProgressBar();
      this.targetBuild = null;
      this.buildSpot = null;
      this.resetPose();
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 5000;
      this.updateHeldTool();
      return;
    }

    this.setHeading(this.targetBuild.x - this.x, this.targetBuild.y - this.y);
    this.actionTimer += delta * this.getWorkMultiplier(true, 'builder');

    const swingP = Phaser.Math.Clamp(this.actionTimer / this.strikeIntervalMs, 0, 1);
    let armAngle = 0;
    if (swingP < 0.45) {
      armAngle = Phaser.Math.Linear(-15, -66, swingP / 0.45);
    } else if (swingP < 0.85) {
      armAngle = Phaser.Math.Linear(-66, 42, (swingP - 0.45) / 0.4);
    } else {
      armAngle = Phaser.Math.Linear(42, -10, (swingP - 0.85) / 0.15);
    }
    this.frontArmGroup.setAngle(armAngle);
    this.backArm.setAngle(-armAngle * 0.35);
    this.torso.setAngle(armAngle * 0.12);
    this.rig.y = -Math.abs(Math.sin(swingP * Math.PI)) * 2;

    this.drawProgressBar(this.targetBuild.getProgress() / 100, 0xfbbf24);

    if (this.actionTimer >= this.strikeIntervalMs) {
      this.actionTimer = 0;
      SoundFX.playHammer();
      const finished = this.targetBuild.addBuildWork(10);
      this.gainProfessionXp('builder', 4);
      if (finished) {
        this.deeds.buildingsBuilt += 1;
        this.gainProfessionXp('builder', 10);
        this.clearProgressBar();
        this.targetBuild = null;
        this.buildSpot = null;
        this.resetPose();
        this.state = 'IDLE_WANDER';
        this.idleWaitTimer = 5000;
        this.updateHeldTool();
      }
    }
  }

  private handleWorkingStation(delta: number): void {
    if (!this.workBuilding || !this.workBuilding.scene || !this.workBuilding.isComplete()) {
      this.clearProgressBar();
      this.unassignFromBuilding();
      this.resetPose();
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 4000;
      this.updateHeldTool();
      return;
    }

    const prof = this.workBuilding.profession;
    this.activeProfession = prof;
    this.setHeading(this.workBuilding.x - this.x, this.workBuilding.y - this.y);

    if (this.workBuilding.buildingType === 'gatherer_hut') {
      const task = this.callbacks.findGathererTask(this.workBuilding, this);
      if (task?.clearNode) {
        this.targetNode = task.clearNode;
        this.lastResourceType = task.clearNode.resourceType;
        this.state = 'MOVING_TO_RESOURCE';
        this.updateHeldTool();
        return;
      }
      if (task?.carcass) {
        this.targetCarcass = task.carcass;
        this.state = 'MOVING_TO_CARCASS';
        this.updateHeldTool();
        return;
      }
      if (task?.gatherNode) {
        this.targetNode = task.gatherNode;
        this.lastResourceType = task.gatherNode.resourceType;
        this.state = 'MOVING_TO_RESOURCE';
        this.updateHeldTool();
        return;
      }
      this.workBuilding.statusNote = 'Поруч усе зібрано';
      this.clearProgressBar();
      return;
    }

    if (
      this.workBuilding.buildingType === 'workshop' ||
      this.workBuilding.buildingType === 'armory'
    ) {
      const plan = this.callbacks.canStationCraftNext(this.workBuilding);
      this.workBuilding.statusNote = plan.statusText;
      if (!plan.canWork) {
        this.clearProgressBar();
        this.frontArmGroup.setAngle(-8);
        this.backArm.setAngle(6);
        this.torso.setAngle(0);
        return;
      }
    } else if (this.workBuilding.buildingType === 'watchtower') {
      if (!this.warriorClass) {
        this.clearProgressBar();
        this.unassignFromBuilding();
        this.resetPose();
        this.state = 'IDLE_WANDER';
        this.updateHeldTool();
        return;
      }
      // Stay garrisoned atop Watchtower permanently: building shoots bows & absorbs damage first!
      this.clearProgressBar();
      this.x = this.workBuilding.x;
      this.y = this.workBuilding.y + 2;
      this.toolSprite.setTexture('tool-bow').setVisible(true);
      this.frontArmGroup.setAngle(-26);
      this.backArm.setAngle(-12);
      this.torso.setAngle(0);
      this.workBuilding.statusNote = `🏹 На посту: ${this.villagerName} (стріляє з лука)`;
      return;
    }

    const cycleLen =
      this.workBuilding.buildingType === 'armory' ? 3400 : this.workCycleMs;
    this.actionTimer += delta * this.getWorkMultiplier(false, prof, prof === 'crafter' || prof === 'armorer');

    const p = Phaser.Math.Clamp(this.actionTimer / cycleLen, 0, 1);
    const wave = Math.sin(p * Math.PI * 6);
    if (this.workBuilding.buildingType === 'totem') {
      this.frontArmGroup.setAngle(-54 + wave * 12);
      this.backArm.setAngle(-46 - wave * 12);
      this.torso.setAngle(wave * 4);
    } else {
      this.frontArmGroup.setAngle(-34 + wave * 28);
      this.backArm.setAngle(-wave * 10);
      this.torso.setAngle(wave * 5);
    }
    this.drawProgressBar(p, this.workBuilding.buildingType === 'totem' ? 0x22d3ee : 0xfbbf24);

    if (this.actionTimer >= cycleLen) {
      this.actionTimer = 0;
      if (prof) {
        this.gainProfessionXp(prof, 10);
      }
      if (
        this.workBuilding.buildingType === 'workshop' ||
        this.workBuilding.buildingType === 'armory'
      ) {
        this.deeds.toolsCrafted += 1;
        SoundFX.playCraft();
      } else if (this.workBuilding.buildingType === 'totem') {
        this.deeds.knowledgeGenerated += 6;
      }
      this.callbacks.onStationCycleComplete(this, this.workBuilding);
    }
  }

  private handleFleeingToCampfire(delta: number, dt: number): void {
    this.clearProgressBar();
    const rally = this.callbacks.getArmoryOrStoragePoint();
    const dist = Phaser.Math.Distance.Between(this.x, this.y, rally.x, rally.y);
    const arrived = dist <= 46 || this.moveToward(rally.x, rally.y, dt, 34, 1.28);

    if (arrived) {
      this.callbacks.tryBorrowDefenseGear(this);
      this.updateHeldTool();

      const hostile =
        this.combatTarget && this.combatTarget.isAlive()
          ? this.combatTarget
          : this.callbacks.findNearestHostile(this.x, this.y, 580);
      if (hostile && (this.equippedWeapon || Phaser.Math.Distance.Between(this.x, this.y, hostile.x, hostile.y) <= 220)) {
        this.combatTarget = hostile;
        this.state = 'COMBAT_CHASE';
        this.updateHeldTool();
        return;
      }

      this.resetPose();
      this.rallyWaitTimer -= delta;
      if (this.rallyWaitTimer <= 0 && !this.callbacks.isDefenseAlarmActive()) {
        if (this.isMilitiaArmed) {
          this.callbacks.returnBorrowedDefenseGear(this);
        }
        this.combatTarget = null;
        this.hideBubble();
        this.finishEatingAndResume();
      }
    }
  }

  private handleGrabbingGear(delta: number, dt: number): void {
    this.clearProgressBar();
    const rally = this.callbacks.getArmoryOrStoragePoint();
    const dist = Phaser.Math.Distance.Between(this.x, this.y, rally.x, rally.y);
    const arrived = dist <= 46 || this.moveToward(rally.x, rally.y, dt, 34, 1.24);

    if (arrived) {
      this.callbacks.tryBorrowDefenseGear(this);
      this.updateHeldTool();
      const hostile =
        this.combatTarget && this.combatTarget.isAlive()
          ? this.combatTarget
          : this.callbacks.findNearestHostile(this.x, this.y, 1200);
      if (hostile) {
        this.combatTarget = hostile;
        this.state = 'COMBAT_CHASE';
        this.updateHeldTool();
        return;
      }

      this.resetPose();
      this.rallyWaitTimer -= delta;
      if (this.rallyWaitTimer <= 0 && !this.callbacks.isDefenseAlarmActive()) {
        if (this.isMilitiaArmed) {
          this.callbacks.returnBorrowedDefenseGear(this);
        }
        this.combatTarget = null;
        this.hideBubble();
        this.finishEatingAndResume();
      }
    }
  }

  private getCombatWeaponStats(): { damage: number; range: number; cooldownMs: number; ranged: boolean } {
    const tech = this.callbacks.getTechLevels();
    const weaponMult = [1, 1.2, 1.45, 1.75][tech.weapons] ?? 1;
    const warriorBonus = this.warriorClass ? 1 + (this.getSkillLevel('warrior') - 1) * 0.14 : 1;

    if (this.equippedWeapon) {
      const def = WEAPON_DEFS[this.equippedWeapon];
      return {
        damage: Math.round(def.damage * weaponMult * warriorBonus),
        range: def.range,
        cooldownMs: def.cooldownMs,
        ranged: def.ranged
      };
    }

    return {
      damage: Math.round((this.hasCraftedTools ? 11 : 7) * weaponMult),
      range: 46,
      cooldownMs: 780,
      ranged: false
    };
  }

  private handleCombatChase(dt: number): void {
    this.clearProgressBar();
    if (!this.combatTarget || !this.combatTarget.isAlive()) {
      const next = this.callbacks.findNearestHostile(this.x, this.y, 520);
      if (next) {
        this.combatTarget = next;
      } else {
        this.exitCombatToResume();
        return;
      }
    }

    const wStats = this.getCombatWeaponStats();
    const targetPad = this.combatTarget.id.startsWith('camp-') ? 50 : 0;
    const effRange = wStats.range + targetPad;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.combatTarget.x, this.combatTarget.y);
    const arrived =
      dist <= effRange ||
      this.moveToward(this.combatTarget.x, this.combatTarget.y, dt, Math.max(24, effRange - 10), 1.18);

    if (arrived) {
      this.resetPose();
      this.state = 'COMBAT_ATTACK';
      this.updateHeldTool();
    }
  }

  private handleCombatAttack(_delta: number, dt: number): void {
    if (!this.combatTarget || !this.combatTarget.isAlive()) {
      const next = this.callbacks.findNearestHostile(this.x, this.y, 520);
      if (next) {
        this.combatTarget = next;
        this.state = 'COMBAT_CHASE';
      } else {
        this.exitCombatToResume();
      }
      return;
    }

    const wStats = this.getCombatWeaponStats();
    const targetPad = this.combatTarget.id.startsWith('camp-') ? 50 : 0;
    const effRange = wStats.range + targetPad;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.combatTarget.x, this.combatTarget.y);
    if (dist > effRange + 16) {
      this.state = 'COMBAT_CHASE';
      return;
    }

    this.setHeading(this.combatTarget.x - this.x, this.combatTarget.y - this.y);
    if (this.attackCooldownTimer > 0) {
      const t = Math.max(0, this.attackCooldownTimer / wStats.cooldownMs);
      this.frontArmGroup.setAngle(-12 - t * 34);
      return;
    }

    this.attackCooldownTimer = wStats.cooldownMs;
    this.frontArmGroup.setAngle(44);
    this.torso.setAngle(7);
    this.scene.time.delayedCall(120, () => {
      if (this.scene && !this.isDying) {
        this.frontArmGroup.setAngle(-10);
        this.torso.setAngle(0);
      }
    });

    if (wStats.ranged) {
      SoundFX.playBowShot();
      const arrow = this.scene.add.image(this.x, this.y - 22, 'projectile-arrow');
      arrow.setDepth(Math.max(this.y, this.combatTarget.y) + 40);
      arrow.setRotation(
        Phaser.Math.Angle.Between(this.x, this.y - 22, this.combatTarget.x, this.combatTarget.y - 16)
      );
      const tx = this.combatTarget.x;
      const ty = this.combatTarget.y - 16;
      this.scene.tweens.add({
        targets: arrow,
        x: tx,
        y: ty,
        duration: 165,
        onComplete: () => arrow.destroy()
      });
    } else {
      SoundFX.playCombatHit();
      if (dist > 36) {
        this.moveToward(this.combatTarget.x, this.combatTarget.y, dt, 26, 1.15);
      }
    }

    const hit = this.combatTarget;
    const killed = hit.takeDamage(wStats.damage, this.x, this.y, this);
    this.gainProfessionXp('warrior', 4);
    if (killed) {
      this.deeds.enemiesSlain += 1;
      this.gainProfessionXp('warrior', 10);
      this.combatTarget = null;
      const next = this.callbacks.findNearestHostile(this.x, this.y, 540);
      if (next) {
        this.combatTarget = next;
        this.state = 'COMBAT_CHASE';
      } else {
        this.exitCombatToResume();
      }
    }
  }

  private exitCombatToResume(): void {
    this.combatTarget = null;
    this.hideBubble();
    if (this.isMilitiaArmed) {
      this.callbacks.returnBorrowedDefenseGear(this);
    }
    this.resetPose();
    if (this.assignedBuilding && this.assignedBuilding.scene && this.assignedBuilding.isComplete()) {
      this.workBuilding = this.assignedBuilding;
      this.activeProfession = this.assignedProfession;
      this.state = 'MOVING_TO_WORK';
      this.updateHeldTool();
      return;
    }
    if (this.warriorClass) {
      this.state = 'PATROLLING';
      this.updateHeldTool();
      return;
    }
    if (this.isFreeTime) {
      this.state = 'FREE_TIME';
      this.updateHeldTool();
      return;
    }
    this.finishEatingAndResume();
  }

  private handlePatrolling(delta: number, dt: number): void {
    this.clearProgressBar();
    if (this.isGarrisonedInWatchtower()) {
      this.workBuilding = this.assignedBuilding;
      this.activeProfession = this.assignedProfession;
      this.state = 'MOVING_TO_WORK';
      this.updateHeldTool();
      return;
    }
    if (!this.warriorClass) {
      this.state = 'IDLE_WANDER';
      return;
    }

    this.combatScanTimer -= delta;
    if (this.combatScanTimer <= 0) {
      this.combatScanTimer = 280;
      const hostile = this.callbacks.findNearestHostile(this.x, this.y, 440);
      if (hostile) {
        this.issueCombatOrder(hostile);
        return;
      }
    }

    const anchorX = this.patrolAnchor ? this.patrolAnchor.x : this.campfire.x;
    const anchorY = this.patrolAnchor ? this.patrolAnchor.y : this.campfire.y + 46;
    if (this.moveTarget) {
      const arrived = this.moveToward(this.moveTarget.x, this.moveTarget.y, dt, 10, 0.72);
      if (arrived) {
        this.moveTarget = null;
        this.idleWaitTimer = Phaser.Math.Between(1600, 3200);
        this.resetPose();
      }
    } else {
      this.resetPose();
      this.idleWaitTimer -= delta;
      if (this.idleWaitTimer <= 0) {
        const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
        const r = Phaser.Math.Between(42, 130);
        this.moveTarget = new Phaser.Math.Vector2(anchorX + Math.cos(a) * r, anchorY + Math.sin(a) * r);
      }
    }
  }

  private handleDyingLying(delta: number): void {
    this.dyingTimer -= delta;
    this.dyingBubbleTimer -= delta;
    if (this.dyingBubbleTimer <= 0) {
      this.dyingBubbleTimer = 2600;
      this.showBubble(Phaser.Math.RND.pick(['🕯️', '💬', '❤️']));
    }
    if (this.dyingTimer <= 0) {
      for (const other of [...this.callbacks.getVillagers()]) {
        if (other !== this && other.mournTarget === this) {
          other.finishMourning();
        }
      }
      const record: AncestorRecord = {
        id: this.id,
        name: this.villagerName,
        gender: this.gender,
        appearance: this.appearance,
        familyName: this.familyName,
        bornYear: this.bornYear,
        diedYear: this.callbacks.getYear(),
        ageAtDeath: this.age,
        wasChief: this.isChief,
        topProfessionLabel: this.getTopProfession().label,
        topProfessionLevel: this.getTopProfession().level,
        biographyUk: this.buildBiographyUk(this.callbacks.getYear())
      };
      this.callbacks.onVillagerDied(this, record);
    }
  }

  private handleMovingToMourn(dt: number): void {
    this.clearProgressBar();
    if (!this.mournTarget || !this.mournTarget.scene || !this.mournSpot) {
      this.finishMourning();
      return;
    }
    const dist = Phaser.Math.Distance.Between(this.x, this.y, this.mournSpot.x, this.mournSpot.y);
    const arrived =
      dist <= 18 ||
      this.moveToward(this.mournSpot.x, this.mournSpot.y, dt, 10, 1.15, this.mournTarget);
    if (arrived) {
      this.resetPose();
      this.state = 'MOURNING_SITTING';
      this.mournBubbleTimer = 200;
    }
  }

  private handleMourningSitting(delta: number): void {
    if (!this.mournTarget || !this.mournTarget.scene) {
      this.finishMourning();
      return;
    }
    this.setHeading(this.mournTarget.x - this.x, this.mournTarget.y - this.y);
    this.rig.y = 8;
    this.leftLeg.setAngle(48);
    this.rightLeg.setAngle(-42);
    this.frontArmGroup.setAngle(-18);
    this.backArm.setAngle(14);
    this.mournBubbleTimer -= delta;
    if (this.mournBubbleTimer <= 0) {
      this.mournBubbleTimer = Phaser.Math.Between(1800, 2600);
      this.showBubble(Phaser.Math.RND.pick(MOURN_EMOJIS));
    }
  }

  private handleReturning(dt: number): void {
    this.clearProgressBar();
    const dropType: ResourceType = this.carrying ?? this.lastResourceType ?? 'wood';
    const dropPoint = this.callbacks.getStoragePoint(dropType);

    const inWater = Boolean(
      this.targetLake && this.targetLake.isPointInsideClickArea(this.x, this.y)
    );
    this.setWadingVisual(inWater);

    const dist = Phaser.Math.Distance.Between(this.x, this.y, dropPoint.x, dropPoint.y);
    const arrived =
      dist <= 48 ||
      this.moveToward(
        dropPoint.x,
        dropPoint.y,
        dt,
        32,
        inWater ? 0.85 : 1,
        inWater ? this.targetLake ?? undefined : undefined
      );

    if (arrived) {
      this.setWadingVisual(false);
      this.resetPose();
      if (this.carrying && this.carryAmount > 0) {
        this.callbacks.onDepositResource(
          this.carrying,
          this.carryAmount,
          dropPoint.x,
          dropPoint.y - 28
        );
        SoundFX.playDeposit();
      }
      const depositedType = this.carrying ?? this.lastResourceType;
      this.carrying = null;
      this.carryVisual = null;
      this.carryAmount = 0;
      this.updateCarryVisual();
      this.updateHeldTool();

      if (
        this.targetCarcass &&
        this.targetCarcass.scene &&
        !this.targetCarcass.isEmpty() &&
        this.targetCarcass.getNextAvailableType((t) => this.callbacks.isStorageFull(t))
      ) {
        this.state = 'MOVING_TO_CARCASS';
        this.updateHeldTool();
        return;
      }

      if (
        this.assignedBuilding &&
        this.assignedBuilding.isComplete() &&
        this.assignedBuilding.buildingType === 'gatherer_hut'
      ) {
        this.workBuilding = this.assignedBuilding;
        this.activeProfession = 'gatherer';
        this.state = 'MOVING_TO_WORK';
        this.updateHeldTool();
        return;
      }

      if (depositedType && this.callbacks.isStorageFull(depositedType)) {
        this.stopWorkStorageFull();
        return;
      }

      if (this.targetLake && this.targetLake.isFishable()) {
        const spot = this.targetLake.getWadeSpotFor(this.x, this.y);
        this.lakeWadeSpot = new Phaser.Math.Vector2(spot.x, spot.y);
        this.state = 'MOVING_TO_LAKE';
        this.updateHeldTool();
      } else if (this.targetNode && this.targetNode.scene && !this.targetNode.isDepleted()) {
        this.state = 'MOVING_TO_RESOURCE';
        this.updateHeldTool();
      } else if (depositedType) {
        const refX = this.targetNode ? this.targetNode.x : this.x;
        const refY = this.targetNode ? this.targetNode.y : this.y;
        const next = this.callbacks.findNearestResourceOfType(depositedType, refX, refY, 750);
        if (next) {
          this.targetNode = next;
          this.state = 'MOVING_TO_RESOURCE';
          this.updateHeldTool();
        } else if (depositedType === 'food') {
          const lake = this.callbacks.getLake();
          if (lake && lake.isFishable()) {
            this.targetNode = null;
            this.targetLake = lake;
            const spot = lake.getWadeSpotFor(this.x, this.y);
            this.lakeWadeSpot = new Phaser.Math.Vector2(spot.x, spot.y);
            this.state = 'MOVING_TO_LAKE';
            this.updateHeldTool();
          } else {
            this.targetNode = null;
            this.targetLake = null;
            this.targetCarcass = null;
            this.lastResourceType = null;
            this.state = this.isFreeTime ? 'FREE_TIME' : 'IDLE_WANDER';
            this.idleWaitTimer = 5000;
          }
        } else {
          this.targetNode = null;
          this.targetLake = null;
          this.targetCarcass = null;
          this.lastResourceType = null;
          this.state = this.isFreeTime ? 'FREE_TIME' : 'IDLE_WANDER';
          this.idleWaitTimer = 5000;
        }
      } else {
        this.targetNode = null;
        this.targetLake = null;
        this.targetCarcass = null;
        this.state = this.isFreeTime ? 'FREE_TIME' : 'IDLE_WANDER';
        this.idleWaitTimer = 5000;
      }
    }
  }

  private stopWorkStorageFull(): void {
    this.setWadingVisual(false);
    this.targetNode = null;
    this.targetLake = null;
    this.lakeWadeSpot = null;
    this.targetAnimal = null;
    this.targetCarcass = null;
    this.lastResourceType = null;
    this.clearSavedWork();
    this.clearProgressBar();
    this.resetPose();
    this.showTemporaryBubble('📦', 1600);
    this.state = 'IDLE_WANDER';
    this.idleWaitTimer = 5000;
    this.updateHeldTool();
  }

  private handleMovingToEatStorage(dt: number): void {
    this.clearProgressBar();
    if (!this.callbacks.hasFoodInStorage()) {
      const bush = this.callbacks.findNearestBerryBush(this.x, this.y);
      if (bush) {
        this.targetNode = bush;
        this.state = 'MOVING_TO_RESOURCE';
        return;
      }
      this.finishEatingAndResume();
      return;
    }

    const foodDepot = this.callbacks.getStoragePoint('food');
    const dist = Phaser.Math.Distance.Between(this.x, this.y, foodDepot.x, foodDepot.y);
    const arrived = dist <= 46 || this.moveToward(foodDepot.x, foodDepot.y, dt, 32);
    if (arrived) {
      this.resetPose();
      this.actionTimer = 0;
      this.state = 'EATING_STORAGE';
      this.showBubble('🍖');
    }
  }

  private handleEatingStorage(delta: number): void {
    this.actionTimer += delta;
    this.rig.scaleY = 0.95 + Math.sin(this.actionTimer * 0.015) * 0.05;
    const progress = Phaser.Math.Clamp(this.actionTimer / this.eatDurationMs, 0, 1);
    this.drawProgressBar(progress, 0xff9f1c);

    if (this.actionTimer >= this.eatDurationMs) {
      this.actionTimer = 0;
      this.clearProgressBar();
      this.hideBubble();
      if (this.callbacks.consumeStorageFood()) {
        this.stats.satiety = Math.min(100, this.stats.satiety + 55);
        this.stats.health = Math.min(this.maxHealth, this.stats.health + 12);
        SoundFX.playEat();
      }
      this.finishEatingAndResume();
    }
  }

  private handleEatingBerries(delta: number): void {
    if (!this.targetNode || !this.targetNode.scene || this.targetNode.isDepleted()) {
      this.clearProgressBar();
      this.hideBubble();
      this.finishEatingAndResume();
      return;
    }

    this.setHeading(this.targetNode.x - this.x, this.targetNode.y - this.y);
    this.showBubble('🫐');
    this.actionTimer += delta;
    this.rig.scaleY = 0.94 + Math.sin(this.actionTimer * 0.015) * 0.06;
    const progress = Phaser.Math.Clamp(this.actionTimer / this.eatDurationMs, 0, 1);
    this.drawProgressBar(progress, 0xff9f1c);

    if (this.actionTimer >= this.eatDurationMs) {
      this.actionTimer = 0;
      this.clearProgressBar();
      this.hideBubble();
      const eaten = this.targetNode.harvest(1);
      if (eaten > 0) {
        this.stats.satiety = Math.min(100, this.stats.satiety + 50);
        this.stats.health = Math.min(this.maxHealth, this.stats.health + 10);
        SoundFX.playEat();
      }
      this.finishEatingAndResume();
    }
  }

  private handleMovingToSleep(dt: number): void {
    this.clearProgressBar();
    if (!this.sleepHut || !this.sleepHut.canAcceptSleeper()) {
      this.sleepHut = null;
      this.startWarming();
      return;
    }

    const door = this.sleepHut.getDoorPoint();
    const dist = Phaser.Math.Distance.Between(this.x, this.y, door.x, door.y);
    const arrived =
      dist <= 22 || this.moveToward(door.x, door.y, dt, 12, 0.95, this.sleepHut);
    if (arrived) {
      this.resetPose();
      this.sleepHut.enterSleep(this);
      this.setVisible(false);
      this.disableInteractive();
      this.state = 'SLEEPING_IN_HUT';
    }
  }

  private handleSleepingInHut(): void {
    if (this.stats.energy >= 98) {
      this.leaveHutIfOccupied();
      this.finishEatingAndResume();
    }
  }

  private handleMovingToBreed(dt: number): void {
    this.clearProgressBar();
    if (!this.breedHut || !this.breedHut.isBreeding() || !this.breedPartner) {
      this.breedHut = null;
      this.breedPartner = null;
      this.hideBubble();
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 3000;
      return;
    }

    const door = this.breedHut.getDoorPoint();
    const dist = Phaser.Math.Distance.Between(this.x, this.y, door.x, door.y);
    const arrived =
      dist <= 22 || this.moveToward(door.x, door.y, dt, 12, 0.95, this.breedHut);
    if (arrived) {
      this.resetPose();
      this.hideBubble();
      this.setVisible(false);
      this.disableInteractive();
      this.state = 'BREEDING_IN_HUT';
      this.breedHut.notifyBreederEntered(this);
    }
  }

  private finishEatingAndResume(): void {
    this.setWadingVisual(false);
    this.targetNode = null;
    this.targetLake = null;
    this.targetAnimal = null;
    this.targetCarcass = null;
    this.targetBuild = null;
    this.workBuilding = null;
    this.lakeWadeSpot = null;
    this.buildSpot = null;
    this.isAutonomousEat = false;
    this.resetPose();

    if (this.isChild) {
      this.clearSavedWork();
      this.state = 'CHILD_PLAYING';
      return;
    }

    if (this.isFreeTime) {
      this.state = 'FREE_TIME';
      this.updateHeldTool();
      return;
    }

    if (this.assignedBuilding && this.assignedBuilding.scene && this.assignedBuilding.isComplete()) {
      this.clearSavedWork();
      this.workBuilding = this.assignedBuilding;
      this.activeProfession = this.assignedProfession;
      this.state = 'MOVING_TO_WORK';
      this.updateHeldTool();
      return;
    }

    if (this.warriorClass) {
      this.clearSavedWork();
      this.state = 'PATROLLING';
      this.updateHeldTool();
      return;
    }

    if (this.savedWorkBuilding && this.savedWorkBuilding.scene && this.savedWorkBuilding.isComplete()) {
      const b = this.savedWorkBuilding;
      this.clearSavedWork();
      this.workBuilding = b;
      this.activeProfession = b.profession;
      this.state = 'MOVING_TO_WORK';
      this.updateHeldTool();
      return;
    }

    if (this.savedWorkBuild && this.savedWorkBuild.scene && !this.savedWorkBuild.isComplete()) {
      const target = this.savedWorkBuild;
      this.clearSavedWork();
      this.issueBuildOrder(target);
      return;
    }

    if (
      this.savedWorkCarcass &&
      this.savedWorkCarcass.scene &&
      !this.savedWorkCarcass.isEmpty() &&
      this.savedWorkCarcass.getNextAvailableType((t) => this.callbacks.isStorageFull(t))
    ) {
      const c = this.savedWorkCarcass;
      this.clearSavedWork();
      this.issueCarcassOrder(c);
      return;
    }

    if (
      this.savedWorkAnimal &&
      this.savedWorkAnimal.isAlive() &&
      !this.callbacks.isStorageFull('food')
    ) {
      const a = this.savedWorkAnimal;
      this.clearSavedWork();
      this.issueHuntOrder(a);
      return;
    }

    if (
      this.savedWorkLake &&
      this.savedWorkLake.isFishable() &&
      !this.callbacks.isStorageFull('food')
    ) {
      this.targetLake = this.savedWorkLake;
      const spot = this.savedWorkLake.getWadeSpotFor(this.x, this.y);
      this.lakeWadeSpot = new Phaser.Math.Vector2(spot.x, spot.y);
      this.lastResourceType = 'food';
      this.activeProfession = 'fisher';
      this.clearSavedWork();
      this.state = 'MOVING_TO_LAKE';
    } else if (
      this.savedWorkNode &&
      this.savedWorkNode.scene &&
      !this.savedWorkNode.isDepleted() &&
      !this.callbacks.isStorageFull(this.savedWorkNode.resourceType)
    ) {
      this.targetNode = this.savedWorkNode;
      this.lastResourceType = this.savedWorkNode.resourceType;
      this.clearSavedWork();
      this.state = 'MOVING_TO_RESOURCE';
    } else if (this.savedWorkType && !this.callbacks.isStorageFull(this.savedWorkType)) {
      const next = this.callbacks.findNearestResourceOfType(
        this.savedWorkType,
        this.x,
        this.y,
        750
      );
      const savedType = this.savedWorkType;
      this.clearSavedWork();
      if (next) {
        this.targetNode = next;
        this.lastResourceType = savedType;
        this.state = 'MOVING_TO_RESOURCE';
      } else {
        this.state = 'IDLE_WANDER';
        this.idleWaitTimer = 5000;
      }
    } else {
      this.clearSavedWork();
      this.state = 'IDLE_WANDER';
      this.idleWaitTimer = 5000;
    }
    this.updateHeldTool();
  }

  private moveToward(
    tx: number,
    ty: number,
    dt: number,
    arrivalRadius: number,
    speedMultiplier = 1,
    ignoreOwner?: object
  ): boolean {
    const obstacles = this.callbacks.getObstacles();
    const res = stepSmartMove(
      this.x,
      this.y,
      tx,
      ty,
      dt,
      this.getMoveSpeed() * speedMultiplier,
      12,
      arrivalRadius,
      obstacles,
      this.callbacks.getRiver(),
      Math.max(400, this.callbacks.getWorldBounds().width),
      Math.max(400, this.callbacks.getWorldBounds().height),
      this.navState,
      ignoreOwner
    );

    if (res.arrived) {
      this.x = res.x;
      this.y = res.y;
      this.setHeading(res.dx, res.dy);
      return true;
    }

    this.isMovingFrame = true;
    const prevX = this.x;
    const prevY = this.y;
    this.x = res.x;
    this.y = res.y;
    this.setHeading(this.x - prevX, this.y - prevY);

    const carryingBundle = this.state === 'RETURNING' && this.carryAmount > 0;
    this.walkPhase += dt * 13 * speedMultiplier * (this.getMoveSpeed() / this.speed);
    const s = Math.sin(this.walkPhase);
    this.leftLeg.setAngle(s * 26);
    this.rightLeg.setAngle(-s * 26);
    this.backArm.setAngle(carryingBundle ? -28 : -s * 20);
    this.frontArmGroup.setAngle(carryingBundle ? -38 : s * 20);
    this.torso.setAngle(s * 3);
    this.head.setAngle(-s * 2);
    this.crownSprite.setAngle(-s * 2);
    this.rig.y = -Math.abs(s) * 3.5;

    return false;
  }

  private setHeading(dx: number, dy: number): void {
    if (Math.hypot(dx, dy) < 0.08) {
      return;
    }
    let nextView: FacingView;
    let nextFacingDir = this.facingDir;
    if (Math.abs(dy) > Math.abs(dx) * 1.15) {
      nextView = dy < 0 ? 'back' : 'front';
    } else {
      nextView = 'side';
      nextFacingDir = dx < 0 ? -1 : 1;
    }
    if (nextView !== this.currentView || nextFacingDir !== this.facingDir) {
      if (this.headingLockTimer > 0 && this.isMovingFrame) {
        return;
      }
      this.facingDir = nextFacingDir;
      this.headingLockTimer = 140;
      if (nextView !== this.currentView) {
        this.applyView(nextView);
      }
    }
  }

  private resetPose(): void {
    this.rig.y = 0;
    this.rig.scaleY = 1;
    this.leftLeg.setAngle(0);
    this.rightLeg.setAngle(0);
    this.torso.setAngle(0);
    this.head.setAngle(0);
    this.crownSprite.setAngle(0);
    const carryingBundle = this.state === 'RETURNING' && this.carryAmount > 0;
    this.backArm.setAngle(carryingBundle ? -26 : 0);
    this.frontArmGroup.setAngle(carryingBundle ? -38 : 0);
  }

  private updateHeldTool(): void {
    if (
      this.isChild ||
      this.isDying ||
      (this.state === 'RETURNING' && this.carryAmount > 0)
    ) {
      this.toolSprite.setVisible(false);
      return;
    }

    if (
      this.equippedWeapon &&
      (this.isInCombat() ||
        this.state === 'PATROLLING' ||
        this.state === 'MOVING' ||
        this.state === 'IDLE_WANDER' ||
        this.state === 'FREE_TIME' ||
        this.state === 'MOVING_TO_HUNT' ||
        this.state === 'HUNTING')
    ) {
      const tex =
        this.equippedWeapon === 'bow'
          ? 'tool-bow'
          : this.equippedWeapon === 'club'
            ? 'tool-bone-club'
            : 'tool-spear';
      this.toolSprite.setTexture(tex);
      this.toolSprite.setVisible(true);
      return;
    }

    if (this.state === 'MOVING_TO_LAKE' || this.state === 'FISHING') {
      if (this.hasCraftedTools) {
        this.toolSprite.setTexture('tool-spear');
        this.toolSprite.setVisible(true);
      } else {
        this.toolSprite.setVisible(false);
      }
      return;
    }

    if (
      this.state === 'MOVING_TO_HUNT' ||
      this.state === 'HUNTING' ||
      this.state === 'MOVING_TO_CARCASS' ||
      this.state === 'BUTCHERING'
    ) {
      this.toolSprite.setTexture(this.hasCraftedTools ? 'tool-spear' : 'tool-sharp-stone');
      this.toolSprite.setVisible(true);
      return;
    }

    if (this.state === 'MOVING_TO_BUILD' || this.state === 'BUILDING') {
      this.toolSprite.setTexture(this.hasCraftedTools ? 'tool-hammer' : 'tool-sharp-stone');
      this.toolSprite.setVisible(true);
      return;
    }

    if (this.state === 'MOVING_TO_WORK' || this.state === 'WORKING_STATION') {
      if (
        this.workBuilding?.buildingType === 'workshop' ||
        this.workBuilding?.buildingType === 'armory'
      ) {
        this.toolSprite.setTexture('tool-hammer');
        this.toolSprite.setVisible(true);
      } else if (this.workBuilding?.buildingType === 'totem') {
        this.toolSprite.setTexture('tool-staff');
        this.toolSprite.setVisible(true);
      } else if (this.workBuilding?.buildingType === 'watchtower') {
        this.toolSprite.setTexture('tool-bow');
        this.toolSprite.setVisible(true);
      } else {
        this.toolSprite.setVisible(false);
      }
      return;
    }

    if (
      (this.state === 'GATHERING' || this.state === 'MOVING_TO_RESOURCE') &&
      this.targetNode &&
      !this.isAutonomousEat
    ) {
      if (this.targetNode.resourceType === 'wood') {
        this.toolSprite.setTexture(this.hasCraftedTools ? 'tool-axe' : 'tool-sharp-stone');
        this.toolSprite.setVisible(true);
        return;
      }
      if (this.targetNode.resourceType === 'stone') {
        this.toolSprite.setTexture(this.hasCraftedTools ? 'tool-pickaxe' : 'tool-sharp-stone');
        this.toolSprite.setVisible(true);
        return;
      }
      // Picking berries bare-handed
      this.toolSprite.setVisible(false);
      return;
    }

    if (this.lifeStage === 'ELDER') {
      this.toolSprite.setTexture('tool-staff');
    } else {
      this.toolSprite.setTexture(this.hasCraftedTools ? 'tool-club' : 'tool-sharp-stone');
    }
    this.toolSprite.setVisible(true);
  }

  private updateCarryVisual(): void {
    if (this.state === 'RETURNING' && this.carryVisual && this.carryAmount > 0) {
      const tier = Phaser.Math.Clamp(this.carryAmount, 1, 5);
      this.carrySprite.setTexture(`carry-${this.carryVisual}-${tier}`);
      this.carrySprite.setVisible(true);
      this.toolSprite.setVisible(false);
    } else {
      this.carrySprite.setVisible(false);
      this.updateHeldTool();
    }
  }

  private playGatherSound(type: ResourceType): void {
    if (type === 'wood') SoundFX.playChop();
    else if (type === 'stone') SoundFX.playMine();
    else SoundFX.playForage();
  }

  private showBubble(emoji: string): void {
    this.bubbleText.setText(emoji);
    this.bubbleContainer.setVisible(true);
  }

  private showTemporaryBubble(emoji: string, durationMs: number): void {
    this.temporaryBubbleTimer = durationMs;
    this.showBubble(emoji);
  }

  private hideBubble(): void {
    this.temporaryBubbleTimer = 0;
    this.bubbleContainer.setVisible(false);
  }

  private updateOverheadTaskBadge(): void {
    if (!this.visible || this.isDying || this.state === 'DYING_LYING' || this.state === 'MOURNING_SITTING') {
      this.taskBadgeContainer.setVisible(false);
      return;
    }

    const icon = this.getOverheadTaskIcon();
    const elevatedWatchtower =
      this.isGarrisonedInWatchtower() && this.state === 'WORKING_STATION';
    const badgeY = elevatedWatchtower ? -140 : this.hasProgressBar ? -74 : -58;
    this.taskBadgeContainer.setY(badgeY);
    this.bubbleContainer.setY(badgeY - 22);

    const key = `${icon}:${this.state}`;
    if (key !== this.lastTaskBadgeKey) {
      this.lastTaskBadgeKey = key;
      this.taskBadgeText.setText(icon);
      this.taskBadgeBg.clear();
      this.taskBadgeBg.fillStyle(0x1b120b, 0.84);
      this.taskBadgeBg.fillRoundedRect(-11, -9, 22, 18, 6);
      const borderCol =
        this.state === 'COMBAT_ATTACK' ||
        this.state === 'COMBAT_CHASE' ||
        this.state === 'FLEEING_TO_CAMPFIRE'
          ? 0xef4444
          : this.state === 'WORKING_STATION'
            ? 0x38bdf8
            : this.state === 'RETURNING'
              ? 0xfbbf24
              : 0xc98a4b;
      this.taskBadgeBg.lineStyle(1.1, borderCol, 0.9);
      this.taskBadgeBg.strokeRoundedRect(-11, -9, 22, 18, 6);
    }
    this.taskBadgeContainer.setVisible(true);
  }

  private getOverheadTaskIcon(): string {
    switch (this.state) {
      case 'GATHERING':
      case 'MOVING_TO_RESOURCE': {
        const t = this.targetNode?.resourceType ?? this.lastResourceType;
        if (t === 'wood') return '🪓';
        if (t === 'stone') return '⛏️';
        return '🫐';
      }
      case 'FISHING':
      case 'MOVING_TO_LAKE':
        return '🐟';
      case 'HUNTING':
      case 'MOVING_TO_HUNT':
        return '🏹';
      case 'BUTCHERING':
      case 'MOVING_TO_CARCASS':
        return '🥩';
      case 'CLEARING_STUMP':
        return '🪓';
      case 'BUILDING':
      case 'MOVING_TO_BUILD':
        return '🔨';
      case 'WORKING_STATION':
      case 'MOVING_TO_WORK': {
        const bt = this.workBuilding?.buildingType ?? this.assignedBuilding?.buildingType;
        if (bt === 'watchtower') return '🏹';
        if (bt === 'totem') return '🔮';
        if (bt === 'smokehouse') return '🔥';
        if (bt === 'gatherer_hut') return '🧺';
        return '🛠️';
      }
      case 'RETURNING':
        return '📦';
      case 'EATING_STORAGE':
      case 'MOVING_TO_EAT_STORAGE':
      case 'EATING_BERRIES':
        return '🍖';
      case 'SLEEPING_IN_HUT':
      case 'MOVING_TO_SLEEP':
        return '💤';
      case 'MOVING_TO_BREED':
      case 'BREEDING_IN_HUT':
        return '❤️';
      case 'FLEEING_TO_CAMPFIRE':
      case 'GRABBING_GEAR':
        return '🚨';
      case 'COMBAT_CHASE':
      case 'COMBAT_ATTACK':
        return '⚔️';
      case 'PATROLLING':
        return '🛡️';
      case 'MOVING_TO_CONVERT':
      case 'CONVERTING_ENEMY':
        return '🌀';
      case 'CHATTING':
        return '💬';
      case 'WARMING':
        return '🔥';
      case 'FREE_TIME':
        return '☀️';
      case 'CHILD_PLAYING':
      case 'MOVING_TO_NURSERY':
      case 'IN_NURSERY':
        return '🌱';
      case 'MOVING':
        return '👣';
      default:
        return '🌿';
    }
  }

  private drawProgressBar(progress: number, color: number): void {
    this.hasProgressBar = true;
    const w = 34;
    const h = 4;
    const x = -w / 2;
    const y = -60;

    this.progressBg.clear();
    this.progressFill.clear();

    this.progressBg.fillStyle(0x16100b, 0.85);
    this.progressBg.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 2.5);

    this.progressFill.fillStyle(color, 1);
    this.progressFill.fillRoundedRect(x, y, Math.max(2, w * progress), h, 2);
  }

  private clearProgressBar(): void {
    this.hasProgressBar = false;
    this.progressBg.clear();
    this.progressFill.clear();
  }
}
