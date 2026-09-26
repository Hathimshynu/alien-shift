import { create } from "zustand";
import type { HudState } from "./core/types";
import { loadJSON, loadRaw, remove, saveJSON } from "./platform/storage";

export type Quality = "low" | "medium" | "high";
export const QUALITY_LEVELS: Quality[] = ["low", "medium", "high"];
/** Max device-pixel-ratio per quality level (the biggest single lever for GPU cost). */
export const QUALITY_DPR: Record<Quality, number> = { low: 1, medium: 1.5, high: 2 };

export interface Settings {
  quality: Quality;
  muted: boolean;
}

export interface SaveData {
  version: 1;
  highScore: number;
}

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
  wave: 0,
  score: 0,
  combo: 0,
  enemiesLeft: 0,
  bossHp: null,
  specialReady: false,
};

interface GameStore {
  /** Latest simulation snapshot (pushed ~10×/s). Components should select single fields. */
  hud: HudState;
  settings: Settings;
  save: SaveData;
  hydrated: boolean;

  setHud(hud: HudState): void;
  setQuality(quality: Quality): void;
  toggleMuted(): void;
  /** Raise the in-memory high score if beaten; call `persistSave` to write it out. */
  recordScore(score: number): void;
  persistSave(): void;
  /** Load settings + save data from storage. Safe to call more than once. */
  hydrate(): Promise<void>;
}

let saveDirty = false;
let hydrating: Promise<void> | null = null;

export const useGameStore = create<GameStore>()((set, get) => ({
  hud: INITIAL_HUD,
  // Real values arrive in hydrate(); "low" is the safe default until then (also during prerender).
  settings: { quality: "low", muted: false },
  save: { version: 1, highScore: 0 },
  hydrated: false,

  setHud: (hud) => set({ hud }),

  setQuality: (quality) => {
    const settings = { ...get().settings, quality };
    set({ settings });
    void saveJSON(SETTINGS_KEY, settings); // only explicit choices are remembered
  },

  toggleMuted: () => {
    const settings = { ...get().settings, muted: !get().settings.muted };
    set({ settings });
    void saveJSON(SETTINGS_KEY, settings);
  },

  recordScore: (score) => {
    if (score <= get().save.highScore) return;
    saveDirty = true;
    set({ save: { ...get().save, highScore: score } });
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
      };
      // Keep whichever is higher: a score earned before hydration finished, the save, or the legacy key.
      const highScore = Math.max(get().save.highScore, Number(storedSave?.highScore) || 0, legacy);
      set({ settings, save: { version: 1, highScore }, hydrated: true });

      if (legacy > 0) {
        saveDirty = true;
        get().persistSave();
        await remove(LEGACY_HIGH_SCORE_KEY);
      }
    })();
    return hydrating;
  },
}));
