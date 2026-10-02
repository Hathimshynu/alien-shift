import { ARENA, STEP, clamp, rand } from "../arena";
import type { GameSim } from "../sim";
import type { Enemy } from "../types";

/** Hover height of the Void Sovereign's feet. */
export const OMEGA_HOVER_Y = 1.4;

/** Attack cycle per health phase (the final boss of the campaign). */
const PATTERNS = [
  ["volley", "runes", "summon", "volley", "teleport"],
  ["runes", "laser", "volley", "teleport", "summon", "meteors"],
  ["collapse", "volley", "laser", "runes", "teleport", "meteors", "summon"],
];
const FIRE_GAP = [1.8, 1.45, 1.15];
const COLOR = "#a855f7";

/**
 * The Void Sovereign — campaign level 10. A floating crystal titan: shard volleys, rune circles,
 * sweeping void lasers, meteor rain, teleports with a shockwave, summoned skitters, and in its last
 * phase the Void Collapse (everything outside one safe circle is hit — get inside it!).
 */
export function updateOmega(sim: GameSim, e: Enemy) {
  const p = sim.player;

  if (e.move === "laser" || e.move === "collapse") {
    e.stateTimer -= STEP;
    e.y += (OMEGA_HOVER_Y + 1 - e.y) * 0.05;
    if (e.stateTimer <= 0) e.move = "";
    return;
  }

  // Drift along the back of the arena, facing Kai.
  e.y += (OMEGA_HOVER_Y + Math.sin(e.t * 1.6) * 0.35 - e.y) * 0.05;
  e.x += (Math.sin(e.t * 0.35) * 10 - e.x) * 0.01;
  e.z += (clamp(p.z - 6, -7, 2) - e.z) * 0.01;
  const toP = Math.hypot(p.x - e.x, p.z - e.z) || 1;
  e.fx = (p.x - e.x) / toP;
  e.fz = (p.z - e.z) / toP;

  e.fireCd -= STEP;
  if (e.fireCd > 0) return;
  const cycle = PATTERNS[e.bossPhase];
  const pattern = cycle[e.phase % cycle.length];
  e.phase++;
  e.fireCd = FIRE_GAP[e.bossPhase] * sim.bossGap(e);
  const cy = e.y + e.height * 0.6;

  switch (pattern) {
    case "volley": {
      // Fan of void shards aimed at Kai (more per phase).
      const n = [7, 9, 11][e.bossPhase];
      const dx = p.x - e.x;
      const dy = p.y + p.height / 2 - cy;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 0.13;
        const c = Math.cos(off);
        const s = Math.sin(off);
        const vx = (dx / d) * c - (dz / d) * s;
        const vz = (dx / d) * s + (dz / d) * c;
        sim.enemyProjectile(e.x, cy, e.z, vx * 15, (dy / d) * 15, vz * 15, 0.32, 20, "crystal");
      }
      sim.sfx("crystal");
      break;
    }
    case "runes": {
      // Rune circles under and around Kai.
      const n = 3 + e.bossPhase;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + rand(0, 1);
        const r = i === 0 ? 0 : rand(3, 6);
        const delay = sim.tele(1.1) + i * 0.1;
        sim.zone({
          kind: "blast", owner: "enemy", color: COLOR, r: 2.6, delay, life: delay + 0.3, dmg: 40,
          x: clamp(p.x + Math.cos(a) * r, ARENA.minX + 1, ARENA.maxX - 1), y: 0, z: clamp(p.z + Math.sin(a) * r, ARENA.minZ + 1, ARENA.maxZ - 1),
        });
      }
      sim.fx.text(e.x, e.y + e.height + 0.6, e.z, "VOID RUNES", COLOR, 15);
      sim.sfx("laser");
      break;
    }
    case "summon":
      if (sim.enemies.length < 10) {
        for (let i = 0; i < 2 + e.bossPhase; i++) sim.enemies.push(sim.makeEnemy("skitter", e.x + rand(-3, 3), 0, clamp(e.z + rand(1, 3), ARENA.minZ + 1, ARENA.maxZ - 1)));
        sim.fx.burst(e.x, 0.3, e.z, 40, COLOR, 7);
        sim.fx.text(e.x, e.y + e.height + 0.6, e.z, "RISE, MY SWARM!", COLOR, 16);
      }
      break;
    case "laser": {
      const base = Math.atan2(p.z - e.z, p.x - e.x) - 1;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (e.enraged ? 1.2 : 0.9);
      for (const off of e.bossPhase >= 2 ? [0, Math.PI * 0.66, Math.PI * 1.33] : [0, Math.PI]) {
        sim.zone({ kind: "laser", owner: "enemy", source: e.id, x: e.x, y: 0, z: e.z, r: 16, angle: base + off, spin, delay: sim.tele(1), life: sim.tele(1) + 2.8, dmg: 42, color: COLOR });
      }
      e.move = "laser";
      e.stateTimer = sim.tele(1) + 2.8;
      sim.fx.text(e.x, e.y + e.height + 0.6, e.z, "VOID BEAMS!", COLOR, 16);
      sim.sfx("laser");
      break;
    }
    case "teleport": {
      // Blink to the other side of Kai and release a shockwave ring.
      sim.fx.burst(e.x, e.y + e.height / 2, e.z, 50, COLOR, 9);
      e.x = clamp(p.x + (p.x > 0 ? -8 : 8), ARENA.minX + 3, ARENA.maxX - 3);
      e.z = clamp(p.z - 3, ARENA.minZ + 3, ARENA.maxZ - 3);
      e.prevX = e.x;
      e.prevZ = e.z;
      sim.fx.burst(e.x, e.y + e.height / 2, e.z, 50, COLOR, 9);
      sim.ring("shock", e.x, 0, e.z, 11, 1.1, 36, COLOR, 14, "enemy");
      sim.addShake(10);
      sim.sfx("phase");
      break;
    }
    case "meteors": {
      const n = 5 + e.bossPhase;
      for (let i = 0; i < n; i++) {
        const delay = sim.tele(1.2) + i * 0.18;
        sim.zone({
          kind: "blast", style: "meteor", owner: "enemy", color: "#f97316", r: 2.4, delay, life: delay + 0.3, dmg: 45,
          x: clamp(p.x + rand(-7, 7), ARENA.minX + 1, ARENA.maxX - 1), y: 0, z: clamp(p.z + rand(-5, 5), ARENA.minZ + 1, ARENA.maxZ - 1),
        });
      }
      sim.fx.text(e.x, e.y + e.height + 0.6, e.z, "METEOR RAIN!", "#f97316", 16);
      break;
    }
    case "collapse": {
      // Everything outside a safe circle is crushed after a long warning.
      const sx = clamp(rand(-12, 12), ARENA.minX + 4, ARENA.maxX - 4);
      const sz = clamp(rand(-6, 6), ARENA.minZ + 4, ARENA.maxZ - 4);
      const delay = sim.tele(2.6);
      sim.zone({ kind: "collapse", owner: "enemy", x: sx, y: 0, z: sz, r: 3.2, delay, life: delay + 0.5, dmg: 50, color: COLOR });
      e.move = "collapse";
      e.stateTimer = delay + 0.5;
      sim.showBanner("VOID COLLAPSE — GET IN THE SAFE CIRCLE!", 2.4);
      sim.sfx("sting");
      break;
    }
  }
}
