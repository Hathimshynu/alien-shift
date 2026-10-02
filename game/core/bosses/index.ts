import type { GameSim } from "../sim";
import type { BossKind, Enemy } from "../types";
import { updateHunter } from "./hunter";
import { updateOmega } from "./omega";
import { updateSpider } from "./spider";
import { updateVexx } from "./vexx";

export interface BossInfo {
  name: string;
  /** Where it appears (bosses arrive from above). */
  spawn: [number, number, number];
  /** Health phases (the sim announces each one). */
  phases: number;
  /** Shift Cores for defeating it (before difficulty). */
  reward: number;
  update(sim: GameSim, e: Enemy): void;
}

export const BOSSES: Record<BossKind, BossInfo> = {
  vexx: { name: "Overlord Vexx", spawn: [0, 22, -1], phases: 3, reward: 25, update: updateVexx },
  spider: { name: "Arachnid Mk-IX", spawn: [0, 16, -3], phases: 3, reward: 30, update: updateSpider },
  hunter: { name: "Kraye the Hunter", spawn: [0, 10, -5], phases: 3, reward: 35, update: updateHunter },
  omega: { name: "The Void Sovereign", spawn: [0, 14, -5], phases: 3, reward: 60, update: updateOmega },
};

/** Below this share of health a boss enrages: faster attacks, red glow. */
export const ENRAGE_AT = 0.15;

const ORDER: BossKind[] = ["vexx", "spider", "hunter"];

/** Wave 5 → Vexx, 10 → spider mech, 15 → hunter, then the cycle repeats (tougher each time). */
export function bossForWave(wave: number): BossKind {
  return ORDER[(wave / 5 - 1) % ORDER.length];
}
