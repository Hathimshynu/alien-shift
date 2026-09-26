import type { FormId } from "@/game/core/types";

/** The animation set every character supports (placeholder rigs and real .glb models alike). */
export type AnimName = "idle" | "run" | "jump" | "fall" | "attack" | "special" | "hit" | "death";

/**
 * Per-frame animation input, written by the owner (PlayerView) and read by the model in useFrame.
 * Action layers are 0..1 progress values (-1 when inactive) so procedural rigs can blend them
 * on top of locomotion; `.glb` models play the single highest-priority clip instead.
 */
export interface AnimState {
  locomotion: "idle" | "run" | "jump" | "fall";
  /** 0..1 of the form's top speed. */
  runSpeed: number;
  attack: number;
  /** Alternates every attack so rapid jabs switch arms. */
  attackSide: 1 | -1;
  special: number;
  hit: number;
  /** Seconds since death, or -1 while alive. */
  death: number;
}

export const newAnimState = (): AnimState => ({
  locomotion: "idle",
  runSpeed: 0,
  attack: -1,
  attackSide: 1,
  special: -1,
  hit: -1,
  death: -1,
});

/** Highest-priority animation right now (used by .glb models, which play one clip at a time). */
export function primaryAnim(s: AnimState): AnimName {
  if (s.death >= 0) return "death";
  if (s.hit >= 0) return "hit";
  if (s.special >= 0) return "special";
  if (s.attack >= 0) return "attack";
  return s.locomotion;
}

/**
 * Clip-name aliases, so models from Quaternius / Kenney / Mixamo work without renaming clips.
 * Matching is case-insensitive "contains"; the first alias that matches a clip wins.
 */
export const CLIP_ALIASES: Record<AnimName, string[]> = {
  idle: ["idle", "stand", "breath"],
  run: ["run", "sprint", "jog", "walk"],
  jump: ["jump", "leap"],
  fall: ["fall", "air", "jump"],
  attack: ["attack", "punch", "slash", "hit_a", "shoot"],
  special: ["special", "cast", "spell", "power", "attack2", "kick"],
  hit: ["hit", "hurt", "damage", "receive", "recieve"],
  death: ["death", "die", "dead", "defeat"],
};

/** Models are looked up as /public/models/<id>.glb. */
export const modelPath = (form: FormId) => `/models/${form}.glb`;
