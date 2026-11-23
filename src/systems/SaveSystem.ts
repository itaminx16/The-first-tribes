import {
  AncestorRecord,
  ArmorType,
  BuildingType,
  GameSetupConfig,
  Gender,
  MAP_PRESETS,
  ProfessionId,
  ResourceType,
  SEASON_LABELS_UK,
  Season,
  TechState,
  TreatyType,
  TribeResources,
  VillagerAppearanceId,
  VillagerDeeds,
  VillagerStats,
  WarriorClass,
  WeaponType,
} from '../types/game';

const SAVES_LIST_KEY = 'first_tribes_saves_v2';
const LEGACY_SAVE_KEY = 'first_tribes_save_v1';
export const MAX_SAVE_SLOTS = 5;

export interface SavedHut {
  x: number;
  y: number;
  isLarge: boolean;
  progress: number;
}

export interface SavedBuilding {
  id: string;
  type: Exclude<BuildingType, 'hut' | 'large_hut'>;
  x: number;
  y: number;
  progress: number;
  hp: number;
  targetWarriors: number;
  angle?: number;
}

export interface SavedVillager {
  id: string;
  name: string;
  gender: Gender;
  appearance: VillagerAppearanceId;
  x: number;
  y: number;
  age: number;
  stats: VillagerStats;
  isChief: boolean;
  hasCraftedTools: boolean;
  warriorClass: WarriorClass | null;
  equippedWeapon: WeaponType | null;
  equippedArmor: ArmorType;
  familyId: string;
  familyName: string;
  spouseId: string | null;
  spouseName: string | null;
  parentNames: string[];
  childrenNames: string[];
  bornYear: number;
  birthsThisSeason: number;
  assignedBuildingId: string | null;
  skills: Record<ProfessionId, { level: number; xp: number }>;
  deeds: VillagerDeeds;
}

export interface SavedRivalCamp {
  id: string;
  x?: number;
  y?: number;
  population: number;
  popCap: number;
  resources: Record<ResourceType, number>;
  hp: number;
  alive: boolean;
  discovered: boolean;
  treaty: TreatyType;
  treatySeasonsLeft: number;
  relationScore: number;
}

export interface SavedGameData {
  version: 1;
  slotId?: number;
  savedAt: number;
  config: GameSetupConfig;
  seasonIndex: number;
  season: Season;
  year: number;
  seasonsPassed?: number;
  playerBaseX?: number;
  playerBaseY?: number;
  seasonElapsedMs: number;
  springRipened: boolean;
  resources: TribeResources;
  storageCap: number;
  populationCap: number;
  warriorCap: number;
  techLevels: TechState;
  chiefId: string | null;
  ancestors: AncestorRecord[];
  huts: SavedHut[];
  buildings: SavedBuilding[];
  villagers: SavedVillager[];
  rivals: SavedRivalCamp[];
}

export interface SaveSummary {
  slotId: number;
  savedAt: number;
  dateStrUk: string;
  mapNameUk: string;
  year: number;
  season: Season;
  seasonUk: string;
  pop: number;
}

type SlotsRecord = Partial<Record<number, SavedGameData>>;

function formatSaveDateUk(ts: number): string {
  try {
    const d = new Date(ts);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '';
  }
}

function readAllSlotsRecord(): SlotsRecord {
  try {
    const raw = localStorage.getItem(SAVES_LIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SlotsRecord;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    }
    // Migrate legacy single-slot save into Slot 1 if present
    const legacyRaw = localStorage.getItem(LEGACY_SAVE_KEY);
    if (legacyRaw) {
      const legacy = JSON.parse(legacyRaw) as SavedGameData;
      if (legacy && legacy.version === 1 && legacy.config) {
        legacy.slotId = 1;
        const migrated: SlotsRecord = { 1: legacy };
        localStorage.setItem(SAVES_LIST_KEY, JSON.stringify(migrated));
        return migrated;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return {};
}

function writeAllSlotsRecord(rec: SlotsRecord): boolean {
  try {
    localStorage.setItem(SAVES_LIST_KEY, JSON.stringify(rec));
    return true;
  } catch {
    return false;
  }
}

export function saveGameToSlot(slotId: number, data: SavedGameData): boolean {
  const rec = readAllSlotsRecord();
  rec[slotId] = { ...data, slotId };
  return writeAllSlotsRecord(rec);
}

export function loadGameFromSlot(slotId: number): SavedGameData | null {
  const rec = readAllSlotsRecord();
  return rec[slotId] ?? null;
}

export function deleteSaveSlot(slotId: number): boolean {
  const rec = readAllSlotsRecord();
  if (!rec[slotId]) return false;
  delete rec[slotId];
  try {
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch {
    // Ignore
  }
  return writeAllSlotsRecord(rec);
}

export function getAllSaveSummaries(): Array<SaveSummary | null> {
  const rec = readAllSlotsRecord();
  const out: Array<SaveSummary | null> = [];
  for (let slot = 1; slot <= MAX_SAVE_SLOTS; slot++) {
    const data = rec[slot];
    if (!data) {
      out.push(null);
      continue;
    }
    const preset = MAP_PRESETS[data.config.mapId] ?? MAP_PRESETS.river_valley;
    out.push({
      slotId: slot,
      savedAt: data.savedAt,
      dateStrUk: formatSaveDateUk(data.savedAt),
      mapNameUk: preset.nameUk,
      year: data.year,
      season: data.season,
      seasonUk: SEASON_LABELS_UK[data.season] ?? data.season,
      pop: data.villagers.length,
    });
  }
  return out;
}
