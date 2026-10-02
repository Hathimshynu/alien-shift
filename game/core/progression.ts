import type { AgentStat, AlienId, FormId, Loadout } from "./types";

/*
 * Shift Cores and upgrades.
 *
 * Aliens have levels 1–5:
 *   damage +12% per level · watch drains 8% slower per level · special cooldown 8% shorter per level
 *   level 3 upgrades the 3-hit finisher into the alien's combo move.
 *
 * Kai (the human agent) has six upgrade tracks, also levels 1–5 (see AGENT_STATS).
 */
export const MAX_LEVEL = 5;
export const COMBO_MOVE_LEVEL = 3;
/** Cores needed to go from level n-1 to n (index = target level). */
export const UPGRADE_COST = [0, 0, 25, 50, 80, 120];
export const AGENT_UPGRADE_COST = [0, 0, 30, 60, 100, 150];

export const STARTER_ALIENS: AlienId[] = ["blaze", "titan", "bolt", "shard"];

export const damageMul = (level: number) => 1 + 0.12 * (level - 1);
export const drainMul = (level: number) => 1 - 0.08 * (level - 1);
export const specialCdMul = (level: number) => 1 - 0.08 * (level - 1);

export const levelOf = (loadout: Loadout, form: FormId) => Math.max(1, Math.min(MAX_LEVEL, loadout.levels[form] ?? 1));

export interface AgentStatDef {
  id: AgentStat;
  name: string;
  icon: string;
  /** What each level gives, for the upgrade screen. */
  perLevel: string;
}

export const AGENT_STATS: AgentStatDef[] = [
  { id: "health", name: "Health", icon: "❤️", perLevel: "+25 max HP" },
  { id: "damage", name: "Damage", icon: "⚔️", perLevel: "+12% gun and punch damage" },
  { id: "speed", name: "Speed", icon: "🏃", perLevel: "+6% run speed" },
  { id: "fireRate", name: "Fire Rate", icon: "🔫", perLevel: "+10% fire rate, −8% reload time" },
  { id: "power", name: "Power", icon: "⚡", perLevel: "+12% power damage, −8% power cooldowns" },
  { id: "mobility", name: "Jump & Dash", icon: "🦘", perLevel: "+5% jump height, −10% dodge cooldown (triple jump at level 4)" },
];

export const agentLevelOf = (loadout: Loadout, stat: AgentStat) => Math.max(1, Math.min(MAX_LEVEL, loadout.agent[stat] ?? 1));

export const DEFAULT_LOADOUT: Loadout = {
  unlocked: ["human", ...STARTER_ALIENS],
  levels: {},
  skipTransformCinematic: false,
  agent: {},
  weapons: ["pistol"],
  weapon: "pistol",
  powers: ["punch", "blast", "dash"],
  equippedPowers: ["punch", "blast", "dash"],
  difficulty: "normal",
};
