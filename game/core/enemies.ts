import { ARENA, STEP, rand } from "./arena";
import type { GameSim } from "./sim";
import type { Actor, Enemy, EnemyKind } from "./types";

export interface EnemyBase {
  radius: number;
  height: number;
  hp: number;
  speed: number;
  /** Contact damage (bombers: explosion damage; snipers/drones: shot damage). */
  dmg: number;
  value: number;
  /** Shift Cores dropped (60% chance for regular robots, always for bosses). */
  cores: number;
  /** Walkers get a physics body and collide with cover; flyers don't. */
  walker: boolean;
  /** Frontal shield strength (wardens). */
  shield: number;
}

export const ENEMY_BASE: Record<EnemyKind, EnemyBase> = {
  crawler: { radius: 0.5, height: 0.8, hp: 30, speed: 3.7, dmg: 10, value: 100, cores: 1, walker: true, shield: 0 },
  drone: { radius: 0.6, height: 0.6, hp: 22, speed: 2, dmg: 8, value: 150, cores: 1, walker: false, shield: 0 },
  brute: { radius: 0.85, height: 2.1, hp: 130, speed: 1.9, dmg: 22, value: 400, cores: 3, walker: true, shield: 0 },
  warden: { radius: 0.7, height: 2, hp: 70, speed: 1.7, dmg: 18, value: 350, cores: 3, walker: true, shield: 60 },
  bomber: { radius: 0.45, height: 0.7, hp: 18, speed: 5.5, dmg: 22, value: 120, cores: 1, walker: true, shield: 0 },
  sniper: { radius: 0.55, height: 0.5, hp: 35, speed: 2.5, dmg: 18, value: 300, cores: 2, walker: false, shield: 0 },
  vexx: { radius: 2.8, height: 2.2, hp: 1100, speed: 1, dmg: 25, value: 5000, cores: 25, walker: false, shield: 0 },
  spider: { radius: 2.4, height: 2.6, hp: 1600, speed: 3, dmg: 25, value: 7000, cores: 30, walker: false, shield: 0 },
  hunter: { radius: 0.55, height: 2.1, hp: 1900, speed: 7, dmg: 22, value: 9000, cores: 35, walker: true, shield: 0 },
};

/** Weighted random enemy for a regular wave; new types unlock as the waves go up. */
export function rollEnemyKind(wave: number): EnemyKind {
  const table: [EnemyKind, number][] = [["crawler", 10]];
  if (wave >= 2) table.push(["drone", 6]);
  if (wave >= 3) table.push(["brute", 2 + Math.min(2, wave * 0.1)]);
  if (wave >= 4) table.push(["bomber", 3]);
  if (wave >= 6) table.push(["warden", 2.5]);
  if (wave >= 7) table.push(["sniper", 2]);
  let roll = Math.random() * table.reduce((s, [, w]) => s + w, 0);
  for (const [kind, w] of table) {
    roll -= w;
    if (roll <= 0) return kind;
  }
  return "crawler";
}

/** Rotate an enemy's facing towards (nx, nz) by at most `rate` radians per second (wardens turn slowly). */
function turnTowards(e: Enemy, nx: number, nz: number, rate: number) {
  const cur = Math.atan2(e.fz, e.fx);
  let diff = Math.atan2(nz, nx) - cur;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  const a = cur + Math.max(-rate * STEP, Math.min(rate * STEP, diff));
  e.fx = Math.cos(a);
  e.fz = Math.sin(a);
}

/**
 * One step of a regular robot's behaviour. `target` is the player, or another robot when this
 * one is possessed, or null when the player is invisible (the robot wanders).
 */
export function updateEnemyAI(sim: GameSim, e: Enemy, target: Actor | null) {
  if (!target && (Math.hypot(e.targetX - e.x, e.targetZ - e.z) < 1.5 || Math.random() < 0.004)) {
    e.targetX = rand(ARENA.minX + 2, ARENA.maxX - 2);
    e.targetZ = rand(ARENA.minZ + 2, ARENA.maxZ - 2);
  }
  const tx = target ? target.x : e.targetX;
  const tz = target ? target.z : e.targetZ;
  const ty = target ? target.y + target.height / 2 : 1;
  const dx = tx - e.x;
  const dz = tz - e.z;
  const dist = Math.hypot(dx, dz) || 1;
  const nx = dx / dist;
  const nz = dz / dist;
  const sm = sim.speedMul(e);

  switch (e.kind) {
    case "crawler": {
      e.vx += (nx * e.speed * sm - e.vx) * 0.08;
      e.vz += (nz * e.speed * sm - e.vz) * 0.08;
      // Hop up after a target standing on a platform or car.
      if (target && e.onGround && target.y > e.y + 1 && dist < 5 && e.fireCd <= 0 && sm > 0) {
        e.vy = 13;
        e.fireCd = 1.4;
      }
      sim.moveActor(e, "oneway");
      e.fx = nx;
      e.fz = nz;
      break;
    }
    case "brute": {
      e.vx += (nx * e.speed * sm - e.vx) * 0.05;
      e.vz += (nz * e.speed * sm - e.vz) * 0.05;
      if (target && e.onGround && dist < 5.5 && e.fireCd <= 0 && sm > 0) {
        e.vx = nx * 13;
        e.vz = nz * 13;
        e.vy = 9;
        e.fireCd = 3;
      }
      const airborne = !e.onGround;
      sim.moveActor(e, "none");
      if (airborne && e.onGround) {
        sim.addShake(4);
        sim.fx.burst(e.x, e.y + 0.1, e.z, 12, "#a78bfa", 3);
      }
      e.fx = nx;
      e.fz = nz;
      break;
    }
    case "warden": {
      // Keeps its shield towards the target but turns slowly — get behind it!
      turnTowards(e, nx, nz, e.shieldHp > 0 ? 1.6 : 4);
      const facing = e.fx * nx + e.fz * nz;
      const speed = facing > 0.5 ? e.speed * sm : 0;
      e.vx += (e.fx * speed - e.vx) * 0.1;
      e.vz += (e.fz * speed - e.vz) * 0.1;
      if (target && dist < 1.9 && e.fireCd <= 0 && facing > 0.7) {
        // Shield bash.
        e.vx = e.fx * 7;
        e.vz = e.fz * 7;
        e.fireCd = 1.6;
      }
      sim.moveActor(e, "oneway");
      break;
    }
    case "bomber": {
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
        break;
      }
      e.vx += (nx * e.speed * sm - e.vx) * 0.12;
      e.vz += (nz * e.speed * sm - e.vz) * 0.12;
      sim.moveActor(e, "oneway");
      e.fx = nx;
      e.fz = nz;
      if (target && dist < 2.2 && Math.abs(target.y - e.y) < 1.5) {
        e.stateTimer = 0.6;
        sim.fx.text(e.x, e.y + 1.2, e.z, "!", "#f97316", 20);
      }
      break;
    }
    case "drone": {
      const ox = tx + Math.sin(e.t * 0.9 + e.id) * 6;
      const oz = tz + Math.cos(e.t * 0.7 + e.id) * 4;
      const oy = 3.6 + Math.sin(e.t * 1.7 + e.id) * 0.6;
      e.x += (ox - e.x) * 0.015 * sm + e.vx * STEP;
      e.z += (oz - e.z) * 0.015 * sm + e.vz * STEP;
      e.y += (oy - e.y) * 0.03 + e.vy * STEP;
      e.vx *= 0.9;
      e.vy *= 0.9;
      e.vz *= 0.9;
      e.fx = nx;
      e.fz = nz;
      if (target && e.fireCd <= 0) {
        sim.enemyShoot(e, tx, ty, tz, 9, 8);
        e.fireCd = Math.max(1.1, 2.4 - sim.wave * 0.06);
      }
      break;
    }
    case "sniper": {
      // Keeps its distance, paints the target with a laser sight, then fires one hard shot.
      const keep = 13;
      const gx = tx - nx * keep + -nz * Math.sin(e.t * 0.4 + e.id) * 4;
      const gz = tz - nz * keep + nx * Math.sin(e.t * 0.4 + e.id) * 4;
      e.x += (gx - e.x) * 0.01 * sm + e.vx * STEP;
      e.z += (gz - e.z) * 0.01 * sm + e.vz * STEP;
      e.y += (4.4 + Math.sin(e.t * 1.3 + e.id) * 0.3 - e.y) * 0.03 + e.vy * STEP;
      e.vx *= 0.9;
      e.vy *= 0.9;
      e.vz *= 0.9;
      e.fx = nx;
      e.fz = nz;
      if (target && e.fireCd < 1.4) {
        if (!e.stateFlag) {
          e.stateFlag = true;
          e.aimX = e.x + nx * 3;
          e.aimY = e.y - 1;
          e.aimZ = e.z + nz * 3;
        }
        // The sight lags behind a moving target: keep moving (or dodge) to make it miss.
        const k = e.fireCd > 0.35 ? 0.07 : 0.01;
        e.aimX += (tx - e.aimX) * k;
        e.aimY += (ty - e.aimY) * k;
        e.aimZ += (tz - e.aimZ) * k;
        if (e.fireCd <= 0) {
          sim.enemyShoot(e, e.aimX, e.aimY, e.aimZ, 32, e.dmg, "snipe", 0.15);
          e.fireCd = 3.4;
          e.stateFlag = false;
        }
      } else {
        e.stateFlag = false;
      }
      break;
    }
    default:
      break;
  }
}
