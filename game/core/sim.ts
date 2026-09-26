import { ARENA, GRAVITY, JUMP_CUT, MAX_FALL, PLATFORMS, SOLIDS, SPAWN_X, STEP, clamp, floorHeightAt, rand } from "./arena";
import { NO_FX, type FxSink, type GameEvent, type SfxName } from "./events";
import { ALIEN_ORDER, FORMS } from "./forms";
import type { Physics, PlatformMode } from "./physics";
import type { Actor, Enemy, EnemyKind, FormId, GameStatus, HudState, InputSource, Pickup, Player, Projectile, Ring, Slash } from "./types";

const ENERGY_DRAIN = 5; // per second while transformed (≈20s from full)
const ENERGY_RECHARGE = 9; // per second in human form
const TRANSFORM_MIN_ENERGY = 15;
/** Minimum gap between voluntary transformations (including reverting to Kai). */
export const TRANSFORM_COOLDOWN = 1;
const UNLOCK_ENERGY = 35;
const MAX_ENEMIES = 14;

/** Boss dive: total length and how long it sits on the ground (the melee window). */
const BOSS_DIVE_TIME = 2.6;
const BOSS_DIVE_GROUNDED = 1.4;
const BOSS_HOVER_Y = 4.3;

const DASH_SPEED = 36;
/** Auto-aim: ranged attacks lock onto the nearest enemy within this range and cone. */
const AIM_RANGE = 18;
const AIM_CONE_COS = Math.cos((75 * Math.PI) / 180);
/** Melee hits land inside this half-angle in front of the attacker. */
const MELEE_CONE_COS = Math.cos((65 * Math.PI) / 180);

const ENEMY_BASE: Record<EnemyKind, { radius: number; height: number; hp: number; speed: () => number; dmg: number; value: number }> = {
  crawler: { radius: 0.5, height: 0.8, hp: 30, speed: () => rand(3, 4.4), dmg: 10, value: 100 },
  drone: { radius: 0.6, height: 0.6, hp: 22, speed: () => 2, dmg: 8, value: 150 },
  brute: { radius: 0.85, height: 2.1, hp: 130, speed: () => 1.9, dmg: 22, value: 400 },
  boss: { radius: 2.8, height: 2.2, hp: 1100, speed: () => 1, dmg: 25, value: 5000 },
};

/** True when two vertical cylinders overlap. */
function actorsOverlap(a: Actor, b: Actor) {
  const r = a.radius + b.radius;
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz < r * r && a.y < b.y + b.height && b.y < a.y + a.height;
}

function sphereHitsActor(x: number, y: number, z: number, r: number, a: Actor) {
  const rr = r + a.radius;
  const dx = x - a.x;
  const dz = z - a.z;
  return dx * dx + dz * dz < rr * rr && y + r > a.y && y - r < a.y + a.height;
}

function savePrev(a: Actor) {
  a.prevX = a.x;
  a.prevY = a.y;
  a.prevZ = a.z;
}

/**
 * The whole game simulation. Pure TypeScript: no DOM, no audio, no storage.
 * Advance it with `update(input)` exactly once per fixed `STEP`; read side effects from `events`.
 */
export class GameSim {
  status: GameStatus = "menu";
  player: Player;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  rings: Ring[] = [];
  pickups: Pickup[] = [];
  slashes: Slash[] = [];

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

  /** Side effects queued this frame; the driver drains (and clears) this list. */
  readonly events: GameEvent[] = [];

  private nextId = 1;

  constructor(
    private physics: Physics,
    private fx: FxSink = NO_FX,
  ) {
    this.player = this.newPlayer();
  }

  private newPlayer(): Player {
    const f = FORMS.human;
    return {
      x: 0,
      y: 0,
      z: 2,
      vx: 0,
      vy: 0,
      vz: 0,
      prevX: 0,
      prevY: 0,
      prevZ: 2,
      radius: f.radius,
      height: f.height,
      onGround: true,
      fx: 0,
      fz: 1,
      body: this.physics.createActor(f.radius, f.height),
      form: "human",
      hp: 100,
      maxHp: 100,
      energy: 100,
      watchLocked: false,
      attackCd: 0,
      specialCd: 0,
      transformCd: 0,
      attackAnim: 0,
      specialAnim: 0,
      hurtAnim: 0,
      invuln: 0,
      dashTimer: 0,
      dashHit: new Set(),
      shieldTimer: 0,
      flash: 0,
      jumpsLeft: 0,
      dropTimer: 0,
    };
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  startGame() {
    this.physics.removeActor(this.player.body);
    for (const e of this.enemies) this.physics.removeActor(e.body);
    this.player = this.newPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.rings = [];
    this.pickups = [];
    this.slashes = [];
    this.score = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.shake = 0;
    this.setStatus("playing");
    this.startWave(1);
  }

  togglePause() {
    if (this.status === "playing") this.setStatus("paused");
    else if (this.status === "paused") this.setStatus("playing");
  }

  /** Public so the HUD (watch dial buttons) can trigger transformations. */
  requestTransform(id: FormId) {
    if (this.status === "playing") this.transform(id);
  }

  /** Advance timers that should run in every state (menu idle, death animation). */
  tickIdle(dt: number) {
    this.statusTime += dt;
  }

  hudSnapshot(): HudState {
    const p = this.player;
    const boss = this.enemies.find((e) => e.kind === "boss");
    return {
      status: this.status,
      form: p.form,
      hp: Math.max(0, Math.ceil(p.hp)),
      maxHp: p.maxHp,
      energy: p.energy,
      watchLocked: p.watchLocked,
      transformReady: p.transformCd <= 0,
      wave: this.wave,
      score: this.score,
      combo: this.combo,
      enemiesLeft: this.enemies.length + this.toSpawn,
      bossHp: boss ? boss.hp / boss.maxHp : null,
      specialReady: p.form !== "human" && p.specialCd <= 0 && p.energy >= FORMS[p.form].specialCost,
      banner: this.banner > 0 && this.status === "playing" ? this.bannerText : "",
    };
  }

  private setStatus(status: GameStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusTime = 0;
    this.events.push({ type: "status", status });
  }

  private sfx(name: SfxName) {
    this.events.push({ type: "sfx", name });
  }

  // ───────────────────────────── simulation ─────────────────────────────

  /** Advance one fixed step. Only call while `status === "playing"`. */
  update(input: InputSource) {
    if (input.wasPressed("pause")) {
      this.togglePause();
      return;
    }

    ALIEN_ORDER.forEach((id, i) => {
      if (input.wasPressed(`t${i + 1}` as "t1")) this.transform(id);
    });
    if (input.wasPressed("revert")) this.transform("human");

    this.updatePlayer(input);
    this.updateEnemies();
    this.updateProjectiles();
    this.updateRings();
    this.updatePickups();
    this.updateSlashes();
    this.updateWaves();

    if (this.comboTimer > 0) {
      this.comboTimer -= STEP;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.shake = Math.max(0, this.shake - 0.6);
  }

  /** Integrate gravity + velocity through the physics world and update `onGround`. */
  private moveActor(a: Actor, mode: PlatformMode, gravity = true) {
    if (gravity) a.vy = Math.max(a.vy - GRAVITY * STEP, -MAX_FALL);
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

  private updatePlayer(input: InputSource) {
    const p = this.player;
    const f = FORMS[p.form];
    savePrev(p);

    p.attackCd -= STEP;
    p.specialCd -= STEP;
    p.transformCd = Math.max(0, p.transformCd - STEP);
    p.attackAnim = Math.max(0, p.attackAnim - STEP);
    p.specialAnim = Math.max(0, p.specialAnim - STEP);
    p.hurtAnim = Math.max(0, p.hurtAnim - STEP);
    p.invuln = Math.max(0, p.invuln - STEP);
    p.flash = Math.max(0, p.flash - STEP);
    p.dropTimer = Math.max(0, p.dropTimer - STEP);
    p.shieldTimer = Math.max(0, p.shieldTimer - STEP);

    // Movement
    if (p.dashTimer > 0) {
      p.dashTimer -= STEP;
      p.vx = p.fx * DASH_SPEED;
      p.vz = p.fz * DASH_SPEED;
      p.vy = 0;
      for (const e of this.enemies) {
        if (!e.dead && !p.dashHit.has(e.id) && actorsOverlap(p, e)) {
          p.dashHit.add(e.id);
          this.hurtEnemy(e, 28, p.fx * 16, p.fz * 16);
        }
      }
      this.fx.spark(p.x, p.y + rand(0.2, p.height), p.z, -p.fx * rand(2, 6), rand(-1, 1), -p.fz * rand(2, 6), "#facc15", 0.3, 0);
    } else {
      const m = input.move();
      const k = p.onGround ? 0.35 : 0.18;
      p.vx += (m.x * f.speed - p.vx) * k;
      p.vz += (m.z * f.speed - p.vz) * k;
      const mag = Math.hypot(m.x, m.z);
      if (mag > 0.1) {
        p.fx = m.x / mag;
        p.fz = m.z / mag;
      }

      if (p.onGround) p.jumpsLeft = f.airJumps;
      if (input.wasPressed("jump") && (p.onGround || p.jumpsLeft > 0)) {
        if (!p.onGround) {
          p.jumpsLeft--;
          this.fx.burst(p.x, p.y, p.z, 10, f.accent, 3);
        }
        p.vy = f.jump;
        p.onGround = false;
        this.sfx("jump");
      }
      // Variable jump height: release early for a short hop.
      if (!input.isHeld("jump") && p.vy > 5) p.vy -= JUMP_CUT * STEP;
      if (input.isHeld("drop") && p.onGround && p.y > 0.05) p.dropTimer = 0.25;
    }

    const fallSpeed = -p.vy;
    const wasGrounded = p.onGround;
    this.moveActor(p, p.dropTimer > 0 ? "none" : "oneway", p.dashTimer <= 0);
    p.x = clamp(p.x, ARENA.minX + p.radius, ARENA.maxX - p.radius);
    p.z = clamp(p.z, ARENA.minZ + p.radius, ARENA.maxZ - p.radius);
    if (p.onGround && !wasGrounded && p.form === "titan" && fallSpeed > 16) {
      this.shake = Math.max(this.shake, 6);
      this.fx.burst(p.x, p.y + 0.1, p.z, 14, "#a8a29e", 4);
    }

    // Combat
    if (input.isHeld("attack") && p.attackCd <= 0) {
      this.attack();
      p.attackCd = f.attackCooldown;
    }
    if (input.wasPressed("special") && p.specialCd <= 0) this.special();

    // Shiftwatch energy
    const head = p.y + p.height + 0.4;
    if (p.form !== "human") {
      p.energy -= ENERGY_DRAIN * STEP;
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

    // Ambient form particles
    const speed = Math.hypot(p.vx, p.vz);
    if (p.form === "blaze" && Math.random() < 0.5) {
      this.fx.spark(p.x + rand(-0.2, 0.2), p.y + p.height, p.z + rand(-0.2, 0.2), rand(-0.3, 0.3), rand(1.5, 3), rand(-0.3, 0.3), Math.random() < 0.5 ? "#fde047" : "#f97316", 0.5, -1);
    } else if (p.form === "bolt" && speed > 8 && Math.random() < 0.7) {
      this.fx.spark(p.x, p.y + rand(0.2, p.height), p.z, -p.vx * 0.1, 0, -p.vz * 0.1, "#facc15", 0.25, 0);
    } else if (p.form === "shard" && Math.random() < 0.08) {
      this.fx.spark(p.x + rand(-0.4, 0.4), p.y + rand(0, p.height), p.z + rand(-0.4, 0.4), 0, 0.6, 0, "#e0f2fe", 0.6, 0);
    }
  }

  private transform(id: FormId, forced = false) {
    const p = this.player;
    if (id === p.form) return;
    if (!forced) {
      // Cooldown applies to every voluntary change (reverting too), otherwise
      // alternating revert/transform would chain the 0.4s transform i-frames forever.
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
    const nf = FORMS[id];
    p.form = id;
    p.radius = nf.radius;
    p.height = nf.height;
    this.physics.resizeActor(p.body, nf.radius, nf.height);
    p.flash = 0.45;
    p.invuln = Math.max(p.invuln, 0.4);
    p.transformCd = TRANSFORM_COOLDOWN;
    p.shieldTimer = 0;
    p.dashTimer = 0;
    p.attackCd = 0.15;
    this.fx.burst(p.x, p.y + p.height / 2, p.z, 40, "#22c55e", 6);
    if (!forced) {
      this.fx.text(p.x, p.y + p.height + 0.5, p.z, id === "human" ? "KAI" : nf.name.toUpperCase() + "!", nf.accent, 20);
      this.sfx("transform");
    }
  }

  /**
   * Nearest living enemy within `range` whose direction is inside the aim cone around the
   * player's facing. Turning happens here too, so the character visibly faces its target.
   */
  private acquireTarget(range: number, coneCos: number): Enemy | null {
    const p = this.player;
    let best: Enemy | null = null;
    let bestD = range * range;
    for (const e of this.enemies) {
      if (e.dead) continue;
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

  /** Launch direction from (x, y, z) towards the target's centre, or flat along facing without one. */
  private aimFrom(x: number, y: number, z: number, target: Enemy | null): [number, number, number] {
    const p = this.player;
    if (!target) return [p.fx, 0, p.fz];
    const dx = target.x - x;
    const dy = target.y + target.height / 2 - y;
    const dz = target.z - z;
    const d = Math.hypot(dx, dy, dz) || 1;
    return [dx / d, dy / d, dz / d];
  }

  private shoot(kind: "fire" | "crystal", x: number, y: number, z: number, dir: [number, number, number], speed: number, r: number, dmg: number, life: number) {
    this.projectiles.push({ x, y, z, vx: dir[0] * speed, vy: dir[1] * speed, vz: dir[2] * speed, r, dmg, owner: "player", kind, life, pierce: false, hit: new Set() });
  }

  private attack() {
    const p = this.player;
    p.attackAnim = 0.2;
    const chest = p.y + p.height * 0.6;
    switch (p.form) {
      case "human":
        this.melee(1.1, 6, 8, "#ffffff");
        this.sfx("punch");
        break;
      case "blaze": {
        const target = this.acquireTarget(AIM_RANGE, AIM_CONE_COS);
        const sx = p.x + p.fx * (p.radius + 0.2);
        const sz = p.z + p.fz * (p.radius + 0.2);
        this.shoot("fire", sx, chest, sz, this.aimFrom(sx, chest, sz, target), 18, 0.3, 12, 1.4);
        this.sfx("shoot");
        break;
      }
      case "titan":
        this.melee(2.6, 32, 22, "#fb923c");
        this.shake = Math.max(this.shake, 5);
        this.sfx("heavy");
        break;
      case "bolt":
        this.melee(1.5, 9, 6, "#facc15");
        this.sfx("punch");
        break;
      case "shard": {
        const target = this.acquireTarget(AIM_RANGE, AIM_CONE_COS);
        const sx = p.x + p.fx * (p.radius + 0.2);
        const sz = p.z + p.fz * (p.radius + 0.2);
        const [dx, dy, dz] = this.aimFrom(sx, chest, sz, target);
        // Fan of three shards around the aim direction (rotated about the vertical axis).
        for (const a of [-0.18, 0, 0.18]) {
          const c = Math.cos(a);
          const s = Math.sin(a);
          this.shoot("crystal", sx, chest, sz, [dx * c - dz * s, dy, dx * s + dz * c], 20, 0.22, 9, 1);
        }
        this.sfx("crystal");
        break;
      }
    }
  }

  private melee(range: number, dmg: number, knockback: number, color: string) {
    const p = this.player;
    // Soft lock-on: turn towards anyone just out of reach in front, or right next to us.
    if (!this.acquireTarget(range + 1.5, Math.cos((50 * Math.PI) / 180))) this.acquireTarget(2.5, -1);

    const bandLo = p.y + p.height * 0.05;
    const bandHi = p.y + p.height * 0.95;
    this.slashes.push({ x: p.x, y: p.y + p.height * 0.55, z: p.z, fx: p.fx, fz: p.fz, range: range + p.radius, color, life: 0.18, maxLife: 0.18 });

    for (const e of this.enemies) {
      if (e.dead || e.y > bandHi || e.y + e.height < bandLo) continue;
      const dx = e.x - p.x;
      const dz = e.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > range + e.radius + p.radius * 0.5) continue;
      const touching = d < e.radius + p.radius;
      if (!touching && (dx * p.fx + dz * p.fz) / d < MELEE_CONE_COS) continue;
      const nx = d > 0.01 ? dx / d : p.fx;
      const nz = d > 0.01 ? dz / d : p.fz;
      this.hurtEnemy(e, dmg, nx * knockback, nz * knockback);
    }
    // Melee also swats enemy bullets out of the air.
    for (const pr of this.projectiles) {
      if (pr.owner !== "enemy" || pr.y < bandLo - 0.3 || pr.y > bandHi + 0.3) continue;
      const dx = pr.x - p.x;
      const dz = pr.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < range + p.radius + pr.r && (d < p.radius || (dx * p.fx + dz * p.fz) / d >= MELEE_CONE_COS)) pr.life = 0;
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
    p.specialCd = f.specialCooldown;
    p.specialAnim = 0.45;
    const cy = p.y + p.height / 2;

    switch (p.form) {
      case "blaze":
        this.rings.push({ kind: "nova", x: p.x, y: cy, z: p.z, maxR: 5.5, life: 0.45, maxLife: 0.45, dmg: 30, hit: new Set() });
        this.fx.burst(p.x, cy, p.z, 50, "#fde047", 8);
        this.shake = Math.max(this.shake, 8);
        this.sfx("heavy");
        break;
      case "titan":
        this.rings.push({ kind: "quake", x: p.x, y: p.y, z: p.z, maxR: 9, life: 0.9, maxLife: 0.9, dmg: 40, hit: new Set() });
        this.shake = Math.max(this.shake, 16);
        this.fx.burst(p.x, p.y + 0.2, p.z, 30, "#a8a29e", 6);
        this.sfx("heavy");
        break;
      case "bolt":
        this.acquireTarget(12, AIM_CONE_COS);
        p.dashTimer = 0.28;
        p.dashHit.clear();
        p.invuln = Math.max(p.invuln, 0.35);
        this.sfx("zap");
        break;
      case "shard":
        p.shieldTimer = 3;
        this.sfx("shield");
        break;
    }
  }

  private hurtPlayer(dmg: number, dirX: number, dirZ: number) {
    const p = this.player;
    if (p.invuln > 0 || p.dashTimer > 0 || this.status !== "playing") return;
    if (p.shieldTimer > 0) {
      this.fx.burst(p.x, p.y + p.height / 2, p.z, 6, "#a5f3fc", 3);
      return;
    }
    const amount = Math.max(1, Math.round(dmg * FORMS[p.form].armor));
    p.hp -= amount;
    p.invuln = 0.9;
    p.hurtAnim = 0.35;
    p.vx = dirX * 9;
    p.vz = dirZ * 9;
    p.vy = 6;
    this.shake = Math.max(this.shake, 8);
    this.combo = 0;
    this.fx.text(p.x, p.y + p.height + 0.2, p.z, `-${amount}`, "#ef4444", 16);
    this.fx.burst(p.x, p.y + p.height / 2, p.z, 16, "#ef4444", 4);
    this.sfx("hurt");
    if (p.hp <= 0) this.gameOver();
  }

  private gameOver() {
    this.setStatus("gameover");
    const p = this.player;
    this.fx.burst(p.x, p.y + p.height / 2, p.z, 60, "#22c55e", 7);
    this.sfx("gameOver");
  }

  // ───────────────────────────── enemies ─────────────────────────────

  private makeEnemy(kind: EnemyKind, x: number, y: number, z: number): Enemy {
    const base = ENEMY_BASE[kind];
    const scale = 1 + (this.wave - 1) * 0.1;
    const hp = kind === "boss" ? base.hp * (1 + (this.wave / 5 - 1) * 0.5) : Math.round(base.hp * scale);
    // Only walkers need a physics body; flyers move freely.
    const body = kind === "crawler" || kind === "brute" ? this.physics.createActor(base.radius, base.height) : -1;
    return {
      id: this.nextId++,
      kind,
      x,
      y,
      z,
      vx: 0,
      vy: 0,
      vz: 0,
      prevX: x,
      prevY: y,
      prevZ: z,
      radius: base.radius,
      height: base.height,
      onGround: false,
      fx: x > 0 ? -1 : 1,
      fz: 0,
      body,
      hp,
      maxHp: hp,
      speed: base.speed(),
      dmg: base.dmg,
      fireCd: kind === "drone" ? rand(1, 2.5) : 2,
      hitFlash: 0,
      t: rand(0, 10),
      value: base.value,
      phase: 0,
      stateTimer: 0,
      stateFlag: false,
      targetX: x,
      targetZ: z,
      dead: false,
    };
  }

  private spawnEnemy() {
    const w = this.wave;
    const roll = Math.random();
    let kind: EnemyKind = "crawler";
    if (w >= 3 && roll < 0.15 + Math.min(0.15, w * 0.01)) kind = "brute";
    else if (w >= 2 && roll < 0.55) kind = "drone";

    const side = Math.random() < 0.5 ? -1 : 1;
    const z = rand(ARENA.minZ + 1, ARENA.maxZ - 1);
    this.enemies.push(this.makeEnemy(kind, side * SPAWN_X, kind === "drone" ? rand(3.2, 4.2) : 0, z));
  }

  private startWave(n: number) {
    this.wave = n;
    this.waveActive = true;
    const isBoss = n % 5 === 0;
    this.toSpawn = isBoss ? 2 + n / 5 : Math.min(30, 4 + n * 2);
    this.spawnCd = 1.5;
    this.banner = 2.2;
    this.bannerText = isBoss ? `WAVE ${n} — BOSS INCOMING` : `WAVE ${n}`;
    if (isBoss) this.enemies.push(this.makeEnemy("boss", 0, 22, -1));
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
    } else if (this.waveActive && this.enemies.length === 0) {
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

  private updateEnemies() {
    const p = this.player;
    const pcy = p.y + p.height / 2;

    for (const e of this.enemies) {
      savePrev(e);
      // A diving boss freezes its sway clock so it doesn't teleport sideways when it rises again.
      if (!(e.kind === "boss" && e.stateTimer > 0)) e.t += STEP;
      e.hitFlash = Math.max(0, e.hitFlash - STEP);
      e.fireCd -= STEP;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz) || 1;
      const nx = dx / dist;
      const nz = dz / dist;

      switch (e.kind) {
        case "crawler": {
          e.vx += (nx * e.speed - e.vx) * 0.08;
          e.vz += (nz * e.speed - e.vz) * 0.08;
          // Hop up after a player standing on a platform or car.
          if (e.onGround && p.y > e.y + 1 && dist < 5 && e.fireCd <= 0) {
            e.vy = 13;
            e.fireCd = 1.4;
          }
          this.moveActor(e, "oneway");
          break;
        }
        case "brute": {
          e.vx += (nx * e.speed - e.vx) * 0.05;
          e.vz += (nz * e.speed - e.vz) * 0.05;
          if (e.onGround && dist < 5.5 && e.fireCd <= 0) {
            e.vx = nx * 13;
            e.vz = nz * 13;
            e.vy = 9;
            e.fireCd = 3;
          }
          const airborne = !e.onGround;
          this.moveActor(e, "none");
          if (airborne && e.onGround) {
            this.shake = Math.max(this.shake, 4);
            this.fx.burst(e.x, e.y + 0.1, e.z, 12, "#a78bfa", 3);
          }
          break;
        }
        case "drone": {
          const tx = p.x + Math.sin(e.t * 0.9 + e.id) * 6;
          const tz = p.z + Math.cos(e.t * 0.7 + e.id) * 4;
          const ty = 3.6 + Math.sin(e.t * 1.7 + e.id) * 0.6;
          e.x += (tx - e.x) * 0.015 + e.vx * STEP;
          e.z += (tz - e.z) * 0.015 + e.vz * STEP;
          e.y += (ty - e.y) * 0.03 + e.vy * STEP;
          e.vx *= 0.9;
          e.vy *= 0.9;
          e.vz *= 0.9;
          if (e.fireCd <= 0) {
            this.enemyShoot(e.x, e.y, e.z, p.x, pcy, p.z, 9, 8);
            e.fireCd = Math.max(1.1, 2.4 - this.wave * 0.06);
          }
          break;
        }
        case "boss":
          this.updateBoss(e);
          break;
      }

      if (e.kind !== "boss") {
        e.fx = nx;
        e.fz = nz;
        e.x = clamp(e.x, -SPAWN_X - 1, SPAWN_X + 1);
        e.z = clamp(e.z, ARENA.minZ + e.radius, ARENA.maxZ - e.radius);
      }
      if (actorsOverlap(p, e)) this.hurtPlayer(e.dmg, nx, nz);
    }
    this.separateEnemies();
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  /** Cheap crowd separation so robots don't stack inside each other (n ≤ 15, so O(n²) is fine). */
  private separateEnemies() {
    const list = this.enemies;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (a.kind === "boss") continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        if (b.kind === "boss" || (a.kind === "drone") !== (b.kind === "drone")) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const min = a.radius + b.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 >= min * min || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (min - d) * 0.25;
        a.x -= (dx / d) * push;
        a.z -= (dz / d) * push;
        b.x += (dx / d) * push;
        b.z += (dz / d) * push;
      }
    }
  }

  private updateBoss(e: Enemy) {
    const p = this.player;
    const enraged = e.hp < e.maxHp / 2;

    // Dive attack: slam into the street and sit there briefly. It's dangerous to stand under,
    // but it is also the window where melee forms (and plain Kai) can actually reach the boss.
    if (e.stateTimer > 0) {
      e.stateTimer -= STEP;
      const grounded = e.stateTimer < BOSS_DIVE_GROUNDED + 0.35 && e.stateTimer > 0.35;
      const targetY = e.stateTimer > 0.35 ? 0 : BOSS_HOVER_Y;
      e.y += (targetY - e.y) * (grounded ? 0.25 : 0.06);
      // Slide over the clear landing spot while descending (it never lands on cars or scaffolds).
      e.x += (e.targetX - e.x) * 0.08;
      e.z += (e.targetZ - e.z) * 0.08;
      if (!e.stateFlag && e.y <= 0.15) {
        e.stateFlag = true;
        this.shake = Math.max(this.shake, 14);
        this.fx.burst(e.x, 0.2, e.z, 40, "#a78bfa", 6);
        this.sfx("heavy");
        // Landing on the player hurts once, then shoves them out so they can't get stuck inside the hull.
        if (actorsOverlap(p, e)) this.knockOutOfBoss(e);
      }
      if (e.stateTimer <= 0) e.fireCd = enraged ? 0.9 : 1.4;
      return;
    }

    const targetY = BOSS_HOVER_Y + Math.sin(e.t * 1.3) * 0.5;
    e.y += (targetY - e.y) * 0.04;
    // Ease towards the sway path (instead of snapping to it) so leaving a dive spot stays smooth.
    e.x += (Math.sin(e.t * (enraged ? 0.8 : 0.55)) * 11 - e.x) * 0.05;
    e.z += (clamp(p.z - 3, -3, 5) - e.z) * 0.01;
    const toP = Math.hypot(p.x - e.x, p.z - e.z) || 1;
    e.fx = (p.x - e.x) / toP;
    e.fz = (p.z - e.z) / toP;

    if (e.fireCd > 0) return;
    const cy = e.y + 0.2;
    const pattern = e.phase % 4;
    if (pattern === 0) {
      // Rotating downward ring of bullets: they rain onto a circle around the ship.
      const n = enraged ? 16 : 11;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + e.t;
        const dir = [Math.cos(a) * 0.85, -0.5, Math.sin(a) * 0.85];
        const len = Math.hypot(dir[0], dir[1], dir[2]);
        this.enemyProjectile(e.x, cy, e.z, (dir[0] / len) * 7, (dir[1] / len) * 7, (dir[2] / len) * 7, 0.22, 10);
      }
    } else if (pattern === 1) {
      const dx = p.x - e.x;
      const dy = p.y + p.height / 2 - cy;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      for (let i = -1; i <= 1; i++) {
        const c = Math.cos(i * 0.2);
        const s = Math.sin(i * 0.2);
        const vx = (dx / d) * c - (dz / d) * s;
        const vz = (dx / d) * s + (dz / d) * c;
        this.enemyProjectile(e.x, cy, e.z, vx * 12, (dy / d) * 12, vz * 12, 0.35, 14);
      }
    } else if (pattern === 2) {
      if (this.enemies.length < MAX_ENEMIES - 2) {
        for (const off of [-2, 2]) this.enemies.push(this.makeEnemy("drone", e.x + off, e.y, e.z));
        this.fx.text(e.x, e.y - 0.5, e.z, "DEPLOYING DRONES", "#c084fc", 14);
      }
    } else {
      e.stateTimer = BOSS_DIVE_TIME;
      e.stateFlag = false;
      [e.targetX, e.targetZ] = this.findLandingSpot(e.x, e.z, e.radius);
      this.fx.text(e.x, e.y - 0.5, e.z, "BRACE!", "#f43f5e", 16);
      e.phase++;
      return;
    }
    this.sfx("enemyShot");
    e.phase++;
    e.fireCd = enraged ? 1.1 : 1.7;
  }

  /** Nearest spot to (x, z) where a hull of radius r fits without touching cover or scaffolds. */
  private findLandingSpot(x: number, z: number, r: number): [number, number] {
    const blocked = (cx: number, cz: number) =>
      [...SOLIDS, ...PLATFORMS].some((b) => Math.abs(cx - b.x) < b.w / 2 + r && Math.abs(cz - b.z) < b.d / 2 + r);
    let best: [number, number] = [x, z];
    let bestD = Infinity;
    for (let dx = -12; dx <= 12; dx += 1.5) {
      for (let dz = -6; dz <= 6; dz += 1.5) {
        const cx = clamp(x + dx, ARENA.minX + r, ARENA.maxX - r);
        const cz = clamp(z + dz, ARENA.minZ + r, ARENA.maxZ - r);
        const d = (cx - x) ** 2 + (cz - z) ** 2;
        if (d < bestD && !blocked(cx, cz)) {
          best = [cx, cz];
          bestD = d;
        }
      }
    }
    return best;
  }

  /** Damage the player and push them just outside the landed boss hull, on the side with room. */
  private knockOutOfBoss(e: Enemy) {
    const p = this.player;
    let dx = p.x - e.x;
    let dz = p.z - e.z;
    let d = Math.hypot(dx, dz);
    if (d < 0.01) {
      dx = 1;
      dz = 0;
      d = 1;
    }
    const reach = e.radius + p.radius + 0.15;
    let nx = dx / d;
    let nz = dz / d;
    const inside = (x: number, z: number) =>
      x >= ARENA.minX + p.radius && x <= ARENA.maxX - p.radius && z >= ARENA.minZ + p.radius && z <= ARENA.maxZ - p.radius;
    // Blocked by the arena edge on this side? Go the opposite way instead.
    if (!inside(e.x + nx * reach, e.z + nz * reach)) {
      nx = -nx;
      nz = -nz;
    }
    this.hurtPlayer(e.dmg, nx, nz);
    p.x = clamp(e.x + nx * reach, ARENA.minX + p.radius, ARENA.maxX - p.radius);
    p.z = clamp(e.z + nz * reach, ARENA.minZ + p.radius, ARENA.maxZ - p.radius);
  }

  private enemyShoot(x: number, y: number, z: number, tx: number, ty: number, tz: number, speed: number, dmg: number) {
    const dx = tx - x;
    const dy = ty - y;
    const dz = tz - z;
    const d = Math.hypot(dx, dy, dz) || 1;
    this.enemyProjectile(x, y, z, (dx / d) * speed, (dy / d) * speed, (dz / d) * speed, 0.18, dmg);
    this.sfx("enemyShot");
  }

  private enemyProjectile(x: number, y: number, z: number, vx: number, vy: number, vz: number, r: number, dmg: number) {
    this.projectiles.push({ x, y, z, vx, vy, vz, r, dmg, owner: "enemy", kind: r > 0.25 ? "plasma" : "bullet", life: 5, pierce: false, hit: new Set() });
  }

  private hurtEnemy(e: Enemy, dmg: number, kx: number, kz: number) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hitFlash = 0.1;
    if (e.kind !== "boss") {
      const k = e.kind === "brute" ? 0.35 : 1;
      e.vx = kx * k;
      e.vz = kz * k;
      if (Math.hypot(kx, kz) > 12 && e.kind !== "drone") e.vy = 6;
    }
    this.fx.text(e.x + rand(-0.3, 0.3), e.y + e.height + 0.2, e.z, String(Math.round(dmg)), "#fef08a", 13);
    this.fx.burst(e.x, e.y + e.height / 2, e.z, 5, "#fde68a", 3);
    this.sfx("hit");
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    e.dead = true;
    this.physics.removeActor(e.body);
    const cy = e.y + e.height / 2;
    this.combo++;
    this.comboTimer = 2.5;
    const mult = Math.min(3, 1 + Math.floor(this.combo / 5) * 0.5);
    const points = Math.round(e.value * mult);
    this.score += points;
    this.fx.text(e.x, cy + 0.8, e.z, `+${points}`, "#22c55e", 15);
    this.fx.burst(e.x, cy, e.z, e.kind === "boss" ? 140 : 26, e.kind === "drone" ? "#f43f5e" : "#fb923c", e.kind === "boss" ? 10 : 5);
    this.fx.burst(e.x, cy, e.z, 10, "#e5e7eb", 3);
    this.shake = Math.max(this.shake, e.kind === "boss" ? 24 : e.kind === "brute" ? 8 : 3);
    this.sfx("explode");

    if (e.kind === "boss") {
      this.fx.text(e.x, cy + 1.5, e.z, "BOSS DEFEATED!", "#c084fc", 30);
      for (let i = 0; i < 4; i++) this.dropPickup(e.x + rand(-2, 2), cy, e.z + rand(-2, 2), i % 2 ? "health" : "energy");
      // Clear the boss's remaining shots — a small reward.
      this.projectiles = this.projectiles.filter((pr) => pr.owner === "player");
    } else {
      const r = Math.random();
      if (r < 0.14) this.dropPickup(e.x, cy, e.z, "energy");
      else if (r < 0.22 || (e.kind === "brute" && r < 0.5)) this.dropPickup(e.x, cy, e.z, "health");
    }
  }

  private dropPickup(x: number, y: number, z: number, kind: Pickup["kind"]) {
    this.pickups.push({ id: this.nextId++, kind, x, y, z, vx: rand(-2, 2), vy: 6, vz: rand(-2, 2), onGround: false, life: 9 });
  }

  // ───────────────────────────── projectiles & effects ─────────────────────────────

  private updateProjectiles() {
    const p = this.player;
    for (const pr of this.projectiles) {
      if (pr.life <= 0) continue;
      pr.life -= STEP;
      const sx = pr.vx * STEP;
      const sy = pr.vy * STEP;
      const sz = pr.vz * STEP;
      const len = Math.hypot(sx, sy, sz);

      // Cover (cars, crates, platforms) and the street stop every shot.
      if (len > 0) {
        const toi = this.physics.raycastStatic(pr.x, pr.y, pr.z, sx / len, sy / len, sz / len, len + pr.r * 0.5);
        if (toi !== null) {
          pr.x += (sx / len) * toi;
          pr.y += (sy / len) * toi;
          pr.z += (sz / len) * toi;
          pr.life = 0;
          if (pr.owner === "player") this.fx.burst(pr.x, pr.y, pr.z, 5, pr.kind === "fire" ? "#f97316" : "#5eead4", 2);
          else this.fx.burst(pr.x, pr.y, pr.z, 3, "#f43f5e", 1.5);
          continue;
        }
      }
      pr.x += sx;
      pr.y += sy;
      pr.z += sz;

      if (pr.kind === "fire" && Math.random() < 0.8) {
        this.fx.spark(pr.x, pr.y, pr.z, rand(-0.5, 0.5), rand(0, 1), rand(-0.5, 0.5), Math.random() < 0.5 ? "#fde047" : "#f97316", 0.3, -1);
      }

      if (pr.owner === "player") {
        for (const e of this.enemies) {
          if (e.dead || pr.hit.has(e.id) || !sphereHitsActor(pr.x, pr.y, pr.z, pr.r, e)) continue;
          pr.hit.add(e.id);
          const hl = Math.hypot(pr.vx, pr.vz) || 1;
          this.hurtEnemy(e, pr.dmg, (pr.vx / hl) * 5, (pr.vz / hl) * 5);
          if (!pr.pierce) {
            pr.life = 0;
            this.fx.burst(pr.x, pr.y, pr.z, 5, pr.kind === "fire" ? "#f97316" : "#5eead4", 2);
            break;
          }
        }
      } else if (sphereHitsActor(pr.x, pr.y, pr.z, pr.r, p)) {
        if (p.shieldTimer > 0) {
          this.reflect(pr);
        } else if (p.invuln <= 0 && p.dashTimer <= 0) {
          const hl = Math.hypot(pr.vx, pr.vz) || 1;
          this.hurtPlayer(pr.dmg, pr.vx / hl, pr.vz / hl);
          pr.life = 0;
        }
      }

      if (Math.abs(pr.x) > 32 || Math.abs(pr.z) > 20 || pr.y > 30) pr.life = 0;
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0);
  }

  /** Prism Shield: bounce an enemy shot back as a crystal shard, aimed at the nearest robot. */
  private reflect(pr: Projectile) {
    let best: Enemy | null = null;
    let bestD = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
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
    pr.dmg = 18;
    pr.life = 2;
    pr.hit.clear();
    this.sfx("crystal");
  }

  private updateRings() {
    for (const ring of this.rings) {
      ring.life -= STEP;
      const r = ring.maxR * (1 - ring.life / ring.maxLife);
      for (const e of this.enemies) {
        if (e.dead || ring.hit.has(e.id)) continue;
        const dx = e.x - ring.x;
        const dz = e.z - ring.z;
        const d = Math.hypot(dx, dz);
        if (d > r + e.radius) continue;
        if (ring.kind === "nova") {
          if (Math.abs(e.y + e.height / 2 - ring.y) > 2 + e.height / 2) continue;
        } else if (e.y > ring.y + 0.8) {
          continue; // the quake only travels along the ground
        }
        ring.hit.add(e.id);
        const nx = d > 0.01 ? dx / d : 1;
        const nz = d > 0.01 ? dz / d : 0;
        this.hurtEnemy(e, ring.dmg, nx * (ring.kind === "nova" ? 18 : 13), nz * (ring.kind === "nova" ? 18 : 13));
      }
      if (ring.kind === "nova") {
        // The nova also burns away enemy bullets.
        for (const pr of this.projectiles) {
          if (pr.owner === "enemy" && Math.hypot(pr.x - ring.x, pr.y - ring.y, pr.z - ring.z) < r) pr.life = 0;
        }
      } else if (Math.random() < 0.9) {
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
      if (!pk.onGround) {
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
      const dx = pk.x - p.x;
      const dz = pk.z - p.z;
      const reach = p.radius + 0.5;
      if (dx * dx + dz * dz < reach * reach && pk.y < p.y + p.height && pk.y + 0.6 > p.y) {
        pk.life = 0;
        if (pk.kind === "energy") {
          p.energy = Math.min(100, p.energy + 25);
          this.fx.text(pk.x, pk.y + 1, pk.z, "+25 ENERGY", "#22c55e", 14);
        } else {
          p.hp = Math.min(p.maxHp, p.hp + 20);
          this.fx.text(pk.x, pk.y + 1, pk.z, "+20 HP", "#f472b6", 14);
        }
        this.sfx("pickup");
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);
  }

  private updateSlashes() {
    for (const s of this.slashes) s.life -= STEP;
    this.slashes = this.slashes.filter((s) => s.life > 0);
  }
}
