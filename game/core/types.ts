/*
 * World units are metres. X runs along the street (left/right on screen), Z is depth
 * (+Z is towards the camera) and Y is up. Actors are vertical cylinders whose `y` is at their feet.
 */

export type FormId = "human" | "blaze" | "titan" | "bolt" | "shard";
export type AlienId = Exclude<FormId, "human">;
export type GameStatus = "menu" | "playing" | "paused" | "gameover";
export type EnemyKind = "crawler" | "drone" | "brute" | "boss";

/** Abstract player intents. Keyboard, touch and (later) gamepads all map onto these. */
export type Action =
  | "left"
  | "right"
  | "up"
  | "down"
  | "jump"
  | "drop"
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

/** Planar movement intent, length 0..1. `z` is +1 towards the camera. */
export interface MoveVector {
  x: number;
  z: number;
}

/** What the simulation needs from an input device — keeps the core free of DOM code. */
export interface InputSource {
  /** Continuous state (button is down). */
  isHeld(a: Action): boolean;
  /** Edge-triggered: pressed since the last simulation step. */
  wasPressed(a: Action): boolean;
  /** Analog/digital movement combined (keyboard, touch joystick). */
  move(): MoveVector;
}

export interface Actor {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Position at the start of the last step — the renderer interpolates between prev and current. */
  prevX: number;
  prevY: number;
  prevZ: number;
  radius: number;
  height: number;
  onGround: boolean;
  /** Facing direction on the ground plane (unit vector). */
  fx: number;
  fz: number;
  /** Physics collider handle (see `Physics`), or -1 for actors that don't collide with the world. */
  body: number;
}

export interface Player extends Actor {
  form: FormId;
  hp: number;
  maxHp: number;
  energy: number;
  watchLocked: boolean;
  attackCd: number;
  specialCd: number;
  /** Seconds until the Shiftwatch can be used again (stops transform-spam invulnerability). */
  transformCd: number;
  /** Counts down after an attack / special / hit — drives the character animation. */
  attackAnim: number;
  specialAnim: number;
  hurtAnim: number;
  invuln: number;
  dashTimer: number;
  dashHit: Set<number>;
  shieldTimer: number;
  flash: number;
  jumpsLeft: number;
  dropTimer: number;
}

export interface Enemy extends Actor {
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
  /** Generic move target on the ground plane (boss dive: the clear landing spot). */
  targetX: number;
  targetZ: number;
  dead: boolean;
}

export type ProjectileKind = "fire" | "crystal" | "bullet" | "plasma";

export interface Projectile {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number;
  dmg: number;
  owner: "player" | "enemy";
  kind: ProjectileKind;
  life: number;
  pierce: boolean;
  hit: Set<number>;
}

/** Expanding damage ring: Blaze's nova (body height) or Titan's quake (along the ground). */
export interface Ring {
  kind: "nova" | "quake";
  x: number;
  y: number;
  z: number;
  maxR: number;
  life: number;
  maxLife: number;
  dmg: number;
  hit: Set<number>;
}

export interface Pickup {
  id: number;
  kind: "energy" | "health";
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  life: number;
}

/** Visual-only melee arc (the sim spawns it so the renderer knows where the hit happened). */
export interface Slash {
  x: number;
  y: number;
  z: number;
  /** Direction of the swing (unit vector on the ground plane). */
  fx: number;
  fz: number;
  range: number;
  color: string;
  life: number;
  maxLife: number;
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
  /** Big centred announcement ("WAVE 3"), empty when none. */
  banner: string;
}
