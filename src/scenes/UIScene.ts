import Phaser from 'phaser';
import {
  AncestorRecord,
  BASE_POP_CAP,
  BUILDING_DEFS,
  BuildingSnapshot,
  BuildingType,
  CalendarState,
  ChiefStatus,
  DEFAULT_GAME_SETUP,
  DIFFICULTY_LABELS_UK,
  DifficultyLevel,
  formatAgeUk,
  GameMode,
  GameSetupConfig,
  LIFE_STAGE_LABELS_UK,
  MAP_PRESET_ORDER,
  MAP_PRESETS,
  MapPresetId,
  MAX_STORAGE,
  MinimapData,
  MUSIC_TRACK_LABELS_UK,
  MusicTrackId,
  PopulationState,
  ProfessionId,
  RivalTribeSnapshot,
  SEASON_DURATION_MS,
  SEASON_ICONS,
  SEASON_LABELS_UK,
  Season,
  SelectionSummary,
  SKILL_LEVEL_TITLES_UK,
  TECH_TREE,
  TechBranchId,
  TechState,
  TimeScale,
  TribeResources,
  VillagerRosterItem,
  VillagerSnapshot,
  WARRIOR_CLASS_LABELS_UK,
  WarriorClass,
} from '../types/game';
import { MAX_SAVE_SLOTS, SaveSummary } from '../systems/SaveSystem';
import { SoundFX } from '../utils/SoundFX';

const SEASON_TEXT_COLORS: Record<Season, string> = {
  SPRING: '#86efac',
  SUMMER: '#fde68a',
  AUTUMN: '#fdba74',
  WINTER: '#bae6fd',
};

const BUILD_ORDER: BuildingType[] = [
  'hut',
  'large_hut',
  'nursery',
  'gatherer_hut',
  'granary',
  'workshop',
  'armory',
  'barracks',
  'watchtower',
  'smokehouse',
  'totem',
  'palisade',
  'burial_mound',
];

const TECH_BRANCHES: TechBranchId[] = ['weapons', 'armor', 'craft', 'healing'];

interface ModalBuildCardRef {
  type: BuildingType;
  bg: Phaser.GameObjects.Graphics;
  titleText: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
  hovered: boolean;
}

interface TechCardRef {
  branch: TechBranchId;
  tierIdx: number;
  bg: Phaser.GameObjects.Graphics;
  titleText: Phaser.GameObjects.Text;
  descText: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
  hovered: boolean;
}

type ModalId = 'build' | 'tech' | 'chronicle' | 'diplomacy' | 'menu' | 'roster' | null;

export class UIScene extends Phaser.Scene {
  // Collapsible Top Bar (Row 1 always visible; Row 2 drawer toggled via 📦 Склад ▾)
  private topBarContainer!: Phaser.GameObjects.Container;
  private topBarBg!: Phaser.GameObjects.Graphics;
  private topBarDrawer!: Phaser.GameObjects.Container;
  private isStorageExpanded = false;
  private woodText!: Phaser.GameObjects.Text;
  private stoneText!: Phaser.GameObjects.Text;
  private foodText!: Phaser.GameObjects.Text;
  private boneText!: Phaser.GameObjects.Text;
  private hideText!: Phaser.GameObjects.Text;
  private popText!: Phaser.GameObjects.Text;
  private chiefText!: Phaser.GameObjects.Text;
  private storageBtnText!: Phaser.GameObjects.Text;
  private toolsText!: Phaser.GameObjects.Text;
  private spearText!: Phaser.GameObjects.Text;
  private bowText!: Phaser.GameObjects.Text;
  private clubText!: Phaser.GameObjects.Text;
  private hideArmorText!: Phaser.GameObjects.Text;
  private boneArmorText!: Phaser.GameObjects.Text;
  private knowledgeText!: Phaser.GameObjects.Text;
  private muteBtnBg!: Phaser.GameObjects.Graphics;
  private muteBtnText!: Phaser.GameObjects.Text;

  // Calendar bar
  private calendarContainer!: Phaser.GameObjects.Container;
  private calendarBg!: Phaser.GameObjects.Graphics;
  private calendarSeasonText!: Phaser.GameObjects.Text;
  private calendarYearText!: Phaser.GameObjects.Text;
  private calendarProgressGfx!: Phaser.GameObjects.Graphics;
  private calendarTimerText!: Phaser.GameObjects.Text;
  private freeTimeBadge!: Phaser.GameObjects.Text;
  private speedBtnBg!: Phaser.GameObjects.Graphics;
  private speedBtnText!: Phaser.GameObjects.Text;
  private skipBtnBg!: Phaser.GameObjects.Graphics;
  private skipBtnText!: Phaser.GameObjects.Text;
  private skipHitZone!: Phaser.GameObjects.Zone;
  private isSpeedHovered = false;
  private isSkipHovered = false;
  private lastTimerStr = '';

  // Tactical Minimap
  private minimapContainer!: Phaser.GameObjects.Container;
  private minimapGfx!: Phaser.GameObjects.Graphics;
  private latestMinimap: MinimapData | null = null;
  private readonly minimapW = 168;
  private readonly minimapH = 122;

  // Single Unit Panel
  private unitPanel!: Phaser.GameObjects.Container;
  private unitPanelBg!: Phaser.GameObjects.Graphics;
  private unitPortrait!: Phaser.GameObjects.Image;
  private unitNameText!: Phaser.GameObjects.Text;
  private unitGenderBadge!: Phaser.GameObjects.Text;
  private unitStateText!: Phaser.GameObjects.Text;
  private unitCarryText!: Phaser.GameObjects.Text;
  private unitFamilyText!: Phaser.GameObjects.Text;
  private unitToolStatusText!: Phaser.GameObjects.Text;
  private barGraphics!: Phaser.GameObjects.Graphics;
  private barValuesText: Phaser.GameObjects.Text[] = [];
  private unitSkillText!: Phaser.GameObjects.Text;
  private electChiefGroup!: Phaser.GameObjects.Container;
  private electChiefBtnBg!: Phaser.GameObjects.Graphics;
  private electChiefBtnText!: Phaser.GameObjects.Text;
  private isElectHovered = false;
  private unitPerksText!: Phaser.GameObjects.Text;

  // Multi-Unit Group Panel
  private groupPanel!: Phaser.GameObjects.Container;
  private groupTitleText!: Phaser.GameObjects.Text;
  private groupStatsText!: Phaser.GameObjects.Text;

  // Bottom Quick-Select Dock
  private quickDockContainer!: Phaser.GameObjects.Container;
  private quickAllText!: Phaser.GameObjects.Text;
  private quickIdleText!: Phaser.GameObjects.Text;
  private quickWarriorText!: Phaser.GameObjects.Text;

  // Simplified Bottom-Right Command Bar (🏗️ Будувати, 🤝 Племена, 🌫️ Туман)
  private actionBarContainer!: Phaser.GameObjects.Container;
  private buildBtnBg!: Phaser.GameObjects.Graphics;
  private tribesBtnBg!: Phaser.GameObjects.Graphics;
  private tribesBtnText!: Phaser.GameObjects.Text;
  private fogBtnBg!: Phaser.GameObjects.Graphics;
  private fogBtnText!: Phaser.GameObjects.Text;

  // Campfire Contextual Defense Panel
  private campfirePanel!: Phaser.GameObjects.Container;
  private campfireStatusText!: Phaser.GameObjects.Text;
  private campfireAlarmBtnText!: Phaser.GameObjects.Text;

  // Building Panel
  private buildingPanel!: Phaser.GameObjects.Container;
  private buildingTitleText!: Phaser.GameObjects.Text;
  private buildingDescText!: Phaser.GameObjects.Text;
  private buildingStatusText!: Phaser.GameObjects.Text;
  private buildingWorkerText!: Phaser.GameObjects.Text;
  private assignBtnGroup!: Phaser.GameObjects.Container;
  private assignBtnBg!: Phaser.GameObjects.Graphics;
  private assignBtnText!: Phaser.GameObjects.Text;
  private isAssignHovered = false;
  private rosterPickBtn!: Phaser.GameObjects.Text;
  private demolishBtn!: Phaser.GameObjects.Text;
  private barracksGroup!: Phaser.GameObjects.Container;
  private barracksTargetText!: Phaser.GameObjects.Text;
  private totemTechBtn!: Phaser.GameObjects.Text;
  private burialChronicleBtn!: Phaser.GameObjects.Text;

  // Centered Modals
  private buildModalContainer!: Phaser.GameObjects.Container;
  private buildModalCards: ModalBuildCardRef[] = [];
  private techModalContainer!: Phaser.GameObjects.Container;
  private techModalKnowledgeText!: Phaser.GameObjects.Text;
  private techCardRefs: TechCardRef[] = [];
  private chronicleContainer!: Phaser.GameObjects.Container;
  private chroniclePageText!: Phaser.GameObjects.Text;
  private chronicleEmptyText!: Phaser.GameObjects.Text;
  private chronicleRows: Array<{
    container: Phaser.GameObjects.Container;
    portrait: Phaser.GameObjects.Image;
    header: Phaser.GameObjects.Text;
    bio: Phaser.GameObjects.Text;
  }> = [];
  private chroniclePage = 0;

  // Diplomacy & Trade Modal
  private diplomacyModalContainer!: Phaser.GameObjects.Container;
  private diplomacyBodyContainer!: Phaser.GameObjects.Container;

  // Main Menu & Settings Modal (persistent controls — never destroyed/rebuilt on click)
  private mainMenuContainer!: Phaser.GameObjects.Container;
  private menuDraftConfig: GameSetupConfig = { ...DEFAULT_GAME_SETUP };
  private menuContinueBtn!: Phaser.GameObjects.Text;
  private isInitialBootMenu = false;
  private menuMapButtons = new Map<MapPresetId, Phaser.GameObjects.Text>();
  private menuPrevTitle!: Phaser.GameObjects.Text;
  private menuPrevDesc!: Phaser.GameObjects.Text;
  private menuPrevStats!: Phaser.GameObjects.Text;
  private menuModeButtons = new Map<GameMode, Phaser.GameObjects.Text>();
  private menuDiffButtons = new Map<DifficultyLevel, Phaser.GameObjects.Text>();
  private menuRivalButtons = new Map<0 | 1 | 2 | 3, Phaser.GameObjects.Text>();
  private menuFogBtn!: Phaser.GameObjects.Text;
  private menuMusicButtons = new Map<MusicTrackId, Phaser.GameObjects.Text>();
  private menuAmbBtn!: Phaser.GameObjects.Text;
  private menuStartBtn!: Phaser.GameObjects.Text;
  private menuSavesBtn!: Phaser.GameObjects.Text;
  private latestSavesList: Array<SaveSummary | null> = [];

  // 5-Slot Saves Manager Modal (persistent slot rows)
  private savesModalContainer!: Phaser.GameObjects.Container;
  private saveSlotRows: Array<{
    slotId: number;
    titleText: Phaser.GameObjects.Text;
    infoText: Phaser.GameObjects.Text;
    saveBtn: Phaser.GameObjects.Text;
    loadBtn: Phaser.GameObjects.Text;
    deleteBtn: Phaser.GameObjects.Text;
  }> = [];

  // Villager Profile Roster Picker Modal
  private rosterModalContainer!: Phaser.GameObjects.Container;
  private rosterListContainer!: Phaser.GameObjects.Container;
  private rosterTitleText!: Phaser.GameObjects.Text;
  private rosterPageText!: Phaser.GameObjects.Text;
  private rosterPage = 0;

  private hintText!: Phaser.GameObjects.Text;

  private latestResources: TribeResources = {
    wood: 0,
    stone: 0,
    food: 0,
    bone: 0,
    hide: 0,
    storageCap: MAX_STORAGE,
    tools: 0,
    weapons: { spear: 0, bow: 0, club: 0 },
    armors: { hide_armor: 0, bone_armor: 0 },
    knowledge: 0,
  };
  private latestSnapshot: VillagerSnapshot | null = null;
  private latestSummary: SelectionSummary = {
    count: 0,
    idleCount: 0,
    warriorCount: 0,
    workingCount: 0,
    totalTribe: 3,
    totalIdle: 3,
    totalWarriors: 0,
  };
  private latestBuilding: BuildingSnapshot | null = null;
  private latestRivals: RivalTribeSnapshot[] = [];
  private latestRoster: VillagerRosterItem[] = [];
  private latestConfig: GameSetupConfig = { ...DEFAULT_GAME_SETUP };
  private ancestors: AncestorRecord[] = [];
  private techState: TechState = { weapons: 0, armor: 0, craft: 0, healing: 0 };
  private alarmState = { active: false, manual: false, threatCount: 0 };
  private population: PopulationState = { count: 3, cap: BASE_POP_CAP, warriors: 0, warriorCap: 0 };
  private chiefStatus: ChiefStatus = { chiefId: null, chiefName: null };
  private calendar: CalendarState = {
    season: 'SPRING',
    year: 1,
    elapsedMs: 0,
    durationMs: SEASON_DURATION_MS,
    timeScale: 1,
    isFreeTime: false,
    freeTimeRemainingMs: SEASON_DURATION_MS,
    mode: 'sandbox',
    canSkipSeason: true,
  };
  private activeBuildType: BuildingType | null = null;

  private readonly baseBarWidth = 816;
  private readonly calendarBarWidth = 532;
  private readonly cardWidth = 376;
  private readonly cardHeight = 178;
  private readonly buildingPanelW = 368;
  private readonly buildingPanelH = 174;
  private readonly actionBarWidth = 364;

  constructor() {
    super({ key: 'UIScene' });
  }

  public create(): void {
    this.createTopBar();
    this.createCalendarBar();
    this.createMinimap();
    this.createUnitPanel();
    this.createGroupPanel();
    this.createQuickDock();
    this.createActionBar();
    this.createCampfirePanel();
    this.createBuildingPanel();
    this.createBuildModal();
    this.createTechModal();
    this.createChronicleModal();
    this.createDiplomacyModal();
    this.createMainMenuModal();
    this.createSavesModal();
    this.createRosterModal();
    this.createHint();

    this.layoutUI(this.scale.width, this.scale.height);
    this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
      this.layoutUI(gameSize.width, gameSize.height);
    });

    const gameScene = this.scene.get('GameScene');
    gameScene.events.on('resources-updated', (res: TribeResources) => {
      this.latestResources = res;
      this.refreshResourceTexts();
      if (this.buildModalContainer.visible) this.refreshBuildModal();
      if (this.diplomacyModalContainer.visible) this.refreshDiplomacyModal();
    });
    gameScene.events.on(
      'selection-updated',
      (payload: { single: VillagerSnapshot | null; summary: SelectionSummary }) => {
        this.latestSnapshot = payload.single;
        this.latestSummary = payload.summary;
        this.refreshSelectionPanels();
        if (this.latestBuilding) this.refreshBuildingPanel();
      }
    );
    gameScene.events.on('building-selected', (bSnap: BuildingSnapshot | null) => {
      this.latestBuilding = bSnap;
      if (bSnap) {
        this.campfirePanel.setVisible(false);
      }
      this.refreshBuildingPanel();
    });
    gameScene.events.on('campfire-clicked', () => {
      this.latestBuilding = null;
      this.buildingPanel.setVisible(false);
      this.campfirePanel.setVisible(!this.campfirePanel.visible);
      this.refreshCampfirePanel();
    });
    gameScene.events.on('open-tech-modal', () => {
      this.openOnlyModal('tech');
    });
    gameScene.events.on('chronicle-updated', (list: AncestorRecord[]) => {
      this.ancestors = list;
      if (this.chronicleContainer.visible) this.refreshChronicleModal();
    });
    gameScene.events.on('open-chronicle', (list: AncestorRecord[]) => {
      this.ancestors = list;
      this.chroniclePage = 0;
      this.openOnlyModal('chronicle');
    });
    gameScene.events.on('population-updated', (pop: PopulationState) => {
      this.population = pop;
      this.refreshResourceTexts();
    });
    gameScene.events.on('chief-updated', (status: ChiefStatus) => {
      this.chiefStatus = status;
      this.refreshChiefHeader();
    });
    gameScene.events.on('calendar-updated', (cal: CalendarState) => {
      this.calendar = cal;
      this.refreshCalendarBar();
    });
    gameScene.events.on('build-mode-updated', (type: BuildingType | null) => {
      this.activeBuildType = type;
      this.refreshActionBar();
    });
    gameScene.events.on('tech-updated', (tech: TechState) => {
      this.techState = tech;
      if (this.techModalContainer.visible) this.refreshTechModal();
    });
    gameScene.events.on(
      'alarm-updated',
      (al: { active: boolean; manual: boolean; threatCount: number }) => {
        this.alarmState = al;
        this.refreshActionBar();
        this.refreshCampfirePanel();
      }
    );
    gameScene.events.on('minimap-updated', (data: MinimapData) => {
      this.latestMinimap = data;
      this.drawMinimap();
    });
    gameScene.events.on('rivals-updated', (rivals: RivalTribeSnapshot[]) => {
      this.latestRivals = rivals;
      this.refreshActionBar();
      if (this.diplomacyModalContainer.visible) {
        this.refreshDiplomacyModal();
      }
    });
    gameScene.events.on('roster-updated', (roster: VillagerRosterItem[]) => {
      this.latestRoster = roster;
      if (this.rosterModalContainer.visible) {
        this.refreshRosterModal();
      }
    });
    gameScene.events.on('config-updated', (cfg: GameSetupConfig) => {
      this.latestConfig = { ...cfg };
      this.menuDraftConfig = { ...cfg };
      this.refreshActionBar();
      if (this.mainMenuContainer.visible) {
        this.refreshMainMenuModal();
      }
    });
    gameScene.events.on('show-main-menu-on-boot', () => {
      this.isInitialBootMenu = true;
      this.openOnlyModal('menu');
    });
    gameScene.events.on('saves-list-updated', (list: Array<SaveSummary | null>) => {
      this.latestSavesList = list;
      if (this.mainMenuContainer.visible) {
        this.refreshMainMenuModal();
      }
      if (this.savesModalContainer.visible) {
        this.refreshSavesModal();
      }
    });

    this.events.emit('ui-ready');
  }

  private openOnlyModal(which: ModalId): void {
    this.buildModalContainer.setVisible(which === 'build');
    this.techModalContainer.setVisible(which === 'tech');
    this.chronicleContainer.setVisible(which === 'chronicle');
    this.diplomacyModalContainer.setVisible(which === 'diplomacy');
    this.mainMenuContainer.setVisible(which === 'menu');
    this.rosterModalContainer.setVisible(which === 'roster');
    this.savesModalContainer.setVisible(false);

    const isMenu = which === 'menu';
    this.setHudVisible(!isMenu);
    if (this.scene.get('GameScene')) {
      this.scene.setVisible(!isMenu, 'GameScene');
    }
    this.events.emit('set-menu-open', isMenu);

    if (which === 'build') this.refreshBuildModal();
    if (which === 'tech') this.refreshTechModal();
    if (which === 'chronicle') this.refreshChronicleModal();
    if (which === 'diplomacy') this.refreshDiplomacyModal();
    if (which === 'menu') this.refreshMainMenuModal();
    if (which === 'roster') this.refreshRosterModal();
  }

  private setHudVisible(visible: boolean): void {
    this.topBarContainer.setVisible(visible);
    this.calendarContainer.setVisible(visible);
    this.minimapContainer.setVisible(visible);
    this.quickDockContainer.setVisible(visible);
    this.actionBarContainer.setVisible(visible);
    this.hintText.setVisible(visible && this.scale.width >= 820);
    if (!visible) {
      this.unitPanel.setVisible(false);
      this.groupPanel.setVisible(false);
      this.buildingPanel.setVisible(false);
      this.campfirePanel.setVisible(false);
    } else {
      this.refreshSelectionPanels();
      this.refreshBuildingPanel();
    }
  }

  private createTopBar(): void {
    this.topBarContainer = this.add.container(0, 8);
    this.topBarBg = this.add.graphics();
    this.topBarContainer.add(this.topBarBg);

    // Row 1: Primary resources (Дерево, Камінь, Їжа), Населення, Вождь, 📦 Склад ▾, ⚙️ Меню, 🔊
    const iconWood = this.add.image(20, 19, 'icon-wood').setScale(0.68);
    this.woodText = this.add.text(35, 12, `0/${MAX_STORAGE}`, {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#fff8e7',
    });

    const iconStone = this.add.image(118, 19, 'icon-stone').setScale(0.68);
    this.stoneText = this.add.text(133, 12, `0/${MAX_STORAGE}`, {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#fff8e7',
    });

    const iconFood = this.add.image(216, 19, 'icon-food').setScale(0.68);
    this.foodText = this.add.text(231, 12, `0/${MAX_STORAGE}`, {
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#fff8e7',
    });

    this.popText = this.add.text(318, 11, `👥 3/${BASE_POP_CAP}`, {
      fontSize: '13.5px',
      fontStyle: 'bold',
      color: '#ffe066',
    });

    const chiefIcon = this.add.image(448, 19, 'icon-chief-skull').setScale(0.68);
    this.chiefText = this.add.text(464, 12, 'Без вождя', {
      fontSize: '12.5px',
      fontStyle: 'bold',
      color: '#cbd5e1',
    });

    // Collapsible Storage Drawer toggle button
    this.storageBtnText = this.add
      .text(596, 19, '📦 Склад ▾', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#fde68a',
        backgroundColor: '#3b281a',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.storageBtnText.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.isStorageExpanded = !this.isStorageExpanded;
      this.topBarDrawer.setVisible(this.isStorageExpanded);
      this.storageBtnText.setText(this.isStorageExpanded ? '📦 Склад ▴' : '📦 Склад ▾');
      this.drawTopBarBg(this.baseBarWidth);
      this.layoutUI(this.scale.width, this.scale.height);
    });

    // Quick Save / Saves Manager button
    const quickSaveBtn = this.add
      .text(672, 19, '💾', {
        fontSize: '13px',
        backgroundColor: '#1e3a5f',
        padding: { x: 7, y: 3 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    quickSaveBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.openSavesModal();
    });

    // Main Menu button
    const menuBtn = this.add
      .text(728, 19, '⚙️ Меню', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#86efac',
        backgroundColor: '#1e3a29',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.isInitialBootMenu = false;
      this.menuDraftConfig = { ...this.latestConfig };
      this.openOnlyModal(this.mainMenuContainer.visible ? null : 'menu');
    });

    const muteX = 788;
    const muteY = 19;
    this.muteBtnBg = this.add.graphics().setPosition(muteX, muteY);
    this.drawMuteButtonBg(false);
    this.muteBtnText = this.add
      .text(muteX, muteY, SoundFX.isMuted() ? '🔇' : '🔊', { fontSize: '15px' })
      .setOrigin(0.5);
    const muteHit = this.add.zone(muteX, muteY, 32, 26).setInteractive({ useHandCursor: true });
    muteHit.on('pointerover', () => this.drawMuteButtonBg(true));
    muteHit.on('pointerout', () => this.drawMuteButtonBg(false));
    muteHit.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      const muted = SoundFX.toggleMute();
      this.muteBtnText.setText(muted ? '🔇' : '🔊');
    });

    // Row 2 Collapsible Drawer: Bone, Hide, Tools, Spears, Bows, Clubs, Hide Armor, Bone Armor, Knowledge
    this.topBarDrawer = this.add.container(0, 0);
    const iconBone = this.add.image(18, 50, 'icon-bone').setScale(0.62);
    this.boneText = this.add.text(31, 43, `0/${MAX_STORAGE}`, {
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: '#fef9c3',
    });

    const iconHide = this.add.image(102, 50, 'icon-hide').setScale(0.62);
    this.hideText = this.add.text(115, 43, `0/${MAX_STORAGE}`, {
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: '#fed7aa',
    });

    const iconTools = this.add.image(186, 50, 'icon-tools').setScale(0.58);
    this.toolsText = this.add.text(198, 43, 'Інстр: 0', {
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: '#38bdf8',
    });

    this.spearText = this.add.text(272, 43, '🔱 Списи: 0', {
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: '#e2e8f0',
    });
    this.bowText = this.add.text(364, 43, '🏹 Луки: 0', {
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: '#fde68a',
    });
    this.clubText = this.add.text(448, 43, '🦴 Палиці: 0', {
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: '#fca5a5',
    });
    this.hideArmorText = this.add.text(534, 43, '🧥 Шк.бр: 0', {
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: '#fdba74',
    });
    this.boneArmorText = this.add.text(622, 43, '🛡️ Кіст.бр: 0', {
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });

    const iconKnow = this.add.image(742, 50, 'icon-knowledge').setScale(0.58);
    this.knowledgeText = this.add.text(756, 43, '✨ 0', {
      fontSize: '11.5px',
      fontStyle: 'bold',
      color: '#67e8f9',
    });

    this.topBarDrawer.add([
      iconBone,
      this.boneText,
      iconHide,
      this.hideText,
      iconTools,
      this.toolsText,
      this.spearText,
      this.bowText,
      this.clubText,
      this.hideArmorText,
      this.boneArmorText,
      iconKnow,
      this.knowledgeText,
    ]);
    this.topBarDrawer.setVisible(this.isStorageExpanded);

    this.drawTopBarBg(this.baseBarWidth);

    this.topBarContainer.add([
      iconWood,
      this.woodText,
      iconStone,
      this.stoneText,
      iconFood,
      this.foodText,
      this.popText,
      chiefIcon,
      this.chiefText,
      this.storageBtnText,
      quickSaveBtn,
      menuBtn,
      this.muteBtnBg,
      this.muteBtnText,
      muteHit,
      this.topBarDrawer,
    ]);
  }

  private drawTopBarBg(width: number): void {
    const h = this.isStorageExpanded ? 68 : 38;
    this.topBarBg.clear();
    this.topBarBg.fillStyle(0x0f0a06, 0.45);
    this.topBarBg.fillRoundedRect(0, 3, width, h, 14);
    this.topBarBg.fillStyle(0x281b12, 0.92);
    this.topBarBg.fillRoundedRect(0, 0, width, h, 14);
    if (this.isStorageExpanded) {
      this.topBarBg.lineStyle(1, 0xffe066, 0.22);
      this.topBarBg.lineBetween(14, 35, width - 14, 35);
    }
    this.topBarBg.lineStyle(2, 0xc98a4b, 0.92);
    this.topBarBg.strokeRoundedRect(0, 0, width, h, 14);
  }

  private drawMuteButtonBg(hovered: boolean): void {
    this.muteBtnBg.clear();
    this.muteBtnBg.fillStyle(hovered ? 0x4b3421 : 0x382618, 0.95);
    this.muteBtnBg.fillRoundedRect(-16, -13, 32, 26, 7);
    this.muteBtnBg.lineStyle(1.2, 0xc98a4b, hovered ? 1 : 0.65);
    this.muteBtnBg.strokeRoundedRect(-16, -13, 32, 26, 7);
  }

  private createCalendarBar(): void {
    this.calendarContainer = this.add.container(0, 52);
    this.calendarBg = this.add.graphics();
    this.calendarBg.fillStyle(0x0f0a06, 0.44);
    this.calendarBg.fillRoundedRect(0, 3, this.calendarBarWidth, 38, 11);
    this.calendarBg.fillStyle(0x281b12, 0.91);
    this.calendarBg.fillRoundedRect(0, 0, this.calendarBarWidth, 38, 11);
    this.calendarBg.lineStyle(1.6, 0xc98a4b, 0.9);
    this.calendarBg.strokeRoundedRect(0, 0, this.calendarBarWidth, 38, 11);

    this.calendarSeasonText = this.add.text(12, 10, '🌸 Весна', {
      fontSize: '13.5px',
      fontStyle: 'bold',
      color: SEASON_TEXT_COLORS.SPRING,
    });

    this.calendarYearText = this.add.text(104, 10, 'Рік 1', {
      fontSize: '13.5px',
      fontStyle: 'bold',
      color: '#ffe066',
    });

    this.calendarProgressGfx = this.add.graphics();
    this.calendarTimerText = this.add.text(286, 11, '10:00', {
      fontSize: '12.5px',
      fontStyle: 'bold',
      color: '#e6ccb2',
    });

    this.freeTimeBadge = this.add.text(334, 11, '❤️', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#fda4af',
    });
    this.freeTimeBadge.setVisible(false);

    const speedX = 390;
    const speedY = 19;
    this.speedBtnBg = this.add.graphics().setPosition(speedX, speedY);
    this.speedBtnText = this.add
      .text(speedX, speedY, '1x', { fontSize: '12.5px', fontStyle: 'bold', color: '#fff8e7' })
      .setOrigin(0.5);
    const speedHit = this.add.zone(speedX, speedY, 46, 24).setInteractive({ useHandCursor: true });
    speedHit.on('pointerover', () => {
      this.isSpeedHovered = true;
      this.drawSpeedButtonBg(this.calendar.timeScale);
    });
    speedHit.on('pointerout', () => {
      this.isSpeedHovered = false;
      this.drawSpeedButtonBg(this.calendar.timeScale);
    });
    speedHit.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('cycle-speed');
    });

    const skipX = 468;
    const skipY = 19;
    this.skipBtnBg = this.add.graphics().setPosition(skipX, skipY);
    this.skipBtnText = this.add
      .text(skipX, skipY, '⏭ Сезон', { fontSize: '12px', fontStyle: 'bold', color: '#fde68a' })
      .setOrigin(0.5);
    this.skipHitZone = this.add
      .zone(skipX, skipY, 88, 24)
      .setInteractive({ useHandCursor: true });
    this.skipHitZone.on('pointerover', () => {
      this.isSkipHovered = true;
      this.drawSkipButtonBg();
    });
    this.skipHitZone.on('pointerout', () => {
      this.isSkipHovered = false;
      this.drawSkipButtonBg();
    });
    this.skipHitZone.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('next-season');
    });

    this.calendarContainer.add([
      this.calendarBg,
      this.calendarSeasonText,
      this.calendarYearText,
      this.calendarProgressGfx,
      this.calendarTimerText,
      this.freeTimeBadge,
      this.speedBtnBg,
      this.speedBtnText,
      speedHit,
      this.skipBtnBg,
      this.skipBtnText,
      this.skipHitZone,
    ]);

    this.refreshCalendarBar();
  }

  private drawSpeedButtonBg(scale: TimeScale): void {
    const active = scale > 1;
    this.speedBtnBg.clear();
    this.speedBtnBg.fillStyle(this.isSpeedHovered ? 0x4b3421 : active ? 0x1e4628 : 0x382618, 0.95);
    this.speedBtnBg.fillRoundedRect(-23, -12, 46, 24, 6);
    this.speedBtnBg.lineStyle(1.3, active ? 0x4ade80 : 0xc98a4b, this.isSpeedHovered ? 1 : 0.85);
    this.speedBtnBg.strokeRoundedRect(-23, -12, 46, 24, 6);
  }

  private drawSkipButtonBg(): void {
    this.skipBtnBg.clear();
    if (!this.calendar.canSkipSeason) return;
    this.skipBtnBg.fillStyle(this.isSkipHovered ? 0x5c3c1b : 0x422b16, 0.95);
    this.skipBtnBg.fillRoundedRect(-44, -12, 88, 24, 6);
    this.skipBtnBg.lineStyle(1.3, 0xc98a4b, this.isSkipHovered ? 1 : 0.8);
    this.skipBtnBg.strokeRoundedRect(-44, -12, 88, 24, 6);
  }

  private refreshCalendarBar(): void {
    const { season, year, elapsedMs, durationMs, timeScale, isFreeTime, canSkipSeason } =
      this.calendar;
    this.calendarSeasonText.setText(`${SEASON_ICONS[season]} ${SEASON_LABELS_UK[season]}`);
    this.calendarSeasonText.setColor(SEASON_TEXT_COLORS[season]);
    this.calendarYearText.setText(`Рік ${year}`);

    const ratio = Phaser.Math.Clamp(elapsedMs / Math.max(1, durationMs), 0, 1);
    const barX = 166;
    const barY = 14;
    const barW = 112;
    const barH = 10;

    this.calendarProgressGfx.clear();
    this.calendarProgressGfx.fillStyle(0x130d09, 0.95);
    this.calendarProgressGfx.fillRoundedRect(barX, barY, barW, barH, 5);
    this.calendarProgressGfx.lineStyle(1, 0x4d3724, 0.85);
    this.calendarProgressGfx.strokeRoundedRect(barX, barY, barW, barH, 5);

    const barColor = isFreeTime
      ? 0xfb7185
      : season === 'SPRING'
      ? 0x4ade80
      : season === 'SUMMER'
      ? 0xfbbf24
      : season === 'AUTUMN'
      ? 0xf97316
      : 0x38bdf8;
    this.calendarProgressGfx.fillStyle(barColor, 1);
    this.calendarProgressGfx.fillRoundedRect(barX, barY, Math.max(4, barW * ratio), barH, 5);

    this.freeTimeBadge.setVisible(isFreeTime);

    const remainingSec = Math.max(0, Math.ceil((durationMs - elapsedMs) / 1000));
    const mins = Math.floor(remainingSec / 60);
    const secs = remainingSec % 60;
    const timerStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (timerStr !== this.lastTimerStr) {
      this.lastTimerStr = timerStr;
      this.calendarTimerText.setText(timerStr);
    }

    this.speedBtnText.setText(`${timeScale}x`);
    this.speedBtnText.setColor(timeScale > 1 ? '#86efac' : '#fff8e7');
    this.drawSpeedButtonBg(timeScale);

    // Hide 1-click Season Skip when in Survival mode!
    this.skipBtnBg.setVisible(canSkipSeason);
    this.skipBtnText.setVisible(canSkipSeason);
    if (canSkipSeason) {
      this.skipHitZone.setInteractive({ useHandCursor: true });
    } else {
      this.skipHitZone.disableInteractive();
    }
    this.drawSkipButtonBg();
  }

  private createMinimap(): void {
    this.minimapContainer = this.add.container(0, 10);
    const frame = this.add.graphics();
    frame.fillStyle(0x0f0a06, 0.55);
    frame.fillRoundedRect(-4, -2, this.minimapW + 8, this.minimapH + 26, 11);
    frame.fillStyle(0x23170e, 0.94);
    frame.fillRoundedRect(0, 0, this.minimapW, this.minimapH + 22, 10);
    frame.lineStyle(1.8, 0xc98a4b, 0.95);
    frame.strokeRoundedRect(0, 0, this.minimapW, this.minimapH + 22, 10);

    const title = this.add
      .text(this.minimapW / 2, 11, '🗺️ Мапа світу', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#fde68a',
      })
      .setOrigin(0.5);

    this.minimapGfx = this.add.graphics().setPosition(4, 21);

    const hit = this.add
      .zone(this.minimapW / 2, 21 + (this.minimapH - 4) / 2, this.minimapW - 8, this.minimapH - 4)
      .setInteractive({ useHandCursor: true });

    const jumpAt = (localX: number, localY: number) => {
      if (!this.latestMinimap) return;
      const mapW = this.minimapW - 8;
      const mapH = this.minimapH - 4;
      const nx = Phaser.Math.Clamp((localX - 4) / mapW, 0, 1);
      const ny = Phaser.Math.Clamp((localY - 21) / mapH, 0, 1);
      this.events.emit('minimap-jump', {
        x: nx * this.latestMinimap.worldW,
        y: ny * this.latestMinimap.worldH,
      });
    };

    hit.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.events.emit('ui-button-clicked');
      const lx = (pointer.x - this.minimapContainer.x) / this.minimapContainer.scaleX;
      const ly = (pointer.y - this.minimapContainer.y) / this.minimapContainer.scaleY;
      jumpAt(lx, ly);
    });

    this.minimapContainer.add([frame, title, this.minimapGfx, hit]);
  }

  private drawMinimap(): void {
    const m = this.latestMinimap;
    if (!m) return;
    const mapW = this.minimapW - 8;
    const mapH = this.minimapH - 4;
    const sx = mapW / m.worldW;
    const sy = mapH / m.worldH;

    const g = this.minimapGfx;
    g.clear();
    g.fillStyle(m.fogEnabled ? 0x162218 : 0x2d5424, 1);
    g.fillRoundedRect(0, 0, mapW, mapH, 5);

    // Real River(s) & Fords on Minimap
    if (m.riverPoints && m.riverPoints.length > 0) {
      for (const rp of m.riverPoints) {
        const rPx = Math.max(1.8, rp.radius * sx);
        g.fillStyle(rp.isFord ? 0x94a3b8 : 0x0ea5e9, 0.92);
        g.fillCircle(rp.x * sx, rp.y * sy, rPx);
      }
    }

    // Real Lake on Minimap
    g.fillStyle(0x0284c7, 0.96);
    g.fillEllipse(m.lake.x * sx, m.lake.y * sy, Math.max(10, 260 * sx), Math.max(7, 175 * sy));
    g.lineStyle(1, 0xbae6fd, 0.45);
    g.strokeEllipse(m.lake.x * sx, m.lake.y * sy, Math.max(10, 260 * sx), Math.max(7, 175 * sy));

    // Rival camps (only show undiscovered camps if Fog of War is off)
    for (const r of m.rivals) {
      if (m.fogEnabled && !r.discovered) continue;
      g.fillStyle(r.alive ? r.color : 0x64748b, r.alive ? 0.95 : 0.45);
      g.fillRect(r.x * sx - 4, r.y * sy - 4, 8, 8);
      g.lineStyle(1, 0xffffff, 0.55);
      g.strokeRect(r.x * sx - 4, r.y * sy - 4, 8, 8);
    }

    // Player Campfire
    g.fillStyle(0x4ade80, 1);
    g.fillCircle(m.playerCamp.x * sx, m.playerCamp.y * sy, 4.5);
    g.fillStyle(0xfbbf24, 1);
    g.fillCircle(m.playerCamp.x * sx, m.playerCamp.y * sy, 2);

    // Predators
    g.fillStyle(0xf59e0b, 1);
    for (const p of m.predators) {
      g.fillCircle(p.x * sx, p.y * sy, 2.2);
    }

    // Enemy Units
    for (const e of m.enemyUnits) {
      g.fillStyle(e.color, 1);
      g.fillCircle(e.x * sx, e.y * sy, 2);
    }

    // Player villagers & warriors
    for (const u of m.playerUnits) {
      g.fillStyle(u.selected ? 0xfef08a : u.isWarrior ? 0x38bdf8 : 0xecfccb, 1);
      g.fillCircle(u.x * sx, u.y * sy, u.selected ? 2.4 : 1.8);
    }

    // Camera viewport rect
    g.lineStyle(1.3, 0xffffff, 0.88);
    g.strokeRect(m.camX * sx, m.camY * sy, m.camW * sx, m.camH * sy);
  }

  private createUnitPanel(): void {
    this.unitPanel = this.add.container(16, 0);
    this.unitPanelBg = this.add.graphics();
    this.unitPanelBg.fillStyle(0x0f0a06, 0.5);
    this.unitPanelBg.fillRoundedRect(0, 4, this.cardWidth, this.cardHeight, 16);
    this.unitPanelBg.fillStyle(0x261a11, 0.94);
    this.unitPanelBg.fillRoundedRect(0, 0, this.cardWidth, this.cardHeight, 16);
    this.unitPanelBg.lineStyle(2, 0xc98a4b, 0.95);
    this.unitPanelBg.strokeRoundedRect(0, 0, this.cardWidth, this.cardHeight, 16);

    this.unitPortrait = this.add.image(44, 72, 'portrait-male-1').setScale(0.52);
    this.unitNameText = this.add.text(88, 10, '', {
      fontSize: '14.5px',
      fontStyle: 'bold',
      color: '#ffe066',
    });
    this.unitGenderBadge = this.add
      .text(this.cardWidth - 14, 10, '', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#f2e8cf',
        backgroundColor: '#3e2b1c',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(1, 0);

    this.unitStateText = this.add.text(88, 32, '', { fontSize: '11.5px', color: '#f5ebe0' });
    this.unitCarryText = this.add
      .text(this.cardWidth - 14, 32, '', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#a7f3d0',
      })
      .setOrigin(1, 0);

    this.unitFamilyText = this.add.text(88, 51, '', { fontSize: '10.5px', color: '#d6c2a8' });
    this.unitToolStatusText = this.add
      .text(this.cardWidth - 14, 51, '', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#38bdf8',
      })
      .setOrigin(1, 0);

    this.barGraphics = this.add.graphics();
    this.unitSkillText = this.add.text(88, 128, '', {
      fontSize: '10.5px',
      fontStyle: 'bold',
      color: '#fde68a',
    });

    this.electChiefGroup = this.add.container(0, 0);
    this.electChiefBtnBg = this.add.graphics();
    this.electChiefBtnText = this.add
      .text(88 + 137, 147 + 11, '💀 Обрати Вождем', {
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: '#fef08a',
      })
      .setOrigin(0.5);
    const electHit = this.add
      .zone(88 + 137, 147 + 11, 274, 22)
      .setInteractive({ useHandCursor: true });
    electHit.on('pointerover', () => {
      this.isElectHovered = true;
      this.drawElectChiefButtonBg();
    });
    electHit.on('pointerout', () => {
      this.isElectHovered = false;
      this.drawElectChiefButtonBg();
    });
    electHit.on('pointerdown', () => {
      if (!this.latestSnapshot || !this.latestSnapshot.canElectChief) return;
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('elect-chief', this.latestSnapshot.id);
    });
    this.electChiefGroup.add([this.electChiefBtnBg, this.electChiefBtnText, electHit]);
    this.drawElectChiefButtonBg();

    this.unitPerksText = this.add.text(88, 150, '', {
      fontSize: '10.5px',
      fontStyle: 'bold',
      color: '#fde047',
    });

    this.unitPanel.add([
      this.unitPanelBg,
      this.unitPortrait,
      this.unitNameText,
      this.unitGenderBadge,
      this.unitStateText,
      this.unitCarryText,
      this.unitFamilyText,
      this.unitToolStatusText,
      this.barGraphics,
      this.unitSkillText,
      this.electChiefGroup,
      this.unitPerksText,
    ]);

    const labels = ['Здоров’я', 'Ситість', 'Енергія'];
    labels.forEach((lbl, idx) => {
      const y = 70 + idx * 18;
      const t = this.add.text(88, y, lbl, { fontSize: '11px', color: '#e6ccb2' });
      const valText = this.add
        .text(this.cardWidth - 14, y, '120', {
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: '#fff8e7',
        })
        .setOrigin(1, 0);
      this.barValuesText.push(valText);
      this.unitPanel.add([t, valText]);
    });

    this.unitPanel.setVisible(false);
  }

  private drawElectChiefButtonBg(): void {
    this.electChiefBtnBg.clear();
    this.electChiefBtnBg.fillStyle(this.isElectHovered ? 0x92400e : 0x78350f, 0.96);
    this.electChiefBtnBg.fillRoundedRect(88, 147, 274, 22, 7);
    this.electChiefBtnBg.lineStyle(1.4, 0xfbbf24, this.isElectHovered ? 1 : 0.85);
    this.electChiefBtnBg.strokeRoundedRect(88, 147, 274, 22, 7);
  }

  private createGroupPanel(): void {
    const w = 368;
    const h = 114;
    this.groupPanel = this.add.container(14, 0);
    const bg = this.add.graphics();
    bg.fillStyle(0x261a11, 0.94);
    bg.fillRoundedRect(0, 0, w, h, 14);
    bg.lineStyle(2, 0xc98a4b, 0.95);
    bg.strokeRoundedRect(0, 0, w, h, 14);

    this.groupTitleText = this.add.text(14, 12, 'Виділено загін: 0', {
      fontSize: '15px',
      fontStyle: 'bold',
      color: '#ffe066',
    });

    const clearBtn = this.add
      .text(w - 14, 12, '✕ Скинути', {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#fca5a5',
        backgroundColor: '#3b1d14',
        padding: { x: 7, y: 3 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    clearBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      this.events.emit('clear-selection');
    });

    this.groupStatsText = this.add.text(14, 40, '', { fontSize: '12px', color: '#f5ebe0' });

    const mkBtn = (bx: number, label: string, ev: string) => {
      const btn = this.add
        .text(bx, 74, label, {
          fontSize: '11.5px',
          fontStyle: 'bold',
          color: '#fef08a',
          backgroundColor: '#3a271a',
          padding: { x: 9, y: 5 },
        })
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.events.emit(ev);
      });
      return btn;
    };

    const btnAll = mkBtn(14, '👥 Дорослі', 'select-all-villagers');
    const btnIdle = mkBtn(106, '💤 Всі вільні', 'select-idle-villagers');
    const btnWar = mkBtn(222, '⚔️ Воїни', 'select-warrior-villagers');

    this.groupPanel.add([
      bg,
      this.groupTitleText,
      clearBtn,
      this.groupStatsText,
      btnAll,
      btnIdle,
      btnWar,
    ]);
    this.groupPanel.setVisible(false);
  }

  private createQuickDock(): void {
    this.quickDockContainer = this.add.container(0, 0);
    const w = 362;
    const h = 42;
    const bg = this.add.graphics();
    bg.fillStyle(0x23170e, 0.92);
    bg.fillRoundedRect(0, 0, w, h, 12);
    bg.lineStyle(1.6, 0xc98a4b, 0.9);
    bg.strokeRoundedRect(0, 0, w, h, 12);

    const mkBtn = (x: number, bw: number, label: string, color: string, ev: string) => {
      const t = this.add
        .text(x + bw / 2, h / 2, label, {
          fontSize: '12px',
          fontStyle: 'bold',
          color,
          backgroundColor: '#3a271a',
          padding: { x: 8, y: 5 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.events.emit(ev);
      });
      return t;
    };

    this.quickAllText = mkBtn(8, 102, '👥 Всі (3)', '#ffe066', 'select-all-villagers');
    this.quickIdleText = mkBtn(116, 128, '💤 Вільні (3)', '#a7f3d0', 'select-idle-villagers');
    this.quickWarriorText = mkBtn(250, 104, '⚔️ Воїни (0)', '#93c5fd', 'select-warrior-villagers');

    this.quickDockContainer.add([bg, this.quickAllText, this.quickIdleText, this.quickWarriorText]);
  }

  private createActionBar(): void {
    this.actionBarContainer = this.add.container(0, 0);
    const w = this.actionBarWidth;
    const h = 46;
    const bg = this.add.graphics();
    bg.fillStyle(0x23170e, 0.94);
    bg.fillRoundedRect(0, 0, w, h, 12);
    bg.lineStyle(1.8, 0xc98a4b, 0.95);
    bg.strokeRoundedRect(0, 0, w, h, 12);
    this.actionBarContainer.add(bg);

    const makeAction = (
      x: number,
      bw: number,
      label: string,
      color: string,
      onClick: () => void
    ): { bGfx: Phaser.GameObjects.Graphics; txt: Phaser.GameObjects.Text } => {
      const bGfx = this.add.graphics().setPosition(x, 6);
      const txt = this.add
        .text(x + bw / 2, h / 2, label, { fontSize: '12px', fontStyle: 'bold', color })
        .setOrigin(0.5);
      const hit = this.add
        .zone(x + bw / 2, h / 2, bw, 34)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        onClick();
      });
      this.actionBarContainer.add([bGfx, txt, hit]);
      return { bGfx, txt };
    };

    // Only Build, Tribes (Diplomacy), and Fog of War remain on the main bottom-right bar!
    // Knowledge is inside Shaman's Totem, Chronicle inside Burial Mound, and Defense on Main Campfire!
    this.buildBtnBg = makeAction(8, 122, '🏗️ Будувати', '#ffe066', () => {
      this.openOnlyModal(this.buildModalContainer.visible ? null : 'build');
    }).bGfx;

    const tr = makeAction(136, 118, '🤝 Племена', '#fde68a', () => {
      this.openOnlyModal(this.diplomacyModalContainer.visible ? null : 'diplomacy');
    });
    this.tribesBtnBg = tr.bGfx;
    this.tribesBtnText = tr.txt;

    const fg = makeAction(260, 96, '🌫️ Туман', '#cbd5e1', () => {
      this.events.emit('toggle-fog');
    });
    this.fogBtnBg = fg.bGfx;
    this.fogBtnText = fg.txt;

    this.refreshActionBar();
  }

  private refreshActionBar(): void {
    const drawPill = (
      gfx: Phaser.GameObjects.Graphics,
      w: number,
      fill: number,
      stroke: number
    ) => {
      gfx.clear();
      gfx.fillStyle(fill, 0.96);
      gfx.fillRoundedRect(0, 0, w, 34, 8);
      gfx.lineStyle(1.4, stroke, 0.95);
      gfx.strokeRoundedRect(0, 0, w, 34, 8);
    };

    drawPill(
      this.buildBtnBg,
      122,
      this.activeBuildType ? 0x166534 : 0x3b281a,
      this.activeBuildType ? 0x4ade80 : 0xc98a4b
    );

    const discoveredCount = this.latestRivals.filter((r) => r.discovered && r.alive).length;
    drawPill(
      this.tribesBtnBg,
      118,
      discoveredCount > 0 ? 0x1e3a5f : 0x3b281a,
      discoveredCount > 0 ? 0x38bdf8 : 0xc98a4b
    );
    this.tribesBtnText.setText(
      discoveredCount > 0 ? `🤝 Племена (${discoveredCount})` : '🤝 Племена'
    );

    const fogOn = this.latestConfig.fogOfWar;
    drawPill(this.fogBtnBg, 96, fogOn ? 0x14532d : 0x3b281a, fogOn ? 0x4ade80 : 0x94a3b8);
    this.fogBtnText.setText(fogOn ? '🌫️ Туман: Так' : '☀️ Туман: Ні');
  }

  // --- Campfire Contextual Defense Panel (opens when clicking Main Campfire) ---
  private createCampfirePanel(): void {
    this.campfirePanel = this.add.container(0, 0);
    const w = this.buildingPanelW;
    const h = 132;
    const bg = this.add.graphics();
    bg.fillStyle(0x261a11, 0.96);
    bg.fillRoundedRect(0, 0, w, h, 14);
    bg.lineStyle(2, 0xf97316, 0.95);
    bg.strokeRoundedRect(0, 0, w, h, 14);

    const title = this.add.text(14, 10, '🔥 Головне вогнище племені', {
      fontSize: '14.5px',
      fontStyle: 'bold',
      color: '#ffe066',
    });

    const closeBtn = this.add
      .text(w - 14, 10, '✕', { fontSize: '14px', fontStyle: 'bold', color: '#fca5a5' })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      this.campfirePanel.setVisible(false);
    });

    const desc = this.add.text(
      14,
      32,
      'Серце поселення. Тут скликається загальна оборона племені під час нападу хижаків або ворогів.',
      {
        fontSize: '10.5px',
        color: '#e6ccb2',
        wordWrap: { width: w - 28 },
      }
    );

    this.campfireStatusText = this.add.text(14, 68, '', {
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#fde68a',
    });

    this.campfireAlarmBtnText = this.add
      .text(w / 2, 104, '🚨 Скликати Оборону племені', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#fef08a',
        backgroundColor: '#991b1b',
        padding: { x: 16, y: 6 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.campfireAlarmBtnText.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('toggle-defense-alarm');
    });

    this.campfirePanel.add([
      bg,
      title,
      closeBtn,
      desc,
      this.campfireStatusText,
      this.campfireAlarmBtnText,
    ]);
    this.campfirePanel.setVisible(false);
  }

  private refreshCampfirePanel(): void {
    const active = this.alarmState.active;
    this.campfireStatusText.setText(
      active
        ? `🚨 Тривога активна! Загроз поруч: ${this.alarmState.threatCount}`
        : '🔥 У поселенні спокійно. Жителі працюють.'
    );
    this.campfireAlarmBtnText
      .setText(active ? '✅ Відбій тривоги (повернутись до праці)' : '🚨 Скликати Оборону племені')
      .setBackgroundColor(active ? '#166534' : '#991b1b');
  }

  private createBuildModal(): void {
    const w = 756;
    const h = 476;
    this.buildModalContainer = this.add.container(0, 0).setDepth(4800);

    const scrim = this.add.rectangle(0, 0, 3200, 3200, 0x0a0704, 0.68).setInteractive();
    scrim.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    const bg = this.add.graphics();
    bg.fillStyle(0x23170e, 0.97);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(2.4, 0xd99b52, 0.96);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

    const title = this.add.text(-w / 2 + 22, -h / 2 + 14, '🏗️ Вікно будівництва племені (13 споруд)', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffe066',
    });

    const closeBtn = this.add
      .text(w / 2 - 20, -h / 2 + 14, '✕ Закрити', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fca5a5',
        backgroundColor: '#3b1d14',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      this.buildModalContainer.setVisible(false);
    });

    this.buildModalContainer.add([scrim, bg, title, closeBtn]);

    const cardW = 232;
    const cardH = 74;
    const gapX = 10;
    const gapY = 8;
    const startX = -w / 2 + 20;
    const startY = -h / 2 + 52;

    BUILD_ORDER.forEach((type, idx) => {
      const def = BUILDING_DEFS[type];
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const card = this.add.container(cx, cy);
      const cBg = this.add.graphics();
      const iconKey = this.textures.exists(`icon-${type}`) ? `icon-${type}` : 'icon-hut';
      const icon = this.add.image(24, 37, iconKey).setScale(0.82);
      const titleText = this.add.text(48, 6, def.nameUk, {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffe066',
      });
      const descText = this.add.text(48, 23, def.descUk, {
        fontSize: '9.5px',
        color: '#e6ccb2',
        wordWrap: { width: cardW - 54 },
      });
      const costs: string[] = [`🪵${def.wood}`, `🪨${def.stone}`];
      if (def.bone) costs.push(`🦴${def.bone}`);
      if (def.hide) costs.push(`🧥${def.hide}`);
      const costText = this.add.text(48, 56, costs.join(' '), {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#a7f3d0',
      });

      const ref: ModalBuildCardRef = {
        type,
        bg: cBg,
        titleText,
        costText,
        hovered: false,
      };

      const hit = this.add
        .zone(cardW / 2, cardH / 2, cardW, cardH)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => {
        ref.hovered = true;
        this.refreshBuildModal();
      });
      hit.on('pointerout', () => {
        ref.hovered = false;
        this.refreshBuildModal();
      });
      hit.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.buildModalContainer.setVisible(false);
        this.events.emit('toggle-build', type);
      });

      card.add([cBg, icon, titleText, descText, costText, hit]);
      this.buildModalCards.push(ref);
      this.buildModalContainer.add(card);
    });

    this.buildModalContainer.setVisible(false);
  }

  private refreshBuildModal(): void {
    const cardW = 232;
    const cardH = 74;
    for (const ref of this.buildModalCards) {
      const def = BUILDING_DEFS[ref.type];
      const ok =
        this.latestResources.wood >= def.wood &&
        this.latestResources.stone >= def.stone &&
        this.latestResources.bone >= (def.bone ?? 0) &&
        this.latestResources.hide >= (def.hide ?? 0);
      ref.bg.clear();
      ref.bg.fillStyle(ref.hovered ? 0x3b281a : 0x18100a, 0.94);
      ref.bg.fillRoundedRect(0, 0, cardW, cardH, 10);
      ref.bg.lineStyle(1.6, ok ? (ref.hovered ? 0x4ade80 : 0xd99b52) : 0x7f1d1d, 0.92);
      ref.bg.strokeRoundedRect(0, 0, cardW, cardH, 10);
      ref.titleText.setColor(ok ? '#ffe066' : '#cbd5e1');
      ref.costText.setColor(ok ? '#86efac' : '#fca5a5');
    }
  }

  private createTechModal(): void {
    const w = 680;
    const h = 446;
    this.techModalContainer = this.add.container(0, 0).setDepth(4800);

    const scrim = this.add.rectangle(0, 0, 3200, 3200, 0x0a0704, 0.68).setInteractive();
    scrim.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    const bg = this.add.graphics();
    bg.fillStyle(0x162229, 0.97);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(2.4, 0x22d3ee, 0.92);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

    const title = this.add.text(
      -w / 2 + 22,
      -h / 2 + 16,
      '🔮 Знання та технології Шамана (3 рівні)',
      {
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#67e8f9',
      }
    );

    this.techModalKnowledgeText = this.add.text(
      -w / 2 + 22,
      -h / 2 + 40,
      'Доступно знань: ✨ 0',
      {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fde68a',
      }
    );

    const closeBtn = this.add
      .text(w / 2 - 20, -h / 2 + 16, '✕ Закрити', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fca5a5',
        backgroundColor: '#3b1d14',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      this.techModalContainer.setVisible(false);
    });

    this.techModalContainer.add([scrim, bg, title, this.techModalKnowledgeText, closeBtn]);

    const startY = -h / 2 + 72;
    const rowH = 84;
    const tierW = 166;
    const tierH = 74;

    TECH_BRANCHES.forEach((branch, bIdx) => {
      const def = TECH_TREE[branch];
      const ry = startY + bIdx * (rowH + 8);
      const bLabel = this.add.text(-w / 2 + 20, ry + 26, `${def.icon} ${def.titleUk}`, {
        fontSize: '13.5px',
        fontStyle: 'bold',
        color: '#fff8e7',
      });
      this.techModalContainer.add(bLabel);

      def.tiers.forEach((tier, tIdx) => {
        const tx = -w / 2 + 148 + tIdx * (tierW + 8);
        const card = this.add.container(tx, ry);
        const cBg = this.add.graphics();
        const tTitle = this.add.text(8, 7, `${tIdx + 1}. ${tier.nameUk}`, {
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: '#fef08a',
          wordWrap: { width: tierW - 14 },
        });
        const tDesc = this.add.text(8, 30, tier.descUk, {
          fontSize: '9.5px',
          color: '#e2e8f0',
          wordWrap: { width: tierW - 14 },
        });
        const tCost = this.add.text(8, 56, `✨ ${tier.cost}`, {
          fontSize: '10.5px',
          fontStyle: 'bold',
          color: '#67e8f9',
        });

        const ref: TechCardRef = {
          branch,
          tierIdx: tIdx,
          bg: cBg,
          titleText: tTitle,
          descText: tDesc,
          costText: tCost,
          hovered: false,
        };

        const hit = this.add
          .zone(tierW / 2, tierH / 2, tierW, tierH)
          .setInteractive({ useHandCursor: true });
        hit.on('pointerover', () => {
          ref.hovered = true;
          this.refreshTechModal();
        });
        hit.on('pointerout', () => {
          ref.hovered = false;
          this.refreshTechModal();
        });
        hit.on('pointerdown', () => {
          SoundFX.unlock();
          this.events.emit('ui-button-clicked');
          if (this.techState[branch] === tIdx) {
            this.events.emit('research-tech', branch);
          }
        });

        card.add([cBg, tTitle, tDesc, tCost, hit]);
        this.techCardRefs.push(ref);
        this.techModalContainer.add(card);
      });
    });

    this.techModalContainer.setVisible(false);
  }

  private refreshTechModal(): void {
    this.techModalKnowledgeText.setText(
      `Накопичені знання: ✨ ${this.latestResources.knowledge} (Шаман у Тотемі досліджує знання та навертає ворожих збирачів ПКМ)`
    );
    const tierW = 166;
    const tierH = 74;

    for (const ref of this.techCardRefs) {
      const curLevel = this.techState[ref.branch];
      const tier = TECH_TREE[ref.branch].tiers[ref.tierIdx];
      const unlocked = ref.tierIdx < curLevel;
      const nextUnlock = ref.tierIdx === curLevel;
      const affordable = this.latestResources.knowledge >= tier.cost;

      ref.bg.clear();
      if (unlocked) {
        ref.bg.fillStyle(0x14532d, 0.94);
        ref.bg.lineStyle(1.6, 0x4ade80, 0.95);
        ref.costText.setText('✅ Вивчено').setColor('#86efac');
      } else if (nextUnlock) {
        ref.bg.fillStyle(ref.hovered ? 0x164e63 : 0x0f2d38, 0.95);
        ref.bg.lineStyle(1.6, affordable ? 0x22d3ee : 0x64748b, 0.95);
        ref.costText
          .setText(`Вивчити: ✨ ${tier.cost}`)
          .setColor(affordable ? '#67e8f9' : '#fca5a5');
      } else {
        ref.bg.fillStyle(0x0f172a, 0.72);
        ref.bg.lineStyle(1.2, 0x334155, 0.75);
        ref.costText.setText(`🔒 Потрібен рів.${ref.tierIdx}`).setColor('#94a3b8');
      }
      ref.bg.fillRoundedRect(0, 0, tierW, tierH, 9);
      ref.bg.strokeRoundedRect(0, 0, tierW, tierH, 9);
    }
  }

  private createBuildingPanel(): void {
    this.buildingPanel = this.add.container(0, 0);
    const bg = this.add.graphics();
    bg.fillStyle(0x0f0a06, 0.5);
    bg.fillRoundedRect(0, 4, this.buildingPanelW, this.buildingPanelH, 14);
    bg.fillStyle(0x261a11, 0.95);
    bg.fillRoundedRect(0, 0, this.buildingPanelW, this.buildingPanelH, 14);
    bg.lineStyle(2, 0xc98a4b, 0.95);
    bg.strokeRoundedRect(0, 0, this.buildingPanelW, this.buildingPanelH, 14);

    this.buildingTitleText = this.add.text(14, 10, '', {
      fontSize: '14.5px',
      fontStyle: 'bold',
      color: '#ffe066',
    });

    // Demolish button (for palisades and any tribe building)
    this.demolishBtn = this.add
      .text(this.buildingPanelW - 38, 10, '🗑️ Зруйнувати', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#fca5a5',
        backgroundColor: '#451a1a',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    this.demolishBtn.on('pointerdown', () => {
      if (!this.latestBuilding) return;
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('demolish-building', this.latestBuilding.id);
    });

    const closeText = this.add
      .text(this.buildingPanelW - 12, 10, '✕', {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fca5a5',
      })
      .setOrigin(1, 0);
    const closeHit = this.add
      .zone(this.buildingPanelW - 18, 18, 24, 24)
      .setInteractive({ useHandCursor: true });
    closeHit.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      this.events.emit('close-building-panel');
    });

    this.buildingDescText = this.add.text(14, 30, '', {
      fontSize: '10px',
      color: '#e6ccb2',
      wordWrap: { width: this.buildingPanelW - 28 },
    });
    this.buildingStatusText = this.add.text(14, 58, '', {
      fontSize: '10.5px',
      fontStyle: 'bold',
      color: '#fde68a',
    });
    this.buildingWorkerText = this.add.text(14, 78, '', {
      fontSize: '10.5px',
      fontStyle: 'bold',
      color: '#bae6fd',
      wordWrap: { width: this.buildingPanelW - 28 },
    });

    // Standard station assign button (for currently selected unit)
    this.assignBtnGroup = this.add.container(0, 0);
    this.assignBtnBg = this.add.graphics();
    this.assignBtnText = this.add
      .text(102, 122, 'Призначити', { fontSize: '11px', fontStyle: 'bold', color: '#fef08a' })
      .setOrigin(0.5);
    const assignHit = this.add
      .zone(102, 122, 176, 24)
      .setInteractive({ useHandCursor: true });
    assignHit.on('pointerover', () => {
      this.isAssignHovered = true;
      this.drawAssignButtonBg();
    });
    assignHit.on('pointerout', () => {
      this.isAssignHovered = false;
      this.drawAssignButtonBg();
    });
    assignHit.on('pointerdown', () => {
      if (!this.latestBuilding) return;
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('assign-selected-to-building', this.latestBuilding.id);
    });
    this.assignBtnGroup.add([this.assignBtnBg, this.assignBtnText, assignHit]);
    this.drawAssignButtonBg();

    // Profile Roster Picker button (assign any adult from a list without searching the map!)
    this.rosterPickBtn = this.add
      .text(this.buildingPanelW - 14, 122, '👤 Список жителів', {
        fontSize: '11px',
        fontStyle: 'bold',
        color: '#86efac',
        backgroundColor: '#1e3a29',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.rosterPickBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.rosterPage = 0;
      this.openOnlyModal('roster');
    });

    // Barracks warrior controls (target warrior count ➖ / ➕ + 3 warrior classes)
    this.barracksGroup = this.add.container(0, 0);
    const minusBtn = this.add
      .text(204, 56, '➖', {
        fontSize: '11px',
        backgroundColor: '#3b1d14',
        padding: { x: 5, y: 2 },
      })
      .setInteractive({ useHandCursor: true });
    minusBtn.on('pointerdown', () => {
      if (!this.latestBuilding) return;
      this.events.emit('ui-button-clicked');
      this.events.emit('adjust-barracks-target', {
        buildingId: this.latestBuilding.id,
        delta: -1,
      });
    });

    this.barracksTargetText = this.add.text(232, 57, 'Ліміт: 5', {
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#fde68a',
    });

    const plusBtn = this.add
      .text(294, 56, '➕', {
        fontSize: '11px',
        backgroundColor: '#14532d',
        padding: { x: 5, y: 2 },
      })
      .setInteractive({ useHandCursor: true });
    plusBtn.on('pointerdown', () => {
      if (!this.latestBuilding) return;
      this.events.emit('ui-button-clicked');
      this.events.emit('adjust-barracks-target', {
        buildingId: this.latestBuilding.id,
        delta: 1,
      });
    });

    this.barracksGroup.add([minusBtn, this.barracksTargetText, plusBtn]);

    const classes: Array<{ cls: WarriorClass; icon: string; x: number }> = [
      { cls: 'spearman', icon: '🔱 Списник', x: 14 },
      { cls: 'archer', icon: '🏹 Лучник', x: 126 },
      { cls: 'clubman', icon: '🦴 Дубинник', x: 236 },
    ];
    for (const item of classes) {
      const btn = this.add
        .text(item.x, 142, item.icon, {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#fef08a',
          backgroundColor: '#7f1d1d',
          padding: { x: 8, y: 5 },
        })
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        if (!this.latestBuilding) return;
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.events.emit('train-warrior', {
          buildingId: this.latestBuilding.id,
          warriorClass: item.cls,
        });
      });
      this.barracksGroup.add(btn);
    }

    // Totem open-tech button (Knowledge lives inside the Shaman's Totem!)
    this.totemTechBtn = this.add
      .text(this.buildingPanelW / 2, 148, '🔮 Відкрити Знання та Технології Шамана', {
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: '#67e8f9',
        backgroundColor: '#164e63',
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.totemTechBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      this.openOnlyModal('tech');
    });

    // Burial Mound Chronicle button
    this.burialChronicleBtn = this.add
      .text(this.buildingPanelW / 2, 122, '⛩️ Відкрити Хроніку Предків', {
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: '#fde68a',
        backgroundColor: '#422b16',
        padding: { x: 12, y: 5 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.burialChronicleBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      this.openOnlyModal('chronicle');
    });

    this.buildingPanel.add([
      bg,
      this.buildingTitleText,
      this.demolishBtn,
      closeText,
      closeHit,
      this.buildingDescText,
      this.buildingStatusText,
      this.buildingWorkerText,
      this.assignBtnGroup,
      this.rosterPickBtn,
      this.barracksGroup,
      this.totemTechBtn,
      this.burialChronicleBtn,
    ]);
    this.buildingPanel.setVisible(false);
  }

  private drawAssignButtonBg(): void {
    this.assignBtnBg.clear();
    this.assignBtnBg.fillStyle(this.isAssignHovered ? 0x166534 : 0x14532d, 0.96);
    this.assignBtnBg.fillRoundedRect(14, 110, 176, 24, 7);
    this.assignBtnBg.lineStyle(1.4, 0x4ade80, this.isAssignHovered ? 1 : 0.85);
    this.assignBtnBg.strokeRoundedRect(14, 110, 176, 24, 7);
  }

  private refreshBuildingPanel(): void {
    if (!this.latestBuilding || !this.latestBuilding.isComplete) {
      this.buildingPanel.setVisible(false);
      return;
    }
    const b = this.latestBuilding;
    this.buildingTitleText.setText(b.nameUk);
    this.buildingDescText.setText(b.descUk);
    this.totemTechBtn.setVisible(b.type === 'totem');
    this.burialChronicleBtn.setVisible(b.type === 'burial_mound');
    this.demolishBtn.setVisible(Boolean(b.canDemolish));

    if (b.type === 'barracks') {
      this.buildingStatusText.setText(
        `Воїни племені: ${b.warriorSlotsUsed ?? 0} / ${b.warriorSlotsMax ?? 0}`
      );
      this.barracksTargetText.setText(`Ліміт: ${b.targetWarriors ?? 5}`);
      this.buildingWorkerText.setText(
        this.latestSnapshot && !this.latestSnapshot.isChild
          ? `Обрано: ${this.latestSnapshot.name} (оберіть клас воїна нижче)`
          : 'Оберіть жителя на карті або через «👤 Список жителів»'
      );
      this.assignBtnGroup.setVisible(false);
      this.rosterPickBtn.setVisible(true);
      this.barracksGroup.setVisible(true);
    } else if (b.type === 'nursery') {
      this.barracksGroup.setVisible(false);
      this.assignBtnGroup.setVisible(false);
      this.rosterPickBtn.setVisible(false);
      const kids = b.childrenInside ?? [];
      this.buildingStatusText.setText(`👶 Дітей у Яслах: ${kids.length}`);
      this.buildingWorkerText
        .setText(
          kids.length > 0
            ? `Під наглядом: ${kids.slice(0, 4).join(', ')}`
            : 'Діти автоматично приходять сюди до 14 років'
        )
        .setColor('#86efac');
    } else {
      this.barracksGroup.setVisible(false);
      if (b.type === 'totem' && (b.captivesCount ?? 0) > 0) {
        this.buildingStatusText.setText(
          `🌀 Навернених збирачів біля Тотема: ${b.captivesCount} (чекають зміну сезону)`
        );
      } else if (b.statusNote) {
        this.buildingStatusText.setText(b.statusNote);
      } else if (b.hp !== undefined && b.maxHp !== undefined && b.hp < b.maxHp) {
        this.buildingStatusText.setText(`Міцність: ${b.hp}/${b.maxHp} HP`);
      } else {
        this.buildingStatusText.setText(`Міцність: ${b.hp ?? 380}/${b.maxHp ?? 380} HP`);
      }

      if (b.assignedWorkers.length > 0) {
        const listStr = b.assignedWorkers
          .map((w) => `${w.name} (Рів.${w.level})`)
          .join(', ');
        this.buildingWorkerText
          .setText(`Працюють (${b.assignedWorkers.length}/${b.maxWorkers}): ${listStr}`)
          .setColor('#a7f3d0');
      } else if (b.profession) {
        this.buildingWorkerText
          .setText(`Вільно (0/${b.maxWorkers}) — призначте жителя`)
          .setColor('#fde68a');
      } else {
        this.buildingWorkerText.setText('').setColor('#d6c2a8');
      }

      if (b.profession) {
        this.rosterPickBtn.setVisible(true);
        if (this.latestSnapshot && !this.latestSnapshot.isChild && !this.latestSnapshot.isDying) {
          this.assignBtnText.setText(`Призначити: ${this.latestSnapshot.name}`);
        } else {
          this.assignBtnText.setText('Призначити виділеного');
        }
        this.assignBtnGroup.setVisible(true);
      } else {
        this.assignBtnGroup.setVisible(false);
        this.rosterPickBtn.setVisible(false);
      }
    }

    this.buildingPanel.setVisible(true);
  }

  // --- Villager Profile Roster Picker Modal (👤 Список жителів) ---
  private createRosterModal(): void {
    const w = 640;
    const h = 440;
    this.rosterModalContainer = this.add.container(0, 0).setDepth(4900);

    const scrim = this.add.rectangle(0, 0, 3200, 3200, 0x0a0704, 0.72).setInteractive();
    scrim.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    const bg = this.add.graphics();
    bg.fillStyle(0x23170e, 0.98);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(2.4, 0x4ade80, 0.95);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

    this.rosterTitleText = this.add.text(
      -w / 2 + 22,
      -h / 2 + 16,
      '👤 Оберіть жителя племені зі списку',
      {
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#ffe066',
      }
    );

    const closeBtn = this.add
      .text(w / 2 - 20, -h / 2 + 16, '✕ Закрити', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fca5a5',
        backgroundColor: '#3b1d14',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      this.rosterModalContainer.setVisible(false);
    });

    this.rosterListContainer = this.add.container(0, 0);

    const prevBtn = this.add
      .text(-110, h / 2 - 26, '◀ Попередня', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffe066',
        backgroundColor: '#3a271a',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    prevBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      if (this.rosterPage > 0) {
        this.rosterPage -= 1;
        this.refreshRosterModal();
      }
    });

    this.rosterPageText = this.add
      .text(0, h / 2 - 26, '1 / 1', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#e6ccb2',
      })
      .setOrigin(0.5);

    const nextBtn = this.add
      .text(110, h / 2 - 26, 'Наступна ▶', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffe066',
        backgroundColor: '#3a271a',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      const totalPages = Math.max(1, Math.ceil(this.latestRoster.length / 5));
      if (this.rosterPage + 1 < totalPages) {
        this.rosterPage += 1;
        this.refreshRosterModal();
      }
    });

    this.rosterModalContainer.add([
      scrim,
      bg,
      this.rosterTitleText,
      closeBtn,
      this.rosterListContainer,
      prevBtn,
      this.rosterPageText,
      nextBtn,
    ]);
    this.rosterModalContainer.setVisible(false);
  }

  private refreshRosterModal(): void {
    this.rosterListContainer.removeAll(true);
    const b = this.latestBuilding;
    const prof: ProfessionId | null = b?.profession ?? null;
    this.rosterTitleText.setText(
      b ? `👤 Призначення в «${b.nameUk}» — оберіть жителя:` : '👤 Жителі племені'
    );

    const perPage = 5;
    const totalPages = Math.max(1, Math.ceil(this.latestRoster.length / perPage));
    this.rosterPage = Phaser.Math.Clamp(this.rosterPage, 0, totalPages - 1);
    this.rosterPageText.setText(`${this.rosterPage + 1} / ${totalPages}`);

    const slice = this.latestRoster.slice(
      this.rosterPage * perPage,
      (this.rosterPage + 1) * perPage
    );

    const rowW = 596;
    const rowH = 60;
    const startY = -158;

    slice.forEach((v, idx) => {
      const ry = startY + idx * (rowH + 6);
      const row = this.add.container(-rowW / 2, ry);

      const rBg = this.add.graphics();
      rBg.fillStyle(0x160f09, 0.94);
      rBg.fillRoundedRect(0, 0, rowW, rowH, 10);
      rBg.lineStyle(1.4, 0xc98a4b, 0.85);
      rBg.strokeRoundedRect(0, 0, rowW, rowH, 10);

      const pKey =
        v.lifeStage === 'ELDER' ? `portrait-${v.appearance}-elder` : `portrait-${v.appearance}`;
      const portrait = this.add.image(32, 30, pKey).setScale(0.36);

      const skillLvl = prof ? v.skills[prof] ?? 1 : v.topProfessionLevel;
      const skillText = prof
        ? `Навичка (${b?.professionLabel}): Рів.${skillLvl}`
        : `Найкраща: ${v.topProfessionLabel} Рів.${v.topProfessionLevel}`;

      const nameTxt = this.add.text(
        64,
        8,
        `${v.isChief ? '💀 ' : ''}${v.name} (${v.age} р.) • ${skillText}`,
        {
          fontSize: '12.5px',
          fontStyle: 'bold',
          color: '#fde68a',
        }
      );

      const statusTxt = this.add.text(
        64,
        30,
        `Стан: ${v.stateLabel}${v.assignedBuildingName ? ` • Призначений: ${v.assignedBuildingName}` : ''}`,
        {
          fontSize: '11px',
          color: '#cbd5e1',
        }
      );

      const actionLabel =
        b && b.type === 'barracks'
          ? '⚔️ Обрати для казарми'
          : b && b.profession
          ? '✅ Призначити сюди'
          : '👁️ Виділити';

      const assignBtn = this.add
        .text(rowW - 14, 30, actionLabel, {
          fontSize: '11.5px',
          fontStyle: 'bold',
          color: '#fef08a',
          backgroundColor: '#166534',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true });

      assignBtn.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        if (b && b.type === 'barracks') {
          this.events.emit('select-villager-by-id', v.id);
          this.rosterModalContainer.setVisible(false);
        } else if (b && b.profession) {
          this.events.emit('assign-villager-by-id', {
            buildingId: b.id,
            villagerId: v.id,
          });
          this.rosterModalContainer.setVisible(false);
        } else {
          this.events.emit('select-villager-by-id', v.id);
          this.rosterModalContainer.setVisible(false);
        }
      });

      row.add([rBg, portrait, nameTxt, statusTxt, assignBtn]);
      this.rosterListContainer.add(row);
    });
  }

  // --- Diplomacy & Trade Modal (🤝 Племена) ---
  private createDiplomacyModal(): void {
    const w = 700;
    const h = 450;
    this.diplomacyModalContainer = this.add.container(0, 0).setDepth(4850);

    const scrim = this.add.rectangle(0, 0, 3200, 3200, 0x0a0704, 0.7).setInteractive();
    scrim.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    const bg = this.add.graphics();
    bg.fillStyle(0x23170e, 0.97);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(2.4, 0x38bdf8, 0.95);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

    const title = this.add.text(
      -w / 2 + 22,
      -h / 2 + 16,
      '🤝 Дипломатія, Відносини та Торгівля з Племенами',
      {
        fontSize: '17px',
        fontStyle: 'bold',
        color: '#fde68a',
      }
    );

    const closeBtn = this.add
      .text(w / 2 - 20, -h / 2 + 16, '✕ Закрити', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fca5a5',
        backgroundColor: '#3b1d14',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      this.diplomacyModalContainer.setVisible(false);
    });

    this.diplomacyBodyContainer = this.add.container(0, 0);

    this.diplomacyModalContainer.add([scrim, bg, title, closeBtn, this.diplomacyBodyContainer]);
    this.diplomacyModalContainer.setVisible(false);
  }

  private refreshDiplomacyModal(): void {
    this.diplomacyBodyContainer.removeAll(true);
    const discovered = this.latestRivals.filter((r) => r.discovered && r.alive);

    if (discovered.length === 0) {
      const empty = this.add
        .text(
          0,
          0,
          'Ви ще не зустріли інших племен.\nРозвідуйте карту збирачами або воїнами — щойно ви зустрінете\nінше плем’я, тут відкриються переговори, ненапад на 4 сезони, союз і торгівля!',
          {
            fontSize: '14px',
            color: '#e6ccb2',
            align: 'center',
          }
        )
        .setOrigin(0.5);
      this.diplomacyBodyContainer.add(empty);
      return;
    }

    const cardW = 654;
    const cardH = 112;
    const startY = -156;

    discovered.forEach((tr, idx) => {
      const cy = startY + idx * (cardH + 10);
      const card = this.add.container(-cardW / 2, cy);

      const cBg = this.add.graphics();
      cBg.fillStyle(0x160f09, 0.94);
      cBg.fillRoundedRect(0, 0, cardW, cardH, 12);
      cBg.lineStyle(1.8, Phaser.Display.Color.HexStringToColor(tr.colorHex).color, 0.92);
      cBg.strokeRoundedRect(0, 0, cardW, cardH, 12);

      const header = this.add.text(
        14,
        10,
        `🏴 Плем’я «${tr.nameUk}» • 👥 Населення: ${tr.population}/${tr.popCap} • ⚔️ Воїнів: ${tr.warriorsCount} • 🏠 Споруд: ${tr.buildingsCount}`,
        {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#fde68a',
        }
      );

      const status = this.add.text(
        14,
        32,
        `Ставлення до нас: ${tr.attitudeUk}   |   Міжплемінні події: ${tr.interTribeStatusUk}`,
        {
          fontSize: '11.5px',
          color: '#bae6fd',
        }
      );

      const resLine = this.add.text(
        14,
        52,
        `Запаси племені: 🪵${tr.resources.wood}  🪨${tr.resources.stone}  🍖${tr.resources.food}  🦴${tr.resources.bone}  🧥${tr.resources.hide}`,
        {
          fontSize: '11px',
          color: '#d6c2a8',
        }
      );

      card.add([cBg, header, status, resLine]);

      // Diplomacy buttons: Non-aggression (4 seasons) & Alliance
      if (tr.treaty !== 'non_aggression' && tr.treaty !== 'alliance') {
        const pactBtn = this.add
          .text(14, 76, '🕊️ Пакт про ненапад (4 сезони)', {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#fef08a',
            backgroundColor: '#1e3a5f',
            padding: { x: 8, y: 5 },
          })
          .setInteractive({ useHandCursor: true });
        pactBtn.on('pointerdown', () => {
          SoundFX.unlock();
          this.events.emit('ui-button-clicked');
          this.events.emit('propose-non-aggression', tr.id);
        });
        card.add(pactBtn);
      }

      if (tr.treaty !== 'alliance') {
        const allyBtn = this.add
          .text(238, 76, '🤝 Укласти Союз (відкрити торгівлю)', {
            fontSize: '11px',
            fontStyle: 'bold',
            color: '#86efac',
            backgroundColor: '#14532d',
            padding: { x: 8, y: 5 },
          })
          .setInteractive({ useHandCursor: true });
        allyBtn.on('pointerdown', () => {
          SoundFX.unlock();
          this.events.emit('ui-button-clicked');
          this.events.emit('propose-alliance', tr.id);
        });
        card.add(allyBtn);
      } else {
        // Trade buttons when allied!
        const trades: Array<{
          label: string;
          giveType: 'wood' | 'stone' | 'food';
          receiveType: 'wood' | 'stone' | 'food' | 'bone' | 'hide';
          x: number;
        }> = [
          { label: '⚖️ 15🪵 → 12🍖', giveType: 'wood', receiveType: 'food', x: 14 },
          { label: '⚖️ 15🪨 → 12🪵', giveType: 'stone', receiveType: 'wood', x: 148 },
          { label: '⚖️ 15🍖 → 12🪨', giveType: 'food', receiveType: 'stone', x: 282 },
          { label: '⚖️ 15🪵 → 10🦴', giveType: 'wood', receiveType: 'bone', x: 416 },
          { label: '⚖️ 15🪨 → 10🧥', giveType: 'stone', receiveType: 'hide', x: 538 },
        ];
        trades.forEach((t) => {
          const tBtn = this.add
            .text(t.x, 76, t.label, {
              fontSize: '10.5px',
              fontStyle: 'bold',
              color: '#fef08a',
              backgroundColor: '#422b16',
              padding: { x: 7, y: 5 },
            })
            .setInteractive({ useHandCursor: true });
          tBtn.on('pointerdown', () => {
            SoundFX.unlock();
            this.events.emit('ui-button-clicked');
            this.events.emit('trade-with-tribe', {
              tribeId: tr.id,
              giveType: t.giveType,
              giveAmount: 15,
              receiveType: t.receiveType,
              receiveAmount: t.receiveType === 'bone' || t.receiveType === 'hide' ? 10 : 12,
            });
          });
          card.add(tBtn);
        });
      }

      this.diplomacyBodyContainer.add(card);
    });
  }

  // --- Main Menu & Settings Screen (Full-Screen Clean Start & Settings) ---
  private createMainMenuModal(): void {
    const w = 960;
    const h = 580;
    this.mainMenuContainer = this.add.container(0, 0).setDepth(4950);

    const scrim = this.add.rectangle(0, 0, 3200, 3200, 0x0d0906, 1).setInteractive();
    scrim.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    const bg = this.add.graphics();
    bg.fillStyle(0x1d130b, 0.99);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 22);
    bg.lineStyle(3, 0xd99b52, 0.96);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 22);

    // Header bar
    const headerBg = this.add.graphics();
    headerBg.fillStyle(0x2c1c11, 0.98);
    headerBg.fillRoundedRect(-w / 2 + 16, -h / 2 + 14, w - 32, 64, 14);
    headerBg.lineStyle(1.5, 0x8c6442, 0.8);
    headerBg.strokeRoundedRect(-w / 2 + 16, -h / 2 + 14, w - 32, 64, 14);

    const title = this.add.text(
      -w / 2 + 34,
      -h / 2 + 23,
      '🔥 ПЕРВІСНІ ПЛЕМЕНА — Prehistoric Tribes',
      {
        fontSize: '21px',
        fontStyle: 'bold',
        color: '#ffe066',
      }
    );
    const subtitle = this.add.text(
      -w / 2 + 34,
      -h / 2 + 50,
      'Оберіть карту, режим виживання та параметри світу перед початком',
      {
        fontSize: '12.5px',
        color: '#d6c2a8',
      }
    );

    this.menuContinueBtn = this.add
      .text(w / 2 - 32, -h / 2 + 46, '↩️ Повернутись у гру', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fef08a',
        backgroundColor: '#3b281a',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.menuContinueBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.isInitialBootMenu = false;
      this.openOnlyModal(null);
    });

    this.mainMenuContainer.add([scrim, bg, headerBg, title, subtitle, this.menuContinueBtn]);

    // --- LEFT COLUMN: 10 Maps Grid + Selected Map Preview Card ---
    const leftX = -460;
    const colW = 456;
    const colBgL = this.add.graphics();
    colBgL.fillStyle(0x150e08, 0.92);
    colBgL.fillRoundedRect(leftX, -198, colW, 404, 14);
    colBgL.lineStyle(1.5, 0x5c3e26, 0.85);
    colBgL.strokeRoundedRect(leftX, -198, colW, 404, 14);
    this.mainMenuContainer.add(colBgL);

    const mapTitle = this.add.text(leftX + 16, -184, '🗺️ Оберіть карту світу (10 карт)', {
      fontSize: '14.5px',
      fontStyle: 'bold',
      color: '#fde68a',
    });
    this.mainMenuContainer.add(mapTitle);

    MAP_PRESET_ORDER.forEach((mapId: MapPresetId, idx: number) => {
      const preset = MAP_PRESETS[mapId];
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const bx = leftX + 16 + col * 214;
      const by = -154 + row * 40;

      const card = this.add
        .text(bx, by, preset.nameUk, {
          fontSize: '12px',
          color: '#e2e8f0',
          backgroundColor: '#261a11',
          padding: { x: 10, y: 8 },
          fixedWidth: 206,
        })
        .setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.menuDraftConfig.mapId = mapId;
        this.refreshMainMenuModal();
      });
      this.menuMapButtons.set(mapId, card);
      this.mainMenuContainer.add(card);
    });

    // Selected Map Preview Card
    const prevBg = this.add.graphics();
    prevBg.fillStyle(0x23170e, 0.96);
    prevBg.fillRoundedRect(leftX + 16, 56, 424, 136, 12);
    prevBg.lineStyle(1.6, 0x38bdf8, 0.88);
    prevBg.strokeRoundedRect(leftX + 16, 56, 424, 136, 12);
    this.mainMenuContainer.add(prevBg);

    this.menuPrevTitle = this.add.text(leftX + 30, 68, '', {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#67e8f9',
    });
    this.menuPrevDesc = this.add.text(leftX + 30, 92, '', {
      fontSize: '12px',
      color: '#f5ebe0',
      wordWrap: { width: 396 },
    });
    this.menuPrevStats = this.add.text(leftX + 30, 158, '', {
      fontSize: '11px',
      fontStyle: 'bold',
      color: '#a7f3d0',
    });
    this.mainMenuContainer.add([this.menuPrevTitle, this.menuPrevDesc, this.menuPrevStats]);

    // --- RIGHT COLUMN: Mode, Difficulty, Rivals, Fog, Music, Sounds ---
    const rightX = 14;
    const colRW = 446;
    const colBgR = this.add.graphics();
    colBgR.fillStyle(0x150e08, 0.92);
    colBgR.fillRoundedRect(rightX, -198, colRW, 404, 14);
    colBgR.lineStyle(1.5, 0x5c3e26, 0.85);
    colBgR.strokeRoundedRect(rightX, -198, colRW, 404, 14);
    this.mainMenuContainer.add(colBgR);

    // 1. Game Mode
    const modeLbl = this.add.text(rightX + 16, -184, '🎮 Режим гри:', {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#fde68a',
    });
    this.mainMenuContainer.add(modeLbl);

    const shortModeLabels: Record<GameMode, string> = {
      sandbox: '🏖️ Пісочниця\n(пропуск сезону 1 кліком)',
      survival: '🔥 Виживання\n(чесні 10-хв сезони)',
    };
    (['sandbox', 'survival'] as GameMode[]).forEach((m, idx) => {
      const btn = this.add
        .text(rightX + 16 + idx * 210, -156, shortModeLabels[m], {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#cbd5e1',
          backgroundColor: '#261a11',
          padding: { x: 10, y: 8 },
          fixedWidth: 202,
          align: 'center',
        })
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.menuDraftConfig.mode = m;
        this.refreshMainMenuModal();
      });
      this.menuModeButtons.set(m, btn);
      this.mainMenuContainer.add(btn);
    });

    // 2. Difficulty
    const diffLbl = this.add.text(rightX + 16, -86, '⚔️ Складність:', {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#fde68a',
    });
    this.mainMenuContainer.add(diffLbl);

    let nextDiffX = rightX + 16;
    (['easy', 'normal', 'hard', 'primal'] as DifficultyLevel[]).forEach((d) => {
      const btn = this.add
        .text(nextDiffX, -60, DIFFICULTY_LABELS_UK[d], {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#cbd5e1',
          backgroundColor: '#261a11',
          padding: { x: 12, y: 7 },
        })
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.menuDraftConfig.difficulty = d;
        this.refreshMainMenuModal();
      });
      nextDiffX += btn.width + 10;
      this.menuDiffButtons.set(d, btn);
      this.mainMenuContainer.add(btn);
    });

    // 3. Rival Tribes & Fog of War
    const rivLbl = this.add.text(rightX + 16, -12, '🏴 Сусідні племена:', {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#fde68a',
    });
    this.mainMenuContainer.add(rivLbl);

    ([0, 1, 2, 3] as const).forEach((cnt, idx) => {
      const btn = this.add
        .text(rightX + 16 + idx * 48, 14, `${cnt}`, {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#cbd5e1',
          backgroundColor: '#261a11',
          padding: { x: 13, y: 7 },
        })
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.menuDraftConfig.rivalCount = cnt;
        this.refreshMainMenuModal();
      });
      this.menuRivalButtons.set(cnt, btn);
      this.mainMenuContainer.add(btn);
    });

    const fogLbl = this.add.text(rightX + 230, -12, '🌫️ Туман війни:', {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#fde68a',
    });
    this.menuFogBtn = this.add
      .text(rightX + 230, 14, '☀️ Вимкнено', {
        fontSize: '12.5px',
        fontStyle: 'bold',
        color: '#cbd5e1',
        backgroundColor: '#261a11',
        padding: { x: 18, y: 7 },
      })
      .setInteractive({ useHandCursor: true });
    this.menuFogBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.menuDraftConfig.fogOfWar = !this.menuDraftConfig.fogOfWar;
      if (!this.isInitialBootMenu) {
        this.events.emit('toggle-fog');
      }
      this.refreshMainMenuModal();
    });
    this.mainMenuContainer.add([fogLbl, this.menuFogBtn]);

    // 4. Music Track Selector (0..3)
    const musLbl = this.add.text(rightX + 16, 62, '🎵 Фонова музика:', {
      fontSize: '14px',
      fontStyle: 'bold',
      color: '#fde68a',
    });
    this.mainMenuContainer.add(musLbl);

    const shortMusicLabels: Record<MusicTrackId, string> = {
      0: '🔇 Вимк.',
      1: '1. Вогонь',
      2: '2. Вітер',
      3: '3. Бубни',
    };
    let nextMusX = rightX + 16;
    ([0, 1, 2, 3] as MusicTrackId[]).forEach((tr) => {
      const btn = this.add
        .text(nextMusX, 88, shortMusicLabels[tr] ?? MUSIC_TRACK_LABELS_UK[tr], {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#cbd5e1',
          backgroundColor: '#261a11',
          padding: { x: 12, y: 7 },
        })
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.menuDraftConfig.musicTrack = tr;
        this.events.emit('set-music-track', tr);
        this.refreshMainMenuModal();
      });
      nextMusX += btn.width + 10;
      this.menuMusicButtons.set(tr, btn);
      this.mainMenuContainer.add(btn);
    });

    // 5. Ambient Nature/Animal Sounds
    this.menuAmbBtn = this.add
      .text(rightX + 16, 140, '🦌 Звуки природи та тварин: Увімкнено', {
        fontSize: '12.5px',
        fontStyle: 'bold',
        color: '#86efac',
        backgroundColor: '#261a11',
        padding: { x: 12, y: 9 },
        fixedWidth: 414,
        align: 'center',
      })
      .setInteractive({ useHandCursor: true });
    this.menuAmbBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.menuDraftConfig.ambientSounds = !this.menuDraftConfig.ambientSounds;
      this.events.emit('set-ambient-sounds', this.menuDraftConfig.ambientSounds);
      this.refreshMainMenuModal();
    });
    this.mainMenuContainer.add(this.menuAmbBtn);

    // --- BOTTOM FOOTER: Start & Saves Manager Buttons ---
    this.menuStartBtn = this.add
      .text(-155, 246, '▶️ ПОЧАТИ НОВУ ГРУ', {
        fontSize: '15px',
        fontStyle: 'bold',
        color: '#fef08a',
        backgroundColor: '#166534',
        padding: { x: 28, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.menuStartBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      const cfg = this.menuDraftConfig;
      const sameBootConfig =
        this.isInitialBootMenu &&
        cfg.mapId === this.latestConfig.mapId &&
        cfg.rivalCount === this.latestConfig.rivalCount &&
        cfg.difficulty === this.latestConfig.difficulty &&
        cfg.mode === this.latestConfig.mode &&
        cfg.fogOfWar === this.latestConfig.fogOfWar;

      this.isInitialBootMenu = false;
      this.openOnlyModal(null);
      if (!sameBootConfig) {
        this.events.emit('start-new-game', { ...this.menuDraftConfig });
      }
    });

    this.menuSavesBtn = this.add
      .text(175, 246, '📂 ЗБЕРЕЖЕННЯ (0/5)', {
        fontSize: '14.5px',
        fontStyle: 'bold',
        color: '#67e8f9',
        backgroundColor: '#1e3a5f',
        padding: { x: 24, y: 12 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.menuSavesBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.openSavesModal();
    });

    this.mainMenuContainer.add([this.menuStartBtn, this.menuSavesBtn]);

    this.mainMenuContainer.setVisible(false);
  }

  private refreshMainMenuModal(): void {
    this.menuContinueBtn.setVisible(!this.isInitialBootMenu);
    const cfg = this.menuDraftConfig;

    for (const [mapId, card] of this.menuMapButtons.entries()) {
      const preset = MAP_PRESETS[mapId];
      const active = cfg.mapId === mapId;
      card
        .setText(`${active ? '✅ ' : ''}${preset.nameUk}`)
        .setFontStyle(active ? 'bold' : 'normal')
        .setColor(active ? '#fef08a' : '#e2e8f0')
        .setBackgroundColor(active ? '#1e3a5f' : '#261a11');
    }

    const selPreset = MAP_PRESETS[cfg.mapId];
    this.menuPrevTitle.setText(`📍 ${selPreset.nameUk}`);
    this.menuPrevDesc.setText(selPreset.descUk);
    this.menuPrevStats.setText(
      `📐 ${selPreset.worldW}×${selPreset.worldH}  •  🪨 Вічних скель: ${selPreset.infiniteQuarries}  •  🌳 Дерев: ~${selPreset.treeCount}`
    );

    for (const [m, btn] of this.menuModeButtons.entries()) {
      const active = cfg.mode === m;
      btn
        .setColor(active ? '#fef08a' : '#cbd5e1')
        .setBackgroundColor(active ? '#166534' : '#261a11');
    }

    for (const [d, btn] of this.menuDiffButtons.entries()) {
      const active = cfg.difficulty === d;
      btn
        .setColor(active ? '#fef08a' : '#cbd5e1')
        .setBackgroundColor(active ? '#7c2d12' : '#261a11');
    }

    for (const [cnt, btn] of this.menuRivalButtons.entries()) {
      const active = cfg.rivalCount === cnt;
      btn
        .setColor(active ? '#fef08a' : '#cbd5e1')
        .setBackgroundColor(active ? '#166534' : '#261a11');
    }

    this.menuFogBtn
      .setText(cfg.fogOfWar ? '🌫️ Увімкнено' : '☀️ Вимкнено')
      .setColor(cfg.fogOfWar ? '#86efac' : '#cbd5e1')
      .setBackgroundColor(cfg.fogOfWar ? '#14532d' : '#261a11');

    for (const [tr, btn] of this.menuMusicButtons.entries()) {
      const active = cfg.musicTrack === tr;
      btn
        .setColor(active ? '#67e8f9' : '#cbd5e1')
        .setBackgroundColor(active ? '#164e63' : '#261a11');
    }

    this.menuAmbBtn
      .setText(
        cfg.ambientSounds
          ? '🦌 Звуки природи та тварин: Увімкнено'
          : '🔇 Звуки природи та тварин: Вимкнено'
      )
      .setColor(cfg.ambientSounds ? '#86efac' : '#fca5a5');

    this.menuStartBtn.setText(
      this.isInitialBootMenu ? '▶️ ПОЧАТИ НОВУ ГРУ' : '🔄 НОВА ГРА З ЦИМИ НАЛАШТУВАННЯМИ'
    );
    const usedSlots = this.latestSavesList.filter(Boolean).length;
    this.menuSavesBtn.setText(
      this.isInitialBootMenu
        ? `📂 ЗАВАНТАЖИТИ ЗБЕРЕЖЕННЯ (${usedSlots}/${MAX_SAVE_SLOTS})`
        : `💾 ЗБЕРЕГТИ / ЗАВАНТАЖИТИ (${usedSlots}/${MAX_SAVE_SLOTS})`
    );
  }

  private openSavesModal(): void {
    this.savesModalContainer.setVisible(true);
    this.refreshSavesModal();
  }

  private createSavesModal(): void {
    const w = 740;
    const h = 470;
    this.savesModalContainer = this.add.container(0, 0).setDepth(4990);

    const scrim = this.add.rectangle(0, 0, 3200, 3200, 0x080503, 0.86).setInteractive();
    scrim.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    const bg = this.add.graphics();
    bg.fillStyle(0x21150d, 0.99);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 20);
    bg.lineStyle(2.6, 0x38bdf8, 0.95);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 20);

    const title = this.add.text(
      -w / 2 + 24,
      -h / 2 + 16,
      '💾 Керування збереженнями (5 слотів)',
      {
        fontSize: '18px',
        fontStyle: 'bold',
        color: '#ffe066',
      }
    );

    const closeBtn = this.add
      .text(w / 2 - 22, -h / 2 + 16, '✕ Закрити', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fca5a5',
        backgroundColor: '#3b1d14',
        padding: { x: 10, y: 5 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.savesModalContainer.setVisible(false);
    });

    this.savesModalContainer.add([scrim, bg, title, closeBtn]);

    const rowW = w - 44;
    const rowH = 68;
    const startY = -h / 2 + 60;

    for (let slot = 1; slot <= MAX_SAVE_SLOTS; slot++) {
      const ry = startY + (slot - 1) * (rowH + 10);
      const row = this.add.container(-rowW / 2, ry);

      const rBg = this.add.graphics();
      rBg.fillStyle(0x150e08, 0.95);
      rBg.fillRoundedRect(0, 0, rowW, rowH, 12);
      rBg.lineStyle(1.4, 0x6b4c30, 0.85);
      rBg.strokeRoundedRect(0, 0, rowW, rowH, 12);

      const titleText = this.add.text(16, 11, `Слот #${slot}`, {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fde68a',
      });
      const infoText = this.add.text(16, 36, 'Порожній слот', {
        fontSize: '12px',
        color: '#94a3b8',
      });

      const saveBtn = this.add
        .text(rowW - 260, rowH / 2, '💾 Зберегти', {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#67e8f9',
          backgroundColor: '#1e3a5f',
          padding: { x: 10, y: 7 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      saveBtn.on('pointerdown', () => {
        if (this.isInitialBootMenu) return;
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.events.emit('save-game', slot);
      });

      const loadBtn = this.add
        .text(rowW - 142, rowH / 2, '📂 Завантажити', {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#fef08a',
          backgroundColor: '#166534',
          padding: { x: 10, y: 7 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      loadBtn.on('pointerdown', () => {
        const summary = this.latestSavesList[slot - 1];
        if (!summary) return;
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.isInitialBootMenu = false;
        this.savesModalContainer.setVisible(false);
        this.openOnlyModal(null);
        this.events.emit('load-game', slot);
      });

      const deleteBtn = this.add
        .text(rowW - 44, rowH / 2, '🗑️', {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#fca5a5',
          backgroundColor: '#451a1a',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      deleteBtn.on('pointerdown', () => {
        const summary = this.latestSavesList[slot - 1];
        if (!summary) return;
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.events.emit('delete-save', slot);
      });

      row.add([rBg, titleText, infoText, saveBtn, loadBtn, deleteBtn]);
      this.saveSlotRows.push({
        slotId: slot,
        titleText,
        infoText,
        saveBtn,
        loadBtn,
        deleteBtn,
      });
      this.savesModalContainer.add(row);
    }

    this.savesModalContainer.setVisible(false);
  }

  private refreshSavesModal(): void {
    const canSaveCurrent = !this.isInitialBootMenu;
    for (const row of this.saveSlotRows) {
      const s = this.latestSavesList[row.slotId - 1] ?? null;
      if (s) {
        row.titleText
          .setText(`💾 Слот #${row.slotId} — ${s.mapNameUk}`)
          .setColor('#fde68a');
        row.infoText
          .setText(
            `Рік ${s.year} • ${SEASON_ICONS[s.season]} ${s.seasonUk} • 👥 Населення: ${s.pop} • 🕒 ${s.dateStrUk}`
          )
          .setColor('#e2e8f0');
        row.saveBtn.setText('💾 Перезапис').setVisible(canSaveCurrent);
        row.loadBtn.setVisible(true);
        row.deleteBtn.setVisible(true);
      } else {
        row.titleText
          .setText(`📁 Слот #${row.slotId} — Порожній слот`)
          .setColor('#94a3b8');
        row.infoText
          .setText(
            canSaveCurrent
              ? 'Натисніть «💾 Зберегти», щоб записати поточну гру в цей слот'
              : 'Збережень у цьому слоті немає'
          )
          .setColor('#64748b');
        row.saveBtn.setText('💾 Зберегти').setVisible(canSaveCurrent);
        row.loadBtn.setVisible(false);
        row.deleteBtn.setVisible(false);
      }
    }
  }

  private createChronicleModal(): void {
    const w = 560;
    const h = 396;
    this.chronicleContainer = this.add.container(0, 0).setDepth(4800);

    const scrim = this.add.rectangle(0, 0, 3200, 3200, 0x0a0704, 0.68).setInteractive();
    scrim.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    const bg = this.add.graphics();
    bg.fillStyle(0x23170e, 0.97);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(2.4, 0xd99b52, 0.96);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

    const title = this.add.text(-w / 2 + 22, -h / 2 + 16, '⛩️ Хроніка Предків племені', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffe066',
    });

    const closeBtn = this.add
      .text(w / 2 - 20, -h / 2 + 16, '✕ Закрити', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fca5a5',
        backgroundColor: '#3b1d14',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      this.chronicleContainer.setVisible(false);
    });

    this.chronicleEmptyText = this.add
      .text(
        0,
        0,
        'У Кургані Предків ще тихо…\nПамʼять про кожного спочилого жителя зʼявиться тут.',
        {
          fontSize: '14px',
          color: '#e6ccb2',
          align: 'center',
        }
      )
      .setOrigin(0.5);

    this.chronicleContainer.add([scrim, bg, title, closeBtn, this.chronicleEmptyText]);

    for (let i = 0; i < 3; i++) {
      const rowY = -h / 2 + 62 + i * 94;
      const row = this.add.container(-w / 2 + 20, rowY);
      const rBg = this.add.graphics();
      rBg.fillStyle(0x160f09, 0.9);
      rBg.fillRoundedRect(0, 0, w - 40, 84, 11);
      rBg.lineStyle(1, 0x7c5b3e, 0.7);
      rBg.strokeRoundedRect(0, 0, w - 40, 84, 11);

      const portrait = this.add.image(40, 42, 'portrait-male-1-elder').setScale(0.42);
      const header = this.add.text(78, 10, '', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fde68a',
      });
      const bio = this.add.text(78, 30, '', {
        fontSize: '11.5px',
        color: '#f5ebe0',
        wordWrap: { width: w - 134 },
      });

      row.add([rBg, portrait, header, bio]);
      this.chronicleRows.push({ container: row, portrait, header, bio });
      this.chronicleContainer.add(row);
    }

    const prevBtn = this.add
      .text(-110, h / 2 - 28, '◀ Попередня', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffe066',
        backgroundColor: '#3a271a',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    prevBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      if (this.chroniclePage > 0) {
        this.chroniclePage -= 1;
        this.refreshChronicleModal();
      }
    });

    this.chroniclePageText = this.add
      .text(0, h / 2 - 28, '1 / 1', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#e6ccb2',
      })
      .setOrigin(0.5);

    const nextBtn = this.add
      .text(110, h / 2 - 28, 'Наступна ▶', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#ffe066',
        backgroundColor: '#3a271a',
        padding: { x: 10, y: 4 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    nextBtn.on('pointerdown', () => {
      this.events.emit('ui-button-clicked');
      const totalPages = Math.max(1, Math.ceil(this.ancestors.length / 3));
      if (this.chroniclePage + 1 < totalPages) {
        this.chroniclePage += 1;
        this.refreshChronicleModal();
      }
    });

    this.chronicleContainer.add([prevBtn, this.chroniclePageText, nextBtn]);
    this.chronicleContainer.setVisible(false);
  }

  private refreshChronicleModal(): void {
    const total = this.ancestors.length;
    const totalPages = Math.max(1, Math.ceil(total / 3));
    this.chroniclePage = Phaser.Math.Clamp(this.chroniclePage, 0, totalPages - 1);
    this.chroniclePageText.setText(`${this.chroniclePage + 1} / ${totalPages}`);
    this.chronicleEmptyText.setVisible(total === 0);

    const start = this.chroniclePage * 3;
    this.chronicleRows.forEach((row, idx) => {
      const a = this.ancestors[start + idx];
      if (!a) {
        row.container.setVisible(false);
        return;
      }
      row.container.setVisible(true);
      row.portrait.setTexture(`portrait-${a.appearance}-elder`);
      row.header.setText(
        `${a.wasChief ? '💀 ' : ''}${a.name} • Рід «${a.familyName}» • ${formatAgeUk(a.ageAtDeath)}`
      );
      row.bio.setText(a.biographyUk);
    });
  }

  private createHint(): void {
    const isTouch = this.sys.game.device.input.touch;
    const msg = isTouch
      ? 'Тап — вибрати • Вогнище — Оборона • Тотем — Знання'
      : 'ЛКМ/Рамка — вибрати • ПКМ — наказ • Вогнище — Оборона • Тотем — Знання • WASD — камера';

    this.hintText = this.add.text(0, 0, msg, {
      fontSize: '10.5px',
      color: '#fff8e7',
      backgroundColor: '#261a11cc',
      padding: { x: 8, y: 3 },
    });
  }

  private layoutUI(width: number, height: number): void {
    const topMaxW = width >= 900 ? width - 210 : width - 16;
    const barScale = Math.min(1, topMaxW / this.baseBarWidth);
    const barCenterOffset =
      width >= 900
        ? Math.round((width - 186 - this.baseBarWidth * barScale) / 2)
        : Math.round((width - this.baseBarWidth * barScale) / 2);
    this.topBarContainer.setScale(barScale).setPosition(Math.max(8, barCenterOffset), 8);

    const topBarH = this.isStorageExpanded ? 68 : 38;
    const calScale = Math.min(1, topMaxW / this.calendarBarWidth);
    const calY = Math.round(8 + topBarH * barScale + 6);
    const calX =
      width >= 900
        ? Math.round((width - 186 - this.calendarBarWidth * calScale) / 2)
        : Math.round((width - this.calendarBarWidth * calScale) / 2);
    this.calendarContainer.setScale(calScale).setPosition(Math.max(8, calX), calY);

    const miniScale = width >= 900 ? 1 : 0.72;
    this.minimapContainer
      .setScale(miniScale)
      .setPosition(width - Math.round(this.minimapW * miniScale) - 10, 8);

    const cardScale = Math.min(1, (width - 16) / this.cardWidth);
    this.unitPanel
      .setScale(cardScale)
      .setPosition(14, height - Math.round(this.cardHeight * cardScale) - 14);
    this.groupPanel
      .setScale(cardScale)
      .setPosition(14, height - Math.round(114 * cardScale) - 14);

    const actionScale = Math.min(1, (width - 16) / this.actionBarWidth);
    this.actionBarContainer.setScale(actionScale);

    const dockScale = Math.min(1, (width - 16) / 362);
    this.quickDockContainer.setScale(dockScale);

    const centerModals: Array<{
      c: Phaser.GameObjects.Container;
      mw: number;
      mh: number;
    }> = [
      { c: this.buildModalContainer, mw: 756, mh: 478 },
      { c: this.techModalContainer, mw: 680, mh: 448 },
      { c: this.chronicleContainer, mw: 560, mh: 400 },
      { c: this.diplomacyModalContainer, mw: 700, mh: 452 },
      { c: this.mainMenuContainer, mw: 960, mh: 580 },
      { c: this.savesModalContainer, mw: 740, mh: 472 },
      { c: this.rosterModalContainer, mw: 640, mh: 442 },
    ];
    for (const m of centerModals) {
      m.c
        .setPosition(Math.round(width / 2), Math.round(height / 2))
        .setScale(Math.min(1, (width - 20) / m.mw, (height - 20) / m.mh));
    }

    if (width >= 1180) {
      this.actionBarContainer.setPosition(
        width - Math.round(this.actionBarWidth * actionScale) - 14,
        height - Math.round(46 * actionScale) - 26
      );
      this.quickDockContainer.setPosition(
        Math.round(this.cardWidth + 28),
        height - Math.round(42 * dockScale) - 26
      );
      this.buildingPanel.setPosition(
        width - this.buildingPanelW - 14,
        height - Math.round(46 * actionScale) - this.buildingPanelH - 36
      );
      this.campfirePanel.setPosition(
        width - this.buildingPanelW - 14,
        height - Math.round(46 * actionScale) - 142 - 36
      );
      this.hintText.setOrigin(1, 1).setPosition(width - 14, height - 4).setVisible(true);
    } else if (width >= 820) {
      this.actionBarContainer.setPosition(
        width - Math.round(this.actionBarWidth * actionScale) - 12,
        height - Math.round(46 * actionScale) - 24
      );
      this.quickDockContainer.setPosition(
        width - Math.round(362 * dockScale) - 12,
        height - Math.round(46 * actionScale) - Math.round(42 * dockScale) - 32
      );
      this.buildingPanel.setPosition(
        width - this.buildingPanelW - 12,
        height - 150 - this.buildingPanelH
      );
      this.campfirePanel.setPosition(width - this.buildingPanelW - 12, height - 150 - 142);
      this.hintText.setOrigin(1, 1).setPosition(width - 12, height - 4).setVisible(true);
    } else {
      this.actionBarContainer.setPosition(
        Math.round((width - this.actionBarWidth * actionScale) / 2),
        calY + Math.round(38 * calScale) + 8
      );
      this.quickDockContainer.setPosition(
        Math.round((width - 362 * dockScale) / 2),
        calY + Math.round(38 * calScale) + Math.round(46 * actionScale) + 14
      );
      this.buildingPanel.setPosition(
        Math.round((width - this.buildingPanelW * 0.85) / 2),
        height - Math.round(this.cardHeight * cardScale) - this.buildingPanelH - 20
      );
      this.campfirePanel.setPosition(
        Math.round((width - this.buildingPanelW * 0.85) / 2),
        height - Math.round(this.cardHeight * cardScale) - 152
      );
      this.hintText.setVisible(false);
    }
  }

  private refreshResourceTexts(): void {
    const cap = this.latestResources.storageCap || MAX_STORAGE;
    this.woodText
      .setText(`${this.latestResources.wood}/${cap}`)
      .setColor(this.latestResources.wood >= cap ? '#fbbf24' : '#fff8e7');
    this.stoneText
      .setText(`${this.latestResources.stone}/${cap}`)
      .setColor(this.latestResources.stone >= cap ? '#fbbf24' : '#fff8e7');
    this.foodText
      .setText(`${this.latestResources.food}/${cap}`)
      .setColor(this.latestResources.food >= cap ? '#fbbf24' : '#fff8e7');
    this.boneText
      .setText(`${this.latestResources.bone}/${cap}`)
      .setColor(this.latestResources.bone >= cap ? '#fbbf24' : '#fef9c3');
    this.hideText
      .setText(`${this.latestResources.hide}/${cap}`)
      .setColor(this.latestResources.hide >= cap ? '#fbbf24' : '#fed7aa');

    this.popText.setText(
      `👥 ${this.population.count}/${this.population.cap} ⚔️${this.population.warriors}/${this.population.warriorCap}`
    );
    this.toolsText.setText(`Інстр: ${this.latestResources.tools}`);
    this.spearText.setText(`🔱 Списи: ${this.latestResources.weapons.spear}`);
    this.bowText.setText(`🏹 Луки: ${this.latestResources.weapons.bow}`);
    this.clubText.setText(`🦴 Палиці: ${this.latestResources.weapons.club}`);
    this.hideArmorText.setText(`🧥 Шк.бр: ${this.latestResources.armors.hide_armor}`);
    this.boneArmorText.setText(`🛡️ Кіст.бр: ${this.latestResources.armors.bone_armor}`);
    this.knowledgeText.setText(`✨ ${this.latestResources.knowledge}`);
  }

  private refreshChiefHeader(): void {
    if (this.chiefStatus.chiefName) {
      this.chiefText.setText(this.chiefStatus.chiefName).setColor('#fde047');
    } else {
      this.chiefText.setText('Без вождя').setColor('#cbd5e1');
    }
  }

  private refreshSelectionPanels(): void {
    const s = this.latestSummary;
    this.quickAllText.setText(`👥 Всі (${s.totalTribe})`);
    this.quickIdleText.setText(`💤 Вільні (${s.totalIdle})`);
    this.quickWarriorText.setText(`⚔️ Воїни (${s.totalWarriors})`);

    if (s.count >= 2) {
      this.unitPanel.setVisible(false);
      this.groupTitleText.setText(`Виділено групу: ${s.count} жителів`);
      this.groupStatsText.setText(
        `💤 Вільні: ${s.idleCount}   •   ⚒️ Працюють: ${s.workingCount}   •   ⚔️ Воїни: ${s.warriorCount}`
      );
      this.groupPanel.setVisible(true);
      return;
    }

    this.groupPanel.setVisible(false);
    if (!this.latestSnapshot) {
      this.unitPanel.setVisible(false);
      return;
    }

    const snap = this.latestSnapshot;
    const portraitKey =
      snap.lifeStage === 'CHILD'
        ? `portrait-${snap.appearance}-child`
        : snap.lifeStage === 'ELDER'
        ? `portrait-${snap.appearance}-elder`
        : `portrait-${snap.appearance}`;
    this.unitPortrait.setTexture(portraitKey);

    this.unitNameText.setText(
      `${snap.isChief ? '💀 ' : ''}${snap.name} • ${formatAgeUk(snap.age)}`
    );

    if (snap.isChief) {
      this.unitGenderBadge.setText('Вождь').setColor('#fef08a').setBackgroundColor('#78350f');
    } else if (snap.warriorClass) {
      this.unitGenderBadge
        .setText(WARRIOR_CLASS_LABELS_UK[snap.warriorClass])
        .setColor('#fecaca')
        .setBackgroundColor('#7f1d1d');
    } else if (snap.lifeStage === 'ELDER') {
      this.unitGenderBadge.setText('Старий').setColor('#bae6fd').setBackgroundColor('#1e3a5f');
    } else if (snap.lifeStage === 'CHILD') {
      this.unitGenderBadge
        .setText(LIFE_STAGE_LABELS_UK.CHILD)
        .setColor('#86efac')
        .setBackgroundColor('#14532d');
    } else {
      this.unitGenderBadge
        .setText(LIFE_STAGE_LABELS_UK.ADULT)
        .setColor('#f2e8cf')
        .setBackgroundColor('#3e2b1c');
    }

    this.unitStateText.setText(snap.actionLabel);

    const statusTags: string[] = [];
    if (snap.carryAmount > 0 && snap.state === 'RETURNING') {
      statusTags.push(`${snap.carryAmount}/${snap.carryCapacity}`);
    }
    if (snap.equippedArmor === 'bone_armor') statusTags.push('🛡️Кість');
    else if (snap.equippedArmor === 'hide_armor') statusTags.push('🧥Шкура');
    if (snap.hasWisdomBuff) statusTags.push('✨+20%');
    this.unitCarryText.setText(statusTags.join(' '));

    this.unitFamilyText.setText(`🏠 ${snap.familyName}`);
    if (snap.isChild) {
      this.unitToolStatusText.setText('🌱 Дитина').setColor('#86efac');
    } else if (snap.equippedWeapon) {
      const wLbl =
        snap.equippedWeapon === 'bow'
          ? '🏹 Лук'
          : snap.equippedWeapon === 'club'
          ? '🦴 Палиця'
          : '🔱 Спис';
      this.unitToolStatusText.setText(wLbl).setColor('#fca5a5');
    } else if (snap.hasCraftedTools) {
      this.unitToolStatusText.setText('🛠️ Інстр. (x2)').setColor('#38bdf8');
    } else {
      this.unitToolStatusText.setText('🪨 Камінь (0.5x)').setColor('#fca5a5');
    }

    const hpRatio = Phaser.Math.Clamp(snap.stats.health / Math.max(1, snap.maxHealth), 0, 1);
    const barRatios = [hpRatio, snap.stats.satiety / 100, snap.stats.energy / 100];
    this.barGraphics.clear();

    barRatios.forEach((ratio, idx) => {
      const y = 72 + idx * 18;
      const barX = 162;
      const barW = 148;
      const barH = 8.5;

      let fillColor = 0x00b4d8;
      if (idx === 0) fillColor = ratio < 0.25 ? 0xef233c : ratio < 0.5 ? 0xf59e0b : 0x38b000;
      else if (idx === 1) fillColor = ratio < 0.25 ? 0xef233c : ratio < 0.5 ? 0xf59e0b : 0xff9f1c;

      this.barGraphics.fillStyle(0x130d09, 0.95);
      this.barGraphics.fillRoundedRect(barX, y, barW, barH, 4.5);
      this.barGraphics.lineStyle(1, 0x4d3724, 0.8);
      this.barGraphics.strokeRoundedRect(barX, y, barW, barH, 4.5);

      const fillW = Math.max(4, barW * Phaser.Math.Clamp(ratio, 0, 1));
      this.barGraphics.fillStyle(fillColor, 1);
      this.barGraphics.fillRoundedRect(barX, y, fillW, barH, 4.5);
    });

    this.barValuesText[0].setText(`${Math.round(snap.stats.health)}/${snap.maxHealth}`);
    this.barValuesText[1].setText(`${Math.round(snap.stats.satiety)}%`);
    this.barValuesText[2].setText(`${Math.round(snap.stats.energy)}%`);

    if (snap.activeProfessionLabel) {
      const rank = SKILL_LEVEL_TITLES_UK[snap.activeProfessionLevel] ?? '';
      const pct = Math.round(snap.activeProfessionXpRatio * 100);
      const spot = snap.assignedBuildingName ? ` • ${snap.assignedBuildingName}` : ` (${rank})`;
      this.unitSkillText
        .setText(
          `⭐ ${snap.activeProfessionLabel} Рів.${snap.activeProfessionLevel} • ${pct}%${spot}`
        )
        .setColor('#fde68a')
        .setVisible(true);
    } else if (!snap.isChild) {
      this.unitSkillText
        .setText('⭐ Навички зростають у праці й бою')
        .setColor('#cbd5e1')
        .setVisible(true);
    } else {
      this.unitSkillText.setVisible(false);
    }

    if (snap.canElectChief) {
      this.electChiefGroup.setVisible(true);
      this.unitPerksText.setVisible(false);
    } else {
      this.electChiefGroup.setVisible(false);
      if (snap.isChief) {
        this.unitPerksText
          .setText('💀 +20% шв. • +40% праця • аура вождя')
          .setColor('#fde047')
          .setVisible(true);
      } else if (snap.lifeStage === 'ELDER') {
        this.unitPerksText
          .setText('🕯️ Аура мудрості: +20% праці поруч')
          .setColor('#bae6fd')
          .setVisible(true);
      } else if (snap.isChild) {
        this.unitPerksText
          .setText('🌱 Дорослішання у 14 років')
          .setColor('#86efac')
          .setVisible(true);
      } else {
        this.unitPerksText.setVisible(false);
      }
    }

    this.unitPanel.setVisible(true);
  }
}
