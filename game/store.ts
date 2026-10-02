import { create } from "zustand";
import { ALIEN_ORDER, FORMS } from "./core/forms";
import { LEVELS } from "./core/levels";
import { POWERS, POWER_ORDER } from "./core/powers";
import { AGENT_STATS, AGENT_UPGRADE_COST, DEFAULT_LOADOUT, MAX_LEVEL, STARTER_ALIENS, UPGRADE_COST } from "./core/progression";
import { DIFFICULTIES } from "./core/rules";
import type { AgentStat, AlienId, Difficulty, FormId, GameMode, HudState, LevelResult, Loadout, PowerId, WeaponId } from "./core/types";
import { WEAPONS, WEAPON_ORDER } from "./core/weapons";
import { loadJSON, loadRaw, remove, saveJSON } from "./platform/storage";
import { QUALITY_LEVELS, type Quality } from "./quality";

export { QUALITY_LEVELS, type Quality } from "./quality";

export interface Settings {
  quality: Quality;
  muted: boolean;
  /** Skip the slow-motion transformation sequence. */
  skipTransform: boolean;
  difficulty: Difficulty;
}

/** Best result per campaign level. */
export interface LevelRecord {
  cleared: boolean;
  bestTime: number;
  /** Indices of the data shards found (ever). */
  shards: number[];
}

export interface SaveData {
  version: 3;
  highScore: number;
  /** Shift Cores available to spend. */
  cores: number;
  unlocked: AlienId[];
  /** Upgrade level per alien (1–5, missing = 1). */
  levels: Partial<Record<AlienId, number>>;
  /** The four aliens on the HUD watch dial. */
  favorites: AlienId[];
  /** Kai's upgrade levels (1–5). */
  agent: Partial<Record<AgentStat, number>>;
  weapons: WeaponId[];
  weapon: WeaponId;
  powers: PowerId[];
  /** The three powers on the E / R / T buttons. */
  equippedPowers: PowerId[];
  /** Highest campaign level that can be played (1–10). */
  unlockedLevel: number;
  levelRecords: Record<number, LevelRecord>;
}

/** Which full-screen menu is open over the game (null = none). */
export type Screen = "upgrades" | "levels" | null;

const SETTINGS_KEY = "alien-shift:settings";
const SAVE_KEY = "alien-shift:save";
/** Pre-Phase-0 builds stored only the high score, under this key. */
const LEGACY_HIGH_SCORE_KEY = "alien-shift:high-score";

type NavigatorHints = Navigator & { deviceMemory?: number; userAgentData?: { mobile?: boolean } };

/** Pick "low" on weak or mobile devices so the first launch is smooth; "medium" otherwise. */
export function detectDefaultQuality(): Quality {
  if (typeof navigator === "undefined") return "low";
  const nav = navigator as NavigatorHints;
  const mobile = nav.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(nav.userAgent);
  const lowMemory = (nav.deviceMemory ?? 8) <= 4;
  const fewCores = (nav.hardwareConcurrency ?? 8) <= 4;
  return mobile || lowMemory || fewCores ? "low" : "medium";
}

export const INITIAL_HUD: HudState = {
  status: "menu",
  form: "human",
  hp: 200,
  maxHp: 200,
  energy: 100,
  watchLocked: false,
  transformReady: true,
  ult: 0,
  dodgeReady: true,
  wave: 0,
  score: 0,
  combo: 0,
  enemiesLeft: 0,
  boss: null,
  specialReady: false,
  runCores: 0,
  banner: "",
  cinematicTitle: "",
  blizzard: false,
  mode: "endless",
  level: 0,
  levelName: "",
  objective: "",
  stage: 0,
  stages: 0,
  shards: 0,
  shardsTotal: 0,
  weapon: "pistol",
  ammo: 12,
  magazine: 12,
  reloading: 0,
  powers: [],
  timeFreeze: false,
  result: null,
  hitMarker: 0,
};

const DEFAULT_SAVE: SaveData = {
  version: 3,
  highScore: 0,
  cores: 0,
  unlocked: [...STARTER_ALIENS],
  levels: {},
  favorites: [...STARTER_ALIENS],
  agent: {},
  weapons: [...DEFAULT_LOADOUT.weapons],
  weapon: DEFAULT_LOADOUT.weapon,
  powers: [...DEFAULT_LOADOUT.powers],
  equippedPowers: [...DEFAULT_LOADOUT.equippedPowers],
  unlockedLevel: 1,
  levelRecords: {},
};

const isAlien = (id: unknown): id is AlienId => typeof id === "string" && (ALIEN_ORDER as string[]).includes(id);

const isWeapon = (id: unknown): id is WeaponId => typeof id === "string" && (WEAPON_ORDER as string[]).includes(id);
const isPower = (id: unknown): id is PowerId => typeof id === "string" && (POWER_ORDER as string[]).includes(id);

/** Accept any older/partial save and return a valid v3 save (older saves keep everything they had). */
function migrateSave(raw: Partial<SaveData> | { version?: number; highScore?: number } | null): SaveData {
  const r = (raw ?? {}) as Partial<SaveData>;
  const unlocked = Array.from(new Set([...STARTER_ALIENS, ...(Array.isArray(r.unlocked) ? r.unlocked.filter(isAlien) : [])]));
  const levels: SaveData["levels"] = {};
  for (const id of ALIEN_ORDER) {
    const lvl = Number(r.levels?.[id]);
    if (lvl > 1) levels[id] = Math.min(MAX_LEVEL, Math.floor(lvl));
  }
  const favorites = (Array.isArray(r.favorites) ? r.favorites.filter(isAlien) : []).slice(0, 4);
  for (const id of STARTER_ALIENS) if (favorites.length < 4 && !favorites.includes(id)) favorites.push(id);
  const agent: SaveData["agent"] = {};
  for (const st of AGENT_STATS) {
    const lvl = Number(r.agent?.[st.id]);
    if (lvl > 1) agent[st.id] = Math.min(MAX_LEVEL, Math.floor(lvl));
  }
  const weapons = Array.from(new Set(["pistol" as WeaponId, ...(Array.isArray(r.weapons) ? r.weapons.filter(isWeapon) : [])]));
  const weapon = isWeapon(r.weapon) && weapons.includes(r.weapon) ? r.weapon : "pistol";
  const powers = Array.from(new Set([...DEFAULT_LOADOUT.powers, ...(Array.isArray(r.powers) ? r.powers.filter(isPower) : [])]));
  const equipped = Array.isArray(r.equippedPowers) ? r.equippedPowers.filter((p) => isPower(p) && powers.includes(p)) : [];
  const equippedPowers = Array.from(new Set(equipped)).slice(0, 3);
  for (const p of powers) if (equippedPowers.length < 3 && !equippedPowers.includes(p)) equippedPowers.push(p);
  const unlockedLevel = Math.max(1, Math.min(LEVELS.length, Math.floor(Number(r.unlockedLevel) || 1)));
  const levelRecords: SaveData["levelRecords"] = {};
  for (const l of LEVELS) {
    const rec = r.levelRecords?.[l.id];
    if (!rec) continue;
    levelRecords[l.id] = {
      cleared: rec.cleared === true,
      bestTime: Number(rec.bestTime) || 0,
      shards: Array.isArray(rec.shards) ? rec.shards.filter((i) => Number.isInteger(i) && i >= 0 && i < l.shards.length) : [],
    };
  }
  return {
    version: 3, highScore: Number(r.highScore) || 0, cores: Math.max(0, Number(r.cores) || 0), unlocked, levels, favorites,
    agent, weapons, weapon, powers, equippedPowers, unlockedLevel, levelRecords,
  };
}

interface GameStore {
  /** Latest simulation snapshot (pushed ~10×/s). Components should select single fields. */
  hud: HudState;
  settings: Settings;
  save: SaveData;
  hydrated: boolean;
  /** Debug overlay (F3). Not persisted. */
  showFps: boolean;
  /** Form ids that have a real model in /public/models (from manifest.json); null until loaded. */
  models: string[] | null;
  screen: Screen;
  /** Watch wheel open (time slows) and the alien currently highlighted on it. */
  wheelOpen: boolean;
  wheelPick: AlienId | null;
  /** What START plays: the campaign level picked on the level select, or Endless. */
  mode: GameMode;
  selectedLevel: number;

  setHud(hud: HudState): void;
  toggleFps(): void;
  setModels(models: string[]): void;
  setScreen(screen: Screen): void;
  setWheel(open: boolean): void;
  setWheelPick(id: AlienId | null): void;
  setQuality(quality: Quality): void;
  setDifficulty(d: Difficulty): void;
  /** Choose what START plays. */
  selectMode(mode: GameMode, level?: number): void;
  upgradeAgent(stat: AgentStat): boolean;
  buyWeapon(id: WeaponId): boolean;
  equipWeapon(id: WeaponId): void;
  buyPower(id: PowerId): boolean;
  /** Put a power on button 0–2 (swaps if it is already on another). */
  equipPower(slot: number, id: PowerId): void;
  /** A campaign level was finished: records it and unlocks the next level. */
  recordLevel(result: LevelResult): void;
  recordShard(level: number, index: number): void;
  toggleMuted(): void;
  toggleSkipTransform(): void;
  /** Raise the in-memory high score if beaten; call `persistSave` to write it out. */
  recordScore(score: number): void;
  addCores(amount: number): void;
  /** Spend cores; each returns false if unaffordable / not allowed. */
  unlockAlien(id: AlienId): boolean;
  upgradeAlien(id: AlienId): boolean;
  /** Put an alien on dial slot 0–3. */
  setFavorite(slot: number, id: AlienId): void;
  /** What the simulation needs from the save when a run starts. */
  loadout(): Loadout;
  persistSave(): void;
  /** Load settings + save data from storage. Safe to call more than once. */
  hydrate(): Promise<void>;
}

let saveDirty = false;
let hydrating: Promise<void> | null = null;

export const levelOfAlien = (save: SaveData, id: AlienId) => save.levels[id] ?? 1;
export const unlockCost = (id: AlienId) => FORMS[id].unlockCost;
/** Cost of the next level, or null at max level. */
export const nextUpgradeCost = (save: SaveData, id: AlienId) => {
  const lvl = levelOfAlien(save, id);
  return lvl >= MAX_LEVEL ? null : UPGRADE_COST[lvl + 1];
};

export const agentLevel = (save: SaveData, stat: AgentStat) => save.agent[stat] ?? 1;
export const nextAgentCost = (save: SaveData, stat: AgentStat) => {
  const lvl = agentLevel(save, stat);
  return lvl >= MAX_LEVEL ? null : AGENT_UPGRADE_COST[lvl + 1];
};
/** Highest campaign level cleared (0 = none) — guns and powers need levels cleared first. */
export const levelsCleared = (save: SaveData) => LEVELS.reduce((m, l) => (save.levelRecords[l.id]?.cleared ? Math.max(m, l.id) : m), 0);

export const useGameStore = create<GameStore>()((set, get) => {
  const saveNow = (save: SaveData) => {
    set({ save });
    saveDirty = true;
    get().persistSave();
  };
  const saveSettings = (settings: Settings) => {
    set({ settings });
    void saveJSON(SETTINGS_KEY, settings); // only explicit choices are remembered
  };

  return {
    hud: INITIAL_HUD,
    // Real values arrive in hydrate(); "low" is the safe default until then (also during prerender).
    settings: { quality: "low", muted: false, skipTransform: false, difficulty: "normal" },
    save: DEFAULT_SAVE,
    hydrated: false,
    showFps: false,
    models: null,
    screen: null,
    wheelOpen: false,
    wheelPick: null,
    mode: "campaign",
    selectedLevel: 1,

    setHud: (hud) => set({ hud }),
    toggleFps: () => set({ showFps: !get().showFps }),
    setModels: (models) => set({ models }),
    setScreen: (screen) => set({ screen }),
    setWheel: (open) => set({ wheelOpen: open, wheelPick: open ? get().wheelPick : null }),
    setWheelPick: (id) => set({ wheelPick: id }),

    setQuality: (quality) => saveSettings({ ...get().settings, quality }),
    toggleMuted: () => saveSettings({ ...get().settings, muted: !get().settings.muted }),
    toggleSkipTransform: () => saveSettings({ ...get().settings, skipTransform: !get().settings.skipTransform }),
    setDifficulty: (difficulty) => saveSettings({ ...get().settings, difficulty }),
    selectMode: (mode, level) => {
      const max = get().save.unlockedLevel;
      set({ mode, selectedLevel: Math.max(1, Math.min(max, level ?? get().selectedLevel)) });
    },

    upgradeAgent: (stat) => {
      const save = get().save;
      const cost = nextAgentCost(save, stat);
      if (cost === null || save.cores < cost) return false;
      saveNow({ ...save, cores: save.cores - cost, agent: { ...save.agent, [stat]: agentLevel(save, stat) + 1 } });
      return true;
    },

    buyWeapon: (id) => {
      const save = get().save;
      const w = WEAPONS[id];
      if (save.weapons.includes(id) || save.cores < w.cost || levelsCleared(save) < w.requiresLevel) return false;
      saveNow({ ...save, cores: save.cores - w.cost, weapons: [...save.weapons, id], weapon: id });
      return true;
    },

    equipWeapon: (id) => {
      const save = get().save;
      if (save.weapons.includes(id)) saveNow({ ...save, weapon: id });
    },

    buyPower: (id) => {
      const save = get().save;
      const pw = POWERS[id];
      if (save.powers.includes(id) || save.cores < pw.cost || levelsCleared(save) < pw.requiresLevel) return false;
      saveNow({ ...save, cores: save.cores - pw.cost, powers: [...save.powers, id] });
      return true;
    },

    equipPower: (slot, id) => {
      const save = get().save;
      if (!save.powers.includes(id)) return;
      const eq = [...save.equippedPowers];
      const existing = eq.indexOf(id);
      if (existing >= 0) eq[existing] = eq[slot];
      eq[slot] = id;
      saveNow({ ...save, equippedPowers: eq });
    },

    recordLevel: (result) => {
      const save = get().save;
      const prev = save.levelRecords[result.levelId];
      const rec: LevelRecord = {
        cleared: true,
        bestTime: prev?.cleared && prev.bestTime > 0 ? Math.min(prev.bestTime, result.time) : result.time,
        shards: prev?.shards ?? [],
      };
      const unlockedLevel = Math.min(LEVELS.length, Math.max(save.unlockedLevel, result.levelId + 1));
      saveNow({ ...save, unlockedLevel, levelRecords: { ...save.levelRecords, [result.levelId]: rec } });
    },

    recordShard: (level, index) => {
      const save = get().save;
      const prev = save.levelRecords[level] ?? { cleared: false, bestTime: 0, shards: [] };
      if (prev.shards.includes(index)) return;
      saveDirty = true;
      set({ save: { ...save, levelRecords: { ...save.levelRecords, [level]: { ...prev, shards: [...prev.shards, index] } } } });
    },

    recordScore: (score) => {
      if (score <= get().save.highScore) return;
      saveDirty = true;
      set({ save: { ...get().save, highScore: score } });
    },

    addCores: (amount) => {
      saveDirty = true;
      set({ save: { ...get().save, cores: get().save.cores + amount } });
    },

    unlockAlien: (id) => {
      const save = get().save;
      if (save.unlocked.includes(id) || save.cores < unlockCost(id)) return false;
      saveNow({ ...save, cores: save.cores - unlockCost(id), unlocked: [...save.unlocked, id] });
      return true;
    },

    upgradeAlien: (id) => {
      const save = get().save;
      const cost = nextUpgradeCost(save, id);
      if (!save.unlocked.includes(id) || cost === null || save.cores < cost) return false;
      saveNow({ ...save, cores: save.cores - cost, levels: { ...save.levels, [id]: levelOfAlien(save, id) + 1 } });
      return true;
    },

    setFavorite: (slot, id) => {
      const save = get().save;
      const favorites = [...save.favorites];
      // If the alien is already on the dial, swap the two slots.
      const existing = favorites.indexOf(id);
      if (existing >= 0) favorites[existing] = favorites[slot];
      favorites[slot] = id;
      saveNow({ ...save, favorites });
    },

    loadout: () => {
      const { save, settings } = get();
      const levels: Loadout["levels"] = {};
      for (const [id, lvl] of Object.entries(save.levels)) levels[id as FormId] = lvl;
      return {
        unlocked: ["human", ...save.unlocked],
        levels,
        skipTransformCinematic: settings.skipTransform,
        agent: { ...save.agent },
        weapons: [...save.weapons],
        weapon: save.weapon,
        powers: [...save.powers],
        equippedPowers: [...save.equippedPowers],
        difficulty: settings.difficulty,
      };
    },

    persistSave: () => {
      if (!saveDirty) return;
      saveDirty = false;
      void saveJSON(SAVE_KEY, get().save);
    },

    hydrate: () => {
      hydrating ??= (async () => {
        const storedSettings = await loadJSON<Partial<Settings>>(SETTINGS_KEY);
        const storedSave = await loadJSON<Partial<SaveData>>(SAVE_KEY);
        const legacy = Number(await loadRaw(LEGACY_HIGH_SCORE_KEY)) || 0;

        const quality = storedSettings?.quality;
        const settings: Settings = {
          quality: quality && QUALITY_LEVELS.includes(quality) ? quality : detectDefaultQuality(),
          muted: storedSettings?.muted === true,
          skipTransform: storedSettings?.skipTransform === true,
          difficulty: storedSettings?.difficulty && DIFFICULTIES.includes(storedSettings.difficulty) ? storedSettings.difficulty : "normal",
        };
        const save = migrateSave(storedSave);
        // Keep anything earned before hydration finished (score, cores picked up on the menu… unlikely but cheap).
        const current = get().save;
        save.highScore = Math.max(save.highScore, current.highScore, legacy);
        save.cores += current.cores;
        set({ settings, save, hydrated: true, selectedLevel: save.unlockedLevel });

        if (legacy > 0 || storedSave?.version !== 3) {
          saveDirty = true;
          get().persistSave();
          if (legacy > 0) await remove(LEGACY_HIGH_SCORE_KEY);
        }
      })();
      return hydrating;
    },
  };
});
