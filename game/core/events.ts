import type { GameStatus } from "./types";

/** Every sound the game can ask for. The browser driver maps these to real audio. */
export type SfxName =
  | "jump"
  | "punch"
  | "heavy"
  | "shoot"
  | "crystal"
  | "zap"
  | "hit"
  | "hurt"
  | "explode"
  | "pickup"
  | "error"
  | "shield"
  | "enemyShot"
  | "transform"
  | "timeout"
  | "wave"
  | "gameOver";

/**
 * Side effects the simulation wants performed. The core never touches audio, storage or the DOM;
 * it queues events and the driver drains them once per frame. Later phases add haptics/VFX here.
 */
export type GameEvent =
  | { type: "sfx"; name: SfxName }
  | { type: "status"; status: GameStatus }
  | { type: "waveCleared"; wave: number };
