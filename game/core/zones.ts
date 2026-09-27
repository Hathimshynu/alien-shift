import { STEP, rand } from "./arena";
import { distToSegment } from "./geom";
import type { GameSim } from "./sim";
import { isBoss, type Zone } from "./types";

/**
 * Updates every zone once per step. Zone damage was already scaled by the upgrade multiplier
 * when it was created (GameSim.zone), so hits here use `raw: true` / `scaled: false`.
 */
export function updateZones(sim: GameSim) {
  for (const z of sim.zones) {
    z.t += STEP;
    switch (z.kind) {
      case "blast":
        updateBlast(sim, z);
        break;
      case "laser":
        updateLaser(sim, z);
        break;
      case "vortex":
        updateVortex(sim, z);
        break;
      case "thorns":
        z.tick -= STEP;
        if (z.tick <= 0) {
          z.tick = 0.5;
          for (const e of sim.enemiesNear(z.x, z.z, z.r)) {
            if (e.y < 1.5) sim.hurtEnemy(e, z.dmg * 0.5, 0, 0, { slow: 1 });
          }
        }
        break;
      case "turret":
        updateTurret(sim, z);
        break;
      case "blizzard":
        z.tick -= STEP;
        if (z.tick <= 0) {
          z.tick = 0.5;
          for (const e of sim.enemies) if (!e.dead && e.allyTimer <= 0) sim.hurtEnemy(e, z.dmg * 0.5, 0, 0, { slow: 1, pierceShield: true });
        }
        for (let i = 0; i < 3; i++) {
          const p = sim.player;
          sim.fx.spark(p.x + rand(-14, 14), rand(5, 9), p.z + rand(-10, 6), rand(-3, -1), -3, rand(-0.5, 0.5), "#f0f9ff", 1.6, 0.5);
        }
        break;
      case "iceWall":
        if (z.t >= z.life && z.handle >= 0) {
          sim.physics.removeWall(z.handle);
          z.handle = -1;
          sim.fx.burst(z.x, 1, z.z, 24, "#e0f2fe", 5);
        }
        break;
      default:
        break; // beam, bloom: visual only
    }
  }
  sim.zones = sim.zones.filter((z) => z.t < z.life);
}

/** Telegraphed area strike: harmless warning until `delay`, then one hit. */
function updateBlast(sim: GameSim, z: Zone) {
  // Orbital strikes track their target until just before they fire.
  if (z.style === "orbital" && z.source >= 0 && z.t < z.delay - 0.3) {
    const e = sim.enemies.find((x) => x.id === z.source && !x.dead);
    if (e) {
      z.x = e.x;
      z.z = e.z;
    }
  }
  if (z.tick > 0 || z.t < z.delay) return;
  z.tick = 1; // fired
  const knock = z.style === "rock" ? 8 : 12;
  if (z.owner === "enemy") {
    sim.area(z.x, z.y, z.z, z.r, z.dmg, knock, { owner: "enemy", ground: z.style !== "orbital", height: 3 });
  } else {
    sim.area(z.x, z.y, z.z, z.r, z.dmg, knock, { raw: true, heavy: true, launch: z.style === "rock" || z.style === "meteor", height: z.style === "orbital" ? 12 : 3 });
  }
  const color = z.color;
  sim.fx.burst(z.x, z.y + 0.3, z.z, z.style === "rock" ? 8 : 28, color, z.style === "rock" ? 5 : 8);
  if (z.style !== "rock") {
    sim.addShake(z.style === "meteor" || z.style === "orbital" ? 10 : 7);
    sim.sfx("boom");
  }
}

/** Boss laser: a line from the source that sweeps (spin) and burns the player while touching. */
function updateLaser(sim: GameSim, z: Zone) {
  if (z.source >= 0) {
    const src = sim.enemies.find((e) => e.id === z.source && !e.dead);
    if (!src) {
      z.life = 0;
      return;
    }
    z.x = src.x;
    z.z = src.z;
  }
  if (z.t < z.delay) return;
  z.angle += z.spin * STEP;
  z.tick -= STEP;
  const p = sim.player;
  const ex = z.x + Math.cos(z.angle) * z.r;
  const ez = z.z + Math.sin(z.angle) * z.r;
  if (z.tick <= 0 && p.y < 2 && distToSegment(p.x, p.z, z.x, z.z, ex, ez) < 0.6 + p.radius) {
    z.tick = 0.4;
    const nx = -Math.sin(z.angle);
    const nz = Math.cos(z.angle);
    sim.hurtPlayer(z.dmg, nx, nz);
  }
  if (Math.random() < 0.6) {
    const k = Math.random();
    sim.fx.spark(z.x + (ex - z.x) * k, 0.1, z.z + (ez - z.z) * k, rand(-1, 1), rand(1, 3), rand(-1, 1), z.color, 0.3, 6);
  }
}

/** Black hole: drags robots in and grinds them, then collapses. */
function updateVortex(sim: GameSim, z: Zone) {
  z.tick -= STEP;
  const hit = z.tick <= 0;
  if (hit) z.tick = 0.25;
  for (const e of sim.enemiesNear(z.x, z.z, z.r)) {
    const dx = z.x - e.x;
    const dz = z.z - e.z;
    const d = Math.hypot(dx, dz) || 1;
    if (!isBoss(e.kind)) {
      const pull = 3 + (1 - d / z.r) * 9;
      e.vx = (dx / d) * pull;
      e.vz = (dz / d) * pull;
      e.stunTimer = Math.max(e.stunTimer, 0.2);
      if (e.body < 0) {
        e.x += e.vx * STEP;
        e.z += e.vz * STEP;
      }
    }
    if (hit) sim.hurtEnemy(e, z.dmg * 0.25, 0, 0, { pierceShield: true });
  }
  for (let i = 0; i < 3; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = rand(2, z.r);
    sim.fx.spark(z.x + Math.cos(a) * r, z.y + rand(-0.5, 1.5), z.z + Math.sin(a) * r, -Math.cos(a) * r * 1.2 - Math.sin(a) * 4, 0, -Math.sin(a) * r * 1.2 + Math.cos(a) * 4, "#a78bfa", 0.4, 0);
  }
  if (z.t + STEP >= z.life) {
    sim.area(z.x, 0, z.z, 5, z.dmg * 2.4, 16, { raw: true, heavy: true, height: 4 });
    sim.fx.burst(z.x, z.y, z.z, 80, "#c4b5fd", 10);
    sim.addShake(18);
    sim.sfx("boom");
  }
}

/** Nanotek's turret drone: follows the player and zaps the nearest robot twice a second. */
function updateTurret(sim: GameSim, z: Zone) {
  const p = sim.player;
  const side = z.angle;
  // Hover beside the player (left or right of the facing direction).
  const gx = p.x - p.fz * 1.3 * side;
  const gz = p.z + p.fx * 1.3 * side;
  z.x += (gx - z.x) * 0.1;
  z.y += (p.y + 2.2 + Math.sin(z.t * 3) * 0.15 - z.y) * 0.1;
  z.z += (gz - z.z) * 0.1;
  z.tick -= STEP;
  if (z.tick > 0) return;
  let best = null;
  let bestD = z.r;
  for (const e of sim.enemies) {
    if (e.dead || e.allyTimer > 0) continue;
    const d = Math.hypot(e.x - z.x, e.z - z.z);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  if (!best) return;
  z.tick = 0.5;
  const dx = best.x - z.x;
  const dy = best.y + best.height / 2 - z.y;
  const dz = best.z - z.z;
  const d = Math.hypot(dx, dy, dz) || 1;
  sim.beam(z.x, z.y, z.z, [dx / d, dy / d, dz / d], z.r + 2, z.dmg, "#22d3ee", { scaled: false, width: 0.15 });
}
