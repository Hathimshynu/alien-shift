export type FormId = "human" | "blaze" | "titan" | "bolt" | "shard";
export type AlienId = Exclude<FormId, "human">;
export type GameStatus = "menu" | "playing" | "paused" | "gameover";
export type EnemyKind = "crawler" | "drone" | "brute" | "boss";

/** Abstract player intents. Keyboard, touch and (later) gamepads all map onto these. */
export type Action =
  | "left"
  | "right"
  | "jump"
  | "down"
  | "attack"
  | "special"
  | "t1"
  | "t2"
  | "t3"
  | "t4"
  | "revert"
  | "pause"
  | "mute"
  | "start";

/** What the simulation needs from an input device — keeps the core free of DOM code. */
export interface InputSource {
  /** Continuous state (button is down). */
  isHeld(a: Action): boolean;
  /** Edge-triggered: pressed since the last simulation step. */
  wasPressed(a: Action): boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Body extends Rect {
  vx: number;
  vy: number;
  onGround: boolean;
}

export interface Player extends Body {
  facing: 1 | -1;
  form: FormId;
  hp: number;
  maxHp: number;
  energy: number;
  watchLocked: boolean;
  attackCd: number;
  specialCd: number;
  /** Seconds until the Shiftwatch can be used again (stops transform-spam invulnerability). */
  transformCd: number;
  attackAnim: number;
  invuln: number;
  dashTimer: number;
  dashHit: Set<number>;
  shieldTimer: number;
  flash: number;
  anim: number;
  jumpsLeft: number;
  dropTimer: number;
}

export interface Enemy extends Body {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  fireCd: number;
  hitFlash: number;
  t: number;
  value: number;
  phase: number;
  /** Generic countdown for multi-step moves (boss dive). */
  stateTimer: number;
  /** Generic flag for multi-step moves (boss dive: has it hit the ground yet?). */
  stateFlag: boolean;
  dead: boolean;
}

export type ProjectileKind = "fire" | "crystal" | "bullet" | "wave" | "plasma";

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  dmg: number;
  owner: "player" | "enemy";
  kind: ProjectileKind;
  color: string;
  life: number;
  pierce: boolean;
  hit: Set<number>;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  gravity: number;
}

export interface Ring {
  x: number;
  y: number;
  maxR: number;
  color: string;
  life: number;
  maxLife: number;
  dmg: number;
  hit: Set<number>;
}

export interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  size: number;
}

export interface Pickup extends Body {
  kind: "energy" | "health";
  life: number;
}

export interface Slash {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  life: number;
  facing: 1 | -1;
}

/** Snapshot of the simulation for the React HUD (UI settings like mute live in the store). */
export interface HudState {
  status: GameStatus;
  form: FormId;
  hp: number;
  maxHp: number;
  energy: number;
  watchLocked: boolean;
  transformReady: boolean;
  wave: number;
  score: number;
  combo: number;
  enemiesLeft: number;
  bossHp: number | null;
  specialReady: boolean;
}
