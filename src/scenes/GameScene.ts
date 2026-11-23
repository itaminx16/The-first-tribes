import Phaser from 'phaser';
import { Animal, AnimalSpecies } from '../entities/Animal';
import { AnimalCarcass, CarcassKind } from '../entities/AnimalCarcass';
import { Campfire } from '../entities/Campfire';
import { EnemyUnit } from '../entities/EnemyUnit';
import { Hut } from '../entities/Hut';
import { Lake } from '../entities/Lake';
import { Predator, PredatorSpecies } from '../entities/Predator';
import { ResourceNode } from '../entities/ResourceNode';
import { River } from '../entities/River';
import { StorageZone } from '../entities/StorageZone';
import { TotemCaptive, TribeBuilding } from '../entities/TribeBuilding';
import { Villager, VillagerCallbacks } from '../entities/Villager';
import { WeatherSystem } from '../entities/WeatherSystem';
import { generateProceduralTextures } from '../graphics/ProceduralTextures';
import { FogOfWarSystem, FogViewer } from '../systems/FogOfWarSystem';
import { RivalTribeSystem } from '../systems/RivalTribeSystem';
import {
  deleteSaveSlot,
  getAllSaveSummaries,
  loadGameFromSlot,
  SavedGameData,
  saveGameToSlot
} from '../systems/SaveSystem';
import {
  AncestorRecord,
  ARMOR_DEFS,
  ArmorType,
  BASE_POP_CAP,
  BREED_MIN_FOOD,
  BUILDING_DEFS,
  BuildingType,
  CalendarState,
  ChiefStatus,
  CombatTarget,
  DEFAULT_GAME_SETUP,
  formatAgeUk,
  GameSetupConfig,
  GEAR_DEFENSE_RESERVE,
  GRANARY_STORAGE_BONUS,
  HUT_POP_BONUS,
  LARGE_HUT_POP_BONUS,
  MAP_PRESETS,
  MAX_PREDATORS,
  MAX_STORAGE,
  MinimapData,
  MusicTrackId,
  ObstacleCircle,
  PopulationState,
  RESOURCE_LABELS_UK,
  ResourceType,
  SEASON_DURATION_MS,
  SEASON_ICONS,
  SEASON_LABELS_UK,
  SEASON_ORDER,
  Season,
  SelectionSummary,
  TECH_TREE,
  TechBranchId,
  TechState,
  TimeScale,
  TOOL_CRAFT_COST,
  TOOL_RESERVE_BUFFER,
  TradeRequest,
  TribeResources,
  VillagerAppearanceId,
  WARRIOR_CLASS_LABELS_UK,
  WARRIOR_CLASS_WEAPON,
  WarriorClass,
  WEAPON_DEFS,
  WeaponType,
  YEARS_PER_SEASON_CHANGE
} from '../types/game';
import { GAME_DPR } from '../utils/display';
import { SoundFX } from '../utils/SoundFX';

interface CloudShadow {
  sprite: Phaser.GameObjects.Image;
  speedX: number;
  speedY: number;
}

interface CraftPlan {
  canWork: boolean;
  statusText: string;
  kind?: 'tool' | WeaponType | Exclude<ArmorType, 'none'>;
  cost?: Partial<Record<ResourceType, number>>;
}

const CHILD_NAMES_MALE = ['Богг', 'Крук', 'Зуб', 'Ур', 'Рок', 'Бур', 'Грім', 'Скеля'];
const CHILD_NAMES_FEMALE = ['Лія', 'Ева', 'Ніа', 'Зоря', 'Кіа', 'Лада', 'Іва', 'Тінь'];

export class GameScene extends Phaser.Scene {
  private static pendingSetup: GameSetupConfig | null = null;
  private static pendingLoad: SavedGameData | null = null;
  private static uiListenersBound = false;
  private static hasStartedFromMenu = false;

  private gameConfig: GameSetupConfig = { ...DEFAULT_GAME_SETUP };
  private isMenuPaused = false;
  private worldWidth = 4864;
  private worldHeight = 3584;
  private playerBaseX = 2380;
  private playerBaseY = 1780;

  private seasonIndex = 0;
  private season: Season = SEASON_ORDER[0];
  private year = 1;
  private seasonElapsedMs = 0;
  private springRipened = false;
  private isFreeTimeActive = false;
  private timeScale: TimeScale = 1;
  private calendarEmitTimer = 0;
  private minimapEmitTimer = 0;
  private proximityCheckTimer = 0;

  private campfire!: Campfire;
  private lake!: Lake;
  private river!: River;
  private fogSystem!: FogOfWarSystem;
  private weather!: WeatherSystem;
  private rivalSystem!: RivalTribeSystem;
  private storages!: Record<ResourceType, StorageZone>;
  private campfirePathDecals: Phaser.GameObjects.Image[] = [];
  private campfireStoragesHidden = false;

  private huts: Hut[] = [];
  private buildings: TribeBuilding[] = [];
  private animals: Animal[] = [];
  private carcasses: AnimalCarcass[] = [];
  private predators: Predator[] = [];
  private villagers: Villager[] = [];
  private resourceNodes: ResourceNode[] = [];
  private groundTiles: Array<{ tile: Phaser.GameObjects.Image; variant: number }> = [];
  private flowerDecals: Phaser.GameObjects.Image[] = [];
  private ancestors: AncestorRecord[] = [];
  private cloudShadows: CloudShadow[] = [];

  private cachedObstacles: ObstacleCircle[] = [];
  private selectedVillagers: Villager[] = [];
  private selectedBuilding: TribeBuilding | null = null;
  private villagerCallbacks!: VillagerCallbacks;
  private chiefId: string | null = null;

  private manualAlarmActive = false;
  private threatAlarmCooldown = 0;

  private techLevels: TechState = {
    weapons: 0,
    armor: 0,
    craft: 0,
    healing: 0
  };

  private storageCap = MAX_STORAGE;
  private resources: TribeResources = {
    wood: 0,
    stone: 0,
    food: 0,
    bone: 0,
    hide: 0,
    storageCap: MAX_STORAGE,
    tools: 0,
    weapons: { spear: 0, bow: 0, club: 0 },
    armors: { hide_armor: 0, bone_armor: 0 },
    knowledge: 0
  };

  private populationCap = BASE_POP_CAP;
  private warriorCap = 0;
  private childCounter = 0;
  private buildingCounter = 0;
  private predatorCounter = 0;
  private breedCheckTimer = 2000;

  private isBuildMode = false;
  private buildType: BuildingType | null = null;
  private buildGhost?: Phaser.GameObjects.Image;
  private buildGhostRing?: Phaser.GameObjects.Ellipse;

  private marqueeGfx!: Phaser.GameObjects.Graphics;
  private isMarqueeSelecting = false;
  private marqueeStartX = 0;
  private marqueeStartY = 0;

  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private isPanning = false;
  private panMoved = false;
  private panStartX = 0;
  private panStartY = 0;
  private camStartX = 0;
  private camStartY = 0;
  private uiClickGuardUntil = 0;

  // Android Multi-Touch, Pinch-to-Zoom & Touch Build Preview State
  private isPinching = false;
  private pinchPrevDist = 0;
  private pinchPrevMidX = 0;
  private pinchPrevMidY = 0;
  private pinchEndGuardUntil = 0;
  private touchMarqueeMode = false;
  private buildGhostWorldX = 0;
  private buildGhostWorldY = 0;
  private isTouchBuildPreview = false;
  private lastBuildPreviewValid: boolean | null = null;
  private lastBuildPreviewCanAfford: boolean | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  public create(): void {
    this.resetSceneStateForNewSession();
    generateProceduralTextures(this);

    const preset = MAP_PRESETS[this.gameConfig.mapId] ?? MAP_PRESETS.river_valley;
    this.worldWidth = preset.worldW;
    this.worldHeight = preset.worldH;
    this.playerBaseX = Math.round(this.worldWidth * 0.48);
    this.playerBaseY = Math.round(this.worldHeight * 0.5);

    SoundFX.setMusicTrack(this.gameConfig.musicTrack);
    SoundFX.setAmbientEnabled(this.gameConfig.ambientSounds);

    this.input.mouse?.disableContextMenu();
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.centerOn(this.playerBaseX, this.playerBaseY);
    const logicalW = this.scale.width / GAME_DPR;
    const logicalH = this.scale.height / GAME_DPR;
    const baseZoom = Math.min(logicalW, logicalH) < 520 ? 0.78 : 1.0;
    this.cameras.main.setZoom(baseZoom * GAME_DPR);

    this.createTerrain();
    this.river = new River(this, this.worldWidth, this.worldHeight, preset.riverLayout, this.season);
    this.createCampfireAndStorages();
    this.createLake();
    this.createRivalTribes();
    this.createResourceNodes();
    this.createAnimals();
    this.createPredators();
    this.createStartingVillagers();
    this.createBuildGhost();
    this.createCloudShadows();
    this.fogSystem = new FogOfWarSystem(
      this,
      this.worldWidth,
      this.worldHeight,
      this.gameConfig.fogOfWar
    );
    this.fogSystem.revealArea(this.playerBaseX, this.playerBaseY, 540);
    this.marqueeGfx = this.add.graphics().setDepth(4500);

    this.weather = new WeatherSystem(this, this.season);
    if (GameScene.pendingLoad) {
      this.applyLoadedSaveData(GameScene.pendingLoad);
      GameScene.pendingLoad = null;
    }
    this.fogSystem.setEnabled(this.gameConfig.fogOfWar);
    this.applySeasonToWorld();
    this.rebuildObstacleCache();
    this.setupInput();

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }
    this.isMenuPaused = !GameScene.hasStartedFromMenu;
    this.scene.setVisible(GameScene.hasStartedFromMenu, 'GameScene');
    this.bindUiSceneEvents();

    this.emitAllHudState();
  }

  private resetSceneStateForNewSession(): void {
    if (GameScene.pendingLoad) {
      this.gameConfig = { ...GameScene.pendingLoad.config };
    } else if (GameScene.pendingSetup) {
      this.gameConfig = { ...GameScene.pendingSetup };
      GameScene.pendingSetup = null;
    }
    this.seasonIndex = 0;
    this.season = SEASON_ORDER[0];
    this.year = 1;
    this.seasonElapsedMs = 0;
    this.springRipened = false;
    this.isFreeTimeActive = false;
    this.timeScale = 1;
    this.campfirePathDecals = [];
    this.campfireStoragesHidden = false;
    this.huts = [];
    this.buildings = [];
    this.animals = [];
    this.carcasses = [];
    this.predators = [];
    this.villagers = [];
    this.resourceNodes = [];
    this.groundTiles = [];
    this.flowerDecals = [];
    this.ancestors = [];
    this.cloudShadows = [];
    this.cachedObstacles = [];
    this.selectedVillagers = [];
    this.selectedBuilding = null;
    this.chiefId = null;
    this.manualAlarmActive = false;
    this.threatAlarmCooldown = 0;
    this.techLevels = { weapons: 0, armor: 0, craft: 0, healing: 0 };
    this.storageCap = MAX_STORAGE;
    const startMult =
      this.gameConfig.difficulty === 'easy'
        ? 15
        : this.gameConfig.difficulty === 'normal'
        ? 5
        : 0;
    this.resources = {
      wood: startMult,
      stone: startMult,
      food: startMult,
      bone: 0,
      hide: 0,
      storageCap: MAX_STORAGE,
      tools: 0,
      weapons: { spear: 0, bow: 0, club: 0 },
      armors: { hide_armor: 0, bone_armor: 0 },
      knowledge: 0
    };
    this.populationCap = BASE_POP_CAP;
    this.warriorCap = 0;
    this.childCounter = 0;
    this.buildingCounter = 0;
    this.predatorCounter = 0;
    this.isBuildMode = false;
    this.buildType = null;
    this.isPinching = false;
    this.isPanning = false;
    this.panMoved = false;
    this.pinchEndGuardUntil = 0;
    this.touchMarqueeMode = false;
    this.isTouchBuildPreview = false;
    this.lastBuildPreviewValid = null;
    this.lastBuildPreviewCanAfford = null;
  }

  private bindUiSceneEvents(): void {
    const uiScene = this.scene.get('UIScene');
    if (GameScene.uiListenersBound) {
      uiScene.events.removeAllListeners();
    }
    GameScene.uiListenersBound = true;

    uiScene.events.on('ui-button-clicked', () => {
      this.uiClickGuardUntil = this.time.now + 150;
    });
    uiScene.events.on('next-season', () => {
      if (this.gameConfig.mode === 'sandbox') {
        this.advanceSeason(true);
      } else {
        this.showFloatingText(
          this.campfire.x,
          this.campfire.y - 72,
          '⏳ Пропуск сезонів доступний лише в режимі Пісочниці!'
        );
      }
    });
    uiScene.events.on('cycle-speed', () => {
      this.cycleTimeScale();
    });
    uiScene.events.on('elect-chief', (villagerId: string) => {
      this.electChief(villagerId);
    });
    uiScene.events.on('toggle-build', (type: BuildingType) => {
      this.toggleBuildMode(type);
    });
    uiScene.events.on('assign-selected-to-building', (buildingId: string) => {
      this.assignSelectedToBuilding(buildingId);
    });
    uiScene.events.on(
      'assign-villager-by-id',
      (payload: { buildingId: string; villagerId: string }) => {
        this.assignVillagerByIdToBuilding(payload.buildingId, payload.villagerId);
      }
    );
    uiScene.events.on(
      'train-warrior',
      (payload: { buildingId: string; warriorClass: WarriorClass; villagerId?: string }) => {
        this.trainWarriorAtBarracks(payload.buildingId, payload.warriorClass, payload.villagerId);
      }
    );
    uiScene.events.on(
      'adjust-barracks-target',
      (payload: { buildingId: string; delta: number }) => {
        this.adjustBarracksTarget(payload.buildingId, payload.delta);
      }
    );
    uiScene.events.on('demolish-building', (buildingId: string) => {
      this.demolishBuildingById(buildingId);
    });
    uiScene.events.on('research-tech', (branch: TechBranchId) => {
      this.researchTech(branch);
    });
    uiScene.events.on('toggle-defense-alarm', () => {
      this.toggleManualDefenseAlarm();
    });
    uiScene.events.on('toggle-fog', () => {
      this.gameConfig.fogOfWar = !this.fogSystem.isEnabled();
      this.fogSystem.setEnabled(this.gameConfig.fogOfWar);
      this.events.emit('config-updated', { ...this.gameConfig });
      this.showFloatingText(
        this.campfire.x,
        this.campfire.y - 74,
        this.gameConfig.fogOfWar ? '🌫️ Туман війни УВІМКНЕНО' : '☀️ Туман війни ВИМКНЕНО'
      );
    });
    uiScene.events.on('set-music-track', (track: MusicTrackId) => {
      this.gameConfig.musicTrack = track;
      SoundFX.setMusicTrack(track);
      this.events.emit('config-updated', { ...this.gameConfig });
    });
    uiScene.events.on('set-ambient-sounds', (enabled: boolean) => {
      this.gameConfig.ambientSounds = enabled;
      SoundFX.setAmbientEnabled(enabled);
      this.events.emit('config-updated', { ...this.gameConfig });
    });
    uiScene.events.on('set-menu-open', (open: boolean) => {
      if (!open) {
        GameScene.hasStartedFromMenu = true;
      }
      this.isMenuPaused = open;
    });
    uiScene.events.on('start-new-game', (cfg: GameSetupConfig) => {
      GameScene.hasStartedFromMenu = true;
      this.isMenuPaused = false;
      GameScene.pendingLoad = null;
      GameScene.pendingSetup = { ...cfg };
      this.scene.restart();
    });
    uiScene.events.on('save-game', (slotId = 1) => {
      this.saveCurrentGame(slotId);
    });
    uiScene.events.on('load-game', (slotId: number) => {
      const saved = loadGameFromSlot(slotId);
      if (saved) {
        GameScene.pendingLoad = saved;
        GameScene.hasStartedFromMenu = true;
        this.isMenuPaused = false;
        this.scene.restart();
      }
    });
    uiScene.events.on('delete-save', (slotId: number) => {
      if (deleteSaveSlot(slotId)) {
        SoundFX.playHammer();
        this.events.emit('saves-list-updated', getAllSaveSummaries());
        if (!this.isMenuPaused) {
          this.showFloatingText(this.campfire.x, this.campfire.y - 84, `🗑️ Слот #${slotId} видалено`);
        }
      }
    });
    uiScene.events.on('propose-non-aggression', (tribeId: string) => {
      const res = this.rivalSystem.proposeNonAggression(tribeId);
      this.showFloatingText(this.campfire.x, this.campfire.y - 84, res.messageUk);
      this.emitRivals();
    });
    uiScene.events.on('propose-alliance', (tribeId: string) => {
      const res = this.rivalSystem.proposeAlliance(tribeId);
      this.showFloatingText(this.campfire.x, this.campfire.y - 84, res.messageUk);
      this.emitRivals();
    });
    uiScene.events.on('trade-with-tribe', (req: TradeRequest) => {
      this.executeTradeWithTribe(req);
    });
    uiScene.events.on('select-all-villagers', () => {
      // Exclude children (< 14 years) when selecting all villagers!
      this.selectVillagerList(this.villagers.filter((v) => v.isAlive() && !v.isChild));
    });
    uiScene.events.on('select-idle-villagers', () => {
      this.selectVillagerList(this.villagers.filter((v) => v.isAlive() && v.isIdleFree()));
    });
    uiScene.events.on('select-warrior-villagers', () => {
      this.selectVillagerList(
        this.villagers.filter((v) => v.isAlive() && v.warriorClass !== null)
      );
    });
    uiScene.events.on('select-villager-by-id', (villagerId: string) => {
      const found = this.villagers.find((v) => v.id === villagerId && v.isAlive());
      if (found) {
        this.selectVillagerList([found]);
        this.cameras.main.pan(found.x, found.y, 300, 'Sine.easeOut');
      }
    });
    uiScene.events.on('clear-selection', () => {
      this.selectVillagerList([]);
    });
    uiScene.events.on('minimap-jump', (pt: { x: number; y: number }) => {
      this.cameras.main.centerOn(
        Phaser.Math.Clamp(pt.x, 0, this.worldWidth),
        Phaser.Math.Clamp(pt.y, 0, this.worldHeight)
      );
    });
    uiScene.events.on('close-building-panel', () => {
      this.selectBuilding(null);
    });
    uiScene.events.on('camera-zoom', (delta: number) => {
      const cam = this.cameras.main;
      cam.setZoom(Phaser.Math.Clamp(cam.zoom + delta * GAME_DPR, 0.42 * GAME_DPR, 1.55 * GAME_DPR));
    });
    uiScene.events.on('camera-home', () => {
      this.cameras.main.pan(this.playerBaseX, this.playerBaseY, 320, 'Sine.easeOut');
    });
    uiScene.events.on('toggle-marquee-mode', () => {
      this.touchMarqueeMode = !this.touchMarqueeMode;
      this.events.emit('marquee-mode-updated', this.touchMarqueeMode);
    });
    uiScene.events.on('confirm-build-placement', () => {
      if (this.isBuildMode && this.buildType) {
        this.tryPlaceBuildingAt(this.buildGhostWorldX, this.buildGhostWorldY);
      }
    });
    uiScene.events.on('cancel-build-mode', () => {
      this.setBuildMode(null);
    });
    uiScene.events.on('ui-ready', () => {
      this.emitAllHudState();
    });
  }

  private emitAllHudState(): void {
    this.emitResources();
    this.emitPopulation();
    this.emitCalendar();
    this.emitChiefStatus();
    this.emitSelection();
    this.emitAlarm();
    this.emitTech();
    this.emitMinimap();
    this.emitRivals();
    this.emitRoster();
    this.events.emit('config-updated', { ...this.gameConfig });
    this.events.emit('build-mode-updated', this.buildType);
    this.events.emit('marquee-mode-updated', this.touchMarqueeMode);
    this.events.emit('chronicle-updated', [...this.ancestors]);
    this.events.emit('saves-list-updated', getAllSaveSummaries());
    if (!GameScene.hasStartedFromMenu) {
      this.events.emit('show-main-menu-on-boot');
    }
  }

  private saveCurrentGame(slotId = 1): void {
    const data: SavedGameData = {
      version: 1,
      slotId,
      savedAt: Date.now(),
      config: { ...this.gameConfig },
      seasonIndex: this.seasonIndex,
      season: this.season,
      year: this.year,
      seasonElapsedMs: this.seasonElapsedMs,
      springRipened: this.springRipened,
      resources: {
        ...this.resources,
        weapons: { ...this.resources.weapons },
        armors: { ...this.resources.armors }
      },
      storageCap: this.storageCap,
      populationCap: this.populationCap,
      warriorCap: this.warriorCap,
      techLevels: { ...this.techLevels },
      chiefId: this.chiefId,
      ancestors: [...this.ancestors],
      huts: this.huts.map((h) => ({
        x: h.x,
        y: h.y,
        isLarge: h.isLarge,
        progress: h.getProgress()
      })),
      buildings: this.buildings
        .filter((b) => Boolean(b.scene))
        .map((b) => ({
          id: b.buildingId,
          type: b.buildingType,
          x: b.x,
          y: b.y,
          progress: b.getProgress(),
          hp: b.hp,
          targetWarriors: b.targetWarriors
        })),
      villagers: this.villagers
        .filter((v) => v.isAlive())
        .map((v) => ({
          id: v.id,
          name: v.villagerName,
          gender: v.gender,
          appearance: v.appearance,
          x: v.x,
          y: v.y,
          age: v.age,
          stats: { ...v.stats },
          isChief: v.isChief,
          hasCraftedTools: v.hasCraftedTools,
          warriorClass: v.warriorClass,
          equippedWeapon: v.equippedWeapon,
          equippedArmor: v.equippedArmor,
          familyId: v.familyId,
          familyName: v.familyName,
          spouseId: v.spouseId,
          spouseName: v.spouseName,
          parentNames: [...v.parentNames],
          childrenNames: [...v.childrenNames],
          bornYear: v.bornYear,
          birthsThisSeason: v.birthsThisSeason,
          assignedBuildingId: v.assignedBuilding ? v.assignedBuilding.buildingId : null,
          skills: JSON.parse(JSON.stringify(v.skills)),
          deeds: { ...v.deeds }
        })),
      rivals: this.rivalSystem.camps.map((c) => ({
        id: c.id,
        population: c.population,
        popCap: c.popCap,
        resources: { ...c.resources },
        hp: c.hp,
        alive: c.alive,
        discovered: c.discovered,
        treaty: c.treaty,
        treatySeasonsLeft: c.treatySeasonsLeft,
        relationScore: c.relationScore
      }))
    };

    const ok = saveGameToSlot(slotId, data);
    if (ok) {
      SoundFX.playFanfare();
      this.events.emit('saves-list-updated', getAllSaveSummaries());
      if (!this.isMenuPaused) {
        this.showFloatingText(
          this.campfire.x,
          this.campfire.y - 84,
          `💾 Гру збережено (Слот #${slotId})!`
        );
      }
    }
  }

  private applyLoadedSaveData(save: SavedGameData): void {
    this.seasonIndex = save.seasonIndex;
    this.season = save.season;
    this.year = save.year;
    this.seasonElapsedMs = save.seasonElapsedMs;
    this.springRipened = save.springRipened;
    this.storageCap = save.storageCap;
    this.populationCap = save.populationCap;
    this.warriorCap = save.warriorCap;
    this.techLevels = { ...save.techLevels };
    this.resources = {
      ...save.resources,
      weapons: { ...save.resources.weapons },
      armors: { ...save.resources.armors }
    };
    this.ancestors = [...save.ancestors];
    this.chiefId = save.chiefId;

    // Restore huts
    for (const sh of save.huts) {
      const hut = new Hut(
        this,
        sh.x,
        sh.y,
        () => {},
        (bHut, parentA, parentB) => this.handleBirthReady(bHut, parentA, parentB),
        sh.isLarge
      );
      if (sh.progress > 0) {
        hut.addBuildWork(sh.progress * 2);
      }
      hut.setSeason(this.season);
      this.huts.push(hut);
    }

    // Restore tribe buildings
    for (const sb of save.buildings) {
      this.buildingCounter += 1;
      const tb = new TribeBuilding(
        this,
        sb.x,
        sb.y,
        sb.id,
        sb.type,
        () => {},
        () => this.openChronicle(),
        {
          onOpenTech: () => this.events.emit('open-tech-modal'),
          onCaptiveConverted: (captive, building) => this.spawnConvertedCaptiveVillager(captive, building),
          findTowerTarget: (tx, ty, range) => this.findNearestHostileForPlayer(tx, ty, range),
          getWeaponTechTier: () => this.techLevels.weapons,
          getWarriorSlots: () => ({
            used: this.villagers.filter((v) => v.isAlive() && v.warriorClass !== null).length,
            max: this.warriorCap
          })
        }
      );
      if (sb.progress > 0) {
        tb.addBuildWork(sb.progress * 2);
      }
      tb.hp = sb.hp;
      tb.setTargetWarriors(sb.targetWarriors);
      tb.setSeason(this.season);
      this.buildings.push(tb);

      if (sb.type === 'granary' && tb.isComplete()) {
        for (const st of Object.values(this.storages)) {
          st.setMaxCapacity(this.storageCap);
          st.setVisible(false);
          st.disableInteractive();
        }
        for (const decal of this.campfirePathDecals) {
          decal.setVisible(false);
        }
        this.campfireStoragesHidden = true;
      }
    }
    this.recomputeWarriorCap();
    this.syncStorageAmounts();

    // Replace default starting villagers with saved villagers
    for (const v of this.villagers) {
      v.disposeOnDeath();
    }
    this.villagers = [];
    this.childCounter = save.villagers.length + 5;

    for (const sv of save.villagers) {
      const v = new Villager(
        this,
        sv.x,
        sv.y,
        sv.id,
        sv.name,
        sv.gender,
        sv.appearance,
        this.campfire,
        this.villagerCallbacks,
        sv.age,
        {
          familyId: sv.familyId,
          familyName: sv.familyName,
          spouseId: sv.spouseId,
          spouseName: sv.spouseName,
          parentNames: sv.parentNames,
          childrenNames: sv.childrenNames
        },
        sv.bornYear + sv.age
      );
      v.stats = { ...sv.stats };
      v.birthsThisSeason = sv.birthsThisSeason;
      v.skills = JSON.parse(JSON.stringify(sv.skills));
      v.deeds = { ...sv.deeds };
      if (sv.hasCraftedTools) v.equipCraftedTools();
      if (sv.isChief) v.setChief(true);
      if (sv.warriorClass) {
        const barracks = this.buildings.find((b) => b.buildingType === 'barracks' && b.isComplete()) ?? null;
        v.setWarriorRole(sv.warriorClass, sv.equippedWeapon, sv.equippedArmor, barracks);
      } else {
        if (sv.equippedWeapon) v.equipWeapon(sv.equippedWeapon);
        if (sv.equippedArmor !== 'none') v.equipArmor(sv.equippedArmor);
      }
      v.refreshMaxHealth();
      if (sv.assignedBuildingId) {
        const b = this.buildings.find((item) => item.buildingId === sv.assignedBuildingId && item.isComplete());
        if (b) v.issueAssignBuilding(b);
      }
      this.villagers.push(v);
      this.fogSystem.revealArea(v.x, v.y, 320);
    }

    // Restore rival camps
    for (const sr of save.rivals) {
      const camp = this.rivalSystem.camps.find((c) => c.id === sr.id);
      if (camp) {
        camp.resources = { ...sr.resources };
        camp.hp = sr.hp;
        camp.alive = sr.alive;
        camp.discovered = sr.discovered;
        camp.treaty = sr.treaty;
        camp.treatySeasonsLeft = sr.treatySeasonsLeft;
        camp.relationScore = sr.relationScore;
        this.rivalSystem.syncCampStorages(camp);
      }
    }
  }

  public update(_time: number, delta: number): void {
    if (this.isMenuPaused) {
      this.campfire.update(delta * 0.5);
      return;
    }
    const simDelta = delta * this.timeScale;
    this.tweens.timeScale = this.timeScale;
    if (this.threatAlarmCooldown > 0) {
      this.threatAlarmCooldown = Math.max(0, this.threatAlarmCooldown - simDelta);
    }

    this.rebuildObstacleCache();
    this.updateCalendar(simDelta);
    this.campfire.update(simDelta);
    this.lake.update(simDelta);
    this.river.update(simDelta);

    for (const hut of this.huts) {
      hut.update(simDelta);
    }

    for (const b of this.buildings) {
      if (b.scene) b.update(simDelta);
    }
    this.buildings = this.buildings.filter((b) => Boolean(b.scene));

    for (const animal of this.animals) {
      if (animal.isAlive()) animal.update(simDelta);
    }
    this.animals = this.animals.filter((a) => a.isAlive());
    this.carcasses = this.carcasses.filter((c) => Boolean(c.scene) && !c.isEmpty());

    for (const pred of this.predators) {
      if (pred.isAlive()) pred.update(simDelta);
    }
    this.predators = this.predators.filter((p) => p.isAlive());

    this.rivalSystem.update(simDelta);

    for (const node of this.resourceNodes) {
      if (node.scene) node.update(simDelta);
    }
    this.resourceNodes = this.resourceNodes.filter((n) => Boolean(n.scene));

    for (const villager of [...this.villagers]) {
      if (villager.scene) villager.update(simDelta);
    }

    this.proximityCheckTimer += simDelta;
    if (this.proximityCheckTimer >= 350) {
      this.proximityCheckTimer = 0;
      this.checkProximityDefense();
    }

    // Keep selection live
    const prevLen = this.selectedVillagers.length;
    this.selectedVillagers = this.selectedVillagers.filter((v) => v.isAlive());
    if (prevLen !== this.selectedVillagers.length || this.selectedVillagers.length > 0) {
      this.emitSelection();
    }

    if (this.selectedBuilding) {
      if (!this.selectedBuilding.scene) {
        this.selectBuilding(null);
      } else {
        this.events.emit('building-selected', this.selectedBuilding.getSnapshot());
      }
    }

    if (this.isBuildMode) {
      if (this.isTouchBuildPreview) {
        this.updateBuildGhostAtWorld(this.buildGhostWorldX, this.buildGhostWorldY);
      } else {
        this.updateBuildGhostAtPointer(this.input.activePointer);
      }
    }

    this.checkTribeBreeding(simDelta);
    this.updateCloudShadows(simDelta);
    this.weather.update(simDelta);
    this.updateFogOfWar(delta);
    this.handleKeyboardCamera(delta);

    this.minimapEmitTimer += delta;
    if (this.minimapEmitTimer >= 220) {
      this.minimapEmitTimer = 0;
      this.emitMinimap();
      this.emitAlarm();
      this.emitRivals();
      this.emitRoster();
    }
  }

  private updateFogOfWar(delta: number): void {
    const viewers: FogViewer[] = [
      { x: this.playerBaseX, y: this.playerBaseY, radius: 460 }
    ];
    for (const v of this.villagers) {
      if (v.isAlive()) {
        viewers.push({ x: v.x, y: v.y, radius: v.warriorClass ? 340 : 280 });
      }
    }
    for (const h of this.huts) {
      if (h.isComplete()) viewers.push({ x: h.x, y: h.y, radius: 260 });
    }
    for (const b of this.buildings) {
      if (b.scene && b.isComplete()) {
        viewers.push({
          x: b.x,
          y: b.y,
          radius: b.buildingType === 'watchtower' ? 480 : 260
        });
      }
    }
    this.fogSystem.update(delta, viewers);
  }

  private emitRivals(): void {
    if (!this.rivalSystem) return;
    this.events.emit('rivals-updated', this.rivalSystem.getSnapshots());
  }

  private emitRoster(): void {
    const adults = this.villagers
      .filter((v) => v.isAlive() && !v.isChild)
      .map((v) => v.getRosterItem());
    this.events.emit('roster-updated', adults);
  }

  private emitResources(): void {
    this.events.emit('resources-updated', {
      ...this.resources,
      weapons: { ...this.resources.weapons },
      armors: { ...this.resources.armors }
    });
  }

  private emitPopulation(): void {
    const warriors = this.villagers.filter((v) => v.isAlive() && v.warriorClass !== null).length;
    const payload: PopulationState = {
      count: this.villagers.length,
      cap: this.populationCap,
      warriors,
      warriorCap: this.warriorCap
    };
    this.events.emit('population-updated', payload);
  }

  private emitCalendar(): void {
    const freeCount = this.villagers.filter((v) => v.isAlive() && v.isFreeTime).length;
    const payload: CalendarState = {
      season: this.season,
      year: this.year,
      elapsedMs: this.seasonElapsedMs,
      durationMs: SEASON_DURATION_MS,
      timeScale: this.timeScale,
      isFreeTime: freeCount > 0,
      freeTimeRemainingMs: Math.max(0, SEASON_DURATION_MS - this.seasonElapsedMs),
      mode: this.gameConfig.mode,
      canSkipSeason: this.gameConfig.mode === 'sandbox'
    };
    this.events.emit('calendar-updated', payload);
  }

  private emitChiefStatus(): void {
    const chief = this.chiefId
      ? this.villagers.find((v) => v.id === this.chiefId && v.scene)
      : undefined;
    if (!chief) {
      this.chiefId = null;
    }
    const payload: ChiefStatus = {
      chiefId: chief ? chief.id : null,
      chiefName: chief ? chief.villagerName : null
    };
    this.events.emit('chief-updated', payload);
  }

  private emitTech(): void {
    this.events.emit('tech-updated', { ...this.techLevels });
  }

  private emitAlarm(): void {
    const threatCount = this.countNearbyPlayerThreats();
    this.events.emit('alarm-updated', {
      active: this.manualAlarmActive || threatCount > 0,
      manual: this.manualAlarmActive,
      threatCount
    });
  }

  private emitSelection(): void {
    const alive = this.villagers.filter((v) => v.isAlive());
    const single = this.selectedVillagers.length === 1 ? this.selectedVillagers[0].getSnapshot() : null;
    const summary: SelectionSummary = {
      count: this.selectedVillagers.length,
      idleCount: this.selectedVillagers.filter((v) => v.isIdleFree()).length,
      warriorCount: this.selectedVillagers.filter((v) => v.warriorClass !== null).length,
      workingCount: this.selectedVillagers.filter(
        (v) => !v.isIdleFree() && v.warriorClass === null && !v.isChild
      ).length,
      totalTribe: alive.length,
      totalIdle: alive.filter((v) => v.isIdleFree()).length,
      totalWarriors: alive.filter((v) => v.warriorClass !== null).length
    };
    this.events.emit('selection-updated', { single, summary });
  }

  private emitMinimap(): void {
    const cam = this.cameras.main;
    const data: MinimapData = {
      worldW: this.worldWidth,
      worldH: this.worldHeight,
      camX: cam.worldView.x,
      camY: cam.worldView.y,
      camW: cam.worldView.width,
      camH: cam.worldView.height,
      playerCamp: { x: this.playerBaseX, y: this.playerBaseY },
      lake: { x: this.lake.x, y: this.lake.y },
      riverPoints: this.river ? this.river.getMinimapPoints() : [],
      playerUnits: this.villagers
        .filter((v) => v.isAlive())
        .map((v) => ({
          x: v.x,
          y: v.y,
          isWarrior: v.warriorClass !== null,
          selected: this.selectedVillagers.includes(v)
        })),
      predators: this.predators.filter((p) => p.isAlive()).map((p) => ({ x: p.x, y: p.y })),
      rivals: this.rivalSystem.camps.map((c) => ({
        x: c.x,
        y: c.y,
        color: c.color,
        pop: c.population,
        alive: c.alive,
        discovered: c.discovered,
        nameUk: c.nameUk
      })),
      enemyUnits: this.rivalSystem.units
        .filter((u) => u.isAlive() && this.fogSystem.isVisibleAt(u.x, u.y))
        .map((u) => ({ x: u.x, y: u.y, color: u.tribeColor })),
      fogEnabled: this.fogSystem.isEnabled()
    };
    this.events.emit('minimap-updated', data);
  }

  private cycleTimeScale(): void {
    this.timeScale = this.timeScale === 1 ? 2 : this.timeScale === 2 ? 4 : 1;
    this.emitCalendar();
    this.showFloatingText(
      this.campfire.x,
      this.campfire.y - 68,
      `⏩ Швидкість часу: ${this.timeScale}x`
    );
  }

  private updateCalendar(simDelta: number): void {
    this.seasonElapsedMs += simDelta;

    if (
      this.season === 'SPRING' &&
      !this.springRipened &&
      this.seasonElapsedMs >= SEASON_DURATION_MS * 0.5
    ) {
      this.springRipened = true;
      for (const node of this.resourceNodes) {
        if (node.scene && node.resourceType === 'food') {
          node.setSeason('SPRING', true);
        }
      }
      this.showFloatingText(
        this.campfire.x,
        this.campfire.y - 68,
        '🌸 Ягоди на кущах дозріли!'
      );
    }

    // Individual staggered 2-minute Free Time window for each adult (couples share their window)
    for (const v of this.villagers) {
      if (v.isAlive()) {
        v.checkPersonalFreeTime(this.seasonElapsedMs);
      }
    }
    this.isFreeTimeActive = this.villagers.some((v) => v.isAlive() && v.isFreeTime);

    if (this.seasonElapsedMs >= SEASON_DURATION_MS) {
      this.seasonElapsedMs -= SEASON_DURATION_MS;
      this.advanceSeason(false);
    } else {
      this.calendarEmitTimer += simDelta;
      if (this.calendarEmitTimer >= 250) {
        this.calendarEmitTimer = 0;
        this.emitCalendar();
      }
    }
  }

  private advanceSeason(resetTimer: boolean): void {
    this.seasonIndex = (this.seasonIndex + 1) % SEASON_ORDER.length;
    this.season = SEASON_ORDER[this.seasonIndex];
    if (resetTimer) {
      this.seasonElapsedMs = 0;
    }
    this.springRipened = false;
    this.isFreeTimeActive = false;
    this.year += YEARS_PER_SEASON_CHANGE;

    this.applySeasonToWorld();
    const preset = MAP_PRESETS[this.gameConfig.mapId] ?? MAP_PRESETS.river_valley;
    if (this.season === 'SUMMER' && preset.id !== 'depleting_world') {
      this.tryRegrowSummerTrees(5);
    }
    if (this.season !== 'WINTER') {
      this.ensureSeasonalWildlife();
      this.ensureSeasonalPredators();
    }
    this.rivalSystem.onSeasonChanged();
    for (const b of this.buildings) {
      if (b.scene && b.isComplete()) {
        b.onSeasonChanged();
      }
    }

    const spouseTimes = new Map<string, number>();
    for (const v of [...this.villagers]) {
      if (v.scene) {
        let sharedTime: number | undefined;
        if (v.spouseId && spouseTimes.has(v.spouseId)) {
          sharedTime = spouseTimes.get(v.spouseId);
        }
        v.onNewSeason(sharedTime);
        spouseTimes.set(v.id, v.freeTimeStartMs);
        v.exitFreeTimeAndResume();
        v.advanceAge(YEARS_PER_SEASON_CHANGE);
      }
    }

    this.emitCalendar();
    this.emitPopulation();
    this.emitChiefStatus();
    this.emitSelection();

    const msg = `${SEASON_ICONS[this.season]} Настала ${SEASON_LABELS_UK[this.season]} (Рік ${this.year})! (+${YEARS_PER_SEASON_CHANGE} роки)`;
    this.showFloatingText(this.campfire.x, this.campfire.y - 74, msg);
  }

  private applySeasonToWorld(): void {
    const preset = MAP_PRESETS[this.gameConfig.mapId] ?? MAP_PRESETS.river_valley;
    const seasonKey = this.season.toLowerCase();
    for (const g of this.groundTiles) {
      if (preset.biome === 'desert_split' && g.tile.x < this.worldWidth * 0.48 + Math.sin(g.tile.y * 0.003) * 260) {
        g.tile.setTexture(this.season === 'WINTER' ? `grass-winter-${g.variant}` : `terrain-sand-${g.variant}`);
      } else if (preset.biome === 'permafrost') {
        g.tile.setTexture(`terrain-permafrost-${g.variant}`);
      } else {
        g.tile.setTexture(`grass-${seasonKey}-${g.variant}`);
      }
    }
    for (const f of this.flowerDecals) {
      if (this.season === 'WINTER' || preset.biome === 'permafrost') {
        f.setVisible(false);
      } else {
        f.setVisible(true);
        f.setAlpha(this.season === 'AUTUMN' ? 0.55 : 0.88);
      }
    }
    this.lake.setSeason(this.season);
    if (this.river) {
      this.river.setSeason(this.season);
    }
    for (const hut of this.huts) {
      hut.setSeason(this.season);
    }
    for (const b of this.buildings) {
      if (b.scene) b.setSeason(this.season);
    }
    for (const node of this.resourceNodes) {
      if (node.scene) {
        node.setSeason(this.season, this.springRipened);
      }
    }
    if (this.buildGhost && this.buildType) {
      this.buildGhost.setTexture(this.getGhostTextureKey(this.buildType));
    }
    this.weather.setSeason(this.season);
  }

  private getGhostTextureKey(type: BuildingType): string {
    const w = this.season === 'WINTER';
    if (type === 'hut') {
      return w ? 'hut-stage-3-winter' : 'hut-stage-3';
    }
    return w ? `building-${type}-2-winter` : `building-${type}-2`;
  }

  private tryRegrowSummerTrees(maxNewTrees: number): void {
    const currentWood = this.resourceNodes.filter(
      (n) => n.scene && n.resourceType === 'wood' && !n.isDepleted()
    ).length;
    if (currentWood >= 45) return;

    const needed = Math.min(maxNewTrees, 45 - currentWood);
    let spawned = 0;

    for (let i = 0; i < needed; i++) {
      for (let attempt = 0; attempt < 20; attempt++) {
        const x = Phaser.Math.Between(140, this.worldWidth - 140);
        const y = Phaser.Math.Between(140, this.worldHeight - 140);
        if (!this.isClearWildernessSpot(x, y, 100)) continue;

        const tree = new ResourceNode(this, x, y, 'wood', 22, {
          isSapling: true,
          onDepleted: (depleted) => this.handleResourceDepleted(depleted)
        });
        tree.setSeason(this.season, false);
        this.resourceNodes.push(tree);
        spawned += 1;
        break;
      }
    }

    if (spawned > 0) {
      this.showFloatingText(
        this.playerBaseX,
        this.playerBaseY - 106,
        `🌱 Влітку виросли молоді дерева (+${spawned})`
      );
    }
  }

  private electChief(villagerId: string): void {
    const existingChief = this.chiefId
      ? this.villagers.find((v) => v.id === this.chiefId && v.scene)
      : undefined;
    if (existingChief) {
      this.showFloatingText(existingChief.x, existingChief.y - 60, 'Вождь уже обраний!');
      SoundFX.playBlocked();
      return;
    }

    const candidate = this.villagers.find((v) => v.id === villagerId && v.scene && !v.isChild);
    if (!candidate) return;

    this.chiefId = candidate.id;
    candidate.setChief(true);
    SoundFX.playFanfare();
    this.showFloatingText(
      candidate.x,
      candidate.y - 64,
      `💀 ${candidate.villagerName} обраний Вождем племені!`
    );
    this.emitChiefStatus();
    this.emitSelection();
  }

  private handleVillagerStartedDying(dying: Villager): void {
    this.showFloatingText(
      dying.x,
      dying.y - 72,
      `🕯️ ${dying.villagerName} прощається з рідними…`
    );
    const relatives = this.villagers.filter(
      (v) =>
        v !== dying &&
        v.scene &&
        !v.isDying &&
        (v.familyId === dying.familyId || v.id === dying.spouseId)
    );
    relatives.forEach((rel, i) => {
      const a = -0.3 + i * 0.85;
      const sx = Phaser.Math.Clamp(dying.x + Math.cos(a) * 36, 55, this.worldWidth - 55);
      const sy = Phaser.Math.Clamp(dying.y + Math.sin(a) * 26 + 10, 65, this.worldHeight - 55);
      rel.startMourningFor(dying, sx, sy);
    });
  }

  private handleVillagerDeath(villager: Villager, record: AncestorRecord, customText?: string): void {
    const idx = this.villagers.indexOf(villager);
    if (idx !== -1) {
      this.villagers.splice(idx, 1);
    }

    const deadX = Phaser.Math.Clamp(villager.x, 70, this.worldWidth - 70);
    const deadY = Phaser.Math.Clamp(villager.y, 90, this.worldHeight - 70);
    const deadName = villager.villagerName;
    const deadAge = villager.age;
    const wasChief = villager.isChief;

    this.selectedVillagers = this.selectedVillagers.filter((v) => v !== villager);
    villager.disposeOnDeath();

    if (wasChief) {
      this.chiefId = null;
    }

    this.ancestors.unshift(record);
    this.events.emit('chronicle-updated', [...this.ancestors]);

    const mound = this.buildings.find((b) => b.buildingType === 'burial_mound' && b.isComplete());
    const destX = mound ? mound.x : deadX;
    const destY = mound ? mound.y - 24 : deadY - 90;
    const spirit = this.add.circle(deadX, deadY - 14, 6, 0xfef08a, 0.92).setDepth(3000);
    this.tweens.add({
      targets: spirit,
      x: destX,
      y: destY,
      alpha: 0,
      scale: 0.4,
      duration: 1400,
      ease: 'Cubic.easeOut',
      onComplete: () => spirit.destroy()
    });

    SoundFX.playMemorial();
    this.showFloatingText(
      deadX,
      deadY - 72,
      customText ??
        (mound
          ? `⛩️ ${deadName} (${formatAgeUk(deadAge)}) похований у Кургані`
          : `🕯️ ${deadName} відійшов у вічність (${formatAgeUk(deadAge)})`)
    );

    if (wasChief) {
      this.showFloatingText(
        this.campfire.x,
        this.campfire.y - 102,
        '💀 Племʼя без вождя — оберіть наступника!'
      );
    }

    this.emitPopulation();
    this.emitChiefStatus();
    this.emitSelection();
  }

  private toggleBuildMode(type: BuildingType): void {
    if (this.isBuildMode && this.buildType === type) {
      this.setBuildMode(null);
    } else {
      this.setBuildMode(type);
    }
  }

  private setBuildMode(type: BuildingType | null): void {
    this.buildType = type;
    this.isBuildMode = type !== null;
    this.lastBuildPreviewValid = null;
    this.lastBuildPreviewCanAfford = null;

    if (this.buildGhost && this.buildGhostRing) {
      if (type) {
        this.buildGhost.setTexture(this.getGhostTextureKey(type));
        this.buildGhost.setVisible(true);
        this.buildGhostRing.setVisible(true);

        const isTouchMode =
          this.sys.game.device.input.touch || this.input.activePointer.wasTouch;
        if (isTouchMode) {
          this.isTouchBuildPreview = true;
          const cam = this.cameras.main;
          this.updateBuildGhostAtWorld(cam.midPoint.x, cam.midPoint.y);
        } else {
          this.isTouchBuildPreview = false;
          this.updateBuildGhostAtPointer(this.input.activePointer);
        }
      } else {
        this.isTouchBuildPreview = false;
        this.buildGhost.setVisible(false);
        this.buildGhostRing.setVisible(false);
      }
    }
    this.events.emit('build-mode-updated', type);
  }

  private createBuildGhost(): void {
    this.buildGhostRing = this.add.ellipse(0, 0, 144, 66, 0x86efac, 0.28);
    this.buildGhostRing.setStrokeStyle(2.5, 0x4ade80, 0.95);
    this.buildGhostRing.setDepth(2999);
    this.buildGhostRing.setVisible(false);

    this.buildGhost = this.add.image(0, 0, 'hut-stage-3');
    this.buildGhost.setOrigin(0.5, 0.825);
    this.buildGhost.setAlpha(0.62);
    this.buildGhost.setDepth(3000);
    this.buildGhost.setVisible(false);
  }

  private canAffordBuilding(type: BuildingType): boolean {
    const def = BUILDING_DEFS[type];
    return (
      this.resources.wood >= def.wood &&
      this.resources.stone >= def.stone &&
      this.resources.bone >= (def.bone ?? 0) &&
      this.resources.hide >= (def.hide ?? 0)
    );
  }

  private updateBuildGhostAtPointer(pointer: Phaser.Input.Pointer): void {
    if (!this.buildType) return;
    const worldPt = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.updateBuildGhostAtWorld(worldPt.x, worldPt.y);
  }

  private updateBuildGhostAtWorld(wx: number, wy: number): void {
    if (!this.buildGhost || !this.buildGhostRing || !this.buildType) return;
    this.buildGhostWorldX = wx;
    this.buildGhostWorldY = wy;

    this.buildGhost.setPosition(wx, wy);
    this.buildGhostRing.setPosition(wx, wy + 4);

    const canAfford = this.canAffordBuilding(this.buildType);
    const valid = canAfford && this.canPlaceBuildingAt(wx, wy, this.buildType);

    if (valid) {
      this.buildGhost.setTint(0xa7f3d0);
      this.buildGhostRing.setFillStyle(0x4ade80, 0.25);
      this.buildGhostRing.setStrokeStyle(2.5, 0x4ade80, 0.95);
    } else {
      this.buildGhost.setTint(0xfca5a5);
      this.buildGhostRing.setFillStyle(0xef4444, 0.25);
      this.buildGhostRing.setStrokeStyle(2.5, 0xef4444, 0.95);
    }

    if (
      valid !== this.lastBuildPreviewValid ||
      canAfford !== this.lastBuildPreviewCanAfford
    ) {
      this.lastBuildPreviewValid = valid;
      this.lastBuildPreviewCanAfford = canAfford;
      this.events.emit('build-preview-status', { valid, canAfford });
    }
  }

  private canPlaceBuildingAt(wx: number, wy: number, type: BuildingType): boolean {
    if (wx < 110 || wx > this.worldWidth - 110 || wy < 130 || wy > this.worldHeight - 100) {
      return false;
    }
    const minCampDist = type === 'palisade' ? 115 : 150;
    if (Phaser.Math.Distance.Between(wx, wy, this.campfire.x, this.campfire.y) < minCampDist) {
      return false;
    }
    if (!this.campfireStoragesHidden) {
      for (const st of Object.values(this.storages)) {
        if (Phaser.Math.Distance.Between(wx, wy, st.x, st.y) < 105) {
          return false;
        }
      }
    }
    if (Phaser.Math.Distance.Between(wx, wy, this.lake.x, this.lake.y) < 210) {
      return false;
    }
    if (this.river && this.river.isPointInFishableWater(wx, wy)) {
      return false;
    }
    for (const c of this.rivalSystem.camps) {
      if (Phaser.Math.Distance.Between(wx, wy, c.x, c.y) < 220) {
        return false;
      }
    }
    // Only Infinite Rock Quarries block placement; finite trees/stones/bushes are cleared on build!
    for (const node of this.resourceNodes) {
      if (node.scene && node.isInfinite && Phaser.Math.Distance.Between(wx, wy, node.x, node.y) < 120) {
        return false;
      }
    }
    const hutGap = type === 'palisade' ? 88 : 132;
    for (const hut of this.huts) {
      if (Phaser.Math.Distance.Between(wx, wy, hut.x, hut.y) < hutGap) {
        return false;
      }
    }
    for (const b of this.buildings) {
      if (!b.scene) continue;
      const gap = type === 'palisade' && b.buildingType === 'palisade' ? 68 : type === 'palisade' ? 88 : 132;
      if (Phaser.Math.Distance.Between(wx, wy, b.x, b.y) < gap) {
        return false;
      }
    }
    return true;
  }

  private tryPlaceBuildingAt(wx: number, wy: number): void {
    if (!this.buildType) return;
    const def = BUILDING_DEFS[this.buildType];
    if (!this.canAffordBuilding(this.buildType)) {
      this.showFloatingText(wx, wy - 20, 'Недостатньо ресурсів для споруди!');
      SoundFX.playBlocked();
      return;
    }
    if (!this.canPlaceBuildingAt(wx, wy, this.buildType)) {
      this.showFloatingText(wx, wy - 20, 'Тут не можна будувати!');
      SoundFX.playBlocked();
      return;
    }

    this.resources.wood -= def.wood;
    this.resources.stone -= def.stone;
    if (def.bone) this.resources.bone -= def.bone;
    if (def.hide) this.resources.hide -= def.hide;
    this.syncStorageAmounts();
    this.emitResources();

    // Clear any encroaching trees, stumps, stones, or bushes inside the building's footprint
    for (const node of [...this.resourceNodes]) {
      if (node.scene && !node.isInfinite && Phaser.Math.Distance.Between(wx, wy, node.x, node.y) < 110) {
        node.clearNode();
      }
    }

    const placedType = this.buildType;
    let buildTarget: Hut | TribeBuilding;
    if (placedType === 'hut' || placedType === 'large_hut') {
      const isLarge = placedType === 'large_hut';
      const hut = new Hut(
        this,
        wx,
        wy,
        (completedHut) => this.handleHutCompleted(completedHut),
        (bHut, parentA, parentB) => this.handleBirthReady(bHut, parentA, parentB),
        isLarge
      );
      hut.setSeason(this.season);
      this.huts.push(hut);
      buildTarget = hut;
    } else {
      this.buildingCounter += 1;
      const tb = new TribeBuilding(
        this,
        wx,
        wy,
        `bld-${this.buildingCounter}`,
        placedType,
        (completedB) => this.handleBuildingCompleted(completedB),
        () => this.openChronicle(),
        {
          onOpenTech: () => this.events.emit('open-tech-modal'),
          onCaptiveConverted: (captive, building) => this.spawnConvertedCaptiveVillager(captive, building),
          findTowerTarget: (tx, ty, range) => this.findNearestHostileForPlayer(tx, ty, range),
          getWeaponTechTier: () => this.techLevels.weapons,
          getWarriorSlots: () => ({
            used: this.villagers.filter((v) => v.isAlive() && v.warriorClass !== null).length,
            max: this.warriorCap
          })
        }
      );
      tb.setSeason(this.season);
      this.buildings.push(tb);
      buildTarget = tb;
    }

    SoundFX.playOrder();
    this.spawnTargetRing(wx, wy + 4, 0xfbbf24, true);
    this.setBuildMode(null);

    let assigned = 0;
    for (const v of this.villagers) {
      if (v.isAvailableForBuild()) {
        v.issueBuildOrder(buildTarget);
        assigned += 1;
        if (assigned >= 2) break;
      }
    }
  }

  private handleBuildingCompleted(b: TribeBuilding): void {
    SoundFX.playBuildComplete();
    if (b.buildingType === 'granary') {
      this.storageCap += GRANARY_STORAGE_BONUS;
      this.resources.storageCap = this.storageCap;
      for (const st of Object.values(this.storages)) {
        st.setMaxCapacity(this.storageCap);
        st.setVisible(false);
        st.disableInteractive();
      }
      for (const decal of this.campfirePathDecals) {
        decal.setVisible(false);
      }
      this.campfireStoragesHidden = true;
      this.emitResources();
      this.showFloatingText(
        b.x,
        b.y - 72,
        `🏠 Комора зведена! Склади біля вогнища прибрано (+${GRANARY_STORAGE_BONUS} місткості)`
      );
    } else if (b.buildingType === 'workshop') {
      this.showFloatingText(b.x, b.y - 68, '🛠️ Майстерня зведена! (інструменти з кісток, запас +5)');
    } else if (b.buildingType === 'armory') {
      this.showFloatingText(b.x, b.y - 68, '⚔️ Зброярня зведена! (зброя та броня, запас +10)');
    } else if (b.buildingType === 'barracks') {
      this.recomputeWarriorCap();
      this.emitPopulation();
      this.showFloatingText(
        b.x,
        b.y - 68,
        `🛡️ Казарма зведена! (ліміт воїнів: ${b.targetWarriors})`
      );
    } else if (b.buildingType === 'nursery') {
      this.showFloatingText(b.x, b.y - 68, '🍼 Ясла зведені! Діти племені в безпеці');
    } else if (b.buildingType === 'gatherer_hut') {
      this.showFloatingText(b.x, b.y - 68, '🧺 Хатина збирача зведена! (до 3 збирачів)');
    } else if (b.buildingType === 'watchtower') {
      this.showFloatingText(b.x, b.y - 68, '🏹 Сторожова вежа зведена!');
    } else if (b.buildingType === 'smokehouse') {
      this.showFloatingText(b.x, b.y - 68, '🔥 Коптильня зведена!');
    } else if (b.buildingType === 'totem') {
      this.showFloatingText(b.x, b.y - 68, '🗿 Тотем Шамана зведено! (технології та лікування)');
    } else if (b.buildingType === 'palisade') {
      this.showFloatingText(b.x, b.y - 54, '🪵 Частокіл укріплено!');
    } else if (b.buildingType === 'burial_mound') {
      this.events.emit('chronicle-updated', [...this.ancestors]);
      this.showFloatingText(b.x, b.y - 68, '⛩️ Курган Предків збудовано! (Хроніка)');
    }
  }

  private evaluateCraftingPlan(buildingType: 'workshop' | 'armory'): CraftPlan {
    const livingAdults = this.villagers.filter((v) => v.isAlive() && !v.isChild).length;
    const equippedTools = this.villagers.filter(
      (v) => v.isAlive() && !v.isChild && v.hasCraftedTools
    ).length;
    const toolLimit = livingAdults + TOOL_RESERVE_BUFFER;
    const needTools = Math.max(0, toolLimit - (equippedTools + this.resources.tools));

    const canPay = (cost: Partial<Record<ResourceType, number>>): boolean => {
      return (
        this.resources.wood >= (cost.wood ?? 0) &&
        this.resources.stone >= (cost.stone ?? 0) &&
        this.resources.bone >= (cost.bone ?? 0) &&
        this.resources.hide >= (cost.hide ?? 0)
      );
    };

    const missingText = (cost: Partial<Record<ResourceType, number>>): string => {
      const miss: string[] = [];
      if (this.resources.wood < (cost.wood ?? 0)) miss.push('дерево');
      if (this.resources.stone < (cost.stone ?? 0)) miss.push('камінь');
      if (this.resources.bone < (cost.bone ?? 0)) miss.push('кістки');
      if (this.resources.hide < (cost.hide ?? 0)) miss.push('шкури');
      return `Очікує сировину: ${miss.join(', ')}`;
    };

    if (buildingType === 'workshop') {
      if (needTools > 0) {
        if (canPay(TOOL_CRAFT_COST)) {
          return {
            canWork: true,
            kind: 'tool',
            cost: { ...TOOL_CRAFT_COST },
            statusText: `Кує інструменти (ліміт ${livingAdults}+5)`
          };
        }
        return {
          canWork: false,
          statusText: missingText(TOOL_CRAFT_COST)
        };
      }
      // If tools limit reached and no active armory, workshop can also forge backup spears
      const hasArmory = this.buildings.some(
        (b) => b.scene && b.buildingType === 'armory' && b.isComplete() && b.getAssignedWorker()
      );
      if (hasArmory) {
        return {
          canWork: false,
          statusText: `Ліміт інструментів (${livingAdults}+5) досягнуто`
        };
      }
    }

    // Weapon & armor needs for warriors without gear + 10 defense reserve each
    const warriors = this.villagers.filter((v) => v.isAlive() && v.warriorClass !== null);
    const weaponTypes: WeaponType[] = ['spear', 'bow', 'club'];
    let anyUnderCap = false;

    for (const wt of weaponTypes) {
      const needing = warriors.filter(
        (w) => WARRIOR_CLASS_WEAPON[w.warriorClass!] === wt && w.equippedWeapon !== wt
      ).length;
      const targetReserve = needing + GEAR_DEFENSE_RESERVE;
      if (this.resources.weapons[wt] < targetReserve) {
        anyUnderCap = true;
        const def = WEAPON_DEFS[wt];
        const cost = { wood: def.wood, stone: def.stone, bone: def.bone, hide: def.hide };
        if (canPay(cost)) {
          return {
            canWork: true,
            kind: wt,
            cost,
            statusText: `Виготовляє: ${def.nameUk} (резерв 10)`
          };
        }
      }
    }

    const armorTypes: Array<Exclude<ArmorType, 'none'>> = ['bone_armor', 'hide_armor'];
    for (const at of armorTypes) {
      const needingArmor = warriors.filter((w) => w.equippedArmor === 'none').length;
      const targetReserve =
        at === 'bone_armor' ? needingArmor + GEAR_DEFENSE_RESERVE : GEAR_DEFENSE_RESERVE;
      if (this.resources.armors[at] < targetReserve) {
        anyUnderCap = true;
        const def = ARMOR_DEFS[at];
        const cost = { bone: def.bone, hide: def.hide };
        if (canPay(cost)) {
          return {
            canWork: true,
            kind: at,
            cost,
            statusText: `Шиття: ${def.nameUk} (резерв 10)`
          };
        }
      }
    }

    if (!anyUnderCap) {
      return {
        canWork: false,
        statusText: 'Ліміт зброї та броні (+10) заповнено'
      };
    }

    return {
      canWork: false,
      statusText: 'Очікує сировину (кістки / шкури / дерево)'
    };
  }

  private completeCraftingStation(building: TribeBuilding): void {
    const type = building.buildingType === 'workshop' ? 'workshop' : 'armory';
    const plan = this.evaluateCraftingPlan(type);
    if (!plan.canWork || !plan.kind || !plan.cost) {
      building.statusNote = plan.statusText;
      return;
    }

    this.resources.wood -= plan.cost.wood ?? 0;
    this.resources.stone -= plan.cost.stone ?? 0;
    this.resources.bone -= plan.cost.bone ?? 0;
    this.resources.hide -= plan.cost.hide ?? 0;
    this.syncStorageAmounts();

    if (plan.kind === 'tool') {
      this.resources.tools += 1;
      this.showFloatingText(building.x, building.y - 68, '🛠️ Виготовлено інструменти!');
      this.tryAutoEquipCraftedTools();
    } else if (plan.kind === 'spear' || plan.kind === 'bow' || plan.kind === 'club') {
      this.resources.weapons[plan.kind] += 1;
      this.showFloatingText(
        building.x,
        building.y - 68,
        `⚔️ Виготовлено: ${WEAPON_DEFS[plan.kind].nameUk}!`
      );
      this.tryAutoEquipWarriors();
    } else {
      this.resources.armors[plan.kind] += 1;
      this.showFloatingText(
        building.x,
        building.y - 68,
        `🛡️ Готова: ${ARMOR_DEFS[plan.kind].nameUk}!`
      );
      this.tryAutoEquipWarriors();
    }

    this.emitResources();
  }

  private tryAutoEquipCraftedTools(): void {
    while (this.resources.tools > 0) {
      const candidate = this.villagers.find(
        (v) => v.scene && !v.isChild && !v.isDying && !v.hasCraftedTools
      );
      if (!candidate) break;
      this.resources.tools -= 1;
      candidate.equipCraftedTools();
      this.showFloatingText(
        candidate.x,
        candidate.y - 62,
        `🛠️ ${candidate.villagerName} отримав інструменти (x2 швидкість)!`
      );
      this.emitResources();
    }
  }

  private tryAutoEquipWarriors(): void {
    for (const v of this.villagers) {
      if (!v.isAlive() || !v.warriorClass) continue;
      const neededW = WARRIOR_CLASS_WEAPON[v.warriorClass];
      if (v.equippedWeapon !== neededW && this.resources.weapons[neededW] > 0) {
        this.resources.weapons[neededW] -= 1;
        v.equipWeapon(neededW);
      }
      if (v.equippedArmor === 'none') {
        if (this.resources.armors.bone_armor > 0) {
          this.resources.armors.bone_armor -= 1;
          v.equipArmor('bone_armor');
        } else if (this.resources.armors.hide_armor > 0) {
          this.resources.armors.hide_armor -= 1;
          v.equipArmor('hide_armor');
        }
      }
    }
  }

  private recomputeWarriorCap(): void {
    let total = 0;
    for (const b of this.buildings) {
      if (b.scene && b.isComplete() && b.buildingType === 'barracks') {
        total += b.targetWarriors;
      }
    }
    this.warriorCap = total;
  }

  private adjustBarracksTarget(buildingId: string, delta: number): void {
    const b = this.buildings.find(
      (item) => item.buildingId === buildingId && item.scene && item.buildingType === 'barracks'
    );
    if (!b || !b.isComplete()) return;
    b.setTargetWarriors(b.targetWarriors + delta);
    this.recomputeWarriorCap();
    this.emitPopulation();
    this.events.emit('building-selected', b.getSnapshot());
  }

  private demolishBuildingById(buildingId: string): void {
    const b = this.buildings.find((item) => item.buildingId === buildingId && item.scene);
    if (!b) return;
    const def = BUILDING_DEFS[b.buildingType];
    const refundW = Math.floor(def.wood * 0.45);
    const refundS = Math.floor(def.stone * 0.45);
    this.resources.wood = Math.min(this.storageCap, this.resources.wood + refundW);
    this.resources.stone = Math.min(this.storageCap, this.resources.stone + refundS);
    this.syncStorageAmounts();

    const bx = b.x;
    const by = b.y;
    const bName = b.nameUk;
    const bType = b.buildingType;

    if (this.selectedBuilding === b) {
      this.selectBuilding(null);
    }
    b.releaseAllOccupants();
    b.destroy();
    this.buildings = this.buildings.filter((item) => item !== b && Boolean(item.scene));

    if (bType === 'barracks') {
      this.recomputeWarriorCap();
    }
    SoundFX.playHammer();
    this.showFloatingText(bx, by - 54, `🗑️ Зруйновано: ${bName} (+${refundW}🪵 +${refundS}🪨)`);
    this.emitResources();
    this.emitPopulation();
    this.emitRoster();
  }

  private assignVillagerByIdToBuilding(buildingId: string, villagerId: string): void {
    const b = this.buildings.find((item) => item.buildingId === buildingId && item.scene);
    const worker = this.villagers.find((v) => v.id === villagerId && v.isAlive() && !v.isChild);
    if (!b || !b.isComplete() || !b.profession || !worker) return;
    this.selectVillagerList([worker]);
    SoundFX.playOrder();
    worker.issueAssignBuilding(b);
    this.spawnTargetRing(b.x, b.y + 4, 0xfbbf24, true);
    this.showFloatingText(b.x, b.y - 66, `🛠️ ${worker.villagerName} → ${b.nameUk}`);
    this.events.emit('building-selected', b.getSnapshot());
    this.emitRoster();
  }

  private spawnConvertedCaptiveVillager(captive: TotemCaptive, totem: TribeBuilding): void {
    const spot = totem.getWorkSpot();
    this.childCounter += 1;
    const v = new Villager(
      this,
      spot.x + Phaser.Math.Between(-24, 24),
      spot.y + Phaser.Math.Between(6, 22),
      `conv-${this.childCounter}`,
      captive.name,
      captive.gender,
      captive.appearance,
      this.campfire,
      this.villagerCallbacks,
      20,
      {
        familyId: `fam-conv-${this.childCounter}`,
        familyName: `Рід ${captive.name}`
      },
      this.year
    );
    v.refreshMaxHealth();
    this.villagers.push(v);
    this.tryAutoEquipCraftedTools();
    SoundFX.playFanfare();
    this.showFloatingText(
      totem.x,
      totem.y - 78,
      `🌀 ${captive.name} прийняв віру Шамана й приєднався до племені!`
    );
    this.emitPopulation();
    this.emitRoster();
    if (this.selectedBuilding === totem) {
      this.events.emit('building-selected', totem.getSnapshot());
    }
  }

  private executeTradeWithTribe(req: TradeRequest): void {
    const camp = this.rivalSystem.camps.find((c) => c.id === req.tribeId && c.alive);
    if (!camp || camp.treaty !== 'alliance') {
      this.showFloatingText(
        this.campfire.x,
        this.campfire.y - 78,
        '⚠️ Торгівля доступна лише з племенами у Союзі!'
      );
      SoundFX.playBlocked();
      return;
    }
    if (this.resources[req.giveType] < req.giveAmount) {
      this.showFloatingText(
        this.campfire.x,
        this.campfire.y - 78,
        `Недостатньо ресурсу: ${RESOURCE_LABELS_UK[req.giveType]}!`
      );
      SoundFX.playBlocked();
      return;
    }
    if (this.resources[req.receiveType] >= this.storageCap) {
      this.showFloatingText(
        this.campfire.x,
        this.campfire.y - 78,
        `Склад (${RESOURCE_LABELS_UK[req.receiveType]}) переповнений!`
      );
      SoundFX.playBlocked();
      return;
    }

    this.resources[req.giveType] -= req.giveAmount;
    camp.resources[req.giveType] += req.giveAmount;
    const added = Math.min(
      req.receiveAmount,
      Math.max(0, this.storageCap - this.resources[req.receiveType])
    );
    this.resources[req.receiveType] += added;
    camp.resources[req.receiveType] = Math.max(0, camp.resources[req.receiveType] - added);
    this.rivalSystem.syncCampStorages(camp);
    this.syncStorageAmounts();
    this.emitResources();
    this.emitRivals();
    SoundFX.playDeposit();
    this.showFloatingText(
      this.campfire.x,
      this.campfire.y - 84,
      `⚖️ Обмін з «${camp.nameUk}»: -${req.giveAmount} ${RESOURCE_LABELS_UK[req.giveType]} → +${added} ${RESOURCE_LABELS_UK[req.receiveType]}`
    );
  }

  private trainWarriorAtBarracks(buildingId: string, wClass: WarriorClass, villagerId?: string): void {
    const barracks = this.buildings.find((b) => b.buildingId === buildingId && b.scene);
    if (!barracks || !barracks.isComplete()) return;

    const currentWarriors = this.villagers.filter(
      (v) => v.isAlive() && v.warriorClass !== null
    ).length;
    const candidate = villagerId
      ? this.villagers.find((v) => v.id === villagerId && v.isAlive() && !v.isChild)
      : this.selectedVillagers.find((v) => v.isAlive() && !v.isChild);
    if (!candidate) {
      this.showFloatingText(barracks.x, barracks.y - 54, 'Оберіть дорослого жителя!');
      SoundFX.playBlocked();
      return;
    }

    if (candidate.warriorClass === null && currentWarriors >= this.warriorCap) {
      this.showFloatingText(
        barracks.x,
        barracks.y - 58,
        `Ліміт воїнів (${currentWarriors}/${this.warriorCap})! Збудуйте ще Казарму`
      );
      SoundFX.playBlocked();
      return;
    }

    const reqWeapon = WARRIOR_CLASS_WEAPON[wClass];
    let weapon: WeaponType | null = null;
    if (candidate.equippedWeapon === reqWeapon) {
      weapon = reqWeapon;
    } else if (this.resources.weapons[reqWeapon] > 0) {
      this.resources.weapons[reqWeapon] -= 1;
      weapon = reqWeapon;
    }

    let armor: ArmorType = candidate.equippedArmor;
    if (armor === 'none') {
      if (this.resources.armors.bone_armor > 0) {
        this.resources.armors.bone_armor -= 1;
        armor = 'bone_armor';
      } else if (this.resources.armors.hide_armor > 0) {
        this.resources.armors.hide_armor -= 1;
        armor = 'hide_armor';
      }
    }

    candidate.setWarriorRole(wClass, weapon, armor, barracks);
    SoundFX.playFanfare();
    this.showFloatingText(
      candidate.x,
      candidate.y - 62,
      `⚔️ ${candidate.villagerName} став воїном (${WARRIOR_CLASS_LABELS_UK[wClass]})!`
    );
    this.emitPopulation();
    this.emitResources();
    this.emitSelection();
    this.events.emit('building-selected', barracks.getSnapshot());
  }

  private researchTech(branch: TechBranchId): void {
    const curTier = this.techLevels[branch];
    if (curTier >= 3) {
      SoundFX.playBlocked();
      return;
    }
    const tierDef = TECH_TREE[branch].tiers[curTier];
    if (this.resources.knowledge < tierDef.cost) {
      this.showFloatingText(
        this.campfire.x,
        this.campfire.y - 78,
        `Потрібно ${tierDef.cost}✨ знань!`
      );
      SoundFX.playBlocked();
      return;
    }

    this.resources.knowledge -= tierDef.cost;
    this.techLevels[branch] = curTier + 1;
    if (branch === 'healing') {
      for (const v of this.villagers) {
        if (v.isAlive()) v.refreshMaxHealth();
      }
    }
    SoundFX.playTechUnlock();
    this.showFloatingText(
      this.campfire.x,
      this.campfire.y - 84,
      `🔮 Вивчено: ${tierDef.nameUk}!`
    );
    this.emitResources();
    this.emitTech();
    this.emitSelection();
  }

  private toggleManualDefenseAlarm(): void {
    this.manualAlarmActive = !this.manualAlarmActive;
    if (this.manualAlarmActive) {
      SoundFX.playAlarmHorn();
      const nearest = this.findNearestHostileForPlayer(this.campfire.x, this.campfire.y, 1800);
      this.showFloatingText(
        this.campfire.x,
        this.campfire.y - 96,
        '🚨 ТРИВОГА! Усі на оборону племені!'
      );
      for (const v of this.villagers) {
        if (v.isAlive() && !v.isChild) {
          v.respondToAlarm(nearest, true);
        }
      }
    } else {
      this.showFloatingText(this.campfire.x, this.campfire.y - 88, '✅ Відбій тривоги — до праці!');
      for (const v of this.villagers) {
        if (v.isAlive() && !v.isChild) {
          v.cancelAlarmDuty();
        }
      }
    }
    this.emitAlarm();
  }

  private triggerTribeAlarm(threat: CombatTarget, caller: Villager): void {
    if (this.threatAlarmCooldown <= 0) {
      this.threatAlarmCooldown = 7500;
      SoundFX.playAlarmHorn();
      this.showFloatingText(
        caller.x,
        caller.y - 68,
        `🚨 ${caller.villagerName} скликає оборону!`
      );
    }

    // Warriors anywhere nearby sprint directly to intercept attackers!
    for (const v of this.villagers) {
      if (!v.isAlive() || v.isChild) continue;
      if (v.warriorClass) {
        if (!v.isInCombat()) {
          v.respondToAlarm(threat, false);
        }
        continue;
      }
      // Armed or nearby civilians rally / grab defense weapons
      const dCaller = Phaser.Math.Distance.Between(v.x, v.y, caller.x, caller.y);
      const dCamp = Phaser.Math.Distance.Between(v.x, v.y, this.campfire.x, this.campfire.y);
      if ((dCaller <= 360 || dCamp <= 280) && v !== caller && !v.isInCombat()) {
        v.respondToAlarm(threat, false);
      }
    }
    this.emitAlarm();
  }

  private checkProximityDefense(): void {
    const campHostile = this.findNearestHostileForPlayer(this.campfire.x, this.campfire.y, 380);
    if (campHostile) {
      // Auto-engage idle warriors near campfire
      for (const v of this.villagers) {
        if (v.isAlive() && v.warriorClass && !v.isInCombat()) {
          v.issueCombatOrder(campHostile);
        }
      }
    }

    // Warn civilians near predators/raiders
    for (const v of this.villagers) {
      if (!v.isAlive() || v.isChild || v.isInCombat() || v.warriorClass) continue;
      const nearbyDanger = this.findNearestHostileForPlayer(v.x, v.y, 130);
      if (nearbyDanger) {
        if (v.equippedWeapon) {
          v.issueCombatOrder(nearbyDanger);
        } else {
          this.triggerTribeAlarm(nearbyDanger, v);
          v.respondToAlarm(nearbyDanger, false);
        }
      }
    }
  }

  private countNearbyPlayerThreats(): number {
    let count = 0;
    for (const p of this.predators) {
      if (p.isAlive() && Phaser.Math.Distance.Between(p.x, p.y, this.campfire.x, this.campfire.y) <= 520) {
        count += 1;
      }
    }
    for (const u of this.rivalSystem.units) {
      if (
        u.isAlive() &&
        (u.mode === 'RAID' ||
          Phaser.Math.Distance.Between(u.x, u.y, this.campfire.x, this.campfire.y) <= 560)
      ) {
        count += 1;
      }
    }
    return count;
  }

  private openChronicle(): void {
    this.events.emit('open-chronicle', [...this.ancestors]);
  }

  private selectBuilding(building: TribeBuilding | null): void {
    this.selectedBuilding = building;
    if (building && building.scene) {
      this.events.emit('building-selected', building.getSnapshot());
    } else {
      this.events.emit('building-selected', null);
    }
  }

  private assignSelectedToBuilding(buildingId: string): void {
    const b = this.buildings.find((item) => item.buildingId === buildingId && item.scene);
    if (!b || !b.isComplete() || !b.profession) return;
    const worker = this.selectedVillagers.find((v) => v.isAlive() && !v.isChild);
    if (!worker) {
      this.showFloatingText(b.x, b.y - 54, 'Оберіть дорослого жителя!');
      SoundFX.playBlocked();
      return;
    }
    SoundFX.playOrder();
    worker.issueAssignBuilding(b);
    this.spawnTargetRing(b.x, b.y + 4, 0xfbbf24, true);
    this.showFloatingText(b.x, b.y - 66, `🛠️ ${worker.villagerName} → ${b.nameUk}`);
    this.events.emit('building-selected', b.getSnapshot());
  }

  private handleHutCompleted(hut: Hut): void {
    const bonus = hut.isLarge ? LARGE_HUT_POP_BONUS : HUT_POP_BONUS;
    this.populationCap += bonus;
    SoundFX.playBuildComplete();
    this.showFloatingText(
      hut.x,
      hut.y - 68,
      `${hut.isLarge ? 'Велика хатина' : 'Мала хатина'} збудована! (+${bonus} населення)`
    );
    this.emitPopulation();
  }

  private checkTribeBreeding(delta: number): void {
    this.breedCheckTimer -= delta;
    if (this.breedCheckTimer > 0) return;
    this.breedCheckTimer = this.isFreeTimeActive ? 1100 : 2500;

    if (this.villagers.length >= this.populationCap || this.resources.food < BREED_MIN_FOOD) {
      return;
    }

    const availableHut = this.huts.find((h) => h.canBreedNow());
    if (!availableHut) return;

    const male = this.villagers.find(
      (v) =>
        v.gender === 'male' &&
        v.isAvailableForBreeding() &&
        Phaser.Math.Distance.Between(v.x, v.y, this.campfire.x, this.campfire.y) <= 440
    );
    const female = this.villagers.find(
      (v) =>
        v.gender === 'female' &&
        v.isAvailableForBreeding() &&
        Phaser.Math.Distance.Between(v.x, v.y, this.campfire.x, this.campfire.y) <= 440
    );

    if (male && female) {
      availableHut.reserveBreeding(male, female);
      male.startBreedingAt(availableHut, female);
      female.startBreedingAt(availableHut, male);
    }
  }

  private handleBirthReady(hut: Hut, parentA: Villager, parentB: Villager): void {
    const door = hut.getDoorPoint();
    parentA.finishBreedingExit(door.x - 18, door.y + 6);
    parentB.finishBreedingExit(door.x + 18, door.y + 6);

    if (this.villagers.length >= this.populationCap) return;

    this.childCounter += 1;
    const isFemale = Phaser.Math.Between(0, 1) === 1;
    const gender: 'male' | 'female' = isFemale ? 'female' : 'male';
    const appearance: VillagerAppearanceId = isFemale
      ? 'female'
      : Phaser.Math.Between(0, 1) === 0
        ? 'male-1'
        : 'male-2';
    const name = isFemale
      ? Phaser.Math.RND.pick(CHILD_NAMES_FEMALE)
      : Phaser.Math.RND.pick(CHILD_NAMES_MALE);

    if (!parentA.spouseId && !parentB.spouseId) {
      parentA.spouseId = parentB.id;
      parentA.spouseName = parentB.villagerName;
      parentB.spouseId = parentA.id;
      parentB.spouseName = parentA.villagerName;
      parentB.familyId = parentA.familyId;
      parentB.familyName = parentA.familyName;
    }
    parentA.childrenNames.push(name);
    parentB.childrenNames.push(name);

    const child = new Villager(
      this,
      door.x,
      door.y + 12,
      `child-${this.childCounter}`,
      name,
      gender,
      appearance,
      this.campfire,
      this.villagerCallbacks,
      0,
      {
        familyId: parentA.familyId,
        familyName: parentA.familyName,
        parentNames: [parentA.villagerName, parentB.villagerName]
      },
      this.year
    );
    child.refreshMaxHealth();
    this.villagers.push(child);
    SoundFX.playBirth();
    this.showFloatingText(hut.x, hut.y - 72, `👶 Народилася дитина (${name})!`);
    this.emitPopulation();
  }

  private createTerrain(): void {
    const tileSize = 256;
    const cols = Math.ceil(this.worldWidth / tileSize);
    const rows = Math.ceil(this.worldHeight / tileSize);
    const seasonKey = this.season.toLowerCase();

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const variant = (r + c) % 2;
        const tile = this.add.image(
          c * tileSize,
          r * tileSize,
          `grass-${seasonKey}-${variant}`
        );
        tile.setOrigin(0, 0);
        tile.setDepth(-1000);
        this.groundTiles.push({ tile, variant });
      }
    }

    const decalKeys = [
      'decal-tuft',
      'decal-tuft',
      'decal-flower-0',
      'decal-flower-1',
      'decal-pebbles'
    ];
    for (let i = 0; i < 220; i++) {
      const dx = Phaser.Math.Between(48, this.worldWidth - 48);
      const dy = Phaser.Math.Between(48, this.worldHeight - 48);
      const key = decalKeys[i % decalKeys.length];
      const decal = this.add.image(dx, dy, key);
      decal.setDepth(-995);
      decal.setAlpha(0.88);
      if (i % 2 === 0) decal.setFlipX(true);
      if (key.startsWith('decal-flower') || key === 'decal-tuft') {
        this.flowerDecals.push(decal);
      }
    }
  }

  private createCampfireAndStorages(): void {
    const cx = this.playerBaseX;
    const cy = this.playerBaseY;
    this.campfire = new Campfire(this, cx, cy);
    this.campfire.setSize(108, 108);

    const spots: Record<ResourceType, { x: number; y: number }> = {
      wood: { x: cx - 134, y: cy - 44 },
      stone: { x: cx + 134, y: cy - 44 },
      food: { x: cx, y: cy + 106 },
      bone: { x: cx - 122, y: cy + 78 },
      hide: { x: cx + 122, y: cy + 78 }
    };

    for (const target of Object.values(spots)) {
      for (let step = 1; step <= 3; step++) {
        const t = step / 4;
        const px = Phaser.Math.Linear(cx, target.x, t);
        const py = Phaser.Math.Linear(cy, target.y, t);
        const patch = this.add.image(px, py + 8, 'decal-dirt-path');
        patch.setDepth(-996);
        patch.setAlpha(0.75);
        patch.setScale(0.78);
        this.campfirePathDecals.push(patch);
      }
    }

    this.storages = {
      wood: new StorageZone(this, spots.wood.x, spots.wood.y, 'wood', RESOURCE_LABELS_UK.wood),
      stone: new StorageZone(this, spots.stone.x, spots.stone.y, 'stone', RESOURCE_LABELS_UK.stone),
      food: new StorageZone(this, spots.food.x, spots.food.y, 'food', RESOURCE_LABELS_UK.food),
      bone: new StorageZone(this, spots.bone.x, spots.bone.y, 'bone', RESOURCE_LABELS_UK.bone),
      hide: new StorageZone(this, spots.hide.x, spots.hide.y, 'hide', RESOURCE_LABELS_UK.hide)
    };
  }

  private syncStorageAmounts(): void {
    this.storages.wood.setAmount(this.resources.wood);
    this.storages.stone.setAmount(this.resources.stone);
    this.storages.food.setAmount(this.resources.food);
    this.storages.bone.setAmount(this.resources.bone);
    this.storages.hide.setAmount(this.resources.hide);
  }

  private createLake(): void {
    this.lake = new Lake(this, this.playerBaseX + 360, this.playerBaseY + 195, this.season);
  }

  private createRivalTribes(): void {
    this.rivalSystem = new RivalTribeSystem(this, {
      worldW: this.worldWidth,
      worldH: this.worldHeight,
      rivalCount: this.gameConfig.rivalCount,
      getPlayerCampPos: () => ({ x: this.playerBaseX, y: this.playerBaseY }),
      getPlayerPop: () => this.villagers.length,
      getPlayerTargets: () => this.villagers.filter((v) => v.isAlive()),
      getResourceNodes: () => this.resourceNodes,
      getObstacles: () => this.getObstacles(),
      findBlockingBarricade: (ex, ey, range) => {
        for (const b of this.buildings) {
          if (!b.isAlive() || !b.isComplete()) continue;
          if (Phaser.Math.Distance.Between(ex, ey, b.x, b.y) <= range + 28) {
            return b;
          }
        }
        return null;
      },
      onAttackTarget: (attacker, target) => {
        if (target.faction === 'player') {
          this.triggerTribeAlarm(attacker, target as Villager);
        }
      },
      onEnemyKilled: () => {
        // Slain tracking already incremented in attacker's kill handler
      },
      onRaidPlayerStarted: (tribeNameUk, squadSize) => {
        this.showFloatingText(
          this.campfire.x,
          this.campfire.y - 115,
          `⚠️ НАБІГ! Племʼя «${tribeNameUk}» веде ${squadSize} воїнів!`
        );
        this.emitAlarm();
      },
      onRivalDefeated: (tribeNameUk, cx, cy) => {
        const rewardSpace = (cur: number, gain: number) => Math.min(gain, Math.max(0, this.storageCap - cur));
        this.resources.wood += rewardSpace(this.resources.wood, 35);
        this.resources.stone += rewardSpace(this.resources.stone, 25);
        this.resources.bone += rewardSpace(this.resources.bone, 15);
        this.resources.hide += rewardSpace(this.resources.hide, 10);
        this.syncStorageAmounts();
        this.emitResources();
        this.emitRivals();
        SoundFX.playFanfare();
        this.showFloatingText(cx, cy - 84, `🏆 Племʼя «${tribeNameUk}» розбите! (+трофеї)`);
      },
      onTribeDiscovered: (camp) => {
        SoundFX.playFanfare();
        this.showFloatingText(
          this.campfire.x,
          this.campfire.y - 98,
          `🤝 Ви зустріли племʼя «${camp.nameUk}»! Відкрито Дипломатію (Племена)`
        );
        this.emitRivals();
      },
      onInterTribeEvent: (msgUk) => {
        this.showFloatingText(this.campfire.x, this.campfire.y - 108, msgUk);
        this.emitRivals();
      }
    });
  }

  private isClearWildernessSpot(x: number, y: number, minGapFromOthers: number): boolean {
    if (Phaser.Math.Distance.Between(x, y, this.playerBaseX, this.playerBaseY) < 280) return false;
    if (Phaser.Math.Distance.Between(x, y, this.lake.x, this.lake.y) < 225) return false;
    if (this.river && this.river.isPointInFishableWater(x, y)) return false;
    for (const c of this.rivalSystem.camps) {
      if (Phaser.Math.Distance.Between(x, y, c.x, c.y) < 290) return false;
    }
    for (const h of this.huts) {
      if (Phaser.Math.Distance.Between(x, y, h.x, h.y) < 150) return false;
    }
    for (const b of this.buildings) {
      if (b.scene && Phaser.Math.Distance.Between(x, y, b.x, b.y) < 150) return false;
    }
    if (
      this.resourceNodes.some(
        (n) => n.scene && Phaser.Math.Distance.Between(x, y, n.x, n.y) < minGapFromOthers
      )
    ) {
      return false;
    }
    return true;
  }

  private handleResourceDepleted(depletedNode: ResourceNode): void {
    const preset = MAP_PRESETS[this.gameConfig.mapId] ?? MAP_PRESETS.river_valley;
    if (preset.id === 'depleting_world' || depletedNode.isInfinite) return;

    // Only trees ('wood') and berry bushes ('food') regrow as saplings in wild areas outside settlements
    if (depletedNode.resourceType !== 'wood' && depletedNode.resourceType !== 'food') {
      return;
    }

    const rType = depletedNode.resourceType;
    const cap = rType === 'wood' ? 24 : 10;

    for (let attempt = 0; attempt < 30; attempt++) {
      const x = Phaser.Math.Between(160, this.worldWidth - 160);
      const y = Phaser.Math.Between(160, this.worldHeight - 160);
      if (!this.isClearWildernessSpot(x, y, 102)) continue;

      const sapling = new ResourceNode(this, x, y, rType, cap, {
        isSapling: true,
        onDepleted: (n) => this.handleResourceDepleted(n)
      });
      sapling.setSeason(this.season, this.springRipened);
      this.resourceNodes.push(sapling);
      break;
    }
  }

  private createResourceNodes(): void {
    const preset = MAP_PRESETS[this.gameConfig.mapId] ?? MAP_PRESETS.river_valley;
    const cx = this.playerBaseX;
    const cy = this.playerBaseY;

    const placeNearFocus = (
      fx: number,
      fy: number,
      count: number,
      minD: number,
      maxD: number,
      minGap: number,
      cb: (x: number, y: number, idx: number) => void
    ) => {
      for (let i = 0; i < count; i++) {
        for (let attempt = 0; attempt < 35; attempt++) {
          const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const d = Phaser.Math.FloatBetween(minD, maxD);
          const x = Phaser.Math.Clamp(fx + Math.cos(a) * d, 110, this.worldWidth - 110);
          const y = Phaser.Math.Clamp(fy + Math.sin(a) * d * 0.8, 120, this.worldHeight - 110);
          if (this.isClearWildernessSpot(x, y, minGap)) {
            cb(x, y, i);
            break;
          }
        }
      }
    };

    const spawnNode = (x: number, y: number, type: ResourceType, amount: number, isInfinite = false) => {
      const node = new ResourceNode(this, x, y, type, amount, {
        isInfinite,
        onDepleted: (n) => this.handleResourceDepleted(n)
      });
      node.setSeason(this.season, this.springRipened);
      this.resourceNodes.push(node);
    };

    const startBerries = Math.max(3, Math.round(preset.bushCount * 0.35));
    const startRocks = Math.max(5, Math.round(preset.rockCount * 0.3));
    const startTrees = Math.max(8, Math.round(preset.treeCount * 0.25));

    // 1. Starter-accessible resources around Player Camp
    placeNearFocus(cx, cy, startBerries, 230, 520, 96, (x, y) => {
      spawnNode(x, y, 'food', 12);
    });
    placeNearFocus(cx, cy, startRocks, 250, 680, 102, (x, y) => {
      spawnNode(x, y, 'stone', 35);
    });
    placeNearFocus(cx, cy, startTrees, 270, 860, 108, (x, y) => {
      spawnNode(x, y, 'wood', 25);
    });

    // 2. Starter-accessible resources around each Rival Tribe Camp so they gather naturally!
    for (const camp of this.rivalSystem.camps) {
      placeNearFocus(camp.x, camp.y, 4, 210, 540, 95, (x, y) => {
        spawnNode(x, y, 'food', 14);
      });
      placeNearFocus(camp.x, camp.y, 6, 230, 640, 100, (x, y) => {
        spawnNode(x, y, 'stone', 35);
      });
      placeNearFocus(camp.x, camp.y, 10, 250, 780, 105, (x, y) => {
        spawnNode(x, y, 'wood', 25);
      });
    }

    // 3. Infinite Rock Quarries (Вічні скелі — never deplete!)
    for (let q = 0; q < preset.infiniteQuarries; q++) {
      for (let a = 0; a < 45; a++) {
        const x =
          q === 0
            ? cx + Phaser.Math.Between(-560, 560)
            : Phaser.Math.Between(240, this.worldWidth - 240);
        const y =
          q === 0
            ? cy + Phaser.Math.Between(-460, 460)
            : Phaser.Math.Between(240, this.worldHeight - 240);
        if (this.isClearWildernessSpot(x, y, 165)) {
          spawnNode(x, y, 'stone', 9999, true);
          break;
        }
      }
    }

    // 4. Global wilderness spread across the expanded map
    const wildBerries = Math.max(3, preset.bushCount - startBerries);
    const wildStones = Math.max(8, preset.rockCount - startRocks);
    const wildTrees = Math.max(15, preset.treeCount - startTrees);

    for (let i = 0; i < wildBerries; i++) {
      for (let a = 0; a < 25; a++) {
        const x = Phaser.Math.Between(140, this.worldWidth - 140);
        const y = Phaser.Math.Between(140, this.worldHeight - 140);
        if (this.isClearWildernessSpot(x, y, 102)) {
          spawnNode(x, y, 'food', 12);
          break;
        }
      }
    }
    for (let i = 0; i < wildStones; i++) {
      for (let a = 0; a < 25; a++) {
        const x = Phaser.Math.Between(140, this.worldWidth - 140);
        const y = Phaser.Math.Between(140, this.worldHeight - 140);
        if (this.isClearWildernessSpot(x, y, 108)) {
          spawnNode(x, y, 'stone', 35);
          break;
        }
      }
    }
    for (let i = 0; i < wildTrees; i++) {
      for (let a = 0; a < 25; a++) {
        const x = Phaser.Math.Between(140, this.worldWidth - 140);
        const y = Phaser.Math.Between(140, this.worldHeight - 140);
        if (this.isClearWildernessSpot(x, y, 110)) {
          spawnNode(x, y, 'wood', 25);
          break;
        }
      }
    }
  }

  private createAnimals(): void {
    this.ensureSeasonalWildlife();
  }

  private ensureSeasonalWildlife(): void {
    const aliveCount = this.animals.filter((a) => a.isAlive()).length;
    if (aliveCount >= 10) return;
    const speciesList: AnimalSpecies[] = ['boar', 'deer'];

    const needed = 10 - aliveCount;
    for (let i = 0; i < needed; i++) {
      for (let attempt = 0; attempt < 24; attempt++) {
        const nearCamp = aliveCount + i < 4;
        let x: number;
        let y: number;
        if (nearCamp) {
          const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const d = Phaser.Math.Between(300, 620);
          x = Phaser.Math.Clamp(this.playerBaseX + Math.cos(a) * d, 130, this.worldWidth - 130);
          y = Phaser.Math.Clamp(this.playerBaseY + Math.sin(a) * d * 0.8, 130, this.worldHeight - 130);
        } else {
          x = Phaser.Math.Between(160, this.worldWidth - 160);
          y = Phaser.Math.Between(160, this.worldHeight - 160);
        }
        if (!this.isClearWildernessSpot(x, y, 75)) continue;

        const sp = speciesList[(aliveCount + i) % 2];
        const animal = new Animal(
          this,
          x,
          y,
          sp,
          this.worldWidth,
          this.worldHeight,
          () => this.getObstacles(),
          (killed) => this.spawnCarcass(killed.x, killed.y, killed.species)
        );
        this.animals.push(animal);
        break;
      }
    }
  }

  private createPredators(): void {
    this.ensureSeasonalPredators();
  }

  private ensureSeasonalPredators(): void {
    const alive = this.predators.filter((p) => p.isAlive()).length;
    if (alive >= MAX_PREDATORS) return;
    const speciesOrder: PredatorSpecies[] = ['wolf', 'sabertooth', 'bear'];

    for (let i = alive; i < MAX_PREDATORS; i++) {
      for (let attempt = 0; attempt < 25; attempt++) {
        const x = Phaser.Math.Between(240, this.worldWidth - 240);
        const y = Phaser.Math.Between(240, this.worldHeight - 240);
        if (Phaser.Math.Distance.Between(x, y, this.playerBaseX, this.playerBaseY) < 620) continue;
        if (
          this.rivalSystem.camps.some((c) => Phaser.Math.Distance.Between(x, y, c.x, c.y) < 380)
        ) {
          continue;
        }
        if (Phaser.Math.Distance.Between(x, y, this.lake.x, this.lake.y) < 240) continue;

        this.predatorCounter += 1;
        const sp = speciesOrder[i % speciesOrder.length];
        const pred = new Predator(this, `pred-${this.predatorCounter}`, x, y, sp, {
          worldW: this.worldWidth,
          worldH: this.worldHeight,
          getObstacles: () => this.getObstacles(),
          getPotentialPrey: () => [
            ...this.villagers.filter((v) => v.isAlive()),
            ...this.rivalSystem.units.filter((u) => u.isAlive())
          ],
          onAttackTarget: (p, target) => {
            if (target.faction === 'player') {
              this.triggerTribeAlarm(p, target as Villager);
            }
          },
          onKilled: (killed) => {
            this.spawnCarcass(killed.x, killed.y, 'predator');
          }
        });
        this.predators.push(pred);
        break;
      }
    }
  }

  private spawnCarcass(x: number, y: number, kind: CarcassKind): AnimalCarcass {
    const c = new AnimalCarcass(this, x, y, kind);
    this.carcasses.push(c);
    this.showFloatingText(x, y - 34, '🍖15 🦴10 🧥5');
    return c;
  }

  private createStartingVillagers(): void {
    const cx = this.playerBaseX;
    const cy = this.playerBaseY;

    this.villagerCallbacks = {
      getWorldBounds: () => ({ width: this.worldWidth, height: this.worldHeight }),
      getTechLevels: () => this.techLevels,
      getArmoryOrStoragePoint: () => {
        const armory = this.buildings.find(
          (b) => b.scene && b.buildingType === 'armory' && b.isComplete()
        );
        if (armory) return armory.getWorkSpot();
        return { x: this.campfire.x, y: this.campfire.y + 52 };
      },
      getNearestCarcass: (x: number, y: number, maxRadius: number) =>
        this.findNearestCarcass(x, y, maxRadius),
      canStationCraftNext: (b: TribeBuilding) => {
        if (b.buildingType === 'workshop' || b.buildingType === 'armory') {
          return this.evaluateCraftingPlan(b.buildingType);
        }
        return { canWork: true, statusText: '' };
      },
      isDefenseAlarmActive: () => this.manualAlarmActive || this.countNearbyPlayerThreats() > 0,
      triggerTribeAlarm: (threat, caller) => this.triggerTribeAlarm(threat, caller),
      findNearestHostile: (x, y, maxRange) => this.findNearestHostileForPlayer(x, y, maxRange),
      tryBorrowDefenseGear: (v: Villager) => {
        let changed = false;
        if (!v.equippedWeapon) {
          for (const wt of ['spear', 'club', 'bow'] as WeaponType[]) {
            if (this.resources.weapons[wt] > 0) {
              this.resources.weapons[wt] -= 1;
              v.equipWeapon(wt);
              v.isMilitiaArmed = true;
              changed = true;
              break;
            }
          }
        }
        if (v.equippedArmor === 'none') {
          if (this.resources.armors.bone_armor > 0) {
            this.resources.armors.bone_armor -= 1;
            v.equipArmor('bone_armor');
            v.isMilitiaArmed = true;
          } else if (this.resources.armors.hide_armor > 0) {
            this.resources.armors.hide_armor -= 1;
            v.equipArmor('hide_armor');
            v.isMilitiaArmed = true;
          }
        }
        if (changed || v.isMilitiaArmed) this.emitResources();
        return Boolean(v.equippedWeapon);
      },
      returnBorrowedDefenseGear: (v: Villager) => {
        if (!v.isMilitiaArmed || v.warriorClass) return;
        if (v.equippedWeapon) {
          this.resources.weapons[v.equippedWeapon] += 1;
          v.equipWeapon(null);
        }
        if (v.equippedArmor !== 'none') {
          this.resources.armors[v.equippedArmor] += 1;
          v.equipArmor('none');
        }
        v.isMilitiaArmed = false;
        this.emitResources();
      },
      findNearestBerryBush: (x, y) => this.findNearestResourceOfType('food', x, y, 2500),
      findNearestResourceOfType: (type, x, y, maxRadius) =>
        this.findNearestResourceOfType(type, x, y, maxRadius),
      findNearbyIdleVillager: (requester, maxRadius) =>
        this.findNearbyIdleVillager(requester, maxRadius),
      findAvailableSleepHut: (x, y) => this.findAvailableSleepHut(x, y),
      findCompletedNursery: (x, y) => this.findCompletedNursery(x, y),
      findGathererTask: (hut, v) => this.findGathererTask(hut, v),
      onEnemyConvertedToCaptive: (enemy, shaman) => this.handleEnemyConvertedToCaptive(enemy, shaman),
      findUnfinishedBuilding: (x, y) => this.findUnfinishedBuilding(x, y),
      getObstacles: () => this.getObstacles(),
      getStoragePoint: (type: ResourceType) => {
        if (this.campfireStoragesHidden) {
          const granary = this.buildings.find(
            (b) => b.scene && b.buildingType === 'granary' && b.isComplete()
          );
          if (granary) return granary.getWorkSpot();
        }
        return this.storages[type].getDropPoint();
      },
      isStorageFull: (type: ResourceType) => this.resources[type] >= this.storageCap,
      hasFoodInStorage: () => this.resources.food > 0,
      consumeStorageFood: () => {
        if (this.resources.food <= 0) return false;
        this.resources.food -= 1;
        this.storages.food.setAmount(this.resources.food);
        this.emitResources();
        return true;
      },
      getLake: () => this.lake,
      getSeason: () => this.season,
      getYear: () => this.year,
      getVillagers: () => this.villagers,
      hasChief: () => Boolean(this.chiefId && this.villagers.some((v) => v.id === this.chiefId && v.scene)),
      hasTotem: () => this.buildings.some((b) => b.buildingType === 'totem' && b.isComplete()),
      onDepositResource: (type, amount, x, y) => {
        const space = Math.max(0, this.storageCap - this.resources[type]);
        const added = Math.min(amount, space);
        if (added > 0) {
          this.resources[type] += added;
          this.storages[type].setAmount(this.resources[type]);
          this.emitResources();
          this.showFloatingText(x, y, `+${added} ${RESOURCE_LABELS_UK[type]}`);
        } else {
          this.showFloatingText(x, y, `Склад повний (${this.storageCap}/${this.storageCap})!`);
        }
      },
      onStationCycleComplete: (_villager, building) => {
        if (building.buildingType === 'workshop' || building.buildingType === 'armory') {
          this.completeCraftingStation(building);
        } else if (building.buildingType === 'granary') {
          const added = Math.min(3, Math.max(0, this.storageCap - this.resources.food));
          if (added > 0) {
            this.resources.food += added;
            this.storages.food.setAmount(this.resources.food);
            this.emitResources();
            this.showFloatingText(building.x, building.y - 68, `+${added} Їжа (Комора)`);
          }
        } else if (building.buildingType === 'smokehouse') {
          const added = Math.min(4, Math.max(0, this.storageCap - this.resources.food));
          if (added > 0) {
            this.resources.food += added;
            this.storages.food.setAmount(this.resources.food);
            this.emitResources();
            this.showFloatingText(building.x, building.y - 68, `+${added} Копчена їжа`);
          }
        } else if (building.buildingType === 'totem') {
          this.resources.knowledge += 6;
          this.emitResources();
          this.showFloatingText(building.x, building.y - 68, '✨ +6 Знань племені');
          const healAmt = 14 + this.techLevels.healing * 6;
          for (const v of this.villagers) {
            if (
              v.scene &&
              !v.isDying &&
              Phaser.Math.Distance.Between(v.x, v.y, building.x, building.y) <= 360
            ) {
              v.stats.health = Math.min(v.maxHealth, v.stats.health + healAmt);
            }
          }
        }
      },
      onGrewUp: (villager) => {
        this.showFloatingText(
          villager.x,
          villager.y - 52,
          `🎉 ${villager.villagerName} став дорослим (14 років)!`
        );
        this.tryAutoEquipCraftedTools();
      },
      onVillagerStartedDying: (villager) => this.handleVillagerStartedDying(villager),
      onVillagerDied: (villager, record) => this.handleVillagerDeath(villager, record),
      onVillagerKilledInCombat: (villager, record, causeUk) => {
        this.handleVillagerDeath(
          villager,
          record,
          `⚔️ ${villager.villagerName} ${causeUk}…`
        );
      }
    };

    const starterDefs: Array<{
      id: string;
      name: string;
      gender: 'male' | 'female';
      appearance: VillagerAppearanceId;
      ox: number;
      oy: number;
      age: number;
      spouseId?: string;
      spouseName?: string;
    }> = [
      {
        id: 'v1',
        name: 'Огг',
        gender: 'male',
        appearance: 'male-1',
        ox: -78,
        oy: 48,
        age: 24,
        spouseId: 'v3',
        spouseName: 'Ая'
      },
      { id: 'v2', name: 'Тук', gender: 'male', appearance: 'male-2', ox: 82, oy: 44, age: 22 },
      {
        id: 'v3',
        name: 'Ая',
        gender: 'female',
        appearance: 'female',
        ox: 4,
        oy: -72,
        age: 20,
        spouseId: 'v1',
        spouseName: 'Огг'
      }
    ];

    for (const def of starterDefs) {
      const v = new Villager(
        this,
        cx + def.ox,
        cy + def.oy,
        def.id,
        def.name,
        def.gender,
        def.appearance,
        this.campfire,
        this.villagerCallbacks,
        def.age,
        {
          familyId: 'fam-1',
          familyName: 'Рід Першого Вогню',
          spouseId: def.spouseId ?? null,
          spouseName: def.spouseName ?? null
        },
        this.year
      );
      this.villagers.push(v);
    }
  }

  private rebuildObstacleCache(): void {
    const obstacles: ObstacleCircle[] = [
      { x: this.campfire.x, y: this.campfire.y + 4, radius: 56, owner: this.campfire },
      { x: this.lake.x - 56, y: this.lake.y, radius: 78, owner: this.lake },
      { x: this.lake.x, y: this.lake.y, radius: 90, owner: this.lake },
      { x: this.lake.x + 56, y: this.lake.y, radius: 78, owner: this.lake }
    ];

    for (const node of this.resourceNodes) {
      if (!node.scene || node.isDepleted()) continue;
      if (node.resourceType === 'wood') {
        obstacles.push({ x: node.x, y: node.y, radius: 24, owner: node });
      } else if (node.resourceType === 'stone') {
        obstacles.push({ x: node.x, y: node.y, radius: 28, owner: node });
      }
    }

    for (const hut of this.huts) {
      obstacles.push({ x: hut.x, y: hut.y + 4, radius: 46, owner: hut });
    }

    for (const b of this.buildings) {
      if (!b.scene) continue;
      obstacles.push({
        x: b.x,
        y: b.y + 4,
        radius: b.buildingType === 'palisade' ? 30 : 46,
        owner: b
      });
    }

    if (this.rivalSystem) {
      obstacles.push(...this.rivalSystem.getObstacles());
    }

    if (this.river) {
      obstacles.push(...this.river.getObstacles());
    }

    this.cachedObstacles = obstacles;
  }

  private getObstacles(): ObstacleCircle[] {
    return this.cachedObstacles;
  }

  private createCloudShadows(): void {
    for (let i = 0; i < 8; i++) {
      const sprite = this.add.image(
        Phaser.Math.Between(0, this.worldWidth),
        Phaser.Math.Between(0, this.worldHeight),
        'cloud-shadow'
      );
      sprite.setDepth(2500);
      sprite.setAlpha(0.1);
      sprite.setScale(Phaser.Math.FloatBetween(0.9, 1.55));
      this.cloudShadows.push({
        sprite,
        speedX: Phaser.Math.FloatBetween(12, 22),
        speedY: Phaser.Math.FloatBetween(3, 7)
      });
    }
  }

  private updateCloudShadows(delta: number): void {
    const dt = delta / 1000;
    for (const cloud of this.cloudShadows) {
      cloud.sprite.x += cloud.speedX * dt;
      cloud.sprite.y += cloud.speedY * dt;
      if (cloud.sprite.x > this.worldWidth + 280) cloud.sprite.x = -280;
      if (cloud.sprite.y > this.worldHeight + 180) cloud.sprite.y = -180;
    }
  }

  private setupInput(): void {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.wasd = {
        W: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)
      };
      this.input.keyboard.on('keydown-T', () => this.advanceSeason(true));
      this.input.keyboard.on('keydown-R', () => this.toggleManualDefenseAlarm());
      this.input.keyboard.on('keydown-ESC', () => {
        if (this.isBuildMode) {
          this.setBuildMode(null);
        } else {
          this.selectVillagerList([]);
          this.selectBuilding(null);
        }
      });
    }

    this.input.on('wheel', (_p: Phaser.Input.Pointer, _objs: unknown[], _dx: number, dy: number) => {
      const cam = this.cameras.main;
      const nextZoom = Phaser.Math.Clamp(
        cam.zoom - dy * 0.0008 * GAME_DPR,
        0.42 * GAME_DPR,
        1.55 * GAME_DPR
      );
      cam.setZoom(nextZoom);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.isMenuPaused) return;
      SoundFX.unlock();
      if (this.time.now < this.uiClickGuardUntil) return;

      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const p1 = this.input.pointer1;
        const p2 = this.input.pointer2;
        this.isPinching = true;
        this.isPanning = false;
        this.isMarqueeSelecting = false;
        this.panMoved = true;
        this.marqueeGfx.clear();
        this.pinchPrevDist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        this.pinchPrevMidX = (p1.x + p2.x) * 0.5;
        this.pinchPrevMidY = (p1.y + p2.y) * 0.5;
        return;
      }

      this.panMoved = false;
      this.panStartX = pointer.x;
      this.panStartY = pointer.y;
      this.camStartX = this.cameras.main.scrollX;
      this.camStartY = this.cameras.main.scrollY;

      if (pointer.wasTouch && this.touchMarqueeMode && !this.isBuildMode) {
        this.isMarqueeSelecting = true;
        this.marqueeStartX = pointer.worldX;
        this.marqueeStartY = pointer.worldY;
      } else if (pointer.wasTouch || pointer.middleButtonDown() || pointer.rightButtonDown()) {
        this.isPanning = true;
      } else if (pointer.leftButtonDown() && !this.isBuildMode) {
        this.isMarqueeSelecting = true;
        this.marqueeStartX = pointer.worldX;
        this.marqueeStartY = pointer.worldY;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isMenuPaused) return;

      if (this.isPinching && this.input.pointer1.isDown && this.input.pointer2.isDown) {
        const p1 = this.input.pointer1;
        const p2 = this.input.pointer2;
        const dist = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        const midX = (p1.x + p2.x) * 0.5;
        const midY = (p1.y + p2.y) * 0.5;
        if (this.pinchPrevDist > 12 * GAME_DPR && dist > 12 * GAME_DPR) {
          const cam = this.cameras.main;
          const factor = dist / this.pinchPrevDist;
          const nextZoom = Phaser.Math.Clamp(
            cam.zoom * factor,
            0.42 * GAME_DPR,
            1.55 * GAME_DPR
          );
          cam.scrollX -= (midX - this.pinchPrevMidX) / cam.zoom;
          cam.scrollY -= (midY - this.pinchPrevMidY) / cam.zoom;
          cam.setZoom(nextZoom);
        }
        this.pinchPrevDist = dist;
        this.pinchPrevMidX = midX;
        this.pinchPrevMidY = midY;
        return;
      }

      if (this.isBuildMode && !pointer.wasTouch) {
        this.isTouchBuildPreview = false;
        this.updateBuildGhostAtPointer(pointer);
      }

      if (
        this.isMarqueeSelecting &&
        (pointer.leftButtonDown() || (pointer.wasTouch && pointer.isDown))
      ) {
        const dx = pointer.x - this.panStartX;
        const dy = pointer.y - this.panStartY;
        if (Math.hypot(dx, dy) > 10 * GAME_DPR) {
          this.panMoved = true;
          const x = Math.min(this.marqueeStartX, pointer.worldX);
          const y = Math.min(this.marqueeStartY, pointer.worldY);
          const w = Math.abs(pointer.worldX - this.marqueeStartX);
          const h = Math.abs(pointer.worldY - this.marqueeStartY);
          this.marqueeGfx.clear();
          this.marqueeGfx.fillStyle(0x4ade80, 0.16);
          this.marqueeGfx.fillRect(x, y, w, h);
          this.marqueeGfx.lineStyle(2, 0xfef08a, 0.92);
          this.marqueeGfx.strokeRect(x, y, w, h);
        }
        return;
      }

      if (!this.isPanning || !pointer.isDown) return;
      const dx = pointer.x - this.panStartX;
      const dy = pointer.y - this.panStartY;
      if (Math.hypot(dx, dy) > 12 * GAME_DPR) {
        this.panMoved = true;
      }
      if (this.panMoved) {
        const cam = this.cameras.main;
        cam.scrollX = this.camStartX - dx / cam.zoom;
        cam.scrollY = this.camStartY - dy / cam.zoom;
      }
    });

    this.input.on(
      'pointerup',
      (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
        if (this.isPinching) {
          if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) {
            this.isPinching = false;
            this.isPanning = false;
            this.isMarqueeSelecting = false;
            this.panMoved = false;
            this.marqueeGfx.clear();
            this.pinchEndGuardUntil = this.time.now + 200;
          }
          return;
        }

        const wasDrag = this.panMoved;
        const wasMarquee = this.isMarqueeSelecting;
        this.isPanning = false;
        this.isMarqueeSelecting = false;
        this.panMoved = false;
        this.marqueeGfx.clear();

        if (
          this.isMenuPaused ||
          this.time.now < this.uiClickGuardUntil ||
          this.time.now < this.pinchEndGuardUntil
        ) {
          return;
        }

        if (wasMarquee && wasDrag && !this.isBuildMode) {
          const minX = Math.min(this.marqueeStartX, pointer.worldX);
          const maxX = Math.max(this.marqueeStartX, pointer.worldX);
          const minY = Math.min(this.marqueeStartY, pointer.worldY);
          const maxY = Math.max(this.marqueeStartY, pointer.worldY);
          // Exclude children (< 14 years) from marquee box selection!
          const inside = this.villagers.filter(
            (v) =>
              v.isAlive() &&
              !v.isChild &&
              v.x >= minX &&
              v.x <= maxX &&
              v.y >= minY &&
              v.y <= maxY
          );
          this.selectVillagerList(inside);
          if (inside.length > 0) SoundFX.playSelect();
          if (this.touchMarqueeMode) {
            this.touchMarqueeMode = false;
            this.events.emit('marquee-mode-updated', false);
          }
          return;
        }

        if (wasDrag) return;

        const worldX = pointer.worldX;
        const worldY = pointer.worldY;
        const isTouch = pointer.wasTouch;

        if (this.isBuildMode) {
          if (isTouch) {
            this.isTouchBuildPreview = true;
            this.updateBuildGhostAtWorld(worldX, worldY);
            SoundFX.playSelect();
          } else if (pointer.rightButtonReleased()) {
            this.setBuildMode(null);
          } else if (pointer.leftButtonReleased()) {
            this.tryPlaceBuildingAt(worldX, worldY);
          }
          return;
        }

        const logicalZoom = this.cameras.main.zoom / GAME_DPR;
        const touchPad = isTouch ? Math.max(14, 20 / logicalZoom) : 0;

        const hitVillager =
          (currentlyOver.find((obj) => obj instanceof Villager) as Villager | undefined) ??
          this.findVillagerAt(worldX, worldY, touchPad);
        const hitHut =
          (currentlyOver.find((obj) => obj instanceof Hut) as Hut | undefined) ??
          this.findHutAt(worldX, worldY);
        const hitBuilding =
          (currentlyOver.find((obj) => obj instanceof TribeBuilding) as TribeBuilding | undefined) ??
          this.findBuildingAt(worldX, worldY);
        const hitHostile =
          (currentlyOver.find((obj) => obj instanceof Predator) as Predator | undefined) ??
          (currentlyOver.find((obj) => obj instanceof EnemyUnit) as EnemyUnit | undefined) ??
          this.findHostileAt(worldX, worldY, touchPad);
        const hitAnimal =
          (currentlyOver.find((obj) => obj instanceof Animal) as Animal | undefined) ??
          this.findAnimalAt(worldX, worldY, touchPad);
        const hitCarcass =
          (currentlyOver.find((obj) => obj instanceof AnimalCarcass) as AnimalCarcass | undefined) ??
          this.findCarcassAt(worldX, worldY, touchPad);
        const hitNode =
          (currentlyOver.find((obj) => obj instanceof ResourceNode) as ResourceNode | undefined) ??
          this.findNodeAt(worldX, worldY, touchPad);
        const lakeHitTarget = this.lake.getHitTarget();
        const hitLake =
          currentlyOver.includes(lakeHitTarget) || this.lake.isPointInsideClickArea(worldX, worldY)
            ? this.lake
            : undefined;
        const hitCampfire = this.isPointOnCampfire(worldX, worldY);

        if (!isTouch) {
          if (pointer.leftButtonReleased()) {
            if (hitVillager) {
              const shiftHeld = Boolean(pointer.event && (pointer.event as MouseEvent).shiftKey);
              if (shiftHeld) {
                const next = this.selectedVillagers.includes(hitVillager)
                  ? this.selectedVillagers.filter((v) => v !== hitVillager)
                  : [...this.selectedVillagers, hitVillager];
                this.selectVillagerList(next);
              } else {
                this.selectVillagerList([hitVillager]);
              }
              SoundFX.playSelect();
            } else if (hitBuilding && hitBuilding.isComplete()) {
              if (hitBuilding.buildingType === 'burial_mound') {
                this.openChronicle();
              } else {
                this.selectBuilding(hitBuilding);
              }
            } else if (hitCampfire) {
              this.events.emit('campfire-clicked');
            } else {
              this.selectVillagerList([]);
              this.selectBuilding(null);
            }
          } else if (pointer.rightButtonReleased() && this.selectedVillagers.length > 0) {
            this.issueCommandToGroup(
              hitHut ?? null,
              hitBuilding ?? null,
              hitHostile ?? null,
              hitAnimal ?? null,
              hitCarcass ?? null,
              hitNode ?? null,
              hitLake ?? null,
              worldX,
              worldY
            );
          }
        } else {
          // Android / Touch Tap rules:
          // 1) Tap villager -> select
          // 2) Tap finished building -> open building panel / chronicle
          // 3) Tap campfire -> open defense alarm panel
          // 4) Tap resource / lake / animal / hostile / unfinished site / ground with selected unit(s) -> issue order
          // 5) Otherwise close open building panel
          if (hitVillager) {
            this.selectVillagerList([hitVillager]);
            SoundFX.playSelect();
          } else if (hitBuilding && hitBuilding.isComplete()) {
            if (hitBuilding.buildingType === 'burial_mound') {
              this.openChronicle();
            } else {
              this.selectBuilding(hitBuilding);
            }
            SoundFX.playSelect();
          } else if (hitCampfire) {
            this.events.emit('campfire-clicked');
          } else if (this.selectedVillagers.length > 0) {
            this.issueCommandToGroup(
              hitHut ?? null,
              hitBuilding ?? null,
              hitHostile ?? null,
              hitAnimal ?? null,
              hitCarcass ?? null,
              hitNode ?? null,
              hitLake ?? null,
              worldX,
              worldY
            );
          } else {
            this.selectBuilding(null);
          }
        }
      }
    );
  }

  private selectVillagerList(nextList: Villager[]): void {
    for (const v of this.selectedVillagers) {
      if (v.scene) v.setSelected(false);
    }
    this.selectedVillagers = nextList.filter((v) => v.isAlive());
    for (const v of this.selectedVillagers) {
      v.setSelected(true);
    }
    this.emitSelection();
  }

  private issueCommandToGroup(
    hut: Hut | null,
    building: TribeBuilding | null,
    hostile: CombatTarget | null,
    animal: Animal | null,
    carcass: AnimalCarcass | null,
    node: ResourceNode | null,
    lake: Lake | null,
    worldX: number,
    worldY: number
  ): void {
    const units = this.selectedVillagers.filter((v) => v.isAlive() && !v.isDying);
    if (units.length === 0) return;

    // Attack or convert hostile predator or rival enemy
    if (hostile && hostile.isAlive()) {
      const adults = units.filter((u) => !u.isChild);
      if (adults.length === 0) {
        SoundFX.playBlocked();
        return;
      }
      // If a Shaman is selected and right-clicks an enemy gatherer, initiate 20s Conversion!
      if (hostile instanceof EnemyUnit && hostile.canBeConverted()) {
        const shaman = adults.find((u) => u.isShaman());
        if (shaman && shaman.issueConvertOrder(hostile)) {
          SoundFX.playShamanChant();
          this.spawnTargetRing(hostile.x, hostile.y + 4, 0xc084fc, true);
          this.showFloatingText(
            shaman.x,
            shaman.y - 68,
            `🌀 ${shaman.villagerName} навертає збирача (20 сек)…`
          );
          return;
        }
      }
      SoundFX.playOrder();
      adults.forEach((u) => u.issueCombatOrder(hostile));
      this.spawnTargetRing(hostile.x, hostile.y + 4, 0xef4444, true);
      return;
    }

    // Attack enemy camp directly if player clicks right on rival camp banner/fire
    const rivalCamp = this.rivalSystem.camps.find(
      (c) => c.alive && Phaser.Math.Distance.Between(worldX, worldY, c.x, c.y) <= 105
    );
    if (rivalCamp) {
      const guard = this.findNearestHostileForPlayer(rivalCamp.x, rivalCamp.y, 260);
      if (guard) {
        SoundFX.playOrder();
        units.filter((u) => !u.isChild).forEach((u) => u.issueCombatOrder(guard));
        this.spawnTargetRing(guard.x, guard.y, 0xef4444, true);
        return;
      }
      // Damage unguarded rival camp!
      const adults = units.filter((u) => !u.isChild);
      if (adults.length > 0) {
        SoundFX.playOrder();
        adults.forEach((u, i) => {
          const a = (i / Math.max(1, adults.length)) * Math.PI * 2;
          u.issueMoveOrder(rivalCamp.x + Math.cos(a) * 58, rivalCamp.y + Math.sin(a) * 44);
        });
        this.rivalSystem.damageCampNear(rivalCamp.x, rivalCamp.y, adults.length * 45);
        this.spawnTargetRing(rivalCamp.x, rivalCamp.y, 0xef4444, true);
        return;
      }
    }

    if (hut && !hut.isComplete()) {
      const adults = units.filter((u) => !u.isChild);
      if (adults.length > 0) {
        SoundFX.playOrder();
        adults.forEach((u) => u.issueBuildOrder(hut));
        this.spawnTargetRing(hut.x, hut.y + 4, 0xfbbf24, true);
        return;
      }
    }

    if (building) {
      if (!building.isComplete()) {
        const adults = units.filter((u) => !u.isChild);
        if (adults.length > 0) {
          SoundFX.playOrder();
          adults.forEach((u) => u.issueBuildOrder(building));
          this.spawnTargetRing(building.x, building.y + 4, 0xfbbf24, true);
          return;
        }
      }
      if (building.buildingType === 'burial_mound') {
        this.openChronicle();
        return;
      }
      if (building.profession && building.buildingType !== 'barracks') {
        const firstAdult = units.find((u) => !u.isChild);
        if (firstAdult) {
          SoundFX.playOrder();
          firstAdult.issueAssignBuilding(building);
          this.spawnTargetRing(building.x, building.y + 4, 0x38bdf8, true);
          this.events.emit('building-selected', building.getSnapshot());
          return;
        }
      }
    }

    if (carcass && !carcass.isEmpty()) {
      const adults = units.filter((u) => !u.isChild);
      if (adults.length > 0) {
        SoundFX.playOrder();
        adults.forEach((u) => u.issueCarcassOrder(carcass));
        this.spawnTargetRing(carcass.x, carcass.y + 4, 0xfbbf24, true);
        return;
      }
    }

    if (animal && animal.isAlive()) {
      if (this.resources.food >= this.storageCap) {
        this.showFloatingText(animal.x, animal.y - 30, `Склад їжі повний (${this.storageCap})!`);
        SoundFX.playBlocked();
        return;
      }
      const adults = units.filter((u) => !u.isChild);
      if (adults.length > 0) {
        SoundFX.playOrder();
        adults.forEach((u) => u.issueHuntOrder(animal));
        this.spawnTargetRing(animal.x, animal.y + 4, 0xef4444, true);
        return;
      }
    }

    if (node) {
      if (node.isSpringBuds()) {
        this.showFloatingText(node.x, node.y - 30, '🌱 Ягоди дозріють посеред весни!');
        SoundFX.playBlocked();
        return;
      }
      if (node.resourceType === 'food' && this.season === 'WINTER') {
        this.showFloatingText(node.x, node.y - 30, '❄️ Взимку ягоди не ростуть!');
        SoundFX.playBlocked();
        return;
      }
      if (!node.isDepleted()) {
        if (this.resources[node.resourceType] >= this.storageCap) {
          this.showFloatingText(node.x, node.y - 30, `Склад повний (${this.storageCap})!`);
          SoundFX.playBlocked();
          return;
        }
        const adults = units.filter((u) => !u.isChild);
        if (adults.length === 0) {
          this.showFloatingText(worldX, worldY - 24, 'Дитина ще замала для роботи!');
          SoundFX.playBlocked();
          return;
        }
        SoundFX.playOrder();
        adults.forEach((u) => u.issueGatherOrder(node));
        this.spawnTargetRing(node.x, node.y + 4, 0xffe066, true);
        return;
      }
    }

    if (lake) {
      if (!lake.isFishable()) {
        this.showFloatingText(worldX, worldY - 24, 'Озеро замерзло взимку!');
        SoundFX.playBlocked();
        return;
      }
      if (this.resources.food >= this.storageCap) {
        this.showFloatingText(worldX, worldY - 24, `Склад їжі повний (${this.storageCap})!`);
        SoundFX.playBlocked();
        return;
      }
      const adults = units.filter((u) => !u.isChild);
      if (adults.length > 0) {
        SoundFX.playOrder();
        adults.forEach((u) => u.issueFishOrder(lake));
        this.spawnTargetRing(worldX, worldY, 0x38bdf8, true);
        return;
      }
    }

    // Group move order with neat formation spread
    SoundFX.playOrder();
    const clampedX = Phaser.Math.Clamp(worldX, 50, this.worldWidth - 50);
    const clampedY = Phaser.Math.Clamp(worldY, 50, this.worldHeight - 50);
    units.forEach((u, idx) => {
      if (units.length === 1) {
        u.issueMoveOrder(clampedX, clampedY);
      } else {
        const ring = Math.floor(idx / 6);
        const angle = (idx * 2.2) % (Math.PI * 2);
        const rad = 18 + ring * 26;
        u.issueMoveOrder(
          Phaser.Math.Clamp(clampedX + Math.cos(angle) * rad, 50, this.worldWidth - 50),
          Phaser.Math.Clamp(clampedY + Math.sin(angle) * rad * 0.78, 50, this.worldHeight - 50)
        );
      }
    });
    this.spawnTargetRing(clampedX, clampedY, 0x70e000, false);
  }

  private isPointOnCampfire(wx: number, wy: number): boolean {
    return Phaser.Math.Distance.Between(wx, wy, this.campfire.x, this.campfire.y - 10) <= 58;
  }

  private findHostileAt(wx: number, wy: number, touchPad = 0): CombatTarget | null {
    for (const p of this.predators) {
      if (p.isAlive() && p.isPointInsideClickArea(wx, wy)) return p;
    }
    for (const u of this.rivalSystem.units) {
      if (u.isAlive() && u.isPointInsideClickArea(wx, wy)) return u;
    }
    if (touchPad > 0) {
      return this.findNearestHostileForPlayer(wx, wy, 28 + touchPad);
    }
    return null;
  }

  private findNearestHostileForPlayer(x: number, y: number, maxRange: number): CombatTarget | null {
    let best: CombatTarget | null = null;
    let bestDist = maxRange;
    for (const p of this.predators) {
      if (!p.isAlive()) continue;
      const d = Phaser.Math.Distance.Between(x, y, p.x, p.y);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    for (const u of this.rivalSystem.units) {
      if (!u.isAlive()) continue;
      const d = Phaser.Math.Distance.Between(x, y, u.x, u.y);
      if (d < bestDist) {
        bestDist = d;
        best = u;
      }
    }
    return best;
  }

  private findNearestCarcass(x: number, y: number, maxRadius: number): AnimalCarcass | null {
    let best: AnimalCarcass | null = null;
    let bestDist = maxRadius;
    for (const c of this.carcasses) {
      if (c.scene && !c.isEmpty()) {
        const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
    }
    return best;
  }

  private findVillagerAt(
    worldX: number,
    worldY: number,
    extraRadius = 0
  ): Villager | undefined {
    let best: Villager | undefined;
    let bestDist = 32 + extraRadius;
    for (const v of this.villagers) {
      if (!v.visible || !v.isAlive()) continue;
      const d = Phaser.Math.Distance.Between(worldX, worldY, v.x, v.y - 18);
      if (d <= bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  private findHutAt(worldX: number, worldY: number): Hut | undefined {
    return this.huts.find((h) => h.isPointInsideClickArea(worldX, worldY));
  }

  private findBuildingAt(worldX: number, worldY: number): TribeBuilding | undefined {
    return this.buildings.find((b) => b.scene && b.isPointInsideClickArea(worldX, worldY));
  }

  private findAnimalAt(
    worldX: number,
    worldY: number,
    touchPad = 0
  ): Animal | undefined {
    const exact = this.animals.find((a) => a.isAlive() && a.isPointInsideClickArea(worldX, worldY));
    if (exact || touchPad <= 0) return exact;
    let best: Animal | undefined;
    let bestDist = 28 + touchPad;
    for (const a of this.animals) {
      if (!a.isAlive()) continue;
      const d = Phaser.Math.Distance.Between(worldX, worldY, a.x, a.y - 12);
      if (d <= bestDist) {
        bestDist = d;
        best = a;
      }
    }
    return best;
  }

  private findCarcassAt(
    worldX: number,
    worldY: number,
    touchPad = 0
  ): AnimalCarcass | undefined {
    const exact = this.carcasses.find((c) => c.scene && c.isPointInsideClickArea(worldX, worldY));
    if (exact || touchPad <= 0) return exact;
    return this.findNearestCarcass(worldX, worldY, 26 + touchPad) ?? undefined;
  }

  private findNodeAt(
    worldX: number,
    worldY: number,
    touchPad = 0
  ): ResourceNode | undefined {
    const exact = this.resourceNodes.find(
      (n) => n.scene && n.amount > 0 && n.isPointInsideClickArea(worldX, worldY)
    );
    if (exact || touchPad <= 0) return exact;
    let best: ResourceNode | undefined;
    let bestDist = 30 + touchPad;
    for (const n of this.resourceNodes) {
      if (!n.scene || n.amount <= 0) continue;
      const d = Phaser.Math.Distance.Between(worldX, worldY, n.x, n.y - 14);
      if (d <= bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  }

  private findAvailableSleepHut(x: number, y: number): Hut | null {
    let best: Hut | null = null;
    let bestDist = Infinity;
    for (const h of this.huts) {
      if (h.canAcceptSleeper()) {
        const d = Phaser.Math.Distance.Between(x, y, h.x, h.y);
        if (d < bestDist) {
          bestDist = d;
          best = h;
        }
      }
    }
    return best;
  }

  private findCompletedNursery(x: number, y: number): TribeBuilding | null {
    let best: TribeBuilding | null = null;
    let bestDist = Infinity;
    for (const b of this.buildings) {
      if (b.scene && b.isComplete() && b.buildingType === 'nursery') {
        const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
        if (d < bestDist) {
          bestDist = d;
          best = b;
        }
      }
    }
    return best;
  }

  private findGathererTask(
    hut: TribeBuilding,
    v: Villager
  ): { clearNode?: ResourceNode; gatherNode?: ResourceNode; carcass?: AnimalCarcass } | null {
    // 1. Uproot nearby tree stumps first (+2 wood)
    let bestStump: ResourceNode | null = null;
    let bestStumpDist = 920;
    for (const node of this.resourceNodes) {
      if (node.scene && !node.isDepleted() && node.isStump) {
        const d = Phaser.Math.Distance.Between(hut.x, hut.y, node.x, node.y);
        if (d < bestStumpDist) {
          bestStumpDist = d;
          bestStump = node;
        }
      }
    }
    if (bestStump) {
      return { clearNode: bestStump };
    }

    // 2. Harvest nearby carcasses if storage is not full
    const carcass = this.findNearestCarcass(hut.x, hut.y, 750);
    if (carcass && carcass.getNextAvailableType((t) => this.resources[t] >= this.storageCap)) {
      return { carcass };
    }

    // 3. Gather nearest berry bush, wood, or stone that has space in storage
    let bestNode: ResourceNode | null = null;
    let bestScore = Infinity;
    for (const node of this.resourceNodes) {
      if (!node.scene || node.isDepleted() || node.isSapling) continue;
      if (!node.isHarvestableInSeason(this.season)) continue;
      if (this.resources[node.resourceType] >= this.storageCap) continue;
      const d = Phaser.Math.Distance.Between(hut.x, hut.y, node.x, node.y);
      if (d > 1400) continue;
      // Prefer food bushes and nearby resources
      const weight = node.resourceType === 'food' ? 0.65 : 1.0;
      const score = (d + Phaser.Math.Distance.Between(v.x, v.y, node.x, node.y) * 0.35) * weight;
      if (score < bestScore) {
        bestScore = score;
        bestNode = node;
      }
    }
    if (bestNode) {
      return { gatherNode: bestNode };
    }
    return null;
  }

  private handleEnemyConvertedToCaptive(enemy: EnemyUnit, shaman: Villager): void {
    const totem =
      (shaman.assignedBuilding &&
      shaman.assignedBuilding.scene &&
      shaman.assignedBuilding.buildingType === 'totem' &&
      shaman.assignedBuilding.isComplete()
        ? shaman.assignedBuilding
        : null) ??
      this.buildings.find((b) => b.scene && b.buildingType === 'totem' && b.isComplete()) ??
      null;

    this.rivalSystem.removeUnitFromTribe(enemy);
    this.emitRivals();

    if (!totem) {
      // If totem was destroyed mid-channel, convert immediately at campfire
      enemy.walkToPlayerTotem(this.campfire.x, this.campfire.y + 42, () => {
        this.childCounter += 1;
        const v = new Villager(
          this,
          this.campfire.x,
          this.campfire.y + 46,
          `conv-${this.childCounter}`,
          enemy.unitName,
          enemy.gender,
          enemy.appearance,
          this.campfire,
          this.villagerCallbacks,
          20
        );
        v.refreshMaxHealth();
        this.villagers.push(v);
        this.emitPopulation();
        this.emitRoster();
      });
      return;
    }

    const spot = totem.getWorkSpot();
    this.showFloatingText(
      enemy.x,
      enemy.y - 62,
      `🌀 ${enemy.unitName} йде до Тотема Шамана (1 сезон до приєднання)!`
    );
    enemy.walkToPlayerTotem(spot.x, spot.y, () => {
      if (totem.scene) {
        totem.addCaptive(enemy.id, enemy.unitName, enemy.gender, enemy.appearance);
        this.showFloatingText(
          totem.x,
          totem.y - 72,
          `🗿 ${enemy.unitName} медитує біля Тотема (приєднається за 1 сезон)`
        );
        if (this.selectedBuilding === totem) {
          this.events.emit('building-selected', totem.getSnapshot());
        }
      }
    });
  }

  private findUnfinishedBuilding(x: number, y: number): Hut | TribeBuilding | null {
    let best: Hut | TribeBuilding | null = null;
    let bestDist = Infinity;
    for (const h of this.huts) {
      if (!h.isComplete()) {
        const d = Phaser.Math.Distance.Between(x, y, h.x, h.y);
        if (d < bestDist) {
          bestDist = d;
          best = h;
        }
      }
    }
    for (const b of this.buildings) {
      if (b.scene && !b.isComplete()) {
        const d = Phaser.Math.Distance.Between(x, y, b.x, b.y);
        if (d < bestDist) {
          bestDist = d;
          best = b;
        }
      }
    }
    return best;
  }

  private spawnTargetRing(x: number, y: number, color: number, isResource: boolean): void {
    const ringOuter = this.add.image(x, y, 'target-ring');
    ringOuter.setDepth(y + 1).setTint(color).setScale(isResource ? 1.15 : 0.72);
    this.tweens.add({
      targets: ringOuter,
      scaleX: isResource ? 1.75 : 1.32,
      scaleY: isResource ? 1.75 : 1.32,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => ringOuter.destroy()
    });
  }

  private showFloatingText(x: number, y: number, message: string): void {
    const text = this.add
      .text(x, y, message, {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#ffe066',
        stroke: '#2b1e14',
        strokeThickness: 3.5
      })
      .setOrigin(0.5)
      .setDepth(5000);

    this.tweens.add({
      targets: text,
      y: y - 40,
      alpha: 0,
      duration: 1450,
      ease: 'Cubic.easeOut',
      onComplete: () => text.destroy()
    });
  }

  private findNearestResourceOfType(
    type: ResourceType,
    x: number,
    y: number,
    maxRadius: number
  ): ResourceNode | null {
    let best: ResourceNode | null = null;
    let bestDist = maxRadius;

    for (const node of this.resourceNodes) {
      if (node.scene && node.resourceType === type && !node.isDepleted()) {
        const d = Phaser.Math.Distance.Between(x, y, node.x, node.y);
        if (d < bestDist) {
          bestDist = d;
          best = node;
        }
      }
    }
    return best;
  }

  private findNearbyIdleVillager(requester: Villager, maxRadius: number): Villager | null {
    let best: Villager | null = null;
    let bestDist = maxRadius;

    for (const v of this.villagers) {
      if (v === requester || !v.isAvailableForChat()) continue;
      const d = Phaser.Math.Distance.Between(requester.x, requester.y, v.x, v.y);
      if (d < bestDist) {
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  private handleKeyboardCamera(delta: number): void {
    if (!this.cursors || !this.wasd) return;
    const cam = this.cameras.main;
    const logicalZoom = cam.zoom / GAME_DPR;
    const speed = (520 / logicalZoom) * (delta / 1000);

    if (this.cursors.left.isDown || this.wasd.A.isDown) cam.scrollX -= speed;
    if (this.cursors.right.isDown || this.wasd.D.isDown) cam.scrollX += speed;
    if (this.cursors.up.isDown || this.wasd.W.isDown) cam.scrollY -= speed;
    if (this.cursors.down.isDown || this.wasd.S.isDown) cam.scrollY += speed;
  }
}
