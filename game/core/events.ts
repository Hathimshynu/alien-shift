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
 * Cosmetic effects. The sim calls these directly (no allocation per particle); the browser
 * passes a pooled particle/text system, headless tests pass `NO_FX`. Colours are CSS hex strings.
 */
export interface FxSink {
  /** Radial burst of `count` particles at a point. */
  burst(x: number, y: number, z: number, count: number, color: string, speed: number): void;
  /** One particle with explicit velocity (trails, embers, dust). */
  spark(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: string, life: number, gravity?: number): void;
  /** Floating text such as damage numbers or "WATCH READY". */
  text(x: number, y: number, z: number, text: string, color: string, size: number): void;
}

export const NO_FX: FxSink = { burst() {}, spark() {}, text() {} };

/**
 * Side effects the simulation wants performed. The core never touches audio, storage or the DOM;
 * it queues events and the driver drains them once per frame. Later phases add haptics/VFX here.
 */
export type GameEvent =
  | { type: "sfx"; name: SfxName }
  | { type: "status"; status: GameStatus }
  | { type: "waveCleared"; wave: number };
