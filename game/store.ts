import { create } from "zustand";
import { ALIEN_ORDER, FORMS } from "./core/forms";
import { MAX_LEVEL, STARTER_ALIENS, UPGRADE_COST } from "./core/progression";
import type { AlienId, FormId, HudState, Loadout } from "./core/types";
import { loadJSON, loadRaw, remove, saveJSON } from "./platform/storage";
import { QUALITY_LEVELS, type Quality } from "./quality";

export { QUALITY_LEVELS, type Quality } from "./quality";

export interface Settings {
  quality: Quality;
  muted: boolean;
  /** Skip the slow-motion transformation sequence. */
  skipTransform: boolean;
}

export interface SaveData {
  version: 2;
  highScore: number;
  /** Shift Cores available to spend. */
  cores: number;
  unlocked: AlienId[];
  /** Upgrade level per alien (1–5, missing = 1). */
  levels: Partial<Record<AlienId, number>>;
  /** The four aliens on the HUD watch dial. */
  favorites: AlienId[];
}

/** Which full-screen menu is open over the game (null = none). */
export type Screen = "upgrades" | null;

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
  hp: 100,
  maxHp: 100,
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
};

const DEFAULT_SAVE: SaveData = {
  version: 2,
  highScore: 0,
  cores: 0,
  unlocked: [...STARTER_ALIENS],
  levels: {},
  favorites: [...STARTER_ALIENS],
};

const isAlien = (id: unknown): id is AlienId => typeof id === "string" && (ALIEN_ORDER as string[]).includes(id);

/** Accept any older/partial save and return a valid v2 save. */
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
  return { version: 2, highScore: Number(r.highScore) || 0, cores: Math.max(0, Number(r.cores) || 0), unlocked, levels, favorites };
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

  setHud(hud: HudState): void;
  toggleFps(): void;
  setModels(models: string[]): void;
  setScreen(screen: Screen): void;
  setWheel(open: boolean): void;
  setWheelPick(id: AlienId | null): void;
  setQuality(quality: Quality): void;
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
    settings: { quality: "low", muted: false, skipTransform: false },
    save: DEFAULT_SAVE,
    hydrated: false,
    showFps: false,
    models: null,
    screen: null,
    wheelOpen: false,
    wheelPick: null,

    setHud: (hud) => set({ hud }),
    toggleFps: () => set({ showFps: !get().showFps }),
    setModels: (models) => set({ models }),
    setScreen: (screen) => set({ screen }),
    setWheel: (open) => set({ wheelOpen: open, wheelPick: open ? get().wheelPick : null }),
    setWheelPick: (id) => set({ wheelPick: id }),

    setQuality: (quality) => saveSettings({ ...get().settings, quality }),
    toggleMuted: () => saveSettings({ ...get().settings, muted: !get().settings.muted }),
    toggleSkipTransform: () => saveSettings({ ...get().settings, skipTransform: !get().settings.skipTransform }),

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
      return { unlocked: ["human", ...save.unlocked], levels, skipTransformCinematic: settings.skipTransform };
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
        };
        const save = migrateSave(storedSave);
        // Keep anything earned before hydration finished (score, cores picked up on the menu… unlikely but cheap).
        const current = get().save;
        save.highScore = Math.max(save.highScore, current.highScore, legacy);
        save.cores += current.cores;
        set({ settings, save, hydrated: true });

        if (legacy > 0 || storedSave?.version !== 2) {
          saveDirty = true;
          get().persistSave();
          if (legacy > 0) await remove(LEGACY_HIGH_SCORE_KEY);
        }
      })();
      return hydrating;
    },
  };
});
