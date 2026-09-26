export type FormId = "human" | "blaze" | "titan" | "bolt" | "shard";
export type AlienId = Exclude<FormId, "human">;
export type GameStatus = "menu" | "playing" | "paused" | "gameover";
export type EnemyKind = "crawler" | "drone" | "brute" | "boss";

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

export interface HudState {
  status: GameStatus;
  form: FormId;
  hp: number;
  maxHp: number;
  energy: number;
  watchLocked: boolean;
  wave: number;
  score: number;
  highScore: number;
  combo: number;
  enemiesLeft: number;
  bossHp: number | null;
  muted: boolean;
  specialReady: boolean;
}
