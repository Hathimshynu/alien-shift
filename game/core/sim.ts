import type { GameEvent, SfxName } from "./events";
import { ALIEN_ORDER, FORMS } from "./forms";
import type {
  Body,
  Enemy,
  EnemyKind,
  FloatText,
  FormId,
  GameStatus,
  HudState,
  InputSource,
  Particle,
  Pickup,
  Player,
  Projectile,
  Ring,
  Slash,
} from "./types";
import {
  GRAVITY,
  GROUND_Y,
  MAX_FALL,
  PLATFORMS,
  STEP,
  WORLD_H,
  WORLD_W,
  circleHitsRect,
  clamp,
  overlaps,
  rand,
} from "./world";

const ENERGY_DRAIN = 5; // per second while transformed (≈20s from full)
const ENERGY_RECHARGE = 9; // per second in human form
const TRANSFORM_MIN_ENERGY = 15;
/** Minimum gap between voluntary transformations (including reverting to Kai). */
export const TRANSFORM_COOLDOWN = 1;
const UNLOCK_ENERGY = 35;
const MAX_PARTICLES = 700;
const MAX_ENEMIES = 14;
/** Boss dive: total length and how long it sits on the ground (the melee window). */
const BOSS_DIVE_TIME = 2.6;
const BOSS_DIVE_GROUNDED = 1.4;

/**
 * The whole game simulation. Pure TypeScript: no DOM, no audio, no storage.
 * Advance it with `update(input)` exactly once per fixed `STEP`; read side effects from `events`.
 */
export class GameSim {
  status: GameStatus = "menu";
  player: Player = GameSim.newPlayer();
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  rings: Ring[] = [];
  texts: FloatText[] = [];
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
  shake = 0;

  /** Side effects queued this frame; the driver drains (and clears) this list. */
  readonly events: GameEvent[] = [];

  private nextId = 1;

  private static newPlayer(): Player {
    const f = FORMS.human;
    return {
      x: WORLD_W / 2 - f.w / 2,
      y: GROUND_Y - f.h,
      w: f.w,
      h: f.h,
      vx: 0,
      vy: 0,
      onGround: true,
      facing: 1,
      form: "human",
      hp: 100,
      maxHp: 100,
      energy: 100,
      watchLocked: false,
      attackCd: 0,
      specialCd: 0,
      transformCd: 0,
      attackAnim: 0,
      invuln: 0,
      dashTimer: 0,
      dashHit: new Set(),
      shieldTimer: 0,
      flash: 0,
      anim: 0,
      jumpsLeft: 0,
      dropTimer: 0,
    };
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  startGame() {
    this.player = GameSim.newPlayer();
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.rings = [];
    this.texts = [];
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
    };
  }

  private setStatus(status: GameStatus) {
    if (this.status === status) return;
    this.status = status;
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
    this.updateEffects();
    this.updateWaves();

    if (this.comboTimer > 0) {
      this.comboTimer -= STEP;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    this.shake = Math.max(0, this.shake - 0.6);
  }

  private moveBody(b: Body, usePlatforms: boolean, gravity = GRAVITY) {
    b.x += b.vx;
    const prevBottom = b.y + b.h;
    b.vy = Math.min(b.vy + gravity, MAX_FALL);
    b.y += b.vy;
    b.onGround = false;
    if (b.y + b.h >= GROUND_Y) {
      b.y = GROUND_Y - b.h;
      b.vy = 0;
      b.onGround = true;
      return;
    }
    if (!usePlatforms || b.vy < 0) return;
    for (const pl of PLATFORMS) {
      if (b.x + b.w > pl.x && b.x < pl.x + pl.w && prevBottom <= pl.y + 0.5 && b.y + b.h >= pl.y) {
        b.y = pl.y - b.h;
        b.vy = 0;
        b.onGround = true;
        return;
      }
    }
  }

  private updatePlayer(input: InputSource) {
    const p = this.player;
    const f = FORMS[p.form];

    p.attackCd -= STEP;
    p.specialCd -= STEP;
    p.transformCd = Math.max(0, p.transformCd - STEP);
    p.attackAnim = Math.max(0, p.attackAnim - STEP);
    p.invuln = Math.max(0, p.invuln - STEP);
    p.flash = Math.max(0, p.flash - STEP);
    p.dropTimer = Math.max(0, p.dropTimer - STEP);
    p.shieldTimer = Math.max(0, p.shieldTimer - STEP);

    // Movement
    if (p.dashTimer > 0) {
      p.dashTimer -= STEP;
      p.vx = p.facing * 20;
      p.vy = 0;
      for (const e of this.enemies) {
        if (!e.dead && !p.dashHit.has(e.id) && overlaps(p, e)) {
          p.dashHit.add(e.id);
          this.hurtEnemy(e, 28, p.facing * 8);
        }
      }
      this.spawnParticle(p.x + p.w / 2, p.y + rand(0, p.h), -p.facing * rand(1, 3), rand(-1, 1), "#facc15", 0.3, 3);
    } else {
      const dir = (input.isHeld("right") ? 1 : 0) - (input.isHeld("left") ? 1 : 0);
      p.vx += (dir * f.speed - p.vx) * (p.onGround ? 0.35 : 0.18);
      if (dir !== 0) p.facing = dir as 1 | -1;

      if (p.onGround) p.jumpsLeft = f.airJumps;
      if (input.wasPressed("jump") && (p.onGround || p.jumpsLeft > 0)) {
        if (!p.onGround) {
          p.jumpsLeft--;
          this.burst(p.x + p.w / 2, p.y + p.h, 10, f.accent, 3);
        }
        p.vy = -f.jump;
        this.sfx("jump");
      }
      // Variable jump height: release early for a short hop.
      if (!input.isHeld("jump") && p.vy < -4) p.vy += 0.5;
      if (input.isHeld("down") && p.onGround && p.y + p.h < GROUND_Y) p.dropTimer = 0.25;
    }

    const fallSpeed = p.vy;
    const wasGrounded = p.onGround;
    this.moveBody(p, p.dropTimer <= 0, p.dashTimer > 0 ? 0 : GRAVITY);
    p.x = clamp(p.x, 0, WORLD_W - p.w);
    if (p.onGround && !wasGrounded && p.form === "titan" && fallSpeed > 10) {
      this.shake = Math.max(this.shake, 6);
      this.burst(p.x + p.w / 2, p.y + p.h, 14, "#a8a29e", 4);
    }
    p.anim += Math.abs(p.vx) * STEP;

    // Combat
    if (input.isHeld("attack") && p.attackCd <= 0) {
      this.attack();
      p.attackCd = f.attackCooldown;
    }
    if (input.wasPressed("special") && p.specialCd <= 0) this.special();

    // Shiftwatch energy
    if (p.form !== "human") {
      p.energy -= ENERGY_DRAIN * STEP;
      if (p.energy <= 0) {
        p.energy = 0;
        p.watchLocked = true;
        this.transform("human", true);
        this.floatText(p.x + p.w / 2, p.y - 20, "WATCH TIMED OUT!", "#ef4444", 18);
        this.sfx("timeout");
      }
    } else {
      p.energy = Math.min(100, p.energy + ENERGY_RECHARGE * STEP);
      if (p.watchLocked && p.energy >= UNLOCK_ENERGY) {
        p.watchLocked = false;
        this.floatText(p.x + p.w / 2, p.y - 20, "WATCH READY", "#22c55e", 16);
        this.sfx("pickup");
      }
    }

    // Ambient form particles
    const cx = p.x + p.w / 2;
    if (p.form === "blaze" && Math.random() < 0.6) {
      this.spawnParticle(cx + rand(-6, 6), p.y + 8, rand(-0.4, 0.4), rand(-2, -1), Math.random() < 0.5 ? "#fde047" : "#f97316", 0.5, rand(2, 4), -0.02);
    } else if (p.form === "bolt" && Math.abs(p.vx) > 4 && Math.random() < 0.7) {
      this.spawnParticle(cx - p.facing * 10, p.y + rand(8, p.h), -p.facing * rand(0.5, 2), 0, "#facc15", 0.25, 2, 0);
    } else if (p.form === "shard" && Math.random() < 0.08) {
      this.spawnParticle(cx + rand(-14, 14), p.y + rand(0, p.h), 0, -0.5, "#e0f2fe", 0.6, 2, 0);
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
        this.floatText(p.x + p.w / 2, p.y - 16, "RECHARGING…", "#fca5a5", 14);
        this.sfx("error");
        return;
      }
    }
    const nf = FORMS[id];
    const cx = p.x + p.w / 2;
    const bottom = p.y + p.h;
    p.form = id;
    p.w = nf.w;
    p.h = nf.h;
    p.x = clamp(cx - nf.w / 2, 0, WORLD_W - nf.w);
    p.y = bottom - nf.h;
    p.flash = 0.45;
    p.invuln = Math.max(p.invuln, 0.4);
    p.transformCd = TRANSFORM_COOLDOWN;
    p.shieldTimer = 0;
    p.dashTimer = 0;
    p.attackCd = 0.15;
    this.burst(cx, p.y + p.h / 2, 40, "#22c55e", 6);
    if (!forced) {
      this.floatText(cx, p.y - 18, id === "human" ? "KAI" : nf.name.toUpperCase() + "!", nf.accent, 20);
      this.sfx("transform");
    }
  }

  private attack() {
    const p = this.player;
    const cx = p.x + p.w / 2;
    p.attackAnim = 0.15;
    switch (p.form) {
      case "human":
        this.melee(32, 6, 4, "#ffffff");
        this.sfx("punch");
        break;
      case "blaze":
        this.projectiles.push({
          x: cx + p.facing * (p.w / 2),
          y: p.y + p.h * 0.35,
          vx: p.facing * 9 + p.vx * 0.3,
          vy: 0,
          r: 8,
          dmg: 12,
          owner: "player",
          kind: "fire",
          color: "#f97316",
          life: 1.4,
          pierce: false,
          hit: new Set(),
        });
        this.sfx("shoot");
        break;
      case "titan":
        this.melee(80, 32, 11, "#fb923c");
        this.shake = Math.max(this.shake, 5);
        this.sfx("heavy");
        break;
      case "bolt":
        this.melee(46, 9, 3, "#facc15");
        this.sfx("punch");
        break;
      case "shard":
        for (const angle of [-0.18, 0, 0.18]) {
          this.projectiles.push({
            x: cx + p.facing * (p.w / 2),
            y: p.y + p.h * 0.4,
            vx: Math.cos(angle) * 10 * p.facing,
            vy: Math.sin(angle) * 10,
            r: 6,
            dmg: 9,
            owner: "player",
            kind: "crystal",
            color: "#5eead4",
            life: 1,
            pierce: false,
            hit: new Set(),
          });
        }
        this.sfx("crystal");
        break;
    }
  }

  private melee(range: number, dmg: number, knockback: number, color: string) {
    const p = this.player;
    const box = {
      x: p.facing > 0 ? p.x + p.w - 6 : p.x - range + 6,
      y: p.y + p.h * 0.1,
      w: range,
      h: p.h * 0.8,
    };
    this.slashes.push({ ...box, color, life: 0.15, facing: p.facing });
    for (const e of this.enemies) {
      if (!e.dead && overlaps(box, e)) this.hurtEnemy(e, dmg, p.facing * knockback);
    }
    // Melee also swats enemy bullets out of the air.
    for (const pr of this.projectiles) {
      if (pr.owner === "enemy" && circleHitsRect(pr.x, pr.y, pr.r, box)) pr.life = 0;
    }
  }

  private special() {
    const p = this.player;
    const f = FORMS[p.form];
    if (p.form === "human") return;
    if (p.energy < f.specialCost) {
      this.floatText(p.x + p.w / 2, p.y - 16, "LOW ENERGY", "#fca5a5", 14);
      this.sfx("error");
      return;
    }
    p.energy -= f.specialCost;
    p.specialCd = f.specialCooldown;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;

    switch (p.form) {
      case "blaze":
        this.rings.push({ x: cx, y: cy, maxR: 160, color: "#f97316", life: 0.45, maxLife: 0.45, dmg: 30, hit: new Set() });
        this.burst(cx, cy, 50, "#fde047", 8);
        this.shake = Math.max(this.shake, 8);
        this.sfx("heavy");
        break;
      case "titan":
        for (const dir of [-1, 1]) {
          this.projectiles.push({
            x: cx,
            y: p.y + p.h - 16,
            vx: dir * 8,
            vy: 0,
            r: 18,
            dmg: 40,
            owner: "player",
            kind: "wave",
            color: "#fb923c",
            life: 1.1,
            pierce: true,
            hit: new Set(),
          });
        }
        this.shake = Math.max(this.shake, 16);
        this.burst(cx, p.y + p.h, 30, "#a8a29e", 6);
        this.sfx("heavy");
        break;
      case "bolt":
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

  private hurtPlayer(dmg: number, dir: number) {
    const p = this.player;
    if (p.invuln > 0 || p.dashTimer > 0 || this.status !== "playing") return;
    if (p.shieldTimer > 0) {
      this.burst(p.x + p.w / 2, p.y + p.h / 2, 6, "#a5f3fc", 3);
      return;
    }
    const amount = Math.max(1, Math.round(dmg * FORMS[p.form].armor));
    p.hp -= amount;
    p.invuln = 0.9;
    p.vx = dir * 6;
    p.vy = -5;
    this.shake = Math.max(this.shake, 8);
    this.combo = 0;
    this.floatText(p.x + p.w / 2, p.y - 10, `-${amount}`, "#ef4444", 16);
    this.burst(p.x + p.w / 2, p.y + p.h / 2, 16, "#ef4444", 4);
    this.sfx("hurt");
    if (p.hp <= 0) this.gameOver();
  }

  private gameOver() {
    this.setStatus("gameover");
    this.burst(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, 60, "#22c55e", 7);
    this.sfx("gameOver");
  }

  // ───────────────────────────── enemies ─────────────────────────────

  private makeEnemy(kind: EnemyKind, x: number, y: number): Enemy {
    const scale = 1 + (this.wave - 1) * 0.1;
    const base = {
      crawler: { w: 34, h: 28, hp: 30, speed: rand(1.5, 2.2), dmg: 10, value: 100 },
      drone: { w: 40, h: 24, hp: 22, speed: 1, dmg: 8, value: 150 },
      brute: { w: 58, h: 66, hp: 130, speed: 0.9, dmg: 22, value: 400 },
      boss: { w: 170, h: 90, hp: 1100 * (1 + (this.wave / 5 - 1) * 0.5), speed: 1, dmg: 25, value: 5000 },
    }[kind];
    const hp = kind === "boss" ? base.hp : Math.round(base.hp * scale);
    return {
      id: this.nextId++,
      kind,
      x,
      y,
      w: base.w,
      h: base.h,
      vx: 0,
      vy: 0,
      onGround: false,
      hp,
      maxHp: hp,
      speed: base.speed,
      dmg: base.dmg,
      fireCd: kind === "drone" ? rand(1, 2.5) : 2,
      hitFlash: 0,
      t: rand(0, 10),
      value: base.value,
      phase: 0,
      stateTimer: 0,
      stateFlag: false,
      dead: false,
    };
  }

  private spawnEnemy() {
    const w = this.wave;
    const roll = Math.random();
    let kind: EnemyKind = "crawler";
    if (w >= 3 && roll < 0.15 + Math.min(0.15, w * 0.01)) kind = "brute";
    else if (w >= 2 && roll < 0.55) kind = "drone";

    const left = Math.random() < 0.5;
    if (kind === "drone") {
      this.enemies.push(this.makeEnemy(kind, left ? -40 : WORLD_W + 10, rand(60, 160)));
    } else {
      const e = this.makeEnemy(kind, 0, 0);
      e.x = left ? -e.w : WORLD_W;
      e.y = GROUND_Y - e.h;
      this.enemies.push(e);
    }
  }

  private startWave(n: number) {
    this.wave = n;
    this.waveActive = true;
    const isBoss = n % 5 === 0;
    this.toSpawn = isBoss ? 2 + n / 5 : Math.min(30, 4 + n * 2);
    this.spawnCd = 1.5;
    this.banner = 2.2;
    this.bannerText = isBoss ? `WAVE ${n} — BOSS INCOMING` : `WAVE ${n}`;
    if (isBoss) {
      const boss = this.makeEnemy("boss", WORLD_W / 2 - 85, -120);
      this.enemies.push(boss);
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
    } else if (this.waveActive && this.enemies.length === 0) {
      this.waveActive = false;
      this.waveBreak = 2.5;
      const bonus = this.wave * 250;
      this.score += bonus;
      this.floatText(WORLD_W / 2, 200, `WAVE CLEAR  +${bonus}`, "#22c55e", 26);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 10);
      this.events.push({ type: "waveCleared", wave: this.wave });
    } else if (!this.waveActive) {
      this.waveBreak -= STEP;
      if (this.waveBreak <= 0) this.startWave(this.wave + 1);
    }
  }

  private updateEnemies() {
    const p = this.player;
    const pcx = p.x + p.w / 2;
    const pcy = p.y + p.h / 2;

    for (const e of this.enemies) {
      // A diving boss freezes its sway clock so it doesn't teleport sideways when it rises again.
      if (!(e.kind === "boss" && e.stateTimer > 0)) e.t += STEP;
      e.hitFlash = Math.max(0, e.hitFlash - STEP);
      e.fireCd -= STEP;
      const ecx = e.x + e.w / 2;
      const ecy = e.y + e.h / 2;
      const dir = Math.sign(pcx - ecx) || 1;

      switch (e.kind) {
        case "crawler": {
          e.vx += (dir * e.speed - e.vx) * 0.08;
          if (e.onGround && p.y + p.h < e.y - 20 && Math.abs(pcx - ecx) < 150 && e.fireCd <= 0) {
            e.vy = -13;
            e.fireCd = 1.4;
          }
          this.moveBody(e, true);
          break;
        }
        case "brute": {
          e.vx += (dir * e.speed - e.vx) * 0.05;
          if (e.onGround && Math.abs(pcx - ecx) < 170 && e.fireCd <= 0) {
            e.vx = dir * 8;
            e.vy = -8;
            e.fireCd = 3;
          }
          this.moveBody(e, false);
          if (e.onGround && e.vy === 0 && Math.abs(e.vx) > 5) this.shake = Math.max(this.shake, 2);
          break;
        }
        case "drone": {
          const tx = pcx + Math.sin(e.t * 0.9 + e.id) * 170;
          const ty = 90 + Math.sin(e.t * 1.7 + e.id) * 40;
          e.x += (tx - ecx) * 0.015 + e.vx;
          e.y += (ty - ecy) * 0.03 + e.vy;
          e.vx *= 0.9;
          e.vy *= 0.9;
          if (e.fireCd <= 0) {
            this.enemyShoot(ecx, e.y + e.h, pcx, pcy, 4.5, 8, "#f43f5e");
            e.fireCd = Math.max(1.1, 2.4 - this.wave * 0.06);
          }
          break;
        }
        case "boss":
          this.updateBoss(e, pcx, pcy);
          break;
      }

      if (e.kind !== "boss") e.x = clamp(e.x, -e.w, WORLD_W);
      if (overlaps(p, e)) this.hurtPlayer(e.dmg, Math.sign(pcx - ecx) || 1);
    }
    this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private updateBoss(e: Enemy, pcx: number, pcy: number) {
    const enraged = e.hp < e.maxHp / 2;

    // Dive attack: slam into the street and sit there briefly. It's dangerous to stand under,
    // but it is also the window where melee forms (and plain Kai) can actually reach the boss.
    if (e.stateTimer > 0) {
      e.stateTimer -= STEP;
      const grounded = e.stateTimer < BOSS_DIVE_GROUNDED + 0.35 && e.stateTimer > 0.35;
      const targetY = e.stateTimer > 0.35 ? GROUND_Y - e.h : 50;
      e.y += (targetY - e.y) * (grounded ? 0.25 : 0.06);
      if (!e.stateFlag && e.y + e.h >= GROUND_Y - 4) {
        e.stateFlag = true;
        this.shake = Math.max(this.shake, 14);
        this.burst(e.x + e.w / 2, GROUND_Y, 40, "#a78bfa", 6);
        this.sfx("heavy");
        // Landing on the player hurts once, then shoves them out so they can't get stuck inside the hull.
        const p = this.player;
        if (overlaps(p, e)) {
          const leftX = e.x - p.w - 2;
          const rightX = e.x + e.w + 2;
          // Prefer the nearer side, but the boss's sway range always leaves room on at least one side.
          const goLeft = leftX >= 0 && (pcx < e.x + e.w / 2 || rightX > WORLD_W - p.w);
          this.hurtPlayer(e.dmg, goLeft ? -1 : 1);
          p.x = goLeft ? leftX : rightX;
        }
      }
      if (e.stateTimer <= 0) e.fireCd = enraged ? 0.9 : 1.4;
      return;
    }

    const targetY = 50 + Math.sin(e.t * 1.3) * 18;
    e.y += (targetY - e.y) * 0.04;
    e.x = WORLD_W / 2 - e.w / 2 + Math.sin(e.t * (enraged ? 0.8 : 0.55)) * 330;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h * 0.75;

    if (e.fireCd > 0) return;
    const pattern = e.phase % 4;
    if (pattern === 0) {
      const n = enraged ? 16 : 11;
      for (let i = 0; i < n; i++) {
        const a = Math.PI * (0.1 + (0.8 * i) / (n - 1));
        this.enemyProjectile(cx, cy, Math.cos(a) * 3.6, Math.sin(a) * 3.6, 7, 10, "#c084fc");
      }
    } else if (pattern === 1) {
      for (let i = -1; i <= 1; i++) {
        const a = Math.atan2(pcy - cy, pcx - cx) + i * 0.2;
        this.enemyProjectile(cx, cy, Math.cos(a) * 6, Math.sin(a) * 6, 8, 14, "#f43f5e");
      }
    } else if (pattern === 2) {
      if (this.enemies.length < MAX_ENEMIES - 2) {
        for (const dx of [-60, 60]) this.enemies.push(this.makeEnemy("drone", cx + dx, cy));
        this.floatText(cx, e.y + e.h + 20, "DEPLOYING DRONES", "#c084fc", 14);
      }
    } else {
      e.stateTimer = BOSS_DIVE_TIME;
      e.stateFlag = false;
      this.floatText(cx, e.y + e.h + 20, "BRACE!", "#f43f5e", 16);
      e.phase++;
      return;
    }
    this.sfx("enemyShot");
    e.phase++;
    e.fireCd = enraged ? 1.1 : 1.7;
  }

  private enemyShoot(x: number, y: number, tx: number, ty: number, speed: number, dmg: number, color: string) {
    const a = Math.atan2(ty - y, tx - x);
    this.enemyProjectile(x, y, Math.cos(a) * speed, Math.sin(a) * speed, 5, dmg, color);
    this.sfx("enemyShot");
  }

  private enemyProjectile(x: number, y: number, vx: number, vy: number, r: number, dmg: number, color: string) {
    this.projectiles.push({ x, y, vx, vy, r, dmg, owner: "enemy", kind: r > 6 ? "plasma" : "bullet", color, life: 5, pierce: false, hit: new Set() });
  }

  private hurtEnemy(e: Enemy, dmg: number, knockback: number) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hitFlash = 0.1;
    if (e.kind !== "boss") {
      e.vx = knockback * (e.kind === "brute" ? 0.35 : 1);
      if (Math.abs(knockback) > 6 && e.kind !== "drone") e.vy = -4;
    }
    this.floatText(e.x + e.w / 2 + rand(-8, 8), e.y - 4, String(Math.round(dmg)), "#fef08a", 13);
    this.burst(e.x + e.w / 2, e.y + e.h / 2, 5, "#fde68a", 3);
    this.sfx("hit");
    if (e.hp <= 0) this.killEnemy(e);
  }

  private killEnemy(e: Enemy) {
    e.dead = true;
    const cx = e.x + e.w / 2;
    const cy = e.y + e.h / 2;
    this.combo++;
    this.comboTimer = 2.5;
    const mult = Math.min(3, 1 + Math.floor(this.combo / 5) * 0.5);
    const points = Math.round(e.value * mult);
    this.score += points;
    this.floatText(cx, cy - 20, `+${points}`, "#22c55e", 15);
    this.burst(cx, cy, e.kind === "boss" ? 140 : 26, e.kind === "drone" ? "#f43f5e" : "#fb923c", e.kind === "boss" ? 10 : 5);
    this.burst(cx, cy, 10, "#e5e7eb", 3);
    this.shake = Math.max(this.shake, e.kind === "boss" ? 24 : e.kind === "brute" ? 8 : 3);
    this.sfx("explode");

    if (e.kind === "boss") {
      this.floatText(cx, cy, "BOSS DEFEATED!", "#c084fc", 30);
      for (let i = 0; i < 4; i++) this.dropPickup(cx + rand(-60, 60), cy, i % 2 ? "health" : "energy");
      // Clear the boss's remaining shots — a small reward.
      this.projectiles = this.projectiles.filter((pr) => pr.owner === "player");
    } else {
      const r = Math.random();
      if (r < 0.14) this.dropPickup(cx, cy, "energy");
      else if (r < 0.22 || (e.kind === "brute" && r < 0.5)) this.dropPickup(cx, cy, "health");
    }
  }

  private dropPickup(x: number, y: number, kind: Pickup["kind"]) {
    this.pickups.push({ x: x - 9, y: y - 9, w: 18, h: 18, vx: rand(-1.5, 1.5), vy: -5, onGround: false, kind, life: 9 });
  }

  // ───────────────────────────── projectiles & effects ─────────────────────────────

  private updateProjectiles() {
    const p = this.player;
    for (const pr of this.projectiles) {
      pr.x += pr.vx;
      pr.y += pr.vy;
      pr.life -= STEP;

      if (pr.kind === "fire" && Math.random() < 0.8) {
        this.spawnParticle(pr.x, pr.y, rand(-0.5, 0.5), rand(-0.8, 0), Math.random() < 0.5 ? "#fde047" : "#f97316", 0.3, rand(2, 4), -0.02);
      } else if (pr.kind === "wave" && Math.random() < 0.9) {
        this.spawnParticle(pr.x, GROUND_Y, rand(-1, 1), rand(-5, -2), "#a8a29e", 0.5, rand(2, 5), 0.3);
      }

      if (pr.owner === "player") {
        for (const e of this.enemies) {
          if (e.dead || pr.hit.has(e.id) || !circleHitsRect(pr.x, pr.y, pr.r, e)) continue;
          pr.hit.add(e.id);
          this.hurtEnemy(e, pr.dmg, Math.sign(pr.vx) * (pr.kind === "wave" ? 6 : 2.5));
          if (!pr.pierce) {
            pr.life = 0;
            break;
          }
        }
      } else if (circleHitsRect(pr.x, pr.y, pr.r, p)) {
        if (p.shieldTimer > 0) {
          // Prism Shield reflects enemy fire back as crystal shards.
          pr.owner = "player";
          pr.kind = "crystal";
          pr.color = "#5eead4";
          pr.vx = -pr.vx * 1.4;
          pr.vy = -Math.abs(pr.vy) * 1.2;
          pr.dmg = 18;
          pr.life = 2;
          this.sfx("crystal");
        } else if (p.invuln <= 0 && p.dashTimer <= 0) {
          this.hurtPlayer(pr.dmg, Math.sign(pr.vx) || 1);
          pr.life = 0;
        }
      }

      const out = pr.x < -40 || pr.x > WORLD_W + 40 || pr.y < -60 || pr.y > WORLD_H + 20;
      if (out || (pr.kind !== "wave" && pr.y > GROUND_Y)) pr.life = 0;
      if (pr.life <= 0 && pr.kind !== "bullet" && pr.kind !== "plasma") this.burst(pr.x, pr.y, 5, pr.color, 2);
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0);
  }

  private updateRings() {
    for (const ring of this.rings) {
      ring.life -= STEP;
      const r = ring.maxR * (1 - ring.life / ring.maxLife);
      for (const e of this.enemies) {
        if (e.dead || ring.hit.has(e.id)) continue;
        const d = Math.hypot(e.x + e.w / 2 - ring.x, e.y + e.h / 2 - ring.y);
        if (d < r + Math.min(e.w, e.h) / 2) {
          ring.hit.add(e.id);
          this.hurtEnemy(e, ring.dmg, Math.sign(e.x + e.w / 2 - ring.x) * 9);
        }
      }
      // The nova also burns away enemy bullets.
      for (const pr of this.projectiles) {
        if (pr.owner === "enemy" && Math.hypot(pr.x - ring.x, pr.y - ring.y) < r) pr.life = 0;
      }
    }
    this.rings = this.rings.filter((r) => r.life > 0);
  }

  private updatePickups() {
    const p = this.player;
    for (const pk of this.pickups) {
      pk.life -= STEP;
      pk.vx *= 0.95;
      this.moveBody(pk, true, 0.4);
      pk.x = clamp(pk.x, 0, WORLD_W - pk.w);
      if (overlaps(p, pk)) {
        pk.life = 0;
        if (pk.kind === "energy") {
          p.energy = Math.min(100, p.energy + 25);
          this.floatText(pk.x, pk.y - 10, "+25 ENERGY", "#22c55e", 14);
        } else {
          p.hp = Math.min(p.maxHp, p.hp + 20);
          this.floatText(pk.x, pk.y - 10, "+20 HP", "#f472b6", 14);
        }
        this.sfx("pickup");
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);
  }

  private updateEffects() {
    for (const pt of this.particles) {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vy += pt.gravity;
      pt.life -= STEP;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
    for (const t of this.texts) {
      t.y -= 0.6;
      t.life -= STEP;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    for (const s of this.slashes) s.life -= STEP;
    this.slashes = this.slashes.filter((s) => s.life > 0);
  }

  private spawnParticle(x: number, y: number, vx: number, vy: number, color: string, life: number, size: number, gravity = 0.15) {
    if (this.particles.length >= MAX_PARTICLES) return;
    this.particles.push({ x, y, vx, vy, life, maxLife: life, color, size, gravity });
  }

  private burst(x: number, y: number, count: number, color: string, speed: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(0.3, 1) * speed;
      this.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, color, rand(0.3, 0.8), rand(2, 4));
    }
  }

  private floatText(x: number, y: number, text: string, color: string, size: number) {
    this.texts.push({ x, y, text, color, life: 1, size });
  }
}
