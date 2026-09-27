import { ARENA, STEP, clamp } from "../arena";
import { ENEMY_BASE } from "../enemies";
import type { GameSim } from "../sim";
import type { Enemy, HunterForm } from "../types";

/** The rival hunter's three forms, one per health phase. */
export const HUNTER_FORMS: { id: HunterForm; radius: number; height: number; speed: number; dmg: number; color: string }[] = [
  { id: "hunter", radius: 0.55, height: 2.1, speed: 7, dmg: 22, color: "#ef4444" },
  { id: "hunterBrute", radius: 0.95, height: 3, speed: 4.5, dmg: 28, color: "#b91c1c" },
  { id: "hunterBlade", radius: 0.5, height: 2, speed: 10, dmg: 24, color: "#f43f5e" },
];

const FIRE_GAP = [1.5, 1.8, 1.2];

/** Kraye the Hunter — a rival who also transforms (wave 15, then every 15 waves). */
export function updateHunter(sim: GameSim, e: Enemy) {
  const p = sim.player;

  // Transform when the health phase changes (the phase roar makes it briefly invulnerable).
  if (e.variant !== e.bossPhase) {
    e.variant = e.bossPhase;
    const f = HUNTER_FORMS[e.variant];
    e.radius = f.radius;
    e.height = f.height;
    e.speed = f.speed;
    // Same endless-mode scaling as spawning (makeEnemy): +40% of the extra health as damage.
    const hpScale = e.maxHp / ENEMY_BASE.hunter.hp;
    e.dmg = f.dmg * (1 + (hpScale - 1) * 0.4);
    sim.physics.resizeActor(e.body, f.radius, f.height);
    e.move = "";
    sim.fx.burst(e.x, e.y + 1, e.z, 60, "#ef4444", 8);
    sim.fx.burst(e.x, e.y + 1, e.z, 30, "#4ade80", 6);
    sim.fx.text(e.x, e.y + e.height + 0.8, e.z, e.variant === 1 ? "HUNTER: BRUTE FORM!" : "HUNTER: BLADE FORM!", "#f87171", 18);
    sim.sfx("sting");
  }

  const dx = p.x - e.x;
  const dz = p.z - e.z;
  const dist = Math.hypot(dx, dz) || 1;
  const nx = dx / dist;
  const nz = dz / dist;

  // Multi-step moves.
  if (e.move === "aim") {
    // Gunner: paint the player for a moment, then fire a burst.
    e.stateTimer -= STEP;
    e.aimX += (p.x - e.aimX) * 0.12;
    e.aimY += (p.y + p.height / 2 - e.aimY) * 0.12;
    e.aimZ += (p.z - e.aimZ) * 0.12;
    face(e, nx, nz);
    brake(sim, e);
    if (e.stateTimer <= 0) {
      for (let i = -1; i <= 1; i++) {
        const ax = e.aimX - e.x;
        const az = e.aimZ - e.z;
        const a = Math.atan2(az, ax) + i * 0.12;
        const d = Math.hypot(ax, az) || 1;
        sim.enemyShoot(e, e.x + Math.cos(a) * d, e.aimY, e.z + Math.sin(a) * d, 17, 10, "plasma", 0.28);
      }
      e.move = "";
    }
    return;
  }
  if (e.move === "windup") {
    // Brute charge / blade dash: stand still while the warning line shows, then go.
    e.stateTimer -= STEP;
    brake(sim, e);
    if (e.stateTimer <= 0) {
      e.move = "dash";
      e.stateTimer = e.variant === 1 ? 0.6 : 0.25;
      sim.sfx("zap");
    }
    return;
  }
  if (e.move === "dash") {
    e.stateTimer -= STEP;
    const speed = e.variant === 1 ? 18 : 26;
    e.vx = e.fx * speed;
    e.vz = e.fz * speed;
    sim.moveActor(e, "oneway");
    sim.fx.spark(e.x, e.y + 1, e.z, -e.fx * 3, 0, -e.fz * 3, HUNTER_FORMS[e.variant].color, 0.3, 0);
    if (e.stateTimer <= 0) {
      e.move = "";
      // The blade form strikes three times in a row.
      if (e.variant === 2 && e.phase % 3 !== 0) startDash(sim, e, 0.4);
    }
    return;
  }
  if (e.move === "roll") {
    e.stateTimer -= STEP;
    sim.moveActor(e, "oneway");
    if (e.stateTimer <= 0) e.move = "";
    return;
  }

  // Dodge-roll away when the player swings at close range (gunner form). Between moves stateTimer
  // keeps counting down, so "<= -2" means at least 2 s since the last move.
  if (e.variant === 0 && p.attackAnim > 0.1 && dist < 3 && e.stateTimer <= -2) {
    e.move = "roll";
    e.stateTimer = 0.35;
    e.vx = -nx * 14 + -nz * 6;
    e.vz = -nz * 14 + nx * 6;
    return;
  }
  e.stateTimer -= STEP;

  // Positioning: the gunner keeps range, the others close in.
  const want = e.variant === 0 ? (dist > 9 ? 1 : dist < 6 ? -1 : 0) : dist > 2 ? 1 : 0;
  const strafe = e.variant === 0 ? Math.sin(e.t * 0.8) : 0;
  const speed = e.speed * sim.speedMul(e);
  e.vx += ((nx * want - nz * strafe) * speed - e.vx) * 0.1;
  e.vz += ((nz * want + nx * strafe) * speed - e.vz) * 0.1;
  sim.moveActor(e, "oneway");
  e.x = clamp(e.x, ARENA.minX + e.radius, ARENA.maxX - e.radius);
  face(e, nx, nz);

  e.fireCd -= STEP;
  if (e.fireCd > 0) return;
  e.fireCd = FIRE_GAP[e.variant];
  e.phase++;

  if (e.variant === 0) {
    if (e.phase % 3 === 0) {
      // Grenade on the player's position.
      sim.zone({ kind: "blast", style: "missile", owner: "enemy", x: p.x, y: 0, z: p.z, r: 2.6, delay: 1, life: 1.3, dmg: 20, color: "#fb923c" });
      sim.fx.text(e.x, e.y + e.height + 0.5, e.z, "GRENADE!", "#fb923c", 14);
    } else {
      e.move = "aim";
      e.stateTimer = 0.55;
      e.aimX = e.x + nx * 2;
      e.aimY = e.y + 1.2;
      e.aimZ = e.z + nz * 2;
      e.stateFlag = true;
    }
  } else if (e.variant === 1) {
    if (e.phase % 2 === 0) {
      // Ground slam around itself.
      sim.zone({ kind: "blast", style: "slam", owner: "enemy", x: e.x, y: 0, z: e.z, r: 4.5, delay: 0.9, life: 1.2, dmg: 26, color: "#ef4444" });
    } else {
      startDash(sim, e, 0.8);
    }
  } else if (e.phase % 2 === 0) {
    // Blade fan: five plasma shots.
    for (let i = -2; i <= 2; i++) {
      const a = Math.atan2(nz, nx) + i * 0.18;
      sim.enemyShoot(e, e.x + Math.cos(a) * 10, e.y + 1, e.z + Math.sin(a) * 10, 15, 9, "plasma", 0.26);
    }
  } else {
    startDash(sim, e, 0.4);
  }
}

/** Lock a dash direction at the player and show the warning line for `windup` seconds. */
function startDash(sim: GameSim, e: Enemy, windup: number) {
  const p = sim.player;
  const d = Math.hypot(p.x - e.x, p.z - e.z) || 1;
  e.fx = (p.x - e.x) / d;
  e.fz = (p.z - e.z) / d;
  e.move = "windup";
  e.stateTimer = windup;
  e.phase++;
  const length = (e.variant === 1 ? 18 * 0.6 : 26 * 0.25) + 1;
  // A zero-damage laser zone is just the telegraph line.
  sim.zone({ kind: "laser", owner: "enemy", x: e.x, y: 0, z: e.z, r: length, angle: Math.atan2(e.fz, e.fx), delay: windup, life: windup, dmg: 0, color: "#fb923c" });
}

function face(e: Enemy, nx: number, nz: number) {
  e.fx += (nx - e.fx) * 0.2;
  e.fz += (nz - e.fz) * 0.2;
  const l = Math.hypot(e.fx, e.fz) || 1;
  e.fx /= l;
  e.fz /= l;
}

function brake(sim: GameSim, e: Enemy) {
  e.vx *= 0.8;
  e.vz *= 0.8;
  sim.moveActor(e, "oneway");
}
