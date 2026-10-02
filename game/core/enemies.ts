import { ARENA, STEP, rand } from "./arena";
import type { GameSim } from "./sim";
import type { Actor, Enemy, EnemyKind } from "./types";

/**
 * Enemy registry. Every robot type is ONE entry: stats, class, and its behaviour function.
 * To add an enemy: add its kind to EnemyKind (types.ts), an entry here, and a look in
 * components/three/Enemies.tsx. Bosses only have stats here; their behaviour is in bosses/*.ts.
 *
 * Contact / shot damage follows the tiers in rules.ts (normal 10–15, elite 20–30, boss 35–50)
 * and is then scaled by the difficulty when it hits Kai (GameSim.hurtPlayer).
 */
export type EnemyClass = "basic" | "shooter" | "fast" | "tank" | "flying" | "elite" | "boss" | "static";

/** Shared per-step context for a behaviour: where the target is and how fast the robot may move. */
export interface AiCtx {
  target: Actor | null;
  tx: number;
  ty: number;
  tz: number;
  dist: number;
  /** Unit direction to the target on the ground plane. */
  nx: number;
  nz: number;
  /** Status-effect speed multiplier (root = 0, slow = 0.45). */
  sm: number;
}

export interface EnemyDef {
  name: string;
  class: EnemyClass;
  radius: number;
  height: number;
  hp: number;
  speed: number;
  /** Contact damage (bombers: explosion; shooters: damage per shot). */
  dmg: number;
  value: number;
  /** Shift Cores dropped (60% chance for regular robots, always for bosses). */
  cores: number;
  /** Walkers get a physics body and collide with cover; flyers and fixed robots don't. */
  walker: boolean;
  /** Hovers above the street (separate crowd separation, never launched). */
  flying: boolean;
  /** Frontal shield strength (wardens). */
  shield: number;
  /** How much knockback it takes (0 = immovable). */
  knock: number;
  /** Can roll as an elite variant (more HP and damage, gold trim). */
  canBeElite: boolean;
  ai?(sim: GameSim, e: Enemy, c: AiCtx): void;
}

/** Elite variants of regular robots. */
export const ELITE_HP = 2.2;
export const ELITE_DMG = 1.8;

/** Rotate an enemy's facing towards (nx, nz) by at most `rate` radians per second (wardens turn slowly). */
function turnTowards(e: Enemy, nx: number, nz: number, rate: number) {
  const cur = Math.atan2(e.fz, e.fx);
  let diff = Math.atan2(nz, nx) - cur;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const a = cur + Math.max(-rate * STEP, Math.min(rate * STEP, diff));
  e.fx = Math.cos(a);
  e.fz = Math.sin(a);
}

/** Walk towards (vx, vz) with some inertia and face the target. */
function walk(sim: GameSim, e: Enemy, c: AiCtx, vx: number, vz: number, k: number) {
  e.vx += (vx * c.sm - e.vx) * k;
  e.vz += (vz * c.sm - e.vz) * k;
  sim.moveActor(e, "oneway");
  e.fx = c.nx;
  e.fz = c.nz;
}

/** Hop up after a target standing on a platform or car. */
function hopAfter(e: Enemy, c: AiCtx, power: number) {
  if (c.target && e.onGround && c.target.y > e.y + 1 && c.dist < 5 && e.fireCd <= 0 && c.sm > 0) {
    e.vy = power;
    e.fireCd = 1.4;
  }
}

/** Hover-flyer movement towards (gx, gy, gz). */
function hover(e: Enemy, gx: number, gy: number, gz: number, sm: number, k = 0.015) {
  e.x += (gx - e.x) * k * sm + e.vx * STEP;
  e.z += (gz - e.z) * k * sm + e.vz * STEP;
  e.y += (gy - e.y) * 0.03 + e.vy * STEP;
  e.vx *= 0.9;
  e.vy *= 0.9;
  e.vz *= 0.9;
}

/** Shots per volley for shooters (harder difficulties add one). */
const shots = (sim: GameSim, n: number) => n + (sim.difficulty.extraShots ? 1 : 0);

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  crawler: {
    name: "Crawler", class: "basic", radius: 0.5, height: 0.8, hp: 30, speed: 3.7, dmg: 12, value: 100, cores: 1,
    walker: true, flying: false, shield: 0, knock: 1, canBeElite: true,
    ai(sim, e, c) {
      walk(sim, e, c, c.nx * e.speed, c.nz * e.speed, 0.08);
      hopAfter(e, c, 13);
    },
  },
  skitter: {
    name: "Skitter", class: "fast", radius: 0.4, height: 0.55, hp: 18, speed: 7.2, dmg: 10, value: 120, cores: 1,
    walker: true, flying: false, shield: 0, knock: 1.2, canBeElite: true,
    ai(sim, e, c) {
      // Zig-zags in fast, then pounces.
      const zig = Math.sin(e.t * 7 + e.id) * 0.7;
      const vx = (c.nx - c.nz * zig) * e.speed;
      const vz = (c.nz + c.nx * zig) * e.speed;
      if (c.target && e.onGround && c.dist < 4 && c.dist > 1.2 && e.fireCd <= 0 && c.sm > 0) {
        e.vx = c.nx * 14;
        e.vz = c.nz * 14;
        e.vy = 7;
        e.fireCd = 1.8;
        sim.moveActor(e, "oneway");
        return;
      }
      if (!e.onGround) {
        sim.moveActor(e, "oneway");
        return;
      }
      walk(sim, e, c, vx, vz, 0.15);
      hopAfter(e, c, 14);
    },
  },
  gunner: {
    name: "Gunner", class: "shooter", radius: 0.5, height: 1.6, hp: 45, speed: 2.8, dmg: 11, value: 220, cores: 2,
    walker: true, flying: false, shield: 0, knock: 0.8, canBeElite: true,
    ai(sim, e, c) {
      // Keeps 7–11 m away and strafes, firing bursts.
      let vx = 0;
      let vz = 0;
      if (c.dist > 11) {
        vx = c.nx;
        vz = c.nz;
      } else if (c.dist < 7) {
        vx = -c.nx;
        vz = -c.nz;
      } else {
        const side = Math.sin(e.t * 0.6 + e.id) > 0 ? 1 : -1;
        vx = -c.nz * side * 0.7;
        vz = c.nx * side * 0.7;
      }
      walk(sim, e, c, vx * e.speed, vz * e.speed, 0.1);
      if (!c.target) return;
      if (e.phase > 0) {
        e.stateTimer -= STEP;
        if (e.stateTimer <= 0) {
          sim.enemyShoot(e, c.tx + rand(-0.4, 0.4), c.ty, c.tz + rand(-0.4, 0.4), 16, e.dmg, "bullet", 0.16);
          e.phase--;
          e.stateTimer = 0.14;
          if (e.phase === 0) e.fireCd = rand(2, 2.8);
        }
      } else if (e.fireCd <= 0 && c.dist < 20) {
        e.phase = shots(sim, 3);
        e.stateTimer = 0;
      }
    },
  },
  drone: {
    name: "Drone", class: "flying", radius: 0.6, height: 0.6, hp: 22, speed: 2, dmg: 10, value: 150, cores: 1,
    walker: false, flying: true, shield: 0, knock: 1, canBeElite: true,
    ai(sim, e, c) {
      hover(e, c.tx + Math.sin(e.t * 0.9 + e.id) * 6, 3.6 + Math.sin(e.t * 1.7 + e.id) * 0.6, c.tz + Math.cos(e.t * 0.7 + e.id) * 4, c.sm);
      e.fx = c.nx;
      e.fz = c.nz;
      if (c.target && e.fireCd <= 0) {
        const n = shots(sim, 1);
        for (let i = 0; i < n; i++) sim.enemyShoot(e, c.tx + (i - (n - 1) / 2) * 1.2, c.ty, c.tz, 9, e.dmg);
        e.fireCd = Math.max(1.1, 2.4 - sim.wave * 0.06);
      }
    },
  },
  brute: {
    name: "Brute", class: "tank", radius: 0.85, height: 2.1, hp: 130, speed: 1.9, dmg: 15, value: 400, cores: 3,
    walker: true, flying: false, shield: 0, knock: 0.35, canBeElite: true,
    ai(sim, e, c) {
      e.vx += (c.nx * e.speed * c.sm - e.vx) * 0.05;
      e.vz += (c.nz * e.speed * c.sm - e.vz) * 0.05;
      if (c.target && e.onGround && c.dist < 5.5 && e.fireCd <= 0 && c.sm > 0) {
        e.vx = c.nx * 13;
        e.vz = c.nz * 13;
        e.vy = 9;
        e.fireCd = 3;
      }
      const airborne = !e.onGround;
      sim.moveActor(e, "none");
      if (airborne && e.onGround) {
        sim.addShake(4);
        sim.fx.burst(e.x, e.y + 0.1, e.z, 12, "#a78bfa", 3);
      }
      e.fx = c.nx;
      e.fz = c.nz;
    },
  },
  warden: {
    name: "Warden", class: "tank", radius: 0.7, height: 2, hp: 70, speed: 1.7, dmg: 14, value: 350, cores: 3,
    walker: true, flying: false, shield: 60, knock: 0.35, canBeElite: true,
    ai(sim, e, c) {
      // Keeps its shield towards the target but turns slowly — get behind it!
      turnTowards(e, c.nx, c.nz, e.shieldHp > 0 ? 1.6 : 4);
      const facing = e.fx * c.nx + e.fz * c.nz;
      const speed = facing > 0.5 ? e.speed * c.sm : 0;
      e.vx += (e.fx * speed - e.vx) * 0.1;
      e.vz += (e.fz * speed - e.vz) * 0.1;
      if (c.target && c.dist < 1.9 && e.fireCd <= 0 && facing > 0.7) {
        // Shield bash.
        e.vx = e.fx * 7;
        e.vz = e.fz * 7;
        e.fireCd = 1.6;
      }
      sim.moveActor(e, "oneway");
    },
  },
  bomber: {
    name: "Bomber", class: "fast", radius: 0.45, height: 0.7, hp: 18, speed: 5.5, dmg: 15, value: 120, cores: 1,
    walker: true, flying: false, shield: 0, knock: 1, canBeElite: false,
    ai(sim, e, c) {
      if (e.stateTimer > 0) {
        // Fuse lit: stop, flash, then explode.
        e.stateTimer -= STEP;
        e.vx *= 0.8;
        e.vz *= 0.8;
        e.hitFlash = Math.sin(e.stateTimer * 40) > 0 ? 0.05 : 0;
        sim.moveActor(e, "oneway");
        if (e.stateTimer <= 0) {
          const ally = e.allyTimer > 0;
          sim.zone({ kind: "blast", owner: ally ? "player" : "enemy", x: e.x, y: e.y, z: e.z, r: 2.6, delay: 0, life: 0.35, dmg: e.dmg, color: "#fb923c" });
          sim.fx.burst(e.x, e.y + 0.4, e.z, 40, "#fb923c", 8);
          sim.addShake(10);
          sim.sfx("boom");
          sim.removeEnemy(e);
        }
        return;
      }
      walk(sim, e, c, c.nx * e.speed, c.nz * e.speed, 0.12);
      if (c.target && c.dist < 2.2 && Math.abs(c.target.y - e.y) < 1.5) {
        e.stateTimer = 0.6 * sim.difficulty.telegraph;
        sim.fx.text(e.x, e.y + 1.2, e.z, "!", "#f97316", 20);
      }
    },
  },
  sniper: {
    name: "Sniper", class: "shooter", radius: 0.55, height: 0.5, hp: 35, speed: 2.5, dmg: 15, value: 300, cores: 2,
    walker: false, flying: true, shield: 0, knock: 1, canBeElite: true,
    ai(sim, e, c) {
      // Keeps its distance, paints the target with a laser sight, then fires one hard shot.
      const keep = 13;
      const sway = Math.sin(e.t * 0.4 + e.id) * 4;
      hover(e, c.tx - c.nx * keep - c.nz * sway, 4.4 + Math.sin(e.t * 1.3 + e.id) * 0.3, c.tz - c.nz * keep + c.nx * sway, c.sm, 0.01);
      e.fx = c.nx;
      e.fz = c.nz;
      const aimTime = 1.4 * sim.difficulty.telegraph;
      if (c.target && e.fireCd < aimTime) {
        if (!e.stateFlag) {
          e.stateFlag = true;
          e.aimX = e.x + c.nx * 3;
          e.aimY = e.y - 1;
          e.aimZ = e.z + c.nz * 3;
        }
        // The sight lags behind a moving target: keep moving (or dodge) to make it miss.
        const k = e.fireCd > 0.35 ? 0.07 : 0.01;
        e.aimX += (c.tx - e.aimX) * k;
        e.aimY += (c.ty - e.aimY) * k;
        e.aimZ += (c.tz - e.aimZ) * k;
        if (e.fireCd <= 0) {
          sim.enemyShoot(e, e.aimX, e.aimY, e.aimZ, 32, e.dmg, "snipe", 0.15);
          e.fireCd = 3.4;
          e.stateFlag = false;
        }
      } else {
        e.stateFlag = false;
      }
    },
  },
  elite: {
    name: "Warlord", class: "elite", radius: 0.75, height: 2.4, hp: 320, speed: 3, dmg: 25, value: 1200, cores: 8,
    walker: true, flying: false, shield: 0, knock: 0.25, canBeElite: false,
    ai: eliteAI,
  },
  turret: {
    name: "Turret", class: "static", radius: 0.7, height: 1.4, hp: 140, speed: 0, dmg: 12, value: 350, cores: 3,
    walker: false, flying: false, shield: 0, knock: 0, canBeElite: false,
    ai(sim, e, c) {
      turnTowards(e, c.nx, c.nz, 2.2);
      if (!c.target || c.dist > 26) return;
      // Laser sight while charging, then a 3-shot volley along its barrel.
      e.stateFlag = e.fireCd < 0.9 * sim.difficulty.telegraph;
      if (e.stateFlag) {
        e.aimX = c.tx;
        e.aimY = c.ty;
        e.aimZ = c.tz;
      }
      if (e.fireCd <= 0) {
        const n = shots(sim, 3);
        const base = Math.atan2(e.fz, e.fx);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.12;
          const d = Math.hypot(c.tx - e.x, c.tz - e.z) || 1;
          const tx = e.x + Math.cos(a) * d;
          const tz = e.z + Math.sin(a) * d;
          sim.enemyShoot(e, tx, c.ty, tz, 15, e.dmg, "bullet", 0.2);
        }
        e.fireCd = rand(2.4, 3);
      }
    },
  },
  nest: {
    name: "Nest", class: "static", radius: 1.1, height: 1.8, hp: 260, speed: 0, dmg: 0, value: 800, cores: 5,
    walker: false, flying: false, shield: 0, knock: 0, canBeElite: false,
    ai(sim, e) {
      // A robot factory: keeps spawning its stage's robots until destroyed.
      if (e.fireCd > 0) return;
      e.fireCd = 5 / sim.difficulty.spawn;
      sim.spawnFromNest(e);
    },
  },
  // Bosses: stats only (behaviour in bosses/*.ts). Damage here is contact damage.
  vexx: {
    name: "Overlord Vexx", class: "boss", radius: 2.8, height: 2.2, hp: 1100, speed: 1, dmg: 40, value: 5000, cores: 25,
    walker: false, flying: true, shield: 0, knock: 0, canBeElite: false,
  },
  spider: {
    name: "Arachnid Mk-IX", class: "boss", radius: 2.4, height: 2.6, hp: 1600, speed: 3, dmg: 40, value: 7000, cores: 30,
    walker: false, flying: false, shield: 0, knock: 0, canBeElite: false,
  },
  hunter: {
    name: "Kraye the Hunter", class: "boss", radius: 0.55, height: 2.1, hp: 1900, speed: 7, dmg: 38, value: 9000, cores: 35,
    walker: true, flying: false, shield: 0, knock: 0, canBeElite: false,
  },
  omega: {
    name: "The Void Sovereign", class: "boss", radius: 1.6, height: 4, hp: 3200, speed: 2, dmg: 45, value: 20000, cores: 60,
    walker: false, flying: true, shield: 0, knock: 0, canBeElite: false,
  },
};

/** @deprecated name kept for older imports — same table as ENEMY_DEFS. */
export const ENEMY_BASE = ENEMY_DEFS;

/**
 * Warlord (elite): cycles through a charge, a fan volley and a leaping slam — each with a warning.
 * `e.move` holds the current move; `e.stateTimer` its countdown.
 */
function eliteAI(sim: GameSim, e: Enemy, c: AiCtx) {
  const tel = sim.difficulty.telegraph;
  switch (e.move) {
    case "chargeWind":
      e.vx *= 0.8;
      e.vz *= 0.8;
      turnTowards(e, c.nx, c.nz, 6);
      sim.moveActor(e, "oneway");
      e.stateTimer -= STEP;
      if (e.stateTimer <= 0) {
        e.move = "charge";
        e.stateTimer = 0.6;
      }
      return;
    case "charge":
      e.vx = e.fx * 15 * c.sm;
      e.vz = e.fz * 15 * c.sm;
      sim.moveActor(e, "oneway");
      if (Math.random() < 0.5) sim.fx.spark(e.x, e.y + 0.3, e.z, -e.fx * 3, 1, -e.fz * 3, "#fbbf24", 0.3, 0);
      e.stateTimer -= STEP;
      if (e.stateTimer <= 0) e.move = "";
      return;
    case "leap":
      // Airborne towards the marked spot; slam on landing.
      e.vx = (e.targetX - e.x) * 2.2;
      e.vz = (e.targetZ - e.z) * 2.2;
      sim.moveActor(e, "none");
      if (e.onGround && e.vy <= 0) {
        e.move = "";
        sim.ring("shock", e.x, e.y, e.z, 5, 0.35, 0, "#fbbf24", 0, "enemy");
        sim.addShake(10);
        sim.sfx("heavy");
      }
      return;
    default:
      break;
  }

  walk(sim, e, c, c.nx * e.speed, c.nz * e.speed, 0.08);
  if (!c.target || e.fireCd > 0) return;
  const pattern = e.phase++ % 3;
  e.fireCd = rand(2.4, 3.2) * (e.hp < e.maxHp * 0.4 ? 0.7 : 1);
  if (pattern === 0) {
    e.move = "chargeWind";
    e.stateTimer = 0.6 * tel;
    sim.fx.text(e.x, e.y + e.height + 0.4, e.z, "!", "#fbbf24", 22);
  } else if (pattern === 1) {
    const n = shots(sim, 5);
    const base = Math.atan2(c.nz, c.nx);
    for (let i = 0; i < n; i++) {
      const a = base + (i - (n - 1) / 2) * 0.16;
      sim.enemyShoot(e, e.x + Math.cos(a) * 10, c.ty, e.z + Math.sin(a) * 10, 14, e.dmg * 0.6, "plasma", 0.3);
    }
  } else {
    e.move = "leap";
    e.targetX = Math.max(ARENA.minX + 1, Math.min(ARENA.maxX - 1, c.tx));
    e.targetZ = Math.max(ARENA.minZ + 1, Math.min(ARENA.maxZ - 1, c.tz));
    e.vy = 14;
    e.onGround = false;
    // The landing spot is marked first, so Kai can get out of the way.
    sim.zone({ kind: "blast", owner: "enemy", x: e.targetX, y: 0, z: e.targetZ, r: 3.2, delay: 0.9, life: 1.2, dmg: e.dmg, color: "#fbbf24" });
  }
}

/** Weighted random enemy for an Endless-mode wave; new types unlock as the waves go up. */
export function rollEnemyKind(wave: number): EnemyKind {
  const table: [EnemyKind, number][] = [["crawler", 10]];
  if (wave >= 2) table.push(["drone", 5], ["gunner", 4]);
  if (wave >= 3) table.push(["brute", 2 + Math.min(2, wave * 0.1)], ["skitter", 4]);
  if (wave >= 4) table.push(["bomber", 3]);
  if (wave >= 6) table.push(["warden", 2.5]);
  if (wave >= 7) table.push(["sniper", 2]);
  if (wave >= 9) table.push(["elite", 0.6]);
  let roll = Math.random() * table.reduce((s, [, w]) => s + w, 0);
  for (const [kind, w] of table) {
    roll -= w;
    if (roll <= 0) return kind;
  }
  return "crawler";
}

/**
 * One step of a regular robot's behaviour. The target is the player, or another robot when this
 * one is possessed, or null when the player is invisible (the robot wanders).
 */
export function updateEnemyAI(sim: GameSim, e: Enemy, target: Actor | null) {
  const def = ENEMY_DEFS[e.kind];
  if (!def.ai) return;
  if (!target && (Math.hypot(e.targetX - e.x, e.targetZ - e.z) < 1.5 || Math.random() < 0.004)) {
    e.targetX = rand(ARENA.minX + 2, ARENA.maxX - 2);
    e.targetZ = rand(ARENA.minZ + 2, ARENA.maxZ - 2);
  }
  const tx = target ? target.x : e.targetX;
  const tz = target ? target.z : e.targetZ;
  const dx = tx - e.x;
  const dz = tz - e.z;
  const dist = Math.hypot(dx, dz) || 1;
  def.ai(sim, e, { target, tx, ty: target ? target.y + target.height / 2 : 1, tz, dist, nx: dx / dist, nz: dz / dist, sm: sim.speedMul(e) });
}
