import type { AlienId, FormId } from "./types";

export interface FormStats {
  id: FormId;
  name: string;
  title: string;
  color: string;
  accent: string;
  w: number;
  h: number;
  speed: number;
  jump: number;
  airJumps: number;
  /** Damage taken multiplier (lower = tougher). */
  armor: number;
  attackCooldown: number;
  specialCost: number;
  specialCooldown: number;
  attackLabel: string;
  specialLabel: string;
  blurb: string;
}

export const FORMS: Record<FormId, FormStats> = {
  human: {
    id: "human",
    name: "Kai",
    title: "Watch Bearer",
    color: "#3b82f6",
    accent: "#22c55e",
    w: 26,
    h: 46,
    speed: 3.4,
    jump: 11.5,
    airJumps: 0,
    armor: 1,
    attackCooldown: 0.35,
    specialCost: 0,
    specialCooldown: 0,
    attackLabel: "Punch",
    specialLabel: "—",
    blurb: "Just a kid with a Shiftwatch. Recharges the watch while in human form.",
  },
  blaze: {
    id: "blaze",
    name: "Blaze",
    title: "Pyro Alien",
    color: "#f97316",
    accent: "#fde047",
    w: 34,
    h: 54,
    speed: 4,
    jump: 12,
    airJumps: 0,
    armor: 0.8,
    attackCooldown: 0.2,
    specialCost: 20,
    specialCooldown: 1.5,
    attackLabel: "Fireball",
    specialLabel: "Inferno Nova",
    blurb: "Hurls fireballs and erupts in a burning nova that scorches everything nearby.",
  },
  titan: {
    id: "titan",
    name: "Titan",
    title: "Stone Colossus",
    color: "#78716c",
    accent: "#fb923c",
    w: 52,
    h: 70,
    speed: 2.8,
    jump: 12.5,
    airJumps: 0,
    armor: 0.45,
    attackCooldown: 0.5,
    specialCost: 25,
    specialCooldown: 2.2,
    attackLabel: "Mega Punch",
    specialLabel: "Quake Slam",
    blurb: "Slow but nearly unbreakable. Punches send robots flying; slams split the ground.",
  },
  bolt: {
    id: "bolt",
    name: "Bolt",
    title: "Speed Alien",
    color: "#2563eb",
    accent: "#facc15",
    w: 28,
    h: 50,
    speed: 7.2,
    jump: 12,
    airJumps: 1,
    armor: 0.9,
    attackCooldown: 0.12,
    specialCost: 15,
    specialCooldown: 0.9,
    attackLabel: "Rapid Jabs",
    specialLabel: "Lightning Dash",
    blurb: "Blazing speed with a double jump. Dashes straight through enemies untouched.",
  },
  shard: {
    id: "shard",
    name: "Shard",
    title: "Crystal Alien",
    color: "#14b8a6",
    accent: "#a5f3fc",
    w: 34,
    h: 58,
    speed: 3.6,
    jump: 11.5,
    airJumps: 0,
    armor: 0.7,
    attackCooldown: 0.3,
    specialCost: 25,
    specialCooldown: 5,
    attackLabel: "Crystal Spread",
    specialLabel: "Prism Shield",
    blurb: "Fires a fan of crystal shards. Its shield blocks damage and reflects bullets.",
  },
};

export const ALIEN_ORDER: AlienId[] = ["blaze", "titan", "bolt", "shard"];
