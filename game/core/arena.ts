/** Fixed simulation step (seconds). */
export const STEP = 1 / 60;
/** Gravity (m/s²) — strong and snappy like the 2D game, not realistic. */
export const GRAVITY = 45;
export const MAX_FALL = 30;
/** Extra downward acceleration while rising with jump released (variable jump height). */
export const JUMP_CUT = 40;

/** Playable street area (actors are clamped inside). The street continues visually into the fog. */
export const ARENA = { minX: -20, maxX: 20, minZ: -11, maxZ: 11 } as const;
/** Ground enemies walk in from beyond the barriers at the street ends. */
export const SPAWN_X = 23.5;

export interface ArenaBox {
  /** Platforms are one-way; everything else is solid cover (the kind only changes how it's drawn). */
  kind: "platform" | "crate" | "car" | "rock" | "pillar" | "wreck" | "container" | "wall" | "ice" | "console" | "shard";
  /** Centre on the ground plane. */
  x: number;
  z: number;
  /** Bottom height. */
  y: number;
  /** Size along X, Y and Z. */
  w: number;
  h: number;
  d: number;
  color: string;
}

const PLATFORM_THICKNESS = 0.35;
const platform = (x: number, z: number, top: number, w: number, d: number): ArenaBox => ({
  kind: "platform",
  x,
  z,
  y: top - PLATFORM_THICKNESS,
  w,
  h: PLATFORM_THICKNESS,
  d,
  color: "#1f2937",
});
const crate = (x: number, z: number, size: number, y = 0): ArenaBox => ({ kind: "crate", x, z, y, w: size, h: size, d: size, color: "#92400e" });

/**
 * One-way platforms (scaffolds / rooftop): jump up through them from below, drop down with the drop key.
 * The rooftop is only reachable from one of the side scaffolds.
 */
export const PLATFORMS: ArenaBox[] = [platform(-8.8, -6.5, 1.7, 6, 4), platform(8.8, -6.5, 1.7, 6, 4), platform(0, -8.5, 3.2, 10, 4)];
/** The original city street (Endless mode). */
const CITY_PLATFORMS = [...PLATFORMS];

/** Solid cover: parked cars and crates. You can stand on them; they block bullets. */
export const SOLIDS: ArenaBox[] = [
  { kind: "car", x: -5, z: 5.5, y: 0, w: 4.2, h: 1.4, d: 1.9, color: "#be123c" },
  { kind: "car", x: 8.5, z: 2.5, y: 0, w: 4.2, h: 1.4, d: 1.9, color: "#0e7490" },
  crate(-15, 3, 1.2),
  crate(-13.7, 3.3, 1.2),
  crate(-14.4, 3.15, 1.1, 1.2),
  crate(15.5, 7, 1.2),
  crate(14.3, -1.5, 1.2),
  crate(3.5, 8.5, 1),
];
const CITY_SOLIDS = [...SOLIDS];

/** Current movement modifiers of the loaded layout (campaign levels change these). */
export const WORLD = { gravity: 1, traction: 1 };

/**
 * Swap the arena layout (campaign levels each have their own). PLATFORMS / SOLIDS are mutated in
 * place so every module keeps its reference; call Physics.rebuildStatic() afterwards.
 * With no arguments the original city street (Endless mode) is restored.
 */
export function setLayout(platforms: ArenaBox[] = CITY_PLATFORMS, solids: ArenaBox[] = CITY_SOLIDS, gravity = 1, traction = 1) {
  PLATFORMS.length = 0;
  PLATFORMS.push(...platforms);
  SOLIDS.length = 0;
  SOLIDS.push(...solids);
  WORLD.gravity = gravity;
  WORLD.traction = traction;
}

/** Height of the highest surface under (x, z) that is not above `fromY` (ground = 0). */
export function floorHeightAt(x: number, z: number, fromY: number) {
  let floor = 0;
  for (const list of [SOLIDS, PLATFORMS]) {
    for (const b of list) {
      const top = b.y + b.h;
      if (top > fromY + 0.05 || top <= floor) continue;
      if (Math.abs(x - b.x) <= b.w / 2 && Math.abs(z - b.z) <= b.d / 2) floor = top;
    }
  }
  return floor;
}

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const rand = (min: number, max: number) => min + Math.random() * (max - min);
