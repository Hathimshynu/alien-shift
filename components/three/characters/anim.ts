import { HUNTER_FORMS } from "@/game/core/bosses/hunter";
import { FORMS } from "@/game/core/forms";
import type { FormId, ModelId } from "@/game/core/types";

/** The animation set every character supports (placeholder rigs and real .glb models alike). */
export type AnimName = "idle" | "run" | "jump" | "fall" | "attack" | "special" | "hit" | "death" | "dodge";

/**
 * Per-frame animation input, written by the owner (PlayerView, the hunter boss) and read by the
 * model in useFrame. Action layers are 0..1 progress values (-1 when inactive) so procedural rigs
 * can blend them on top of locomotion; `.glb` models play the single highest-priority clip instead.
 */
export interface AnimState {
  locomotion: "idle" | "run" | "jump" | "fall";
  /** 0..1 of the form's top speed. */
  runSpeed: number;
  attack: number;
  /** Alternates every attack so rapid jabs switch arms. */
  attackSide: 1 | -1;
  /** The current attack is a heavy (two-handed overhead smash pose). */
  heavy: boolean;
  special: number;
  /** Ultimate cinematic power-up pose. */
  ultimate: number;
  hit: number;
  dodge: number;
  /** Seconds since death, or -1 while alive. */
  death: number;
}

export const newAnimState = (): AnimState => ({
  locomotion: "idle",
  runSpeed: 0,
  attack: -1,
  attackSide: 1,
  heavy: false,
  special: -1,
  ultimate: -1,
  hit: -1,
  dodge: -1,
  death: -1,
});

/** Highest-priority animation right now (used by .glb models, which play one clip at a time). */
export function primaryAnim(s: AnimState): AnimName {
  if (s.death >= 0) return "death";
  if (s.hit >= 0) return "hit";
  if (s.dodge >= 0) return "dodge";
  if (s.special >= 0 || s.ultimate >= 0) return "special";
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
  dodge: ["roll", "dodge", "evade", "dash"],
};

/** Models are looked up as /public/models/<id>.glb. */
export const modelPath = (id: ModelId) => `/models/${id}.glb`;

/** Height a model is scaled to (the character's collision height). */
export function modelHeight(id: ModelId) {
  if (id in FORMS) return FORMS[id as FormId].height;
  return HUNTER_FORMS.find((f) => f.id === id)?.height ?? 2;
}
