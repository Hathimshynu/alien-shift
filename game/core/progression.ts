import type { AlienId, FormId, Loadout } from "./types";

/*
 * Shift Cores and alien upgrades. Every alien has levels 1–5:
 *   damage +12% per level · watch drains 8% slower per level · special cooldown 8% shorter per level
 *   level 3 upgrades the 3-hit finisher into the alien's combo move.
 */
export const MAX_LEVEL = 5;
export const COMBO_MOVE_LEVEL = 3;
/** Cores needed to go from level n-1 to n (index = target level). */
export const UPGRADE_COST = [0, 0, 25, 50, 80, 120];

export const STARTER_ALIENS: AlienId[] = ["blaze", "titan", "bolt", "shard"];

export const damageMul = (level: number) => 1 + 0.12 * (level - 1);
export const drainMul = (level: number) => 1 - 0.08 * (level - 1);
export const specialCdMul = (level: number) => 1 - 0.08 * (level - 1);

export const levelOf = (loadout: Loadout, form: FormId) => Math.max(1, Math.min(MAX_LEVEL, loadout.levels[form] ?? 1));

export const DEFAULT_LOADOUT: Loadout = {
  unlocked: ["human", ...STARTER_ALIENS],
  levels: {},
  skipTransformCinematic: false,
};
