import { ARENA, GRAVITY, STEP, clamp, rand } from "../arena";
import type { GameSim } from "../sim";
import type { Enemy } from "../types";

const LEAP_TIME = 1.1;
const PATTERNS = [
  ["leap", "web", "leap", "web"],
  ["leap", "hatch", "web", "sweep"],
  ["missiles", "leap", "laser", "sweep", "hatch"],
];
const FIRE_GAP = [2, 1.6, 1.3];

/** Arachnid Mk-IX — a giant spider mech that walks the street (wave 10, then every 15 waves). */
export function updateSpider(sim: GameSim, e: Enemy) {
  const p = sim.player;

  // Entrance: drops in from above.
  if (e.move === "" && e.y > 0) {
    e.vy -= GRAVITY * STEP;
    e.y = Math.max(0, e.y + e.vy * STEP);
    if (e.y === 0) {
      e.vy = 0;
      sim.addShake(18);
      sim.fx.burst(e.x, 0.3, e.z, 50, "#a8a29e", 8);
      sim.ring("shock", e.x, 0, e.z, 6, 0.45, 15, "#a8a29e", 14, "enemy");
      sim.sfx("boom");
    }
    return;
  }

  if (e.move === "leap") {
    // Arc from the take-off point (aimX/aimZ) to the telegraphed landing spot (targetX/targetZ).
    e.stateTimer -= STEP;
    const k = 1 - Math.max(0, e.stateTimer) / LEAP_TIME;
    e.x = e.aimX + (e.targetX - e.aimX) * k;
    e.z = e.aimZ + (e.targetZ - e.aimZ) * k;
    e.y = Math.sin(Math.PI * k) * 6;
    if (e.stateTimer <= 0) {
      e.y = 0;
      e.move = "";
      sim.addShake(14);
    }
    return;
  }
  if (e.move === "laser") {
    e.stateTimer -= STEP;
    if (e.stateTimer <= 0) e.move = "";
    return;
  }

  // Stalk: keep about 4.5 m from the player.
  const dx = p.x - e.x;
  const dz = p.z - e.z;
  const dist = Math.hypot(dx, dz) || 1;
  const want = dist > 5 ? 1 : dist < 4 ? -0.6 : 0;
  const speed = e.speed * sim.speedMul(e) * (e.bossPhase === 2 ? 1.4 : 1);
  e.vx += ((dx / dist) * speed * want - e.vx) * 0.06;
  e.vz += ((dz / dist) * speed * want - e.vz) * 0.06;
  e.x = clamp(e.x + e.vx * STEP, ARENA.minX + 1, ARENA.maxX - 1);
  e.z = clamp(e.z + e.vz * STEP, ARENA.minZ + 1, ARENA.maxZ - 1);
  e.fx = dx / dist;
  e.fz = dz / dist;

  e.fireCd -= STEP;
  if (e.fireCd > 0) return;
  const cycle = PATTERNS[e.bossPhase];
  const pattern = cycle[e.phase % cycle.length];
  e.phase++;
  e.fireCd = FIRE_GAP[e.bossPhase] * sim.bossGap(e);

  switch (pattern) {
    case "leap": {
      const tx = clamp(p.x, ARENA.minX + 2, ARENA.maxX - 2);
      const tz = clamp(p.z, ARENA.minZ + 2, ARENA.maxZ - 2);
      sim.zone({ kind: "blast", style: "slam", owner: "enemy", x: tx, y: 0, z: tz, r: 3.5, delay: LEAP_TIME, life: LEAP_TIME + 0.3, dmg: 45, color: "#f43f5e" });
      e.move = "leap";
      e.stateTimer = LEAP_TIME;
      e.aimX = e.x;
      e.aimZ = e.z;
      e.targetX = tx;
      e.targetZ = tz;
      sim.sfx("heavy");
      break;
    }
    case "web": {
      const y = e.y + 1.8;
      const ddx = p.x - e.x;
      const ddy = p.y + p.height / 2 - y;
      const ddz = p.z - e.z;
      const d = Math.hypot(ddx, ddy, ddz) || 1;
      for (const off of [-0.25, 0, 0.25]) {
        const c = Math.cos(off);
        const s = Math.sin(off);
        const vx = (ddx / d) * c - (ddz / d) * s;
        const vz = (ddx / d) * s + (ddz / d) * c;
        sim.enemyProjectile(e.x, y, e.z, vx * 14, (ddy / d) * 14, vz * 14, 0.35, 14, "web");
      }
      sim.sfx("enemyShot");
      break;
    }
    case "hatch":
      if (sim.enemies.length < 11) {
        for (let i = 0; i < 3; i++) sim.enemies.push(sim.makeEnemy("crawler", e.x + rand(-2, 2), 0, e.z + rand(-2, 2)));
        sim.fx.text(e.x, e.y + 3, e.z, "HATCHLINGS!", "#f43f5e", 15);
      }
      break;
    case "sweep":
      // Leg sweep: everything close to the spider gets hit after a short warning.
      sim.zone({ kind: "blast", style: "slam", owner: "enemy", x: e.x, y: 0, z: e.z, r: 4.8, delay: sim.tele(0.8), life: sim.tele(0.8) + 0.3, dmg: 38, color: "#f43f5e" });
      break;
    case "missiles":
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = i === 0 ? 0 : rand(1.5, 6);
        const delay = sim.tele(1.3) + i * 0.12;
        sim.zone({
          kind: "blast",
          style: "missile",
          owner: "enemy",
          x: clamp(p.x + Math.cos(a) * r, ARENA.minX + 1, ARENA.maxX - 1),
          y: 0,
          z: clamp(p.z + Math.sin(a) * r, ARENA.minZ + 1, ARENA.maxZ - 1),
          r: 2.2,
          delay,
          life: delay + 0.3,
          dmg: 35,
          color: "#fb923c",
        });
      }
      sim.fx.text(e.x, e.y + 3, e.z, "MISSILES!", "#fb923c", 15);
      sim.sfx("enemyShot");
      break;
    case "laser":
      sim.zone({ kind: "laser", owner: "enemy", source: e.id, x: e.x, y: 0, z: e.z, r: 16, angle: Math.atan2(p.z - e.z, p.x - e.x), spin: 0, delay: sim.tele(0.9), life: sim.tele(0.9) + 1, dmg: 42, color: "#f43f5e" });
      e.move = "laser";
      e.stateTimer = 1.9;
      sim.sfx("laser");
      break;
  }
}
