import type { Difficulty } from "./types";

/**
 * Game rules in one place — tweak these to rebalance. Enemy damage values live with each enemy
 * (enemies.ts) and boss (bosses/*.ts); they follow the tiers below and are then scaled by difficulty.
 */
export const RULES = {
  player: {
    /** Kai's base health (the Health upgrade adds to it). */
    maxHp: 200,
    healthPerUpgrade: 25,
    /** Health regenerates after this long without taking damage… */
    regenDelay: 5,
    /** …at this many HP per second (scaled by difficulty; Nightmare has none). */
    regenPerSec: 4,
    /** Invulnerability after a hit, so a crowd can't drain all HP in one moment. */
    hurtInvuln: 0.9,
    /** Health orbs heal this much. */
    healthOrb: 35,
  },
  /** Reference damage tiers (before difficulty). */
  damage: {
    normal: [10, 15],
    elite: [20, 30],
    boss: [35, 50],
  },
  /** Chance that a defeated robot drops a health orb (scaled by difficulty). */
  healthDropChance: 0.1,
} as const;

export interface DifficultyDef {
  label: string;
  blurb: string;
  enemyHp: number;
  enemyDmg: number;
  enemySpeed: number;
  /** Extra enemies per wave (multiplier). */
  spawn: number;
  /** Boss/hazard telegraph time multiplier (longer = easier to react). */
  telegraph: number;
  /** Boss attack gap multiplier (smaller = attacks come faster). */
  bossGap: number;
  regen: number;
  /** Chance a regular robot spawns as an elite variant. */
  eliteChance: number;
  rewards: number;
  healthDrops: number;
  /** Bosses skip their first, gentlest attack pattern set. */
  bossStartsAngry: boolean;
  /** Robots that shoot fire one extra projectile per volley. */
  extraShots: boolean;
}

/**
 * Difficulty changes behaviour, not just numbers: telegraphs get shorter, elites appear,
 * regeneration and health drops shrink, bosses skip their warm-up patterns and shooters add shots.
 */
export const DIFFICULTY: Record<Difficulty, DifficultyDef> = {
  easy: {
    label: "Easy",
    blurb: "Gentler robots, long warnings before big attacks, fast healing.",
    enemyHp: 0.75, enemyDmg: 0.6, enemySpeed: 0.9, spawn: 0.8, telegraph: 1.4, bossGap: 1.25,
    regen: 1.75, eliteChance: 0, rewards: 0.8, healthDrops: 1.6, bossStartsAngry: false, extraShots: false,
  },
  normal: {
    label: "Normal",
    blurb: "The intended challenge.",
    enemyHp: 1, enemyDmg: 1, enemySpeed: 1, spawn: 1, telegraph: 1, bossGap: 1,
    regen: 1, eliteChance: 0.06, rewards: 1, healthDrops: 1, bossStartsAngry: false, extraShots: false,
  },
  hard: {
    label: "Hard",
    blurb: "Tougher, faster robots, more elites, quicker boss attacks, slow healing.",
    enemyHp: 1.3, enemyDmg: 1.25, enemySpeed: 1.1, spawn: 1.25, telegraph: 0.85, bossGap: 0.85,
    regen: 0.5, eliteChance: 0.15, rewards: 1.35, healthDrops: 0.75, bossStartsAngry: false, extraShots: true,
  },
  nightmare: {
    label: "Nightmare",
    blurb: "No regeneration, elites everywhere, bosses start angry, short warnings.",
    enemyHp: 1.6, enemyDmg: 1.5, enemySpeed: 1.2, spawn: 1.5, telegraph: 0.7, bossGap: 0.7,
    regen: 0, eliteChance: 0.3, rewards: 1.8, healthDrops: 0.5, bossStartsAngry: true, extraShots: true,
  },
};

export const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard", "nightmare"];
