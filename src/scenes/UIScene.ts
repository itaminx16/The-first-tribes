import Phaser from 'phaser';
import {
  AncestorRecord,
  BASE_POP_CAP,
  BUILDING_DEFS,
  BuildingSnapshot,
  BuildingType,
  BuildingUnlockInfo,
  CalendarState,
  ChiefStatus,
  DEFAULT_GAME_SETUP,
  formatAgeUk,
  GameSetupConfig,
  LIFE_STAGE_LABELS_UK,
  MAX_STORAGE,
  MinimapData,
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
import { SaveSummary } from '../systems/SaveSystem';
import { MainMenuOverlay } from '../ui/MainMenuOverlay';
import { GAME_DPR } from '../utils/display';
import { pwaManager } from '../utils/pwa';
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
  'bridge',
  'chief_hut',
  'training_ground',
  'animal_pen',
  'burial_mound',
];

const TECH_BRANCHES: TechBranchId[] = ['weapons', 'armor', 'craft', 'healing'];

interface RosterRowRef {
  container: Phaser.GameObjects.Container;
  rBg: Phaser.GameObjects.Graphics;
  portrait: Phaser.GameObjects.Image;
  nameTxt: Phaser.GameObjects.Text;
  statusTxt: Phaser.GameObjects.Text;
  assignBtn: Phaser.GameObjects.Text;
  villagerId: string;
}

interface DiplomacyCardRef {
  container: Phaser.GameObjects.Container;
  cBg: Phaser.GameObjects.Graphics;
  header: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  resLine: Phaser.GameObjects.Text;
  pactBtn: Phaser.GameObjects.Text;
  allyBtn: Phaser.GameObjects.Text;
  tradeBtns: Phaser.GameObjects.Text[];
  tribeId: string;
}

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
  private unitTraitText!: Phaser.GameObjects.Text;
  private unitMoodText!: Phaser.GameObjects.Text;
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
  private unassignBtn!: Phaser.GameObjects.Text;
  private demolishBtn!: Phaser.GameObjects.Text;
  private upgradeBtn!: Phaser.GameObjects.Text;
  private chiefAlarmBtn!: Phaser.GameObjects.Text;
  private barracksGroup!: Phaser.GameObjects.Container;
  private barracksTargetText!: Phaser.GameObjects.Text;
  private totemTechBtn!: Phaser.GameObjects.Text;
  private burialChronicleBtn!: Phaser.GameObjects.Text;

  // Centered Modals
  private buildModalContainer!: Phaser.GameObjects.Container;
  private buildModalCards: ModalBuildCardRef[] = [];
  private buildUnlocks: Partial<Record<BuildingType, BuildingUnlockInfo>> = {};
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

  // Diplomacy & Trade Modal (persistent reusable cards so 220ms refreshes never destroy active buttons!)
  private diplomacyModalContainer!: Phaser.GameObjects.Container;
  private diplomacyBodyContainer!: Phaser.GameObjects.Container;
  private diplomacyEmptyText!: Phaser.GameObjects.Text;
  private diplomacyCards: DiplomacyCardRef[] = [];

  // Brand-New HTML Main Menu / New Game / Saves / Settings Overlay
  private menuOverlay!: MainMenuOverlay;
  private isMenuOpenState = false;
  private isInitialBootMenu = false;

  // Android Camera Controls & Build Placement Confirm Bar
  private cameraControlsContainer!: Phaser.GameObjects.Container;
  private marqueeToggleBtn!: Phaser.GameObjects.Text;
  private isMarqueeMode = false;
  private buildConfirmContainer!: Phaser.GameObjects.Container;
  private buildConfirmBg!: Phaser.GameObjects.Graphics;
  private buildConfirmTitle!: Phaser.GameObjects.Text;
  private buildConfirmBtn!: Phaser.GameObjects.Text;
  private isBuildPreviewValid = true;

  // Villager Profile Roster Picker Modal (persistent reusable rows so 220ms refreshes never eat clicks!)
  private rosterModalContainer!: Phaser.GameObjects.Container;
  private rosterListContainer!: Phaser.GameObjects.Container;
  private rosterEmptyText!: Phaser.GameObjects.Text;
  private rosterRows: RosterRowRef[] = [];
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

  private readonly baseBarWidth = 924;
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
    this.createCameraControls();
    this.createBuildConfirmBar();
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
    this.createRosterModal();
    this.createHint();

    this.menuOverlay = new MainMenuOverlay({
      onContinueGame: () => {
        this.isInitialBootMenu = false;
        this.openOnlyModal(null);
      },
      onStartNewGame: (cfg) => {
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
          this.events.emit('start-new-game', { ...cfg });
        }
      },
      onSaveSlot: (slotId) => {
        this.events.emit('save-game', slotId);
      },
      onLoadSlot: (slotId) => {
        this.isInitialBootMenu = false;
        this.openOnlyModal(null);
        this.events.emit('load-game', slotId);
      },
      onDeleteSlot: (slotId) => {
        this.events.emit('delete-save', slotId);
      },
      onSetMusicTrack: (track) => {
        this.events.emit('set-music-track', track);
      },
      onSetAmbientSounds: (enabled) => {
        this.events.emit('set-ambient-sounds', enabled);
      },
      onToggleFog: () => {
        this.events.emit('toggle-fog');
      },
      onToggleMute: () => {
        const muted = SoundFX.toggleMute();
        this.muteBtnText.setText(muted ? '🔇' : '🔊');
        return muted;
      },
      onClose: () => {
        this.isInitialBootMenu = false;
        this.openOnlyModal(null);
      },
    });
    this.events.once('shutdown', () => {
      this.menuOverlay.destroy();
    });

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
      if (this.latestBuilding?.type === 'granary') this.refreshBuildingPanel();
    });
    gameScene.events.on(
      'build-unlocks-updated',
      (unlocks: Partial<Record<BuildingType, BuildingUnlockInfo>>) => {
        this.buildUnlocks = unlocks;
        if (this.buildModalContainer.visible) this.refreshBuildModal();
      }
    );
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
      this.syncQuickDockVisibility();
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
      this.refreshBuildConfirmBar();
    });
    gameScene.events.on('build-preview-status', (st: { valid: boolean; canAfford: boolean }) => {
      this.isBuildPreviewValid = st.valid;
      this.refreshBuildConfirmBar();
    });
    gameScene.events.on('marquee-mode-updated', (active: boolean) => {
      this.isMarqueeMode = active;
      this.refreshCameraControls();
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
      this.refreshActionBar();
      this.menuOverlay.syncConfig(cfg);
    });
    gameScene.events.on('show-main-menu-on-boot', () => {
      this.isInitialBootMenu = true;
      this.openOnlyModal('menu');
    });
    gameScene.events.on('saves-list-updated', (list: Array<SaveSummary | null>) => {
      this.menuOverlay.syncSaves(list);
    });

    this.events.emit('ui-ready');
  }

  private openOnlyModal(which: ModalId): void {
    this.buildModalContainer.setVisible(which === 'build');
    this.techModalContainer.setVisible(which === 'tech');
    this.chronicleContainer.setVisible(which === 'chronicle');
    this.diplomacyModalContainer.setVisible(which === 'diplomacy');
    this.rosterModalContainer.setVisible(which === 'roster');

    const isMenu = which === 'menu';
    this.isMenuOpenState = isMenu;
    this.setHudVisible(!isMenu);
    if (this.scene.get('GameScene')) {
      this.scene.setVisible(!isMenu, 'GameScene');
    }
    this.events.emit('set-menu-open', isMenu);

    if (isMenu) {
      this.menuOverlay.open('home', {
        isInitialBoot: this.isInitialBootMenu,
        returnToGameOnBack: false,
      });
    } else if (this.menuOverlay.isMenuOpen()) {
      this.menuOverlay.close();
    }

    if (which === 'build') this.refreshBuildModal();
    if (which === 'tech') this.refreshTechModal();
    if (which === 'chronicle') this.refreshChronicleModal();
    if (which === 'diplomacy') this.refreshDiplomacyModal();
    if (which === 'roster') this.refreshRosterModal();
  }

  private setHudVisible(visible: boolean): void {
    this.topBarContainer.setVisible(visible);
    this.calendarContainer.setVisible(visible);
    this.minimapContainer.setVisible(visible);
    this.cameraControlsContainer.setVisible(visible);
    this.actionBarContainer.setVisible(visible);
    this.buildConfirmContainer.setVisible(visible && this.activeBuildType !== null);
    this.hintText.setVisible(
      visible && this.scale.width / GAME_DPR >= 1024 && !this.sys.game.device.input.touch
    );
    if (!visible) {
      this.quickDockContainer.setVisible(false);
      this.unitPanel.setVisible(false);
      this.groupPanel.setVisible(false);
      this.buildingPanel.setVisible(false);
      this.campfirePanel.setVisible(false);
    } else {
      this.muteBtnText.setText(SoundFX.isMuted() ? '🔇' : '🔊');
      this.refreshSelectionPanels();
      this.refreshBuildingPanel();
      this.refreshBuildConfirmBar();
      this.syncQuickDockVisibility();
    }
  }

  private createTopBar(): void {
    this.topBarContainer = this.add.container(0, 8);
    this.topBarBg = this.add.graphics();
    this.topBarContainer.add(this.topBarBg);

    // Row 1: All 5 core resources (Дерево, Камінь, Їжа, Кістки, Шкури), Населення, Вождь, ⚔️ Арсенал ▾, 💾, ⚙️ Меню, 🔊
    const iconWood = this.add.image(18, 19, 'icon-wood').setScale(0.64);
    this.woodText = this.add.text(31, 12, `0/${MAX_STORAGE}`, {
      fontSize: '12.5px',
      fontStyle: 'bold',
      color: '#fff8e7',
    });

    const iconStone = this.add.image(102, 19, 'icon-stone').setScale(0.64);
    this.stoneText = this.add.text(115, 12, `0/${MAX_STORAGE}`, {
      fontSize: '12.5px',
      fontStyle: 'bold',
      color: '#fff8e7',
    });

    const iconFood = this.add.image(186, 19, 'icon-food').setScale(0.64);
    this.foodText = this.add.text(199, 12, `0/${MAX_STORAGE}`, {
      fontSize: '12.5px',
      fontStyle: 'bold',
      color: '#fff8e7',
    });

    const iconBone = this.add.image(270, 19, 'icon-bone').setScale(0.64);
    this.boneText = this.add.text(283, 12, `0/${MAX_STORAGE}`, {
      fontSize: '12.5px',
      fontStyle: 'bold',
      color: '#fef9c3',
    });

    const iconHide = this.add.image(354, 19, 'icon-hide').setScale(0.64);
    this.hideText = this.add.text(367, 12, `0/${MAX_STORAGE}`, {
      fontSize: '12.5px',
      fontStyle: 'bold',
      color: '#fed7aa',
    });

    this.popText = this.add.text(440, 11, `👥 3/${BASE_POP_CAP}`, {
      fontSize: '12.5px',
      fontStyle: 'bold',
      color: '#ffe066',
    });

    const chiefIcon = this.add.image(562, 19, 'icon-chief-skull').setScale(0.64);
    this.chiefText = this.add.text(577, 12, 'Без вождя', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#cbd5e1',
    });

    // Collapsible Arsenal Drawer toggle button (Tools, Weapons, Armor, Knowledge)
    this.storageBtnText = this.add
      .text(712, 19, '⚔️ Запаси ▾', {
        fontSize: '11.5px',
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
      this.storageBtnText.setText(this.isStorageExpanded ? '⚔️ Запаси ▴' : '⚔️ Запаси ▾');
      this.drawTopBarBg(this.baseBarWidth);
      this.layoutUI(this.scale.width, this.scale.height);
    });

    // Quick Save / Saves Manager button
    const quickSaveBtn = this.add
      .text(784, 19, '💾', {
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
      .text(840, 19, '⚙️ Меню', {
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
      this.openOnlyModal('menu');
    });

    const muteX = 898;
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

    // Row 2 Collapsible Drawer: Tools, Spears, Bows, Clubs, Hide Armor, Bone Armor, Knowledge
    this.topBarDrawer = this.add.container(0, 0);
    const iconTools = this.add.image(22, 50, 'icon-tools').setScale(0.6);
    this.toolsText = this.add.text(35, 43, 'Інстр: 0', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#38bdf8',
    });

    this.spearText = this.add.text(132, 43, '🔱 Списи: 0', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#e2e8f0',
    });
    this.bowText = this.add.text(246, 43, '🏹 Луки: 0', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#fde68a',
    });
    this.clubText = this.add.text(356, 43, '🦴 Палиці: 0', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#fca5a5',
    });
    this.hideArmorText = this.add.text(482, 43, '🧥 Шк.бр: 0', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#fdba74',
    });
    this.boneArmorText = this.add.text(612, 43, '🛡️ Кіст.бр: 0', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#f8fafc',
    });

    const iconKnow = this.add.image(772, 50, 'icon-knowledge').setScale(0.6);
    this.knowledgeText = this.add.text(786, 43, '✨ 0', {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#67e8f9',
    });

    this.topBarDrawer.add([
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
      iconBone,
      this.boneText,
      iconHide,
      this.hideText,
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

    // Real River(s), Fords & Bridges on Minimap
    if (m.riverPoints && m.riverPoints.length > 0) {
      for (const rp of m.riverPoints) {
        const rPx = Math.max(1.8, rp.radius * sx);
        g.fillStyle(rp.isFord ? 0x94a3b8 : 0x0ea5e9, 0.92);
        g.fillCircle(rp.x * sx, rp.y * sy, rPx);
      }
    }
    if (m.bridges && m.bridges.length > 0) {
      for (const br of m.bridges) {
        g.fillStyle(0xd97706, 1);
        g.fillRect(br.x * sx - 3, br.y * sy - 2, 6, 4);
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

    // Fog of War overlay on Minimap
    if (m.fogEnabled && m.fogGrid) {
      const cw = mapW / m.fogGrid.cols;
      const ch = mapH / m.fogGrid.rows;
      for (let r = 0; r < m.fogGrid.rows; r++) {
        for (let c = 0; c < m.fogGrid.cols; c++) {
          const st = m.fogGrid.cells[r * m.fogGrid.cols + c];
          if (st === 0) {
            g.fillStyle(0x080b09, 1);
            g.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
          } else if (st === 1) {
            g.fillStyle(0x0a0e0b, 0.52);
            g.fillRect(c * cw, r * ch, cw + 0.5, ch + 0.5);
          }
        }
      }
    }

    // Camera viewport rect
    g.lineStyle(1.3, 0xffffff, 0.88);
    g.strokeRect(m.camX * sx, m.camY * sy, m.camW * sx, m.camH * sy);
  }

  private createCameraControls(): void {
    const w = 44;
    const h = 208;
    this.cameraControlsContainer = this.add.container(0, 0).setDepth(4100);

    const bg = this.add.graphics();
    bg.fillStyle(0x1f140c, 0.92);
    bg.fillRoundedRect(0, 0, w, h, 12);
    bg.lineStyle(1.6, 0xc98a4b, 0.88);
    bg.strokeRoundedRect(0, 0, w, h, 12);

    const blocker = this.add.zone(w / 2, h / 2, w, h).setInteractive();
    blocker.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    this.cameraControlsContainer.add([bg, blocker]);

    const mkCtrl = (y: number, label: string, onClick: () => void): Phaser.GameObjects.Text => {
      const btn = this.add
        .text(w / 2, y, label, {
          fontSize: '15px',
          fontStyle: 'bold',
          color: '#fde68a',
          backgroundColor: '#382618',
          padding: { x: 8, y: 6 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        onClick();
      });
      this.cameraControlsContainer.add(btn);
      return btn;
    };

    mkCtrl(24, '➕', () => this.events.emit('camera-zoom', 0.2));
    mkCtrl(64, '➖', () => this.events.emit('camera-zoom', -0.2));
    mkCtrl(104, '🔥', () => this.events.emit('camera-home'));
    this.marqueeToggleBtn = mkCtrl(144, '🔲', () => this.events.emit('toggle-marquee-mode'));
    mkCtrl(184, '⛶', () => {
      void pwaManager.toggleFullscreenLandscape();
    });

    this.refreshCameraControls();
  }

  private refreshCameraControls(): void {
    if (!this.marqueeToggleBtn) return;
    this.marqueeToggleBtn
      .setBackgroundColor(this.isMarqueeMode ? '#166534' : '#382618')
      .setColor(this.isMarqueeMode ? '#86efac' : '#fde68a');
  }

  private createBuildConfirmBar(): void {
    const w = 420;
    const h = 48;
    this.buildConfirmContainer = this.add.container(0, 0).setDepth(4200);

    this.buildConfirmBg = this.add.graphics();
    const blocker = this.add.zone(0, 0, w, h).setInteractive();
    blocker.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    this.buildConfirmTitle = this.add
      .text(-196, 0, '🏗️ Будівництво', {
        fontSize: '12.5px',
        fontStyle: 'bold',
        color: '#ffe066',
      })
      .setOrigin(0, 0.5);

    this.buildConfirmBtn = this.add
      .text(38, 0, '✅ Збудувати', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#fef08a',
        backgroundColor: '#166534',
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.buildConfirmBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('confirm-build-placement');
    });

    const cancelBtn = this.add
      .text(148, 0, '❌ Скасувати', {
        fontSize: '12px',
        fontStyle: 'bold',
        color: '#fecaca',
        backgroundColor: '#7f1d1d',
        padding: { x: 10, y: 7 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    cancelBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('cancel-build-mode');
    });

    this.buildConfirmContainer.add([
      this.buildConfirmBg,
      blocker,
      this.buildConfirmTitle,
      this.buildConfirmBtn,
      cancelBtn,
    ]);
    this.buildConfirmContainer.setVisible(false);
  }

  private refreshBuildConfirmBar(): void {
    const w = 420;
    const h = 48;
    if (!this.activeBuildType || this.isMenuOpenState) {
      this.buildConfirmContainer.setVisible(false);
      return;
    }

    const def = BUILDING_DEFS[this.activeBuildType];
    this.buildConfirmTitle.setText(`🏗️ ${def.nameUk}`);
    this.buildConfirmBg.clear();
    this.buildConfirmBg.fillStyle(0x21150c, 0.96);
    this.buildConfirmBg.fillRoundedRect(-w / 2, -h / 2, w, h, 12);
    this.buildConfirmBg.lineStyle(2, this.isBuildPreviewValid ? 0x4ade80 : 0xf87171, 0.95);
    this.buildConfirmBg.strokeRoundedRect(-w / 2, -h / 2, w, h, 12);

    this.buildConfirmBtn
      .setBackgroundColor(this.isBuildPreviewValid ? '#166534' : '#451a1a')
      .setColor(this.isBuildPreviewValid ? '#fef08a' : '#fca5a5');

    this.buildConfirmContainer.setVisible(true);
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

    const unitBlocker = this.add
      .zone(this.cardWidth / 2, this.cardHeight / 2, this.cardWidth, this.cardHeight)
      .setInteractive();
    unitBlocker.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    this.unitPortrait = this.add.image(44, 62, 'portrait-male-1').setScale(0.5);
    this.unitTraitText = this.add
      .text(44, 114, '', {
        fontSize: '9.5px',
        fontStyle: 'bold',
        color: '#fde68a',
      })
      .setOrigin(0.5, 0);
    this.unitMoodText = this.add
      .text(44, 130, '', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#86efac',
      })
      .setOrigin(0.5, 0);
    this.unitNameText = this.add.text(88, 10, '', {
      fontSize: '14.5px',
      fontStyle: 'bold',
      color: '#ffe066',
    });
    this.unitGenderBadge = this.add
      .text(this.cardWidth - 46, 10, '', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#f2e8cf',
        backgroundColor: '#3e2b1c',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(1, 0);

    const deselectBtn = this.add
      .text(this.cardWidth - 8, 7, '✕', {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fecaca',
        backgroundColor: '#5c1d1d',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0)
      .setInteractive({ useHandCursor: true });
    deselectBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('clear-selection');
    });

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
      unitBlocker,
      this.unitPortrait,
      this.unitTraitText,
      this.unitMoodText,
      this.unitNameText,
      this.unitGenderBadge,
      deselectBtn,
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

    const groupBlocker = this.add.zone(w / 2, h / 2, w, h).setInteractive();
    groupBlocker.on('pointerdown', () => this.events.emit('ui-button-clicked'));

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
      groupBlocker,
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

    const blocker = this.add.zone(w / 2, h / 2, w, h).setInteractive();
    blocker.on('pointerdown', () => this.events.emit('ui-button-clicked'));

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
      this.syncQuickDockVisibility();
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
      blocker,
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
    const h = 492;
    this.buildModalContainer = this.add.container(0, 0).setDepth(4800);

    const scrim = this.add.rectangle(0, 0, 3200, 3200, 0x0a0704, 0.68).setInteractive();
    scrim.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    const bg = this.add.graphics();
    bg.fillStyle(0x23170e, 0.97);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 18);
    bg.lineStyle(2.4, 0xd99b52, 0.96);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

    const title = this.add.text(-w / 2 + 22, -h / 2 + 12, '🏗️ Вікно будівництва племені (17 споруд)', {
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#ffe066',
    });

    const closeBtn = this.add
      .text(w / 2 - 20, -h / 2 + 12, '✕ Закрити', {
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
    const cardH = 64;
    const gapX = 10;
    const gapY = 6;
    const startX = -w / 2 + 20;
    const startY = -h / 2 + 46;

    BUILD_ORDER.forEach((type, idx) => {
      const def = BUILDING_DEFS[type];
      const col = idx % 3;
      const row = Math.floor(idx / 3);
      const cx = startX + col * (cardW + gapX);
      const cy = startY + row * (cardH + gapY);

      const card = this.add.container(cx, cy);
      const cBg = this.add.graphics();
      const iconKey = this.textures.exists(`icon-${type}`) ? `icon-${type}` : 'icon-hut';
      const icon = this.add.image(23, 34, iconKey).setScale(0.78);
      const titleText = this.add.text(46, 5, def.nameUk, {
        fontSize: '11.5px',
        fontStyle: 'bold',
        color: '#ffe066',
      });
      const descText = this.add.text(46, 20, def.descUk, {
        fontSize: '9px',
        color: '#e6ccb2',
        wordWrap: { width: cardW - 52 },
      });
      const costs: string[] = [`🪵${def.wood}`, `🪨${def.stone}`];
      if (def.bone) costs.push(`🦴${def.bone}`);
      if (def.hide) costs.push(`🧥${def.hide}`);
      const costText = this.add.text(46, 50, costs.join(' '), {
        fontSize: '10px',
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
        const unlockInfo = this.buildUnlocks[type];
        if (unlockInfo && !unlockInfo.unlocked) {
          this.events.emit('toggle-build', type);
          return;
        }
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
    const cardH = 64;
    for (const ref of this.buildModalCards) {
      const def = BUILDING_DEFS[ref.type];
      const unlockInfo = this.buildUnlocks[ref.type];
      const unlocked = !unlockInfo || unlockInfo.unlocked;
      const ok =
        unlocked &&
        this.latestResources.wood >= def.wood &&
        this.latestResources.stone >= def.stone &&
        this.latestResources.bone >= (def.bone ?? 0) &&
        this.latestResources.hide >= (def.hide ?? 0);

      const costs: string[] = [`🪵${def.wood}`, `🪨${def.stone}`];
      if (def.bone) costs.push(`🦴${def.bone}`);
      if (def.hide) costs.push(`🧥${def.hide}`);

      ref.bg.clear();
      if (!unlocked) {
        ref.bg.fillStyle(0x110b07, 0.92);
        ref.bg.fillRoundedRect(0, 0, cardW, cardH, 10);
        ref.bg.lineStyle(1.4, 0x475569, 0.78);
        ref.bg.strokeRoundedRect(0, 0, cardW, cardH, 10);
        ref.titleText.setText(`🔒 ${def.nameUk}`).setColor('#94a3b8');
        ref.costText
          .setText(unlockInfo?.reasonUk ?? `Етап ${unlockInfo?.stage ?? 2}`)
          .setColor('#fbbf24');
      } else {
        ref.bg.fillStyle(ref.hovered ? 0x3b281a : 0x18100a, 0.94);
        ref.bg.fillRoundedRect(0, 0, cardW, cardH, 10);
        ref.bg.lineStyle(1.6, ok ? (ref.hovered ? 0x4ade80 : 0xd99b52) : 0x7f1d1d, 0.92);
        ref.bg.strokeRoundedRect(0, 0, cardW, cardH, 10);
        ref.titleText.setText(def.nameUk).setColor(ok ? '#ffe066' : '#cbd5e1');
        ref.costText.setText(costs.join(' ')).setColor(ok ? '#86efac' : '#fca5a5');
      }
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

    const bPanelBlocker = this.add
      .zone(this.buildingPanelW / 2, this.buildingPanelH / 2, this.buildingPanelW, this.buildingPanelH)
      .setInteractive();
    bPanelBlocker.on('pointerdown', () => this.events.emit('ui-button-clicked'));

    this.buildingTitleText = this.add.text(14, 10, '', {
      fontSize: '14.5px',
      fontStyle: 'bold',
      color: '#ffe066',
    });

    // Demolish button (for palisades, bridges, and any tribe building)
    this.demolishBtn = this.add
      .text(this.buildingPanelW - 42, 10, '🗑️ Зруйнувати', {
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
      .text(this.buildingPanelW - 10, 8, '✕', {
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#fecaca',
        backgroundColor: '#5c1d1d',
        padding: { x: 6, y: 2 },
      })
      .setOrigin(1, 0);
    const closeHit = this.add
      .zone(this.buildingPanelW - 18, 18, 36, 32)
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
      wordWrap: { width: this.buildingPanelW - 28 },
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
      .text(88, 122, 'Призначити', { fontSize: '10.5px', fontStyle: 'bold', color: '#fef08a' })
      .setOrigin(0.5);
    const assignHit = this.add
      .zone(88, 122, 148, 24)
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

    // Profile Roster Picker button (assign any adult/warrior from a list without searching the map!)
    this.rosterPickBtn = this.add
      .text(this.buildingPanelW - 14, 122, '👤 Список', {
        fontSize: '10.5px',
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

    // Unassign workers button (explicit removal from station / watchtower)
    this.unassignBtn = this.add
      .text(this.buildingPanelW - 14, 122, '🔄 Зняти', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#fed7aa',
        backgroundColor: '#5c2818',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.unassignBtn.on('pointerdown', () => {
      if (!this.latestBuilding) return;
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('unassign-building-workers', this.latestBuilding.id);
    });
    this.unassignBtn.setVisible(false);

    this.upgradeBtn = this.add
      .text(14, 150, '⬆️ Покращити', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#fef08a',
        backgroundColor: '#14532d',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true });
    this.upgradeBtn.on('pointerdown', () => {
      if (!this.latestBuilding) return;
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('upgrade-building', this.latestBuilding.id);
    });
    this.upgradeBtn.setVisible(false);

    this.chiefAlarmBtn = this.add
      .text(this.buildingPanelW - 14, 150, '🚨 Тривога', {
        fontSize: '10.5px',
        fontStyle: 'bold',
        color: '#fecaca',
        backgroundColor: '#7f1d1d',
        padding: { x: 8, y: 4 },
      })
      .setOrigin(1, 0.5)
      .setInteractive({ useHandCursor: true });
    this.chiefAlarmBtn.on('pointerdown', () => {
      SoundFX.unlock();
      this.events.emit('ui-button-clicked');
      this.events.emit('toggle-defense-alarm');
    });
    this.chiefAlarmBtn.setVisible(false);

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
      bPanelBlocker,
      this.buildingTitleText,
      this.demolishBtn,
      closeText,
      closeHit,
      this.buildingDescText,
      this.buildingStatusText,
      this.buildingWorkerText,
      this.assignBtnGroup,
      this.rosterPickBtn,
      this.unassignBtn,
      this.upgradeBtn,
      this.chiefAlarmBtn,
      this.barracksGroup,
      this.totemTechBtn,
      this.burialChronicleBtn,
    ]);
    this.buildingPanel.setVisible(false);
  }

  private drawAssignButtonBg(): void {
    this.assignBtnBg.clear();
    this.assignBtnBg.fillStyle(this.isAssignHovered ? 0x166534 : 0x14532d, 0.96);
    this.assignBtnBg.fillRoundedRect(14, 110, 148, 24, 7);
    this.assignBtnBg.lineStyle(1.4, 0x4ade80, this.isAssignHovered ? 1 : 0.85);
    this.assignBtnBg.strokeRoundedRect(14, 110, 148, 24, 7);
  }

  private refreshBuildingPanel(): void {
    if (!this.latestBuilding || !this.latestBuilding.isComplete) {
      this.buildingPanel.setVisible(false);
      this.syncQuickDockVisibility();
      return;
    }
    const b = this.latestBuilding;
    this.buildingTitleText.setText(
      b.level && b.level > 1 && !b.nameUk.includes('Рів.')
        ? `${b.nameUk} (Рів.${b.level})`
        : b.nameUk
    );
    this.buildingDescText.setText(b.descUk);
    this.totemTechBtn.setVisible(b.type === 'totem');
    this.burialChronicleBtn.setVisible(b.type === 'burial_mound');
    this.demolishBtn.setVisible(Boolean(b.canDemolish));
    this.chiefAlarmBtn.setVisible(b.type === 'chief_hut');

    if (b.upgradeCost) {
      const uc = b.upgradeCost;
      const parts = [`🪵${uc.wood}`, `🪨${uc.stone}`];
      if (uc.bone) parts.push(`🦴${uc.bone}`);
      if (uc.hide) parts.push(`🧥${uc.hide}`);
      this.upgradeBtn
        .setText(`⬆️ Рів.${(b.level ?? 1) + 1}: ${parts.join(' ')}`)
        .setPosition(14, b.type === 'barracks' ? 114 : 150)
        .setVisible(true);
    } else {
      this.upgradeBtn.setVisible(false);
    }

    if (b.type === 'barracks') {
      this.buildingStatusText.setText(
        `Воїни племені: ${b.warriorSlotsUsed ?? 0} / ${b.warriorSlotsMax ?? 0}`
      );
      this.barracksTargetText.setText(`Ліміт: ${b.targetWarriors ?? 5}`);
      this.buildingWorkerText
        .setText(
          this.latestSnapshot && !this.latestSnapshot.isChild
            ? `Обрано: ${this.latestSnapshot.name} (оберіть клас воїна нижче)`
            : 'Оберіть жителя на карті або через «👤 Список»'
        )
        .setColor('#bae6fd');
      this.assignBtnGroup.setVisible(false);
      this.unassignBtn.setVisible(false);
      this.rosterPickBtn
        .setText('👤 Список жителів')
        .setPosition(this.buildingPanelW - 14, 114)
        .setOrigin(1, 0.5)
        .setVisible(true);
      this.barracksGroup.setVisible(true);
    } else if (b.type === 'nursery') {
      this.barracksGroup.setVisible(false);
      this.assignBtnGroup.setVisible(false);
      this.rosterPickBtn.setVisible(false);
      this.unassignBtn.setVisible(false);
      const kids = b.childrenInside ?? [];
      this.buildingStatusText.setText(`👶 Дітей у Яслах: ${kids.length}`);
      this.buildingWorkerText
        .setText(
          kids.length > 0
            ? `Під наглядом: ${kids.slice(0, 4).join(', ')}`
            : 'Діти автоматично приходять сюди до 14 років'
        )
        .setColor('#86efac');
    } else if (b.type === 'granary') {
      this.barracksGroup.setVisible(false);
      this.assignBtnGroup.setVisible(false);
      this.rosterPickBtn.setVisible(false);
      this.unassignBtn.setVisible(false);
      const cap = this.latestResources.storageCap || MAX_STORAGE;
      this.buildingStatusText.setText(
        `📦 Загальний склад племені (+80 ліміту • ${b.hp ?? 380}/${b.maxHp ?? 380} HP)`
      );
      this.buildingWorkerText
        .setText(
          `🪵 ${this.latestResources.wood}  🪨 ${this.latestResources.stone}  🍖 ${this.latestResources.food}  🦴 ${this.latestResources.bone}  🧥 ${this.latestResources.hide}  (макс. ${cap})`
        )
        .setColor('#a7f3d0');
    } else if (b.type === 'bridge') {
      this.barracksGroup.setVisible(false);
      this.assignBtnGroup.setVisible(false);
      this.rosterPickBtn.setVisible(false);
      this.unassignBtn.setVisible(false);
      this.buildingStatusText.setText(
        `🌉 Переправа через річку (Міцн.: ${b.hp ?? 380}/${b.maxHp ?? 380} HP)`
      );
      this.buildingWorkerText
        .setText('Жителі й воїни автоматично переходять річку по мосту')
        .setColor('#86efac');
    } else {
      this.barracksGroup.setVisible(false);
      if (b.type === 'workshop') {
        const stock = b.toolsInStock ?? this.latestResources.tools;
        const equipped = b.toolsEquipped ?? 0;
        const target = b.toolsTarget ?? this.population.count + 5;
        this.buildingStatusText.setText(
          `🛠️ Інструменти: запас ${stock} • у жителів ${equipped} (ціль ${target})`
        );
      } else if (b.type === 'watchtower') {
        this.buildingStatusText.setText(
          `🏹 Пост (лише Воїни): ${b.garrisonedWarriorName ? `чатує ${b.garrisonedWarriorName}` : 'порожньо'} • ${b.hp ?? 480}/${b.maxHp ?? 480} HP`
        );
      } else if (b.type === 'totem' && (b.captivesCount ?? 0) > 0) {
        this.buildingStatusText.setText(
          `🌀 Навернених збирачів біля Тотема: ${b.captivesCount} (чекають зміну сезону)`
        );
      } else if (b.statusNote) {
        this.buildingStatusText.setText(b.statusNote);
      } else {
        this.buildingStatusText.setText(`Міцність: ${b.hp ?? 380}/${b.maxHp ?? 380} HP`);
      }

      if (b.assignedWorkers.length > 0) {
        const listStr = b.assignedWorkers
          .map((w) => `${w.name} (Рів.${w.level})`)
          .join(', ');
        const extraNote = b.type === 'workshop' && b.statusNote ? ` • ${b.statusNote}` : '';
        this.buildingWorkerText
          .setText(`Працюють (${b.assignedWorkers.length}/${b.maxWorkers}): ${listStr}${extraNote}`)
          .setColor('#a7f3d0');
      } else if (b.type === 'watchtower') {
        this.buildingWorkerText
          .setText('Вільно (0/1) — призначте Воїна з казарми для стрільби з лука')
          .setColor('#fde68a');
      } else if (b.profession) {
        this.buildingWorkerText
          .setText(`Вільно (0/${b.maxWorkers}) — призначте жителя`)
          .setColor('#fde68a');
      } else {
        this.buildingWorkerText.setText('').setColor('#d6c2a8');
      }

      if (b.profession) {
        const hasWorkers = b.assignedWorkers.length > 0;
        this.unassignBtn.setVisible(hasWorkers);
        if (hasWorkers) {
          this.rosterPickBtn
            .setText('👤 Список')
            .setPosition(222, 122)
            .setOrigin(0.5, 0.5)
            .setVisible(true);
        } else {
          this.rosterPickBtn
            .setText('👤 Список жителів')
            .setPosition(this.buildingPanelW - 14, 122)
            .setOrigin(1, 0.5)
            .setVisible(true);
        }

        if (b.type === 'watchtower') {
          if (this.latestSnapshot && this.latestSnapshot.warriorClass) {
            this.assignBtnText.setText(`🏹 На вежу: ${this.latestSnapshot.name}`);
          } else {
            this.assignBtnText.setText('🏹 Призначити воїна');
          }
        } else if (
          this.latestSnapshot &&
          !this.latestSnapshot.isChild &&
          !this.latestSnapshot.isDying
        ) {
          this.assignBtnText.setText(`Призначити: ${this.latestSnapshot.name}`);
        } else {
          this.assignBtnText.setText('Призначити виділеного');
        }
        this.assignBtnGroup.setVisible(true);
      } else {
        this.assignBtnGroup.setVisible(false);
        this.rosterPickBtn.setVisible(false);
        this.unassignBtn.setVisible(false);
      }
    }

    this.buildingPanel.setVisible(true);
    this.syncQuickDockVisibility();
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
    this.rosterEmptyText = this.add
      .text(0, 0, '', {
        fontSize: '14px',
        color: '#fde68a',
        align: 'center',
        wordWrap: { width: 540 },
      })
      .setOrigin(0.5);
    this.rosterEmptyText.setVisible(false);

    // Pre-allocate 5 persistent interactive rows so 220ms roster updates never destroy buttons mid-click!
    const rowW = 596;
    const rowH = 60;
    const startY = -158;
    for (let idx = 0; idx < 5; idx++) {
      const ry = startY + idx * (rowH + 6);
      const row = this.add.container(-rowW / 2, ry);

      const rBg = this.add.graphics();
      rBg.fillStyle(0x160f09, 0.94);
      rBg.fillRoundedRect(0, 0, rowW, rowH, 10);
      rBg.lineStyle(1.4, 0xc98a4b, 0.85);
      rBg.strokeRoundedRect(0, 0, rowW, rowH, 10);

      const portrait = this.add.image(32, 30, 'portrait-male-1').setScale(0.36);
      const nameTxt = this.add.text(64, 8, '', {
        fontSize: '12.5px',
        fontStyle: 'bold',
        color: '#fde68a',
      });
      const statusTxt = this.add.text(64, 30, '', {
        fontSize: '11px',
        color: '#cbd5e1',
      });
      const assignBtn = this.add
        .text(rowW - 14, 30, '✅ Призначити сюди', {
          fontSize: '11.5px',
          fontStyle: 'bold',
          color: '#fef08a',
          backgroundColor: '#166534',
          padding: { x: 10, y: 6 },
        })
        .setOrigin(1, 0.5)
        .setInteractive({ useHandCursor: true });

      const ref: RosterRowRef = {
        container: row,
        rBg,
        portrait,
        nameTxt,
        statusTxt,
        assignBtn,
        villagerId: '',
      };

      assignBtn.on('pointerdown', () => {
        if (!ref.villagerId) return;
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        const b = this.latestBuilding;
        if (b && b.type === 'barracks') {
          this.events.emit('select-villager-by-id', ref.villagerId);
          this.rosterModalContainer.setVisible(false);
        } else if (b && b.profession) {
          this.events.emit('assign-villager-by-id', {
            buildingId: b.id,
            villagerId: ref.villagerId,
          });
          this.rosterModalContainer.setVisible(false);
        } else {
          this.events.emit('select-villager-by-id', ref.villagerId);
          this.rosterModalContainer.setVisible(false);
        }
      });

      row.add([rBg, portrait, nameTxt, statusTxt, assignBtn]);
      row.setVisible(false);
      this.rosterRows.push(ref);
      this.rosterListContainer.add(row);
    }

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
      const items = this.getFilteredRosterItems();
      const totalPages = Math.max(1, Math.ceil(items.length / 5));
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
      this.rosterEmptyText,
      this.rosterListContainer,
      prevBtn,
      this.rosterPageText,
      nextBtn,
    ]);
    this.rosterModalContainer.setVisible(false);
  }

  private getFilteredRosterItems(): VillagerRosterItem[] {
    if (this.latestBuilding?.type === 'watchtower') {
      return this.latestRoster.filter((v) => v.warriorClass !== null);
    }
    return this.latestRoster;
  }

  private refreshRosterModal(): void {
    const b = this.latestBuilding;
    const prof: ProfessionId | null = b?.profession ?? null;
    this.rosterTitleText.setText(
      b?.type === 'watchtower'
        ? `🏹 Призначення на «${b.nameUk}» — лише Воїни:`
        : b
        ? `👤 Призначення в «${b.nameUk}» — оберіть жителя:`
        : '👤 Жителі племені'
    );

    const items = this.getFilteredRosterItems();
    const perPage = 5;
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    this.rosterPage = Phaser.Math.Clamp(this.rosterPage, 0, totalPages - 1);
    this.rosterPageText.setText(`${this.rosterPage + 1} / ${totalPages}`);

    if (items.length === 0) {
      this.rosterEmptyText
        .setText(
          b?.type === 'watchtower'
            ? 'У племені ще немає воїнів!\nСпочатку навчіть воїна у Казармі, щоб поставити його на Сторожову вежу.'
            : 'Немає доступних дорослих жителів.'
        )
        .setVisible(true);
    } else {
      this.rosterEmptyText.setVisible(false);
    }

    const slice = items.slice(this.rosterPage * perPage, (this.rosterPage + 1) * perPage);
    const actionLabel =
      b && b.type === 'barracks'
        ? '⚔️ Обрати для казарми'
        : b && b.type === 'watchtower'
        ? '🏹 Поставити на вежу'
        : b && b.profession
        ? '✅ Призначити сюди'
        : '👁️ Виділити';

    this.rosterRows.forEach((row, idx) => {
      const v = slice[idx];
      if (!v) {
        row.villagerId = '';
        row.container.setVisible(false);
        return;
      }
      row.villagerId = v.id;
      const pKey =
        v.lifeStage === 'ELDER' ? `portrait-${v.appearance}-elder` : `portrait-${v.appearance}`;
      row.portrait.setTexture(pKey);

      const skillLvl = prof ? v.skills[prof] ?? 1 : v.topProfessionLevel;
      const skillText = v.warriorClass
        ? `${WARRIOR_CLASS_LABELS_UK[v.warriorClass]} (Рів.${v.skills.warrior ?? 1})`
        : prof
        ? `Навичка (${b?.professionLabel}): Рів.${skillLvl}`
        : `Найкраща: ${v.topProfessionLabel} Рів.${v.topProfessionLevel}`;

      row.nameTxt.setText(
        `${v.isChief ? '💀 ' : ''}${v.name} (${v.age} р.) • ${skillText}`
      );
      row.statusTxt.setText(
        `Стан: ${v.stateLabel}${v.assignedBuildingName ? ` • Призначений: ${v.assignedBuildingName}` : ''}`
      );
      row.assignBtn.setText(actionLabel);
      row.container.setVisible(true);
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
    this.diplomacyEmptyText = this.add
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
    this.diplomacyEmptyText.setVisible(false);

    // Pre-allocate 3 persistent rival cards so 220ms rival updates never destroy interactive buttons!
    const cardW = 654;
    const cardH = 112;
    const startY = -156;
    const tradeDefs: Array<{
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

    for (let idx = 0; idx < 3; idx++) {
      const cy = startY + idx * (cardH + 10);
      const card = this.add.container(-cardW / 2, cy);
      const cBg = this.add.graphics();
      const header = this.add.text(14, 10, '', {
        fontSize: '13px',
        fontStyle: 'bold',
        color: '#fde68a',
      });
      const status = this.add.text(14, 32, '', {
        fontSize: '11.5px',
        color: '#bae6fd',
      });
      const resLine = this.add.text(14, 52, '', {
        fontSize: '11px',
        color: '#d6c2a8',
      });

      const pactBtn = this.add
        .text(14, 76, '🕊️ Пакт про ненапад (4 сезони)', {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#fef08a',
          backgroundColor: '#1e3a5f',
          padding: { x: 8, y: 5 },
        })
        .setInteractive({ useHandCursor: true });

      const allyBtn = this.add
        .text(238, 76, '🤝 Укласти Союз (відкрити торгівлю)', {
          fontSize: '11px',
          fontStyle: 'bold',
          color: '#86efac',
          backgroundColor: '#14532d',
          padding: { x: 8, y: 5 },
        })
        .setInteractive({ useHandCursor: true });

      const ref: DiplomacyCardRef = {
        container: card,
        cBg,
        header,
        status,
        resLine,
        pactBtn,
        allyBtn,
        tradeBtns: [],
        tribeId: '',
      };

      pactBtn.on('pointerdown', () => {
        if (!ref.tribeId) return;
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.events.emit('propose-non-aggression', ref.tribeId);
      });
      allyBtn.on('pointerdown', () => {
        if (!ref.tribeId) return;
        SoundFX.unlock();
        this.events.emit('ui-button-clicked');
        this.events.emit('propose-alliance', ref.tribeId);
      });

      card.add([cBg, header, status, resLine, pactBtn, allyBtn]);

      for (const td of tradeDefs) {
        const tBtn = this.add
          .text(td.x, 76, td.label, {
            fontSize: '10.5px',
            fontStyle: 'bold',
            color: '#fef08a',
            backgroundColor: '#422b16',
            padding: { x: 7, y: 5 },
          })
          .setInteractive({ useHandCursor: true });
        tBtn.on('pointerdown', () => {
          if (!ref.tribeId) return;
          SoundFX.unlock();
          this.events.emit('ui-button-clicked');
          this.events.emit('trade-with-tribe', {
            tribeId: ref.tribeId,
            giveType: td.giveType,
            giveAmount: 15,
            receiveType: td.receiveType,
            receiveAmount: td.receiveType === 'bone' || td.receiveType === 'hide' ? 10 : 12,
          });
        });
        ref.tradeBtns.push(tBtn);
        card.add(tBtn);
      }

      card.setVisible(false);
      this.diplomacyCards.push(ref);
      this.diplomacyBodyContainer.add(card);
    }

    this.diplomacyModalContainer.add([
      scrim,
      bg,
      title,
      closeBtn,
      this.diplomacyEmptyText,
      this.diplomacyBodyContainer,
    ]);
    this.diplomacyModalContainer.setVisible(false);
  }

  private refreshDiplomacyModal(): void {
    const discovered = this.latestRivals.filter((r) => r.discovered && r.alive);
    this.diplomacyEmptyText.setVisible(discovered.length === 0);

    const cardW = 654;
    const cardH = 112;

    this.diplomacyCards.forEach((card, idx) => {
      const tr = discovered[idx];
      if (!tr) {
        card.tribeId = '';
        card.container.setVisible(false);
        return;
      }
      card.tribeId = tr.id;
      card.cBg.clear();
      card.cBg.fillStyle(0x160f09, 0.94);
      card.cBg.fillRoundedRect(0, 0, cardW, cardH, 12);
      card.cBg.lineStyle(1.8, Phaser.Display.Color.HexStringToColor(tr.colorHex).color, 0.92);
      card.cBg.strokeRoundedRect(0, 0, cardW, cardH, 12);

      card.header.setText(
        `🏴 Плем’я «${tr.nameUk}» • 👥 Населення: ${tr.population}/${tr.popCap} • ⚔️ Воїнів: ${tr.warriorsCount} • 🏠 Споруд: ${tr.buildingsCount}`
      );
      card.status.setText(
        `Ставлення до нас: ${tr.attitudeUk}   |   Міжплемінні події: ${tr.interTribeStatusUk}`
      );
      card.resLine.setText(
        `Запаси племені: 🪵${tr.resources.wood}  🪨${tr.resources.stone}  🍖${tr.resources.food}  🦴${tr.resources.bone}  🧥${tr.resources.hide}`
      );

      card.pactBtn.setVisible(tr.treaty !== 'non_aggression' && tr.treaty !== 'alliance');
      card.allyBtn.setVisible(tr.treaty !== 'alliance');
      for (const tb of card.tradeBtns) {
        tb.setVisible(tr.treaty === 'alliance');
      }
      card.container.setVisible(true);
    });
  }

  private openSavesModal(): void {
    this.buildModalContainer.setVisible(false);
    this.techModalContainer.setVisible(false);
    this.chronicleContainer.setVisible(false);
    this.diplomacyModalContainer.setVisible(false);
    this.rosterModalContainer.setVisible(false);
    this.isMenuOpenState = true;
    this.setHudVisible(false);
    if (this.scene.get('GameScene')) {
      this.scene.setVisible(false, 'GameScene');
    }
    this.events.emit('set-menu-open', true);
    this.menuOverlay.open('saves', {
      isInitialBoot: false,
      returnToGameOnBack: true,
    });
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
    this.hintText = this.add.text(
      0,
      0,
      'ЛКМ/Рамка — вибрати • ПКМ — наказ • Вогнище — Оборона • Тотем — Знання • WASD — камера',
      {
        fontSize: '10.5px',
        color: '#fff8e7',
        backgroundColor: '#261a11cc',
        padding: { x: 8, y: 3 },
      }
    );
  }

  private syncQuickDockVisibility(): void {
    if (this.isMenuOpenState) {
      this.quickDockContainer.setVisible(false);
      return;
    }
    const logicalW = this.scale.width / GAME_DPR;
    const logicalH = this.scale.height / GAME_DPR;
    const wideDesktop = logicalW >= 1180 && logicalH > 520;
    const isPortrait = logicalW < 600 && logicalH >= logicalW;
    const hideForContext =
      !wideDesktop &&
      !isPortrait &&
      (this.buildingPanel.visible || this.campfirePanel.visible);
    this.quickDockContainer.setVisible(!hideForContext);
  }

  private layoutUI(width: number, height: number): void {
    const dpr = GAME_DPR;
    const logicalW = width / dpr;
    const logicalH = height / dpr;
    const toCanvas = (v: number): number => Math.round(v * dpr);

    const isCompactLandscape = logicalH <= 520 && logicalW > logicalH;
    const isPortrait = logicalW < 600 && logicalH >= logicalW;

    const miniScale =
      logicalW >= 1050 && logicalH >= 600
        ? 1
        : isCompactLandscape
        ? Math.min(0.68, (logicalH * 0.29) / 144)
        : isPortrait
        ? 0.54
        : 0.78;

    const rightReserve = isPortrait ? 12 : Math.round(this.minimapW * miniScale) + 18;
    const topMaxW = Math.max(260, logicalW - rightReserve - 12);
    const barScale = Math.min(1, topMaxW / this.baseBarWidth);
    const barCenterOffset = isPortrait
      ? (logicalW - this.baseBarWidth * barScale) / 2
      : (logicalW - rightReserve - this.baseBarWidth * barScale) / 2;
    this.topBarContainer
      .setScale(barScale * dpr)
      .setPosition(toCanvas(Math.max(8, barCenterOffset)), toCanvas(6));

    const topBarH = this.isStorageExpanded ? 68 : 38;
    const calScale = Math.min(barScale, topMaxW / this.calendarBarWidth);
    const calY = 6 + topBarH * barScale + 4;
    const calX = isPortrait
      ? (logicalW - this.calendarBarWidth * calScale) / 2
      : (logicalW - rightReserve - this.calendarBarWidth * calScale) / 2;
    this.calendarContainer
      .setScale(calScale * dpr)
      .setPosition(toCanvas(Math.max(8, calX)), toCanvas(calY));

    const calBottom = calY + 38 * calScale;
    const miniY = isPortrait ? calBottom + 6 : 6;
    const miniW = this.minimapW * miniScale;
    const miniH = (this.minimapH + 22) * miniScale;
    this.minimapContainer
      .setScale(miniScale * dpr)
      .setPosition(toCanvas(logicalW - miniW - 8), toCanvas(miniY));

    const minimapBottom = miniY + miniH;
    const actionScale = isPortrait
      ? Math.min(1, (logicalW - 16) / this.actionBarWidth)
      : Math.min(1, (logicalW * 0.45) / this.actionBarWidth, isCompactLandscape ? 0.84 : 1);
    this.actionBarContainer.setScale(actionScale * dpr);
    const actionH = 46 * actionScale;
    const actionMarginBottom = logicalW >= 1180 && !isCompactLandscape ? 22 : 8;

    const dockScale = isPortrait
      ? Math.min(1, (logicalW - 16) / 362)
      : Math.min(1, (logicalW * 0.45) / 362, isCompactLandscape ? 0.82 : 1);
    this.quickDockContainer.setScale(dockScale * dpr);
    const dockH = 42 * dockScale;

    const needsRightDockClearance = isPortrait || logicalW < 1180 || isCompactLandscape;
    const rightDockReserve = needsRightDockClearance ? dockH + 12 : 0;
    const ctrlMaxH = Math.max(
      96,
      logicalH - minimapBottom - actionH - actionMarginBottom - rightDockReserve - 16
    );
    const ctrlScale = Math.min(1, Math.max(0.48, ctrlMaxH / 208), isCompactLandscape ? 0.76 : 1);
    const ctrlW = 44 * ctrlScale;
    this.cameraControlsContainer
      .setScale(ctrlScale * dpr)
      .setPosition(toCanvas(logicalW - ctrlW - 8), toCanvas(minimapBottom + 6));

    const cardScale = isPortrait
      ? Math.min(0.84, (logicalW - 16) / this.cardWidth)
      : isCompactLandscape
      ? Math.min(0.79, (logicalW * 0.39) / this.cardWidth, (logicalH * 0.41) / this.cardHeight)
      : Math.min(1, (logicalW * 0.42) / this.cardWidth, (logicalH * 0.38) / this.cardHeight);
    this.unitPanel.setScale(cardScale * dpr);
    this.groupPanel.setScale(cardScale * dpr);

    const bPanelScale = isPortrait
      ? Math.min(1, (logicalW - 16) / this.buildingPanelW)
      : isCompactLandscape
      ? Math.min(
          0.74,
          (logicalW * 0.36) / this.buildingPanelW,
          (logicalH * 0.37) / this.buildingPanelH
        )
      : Math.min(1, (logicalW * 0.43) / this.buildingPanelW, (logicalH * 0.42) / this.buildingPanelH);
    this.buildingPanel.setScale(bPanelScale * dpr);
    this.campfirePanel.setScale(bPanelScale * dpr);

    const confirmScale = Math.min(1, (logicalW - 20) / 420, isCompactLandscape ? 0.86 : 1);
    this.buildConfirmContainer.setScale(confirmScale * dpr);

    const centerModals: Array<{
      c: Phaser.GameObjects.Container;
      mw: number;
      mh: number;
    }> = [
      { c: this.buildModalContainer, mw: 756, mh: 492 },
      { c: this.techModalContainer, mw: 680, mh: 448 },
      { c: this.chronicleContainer, mw: 560, mh: 400 },
      { c: this.diplomacyModalContainer, mw: 700, mh: 452 },
      { c: this.rosterModalContainer, mw: 640, mh: 442 },
    ];
    for (const m of centerModals) {
      const modalScale = Math.min(1, (logicalW - 16) / m.mw, (logicalH - 16) / m.mh);
      m.c
        .setPosition(Math.round(width / 2), Math.round(height / 2))
        .setScale(modalScale * dpr);
    }

    if (isPortrait) {
      const actionY = logicalH - actionH - 8;
      this.actionBarContainer.setPosition(
        toCanvas((logicalW - this.actionBarWidth * actionScale) / 2),
        toCanvas(actionY)
      );
      const dockY = actionY - dockH - 6;
      this.quickDockContainer.setPosition(
        toCanvas((logicalW - 362 * dockScale) / 2),
        toCanvas(dockY)
      );
      const panelBottom = dockY - 8;
      this.unitPanel.setPosition(
        toCanvas((logicalW - this.cardWidth * cardScale) / 2),
        toCanvas(panelBottom - this.cardHeight * cardScale)
      );
      this.groupPanel.setPosition(
        toCanvas((logicalW - 368 * cardScale) / 2),
        toCanvas(panelBottom - 114 * cardScale)
      );
      this.buildingPanel.setPosition(
        toCanvas((logicalW - this.buildingPanelW * bPanelScale) / 2),
        toCanvas(panelBottom - this.buildingPanelH * bPanelScale)
      );
      this.campfirePanel.setPosition(
        toCanvas((logicalW - this.buildingPanelW * bPanelScale) / 2),
        toCanvas(panelBottom - 132 * bPanelScale)
      );
      this.buildConfirmContainer.setPosition(
        toCanvas(logicalW / 2),
        toCanvas(dockY - 28 * confirmScale - 6)
      );
      this.hintText.setVisible(false);
    } else if (logicalW >= 1180 && !isCompactLandscape) {
      const actionY = logicalH - actionH - actionMarginBottom;
      this.actionBarContainer.setPosition(
        toCanvas(logicalW - this.actionBarWidth * actionScale - 14),
        toCanvas(actionY)
      );
      this.unitPanel.setPosition(
        toCanvas(14),
        toCanvas(logicalH - this.cardHeight * cardScale - 14)
      );
      this.groupPanel.setPosition(toCanvas(14), toCanvas(logicalH - 114 * cardScale - 14));
      this.quickDockContainer.setPosition(
        toCanvas(this.cardWidth * cardScale + 26),
        toCanvas(logicalH - dockH - actionMarginBottom)
      );
      this.buildingPanel.setPosition(
        toCanvas(logicalW - this.buildingPanelW * bPanelScale - 14),
        toCanvas(actionY - this.buildingPanelH * bPanelScale - 10)
      );
      this.campfirePanel.setPosition(
        toCanvas(logicalW - this.buildingPanelW * bPanelScale - 14),
        toCanvas(actionY - 132 * bPanelScale - 10)
      );
      this.buildConfirmContainer.setPosition(
        toCanvas(logicalW / 2),
        toCanvas(logicalH - dockH - actionMarginBottom - 32 * confirmScale - 12)
      );
      const showDesktopHint =
        logicalW >= 1024 && !this.sys.game.device.input.touch && !this.isMenuOpenState;
      this.hintText
        .setScale(dpr)
        .setOrigin(1, 1)
        .setPosition(toCanvas(logicalW - 14), toCanvas(logicalH - 4))
        .setVisible(showDesktopHint);
    } else {
      const actionW = this.actionBarWidth * actionScale;
      const actionY = logicalH - actionH - 8;
      this.actionBarContainer.setPosition(toCanvas(logicalW - actionW - 8), toCanvas(actionY));
      this.unitPanel.setPosition(
        toCanvas(8),
        toCanvas(logicalH - this.cardHeight * cardScale - 8)
      );
      this.groupPanel.setPosition(toCanvas(8), toCanvas(logicalH - 114 * cardScale - 8));

      const dockW = 362 * dockScale;
      this.quickDockContainer.setPosition(
        toCanvas(logicalW - dockW - 8),
        toCanvas(actionY - dockH - 6)
      );

      const rightEdgeForPanels = logicalW - ctrlW - 14;
      const bW = this.buildingPanelW * bPanelScale;
      this.buildingPanel.setPosition(
        toCanvas(rightEdgeForPanels - bW),
        toCanvas(actionY - this.buildingPanelH * bPanelScale - 8)
      );
      this.campfirePanel.setPosition(
        toCanvas(rightEdgeForPanels - bW),
        toCanvas(actionY - 132 * bPanelScale - 8)
      );

      if (isCompactLandscape) {
        this.buildConfirmContainer.setPosition(
          toCanvas(Math.max(216, (logicalW - rightReserve) / 2)),
          toCanvas(calBottom + 26 * confirmScale + 6)
        );
      } else {
        this.buildConfirmContainer.setPosition(
          toCanvas(logicalW / 2),
          toCanvas(actionY - dockH - 28 * confirmScale - 14)
        );
      }
      this.hintText.setVisible(false);
    }

    this.syncQuickDockVisibility();
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

    const moodVal = Math.round(snap.stats.mood ?? 80);
    const moodEmoji = moodVal >= 70 ? '😊' : moodVal >= 35 ? '😐' : '😒';
    const moodColor = moodVal >= 70 ? '#86efac' : moodVal >= 35 ? '#fde047' : '#fca5a5';
    this.unitTraitText.setText(snap.traitLabel ?? '');
    this.unitMoodText.setText(`${moodEmoji} ${moodVal}%`).setColor(moodColor);
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
