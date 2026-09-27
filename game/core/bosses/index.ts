import type { GameSim } from "../sim";
import type { BossKind, Enemy } from "../types";
import { updateHunter } from "./hunter";
import { updateSpider } from "./spider";
import { updateVexx } from "./vexx";

export interface BossInfo {
  name: string;
  /** Where it appears (bosses arrive from above). */
  spawn: [number, number, number];
  update(sim: GameSim, e: Enemy): void;
}

export const BOSSES: Record<BossKind, BossInfo> = {
  vexx: { name: "Overlord Vexx", spawn: [0, 22, -1], update: updateVexx },
  spider: { name: "Arachnid Mk-IX", spawn: [0, 16, -3], update: updateSpider },
  hunter: { name: "Kraye the Hunter", spawn: [0, 10, -5], update: updateHunter },
};

const ORDER: BossKind[] = ["vexx", "spider", "hunter"];

/** Wave 5 → Vexx, 10 → spider mech, 15 → hunter, then the cycle repeats (tougher each time). */
export function bossForWave(wave: number): BossKind {
  return ORDER[(wave / 5 - 1) % ORDER.length];
}
