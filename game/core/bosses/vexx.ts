import { ARENA, PLATFORMS, SOLIDS, STEP, clamp } from "../arena";
import { actorsOverlap } from "../geom";
import type { GameSim } from "../sim";
import type { Enemy } from "../types";

/** Dive: total length and how long it sits on the ground (the melee window). */
const DIVE_TIME = 2.6;
const DIVE_GROUNDED = 1.4;
export const VEXX_HOVER_Y = 4.3;

/** Attack cycle per health phase. */
const PATTERNS = [
  ["spread", "aimed", "drones", "dive"],
  ["spread", "laser", "aimed", "dive", "drones"],
  ["laser", "spread", "dive", "aimed", "laser2", "dive"],
];
const FIRE_GAP = [1.7, 1.3, 1.0];

/** Overlord Vexx — the flying mothership (wave 5, then every 15 waves). */
export function updateVexx(sim: GameSim, e: Enemy) {
  const p = sim.player;

  if (e.move === "dive") {
    updateDive(sim, e);
    return;
  }
  if (e.move === "laser") {
    // Hold position while the sweep lasers run.
    e.stateTimer -= STEP;
    if (e.stateTimer <= 0) e.move = "";
    return;
  }

  const targetY = VEXX_HOVER_Y + Math.sin(e.t * 1.3) * 0.5;
  e.y += (targetY - e.y) * 0.04;
  // Ease towards the sway path (instead of snapping to it) so leaving a dive spot stays smooth.
  e.x += (Math.sin(e.t * (e.bossPhase > 0 ? 0.8 : 0.55)) * 11 - e.x) * 0.05;
  e.z += (clamp(p.z - 3, -3, 5) - e.z) * 0.01;
  const toP = Math.hypot(p.x - e.x, p.z - e.z) || 1;
  e.fx = (p.x - e.x) / toP;
  e.fz = (p.z - e.z) / toP;

  e.fireCd -= STEP;
  if (e.fireCd > 0) return;
  const cycle = PATTERNS[e.bossPhase];
  const pattern = cycle[e.phase % cycle.length];
  e.phase++;
  e.fireCd = FIRE_GAP[e.bossPhase];
  const cy = e.y + 0.2;

  switch (pattern) {
    case "spread": {
      // Rotating downward ring of bullets that rains onto a circle around the ship.
      const n = [11, 14, 18][e.bossPhase];
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + e.t;
        const dir = [Math.cos(a) * 0.85, -0.5, Math.sin(a) * 0.85];
        const len = Math.hypot(dir[0], dir[1], dir[2]);
        sim.enemyProjectile(e.x, cy, e.z, (dir[0] / len) * 7, (dir[1] / len) * 7, (dir[2] / len) * 7, 0.22, 10);
      }
      sim.sfx("enemyShot");
      break;
    }
    case "aimed": {
      const dx = p.x - e.x;
      const dy = p.y + p.height / 2 - cy;
      const dz = p.z - e.z;
      const d = Math.hypot(dx, dy, dz) || 1;
      const shots = e.bossPhase === 2 ? 5 : 3;
      for (let i = 0; i < shots; i++) {
        const off = (i - (shots - 1) / 2) * 0.2;
        const c = Math.cos(off);
        const s = Math.sin(off);
        const vx = (dx / d) * c - (dz / d) * s;
        const vz = (dx / d) * s + (dz / d) * c;
        sim.enemyProjectile(e.x, cy, e.z, vx * 12, (dy / d) * 12, vz * 12, 0.35, 14);
      }
      sim.sfx("enemyShot");
      break;
    }
    case "drones":
      if (sim.enemies.length < 12) {
        for (const off of [-2, 2]) sim.enemies.push(sim.makeEnemy("drone", e.x + off, e.y, e.z));
        sim.fx.text(e.x, e.y - 0.5, e.z, "DEPLOYING DRONES", "#c084fc", 14);
      }
      break;
    case "laser":
    case "laser2": {
      // Ground-sweeping laser(s): a thin warning line first, then the burning beam turns.
      const base = Math.atan2(p.z - e.z, p.x - e.x) - 1.1;
      const spin = (Math.random() < 0.5 ? -1 : 1) * (e.bossPhase === 2 ? 1.1 : 0.85);
      const beams = pattern === "laser2" ? [0, Math.PI] : [0];
      for (const off of beams) {
        sim.zone({ kind: "laser", owner: "enemy", source: e.id, x: e.x, y: 0, z: e.z, r: 15, angle: base + off, spin, delay: 1, life: 3.6, dmg: 20, color: "#f43f5e" });
      }
      e.move = "laser";
      e.stateTimer = 3.6;
      sim.fx.text(e.x, e.y - 0.5, e.z, "LASER SWEEP!", "#f43f5e", 16);
      sim.sfx("laser");
      break;
    }
    case "dive":
      e.move = "dive";
      e.stateTimer = DIVE_TIME;
      e.stateFlag = false;
      [e.targetX, e.targetZ] = findLandingSpot(e.x, e.z, e.radius);
      sim.fx.text(e.x, e.y - 0.5, e.z, "BRACE!", "#f43f5e", 16);
      break;
  }
}

/** Slam into the street and sit there briefly — dangerous to stand under, but the melee window. */
function updateDive(sim: GameSim, e: Enemy) {
  const p = sim.player;
  e.stateTimer -= STEP;
  const grounded = e.stateTimer < DIVE_GROUNDED + 0.35 && e.stateTimer > 0.35;
  const targetY = e.stateTimer > 0.35 ? 0 : VEXX_HOVER_Y;
  e.y += (targetY - e.y) * (grounded ? 0.25 : 0.06);
  // Slide over the clear landing spot while descending (it never lands on cars or scaffolds).
  e.x += (e.targetX - e.x) * 0.08;
  e.z += (e.targetZ - e.z) * 0.08;
  if (!e.stateFlag && e.y <= 0.15) {
    e.stateFlag = true;
    sim.addShake(14);
    sim.fx.burst(e.x, 0.2, e.z, 40, "#a78bfa", 6);
    sim.sfx("heavy");
    if (actorsOverlap(p, e)) knockOutOfHull(sim, e);
  }
  if (e.stateTimer <= 0) {
    e.move = "";
    e.fireCd = e.bossPhase > 0 ? 0.9 : 1.4;
  }
}

/** Nearest spot to (x, z) where a hull of radius r fits without touching cover or scaffolds. */
export function findLandingSpot(x: number, z: number, r: number): [number, number] {
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

/** Damage the player and push them just outside the landed hull, on the side with room. */
function knockOutOfHull(sim: GameSim, e: Enemy) {
  const p = sim.player;
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
  if (!inside(e.x + nx * reach, e.z + nz * reach)) {
    nx = -nx;
    nz = -nz;
  }
  sim.hurtPlayer(e.dmg, nx, nz);
  p.x = clamp(e.x + nx * reach, ARENA.minX + p.radius, ARENA.maxX - p.radius);
  p.z = clamp(e.z + nz * reach, ARENA.minZ + p.radius, ARENA.maxZ - p.radius);
}
