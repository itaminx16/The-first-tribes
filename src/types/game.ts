export type ResourceType = 'wood' | 'stone' | 'food' | 'bone' | 'hide';

export type CarryVisualType = 'wood' | 'stone' | 'food' | 'fish' | 'meat' | 'bone' | 'hide';

export type Season = 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER';

export type LifeStage = 'CHILD' | 'ADULT' | 'ELDER';

export type TimeScale = 1 | 2 | 4;

export type Gender = 'male' | 'female';

export type VillagerAppearanceId = 'male-1' | 'male-2' | 'female';

export type FacingView = 'front' | 'side' | 'back';

export type WeaponType = 'spear' | 'bow' | 'club';

export type ArmorType = 'none' | 'hide_armor' | 'bone_armor';

export type WarriorClass = 'spearman' | 'archer' | 'clubman';

export type GameMode = 'sandbox' | 'survival';

export type DifficultyLevel = 'easy' | 'normal' | 'hard' | 'primal';

export type MusicTrackId = 0 | 1 | 2 | 3;

export type MapPresetId =
  | 'river_valley'
  | 'permafrost'
  | 'desert_oasis'
  | 'seaside'
  | 'huge_world'
  | 'small_arena'
  | 'dense_forest'
  | 'scarce_lands'
  | 'depleting_world'
  | 'twin_rivers';

export type MapBiome = 'temperate' | 'permafrost' | 'desert_split' | 'seaside';

export type RiverLayout = 'single' | 'twin' | 'coastal' | 'oasis';

export interface MapPresetDef {
  id: MapPresetId;
  nameUk: string;
  descUk: string;
  worldW: number;
  worldH: number;
  biome: MapBiome;
  riverLayout: RiverLayout;
  treeCount: number;
  rockCount: number;
  bushCount: number;
  infiniteQuarries: number;
  predatorCap: number;
}

export const MAP_PRESET_ORDER: MapPresetId[] = [
  'river_valley',
  'permafrost',
  'desert_oasis',
  'seaside',
  'huge_world',
  'small_arena',
  'dense_forest',
  'scarce_lands',
  'depleting_world',
  'twin_rivers'
];

export const MAP_PRESETS: Record<MapPresetId, MapPresetDef> = {
  river_valley: {
    id: 'river_valley',
    nameUk: '1. Долина річки',
    descUk: 'Класична простора долина з повноводною річкою, камʼяними бродами, озером і вічними скелями.',
    worldW: 4864,
    worldH: 3584,
    biome: 'temperate',
    riverLayout: 'single',
    treeCount: 64,
    rockCount: 30,
    bushCount: 14,
    infiniteQuarries: 4,
    predatorCap: 3
  },
  permafrost: {
    id: 'permafrost',
    nameUk: '2. Вічна мерзлота',
    descUk: 'Суворий крижаний край: мало ягід, холодні вітри, багато хижаків та багаті камʼяні скелі.',
    worldW: 4864,
    worldH: 3584,
    biome: 'permafrost',
    riverLayout: 'single',
    treeCount: 46,
    rockCount: 38,
    bushCount: 8,
    infiniteQuarries: 5,
    predatorCap: 3
  },
  desert_oasis: {
    id: 'desert_oasis',
    nameUk: '3. Пустеля з оазисом',
    descUk: 'Половина світу — спекотна пустеля з оазисом у центрі, інша половина — зелена савана.',
    worldW: 4864,
    worldH: 3584,
    biome: 'desert_split',
    riverLayout: 'oasis',
    treeCount: 44,
    rockCount: 34,
    bushCount: 11,
    infiniteQuarries: 4,
    predatorCap: 3
  },
  seaside: {
    id: 'seaside',
    nameUk: '4. Узбережжя моря',
    descUk: 'Південно-східний берег омиває широке море з піщаним пляжем та багатою риболовлею.',
    worldW: 4864,
    worldH: 3584,
    biome: 'seaside',
    riverLayout: 'coastal',
    treeCount: 58,
    rockCount: 28,
    bushCount: 13,
    infiniteQuarries: 4,
    predatorCap: 3
  },
  huge_world: {
    id: 'huge_world',
    nameUk: '5. Гігантський світ',
    descUk: 'Величезна мапа (5632×4096) для тривалого розвитку, торгівлі та масштабних союзів.',
    worldW: 5632,
    worldH: 4096,
    biome: 'temperate',
    riverLayout: 'single',
    treeCount: 88,
    rockCount: 42,
    bushCount: 18,
    infiniteQuarries: 6,
    predatorCap: 3
  },
  small_arena: {
    id: 'small_arena',
    nameUk: '6. Мала ущелина',
    descUk: 'Компактна карта (3072×2304): племена живуть поруч, швидкі зустрічі, дипломатія та битви.',
    worldW: 3072,
    worldH: 2304,
    biome: 'temperate',
    riverLayout: 'single',
    treeCount: 38,
    rockCount: 20,
    bushCount: 10,
    infiniteQuarries: 3,
    predatorCap: 2
  },
  dense_forest: {
    id: 'dense_forest',
    nameUk: '7. Густий праліс',
    descUk: 'Густі хащі з маленькими галявинами — збирачам доведеться активно корчувати пеньки й ліс.',
    worldW: 4864,
    worldH: 3584,
    biome: 'temperate',
    riverLayout: 'single',
    treeCount: 120,
    rockCount: 26,
    bushCount: 15,
    infiniteQuarries: 4,
    predatorCap: 3
  },
  scarce_lands: {
    id: 'scarce_lands',
    nameUk: '8. Бідні землі',
    descUk: 'Обмаль ягід, дерев та каміння — виживання вимагає розумної торгівлі й полювання.',
    worldW: 4864,
    worldH: 3584,
    biome: 'temperate',
    riverLayout: 'single',
    treeCount: 30,
    rockCount: 15,
    bushCount: 6,
    infiniteQuarries: 2,
    predatorCap: 3
  },
  depleting_world: {
    id: 'depleting_world',
    nameUk: '9. Вичерпні ресурси',
    descUk: 'Навіть великі скелі мають кінцевий запас каменю — жодного безкінечного родовища!',
    worldW: 4864,
    worldH: 3584,
    biome: 'temperate',
    riverLayout: 'single',
    treeCount: 54,
    rockCount: 36,
    bushCount: 12,
    infiniteQuarries: 0,
    predatorCap: 3
  },
  twin_rivers: {
    id: 'twin_rivers',
    nameUk: '10. Міжріччя (Дві річки)',
    descUk: 'Дві великі річки перетинають мапу, утворюючи родючі острови з камʼяними переходами.',
    worldW: 4864,
    worldH: 3584,
    biome: 'temperate',
    riverLayout: 'twin',
    treeCount: 64,
    rockCount: 32,
    bushCount: 14,
    infiniteQuarries: 4,
    predatorCap: 3
  }
};

export interface GameSetupConfig {
  mode: GameMode;
  mapId: MapPresetId;
  difficulty: DifficultyLevel;
  rivalCount: 0 | 1 | 2 | 3;
  fogOfWar: boolean;
  musicTrack: MusicTrackId;
  ambientSounds: boolean;
}

export const DEFAULT_GAME_SETUP: GameSetupConfig = {
  mode: 'sandbox',
  mapId: 'river_valley',
  difficulty: 'normal',
  rivalCount: 3,
  fogOfWar: false,
  musicTrack: 0,
  ambientSounds: true
};

export const DIFFICULTY_LABELS_UK: Record<DifficultyLevel, string> = {
  easy: 'Легка',
  normal: 'Нормальна',
  hard: 'Важка',
  primal: 'Первісний жах'
};

export const GAME_MODE_LABELS_UK: Record<GameMode, string> = {
  sandbox: 'Пісочниця (пропуск сезонів 1 кліком)',
  survival: 'Виживання (реальні 10 хв сезони)'
};

export type ResourceInventory = Record<ResourceType, number>;

export const MALE_NAMES_UK = [
  'Огг',
  'Тук',
  'Богг',
  'Крук',
  'Зуб',
  'Ур',
  'Рок',
  'Бур',
  'Грім',
  'Скеля'
];

export const FEMALE_NAMES_UK = [
  'Ая',
  'Лія',
  'Ева',
  'Ніа',
  'Зоря',
  'Кіа',
  'Лада',
  'Іва',
  'Тінь',
  'Роса'
];

export const RESOURCE_META: Record<ResourceType, { emoji: string; nameUk: string }> = {
  wood: { emoji: '🪵', nameUk: 'Дерево' },
  stone: { emoji: '🪨', nameUk: 'Камінь' },
  food: { emoji: '🍖', nameUk: 'Їжа' },
  bone: { emoji: '🦴', nameUk: 'Кістки' },
  hide: { emoji: '🧥', nameUk: 'Шкури' }
};

export const MUSIC_TRACK_LABELS_UK: Record<MusicTrackId, string> = {
  0: 'Вимкнено',
  1: '1. Вогонь предків (Флейта)',
  2: '2. Подих вітру (Лісова арфа)',
  3: '3. Ритм племені (Бубни)'
};

export type BuildingType =
  | 'hut'
  | 'large_hut'
  | 'nursery'
  | 'gatherer_hut'
  | 'granary'
  | 'workshop'
  | 'armory'
  | 'barracks'
  | 'totem'
  | 'watchtower'
  | 'smokehouse'
  | 'palisade'
  | 'burial_mound';

export type BuildingCategory = 'living' | 'economy' | 'military' | 'spiritual';

export type ProfessionId =
  | 'lumberjack'
  | 'miner'
  | 'fisher'
  | 'hunter'
  | 'gatherer'
  | 'builder'
  | 'crafter'
  | 'armorer'
  | 'keeper'
  | 'shaman'
  | 'smoker'
  | 'warrior';

export type TechBranchId = 'weapons' | 'armor' | 'craft' | 'healing';

export type TechState = Record<TechBranchId, number>;

export const MAX_STORAGE = 100;
export const GRANARY_STORAGE_BONUS = 80;
export const BASE_POP_CAP = 3;
export const HUT_POP_BONUS = 4;
export const LARGE_HUT_POP_BONUS = 8;
export const BARRACKS_WARRIOR_BONUS = 5;
export const HUT_COST = { wood: 20, stone: 10 } as const;
export const BREED_MIN_FOOD = 15;
export const BREED_DURATION_MS = 10_000;
export const SHAMAN_CONVERT_DURATION_MS = 20_000;

export const SEASON_DURATION_MS = 10 * 60 * 1000; // 10 minutes per season
export const FREE_TIME_DURATION_MS = 2 * 60 * 1000; // 2 minutes personal free time per season
export const YEARS_PER_SEASON_CHANGE = 2;
export const ADULT_AGE = 14;
export const ELDER_AGE = 60;
export const MIN_NATURAL_DEATH_AGE = 62;
export const MAX_NATURAL_DEATH_AGE = 80;
export const MAX_BIRTHS_PER_WOMAN_PER_SEASON = 2;

export const TOOL_RESERVE_BUFFER = 5;
export const GEAR_DEFENSE_RESERVE = 10;
export const TOOL_CRAFT_COST = { wood: 2, stone: 1, bone: 2 } as const;

export const CARCASS_YIELD = {
  food: 15,
  bone: 10,
  hide: 5
} as const;

export const MAX_PREDATORS = 3;

export const RIVAL_RAID_THRESHOLDS = [
  { pop: 100, squad: 20 },
  { pop: 80, squad: 15 },
  { pop: 50, squad: 10 },
  { pop: 25, squad: 5 }
] as const;

export const SEASON_ORDER: Season[] = ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'];

export const SEASON_LABELS_UK: Record<Season, string> = {
  SPRING: 'Весна',
  SUMMER: 'Літо',
  AUTUMN: 'Осінь',
  WINTER: 'Зима'
};

export const SEASON_ICONS: Record<Season, string> = {
  SPRING: '🌸',
  SUMMER: '☀️',
  AUTUMN: '🍂',
  WINTER: '❄️'
};

export const LIFE_STAGE_LABELS_UK: Record<LifeStage, string> = {
  CHILD: 'Дитина',
  ADULT: 'Дорослий',
  ELDER: 'Старійшина'
};

export const PROFESSION_LABELS_UK: Record<ProfessionId, string> = {
  lumberjack: 'Лісоруб',
  miner: 'Каменяр',
  fisher: 'Рибалка',
  hunter: 'Мисливець',
  gatherer: 'Збирач',
  builder: 'Будівельник',
  crafter: 'Ремісник',
  armorer: 'Зброяр',
  keeper: 'Комірник',
  shaman: 'Шаман',
  smoker: 'Коптильник',
  warrior: 'Воїн'
};

export const WARRIOR_CLASS_LABELS_UK: Record<WarriorClass, string> = {
  spearman: 'Списник',
  archer: 'Лучник',
  clubman: 'Дубинник'
};

export const WARRIOR_CLASS_WEAPON: Record<WarriorClass, WeaponType> = {
  spearman: 'spear',
  archer: 'bow',
  clubman: 'club'
};

export interface WeaponDef {
  type: WeaponType;
  nameUk: string;
  wood: number;
  stone: number;
  bone: number;
  hide: number;
  damage: number;
  range: number;
  cooldownMs: number;
  ranged: boolean;
  bonusHp: number;
}

export const WEAPON_DEFS: Record<WeaponType, WeaponDef> = {
  spear: {
    type: 'spear',
    nameUk: 'Спис',
    wood: 2,
    stone: 1,
    bone: 2,
    hide: 0,
    damage: 19,
    range: 60,
    cooldownMs: 720,
    ranged: false,
    bonusHp: 10
  },
  bow: {
    type: 'bow',
    nameUk: 'Лук',
    wood: 3,
    stone: 0,
    bone: 1,
    hide: 1,
    damage: 13,
    range: 215,
    cooldownMs: 860,
    ranged: true,
    bonusHp: 0
  },
  club: {
    type: 'club',
    nameUk: 'Кістяна палиця',
    wood: 2,
    stone: 0,
    bone: 3,
    hide: 0,
    damage: 27,
    range: 46,
    cooldownMs: 860,
    ranged: false,
    bonusHp: 35
  }
};

export interface ArmorDef {
  type: Exclude<ArmorType, 'none'>;
  nameUk: string;
  bone: number;
  hide: number;
  reduction: number;
  bonusHp: number;
}

export const ARMOR_DEFS: Record<Exclude<ArmorType, 'none'>, ArmorDef> = {
  hide_armor: {
    type: 'hide_armor',
    nameUk: 'Шкіряна броня',
    bone: 1,
    hide: 3,
    reduction: 0.35,
    bonusHp: 20
  },
  bone_armor: {
    type: 'bone_armor',
    nameUk: 'Кістяна броня',
    bone: 4,
    hide: 2,
    reduction: 0.55,
    bonusHp: 45
  }
};

export interface TechTierDef {
  nameUk: string;
  descUk: string;
  cost: number;
}

export const TECH_TREE: Record<
  TechBranchId,
  { titleUk: string; icon: string; tiers: [TechTierDef, TechTierDef, TechTierDef] }
> = {
  weapons: {
    titleUk: 'Зброя',
    icon: '⚔️',
    tiers: [
      { nameUk: 'Кременеві наконечники', descUk: '+20% шкоди у бою й полюванні', cost: 20 },
      { nameUk: 'Кістяні зазубрини', descUk: '+45% шкоди зброєю', cost: 45 },
      { nameUk: 'Обсидіанова зброя', descUk: '+75% шкоди всім воїнам', cost: 80 }
    ]
  },
  armor: {
    titleUk: 'Броня',
    icon: '🛡️',
    tiers: [
      { nameUk: 'Вичинка шкур', descUk: '+12% захисту від ударів', cost: 20 },
      { nameUk: 'Кістяні пластини', descUk: '+25% захисту племені', cost: 45 },
      { nameUk: 'Панцир звіра', descUk: '+40% броні у бою', cost: 80 }
    ]
  },
  craft: {
    titleUk: 'Ремесло',
    icon: '⚒️',
    tiers: [
      { nameUk: 'Зручні руківʼя', descUk: '+15% швидкості праці й кузні', cost: 20 },
      { nameUk: 'Гірниче вміння', descUk: '+35% швидкості праці', cost: 45 },
      { nameUk: 'Майстерність предків', descUk: '+55% швидкості праці', cost: 80 }
    ]
  },
  healing: {
    titleUk: 'Цілительство',
    icon: '💚',
    tiers: [
      { nameUk: 'Травʼяні відвари', descUk: '+20 макс. HP племені', cost: 20 },
      { nameUk: 'Тотемний дух', descUk: '+45 макс. HP, повільніший голод', cost: 45 },
      { nameUk: 'Благословення предків', descUk: '+75 макс. HP, сильне зцілення', cost: 80 }
    ]
  }
};

export const SKILL_XP_THRESHOLDS = [0, 35, 85, 160, 270] as const;

export const SKILL_LEVEL_TITLES_UK: Record<number, string> = {
  1: 'Новачок',
  2: 'Підмайстер',
  3: 'Майстер',
  4: 'Знавець',
  5: 'Легенда'
};

export interface BuildingDef {
  type: BuildingType;
  category: BuildingCategory;
  nameUk: string;
  shortUk: string;
  wood: number;
  stone: number;
  bone?: number;
  hide?: number;
  profession: ProfessionId | null;
  maxWorkers: number;
  descUk: string;
}

export const BUILDING_DEFS: Record<BuildingType, BuildingDef> = {
  hut: {
    type: 'hut',
    category: 'living',
    nameUk: 'Мала хатина',
    shortUk: 'Хатина',
    wood: 20,
    stone: 10,
    profession: null,
    maxWorkers: 0,
    descUk: '+4 населення, сон та створення сімей (покачується)'
  },
  large_hut: {
    type: 'large_hut',
    category: 'living',
    nameUk: 'Велика хатина',
    shortUk: 'Вел.хата',
    wood: 40,
    stone: 20,
    hide: 8,
    profession: null,
    maxWorkers: 0,
    descUk: '+8 населення, простора оселя для 6 жителів та сімей'
  },
  nursery: {
    type: 'nursery',
    category: 'living',
    nameUk: 'Ясла',
    shortUk: 'Ясла',
    wood: 25,
    stone: 10,
    hide: 5,
    profession: null,
    maxWorkers: 0,
    descUk: 'Діти самостійно приходять сюди і ростуть у безпеці до 14 років'
  },
  gatherer_hut: {
    type: 'gatherer_hut',
    category: 'economy',
    nameUk: 'Хатина збирача',
    shortUk: 'Збирачі',
    wood: 25,
    stone: 15,
    profession: 'gatherer',
    maxWorkers: 3,
    descUk: 'До 3 збирачів: самі прибирають пеньки й кущі та збирають ресурси поруч'
  },
  granary: {
    type: 'granary',
    category: 'economy',
    nameUk: 'Комора',
    shortUk: 'Комора',
    wood: 30,
    stone: 15,
    profession: 'keeper',
    maxWorkers: 1,
    descUk: '+80 до ліміту та переносить усі склади від вогнища'
  },
  workshop: {
    type: 'workshop',
    category: 'economy',
    nameUk: 'Майстерня',
    shortUk: 'Майстер.',
    wood: 25,
    stone: 20,
    profession: 'crafter',
    maxWorkers: 1,
    descUk: 'Виготовляє інструменти з дерева, каменю та кісток (запас +5)'
  },
  armory: {
    type: 'armory',
    category: 'military',
    nameUk: 'Зброярня',
    shortUk: 'Зброярня',
    wood: 25,
    stone: 20,
    bone: 10,
    profession: 'armorer',
    maxWorkers: 1,
    descUk: 'Кує списи, луки, палиці, шкіряну та кістяну броню (запас 10)'
  },
  barracks: {
    type: 'barracks',
    category: 'military',
    nameUk: 'Казарма',
    shortUk: 'Казарма',
    wood: 30,
    stone: 20,
    hide: 5,
    profession: 'warrior',
    maxWorkers: 0,
    descUk: 'Навчання воїнів (кількість воїнів вибирає гравець)'
  },
  watchtower: {
    type: 'watchtower',
    category: 'military',
    nameUk: 'Сторожова вежа',
    shortUk: 'Вежа',
    wood: 25,
    stone: 15,
    bone: 5,
    profession: 'warrior',
    maxWorkers: 1,
    descUk: 'Обстрілює хижаків і нападників стрілами, розширює огляд'
  },
  smokehouse: {
    type: 'smokehouse',
    category: 'economy',
    nameUk: 'Коптильня',
    shortUk: 'Коптиль.',
    wood: 20,
    stone: 15,
    hide: 5,
    profession: 'smoker',
    maxWorkers: 1,
    descUk: 'Вʼялить мʼясо та рибу, стабільно поповнює їжу'
  },
  totem: {
    type: 'totem',
    category: 'spiritual',
    nameUk: 'Тотем Шамана',
    shortUk: 'Тотем',
    wood: 20,
    stone: 25,
    bone: 8,
    profession: 'shaman',
    maxWorkers: 1,
    descUk: 'Технології (3 рівні), зцілення та навернення полонених за 1 сезон'
  },
  palisade: {
    type: 'palisade',
    category: 'military',
    nameUk: 'Частокіл',
    shortUk: 'Частокіл',
    wood: 12,
    stone: 5,
    profession: null,
    maxWorkers: 0,
    descUk: 'Деревʼяна оборонна стіна (можна зруйнувати)'
  },
  burial_mound: {
    type: 'burial_mound',
    category: 'spiritual',
    nameUk: 'Курган Предків',
    shortUk: 'Курган',
    wood: 10,
    stone: 15,
    profession: null,
    maxWorkers: 0,
    descUk: 'Поховання з пошаною та відкриття Хроніки Предків'
  }
};

export function formatAgeUk(age: number): string {
  const n = Math.floor(Math.max(0, age));
  const mod100 = n % 100;
  const mod10 = n % 10;
  if (mod100 >= 11 && mod100 <= 14) {
    return `${n} років`;
  }
  if (mod10 === 1) {
    return `${n} рік`;
  }
  if (mod10 >= 2 && mod10 <= 4) {
    return `${n} роки`;
  }
  return `${n} років`;
}

export interface CombatTarget {
  id: string;
  x: number;
  y: number;
  faction: 'player' | 'predator' | 'rival';
  tribeId?: string;
  isAlive(): boolean;
  takeDamage(
    amount: number,
    attackerX: number,
    attackerY: number,
    attacker?: CombatTarget
  ): boolean;
}

export interface ObstacleCircle {
  x: number;
  y: number;
  radius: number;
  owner?: object;
}

export interface PopulationState {
  count: number;
  cap: number;
  warriors: number;
  warriorCap: number;
}

export interface CalendarState {
  season: Season;
  year: number;
  elapsedMs: number;
  durationMs: number;
  timeScale: TimeScale;
  isFreeTime: boolean;
  freeTimeRemainingMs: number;
  mode?: GameMode;
  canSkipSeason: boolean;
}

export interface ChiefStatus {
  chiefId: string | null;
  chiefName: string | null;
}

export type VillagerState =
  | 'IDLE_WANDER'
  | 'FREE_TIME'
  | 'WARMING'
  | 'SCRATCHING'
  | 'CHATTING'
  | 'MOVING'
  | 'MOVING_TO_RESOURCE'
  | 'MOVING_TO_LAKE'
  | 'MOVING_TO_HUNT'
  | 'MOVING_TO_CARCASS'
  | 'MOVING_TO_BUILD'
  | 'MOVING_TO_WORK'
  | 'MOVING_TO_NURSERY'
  | 'IN_NURSERY'
  | 'CLEARING_STUMP'
  | 'MOVING_TO_CONVERT'
  | 'CONVERTING_ENEMY'
  | 'GATHERING'
  | 'FISHING'
  | 'HUNTING'
  | 'BUTCHERING'
  | 'BUILDING'
  | 'WORKING_STATION'
  | 'RETURNING'
  | 'MOVING_TO_EAT_STORAGE'
  | 'EATING_STORAGE'
  | 'EATING_BERRIES'
  | 'MOVING_TO_SLEEP'
  | 'SLEEPING_IN_HUT'
  | 'MOVING_TO_BREED'
  | 'BREEDING_IN_HUT'
  | 'CHILD_PLAYING'
  | 'FLEEING_TO_CAMPFIRE'
  | 'GRABBING_GEAR'
  | 'COMBAT_CHASE'
  | 'COMBAT_ATTACK'
  | 'PATROLLING'
  | 'DYING_LYING'
  | 'MOVING_TO_MOURN'
  | 'MOURNING_SITTING';

export interface TribeResources {
  wood: number;
  stone: number;
  food: number;
  bone: number;
  hide: number;
  storageCap: number;
  tools: number;
  weapons: Record<WeaponType, number>;
  armors: Record<Exclude<ArmorType, 'none'>, number>;
  knowledge: number;
}

export interface VillagerStats {
  health: number;
  satiety: number;
  energy: number;
}

export interface VillagerDeeds {
  woodGathered: number;
  stoneGathered: number;
  foodGathered: number;
  boneGathered: number;
  hideGathered: number;
  fishCaught: number;
  animalsHunted: number;
  enemiesSlain: number;
  buildingsBuilt: number;
  toolsCrafted: number;
  knowledgeGenerated: number;
}

export interface AncestorRecord {
  id: string;
  name: string;
  gender: Gender;
  appearance: VillagerAppearanceId;
  familyName: string;
  bornYear: number;
  diedYear: number;
  ageAtDeath: number;
  wasChief: boolean;
  topProfessionLabel: string;
  topProfessionLevel: number;
  biographyUk: string;
}

export interface VillagerRosterItem {
  id: string;
  name: string;
  age: number;
  gender: Gender;
  appearance: VillagerAppearanceId;
  lifeStage: LifeStage;
  isChief: boolean;
  stateLabel: string;
  assignedBuildingName: string | null;
  warriorClass: WarriorClass | null;
  topProfessionLabel: string;
  topProfessionLevel: number;
  skills: Record<ProfessionId, number>;
}

export interface BuildingSnapshot {
  id: string;
  type: BuildingType;
  nameUk: string;
  descUk: string;
  isComplete: boolean;
  progress: number;
  profession: ProfessionId | null;
  professionLabel: string | null;
  assignedWorkerId: string | null;
  assignedWorkerName: string | null;
  assignedWorkerLevel: number;
  assignedWorkers: Array<{ id: string; name: string; level: number }>;
  maxWorkers: number;
  statusNote?: string;
  warriorSlotsUsed?: number;
  warriorSlotsMax?: number;
  targetWarriors?: number;
  childrenInside?: string[];
  captivesCount?: number;
  canDemolish?: boolean;
  hp?: number;
  maxHp?: number;
}

export interface VillagerSnapshot {
  id: string;
  name: string;
  gender: Gender;
  appearance: VillagerAppearanceId;
  state: VillagerState;
  actionLabel: string;
  stats: VillagerStats;
  maxHealth: number;
  carrying: ResourceType | null;
  carryAmount: number;
  carryCapacity: number;
  isChild: boolean;
  age: number;
  lifeStage: LifeStage;
  isChief: boolean;
  hasWisdomBuff: boolean;
  hasChiefBuff: boolean;
  canElectChief: boolean;
  familyName: string;
  hasCraftedTools: boolean;
  warriorClass: WarriorClass | null;
  equippedWeapon: WeaponType | null;
  equippedArmor: ArmorType;
  birthsThisSeason: number;
  isFreeTime: boolean;
  isIdleFree: boolean;
  activeProfession: ProfessionId | null;
  activeProfessionLabel: string | null;
  activeProfessionLevel: number;
  activeProfessionXpRatio: number;
  assignedBuildingName: string | null;
  isDying: boolean;
}

export interface SelectionSummary {
  count: number;
  idleCount: number;
  warriorCount: number;
  workingCount: number;
  totalTribe: number;
  totalIdle: number;
  totalWarriors: number;
}

export type TreatyType = 'none' | 'non_aggression' | 'alliance' | 'war';

export interface RivalTribeSnapshot {
  id: string;
  nameUk: string;
  color: number;
  colorHex: string;
  discovered: boolean;
  alive: boolean;
  population: number;
  popCap: number;
  warriors: number;
  warriorsCount: number;
  buildingsCount: number;
  relationScore: number;
  attitudeUk: string;
  treaty: TreatyType;
  treatySeasonsLeft: number;
  interTribeStatusUk: string;
  resources: Record<ResourceType, number>;
}

export interface TradeRequest {
  tribeId: string;
  giveType: ResourceType;
  giveAmount: number;
  receiveType: ResourceType;
  receiveAmount: number;
}

export interface MinimapData {
  worldW: number;
  worldH: number;
  camX: number;
  camY: number;
  camW: number;
  camH: number;
  playerCamp: { x: number; y: number };
  lake: { x: number; y: number };
  riverPoints?: Array<{ x: number; y: number; radius: number; isFord: boolean }>;
  playerUnits: Array<{ x: number; y: number; isWarrior: boolean; selected: boolean }>;
  predators: Array<{ x: number; y: number }>;
  rivals: Array<{
    x: number;
    y: number;
    color: number;
    pop: number;
    alive: boolean;
    discovered: boolean;
    nameUk: string;
  }>;
  enemyUnits: Array<{ x: number; y: number; color: number; visible?: boolean }>;
  fogEnabled?: boolean;
}

export const STATE_LABELS_UK: Record<VillagerState, string> = {
  IDLE_WANDER: 'Гуляє біля багаття',
  FREE_TIME: 'Вільний час (відпочиває)',
  WARMING: 'Гріється біля вогню',
  SCRATCHING: 'Замислився',
  CHATTING: 'Спілкується',
  MOVING: 'Іде до цілі',
  MOVING_TO_RESOURCE: 'Іде до ресурсу',
  MOVING_TO_LAKE: 'Заходить у воду',
  MOVING_TO_HUNT: 'Переслідує здобич',
  MOVING_TO_CARCASS: 'Іде до туші звіра',
  MOVING_TO_BUILD: 'Іде на будівництво',
  MOVING_TO_WORK: 'Іде на роботу',
  MOVING_TO_NURSERY: 'Біжить у ясла',
  IN_NURSERY: 'У яслах (під наглядом)',
  CLEARING_STUMP: 'Корчує пеньок / кущ',
  MOVING_TO_CONVERT: 'Іде навернути чужинця',
  CONVERTING_ENEMY: 'Навертає чужинця (20 с)',
  GATHERING: 'Добуває ресурси',
  FISHING: 'Ловить рибу',
  HUNTING: 'Доганяє й бʼє звіра',
  BUTCHERING: 'Розбирає здобич',
  BUILDING: 'Будує споруду',
  WORKING_STATION: 'Працює на станції',
  RETURNING: 'Несе до складу',
  MOVING_TO_EAT_STORAGE: 'Іде поїсти зі складу',
  EATING_STORAGE: 'Їсть зі складу',
  EATING_BERRIES: 'Їсть ягоди з куща',
  MOVING_TO_SLEEP: 'Іде спати в хатину',
  SLEEPING_IN_HUT: 'Спить у хатині (Zzz)',
  MOVING_TO_BREED: 'Іде до хатини ❤️',
  BREEDING_IN_HUT: 'Кохання в хатині ❤️',
  CHILD_PLAYING: 'Грається',
  FLEEING_TO_CAMPFIRE: 'Тікає до вогнища (тривога!)',
  GRABBING_GEAR: 'Хапає зброю на оборону',
  COMBAT_CHASE: 'Кидається на ворога',
  COMBAT_ATTACK: 'У бою з ворогом!',
  PATROLLING: 'На сторожі (патрулює)',
  DYING_LYING: 'Спочиває на землі…',
  MOVING_TO_MOURN: 'Поспішає попрощатися',
  MOURNING_SITTING: 'Прощається поруч'
};

export const RESOURCE_LABELS_UK: Record<ResourceType, string> = {
  wood: 'Дерево',
  stone: 'Камінь',
  food: 'Їжа',
  bone: 'Кістки',
  hide: 'Шкури'
};
