import { KITS } from "./aliens";
import { ARENA, GRAVITY, JUMP_CUT, MAX_FALL, SPAWN_X, STEP, WORLD, clamp, floorHeightAt, rand, setLayout } from "./arena";
import { BOSSES, ENRAGE_AT, bossForWave } from "./bosses";
import { beginStage, nestSpawn, objectiveText, placeLevelObjects, startCampaign, updateCampaign, updateHazards, type CampaignRun } from "./campaign";
import { ELITE_DMG, ELITE_HP, ENEMY_DEFS, rollEnemyKind, updateEnemyAI } from "./enemies";
import { NO_FX, type FxSink, type GameEvent, type SfxName } from "./events";
import { ALIEN_ORDER, FORMS } from "./forms";
import { AIM_CONE_COS, AIM_RANGE, actorsOverlap, sphereHitsActor, spread, type Vec3 } from "./geom";
import { levelById, type SpawnMode } from "./levels";
import type { Physics, PlatformMode } from "./physics";
import { POWERS, POWER_ORDER, fireStrikeBolt, releasePowerPunch } from "./powers";
import { COMBO_MOVE_LEVEL, DEFAULT_LOADOUT, agentLevelOf, damageMul, drainMul, levelOf, specialCdMul } from "./progression";
import { DIFFICULTY, RULES } from "./rules";
import type {
  Actor,
  AgentStat,
  Cinematic,
  Enemy,
  EnemyKind,
  FormId,
  GameMode,
  GameStatus,
  HudState,
  InputSource,
  LevelResult,
  Loadout,
  MoveVector,
  Pickup,
  Player,
  PowerId,
  Projectile,
  ProjectileKind,
  Ring,
  Slash,
  TransformAction,
  WeaponId,
  Zone,
  ZoneKind,
} from "./types";
import { isBoss } from "./types";
import { WEAPONS, WEAPON_ORDER } from "./weapons";
import { updateZones } from "./zones";

const ENERGY_DRAIN = 5; // per second while transformed (≈20s from full at level 1)
const ENERGY_RECHARGE = 9; // per second in human form
const TRANSFORM_MIN_ENERGY = 15;
/** Minimum gap between voluntary transformations (including reverting to Kai). */
export const TRANSFORM_COOLDOWN = 1;
const UNLOCK_ENERGY = 35;
const MAX_ENEMIES = 14;

/** Hold attack this long for a heavy attack. */
export const HEAVY_HOLD = 0.3;
/** Time allowed between light hits to continue the 3-hit chain. */
const COMBO_WINDOW = 0.7;
const HEAVY_COOLDOWN = 0.7;
/** Ultimate meter gained per point of damage dealt. */
const ULT_PER_DAMAGE = 0.3;
const DODGE_TIME = 0.35;
const DODGE_SPEED = 15;
const DODGE_IFRAMES = 0.3;
const DODGE_COOLDOWN = 0.8;
/** Transformation slow-motion (real seconds) and ultimate cinematic length. */
const TRANSFORM_CINEMATIC = 0.6;
const ULTIMATE_CINEMATIC = 0.9;

/** Melee hits land inside this half-angle in front of the attacker unless a move says otherwise. */
const MELEE_ARC = (65 * Math.PI) / 180;

/** Options for a single hit on an enemy. */
export interface HitOpts {
  /** Heavy hits break warden shields. */
  heavy?: boolean;
  /** Ignore warden shields entirely (Phantom). */
  pierceShield?: boolean;
  /** Where the hit came from (defaults to the player) — decides "front" for shields. */
  sx?: number;
  sz?: number;
  stun?: number;
  slow?: number;
  freeze?: number;
  root?: number;
  lift?: number;
  /** Knock the target into the air. */
  launch?: boolean;
  /** Damage dealt by a possessed ally or a hazard: no ultimate charge, no crit. */
  noUlt?: boolean;
}

export interface AreaOpts extends HitOpts {
  /** Only hits targets standing near the ground (quakes, stomps). */
  ground?: boolean;
  /** Vertical reach above/below `y` (default 2.2 m). */
  height?: number;
  owner?: "player" | "enemy";
  /** Damage is already final (zones scale when created) — don't apply the upgrade multiplier again. */
  raw?: boolean;
}

/** An InputSource with nothing pressed — used while the player is locked (cinematics, watch wheel). */
const NO_INPUT: InputSource = { isHeld: () => false, wasPressed: () => false, move: () => ({ x: 0, z: 0 }), aim: () => null };

/** Auto-aim range for Kai's guns, and the soft lock radius around a mouse aim point. */
const GUN_AIM_RANGE = 24;
const MOUSE_ASSIST = 2.6;
const ZERO_CD = (): Record<PowerId, number> => ({ punch: 0, blast: 0, dash: 0, freeze: 0, smash: 0, strike: 0 });

function savePrev(a: Actor) {
  a.prevX = a.x;
  a.prevY = a.y;
  a.prevZ = a.z;
}

/**
 * The whole game simulation. Pure TypeScript: no DOM, no audio, no storage.
 * Advance it with `update(input)` exactly once per fixed `STEP`; read side effects from `events`.
 *
 * Fields and the "combat API" methods are public because alien kits (aliens/*.ts), enemy AI
 * (enemies.ts), bosses (bosses/*.ts) and zones (zones.ts) all act through them.
 */
export class GameSim {
  status: GameStatus = "menu";
  player: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  rings: Ring[] = [];
  pickups: Pickup[] = [];
  slashes: Slash[] = [];
  zones: Zone[] = [];

  wave = 0;
  waveActive = false;
  toSpawn = 0;
  spawnCd = 0;
  waveBreak = 0;
  banner = 0;
  bannerText = "";
  score = 0;
  combo = 0;
  comboTimer = 0;
  /** Screen-shake strength (same scale as the 2D game: ~2 light … 24 huge). Decays every step. */
  shake = 0;
  /** Seconds since the last status change (drives the death animation / menu idle). */
  statusTime = 0;
  /** Shift Cores collected this run. */
  runCores = 0;
  /** Slow-motion sequence in progress (transform / ultimate), or null. */
  cinematic: Cinematic | null = null;
  /** Simulation speed requested by the sim itself (cinematics). The runtime multiplies frame time by it. */
  timeScale = 1;
  /** Set by the runtime while the watch wheel is open: the player ignores input. */
  inputLocked = false;
  /** Full-screen flash for big moments (0..1, fades), and its colour. */
  screenFlash = 0;
  screenFlashColor = "#ffffff";
  loadout: Loadout = DEFAULT_LOADOUT;
  mode: GameMode = "endless";
  /** The campaign level being played (null in Endless mode). */
  run: CampaignRun | null = null;
  /** What nests spawn in the current "destroy" stage. */
  nestPool: EnemyKind[] = [];
  /** Run statistics for the results screen. */
  kills = 0;
  damageTaken = 0;
  runTime = 0;
  result: LevelResult | null = null;
  /** Time Freeze power: robots, their bullets and telegraphs are paused while > 0. */
  timeFreeze = 0;
  /** Short slow-motion (big kills, Power Punch): real seconds left and the speed. */
  private slowMoT = 0;
  private slowMoScale = 1;
  /** Last movement input (Super Dash goes this way). */
  lastMove: MoveVector = { x: 0, z: 0 };
  /** Hit marker (player shots landing) and kill marker timers, for the HUD crosshair. */
  hitMarker = 0;
  killMarker = 0;
  /** Where the last hit landed (for the hit marker). */
  lastHitX = 0;
  lastHitY = 0;
  lastHitZ = 0;
  /** Rounds left in the guns Kai isn't holding. */
  private ammoBy: Partial<Record<WeaponId, number>> = {};

  /** Side effects queued this frame; the driver drains (and clears) this list. */
  readonly events: GameEvent[] = [];

  private nextId = 1;
  /** Cooldown between contact hits dealt by possessed allies (enemy id → seconds). */
  private allyHitCd = new Map<number, number>();

  constructor(
    readonly physics: Physics,
    readonly fx: FxSink = NO_FX,
  ) {
    this.player = this.newPlayer();
  }

  newId() {
    return this.nextId++;
  }

  private newPlayer(): Player {
    const f = FORMS.human;
    return {
      x: 0, y: 0, z: 2, vx: 0, vy: 0, vz: 0, prevX: 0, prevY: 0, prevZ: 2,
      radius: f.radius, height: f.height, onGround: true, fx: 0, fz: 1,
      body: this.physics.createActor(f.radius, f.height),
      form: "human", hp: this.maxHpFor(), maxHp: this.maxHpFor(), energy: 100, watchLocked: false, ult: 0, ultLockout: 0,
      attackCd: 0, heavyCd: 0, specialCd: 0, transformCd: 0,
      comboStep: -1, comboWindow: 0, attackBuffer: 0, holdTime: 0, heavyDone: true, lastAttack: "light",
      airSlam: false, slamDmg: 0, slamRadius: 0,
      attackAnim: 0, specialAnim: 0, hurtAnim: 0, dodgeTimer: 0, dodgeCd: 0, invuln: 0,
      dashTimer: 0, dashSpeed: 0, dashDmg: 0, dashKnock: 0, dashColor: "#facc15", dashHit: new Set(),
      rushTargets: [], rushTimer: 0, shieldTimer: 0, invisible: 0, slowTimer: 0,
      flash: 0, jumpsLeft: 0, dropTimer: 0,
      weapon: this.loadout.weapon, ammo: WEAPONS[this.loadout.weapon].magazine, reloadTimer: 0, fireCd: 0, shootAnim: 0, aimFx: 0, aimFz: 1,
      powerCd: ZERO_CD(), powerAnim: null, powerAnimT: 0, punchCharge: 0, airSpin: 0, strikeShots: 0, strikeTimer: 0, sinceHurt: 0, slamRocks: false,
    };
  }

  /** Kai's maximum health (base + Health upgrades). */
  private maxHpFor() {
    return RULES.player.maxHp + (agentLevelOf(this.loadout ?? DEFAULT_LOADOUT, "health") - 1) * RULES.player.healthPerUpgrade;
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  /**
   * Start a run. Endless = the original wave survival on the city street; campaign = one level
   * (its own layout, stages/checkpoints, hazards and shards).
   */
  startGame(loadout: Loadout = this.loadout, mode: GameMode = "endless", levelId = 1) {
    this.loadout = loadout;
    this.mode = mode;
    this.physics.removeActor(this.player.body);
    for (const e of this.enemies) this.physics.removeActor(e.body);
    for (const z of this.zones) if (z.handle >= 0) this.physics.removeWall(z.handle);
    const level = mode === "campaign" ? levelById(levelId) : null;
    if (level) setLayout(level.platforms, level.solids, level.gravity ?? 1, level.traction ?? 1);
    else setLayout();
    this.physics.rebuildStatic();
    this.player = this.newPlayer();
    this.ammoBy = {};
    this.run = null;
    this.nestPool = [];
    this.kills = 0;
    this.damageTaken = 0;
    this.runTime = 0;
    this.result = null;
    this.timeFreeze = 0;
    this.slowMoT = 0;
    this.hitMarker = 0;
    this.killMarker = 0;
    this.wave = 0;
    this.toSpawn = 0;
    this.waveActive = false;
    this.enemies = [];
    this.projectiles = [];
    this.rings = [];
    this.pickups = [];
    this.slashes = [];
    this.zones = [];
    this.allyHitCd.clear();
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 0;
    this.runCores = 0;
    this.cinematic = null;
    this.timeScale = 1;
    this.screenFlash = 0;
    this.setStatus("playing");
    if (level) startCampaign(this, level.id);
    else this.startWave(1);
  }

  /** After a defeat in the campaign: restart the current stage (checkpoint) with full health. */
  retryCheckpoint() {
    const run = this.run;
    if (!run || this.status !== "gameover") return;
    for (const e of this.enemies) this.physics.removeActor(e.body);
    for (const z of this.zones) if (z.handle >= 0) this.physics.removeWall(z.handle);
    this.enemies = [];
    this.projectiles = [];
    this.rings = [];
    this.zones = [];
    this.slashes = [];
    const body = this.player.body;
    this.physics.removeActor(body);
    this.player = this.newPlayer();
    this.cinematic = null;
    this.timeScale = 1;
    this.timeFreeze = 0;
    this.slowMoT = 0;
    this.screenFlash = 0;
    this.combo = 0;
    this.pickups = [];
    placeLevelObjects(this, run);
    this.setStatus("playing");
    beginStage(this, run, 2);
    this.showBanner(`CHECKPOINT ${run.stage + 1} — ${run.level.stages[run.stage].title.toUpperCase()}`, 2.4);
  }

  /** Called by the campaign when the last stage is cleared. */
  completeLevel() {
    const run = this.run;
    if (!run) return;
    const reward = Math.round(run.level.reward * this.difficulty.rewards);
    this.runCores += reward;
    this.events.push({ type: "cores", amount: reward });
    this.result = {
      levelId: run.level.id,
      time: this.runTime,
      kills: this.kills,
      shards: run.shards.filter(Boolean).length,
      shardsTotal: run.shards.length,
      cores: this.runCores,
      damageTaken: Math.round(this.damageTaken),
    };
    this.events.push({ type: "levelComplete", result: this.result });
    this.showBanner("LEVEL COMPLETE!", 3);
    this.sfx("levelComplete");
    this.flashScreen("#fef9c3", 0.6);
    this.setStatus("complete");
  }

  get difficulty() {
    return DIFFICULTY[this.loadout.difficulty] ?? DIFFICULTY.normal;
  }

  /** Telegraph time scaled by difficulty (longer warnings on Easy). */
  tele(seconds: number) {
    return seconds * this.difficulty.telegraph;
  }

  /** Boss attack gap multiplier: difficulty, and faster when enraged. */
  bossGap(e: Enemy) {
    return this.difficulty.bossGap * (e.enraged ? 0.6 : 1);
  }

  /** Kai's upgrade level (1–5) for one of his stats. */
  agentLevel(stat: AgentStat) {
    return agentLevelOf(this.loadout, stat);
  }

  /** Power damage multiplier and cooldown multiplier from the Power upgrade. */
  get powerMul() {
    return 1 + 0.12 * (this.agentLevel("power") - 1);
  }

  get powerCdMul() {
    return 1 - 0.08 * (this.agentLevel("power") - 1);
  }

  /** Brief slow motion: `scale` speed for `seconds` of real time. */
  slowMo(scale: number, seconds: number) {
    if (this.cinematic) return;
    this.slowMoScale = Math.min(this.slowMoT > 0 ? this.slowMoScale : 1, scale);
    this.slowMoT = Math.max(this.slowMoT, seconds);
  }

  /** A nest spawns one robot (see campaign.ts). */
  spawnFromNest(nest: Enemy) {
    nestSpawn(this, nest);
  }

  /** Leave a run and return to the main menu (robots and shots are cleared). */
  quitToMenu() {
    if (this.status === "menu") return;
    for (const e of this.enemies) this.physics.removeActor(e.body);
    for (const z of this.zones) if (z.handle >= 0) this.physics.removeWall(z.handle);
    this.enemies = [];
    this.projectiles = [];
    this.rings = [];
    this.zones = [];
    this.slashes = [];
    this.pickups = [];
    this.cinematic = null;
    this.timeScale = 1;
    this.timeFreeze = 0;
    this.slowMoT = 0;
    this.banner = 0;
    this.setStatus("menu");
  }

  togglePause() {
    if (this.status === "playing") this.setStatus("paused");
    else if (this.status === "paused") this.setStatus("playing");
  }

  /** Public so the HUD (watch dial, wheel) can trigger transformations. */
  requestTransform(id: FormId) {
    if (this.status === "playing") this.transform(id);
  }

  /** Advance timers that should run in every state (menu idle, death animation). */
  tickIdle(dt: number) {
    this.statusTime += dt;
  }

  isUnlocked(id: FormId) {
    return this.loadout.unlocked.includes(id);
  }

  hudSnapshot(): HudState {
    const p = this.player;
    const boss = this.enemies.find((e) => isBoss(e.kind));
    const run = this.run;
    const w = WEAPONS[p.weapon];
    return {
      status: this.status,
      form: p.form,
      hp: Math.max(0, Math.ceil(p.hp)),
      maxHp: p.maxHp,
      energy: p.energy,
      watchLocked: p.watchLocked,
      transformReady: p.transformCd <= 0,
      ult: p.ult,
      dodgeReady: p.dodgeCd <= 0,
      wave: this.wave,
      score: this.score,
      combo: this.combo,
      enemiesLeft: this.enemies.length + this.toSpawn,
      boss: boss ? { name: BOSSES[boss.kind as keyof typeof BOSSES].name, hp: Math.max(0, boss.hp / boss.maxHp), phase: boss.bossPhase, phases: BOSSES[boss.kind as keyof typeof BOSSES].phases, enraged: boss.enraged } : null,
      specialReady: p.form !== "human" && p.specialCd <= 0 && p.energy >= FORMS[p.form].specialCost,
      runCores: this.runCores,
      banner: this.banner > 0 && this.status === "playing" ? this.bannerText : "",
      cinematicTitle: this.cinematic?.kind === "ultimate" ? this.cinematic.title : "",
      blizzard: this.zones.some((z) => z.kind === "blizzard"),
      mode: this.mode,
      level: run?.level.id ?? 0,
      levelName: run?.level.name ?? "",
      objective: objectiveText(this),
      stage: run ? run.stage + 1 : 0,
      stages: run?.level.stages.length ?? 0,
      shards: run ? run.shards.filter(Boolean).length : 0,
      shardsTotal: run?.shards.length ?? 0,
      weapon: p.weapon,
      ammo: p.ammo,
      magazine: w.magazine,
      reloading: p.reloadTimer > 0 ? 1 - p.reloadTimer / this.reloadTime() : 0,
      powers: this.loadout.equippedPowers.map((id) => ({ id, cd: Math.max(0, p.powerCd[id] ?? 0), total: POWERS[id].cooldown * this.powerCdMul })),
      timeFreeze: this.timeFreeze > 0,
      result: this.result,
      hitMarker: this.hitMarker > 0 ? (this.killMarker > 0 ? 2 : 1) : 0,
    };
  }

  private setStatus(status: GameStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusTime = 0;
    this.events.push({ type: "status", status });
  }

  sfx(name: SfxName) {
    this.events.push({ type: "sfx", name });
  }

  addShake(amount: number) {
    this.shake = Math.max(this.shake, amount);
  }

  flashScreen(color: string, strength = 1) {
    this.screenFlash = Math.max(this.screenFlash, strength);
    this.screenFlashColor = color;
  }

  showBanner(text: string, seconds = 2.2) {
    this.bannerText = text;
    this.banner = seconds;
  }

  // ───────────────────────────── simulation ─────────────────────────────

  /** Advance one fixed step. Only call while `status === "playing"`. */
  update(input: InputSource) {
    if (input.wasPressed("pause")) {
      this.togglePause();
      return;
    }

    this.updateCinematic();
    const locked = this.cinematic !== null || this.inputLocked || this.player.rushTargets.length > 0;
    const inp = locked ? NO_INPUT : input;

    if (!locked) {
      ALIEN_ORDER.forEach((id, i) => {
        if (input.wasPressed(`t${i + 1}` as TransformAction)) this.transform(id);
      });
      if (input.wasPressed("revert")) this.transform("human");
      if (input.wasPressed("ultimate")) this.startUltimate();
    }

    this.runTime += STEP;
    this.timeFreeze = Math.max(0, this.timeFreeze - STEP);
    this.hitMarker = Math.max(0, this.hitMarker - STEP);
    this.killMarker = Math.max(0, this.killMarker - STEP);
    this.updatePlayer(inp);
    this.updateEnemies();
    this.updateProjectiles();
    this.updateRings();
    updateZones(this);
    this.updatePickups();
    this.updateSlashes();
    if (this.run) {
      updateCampaign(this);
      updateHazards(this);
    } else this.updateWaves();

    if (this.comboTimer > 0) {
      this.comboTimer -= STEP;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.shake = Math.max(0, this.shake - 0.6);
    this.screenFlash = Math.max(0, this.screenFlash - STEP * 2.5);
  }

  /** Integrate gravity + velocity through the physics world and update `onGround`. */
  moveActor(a: Actor, mode: PlatformMode, gravityScale = 1) {
    if (gravityScale > 0) a.vy = Math.max(a.vy - GRAVITY * gravityScale * WORLD.gravity * STEP, -MAX_FALL);
    const res = this.physics.moveActor(a, a.vx * STEP, a.vy * STEP, a.vz * STEP, mode);
    if (res.grounded && a.vy <= 0) {
      a.vy = 0;
      a.onGround = true;
    } else {
      a.onGround = false;
    }
    if (res.hitCeiling && a.vy > 0) a.vy = 0;
    if (a.y < 0) {
      a.y = 0;
      a.vy = Math.max(0, a.vy);
      a.onGround = true;
    }
  }

  private updateCinematic() {
    const c = this.cinematic;
    if (!c) {
      if (this.slowMoT > 0) {
        this.timeScale = this.slowMoScale;
        this.slowMoT -= STEP / this.timeScale;
      } else this.timeScale = 1;
      return;
    }
    this.timeScale = c.kind === "transform" ? 0.3 : 0.2;
    // The cinematic lasts a fixed *real* time, so undo the slow-motion when counting.
    c.t += STEP / this.timeScale;
    const p = this.player;
    if (c.kind === "transform") {
      if (!c.fired && c.t >= c.dur * 0.5) {
        c.fired = true;
        this.applyForm(c.form);
      } else if (!c.fired && Math.random() < 0.7) {
        // Energy shell gathering around Kai.
        const a = Math.random() * Math.PI * 2;
        this.fx.spark(p.x + Math.cos(a) * 1.4, p.y + rand(0, p.height + 0.5), p.z + Math.sin(a) * 1.4, -Math.cos(a) * 4, rand(0, 2), -Math.sin(a) * 4, "#4ade80", 0.35, 0);
      }
    }
    if (c.t >= c.dur) {
      if (c.kind === "ultimate" && !c.fired) {
        c.fired = true;
        this.flashScreen(FORMS[c.form].accent, 0.9);
        // Long-lasting ultimates (black hole, thorns, blizzard) must not refill the meter they just spent.
        this.player.ultLockout = 6.5;
        KITS[c.form].ultimate(this);
      }
      this.cinematic = null;
      this.timeScale = 1;
    }
  }

  private updatePlayer(input: InputSource) {
    const p = this.player;
    const f = FORMS[p.form];
    const kit = KITS[p.form];
    const human = p.form === "human";
    savePrev(p);

    p.attackCd -= STEP;
    p.heavyCd -= STEP;
    p.specialCd -= STEP;
    p.transformCd = Math.max(0, p.transformCd - STEP);
    p.comboWindow = Math.max(0, p.comboWindow - STEP);
    p.attackBuffer = Math.max(0, p.attackBuffer - STEP);
    p.attackAnim = Math.max(0, p.attackAnim - STEP);
    p.specialAnim = Math.max(0, p.specialAnim - STEP);
    p.hurtAnim = Math.max(0, p.hurtAnim - STEP);
    p.dodgeCd = Math.max(0, p.dodgeCd - STEP);
    p.ultLockout = Math.max(0, p.ultLockout - STEP);
    p.invuln = Math.max(0, p.invuln - STEP);
    p.flash = Math.max(0, p.flash - STEP);
    p.dropTimer = Math.max(0, p.dropTimer - STEP);
    p.shieldTimer = Math.max(0, p.shieldTimer - STEP);
    p.invisible = Math.max(0, p.invisible - STEP);
    p.slowTimer = Math.max(0, p.slowTimer - STEP);
    p.fireCd -= STEP;
    p.shootAnim = Math.max(0, p.shootAnim - STEP);
    p.powerAnimT = Math.max(0, p.powerAnimT - STEP);
    if (p.powerAnimT <= 0) p.powerAnim = null;
    p.airSpin = Math.max(0, p.airSpin - STEP);
    for (const id of POWER_ORDER) p.powerCd[id] = Math.max(0, p.powerCd[id] - STEP);
    this.updateHealth();
    if (p.reloadTimer > 0) {
      p.reloadTimer -= STEP;
      if (p.reloadTimer <= 0) {
        p.reloadTimer = 0;
        p.ammo = WEAPONS[p.weapon].magazine;
      }
    }

    const mobility = this.agentLevel("mobility");
    let gravityScale = f.gravityScale;
    if (p.rushTargets.length > 0) {
      this.updateRush();
      gravityScale = 0;
    } else if (p.dashTimer > 0) {
      p.dashTimer -= STEP;
      p.vx = p.fx * p.dashSpeed;
      p.vz = p.fz * p.dashSpeed;
      p.vy = 0;
      gravityScale = 0;
      for (const e of this.enemies) {
        if (!e.dead && e.allyTimer <= 0 && e.dying <= 0 && !p.dashHit.has(e.id) && actorsOverlap(p, e)) {
          p.dashHit.add(e.id);
          this.hurtEnemy(e, p.dashDmg, p.fx * p.dashKnock, p.fz * p.dashKnock, { heavy: true, pierceShield: p.form === "phantom" });
        }
      }
      this.fx.spark(p.x, p.y + rand(0.2, p.height), p.z, -p.fx * rand(2, 6), rand(-1, 1), -p.fz * rand(2, 6), p.dashColor, 0.3, 0);
    } else if (p.dodgeTimer > 0) {
      p.dodgeTimer -= STEP;
      // Velocity was set when the roll started; it only decays a little.
      p.vx *= 0.97;
      p.vz *= 0.97;
    } else if (p.punchCharge > 0) {
      // Power Punch wind-up: plant the feet, gather energy, then release the shockwave.
      p.punchCharge -= STEP;
      p.vx *= 0.7;
      p.vz *= 0.7;
      const a = Math.random() * Math.PI * 2;
      this.fx.spark(p.x + p.fx * 0.5 + Math.cos(a) * 0.8, p.y + 1.2 + Math.sin(a) * 0.5, p.z + p.fz * 0.5, -Math.cos(a) * 3, -Math.sin(a) * 2, 0, POWERS.punch.color, 0.25, 0);
      if (p.punchCharge <= 0) {
        p.punchCharge = 0;
        releasePowerPunch(this);
      }
    } else {
      const m = input.move();
      this.lastMove = m;
      const speed = f.speed * (p.slowTimer > 0 ? 0.5 : 1) * (human ? 1 + 0.06 * (this.agentLevel("speed") - 1) : 1);
      // Ice levels: low traction on the ground = slow to start and stop.
      const k = p.onGround ? 0.35 * WORLD.traction : 0.18;
      p.vx += (m.x * speed - p.vx) * k;
      p.vz += (m.z * speed - p.vz) * k;
      const mag = Math.hypot(m.x, m.z);
      if (mag > 0.1) {
        p.fx = m.x / mag;
        p.fz = m.z / mag;
      }

      const airJumps = f.airJumps + (human && mobility >= 4 ? 1 : 0);
      if (p.onGround) p.jumpsLeft = airJumps;
      if (input.wasPressed("jump") && (p.onGround || p.jumpsLeft > 0)) {
        if (!p.onGround) {
          p.jumpsLeft--;
          this.fx.burst(p.x, p.y, p.z, 10, f.accent, 3);
          // The air jump is a full 360° somersault.
          p.airSpin = 0.55;
          this.sfx("whoosh");
        } else this.sfx("jump");
        p.vy = f.jump * (human ? 1 + 0.05 * (mobility - 1) : 1);
        p.onGround = false;
        p.airSlam = false;
      }
      // Variable jump height: release early for a short hop.
      if (!input.isHeld("jump") && p.vy > 5 && !p.airSlam && p.strikeShots <= 0) p.vy -= JUMP_CUT * STEP;
      if (input.isHeld("drop") && p.onGround && p.y > 0.05) p.dropTimer = 0.25;

      if (input.wasPressed("dodge") && p.dodgeCd <= 0) this.startDodge(m.x, m.z);
    }

    // Air Strike: hover while the bolts rain down.
    if (p.strikeShots > 0) {
      if (p.vy < 0) gravityScale *= 0.15;
      p.strikeTimer -= STEP;
      if (p.strikeTimer <= 0) {
        p.strikeTimer = 0.12;
        if (fireStrikeBolt(this)) p.strikeShots--;
        else p.strikeShots = 0;
      }
    }

    const fallSpeed = -p.vy;
    const wasGrounded = p.onGround;
    this.moveActor(p, p.dropTimer > 0 ? "none" : "oneway", gravityScale);
    p.x = clamp(p.x, ARENA.minX + p.radius, ARENA.maxX - p.radius);
    p.z = clamp(p.z, ARENA.minZ + p.radius, ARENA.maxZ - p.radius);
    if (p.onGround && !wasGrounded) {
      p.airSpin = 0;
      if (p.airSlam) this.landAirSlam();
      else if ((p.form === "titan" || p.form === "behemoth") && fallSpeed > 16) {
        this.addShake(p.form === "behemoth" ? 10 : 6);
        this.fx.burst(p.x, p.y + 0.1, p.z, 14, "#a8a29e", 4);
      }
    }

    // Combat.
    const busy = p.dodgeTimer > 0 || p.dashTimer > 0 || p.rushTargets.length > 0 || p.punchCharge > 0;
    if (!busy) {
      if (human) {
        // Kai: hold SHOOT to fire (on the ground, running, jumping or falling), MELEE to punch.
        if (input.isHeld("attack")) this.tryShoot(input.aim());
        if (input.wasPressed("reload")) this.startReload();
        if (input.wasPressed("weapon")) this.cycleWeapon();
        if (input.wasPressed("melee")) p.attackBuffer = 0.2;
      } else {
        // Aliens: light on press (chains into a 3-hit combo), heavy when held.
        if (input.wasPressed("attack") || input.wasPressed("melee")) {
          p.holdTime = 0;
          p.heavyDone = false;
          p.attackBuffer = 0.2;
        }
        if (input.isHeld("attack")) {
          p.holdTime += STEP;
          if (!p.heavyDone && p.holdTime >= HEAVY_HOLD && p.heavyCd <= 0) {
            p.heavyDone = true;
            this.heavyAttack();
          }
        } else {
          p.heavyDone = true;
        }
        if (input.wasPressed("special") && p.specialCd <= 0) this.special();
      }
      if (p.attackBuffer > 0 && p.attackCd <= 0) {
        p.attackBuffer = 0;
        this.lightAttack();
      }
      // Kai's powers work in every form.
      (["power1", "power2", "power3"] as const).forEach((a, i) => {
        if (input.wasPressed(a)) this.usePower(i);
      });
    }

    // Shiftwatch energy (upgrades make it drain slower).
    const head = p.y + p.height + 0.4;
    if (!human) {
      if (!this.cinematic) p.energy -= ENERGY_DRAIN * drainMul(this.level) * STEP;
      if (p.energy <= 0) {
        p.energy = 0;
        p.watchLocked = true;
        this.transform("human", true);
        this.fx.text(p.x, head, p.z, "WATCH TIMED OUT!", "#ef4444", 18);
        this.sfx("timeout");
      }
    } else {
      p.energy = Math.min(100, p.energy + ENERGY_RECHARGE * STEP);
      if (p.watchLocked && p.energy >= UNLOCK_ENERGY) {
        p.watchLocked = false;
        this.fx.text(p.x, head, p.z, "WATCH READY", "#22c55e", 16);
        this.sfx("pickup");
      }
    }

    kit.tick?.(this);
  }

  /** Regeneration after a few seconds without damage (scaled by difficulty; none on Nightmare). */
  private updateHealth() {
    const p = this.player;
    p.sinceHurt += STEP;
    const rate = RULES.player.regenPerSec * this.difficulty.regen;
    if (p.sinceHurt >= RULES.player.regenDelay && p.hp < p.maxHp && rate > 0) p.hp = Math.min(p.maxHp, p.hp + rate * STEP);
  }

  // ───────────────────────────── Kai's guns ─────────────────────────────

  private reloadTime() {
    return WEAPONS[this.player.weapon].reload * (1 - 0.08 * (this.agentLevel("fireRate") - 1));
  }

  startReload() {
    const p = this.player;
    if (p.reloadTimer > 0 || p.ammo >= WEAPONS[p.weapon].magazine) return;
    p.reloadTimer = this.reloadTime();
    this.sfx("reload");
  }

  /** Switch to the next gun Kai owns (each keeps its own magazine). */
  cycleWeapon() {
    const p = this.player;
    const owned = WEAPON_ORDER.filter((w) => this.loadout.weapons.includes(w));
    if (owned.length < 2) {
      this.fx.text(p.x, p.y + p.height + 0.3, p.z, "BUY GUNS IN THE SHIFT LAB", "#fca5a5", 12);
      this.sfx("error");
      return;
    }
    this.ammoBy[p.weapon] = p.ammo;
    const next = owned[(owned.indexOf(p.weapon) + 1) % owned.length];
    p.weapon = next;
    p.ammo = this.ammoBy[next] ?? WEAPONS[next].magazine;
    p.reloadTimer = 0;
    p.fireCd = Math.max(p.fireCd, 0.2);
    this.fx.text(p.x, p.y + p.height + 0.3, p.z, WEAPONS[next].name.toUpperCase(), WEAPONS[next].color, 13);
    this.sfx("reload");
  }

  /** Where Kai's gun points: the mouse aim point (with a soft lock), else auto-aim — 360° in the air. */
  private gunAim(aim: MoveVector | null): Vec3 {
    const p = this.player;
    const ox = p.x;
    const oy = p.y + p.height * 0.72;
    const oz = p.z;
    let target: Enemy | null = null;
    if (aim) {
      let best = MOUSE_ASSIST;
      for (const e of this.enemies) {
        if (e.dead || e.allyTimer > 0 || e.dying > 0) continue;
        const d = Math.hypot(e.x - aim.x, e.z - aim.z) - e.radius;
        if (d < best) {
          best = d;
          target = e;
        }
      }
      if (!target) {
        const dx = aim.x - ox;
        const dz = aim.z - oz;
        const d = Math.hypot(dx, dz) || 1;
        return [dx / d, 0, dz / d];
      }
    } else {
      // acquireTarget turns the body; the gun aims on its own (the legs keep running).
      const fx = p.fx;
      const fz = p.fz;
      // In front first; otherwise the nearest robot in any direction (always 360° in the air).
      target = this.acquireTarget(GUN_AIM_RANGE, p.onGround ? AIM_CONE_COS : -1) ?? this.acquireTarget(GUN_AIM_RANGE * 0.7, -1);
      p.fx = fx;
      p.fz = fz;
    }
    if (!target) return [p.fx, 0, p.fz];
    const dx = target.x - ox;
    const dy = target.y + target.height / 2 - oy;
    const dz = target.z - oz;
    const d = Math.hypot(dx, dy, dz) || 1;
    return [dx / d, dy / d, dz / d];
  }

  private tryShoot(aim: MoveVector | null) {
    const p = this.player;
    if (p.fireCd > 0 || p.reloadTimer > 0) return;
    const w = WEAPONS[p.weapon];
    if (p.ammo <= 0) {
      this.sfx("empty");
      this.startReload();
      return;
    }
    p.fireCd = 1 / (w.fireRate * (1 + 0.1 * (this.agentLevel("fireRate") - 1)));
    p.ammo--;
    const dir = this.gunAim(aim);
    const flat = Math.hypot(dir[0], dir[2]) || 1;
    p.aimFx = dir[0] / flat;
    p.aimFz = dir[2] / flat;
    p.shootAnim = 0.16;
    const mx = p.x + p.aimFx * 0.55;
    const my = p.y + p.height * 0.72;
    const mz = p.z + p.aimFz * 0.55;
    for (let i = 0; i < w.pellets; i++) {
      const d = spread(dir, rand(-w.spread, w.spread));
      const vy = d[1] + (w.pellets > 1 ? rand(-0.06, 0.06) : 0);
      this.projectiles.push({
        x: mx, y: my, z: mz, vx: d[0] * w.speed, vy: vy * w.speed, vz: d[2] * w.speed, r: w.radius, dmg: w.dmg * this.mul,
        owner: "player", kind: w.kind, life: w.life, pierce: false, hit: new Set(), aoe: w.aoe, slow: 0, pull: 0, heavy: w.heavy,
      });
    }
    // Muzzle flash + recoil.
    this.fx.burst(mx + p.aimFx * 0.25, my, mz + p.aimFz * 0.25, w.pellets > 1 ? 8 : 4, w.color, 3);
    if (w.kick > 0) this.addShake(w.kick);
    this.sfx(p.weapon === "plasma" ? "plasmaShot" : p.weapon);
    if (p.ammo <= 0) this.startReload();
  }

  // ───────────────────────────── Kai's powers ─────────────────────────────

  /** Use the power in slot 0–2 (E / R / T or the power buttons). */
  usePower(slot: number) {
    const p = this.player;
    const id = this.loadout.equippedPowers[slot];
    if (!id || this.status !== "playing" || this.cinematic) return;
    const def = POWERS[id];
    if (!this.loadout.powers.includes(id)) {
      this.fx.text(p.x, p.y + p.height + 0.3, p.z, `${def.name.toUpperCase()} LOCKED`, "#fca5a5", 13);
      this.sfx("error");
      return;
    }
    if (p.powerCd[id] > 0) {
      this.fx.text(p.x, p.y + p.height + 0.3, p.z, `${def.name.toUpperCase()} · ${Math.ceil(p.powerCd[id])}s`, "#fca5a5", 13);
      this.sfx("error");
      return;
    }
    if (p.dashTimer > 0 || p.rushTargets.length > 0 || p.punchCharge > 0) return;
    p.powerCd[id] = def.cooldown * this.powerCdMul;
    p.powerAnim = id;
    p.powerAnimT = 0.5;
    p.specialAnim = 0.45;
    p.dodgeTimer = 0;
    def.activate(this);
    this.fx.text(p.x, p.y + p.height + 0.6, p.z, def.name.toUpperCase() + "!", def.color, 17);
  }

  private startDodge(mx: number, mz: number) {
    const p = this.player;
    const mag = Math.hypot(mx, mz);
    const dx = mag > 0.1 ? mx / mag : p.fx;
    const dz = mag > 0.1 ? mz / mag : p.fz;
    p.fx = dx;
    p.fz = dz;
    p.vx = dx * DODGE_SPEED;
    p.vz = dz * DODGE_SPEED;
    p.dodgeTimer = DODGE_TIME;
    p.dodgeCd = DODGE_COOLDOWN * (p.form === "human" ? 1 - 0.1 * (this.agentLevel("mobility") - 1) : 1);
    p.invuln = Math.max(p.invuln, DODGE_IFRAMES);
    p.airSlam = false;
    this.fx.burst(p.x, p.y + 0.2, p.z, 8, "#e5e7eb", 3);
    this.sfx("dodge");
  }

  private lightAttack() {
    const p = this.player;
    const kit = KITS[p.form];
    const f = FORMS[p.form];
    p.attackAnim = 0.2;
    if (!p.onGround) {
      p.lastAttack = "air";
      p.comboStep = -1;
      kit.light(this);
      p.attackCd = f.attackCooldown;
      return;
    }
    p.comboStep = p.comboWindow > 0 ? p.comboStep + 1 : 0;
    p.comboWindow = COMBO_WINDOW;
    if (p.comboStep >= 2) {
      // Third hit in the chain: the finisher (upgraded into the combo move at level 3).
      p.lastAttack = "finisher";
      p.attackAnim = 0.3;
      kit.finisher(this, this.level >= COMBO_MOVE_LEVEL);
      p.comboStep = -1;
      p.comboWindow = 0;
      p.attackCd = f.attackCooldown * 1.6;
    } else {
      p.lastAttack = "light";
      kit.light(this);
      p.attackCd = f.attackCooldown;
    }
  }

  private heavyAttack() {
    const p = this.player;
    p.lastAttack = "heavy";
    p.attackAnim = 0.35;
    p.heavyCd = HEAVY_COOLDOWN;
    p.attackCd = Math.max(p.attackCd, 0.25);
    p.comboStep = -1;
    if (!p.onGround) {
      // Heavy in the air: dive down and slam on landing.
      p.airSlam = true;
      p.slamDmg = 18;
      p.slamRadius = 2.8;
      p.vy = -26;
      return;
    }
    KITS[p.form].heavy(this);
  }

  private landAirSlam() {
    const p = this.player;
    p.airSlam = false;
    const color = FORMS[p.form].accent;
    this.area(p.x, p.y, p.z, p.slamRadius, p.slamDmg, 12, { ground: true, heavy: true, launch: true });
    this.ring("shock", p.x, p.y, p.z, p.slamRadius, 0.35, 0, color, 0);
    this.fx.burst(p.x, p.y + 0.2, p.z, 24, "#a8a29e", 6);
    this.addShake(p.slamRadius > 4 ? 20 : 8);
    this.sfx("heavy");
    if (p.slamRocks) {
      // Ground Smash: rock spikes burst up in a ring around the crater.
      p.slamRocks = false;
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10;
        const r = p.slamRadius * 0.75;
        this.zone({ kind: "blast", style: "rock", x: p.x + Math.cos(a) * r, y: p.y, z: p.z + Math.sin(a) * r, r: 1.4, delay: 0.12 + (i % 2) * 0.08, life: 0.9, dmg: p.slamDmg * 0.4, color: "#fb923c" }, false);
      }
      this.flashScreen("#fed7aa", 0.35);
      this.sfx("impact");
    }
  }

  private special() {
    const p = this.player;
    const f = FORMS[p.form];
    if (p.form === "human") return;
    if (p.energy < f.specialCost) {
      this.fx.text(p.x, p.y + p.height + 0.3, p.z, "LOW ENERGY", "#fca5a5", 14);
      this.sfx("error");
      return;
    }
    p.energy -= f.specialCost;
    p.specialCd = f.specialCooldown * specialCdMul(this.level);
    p.specialAnim = 0.45;
    KITS[p.form].special(this);
  }

  private startUltimate() {
    const p = this.player;
    if (p.form === "human" || p.ult < 100 || this.cinematic) {
      this.sfx("error");
      if (p.form !== "human" && p.ult < 100) this.fx.text(p.x, p.y + p.height + 0.3, p.z, "ULTIMATE NOT READY", "#fca5a5", 13);
      return;
    }
    p.ult = 0;
    p.invuln = Math.max(p.invuln, 1.6);
    p.specialAnim = 0.9;
    p.vx = p.vz = 0;
    this.cinematic = { kind: "ultimate", t: 0, dur: ULTIMATE_CINEMATIC, form: p.form, title: FORMS[p.form].ultimateLabel.toUpperCase(), fired: false };
    this.sfx("ultimate");
  }

  private transform(id: FormId, forced = false) {
    const p = this.player;
    if (id === p.form || (this.cinematic && !forced)) return;
    if (!forced) {
      if (!this.isUnlocked(id)) {
        this.fx.text(p.x, p.y + p.height + 0.3, p.z, `${FORMS[id].name.toUpperCase()} LOCKED`, "#fca5a5", 14);
        this.sfx("error");
        return;
      }
      // Cooldown applies to every voluntary change (reverting too), otherwise
      // alternating revert/transform would chain the transform i-frames forever.
      if (p.transformCd > 0) {
        this.sfx("error");
        return;
      }
      if (id !== "human" && (p.watchLocked || p.energy < TRANSFORM_MIN_ENERGY)) {
        this.fx.text(p.x, p.y + p.height + 0.3, p.z, "RECHARGING…", "#fca5a5", 14);
        this.sfx("error");
        return;
      }
    }
    p.transformCd = TRANSFORM_COOLDOWN;
    if (!forced && id !== "human" && !this.loadout.skipTransformCinematic) {
      // Short slow-motion sequence; the form actually switches halfway through (see updateCinematic).
      p.invuln = Math.max(p.invuln, 0.8);
      p.vx = p.vz = 0;
      this.cinematic = { kind: "transform", t: 0, dur: TRANSFORM_CINEMATIC, form: id, title: "", fired: false };
      this.sfx("sting");
      return;
    }
    this.applyForm(id, forced);
  }

  private applyForm(id: FormId, forced = false) {
    const p = this.player;
    const nf = FORMS[id];
    p.form = id;
    p.radius = nf.radius;
    p.height = nf.height;
    this.physics.resizeActor(p.body, nf.radius, nf.height);
    p.flash = 0.45;
    p.invuln = Math.max(p.invuln, 0.4);
    p.shieldTimer = 0;
    p.dashTimer = 0;
    p.invisible = 0;
    p.airSlam = false;
    p.attackCd = 0.15;
    p.comboStep = -1;
    this.fx.burst(p.x, p.y + p.height / 2, p.z, 40, "#22c55e", 6);
    if (!forced) {
      this.fx.text(p.x, p.y + p.height + 0.5, p.z, id === "human" ? "KAI" : nf.name.toUpperCase() + "!", nf.accent, 20);
      this.sfx("transform");
    }
  }

  // ───────────────────────────── combat API (used by kits) ─────────────────────────────

  /** Upgrade level (1–5) of the current form, and its damage multiplier. */
  get level() {
    return levelOf(this.loadout, this.player.form);
  }

  /** Damage multiplier: the alien's upgrade level, or Kai's Damage upgrade in human form. */
  get mul() {
    return this.player.form === "human" ? 1 + 0.12 * (this.agentLevel("damage") - 1) : damageMul(this.level);
  }

  /** Point just in front of the player's chest, where shots start. */
  muzzle(): Vec3 {
    const p = this.player;
    return [p.x + p.fx * (p.radius + 0.2), p.y + p.height * 0.6, p.z + p.fz * (p.radius + 0.2)];
  }

  /**
   * Nearest hostile enemy within `range` whose direction is inside the aim cone around the
   * player's facing. The player turns to face it, so attacks visibly lock on.
   */
  acquireTarget(range = AIM_RANGE, coneCos = AIM_CONE_COS): Enemy | null {
    const p = this.player;
    let best: Enemy | null = null;
    let bestD = range * range;
    for (const e of this.enemies) {
      if (e.dead || e.allyTimer > 0 || e.dying > 0) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > bestD) continue;
      const d = Math.sqrt(d2) || 1;
      if ((dx * p.fx + dz * p.fz) / d < coneCos && d > e.radius + p.radius) continue;
      best = e;
      bestD = d2;
    }
    if (best) {
      const dx = best.x - p.x;
      const dz = best.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.01) {
        p.fx = dx / d;
        p.fz = dz / d;
      }
    }
    return best;
  }

  /** Unit direction from (x, y, z) to the target's centre, or flat along the facing without one. */
  aimFrom(x: number, y: number, z: number, target: Enemy | null): Vec3 {
    const p = this.player;
    if (!target) return [p.fx, 0, p.fz];
    const dx = target.x - x;
    const dy = target.y + target.height / 2 - y;
    const dz = target.z - z;
    const d = Math.hypot(dx, dy, dz) || 1;
    return [dx / d, dy / d, dz / d];
  }

  /** Fire a player projectile from the muzzle (damage is scaled by the upgrade multiplier). */
  fire(kind: ProjectileKind, dir: Vec3, speed: number, r: number, dmg: number, life: number, extra: Partial<Projectile> = {}, scaled = true) {
    const [x, y, z] = this.muzzle();
    this.projectiles.push({
      x, y, z, vx: dir[0] * speed, vy: dir[1] * speed, vz: dir[2] * speed, r, dmg: scaled ? dmg * this.mul : dmg,
      owner: "player", kind, life, pierce: false, hit: new Set(), aoe: 0, slow: 0, pull: 0, heavy: false, ...extra,
    });
  }

  /**
   * Melee arc in front of the player. Soft lock-on turns towards a nearby robot first.
   * Returns how many enemies were hit. `arc` is the half-angle in radians (π = full spin).
   */
  melee(range: number, dmg: number, knock: number, color: string, o: HitOpts & { arc?: number } = {}) {
    const p = this.player;
    const arc = o.arc ?? MELEE_ARC;
    if (arc < Math.PI) {
      if (!this.acquireTarget(range + 1.5, Math.cos((50 * Math.PI) / 180))) this.acquireTarget(2.5, -1);
    }
    const coneCos = Math.cos(arc);
    const bandLo = p.y + p.height * 0.05 - 0.3;
    const bandHi = p.y + p.height * 0.95 + 0.3;
    this.slashes.push({ x: p.x, y: p.y + Math.min(1.2, p.height * 0.55), z: p.z, fx: p.fx, fz: p.fz, range: range + p.radius, arc, color, life: 0.18, maxLife: 0.18 });

    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead || e.allyTimer > 0 || e.y > bandHi || e.y + e.height < bandLo) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.radius + p.radius * 0.5) continue;
      const touching = d < e.radius + p.radius;
      if (!touching && (dx * p.fx + dz * p.fz) / d < coneCos) continue;
      const nx = d > 0.01 ? dx / d : p.fx;
      const nz = d > 0.01 ? dz / d : p.fz;
      if (this.hurtEnemy(e, dmg * this.mul, nx * knock, nz * knock, o)) hits++;
    }
    // Melee also swats enemy bullets out of the air.
    for (const pr of this.projectiles) {
      if (pr.owner !== "enemy" || pr.y < bandLo || pr.y > bandHi) continue;
      const dx = pr.x - p.x;
      const dz = pr.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < range + p.radius + pr.r && (d < p.radius || (dx * p.fx + dz * p.fz) / d >= coneCos)) pr.life = 0;
    }
    return hits;
  }

  /**
   * Radial damage around a point. Player-owned areas hurt enemies (scaled by the upgrade
   * multiplier); enemy-owned areas hurt the player. Returns how many targets were hit.
   */
  area(x: number, y: number, z: number, r: number, dmg: number, knock: number, o: AreaOpts = {}) {
    const height = o.height ?? 2.2;
    if (o.owner === "enemy") {
      const p = this.player;
      const dx = p.x - x;
      const dz = p.z - z;
      const d = Math.hypot(dx, dz);
      if (d > r + p.radius || p.y > y + height || p.y + p.height < y - height) return 0;
      if (o.ground && p.y > floorHeightAt(p.x, p.z, p.y + 0.05) + 0.8) return 0;
      this.hurtPlayer(dmg, d > 0.01 ? dx / d : 1, d > 0.01 ? dz / d : 0);
      return 1;
    }
    let hits = 0;
    for (const e of this.enemies) {
      if (e.dead || e.allyTimer > 0) continue;
      const dx = e.x - x;
      const dz = e.z - z;
      const d = Math.hypot(dx, dz);
      if (d > r + e.radius) continue;
      if (o.ground ? e.y > y + 1 : e.y > y + height || e.y + e.height < y - height) continue;
      const nx = d > 0.01 ? dx / d : 1;
      const nz = d > 0.01 ? dz / d : 0;
      if (this.hurtEnemy(e, dmg * (o.raw || o.noUlt ? 1 : this.mul), nx * knock, nz * knock, { ...o, sx: x, sz: z })) hits++;
    }
    return hits;
  }

  /**
   * Instant laser (hitscan) from a point along a unit direction. Stops at the first enemy
   * (or passes through all of them with `pierce`) and at cover. Leaves a short beam effect.
   */
  beam(ox: number, oy: number, oz: number, dir: Vec3, range: number, dmg: number, color: string, o: HitOpts & { pierce?: boolean; width?: number; scaled?: boolean } = {}) {
    const wall = this.physics.raycastStatic(ox, oy, oz, dir[0], dir[1], dir[2], range);
    let end = wall ?? range;
    const hits: { e: Enemy; t: number }[] = [];
    const width = o.width ?? 0.25;
    for (const e of this.enemies) {
      if (e.dead || e.allyTimer > 0) continue;
      // Closest approach of the ray to the enemy's vertical axis, then a height check.
      const ex = e.x - ox;
      const ez = e.z - oz;
      const flat = Math.hypot(dir[0], dir[2]) || 1;
      const t = (ex * dir[0] + ez * dir[2]) / (flat * flat);
      if (t < 0 || t > end) continue;
      const px = ox + dir[0] * t - e.x;
      const pz = oz + dir[2] * t - e.z;
      const py = oy + dir[1] * t;
      if (Math.hypot(px, pz) > e.radius + width || py < e.y - width || py > e.y + e.height + width) continue;
      hits.push({ e, t });
    }
    hits.sort((a, b) => a.t - b.t);
    const scale = o.scaled === false ? 1 : this.mul;
    for (const h of hits) {
      this.hurtEnemy(h.e, dmg * scale, dir[0] * 4, dir[2] * 4, { ...o, sx: ox, sz: oz });
      if (!o.pierce) {
        end = h.t;
        break;
      }
    }
    this.zone({ kind: "beam", owner: "player", x: ox, y: oy, z: oz, x2: ox + dir[0] * end, y2: oy + dir[1] * end, z2: oz + dir[2] * end, life: 0.14, r: width, color });
    this.fx.burst(ox + dir[0] * end, oy + dir[1] * end, oz + dir[2] * end, 4, color, 2);
    return hits.length;
  }

  ring(kind: Ring["kind"], x: number, y: number, z: number, maxR: number, life: number, dmg: number, color: string, knock: number, owner: Ring["owner"] = "player") {
    this.rings.push({ kind, x, y, z, maxR, life, maxLife: life, dmg: owner === "player" ? dmg * this.mul : dmg, knock, color, owner, hit: new Set() });
  }

  /** Spawn a zone (see zones.ts). Player-owned damage is scaled by the upgrade multiplier. */
  zone(z: Partial<Zone> & { kind: ZoneKind }, scaled = true): Zone {
    const zone: Zone = {
      id: this.newId(), style: "plain", owner: "player", x: 0, y: 0, z: 0, x2: 0, y2: 0, z2: 0, r: 1, angle: 0, spin: 0,
      t: 0, delay: 0, life: 1, dmg: 0, tick: 0, color: "#ffffff", hit: new Set(), handle: -1, source: -1, ...z,
    };
    if (scaled && zone.owner === "player" && zone.kind !== "beam") zone.dmg *= this.mul;
    this.zones.push(zone);
    return zone;
  }

  /** Charge forward (Bolt's dash, Behemoth's rampage, Phantom's lunge…): hits everything passed through. */
  dash(dirX: number, dirZ: number, speed: number, time: number, dmg: number, knock: number, color: string, scaled = true) {
    const p = this.player;
    const d = Math.hypot(dirX, dirZ) || 1;
    p.fx = dirX / d;
    p.fz = dirZ / d;
    p.dashTimer = time;
    p.dashSpeed = speed;
    p.dashDmg = scaled ? dmg * this.mul : dmg;
    p.dashKnock = knock;
    p.dashColor = color;
    p.dashHit.clear();
    p.invuln = Math.max(p.invuln, time + 0.05);
  }

  /** Bolt's Storm Rush: blink from enemy to enemy (up to `max`), striking each one. */
  startRush(max: number) {
    const p = this.player;
    const targets = this.enemies
      .filter((e) => !e.dead && e.allyTimer <= 0 && e.dying <= 0)
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))
      .slice(0, max)
      .map((e) => e.id);
    p.rushTargets = targets;
    p.rushTimer = 0;
  }

  private updateRush() {
    const p = this.player;
    p.invuln = Math.max(p.invuln, 0.3);
    p.vx = p.vy = p.vz = 0;
    p.rushTimer -= STEP;
    if (p.rushTimer > 0) return;
    p.rushTimer = 0.07;
    let e: Enemy | undefined;
    while (p.rushTargets.length && !(e = this.enemies.find((x) => x.id === p.rushTargets[0] && !x.dead))) p.rushTargets.shift();
    if (!e) return;
    p.rushTargets.shift();
    const fromX = p.x;
    const fromY = p.y + p.height / 2;
    const fromZ = p.z;
    // Land beside the target, facing it.
    const dx = p.x - e.x;
    const dz = p.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    p.x = clamp(e.x + (dx / d) * (e.radius + p.radius + 0.2), ARENA.minX + p.radius, ARENA.maxX - p.radius);
    p.z = clamp(e.z + (dz / d) * (e.radius + p.radius + 0.2), ARENA.minZ + p.radius, ARENA.maxZ - p.radius);
    p.y = Math.max(floorHeightAt(p.x, p.z, e.y + 0.5), Math.min(e.y, 4));
    p.fx = -dx / d;
    p.fz = -dz / d;
    savePrev(p);
    this.zone({ kind: "beam", x: fromX, y: fromY, z: fromZ, x2: p.x, y2: p.y + p.height / 2, z2: p.z, life: 0.25, r: 0.12, color: "#fde047" });
    this.hurtEnemy(e, 45 * this.mul, p.fx * 6, p.fz * 6, { stun: 0.6, heavy: true });
    this.fx.burst(e.x, e.y + e.height / 2, e.z, 12, "#facc15", 5);
    this.sfx("zap");
  }

  /** Living hostile enemies within `r` of (x, z). */
  enemiesNear(x: number, z: number, r: number): Enemy[] {
    return this.enemies.filter((e) => !e.dead && e.allyTimer <= 0 && e.dying <= 0 && Math.hypot(e.x - x, e.z - z) <= r + e.radius);
  }

  healPlayer(amount: number) {
    const p = this.player;
    const healed = Math.min(p.maxHp - p.hp, amount);
    if (healed <= 0) return;
    p.hp += healed;
    this.fx.text(p.x, p.y + p.height + 0.4, p.z, `+${Math.round(healed)} HP`, "#f472b6", 16);
  }

  /** Apply damage + status effects to an enemy. Returns false if the hit was blocked or ignored. */
  hurtEnemy(e: Enemy, dmg: number, kx: number, kz: number, o: HitOpts = {}): boolean {
    if (e.dead || e.invuln > 0 || e.dying > 0) return false;
    const p = this.player;

    // Warden shields block hits from the front; heavy hits crack them, Phantom ignores them.
    if (e.shieldHp > 0 && !o.pierceShield) {
      const sx = (o.sx ?? p.x) - e.x;
      const sz = (o.sz ?? p.z) - e.z;
      const sd = Math.hypot(sx, sz) || 1;
      if ((sx * e.fx + sz * e.fz) / sd > 0.3) {
        if (!o.heavy) {
          this.fx.text(e.x, e.y + e.height + 0.3, e.z, "BLOCK", "#93c5fd", 12);
          this.fx.burst(e.x + e.fx * e.radius, e.y + e.height * 0.5, e.z + e.fz * e.radius, 5, "#93c5fd", 3);
          this.sfx("block");
          return false;
        }
        e.shieldHp -= dmg * 1.5;
        if (e.shieldHp <= 0) {
          e.shieldHp = 0;
          e.stunTimer = Math.max(e.stunTimer, 1.5);
          this.fx.text(e.x, e.y + e.height + 0.4, e.z, "SHIELD BROKEN!", "#60a5fa", 14);
          this.fx.burst(e.x + e.fx * e.radius, e.y + e.height * 0.5, e.z + e.fz * e.radius, 20, "#93c5fd", 6);
          this.sfx("explode");
        } else {
          this.fx.text(e.x, e.y + e.height + 0.3, e.z, "CRACK", "#93c5fd", 12);
          this.sfx("block");
        }
        return true;
      }
    }

    // Striking from Phantom's vanish is a critical hit.
    let amount = dmg;
    if (!o.noUlt && p.invisible > 0) amount *= 2;

    e.hp -= amount;
    e.hitFlash = 0.1;
    const boss = isBoss(e.kind);
    const def = ENEMY_DEFS[e.kind];
    if (!boss && e.rootTimer <= 0 && def.knock > 0) {
      const k = def.knock * (e.elite ? 0.6 : 1);
      e.vx = kx * k;
      e.vz = kz * k;
      if ((o.launch || Math.hypot(kx, kz) > 12) && !def.flying) e.vy = o.launch ? 9 : 6;
    }
    if (!o.noUlt) {
      this.hitMarker = 0.18;
      this.lastHitX = e.x;
      this.lastHitY = e.y + e.height / 2;
      this.lastHitZ = e.z;
    }
    if (o.stun) e.stunTimer = Math.max(e.stunTimer, boss ? o.stun * 0.3 : o.stun);
    if (o.slow) e.slowTimer = Math.max(e.slowTimer, o.slow);
    if (o.freeze) e.frozenTimer = Math.max(e.frozenTimer, boss ? o.freeze * 0.3 : o.freeze);
    if (o.root && !boss) e.rootTimer = Math.max(e.rootTimer, o.root);
    if (o.lift && !boss) e.liftTimer = Math.max(e.liftTimer, o.lift);
    if (!o.noUlt && p.ultLockout <= 0) p.ult = Math.min(100, p.ult + amount * ULT_PER_DAMAGE);

    this.fx.text(e.x + rand(-0.3, 0.3), e.y + e.height + 0.2, e.z, String(Math.round(amount)), amount > dmg ? "#f0abfc" : "#fef08a", amount > dmg ? 16 : 13);
    this.fx.burst(e.x, e.y + e.height / 2, e.z, 5, "#fde68a", 3);
    this.sfx("hit");
    if (e.hp <= 0) this.killEnemy(e);
    return true;
  }

  hurtPlayer(dmg: number, dirX: number, dirZ: number) {
    const p = this.player;
    if (p.invuln > 0 || p.dashTimer > 0 || p.invisible > 0 || this.cinematic || this.status !== "playing") return;
    if (p.shieldTimer > 0) {
      this.fx.burst(p.x, p.y + p.height / 2, p.z, 6, "#a5f3fc", 3);
      return;
    }
    // Difficulty scales every source of damage here, in one place.
    const amount = Math.max(1, Math.round(dmg * this.difficulty.enemyDmg * FORMS[p.form].armor));
    p.hp -= amount;
    this.damageTaken += amount;
    p.sinceHurt = 0;
    p.invuln = RULES.player.hurtInvuln;
    p.hurtAnim = 0.35;
    p.airSlam = false;
    p.punchCharge = 0;
    const heavy = amount >= 30;
    p.vx = dirX * (heavy ? 12 : 9);
    p.vz = dirZ * (heavy ? 12 : 9);
    p.vy = heavy ? 8 : 6;
    this.addShake(heavy ? 14 : 8);
    this.flashScreen("#dc2626", heavy ? 0.45 : 0.25);
    this.combo = 0;
    this.fx.text(p.x, p.y + p.height + 0.2, p.z, `-${amount}`, "#ef4444", heavy ? 20 : 16);
    this.fx.burst(p.x, p.y + p.height / 2, p.z, 16, "#ef4444", 4);
    this.sfx("hurt");
    if (p.hp <= 0) this.gameOver();
  }

  private gameOver() {
    this.setStatus("gameover");
    this.cinematic = null;
    this.timeScale = 1;
    const p = this.player;
    this.fx.burst(p.x, p.y + p.height / 2, p.z, 60, "#22c55e", 7);
    this.sfx("gameOver");
  }

  // ───────────────────────────── enemies ─────────────────────────────

  /**
   * Create an enemy of a kind at a position. Bosses scale with `hpScale` (Endless cycles, later
   * levels); regular robots scale with the wave / level. Difficulty scales HP and speed here and
   * damage in hurtPlayer. `elite` makes the gold-trimmed elite variant of a regular robot.
   */
  makeEnemy(kind: EnemyKind, x: number, y: number, z: number, hpScale = 1, elite = false): Enemy {
    const def = ENEMY_DEFS[kind];
    const diff = this.difficulty;
    const scale = this.run ? 1 + (this.run.level.id - 1) * 0.07 : 1 + (this.wave - 1) * 0.1;
    const eliteMul = elite ? ELITE_HP : 1;
    const hp = Math.round(def.hp * (isBoss(kind) ? hpScale : scale) * diff.enemyHp * eliteMul);
    const size = elite ? 1.15 : 1;
    const radius = def.radius * size;
    const height = def.height * size;
    const body = def.walker ? this.physics.createActor(radius, height) : -1;
    return {
      id: this.newId(), kind, x, y, z, vx: 0, vy: 0, vz: 0, prevX: x, prevY: y, prevZ: z,
      radius, height, onGround: false, fx: x > 0 ? -1 : 1, fz: 0, body,
      hp, maxHp: hp, speed: def.speed * rand(0.9, 1.15) * diff.enemySpeed, dmg: def.dmg * (isBoss(kind) ? 1 + (hpScale - 1) * 0.4 : 1) * (elite ? ELITE_DMG : 1),
      fireCd: rand(1, 2.5), hitFlash: 0, t: rand(0, 10), value: def.value * (elite ? 2.5 : 1), cores: def.cores * (elite ? 3 : 1),
      phase: 0, bossPhase: 0, stateTimer: 0, stateFlag: false, move: "", variant: 0, targetX: x, targetZ: z, aimX: x, aimY: 1, aimZ: z,
      shieldHp: def.shield * (elite ? 1.5 : 1), maxShieldHp: def.shield * (elite ? 1.5 : 1),
      slowTimer: 0, frozenTimer: 0, rootTimer: 0, liftTimer: 0, stunTimer: 0, burnTimer: 0, allyTimer: 0, prisonDmg: 0,
      invuln: 0, elite, enraged: false, dying: 0, dead: false,
    };
  }

  /**
   * Spawn a regular robot. `edges` = walk in from the street ends, `far` = the side away from Kai,
   * `ambush` = right around Kai, `sky` = dropped from above. May roll an elite (difficulty).
   */
  spawnKind(kind: EnemyKind, mode: SpawnMode = "edges") {
    const def = ENEMY_DEFS[kind];
    const p = this.player;
    const elite = def.canBeElite && Math.random() < this.difficulty.eliteChance;
    const flyY = rand(3.2, 4.4);
    let x: number;
    let y = def.flying ? flyY : 0;
    let z = rand(ARENA.minZ + 1, ARENA.maxZ - 1);
    if (mode === "ambush") {
      const a = Math.random() * Math.PI * 2;
      const r = rand(5.5, 8.5);
      x = clamp(p.x + Math.cos(a) * r, ARENA.minX + 1, ARENA.maxX - 1);
      z = clamp(p.z + Math.sin(a) * r, ARENA.minZ + 1, ARENA.maxZ - 1);
      y = def.flying ? flyY : floorHeightAt(x, z, 8);
      this.fx.burst(x, y + 0.5, z, 18, "#f43f5e", 5);
    } else if (mode === "sky") {
      x = rand(ARENA.minX + 2, ARENA.maxX - 2);
      y = def.flying ? flyY + 4 : 12;
      this.fx.burst(x, y, z, 12, "#a855f7", 4);
    } else if (mode === "far") {
      const side = p.x > 0 ? -1 : 1;
      x = def.flying ? side * rand(13, 19) : side * SPAWN_X;
    } else {
      x = (Math.random() < 0.5 ? -1 : 1) * SPAWN_X;
    }
    const e = this.makeEnemy(kind, x, y, z, 1, elite);
    this.enemies.push(e);
    if (elite) this.fx.text(x, y + e.height + 0.5, z, "ELITE", "#fbbf24", 14);
    return e;
  }

  private spawnEnemy() {
    this.spawnKind(rollEnemyKind(this.wave));
  }

  private startWave(n: number) {
    this.wave = n;
    this.waveActive = true;
    const bossKind = n % 5 === 0 ? bossForWave(n) : null;
    this.toSpawn = bossKind ? 2 + Math.floor(n / 5) : Math.min(30, Math.round((4 + n * 2) * this.difficulty.spawn));
    this.spawnCd = 1.5;
    if (bossKind) {
      const cycle = Math.floor((n / 5 - 1) / 3);
      const info = BOSSES[bossKind];
      const boss = this.makeEnemy(bossKind, info.spawn[0], info.spawn[1], info.spawn[2], 1 + cycle * 0.6);
      if (this.difficulty.bossStartsAngry) boss.bossPhase = 1;
      this.enemies.push(boss);
      this.showBanner(`WAVE ${n} — ${info.name.toUpperCase()}${cycle > 0 ? ` +${cycle}` : ""}`, 2.6);
    } else {
      this.showBanner(n === 16 ? "ENDLESS MODE — WAVE 16" : `WAVE ${n}`);
    }
    this.sfx("wave");
  }
  private updateWaves() {
    this.banner = Math.max(0, this.banner - STEP);
    if (this.toSpawn > 0) {
      this.spawnCd -= STEP;
      if (this.spawnCd <= 0 && this.enemies.length < MAX_ENEMIES) {
        this.spawnEnemy();
        this.toSpawn--;
        this.spawnCd = Math.max(0.4, 1.3 - this.wave * 0.05);
      }
    } else if (this.waveActive && this.enemies.every((e) => e.allyTimer > 0)) {
      // Possessed allies don't hold up the wave.
      this.waveActive = false;
      this.waveBreak = 2.5;
      const bonus = this.wave * 250;
      this.score += bonus;
      const p = this.player;
      this.fx.text(p.x, p.y + p.height + 1, p.z, `WAVE CLEAR  +${bonus}`, "#22c55e", 26);
      p.hp = Math.min(p.maxHp, p.hp + 10);
      this.events.push({ type: "waveCleared", wave: this.wave });
    } else if (!this.waveActive) {
      this.waveBreak -= STEP;
      if (this.waveBreak <= 0) this.startWave(this.wave + 1);
    }
  }

  /** What an enemy is after: the player, or (for possessed allies) the nearest hostile robot. */
  targetFor(e: Enemy): Actor | null {
    if (e.allyTimer > 0) {
      let best: Enemy | null = null;
      let bestD = Infinity;
      for (const o of this.enemies) {
        if (o === e || o.dead || o.allyTimer > 0) continue;
        const d = Math.hypot(o.x - e.x, o.z - e.z);
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      return best;
    }
    return this.player.invisible > 0 ? null : this.player;
  }

  /** Movement speed multiplier from status effects. */
  speedMul(e: Enemy) {
    return e.rootTimer > 0 ? 0 : e.slowTimer > 0 ? 0.45 : 1;
  }

  /** An enemy shoots: possessed allies' shots belong to the player. */
  enemyShoot(e: Enemy, tx: number, ty: number, tz: number, speed: number, dmg: number, kind: ProjectileKind = "bullet", r = 0.18) {
    const y = e.y + e.height / 2;
    const dx = tx - e.x;
    const dy = ty - y;
    const dz = tz - e.z;
    const d = Math.hypot(dx, dy, dz) || 1;
    this.enemyProjectile(e.x, y, e.z, (dx / d) * speed, (dy / d) * speed, (dz / d) * speed, r, dmg, kind, e.allyTimer > 0 ? "player" : "enemy");
    this.sfx("enemyShot");
  }

  enemyProjectile(x: number, y: number, z: number, vx: number, vy: number, vz: number, r: number, dmg: number, kind: ProjectileKind = r > 0.25 ? "plasma" : "bullet", owner: "player" | "enemy" = "enemy") {
    this.projectiles.push({ x, y, z, vx, vy, vz, r, dmg, owner, kind, life: 5, pierce: false, hit: new Set(), aoe: 0, slow: kind === "web" ? 2.5 : 0, pull: 0, heavy: false });
  }

  private updateEnemies() {
    const p = this.player;
    for (const cd of this.allyHitCd.keys()) this.allyHitCd.set(cd, (this.allyHitCd.get(cd) ?? 0) - STEP);

    for (const e of this.enemies) {
      if (e.dead) continue;
      savePrev(e);
      if (e.dying > 0) {
        this.updateBossDeath(e);
        continue;
      }
      e.hitFlash = Math.max(0, e.hitFlash - STEP);
      e.invuln = Math.max(0, e.invuln - STEP);
      e.slowTimer = Math.max(0, e.slowTimer - STEP);
      e.rootTimer = Math.max(0, e.rootTimer - STEP);
      e.stunTimer = Math.max(0, e.stunTimer - STEP);

      if (e.burnTimer > 0) {
        e.burnTimer -= STEP;
        e.hp -= 8 * STEP;
        if (Math.random() < 0.3) this.fx.spark(e.x + rand(-0.3, 0.3), e.y + rand(0, e.height), e.z + rand(-0.3, 0.3), 0, 2, 0, "#f97316", 0.4, -1);
        if (e.hp <= 0) {
          this.killEnemy(e);
          continue;
        }
      }
      if (e.frozenTimer > 0) {
        e.frozenTimer -= STEP;
        if (e.frozenTimer <= 0 && e.prisonDmg > 0) {
          // Crystal Prison shatters.
          const dmg = e.prisonDmg;
          e.prisonDmg = 0;
          this.fx.burst(e.x, e.y + e.height / 2, e.z, 18, "#99f6e4", 6);
          this.hurtEnemy(e, dmg, 0, 0, { pierceShield: true });
          if (e.dead) continue;
        }
      }
      if (e.allyTimer > 0) {
        e.allyTimer -= STEP;
        if (Math.random() < 0.2) this.fx.spark(e.x, e.y + e.height, e.z, 0, 1.5, 0, "#c4b5fd", 0.5, 0);
        if (e.allyTimer <= 0) {
          // Possession ends: the robot burns out.
          this.fx.burst(e.x, e.y + e.height / 2, e.z, 20, "#c4b5fd", 5);
          this.removeEnemy(e);
          continue;
        }
      }

      const boss = isBoss(e.kind);
      if (!(boss && e.move === "dive")) e.t += STEP;
      const helpless = e.frozenTimer > 0 || e.stunTimer > 0 || e.liftTimer > 0;

      if (e.liftTimer > 0) {
        // Levitated: float up helplessly, then slam back down.
        e.liftTimer -= STEP;
        e.y += (3.2 - e.y) * 0.08;
        e.vx *= 0.9;
        e.vz *= 0.9;
        if (e.liftTimer <= 0) {
          e.vy = -20;
          this.hurtEnemy(e, 20 * this.mul, 0, 0, { noUlt: true });
        }
      } else if (boss) {
        if (!helpless) BOSSES[e.kind as keyof typeof BOSSES].update(this, e);
        this.updateBossPhase(e);
      } else if (!helpless) {
        e.fireCd -= STEP;
        updateEnemyAI(this, e, this.targetFor(e));
      } else if (e.body >= 0) {
        e.vx *= 0.85;
        e.vz *= 0.85;
        this.moveActor(e, "oneway");
      }
      if (e.dead) continue;

      if (!boss) {
        e.x = clamp(e.x, -SPAWN_X - 1, SPAWN_X + 1);
        e.z = clamp(e.z, ARENA.minZ + e.radius, ARENA.maxZ - e.radius);
        // Robots dropped from the sky without a body (flyers) settle at their altitude in their AI.
      }

      // Contact damage.
      if (e.allyTimer > 0) {
        for (const o of this.enemies) {
          if (o === e || o.dead || o.allyTimer > 0 || !actorsOverlap(e, o) || (this.allyHitCd.get(e.id) ?? 0) > 0) continue;
          this.allyHitCd.set(e.id, 0.5);
          const d = Math.hypot(o.x - e.x, o.z - e.z) || 1;
          this.hurtEnemy(o, e.dmg * 1.5, ((o.x - e.x) / d) * 8, ((o.z - e.z) / d) * 8, { noUlt: true, heavy: true, sx: e.x, sz: e.z });
        }
      } else if (!helpless && e.dmg > 0 && e.kind !== "bomber" && p.invisible <= 0 && actorsOverlap(p, e)) {
        const d = Math.hypot(p.x - e.x, p.z - e.z) || 1;
        this.hurtPlayer(e.dmg, (p.x - e.x) / d, (p.z - e.z) / d);
      }
    }
    this.separateEnemies();
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  /** Bosses change behaviour at 2/3 and 1/3 health, with a short invulnerable roar. */
  private updateBossPhase(e: Enemy) {
    const ratio = e.hp / e.maxHp;
    const phase = ratio > 2 / 3 ? 0 : ratio > 1 / 3 ? 1 : 2;
    if (!e.enraged && ratio < ENRAGE_AT) {
      // Last stand: faster attacks and a red glow.
      e.enraged = true;
      e.speed *= 1.25;
      this.showBanner(`${BOSSES[e.kind as keyof typeof BOSSES].name.toUpperCase()} IS ENRAGED!`, 1.8);
      this.fx.burst(e.x, e.y + e.height / 2, e.z, 60, "#ef4444", 9);
      this.addShake(14);
      this.sfx("enrage");
    }
    if (phase <= e.bossPhase) return;
    e.bossPhase = phase;
    e.invuln = 1.2;
    this.showBanner(`${BOSSES[e.kind as keyof typeof BOSSES].name.toUpperCase()} — PHASE ${phase + 1}`, 1.8);
    this.ring("shock", e.x, Math.max(0, e.y), e.z, 7, 0.5, 10, "#f43f5e", 14, "enemy");
    this.fx.burst(e.x, e.y + e.height / 2, e.z, 50, "#f43f5e", 8);
    this.addShake(16);
    this.sfx("phase");
  }

  /** Cheap crowd separation so robots don't stack inside each other (n ≤ 15, so O(n²) is fine). */
  private separateEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (isBoss(a.kind) || a.dead) continue;
      const aFly = ENEMY_DEFS[a.kind].flying;
      const aFixed = ENEMY_DEFS[a.kind].knock === 0;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (isBoss(b.kind) || b.dead || aFly !== ENEMY_DEFS[b.kind].flying) continue;
        const bFixed = ENEMY_DEFS[b.kind].knock === 0;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        // Fixed robots (turrets, nests) never move; the other one is pushed twice as far.
        const push = (min - d) * (aFixed || bFixed ? 0.5 : 0.25);
        if (!aFixed) {
          a.x -= (dx / d) * push;
          a.z -= (dz / d) * push;
        }
        if (!bFixed) {
          b.x += (dx / d) * push;
          b.z += (dz / d) * push;
        }
      }
    }
  }

  /** Remove without score (burnt-out allies, self-destructed bombers). */
  removeEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.physics.removeActor(e.body);
  }

  killEnemy(e: Enemy) {
    if (e.dead) return;
    const boss = isBoss(e.kind);
    if (boss && e.dying === 0) {
      this.startBossDeath(e);
      return;
    }
    this.removeEnemy(e);
    this.kills++;
    this.killMarker = 0.25;
    this.hitMarker = 0.25;
    const cy = e.y + e.height / 2;
    const p = this.player;
    this.combo++;
    this.comboTimer = 2.5;
    const mult = Math.min(3, 1 + Math.floor(this.combo / 5) * 0.5);
    // Aerial kills (Kai in the air) are worth 50% more.
    const aerial = !p.onGround && p.form === "human";
    const points = Math.round(e.value * mult * (aerial ? 1.5 : 1));
    this.score += points;
    this.fx.text(e.x, cy + 0.8, e.z, aerial ? `AERIAL +${points}` : `+${points}`, aerial ? "#67e8f9" : "#22c55e", aerial ? 17 : 15);
    const def = ENEMY_DEFS[e.kind];
    this.fx.burst(e.x, cy, e.z, boss ? 140 : e.elite || def.class === "elite" ? 50 : 26, def.flying ? "#f43f5e" : "#fb923c", boss ? 10 : 5);
    this.fx.burst(e.x, cy, e.z, 10, "#e5e7eb", 3);
    const big = def.class === "tank" || def.class === "elite" || def.class === "static" || e.elite;
    this.addShake(boss ? 24 : big ? 8 : 3);
    this.sfx("explode");
    // Big kills get a moment of slow motion.
    if (!boss && (def.class === "elite" || e.kind === "nest")) this.slowMo(0.3, 0.5);

    if (e.kind === "bomber") {
      // A bomber destroyed by the player blows up its neighbours instead.
      this.zone({ kind: "blast", owner: "player", x: e.x, y: e.y, z: e.z, r: 2.6, delay: 0, life: 0.35, dmg: 25, color: "#fb923c" });
    }
    const cores = Math.max(1, Math.round(e.cores * this.difficulty.rewards));
    if (Math.random() < (boss || big ? 1 : 0.6)) this.dropCores(e.x, cy, e.z, cores);
    if (boss) {
      for (let i = 0; i < 4; i++) this.dropPickup(e.x + rand(-2, 2), Math.max(0.5, cy), e.z + rand(-2, 2), i % 2 ? "health" : "energy");
      this.player.ult = Math.min(100, this.player.ult + 30);
    } else {
      const r = Math.random();
      const heal = RULES.healthDropChance * this.difficulty.healthDrops * (big ? 3 : 1);
      if (r < heal) this.dropPickup(e.x, cy, e.z, "health");
      else if (r < heal + 0.1) this.dropPickup(e.x, cy, e.z, "energy");
    }
  }

  /** Boss defeated: it stops, shakes apart in a chain of explosions, then the kill pays out. */
  private startBossDeath(e: Enemy) {
    e.dying = 2.2;
    e.hp = 0;
    e.invuln = 99;
    e.vx = e.vz = 0;
    // Clear the boss's remaining shots and telegraphs — a small reward.
    this.projectiles = this.projectiles.filter((pr) => pr.owner === "player");
    this.zones = this.zones.filter((z) => z.owner === "player");
    this.rings = this.rings.filter((r) => r.owner === "player");
    this.showBanner(`${BOSSES[e.kind as keyof typeof BOSSES].name.toUpperCase()} DEFEATED!`, 2.6);
    this.slowMo(0.3, 1.2);
    this.flashScreen("#ffffff", 0.7);
    this.addShake(20);
    this.sfx("bossDeath");
  }

  private updateBossDeath(e: Enemy) {
    e.dying -= STEP;
    e.hitFlash = Math.sin(e.dying * 30) > 0 ? 0.08 : 0;
    if (Math.random() < 0.35) {
      const x = e.x + rand(-e.radius, e.radius);
      const y = e.y + rand(0, e.height);
      const z = e.z + rand(-e.radius, e.radius);
      this.fx.burst(x, y, z, 18, Math.random() < 0.5 ? "#fb923c" : "#fde047", 6);
      this.addShake(8);
      if (Math.random() < 0.3) this.sfx("boom");
    }
    if (e.y > 0.1) e.y = Math.max(0, e.y - STEP * 1.5);
    if (e.dying <= 0) {
      e.dying = -1;
      e.invuln = 0;
      this.fx.burst(e.x, e.y + e.height / 2, e.z, 120, "#c084fc", 12);
      this.flashScreen("#ffffff", 0.9);
      this.killEnemy(e);
    }
  }

  dropPickup(x: number, y: number, z: number, kind: Pickup["kind"], value = 0) {
    this.pickups.push({ id: this.newId(), kind, x, y, z, vx: rand(-2, 2), vy: 6, vz: rand(-2, 2), onGround: false, life: kind === "core" ? 14 : 9, value });
  }

  private dropCores(x: number, y: number, z: number, total: number) {
    // Split into a few orbs so a big drop looks like a big drop.
    const orbs = Math.min(total, total >= 10 ? 6 : total);
    for (let i = 0; i < orbs; i++) {
      const value = Math.floor(total / orbs) + (i < total % orbs ? 1 : 0);
      this.dropPickup(x, y, z, "core", value);
    }
  }

  // ───────────────────────────── projectiles & effects ─────────────────────────────

  private updateProjectiles() {
    const p = this.player;
    for (const pr of this.projectiles) {
      if (pr.life <= 0) continue;
      // Time Freeze: enemy bullets hang in the air.
      if (this.timeFreeze > 0 && pr.owner === "enemy") continue;
      pr.life -= STEP;
      const sx = pr.vx * STEP;
      const sy = pr.vy * STEP;
      const sz = pr.vz * STEP;
      const len = Math.hypot(sx, sy, sz);

      // Cover (cars, crates, ice walls) and the street stop every shot.
      if (len > 0) {
        const toi = this.physics.raycastStatic(pr.x, pr.y, pr.z, sx / len, sy / len, sz / len, len + pr.r * 0.5);
        if (toi !== null) {
          pr.x += (sx / len) * toi;
          pr.y += (sy / len) * toi;
          pr.z += (sz / len) * toi;
          this.impact(pr);
          continue;
        }
      }
      pr.x += sx;
      pr.y += sy;
      pr.z += sz;

      if ((pr.kind === "fire" || pr.kind === "fireBig") && Math.random() < 0.8) {
        this.fx.spark(pr.x, pr.y, pr.z, rand(-0.5, 0.5), rand(0, 1), rand(-0.5, 0.5), Math.random() < 0.5 ? "#fde047" : "#f97316", 0.3, -1);
      } else if (pr.kind === "gravity" && Math.random() < 0.6) {
        this.fx.spark(pr.x, pr.y, pr.z, rand(-1, 1), rand(-1, 1), rand(-1, 1), "#a78bfa", 0.3, 0);
      } else if (pr.kind === "frost" && Math.random() < 0.5) {
        this.fx.spark(pr.x, pr.y, pr.z, rand(-0.5, 0.5), rand(-0.5, 0.5), rand(-0.5, 0.5), "#e0f2fe", 0.3, 2);
      } else if ((pr.kind === "energy" || pr.kind === "plasmaBolt" || pr.kind === "shell") && Math.random() < 0.7) {
        this.fx.spark(pr.x, pr.y, pr.z, rand(-0.6, 0.6), rand(-0.6, 0.6), rand(-0.6, 0.6), pr.kind === "energy" ? "#c4b5fd" : pr.kind === "shell" ? "#67e8f9" : "#e9d5ff", 0.25, 0);
      }

      if (pr.owner === "player") {
        for (const e of this.enemies) {
          if (e.dead || e.allyTimer > 0 || e.dying > 0 || pr.hit.has(e.id) || !sphereHitsActor(pr.x, pr.y, pr.z, pr.r, e)) continue;
          pr.hit.add(e.id);
          const hl = Math.hypot(pr.vx, pr.vz) || 1;
          const frozen = pr.kind === "frost" && e.slowTimer > 0;
          this.hurtEnemy(e, pr.dmg, (pr.vx / hl) * 5, (pr.vz / hl) * 5, {
            heavy: pr.heavy,
            sx: pr.x - pr.vx * STEP * 2,
            sz: pr.z - pr.vz * STEP * 2,
            slow: pr.slow,
            // Frostbyte: hitting an already-slowed robot freezes it solid.
            freeze: frozen ? 1.2 : 0,
          });
          if (frozen) this.sfx("freeze");
          if (!pr.pierce) {
            this.impact(pr);
            break;
          }
        }
      } else if (sphereHitsActor(pr.x, pr.y, pr.z, pr.r, p) && p.invisible <= 0) {
        if (p.shieldTimer > 0) {
          this.reflect(pr);
        } else if (p.invuln <= 0 && p.dashTimer <= 0 && !this.cinematic) {
          const hl = Math.hypot(pr.vx, pr.vz) || 1;
          this.hurtPlayer(pr.dmg, pr.vx / hl, pr.vz / hl);
          if (pr.kind === "web") p.slowTimer = Math.max(p.slowTimer, pr.slow);
          pr.life = 0;
        }
      }

      if (Math.abs(pr.x) > 32 || Math.abs(pr.z) > 20 || pr.y > 30) pr.life = 0;
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0);
  }

  /** A projectile hits something: explode (area) and/or pull (Gravix), then disappear. */
  private impact(pr: Projectile) {
    pr.life = 0;
    const color =
      pr.kind === "fire" || pr.kind === "fireBig" ? "#f97316"
      : pr.kind === "gravity" || pr.kind === "energy" ? "#a78bfa"
      : pr.kind === "frost" ? "#e0f2fe"
      : pr.kind === "plasmaBolt" ? "#c084fc"
      : pr.kind === "shell" ? "#22d3ee"
      : pr.kind === "tracer" || pr.kind === "pellet" ? "#fde68a"
      : pr.owner === "player" ? "#5eead4" : "#f43f5e";
    this.fx.burst(pr.x, pr.y, pr.z, pr.aoe > 0 ? 24 : 5, color, pr.aoe > 0 ? 6 : 2);
    if (pr.owner !== "player") return;
    if (pr.aoe > 0) {
      // pr.dmg was already scaled by the upgrade multiplier when fired, so hurtEnemy is called directly.
      for (const e of this.enemiesNear(pr.x, pr.z, pr.aoe)) {
        if (pr.hit.has(e.id) || Math.abs(e.y + e.height / 2 - pr.y) > pr.aoe + e.height / 2) continue;
        const d = Math.hypot(e.x - pr.x, e.z - pr.z) || 1;
        this.hurtEnemy(e, pr.dmg * 0.7, ((e.x - pr.x) / d) * 10, ((e.z - pr.z) / d) * 10, { heavy: true, sx: pr.x, sz: pr.z });
      }
      this.addShake(pr.kind === "energy" || pr.kind === "shell" ? 12 : 6);
      if (pr.kind === "energy" || pr.kind === "shell") {
        this.ring("nova", pr.x, pr.y, pr.z, pr.aoe, 0.3, 0, color, 0);
        this.fx.burst(pr.x, pr.y, pr.z, 30, "#ffffff", 8);
      }
      this.sfx("boom");
    }
    if (pr.pull > 0) {
      for (const e of this.enemiesNear(pr.x, pr.z, pr.pull)) {
        if (isBoss(e.kind)) continue;
        const dx = pr.x - e.x;
        const dz = pr.z - e.z;
        const d = Math.hypot(dx, dz) || 1;
        e.vx += (dx / d) * 9;
        e.vz += (dz / d) * 9;
      }
      this.sfx("vortex");
    }
  }

  /** Prism Shield: bounce an enemy shot back as a crystal shard, aimed at the nearest robot. */
  private reflect(pr: Projectile) {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.dead || e.allyTimer > 0) continue;
      const d = Math.hypot(e.x - pr.x, e.z - pr.z);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    const speed = Math.hypot(pr.vx, pr.vy, pr.vz) * 1.4;
    if (best) {
      const dx = best.x - pr.x;
      const dy = best.y + best.height / 2 - pr.y;
      const dz = best.z - pr.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      pr.vx = (dx / d) * speed;
      pr.vy = (dy / d) * speed;
      pr.vz = (dz / d) * speed;
    } else {
      pr.vx = -pr.vx * 1.4;
      pr.vy = Math.abs(pr.vy) * 1.2;
      pr.vz = -pr.vz * 1.4;
    }
    pr.owner = "player";
    pr.kind = "crystal";
    pr.dmg = 18 * this.mul;
    pr.life = 2;
    pr.slow = 0;
    pr.hit.clear();
    this.sfx("crystal");
  }

  private updateRings() {
    const p = this.player;
    for (const ring of this.rings) {
      if (this.timeFreeze > 0 && ring.owner === "enemy") continue;
      ring.life -= STEP;
      const r = ring.maxR * (1 - ring.life / ring.maxLife);
      const bodyHeight = ring.kind === "nova" || ring.kind === "supernova";
      if (ring.owner === "enemy") {
        if (ring.dmg > 0 && !ring.hit.has(0)) {
          const d = Math.hypot(p.x - ring.x, p.z - ring.z);
          if (d < r + p.radius && d > r - 1.2 && p.y < ring.y + 1) {
            ring.hit.add(0);
            this.hurtPlayer(ring.dmg, (p.x - ring.x) / (d || 1), (p.z - ring.z) / (d || 1));
          }
        }
        continue;
      }
      for (const e of this.enemies) {
        if (e.dead || e.allyTimer > 0 || ring.hit.has(e.id)) continue;
        const dx = e.x - ring.x;
        const dz = e.z - ring.z;
        const d = Math.hypot(dx, dz);
        if (d > r + e.radius) continue;
        if (bodyHeight) {
          if (Math.abs(e.y + e.height / 2 - ring.y) > (ring.kind === "supernova" ? 6 : 2) + e.height / 2) continue;
        } else if (e.y > ring.y + 0.8) {
          continue; // quakes and shockwaves only travel along the ground
        }
        ring.hit.add(e.id);
        if (ring.dmg <= 0) continue;
        const nx = d > 0.01 ? dx / d : 1;
        const nz = d > 0.01 ? dz / d : 0;
        this.hurtEnemy(e, ring.dmg, nx * ring.knock, nz * ring.knock, { heavy: true, sx: ring.x, sz: ring.z, launch: ring.kind === "quake" });
        if (ring.kind === "supernova") e.burnTimer = Math.max(e.burnTimer, 4);
      }
      if (bodyHeight) {
        // Novas also burn away enemy bullets.
        for (const pr of this.projectiles) {
          if (pr.owner === "enemy" && Math.hypot(pr.x - ring.x, pr.y - ring.y, pr.z - ring.z) < r) pr.life = 0;
        }
      } else if (ring.kind === "quake" && Math.random() < 0.9) {
        const a = Math.random() * Math.PI * 2;
        this.fx.spark(ring.x + Math.cos(a) * r, ring.y + 0.1, ring.z + Math.sin(a) * r, 0, rand(3, 6), 0, "#a8a29e", 0.5, 12);
      }
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  private updatePickups() {
    const p = this.player;
    for (const pk of this.pickups) {
      pk.life -= STEP;
      const dx = p.x - pk.x;
      const dz = p.z - pk.z;
      const dist = Math.hypot(dx, dz);
      if (pk.kind === "shard") {
        // Shards float in place (no gravity, no timeout).
      } else if (pk.kind === "core" && dist < 4.5 && pk.life < 13.5) {
        pk.onGround = false;
        pk.vx = (dx / (dist || 1)) * 12;
        pk.vz = (dz / (dist || 1)) * 12;
        pk.vy = (p.y + 1 - pk.y) * 6;
        pk.x += pk.vx * STEP;
        pk.z += pk.vz * STEP;
        pk.y += pk.vy * STEP;
      } else if (!pk.onGround) {
        const prevY = pk.y;
        pk.vy -= 30 * STEP;
        pk.x = clamp(pk.x + pk.vx * STEP, ARENA.minX + 0.3, ARENA.maxX - 0.3);
        pk.z = clamp(pk.z + pk.vz * STEP, ARENA.minZ + 0.3, ARENA.maxZ - 0.3);
        pk.y += pk.vy * STEP;
        const floor = floorHeightAt(pk.x, pk.z, prevY);
        if (pk.y <= floor) {
          pk.y = floor;
          pk.onGround = true;
        }
      }
      const reach = p.radius + 0.5;
      if (dx * dx + dz * dz < reach * reach && pk.y < p.y + p.height && pk.y + 0.6 > p.y) {
        pk.life = 0;
        if (pk.kind === "energy") {
          p.energy = Math.min(100, p.energy + 25);
          this.fx.text(pk.x, pk.y + 1, pk.z, "+25 ENERGY", "#22c55e", 14);
          this.sfx("pickup");
        } else if (pk.kind === "health") {
          this.healPlayer(RULES.player.healthOrb);
          this.sfx("pickup");
        } else if (pk.kind === "shard") {
          const run = this.run;
          if (run) {
            run.shards[pk.value] = true;
            const found = run.shards.filter(Boolean).length;
            this.fx.text(pk.x, pk.y + 1, pk.z, `DATA SHARD ${found}/${run.shards.length}`, "#67e8f9", 18);
            this.fx.burst(pk.x, pk.y + 0.4, pk.z, 30, "#67e8f9", 5);
            this.events.push({ type: "shard", level: run.level.id, index: pk.value });
          }
          this.sfx("shard");
        } else {
          this.runCores += pk.value;
          this.events.push({ type: "cores", amount: pk.value });
          this.fx.text(pk.x, pk.y + 0.8, pk.z, `+${pk.value} CORE${pk.value > 1 ? "S" : ""}`, "#fbbf24", 12);
          this.sfx("core");
        }
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);
  }

  private updateSlashes() {
    for (const s of this.slashes) s.life -= STEP;
    this.slashes = this.slashes.filter((s) => s.life > 0);
  }
}

