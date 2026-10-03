import type { ArenaBox } from "./arena";
import type { BossKind, EnemyKind } from "./types";

/*
 * The campaign: 10 levels, each a set of stages (= checkpoints) on its own arena layout, theme and
 * hazards. All coordinates are metres inside the arena (x −20…20, z −11…11; +z is towards the camera).
 */

export type ThemeId = "city" | "crash" | "ruins" | "colony" | "facility" | "hive" | "frozen" | "desert" | "station" | "fortress" | "dimension";

/** Where a wave appears: street ends (default), right around Kai (ambush), dropped from the sky, or far away. */
export type SpawnMode = "edges" | "ambush" | "sky" | "far";

export interface WaveDef {
  enemies: [EnemyKind, number][];
  spawn?: SpawnMode;
}

export type StageDef =
  | { kind: "waves"; title: string; waves: WaveDef[] }
  | { kind: "survive"; title: string; seconds: number; pool: EnemyKind[]; every: number; max: number }
  /** Destroy every nest (stationary robot factories that keep spawning) while escorts attack. */
  | { kind: "destroy"; title: string; nests: [number, number, number][]; spawns: EnemyKind[]; escorts?: WaveDef }
  | { kind: "boss"; title: string; boss: BossKind; adds?: WaveDef };

export type HazardDef =
  /** Ground vents that erupt in turn after a warning circle. */
  | { kind: "vents"; spots: [number, number][]; period: number; dmg: number }
  /** Security laser pylons that sweep the floor. */
  | { kind: "lasers"; pylons: [number, number][]; period: number; dmg: number; length: number }
  /** Meteor showers aimed near Kai. */
  | { kind: "meteors"; period: number; count: number; dmg: number }
  /** Fixed gun turrets (destructible robots that don't move). */
  | { kind: "turrets"; spots: [number, number, number][] };

export interface LevelDef {
  id: number;
  name: string;
  subtitle: string;
  theme: ThemeId;
  /** Short tutorial / briefing lines shown as banners at the start. */
  briefing: string[];
  platforms: ArenaBox[];
  solids: ArenaBox[];
  /** Movement modifiers: gravity multiplier (station) and ground grip (ice). */
  gravity?: number;
  traction?: number;
  /** Dim lights (facility). */
  dark?: boolean;
  stages: StageDef[];
  hazards: HazardDef[];
  /** Hidden data shards (collectibles): x, y, z. */
  shards: [number, number, number][];
  /** Shift Cores for finishing the level (before difficulty). */
  reward: number;
}

const THICK = 0.35;
const slab = (x: number, z: number, top: number, w: number, d: number): ArenaBox => ({ kind: "platform", x, z, y: top - THICK, w, h: THICK, d, color: "#334155" });
const box = (kind: ArenaBox["kind"], x: number, z: number, w: number, h: number, d: number, color: string, y = 0): ArenaBox => ({ kind, x, z, y, w, h, d, color });
const crate = (x: number, z: number, s = 1.2, y = 0) => box("crate", x, z, s, s, s, "#92400e", y);
const rock = (x: number, z: number, w: number, h: number, d: number, color = "#57534e") => box("rock", x, z, w, h, d, color);
const pillar = (x: number, z: number, s: number, h: number, color = "#78716c") => box("pillar", x, z, s, h, s, color);

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    name: "Crash Site",
    subtitle: "Training under fire",
    theme: "crash",
    briefing: ["MOVE: WASD / left stick", "JUMP: SPACE / JUMP — twice to double-jump and spin", "SHOOT: J / mouse / hold SHOOT", "POWERS: E R T / the round power buttons"],
    platforms: [slab(-9, -6.5, 1.5, 6, 3.5), slab(9, -6.5, 1.5, 6, 3.5), slab(0, -8.8, 3, 7, 3)],
    solids: [rock(-4, 4, 3.2, 1.3, 1.8, "#3f3f46"), rock(7, 1, 2.6, 1.6, 2.2, "#3f3f46"), crate(-14, 2), crate(14, 5), box("wreck", 1, 7, 5, 1.1, 2.2, "#52525b")],
    stages: [
      { kind: "waves", title: "Clear the crash site", waves: [{ enemies: [["crawler", 4]] }, { enemies: [["crawler", 5], ["drone", 2]] }] },
      { kind: "waves", title: "Hold the line", waves: [{ enemies: [["crawler", 6], ["gunner", 2]] }, { enemies: [["skitter", 4], ["gunner", 2]] }] },
    ],
    hazards: [],
    shards: [[0, 3.6, -8.8], [-17, 0.8, -9], [16, 0.8, 9]],
    reward: 30,
  },
  {
    id: 2,
    name: "Alien Ruins",
    subtitle: "Watch the vents",
    theme: "ruins",
    briefing: ["Glowing vents erupt — step out of the red circles!"],
    platforms: [slab(-12, -5, 2, 5, 4), slab(12, -5, 2, 5, 4), slab(0, -2, 3.6, 4, 4)],
    solids: [pillar(-6, -7, 1.4, 4), pillar(6, -7, 1.4, 4), pillar(-6, 5, 1.4, 3), pillar(6, 5, 1.4, 3), rock(0, 7, 4, 1.2, 1.6)],
    stages: [
      { kind: "waves", title: "Push into the ruins", waves: [{ enemies: [["crawler", 6], ["skitter", 3]] }, { enemies: [["gunner", 3], ["crawler", 6]] }] },
      { kind: "survive", title: "Survive the ambush", seconds: 45, pool: ["crawler", "skitter", "gunner", "drone"], every: 1.6, max: 10 },
    ],
    hazards: [{ kind: "vents", spots: [[-10, 3], [0, 3], [10, 3], [-3, -5], [3, -5]], period: 3.2, dmg: 18 }],
    shards: [[0, 4.2, -2], [-12, 2.6, -5], [18, 0.8, -9]],
    reward: 40,
  },
  {
    id: 3,
    name: "Abandoned Colony",
    subtitle: "The robots dug in",
    theme: "colony",
    briefing: ["Brutes and shielded Wardens — hit Wardens from behind or with heavy shots."],
    platforms: [slab(-10, -7, 1.8, 6, 3), slab(10, -7, 1.8, 6, 3), slab(-15, 4, 2.6, 4, 3), slab(15, 4, 2.6, 4, 3)],
    solids: [box("container", -4, -2, 5, 2, 2.2, "#0e7490"), box("container", 5, 3, 2.2, 2, 5, "#9a3412"), crate(-12, -1), crate(-10.8, -1.2), crate(12, 0)],
    stages: [
      { kind: "waves", title: "Retake the colony", waves: [{ enemies: [["crawler", 6], ["brute", 2]] }, { enemies: [["gunner", 4], ["warden", 2]] }] },
      { kind: "waves", title: "Defeat the Colony Warlord", waves: [{ enemies: [["elite", 1], ["crawler", 4], ["gunner", 2]] }] },
    ],
    hazards: [],
    shards: [[-15, 3.2, 4], [15, 3.2, 4], [-4, 2.6, -2]],
    reward: 50,
  },
  {
    id: 4,
    name: "Underground Facility",
    subtitle: "Lights out",
    theme: "facility",
    briefing: ["It's dark down here. Robots ambush from the shadows — and dodge the security lasers."],
    platforms: [slab(-13, -7, 2.2, 6, 3), slab(13, -7, 2.2, 6, 3), slab(0, 6, 2, 6, 2.5)],
    solids: [box("wall", -6, -1, 1, 2.6, 7, "#1f2937"), box("wall", 6, -1, 1, 2.6, 7, "#1f2937"), crate(-16, 6), crate(16, 6)],
    dark: true,
    stages: [
      { kind: "waves", title: "Sweep the corridors", waves: [{ enemies: [["crawler", 5], ["skitter", 3]], spawn: "ambush" }, { enemies: [["gunner", 3], ["bomber", 3]], spawn: "ambush" }] },
      { kind: "survive", title: "Hold until the lights return", seconds: 40, pool: ["skitter", "bomber", "crawler", "gunner"], every: 1.5, max: 9 },
      { kind: "waves", title: "Security chief", waves: [{ enemies: [["elite", 1], ["skitter", 4]], spawn: "ambush" }] },
    ],
    hazards: [{ kind: "lasers", pylons: [[0, -9.5], [0, 9.5]], period: 7, dmg: 22, length: 13 }],
    shards: [[-13, 2.8, -7], [13, 2.8, -7], [0, 2.6, 6]],
    reward: 60,
  },
  {
    id: 5,
    name: "Alien Hive",
    subtitle: "Burn the nests",
    theme: "hive",
    briefing: ["Destroy the robot nests — they keep spawning until they fall."],
    platforms: [slab(-11, -6, 1.8, 5, 4), slab(11, -6, 1.8, 5, 4), slab(0, -9, 3.2, 8, 2.5)],
    solids: [rock(-5, 3, 2.4, 2.2, 2.4, "#4c1d95"), rock(5, 3, 2.4, 2.2, 2.4, "#4c1d95"), rock(-16, -2, 2, 3, 2, "#3b0764"), rock(16, -2, 2, 3, 2, "#3b0764")],
    stages: [
      { kind: "destroy", title: "Destroy the 4 nests", nests: [[-14, 0, 6], [14, 0, 6], [-11, 1.8, -6], [11, 1.8, -6]], spawns: ["crawler", "skitter"], escorts: { enemies: [["crawler", 6], ["gunner", 2]] } },
      { kind: "boss", title: "Defeat the Arachnid", boss: "spider", adds: { enemies: [["skitter", 3]] } },
    ],
    hazards: [],
    shards: [[0, 3.8, -9], [-18, 0.8, 9], [18, 0.8, -9]],
    reward: 90,
  },
  {
    id: 6,
    name: "Frozen Planet",
    subtitle: "Slippery footing",
    theme: "frozen",
    briefing: ["The ice is slippery — you slide when you change direction."],
    platforms: [slab(-8, -6, 1.6, 5, 3), slab(8, -6, 1.6, 5, 3), slab(-15, 2, 2.8, 4, 3), slab(15, 2, 2.8, 4, 3), slab(0, -9, 4.2, 5, 2)],
    solids: [box("ice", -3, 3, 1.6, 2.6, 1.6, "#bae6fd"), box("ice", 4, 6, 1.6, 2, 1.6, "#bae6fd"), box("ice", 12, -2, 1.4, 3, 1.4, "#bae6fd"), box("ice", -12, 7, 2, 1.4, 2, "#bae6fd")],
    traction: 0.25,
    stages: [
      { kind: "waves", title: "Break through the ice field", waves: [{ enemies: [["skitter", 6], ["drone", 2]] }, { enemies: [["bomber", 4], ["skitter", 4]] }] },
      { kind: "survive", title: "Survive the storm", seconds: 50, pool: ["skitter", "drone", "bomber", "gunner", "brute"], every: 1.4, max: 11 },
    ],
    hazards: [{ kind: "vents", spots: [[-6, 0], [6, 0], [0, 5]], period: 4, dmg: 16 }],
    shards: [[0, 4.8, -9], [-15, 3.4, 2], [15, 3.4, 2]],
    reward: 100,
  },
  {
    id: 7,
    name: "Desert Battlefield",
    subtitle: "Long-range war",
    theme: "desert",
    briefing: ["Snipers and gunners hold the dunes. Use cover — and watch for red laser sights."],
    platforms: [slab(-12, -7, 2.4, 6, 3), slab(12, -7, 2.4, 6, 3)],
    solids: [rock(-6, -1, 3.4, 1.5, 2, "#a16207"), rock(6, -1, 3.4, 1.5, 2, "#a16207"), rock(0, 6, 4, 1.2, 1.8, "#854d0e"), rock(-15, 6, 2.4, 2.2, 2.4, "#854d0e"), rock(15, 6, 2.4, 2.2, 2.4, "#854d0e")],
    stages: [
      { kind: "waves", title: "Silence the snipers", waves: [{ enemies: [["sniper", 3], ["gunner", 3]], spawn: "far" }, { enemies: [["sniper", 3], ["drone", 3], ["crawler", 4]], spawn: "far" }] },
      { kind: "boss", title: "Down the mothership", boss: "vexx", adds: { enemies: [["gunner", 2]] } },
    ],
    hazards: [],
    shards: [[-12, 3, -7], [12, 3, -7], [0, 1.8, 6]],
    reward: 120,
  },
  {
    id: 8,
    name: "Space Station",
    subtitle: "Low gravity, high ground",
    theme: "station",
    briefing: ["Low gravity! Climb the decks — the nests are up high."],
    platforms: [
      slab(-12, -6, 1.6, 5, 3), slab(12, -6, 1.6, 5, 3),
      slab(-6, -8.5, 3.2, 5, 2.5), slab(6, -8.5, 3.2, 5, 2.5),
      slab(0, -6, 4.8, 5, 2.5),
      slab(-15, 4, 3, 4, 3), slab(15, 4, 3, 4, 3),
    ],
    solids: [box("console", -4, 3, 2.4, 1.1, 1.4, "#334155"), box("console", 4, 3, 2.4, 1.1, 1.4, "#334155"), crate(0, 8, 1)],
    gravity: 0.65,
    stages: [
      { kind: "waves", title: "Secure the hangar", waves: [{ enemies: [["drone", 4], ["gunner", 3]] }, { enemies: [["sniper", 2], ["skitter", 5]] }] },
      { kind: "destroy", title: "Destroy the 3 high nests", nests: [[0, 4.8, -6], [-15, 3, 4], [15, 3, 4]], spawns: ["drone", "skitter"], escorts: { enemies: [["elite", 1], ["drone", 2]] } },
    ],
    hazards: [],
    shards: [[0, 5.4, -6], [-6, 3.8, -8.5], [6, 3.8, -8.5]],
    reward: 140,
  },
  {
    id: 9,
    name: "Alien Fortress",
    subtitle: "Elite guard",
    theme: "fortress",
    briefing: ["Turrets cover the courtyard. Elites guard the hunter's throne."],
    platforms: [slab(-10, -7, 2, 6, 3), slab(10, -7, 2, 6, 3), slab(0, -9, 3.6, 6, 2)],
    solids: [box("wall", -14, 1, 1.2, 2.4, 6, "#27272a"), box("wall", 14, 1, 1.2, 2.4, 6, "#27272a"), box("wall", 0, 3, 6, 1.4, 1, "#27272a"), crate(-6, 7), crate(6, 7)],
    stages: [
      { kind: "waves", title: "Storm the courtyard", waves: [{ enemies: [["warden", 3], ["gunner", 3], ["elite", 1]] }, { enemies: [["elite", 2], ["bomber", 3]] }] },
      { kind: "boss", title: "Defeat Kraye the Hunter", boss: "hunter", adds: { enemies: [["warden", 2]] } },
    ],
    hazards: [{ kind: "turrets", spots: [[-10, 2, -7], [10, 2, -7], [0, 3.6, -9]] }],
    shards: [[0, 4.2, -9], [-18, 0.8, 9], [18, 0.8, 9]],
    reward: 170,
  },
  {
    id: 10,
    name: "Final Dimension",
    subtitle: "The Void Sovereign",
    theme: "dimension",
    briefing: ["Every robot type at once — then the Void Sovereign itself."],
    platforms: [slab(-12, -6, 2, 5, 3), slab(12, -6, 2, 5, 3), slab(0, -9, 3.4, 6, 2), slab(-6, 5, 2.4, 4, 2.5), slab(6, 5, 2.4, 4, 2.5)],
    solids: [box("shard", -4, -2, 1.4, 2.8, 1.4, "#7c3aed"), box("shard", 4, -2, 1.4, 2.8, 1.4, "#7c3aed"), box("shard", 0, 2, 1.2, 1.6, 1.2, "#a855f7")],
    stages: [
      { kind: "waves", title: "Break the vanguard", waves: [{ enemies: [["crawler", 6], ["skitter", 4], ["gunner", 3]], spawn: "sky" }, { enemies: [["brute", 2], ["warden", 2], ["sniper", 2], ["drone", 3]], spawn: "sky" }] },
      { kind: "survive", title: "Survive the rift", seconds: 40, pool: ["skitter", "gunner", "bomber", "drone", "elite", "brute"], every: 1.3, max: 12 },
      { kind: "boss", title: "Defeat the Void Sovereign", boss: "omega" },
    ],
    hazards: [{ kind: "meteors", period: 6, count: 4, dmg: 26 }],
    shards: [[0, 4, -9], [-6, 3, 5], [6, 3, 5]],
    reward: 250,
  },
];

export const levelById = (id: number) => LEVELS.find((l) => l.id === id) ?? LEVELS[0];
