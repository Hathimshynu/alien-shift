/*
 * World units are metres. X runs along the street (left/right on screen), Z is depth
 * (+Z is towards the camera) and Y is up. Actors are vertical cylinders whose `y` is at their feet.
 */

export type AlienId =
  | "blaze"
  | "titan"
  | "bolt"
  | "shard"
  | "gravix"
  | "frostbyte"
  | "thornback"
  | "phantom"
  | "behemoth"
  | "nanotek";
export type FormId = "human" | AlienId;
/** "complete" = a campaign level was just finished (results screen). */
export type GameStatus = "menu" | "playing" | "paused" | "gameover" | "complete";
/** Campaign = the 10 levels; endless = the original survive-the-waves mode. */
export type GameMode = "campaign" | "endless";
export type Difficulty = "easy" | "normal" | "hard" | "nightmare";

export type BossKind = "vexx" | "spider" | "hunter" | "omega";
export type EnemyKind =
  | "crawler"
  | "skitter"
  | "gunner"
  | "drone"
  | "brute"
  | "warden"
  | "bomber"
  | "sniper"
  | "elite"
  | "turret"
  | "nest"
  | BossKind;
export const isBoss = (kind: EnemyKind): kind is BossKind => kind === "vexx" || kind === "spider" || kind === "hunter" || kind === "omega";

/** Guns Kai can carry (see weapons.ts). */
export type WeaponId = "pistol" | "rifle" | "shotgun" | "plasma" | "cannon";
/** Kai's superhuman special powers (see powers.ts). */
export type PowerId = "punch" | "blast" | "dash" | "freeze" | "smash" | "strike";
/** Kai's own upgrade tracks (see progression.ts). */
export type AgentStat = "health" | "damage" | "speed" | "fireRate" | "power" | "mobility";

/** The rival hunter's three looks (rendered with the same character rig system as the aliens). */
export type HunterForm = "hunter" | "hunterBrute" | "hunterBlade";
/** Anything that can be drawn with CharacterModel. */
export type ModelId = FormId | HunterForm;

export type TransformAction = "t1" | "t2" | "t3" | "t4" | "t5" | "t6" | "t7" | "t8" | "t9" | "t10";

/** Abstract player intents. Keyboard, touch and (later) gamepads all map onto these. */
export type Action =
  | "left"
  | "right"
  | "up"
  | "down"
  | "jump"
  | "drop"
  | "attack"
  | "melee"
  | "reload"
  | "weapon"
  | "power1"
  | "power2"
  | "power3"
  | "special"
  | "ultimate"
  | "dodge"
  | "wheel"
  | TransformAction
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
  /** Mouse aim point on the ground plane (world x/z), or null when not aiming with a mouse. */
  aim(): MoveVector | null;
}

/** Which aliens the player owns and how upgraded they are (from the save data). */
export interface Loadout {
  unlocked: FormId[];
  levels: Partial<Record<FormId, number>>;
  /** Setting: skip the slow-motion transformation sequence. */
  skipTransformCinematic: boolean;
  /** Kai's upgrade levels (1–5). */
  agent: Partial<Record<AgentStat, number>>;
  /** Owned guns and the one in hand. */
  weapons: WeaponId[];
  weapon: WeaponId;
  /** Owned powers and the three equipped on the power buttons (E / R / T). */
  powers: PowerId[];
  equippedPowers: PowerId[];
  difficulty: Difficulty;
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

export type AttackKind = "light" | "finisher" | "heavy" | "air";

export interface Player extends Actor {
  form: FormId;
  hp: number;
  maxHp: number;
  energy: number;
  watchLocked: boolean;
  /** Ultimate meter 0..100, charged by dealing damage. */
  ult: number;
  /** After an ultimate fires, its own damage doesn't refill the meter for this long. */
  ultLockout: number;
  attackCd: number;
  heavyCd: number;
  specialCd: number;
  /** Seconds until the Shiftwatch can be used again (stops transform-spam invulnerability). */
  transformCd: number;
  /** Light-attack chain: index of the last hit (0, 1, 2 = finisher) and time left to continue it. */
  comboStep: number;
  comboWindow: number;
  /** A light attack pressed during cooldown is remembered briefly (input buffering). */
  attackBuffer: number;
  /** How long attack has been held (heavy triggers past a threshold) and whether it already fired. */
  holdTime: number;
  heavyDone: boolean;
  lastAttack: AttackKind;
  /** Diving air slam in progress (heavy in the air, or Behemoth's meteor stomp) and its landing power. */
  airSlam: boolean;
  slamDmg: number;
  slamRadius: number;
  /** Counts down after an attack / special / hit / dodge — drives the character animation. */
  attackAnim: number;
  specialAnim: number;
  hurtAnim: number;
  dodgeTimer: number;
  dodgeCd: number;
  invuln: number;
  dashTimer: number;
  dashSpeed: number;
  dashDmg: number;
  dashKnock: number;
  dashColor: string;
  dashHit: Set<number>;
  /** Bolt's Storm Rush: enemy ids still to strike and the time until the next jump. */
  rushTargets: number[];
  rushTimer: number;
  shieldTimer: number;
  /** Phantom's vanish: invisible + intangible. */
  invisible: number;
  /** Slowed by a spider web. */
  slowTimer: number;
  flash: number;
  jumpsLeft: number;
  dropTimer: number;
  // ── Kai's gunplay and powers ──
  weapon: WeaponId;
  /** Rounds left in the magazine, and reload countdown (0 = not reloading). */
  ammo: number;
  reloadTimer: number;
  /** Time until the gun can fire again, and the muzzle-flash / recoil timer for the renderer. */
  fireCd: number;
  shootAnim: number;
  /** Where the upper body aims (unit vector on the ground plane) while shooting. */
  aimFx: number;
  aimFz: number;
  /** Cooldown left per power, in seconds. */
  powerCd: Record<PowerId, number>;
  /** Power currently animating (for the character pose) and its timer. */
  powerAnim: PowerId | null;
  powerAnimT: number;
  /** Power Punch wind-up before the shockwave fires. */
  punchCharge: number;
  /** 360° aerial spin (seconds left) — triggered by the double jump. */
  airSpin: number;
  /** Air Strike: shots still to fire from the air and the time to the next one. */
  strikeShots: number;
  strikeTimer: number;
  /** Seconds since the player last took damage (health regenerates after a delay). */
  sinceHurt: number;
  /** Ground Smash: the landing also raises a ring of rock spikes. */
  slamRocks: boolean;
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
  cores: number;
  /** Pattern counter for bosses / attack cycles. */
  phase: number;
  /** Boss health phase: 0 (full) → 2 (below a third). */
  bossPhase: number;
  /** Generic countdown for multi-step moves (boss dive, bomber fuse, charges…). */
  stateTimer: number;
  /** Generic flag for multi-step moves (boss dive: has it hit the ground yet? sniper: aiming). */
  stateFlag: boolean;
  /** Which multi-step move is running (boss attacks). */
  move: string;
  /** Visual/behaviour variant (the hunter's current form: 0 gunner, 1 brute, 2 blade). */
  variant: number;
  /** Generic move target on the ground plane (boss dive landing spot, leap target, charge end). */
  targetX: number;
  targetZ: number;
  /** Where the sniper / hunter is aiming (laser sight end point). */
  aimX: number;
  aimY: number;
  aimZ: number;
  /** Frontal energy shield (wardens): blocks hits from the front until broken by heavy attacks. */
  shieldHp: number;
  maxShieldHp: number;
  // Status effects (seconds remaining).
  slowTimer: number;
  frozenTimer: number;
  rootTimer: number;
  liftTimer: number;
  stunTimer: number;
  burnTimer: number;
  /** Possessed by Phantom: fights for the player while > 0. */
  allyTimer: number;
  /** Encased by Crystal Prison: shatters for this much damage when the freeze ends. */
  prisonDmg: number;
  invuln: number;
  /** Stronger "elite" variant of a regular robot (more HP and damage, gold trim). */
  elite: boolean;
  /** Boss below ~15% HP: attacks faster. */
  enraged: boolean;
  /** Boss death sequence (seconds left) — explodes before it disappears. */
  dying: number;
  dead: boolean;
}

export type ProjectileKind =
  | "fire"
  | "fireBig"
  | "crystal"
  | "gravity"
  | "frost"
  | "bullet"
  | "plasma"
  | "web"
  | "snipe"
  // Kai's guns and the Energy Blast power
  | "tracer"
  | "pellet"
  | "plasmaBolt"
  | "shell"
  | "energy";

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
  /** Explosion radius on impact (0 = none). */
  aoe: number;
  /** Seconds of slow applied on hit. */
  slow: number;
  /** Pull radius around the impact point (Gravix). */
  pull: number;
  heavy: boolean;
}

/** Expanding damage ring: novas at body height, quakes/shockwaves along the ground. */
export interface Ring {
  kind: "nova" | "quake" | "shock" | "supernova";
  x: number;
  y: number;
  z: number;
  maxR: number;
  life: number;
  maxLife: number;
  dmg: number;
  knock: number;
  color: string;
  owner: "player" | "enemy";
  hit: Set<number>;
}

export type ZoneKind = "blast" | "laser" | "beam" | "vortex" | "iceWall" | "thorns" | "bloom" | "turret" | "blizzard" | "wave" | "collapse";
/** Visual variant of a blast: what falls / rises when the telegraph runs out. */
export type ZoneStyle = "plain" | "meteor" | "orbital" | "missile" | "rock" | "slam";

/**
 * Lasting area effects and telegraphed attacks. A zone with `delay` > 0 shows a warning first
 * (circle or line) and only hurts once `t >= delay`. See zones.ts for each kind's behaviour.
 */
export interface Zone {
  id: number;
  kind: ZoneKind;
  style: ZoneStyle;
  owner: "player" | "enemy";
  x: number;
  y: number;
  z: number;
  /** Second point for lines (beams). */
  x2: number;
  y2: number;
  z2: number;
  /** Radius, or length for lasers / walls. */
  r: number;
  /** Direction angle on the ground plane (lasers, walls) and its rotation speed (rad/s). */
  angle: number;
  spin: number;
  t: number;
  delay: number;
  life: number;
  dmg: number;
  /** Damage-over-time / fire-rate accumulator. */
  tick: number;
  color: string;
  hit: Set<number>;
  /** Physics collider (ice walls), or -1. */
  handle: number;
  /** Id of the actor this zone follows / belongs to (-1 = none). */
  source: number;
}

export interface Pickup {
  id: number;
  /** "shard" = a level's hidden data shard (collectible). */
  kind: "energy" | "health" | "core" | "shard";
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  onGround: boolean;
  life: number;
  /** Cores carried by a core pickup. */
  value: number;
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
  /** Half-angle of the arc in radians (π = full spin). */
  arc: number;
  color: string;
  life: number;
  maxLife: number;
}

/** Slow-motion sequences: transforming and firing an ultimate. */
export interface Cinematic {
  kind: "transform" | "ultimate";
  /** Real (unscaled) seconds elapsed and total length. */
  t: number;
  dur: number;
  form: FormId;
  title: string;
  /** The transform/ultimate effect has been applied. */
  fired: boolean;
}

export interface BossHud {
  name: string;
  hp: number;
  phase: number;
  phases: number;
  enraged: boolean;
}

export interface PowerHud {
  id: PowerId;
  /** Cooldown left (s) and total. */
  cd: number;
  total: number;
}

/** Results shown when a campaign level is completed. */
export interface LevelResult {
  levelId: number;
  time: number;
  kills: number;
  shards: number;
  shardsTotal: number;
  cores: number;
  damageTaken: number;
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
  ult: number;
  dodgeReady: boolean;
  wave: number;
  score: number;
  combo: number;
  enemiesLeft: number;
  boss: BossHud | null;
  specialReady: boolean;
  /** Shift Cores picked up this run. */
  runCores: number;
  /** Big centred announcement ("WAVE 3"), empty when none. */
  banner: string;
  /** Ultimate name shown during its cinematic, empty otherwise. */
  cinematicTitle: string;
  /** Blizzard ultimate running (screen tint). */
  blizzard: boolean;
  mode: GameMode;
  /** Campaign level (1–10) and its name, objective line and checkpoint (stage) number. */
  level: number;
  levelName: string;
  objective: string;
  stage: number;
  stages: number;
  /** Data shards collected / available in this level. */
  shards: number;
  shardsTotal: number;
  /** Kai's gun. */
  weapon: WeaponId;
  ammo: number;
  magazine: number;
  reloading: number;
  powers: PowerHud[];
  /** Time Freeze running (screen tint). */
  timeFreeze: boolean;
  /** Set when a campaign level was completed. */
  result: LevelResult | null;
  /** Crosshair marker: 0 none, 1 a shot landed, 2 a robot was destroyed. */
  hitMarker: number;
}
