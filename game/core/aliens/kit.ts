import type { GameSim } from "../sim";

/**
 * Everything an alien can do. The sim decides *when* (combo timing, cooldowns, energy cost,
 * the ultimate cinematic); the kit decides *what happens*, using the sim's combat API
 * (melee, fire, area, beam, ring, zone, dash, hurtEnemy…). Damage values here are base values;
 * the combat API scales them with the alien's upgrade level.
 *
 * To add an alien: write a kit file like the others, register it in aliens/index.ts, add its
 * stats to forms.ts and a placeholder rig in components/three/characters/PlaceholderCharacter.tsx.
 */
export interface AlienKit {
  /** Light attack (tap). Also used in the air — check `sim.player.onGround` for an air variant. */
  light(sim: GameSim): void;
  /** Third hit of the light chain; `upgraded` is true from level 3 (the alien's combo move). */
  finisher(sim: GameSim, upgraded: boolean): void;
  /** Heavy attack (hold) on the ground. Heavy in the air is a generic dive slam. */
  heavy(sim: GameSim): void;
  special(sim: GameSim): void;
  /** Fires when the ultimate cinematic ends. */
  ultimate(sim: GameSim): void;
  /** Runs every step while this form is active (ambient particles, auras). */
  tick?(sim: GameSim): void;
}
