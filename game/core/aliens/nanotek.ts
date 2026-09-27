import { spread } from "../geom";
import { isBoss } from "../types";
import type { AlienKit } from "./kit";

const MAX_TURRETS = 2;

export const nanotek: AlienKit = {
  light(sim) {
    // Laser Beam: instant, auto-aimed.
    const [x, y, z] = sim.muzzle();
    sim.beam(x, y, z, sim.aimFrom(x, y, z, sim.acquireTarget()), 18, 8, "#22d3ee");
    sim.sfx("laser");
  },
  finisher(sim, upgraded) {
    // Laser Grid: a fan of beams.
    const [x, y, z] = sim.muzzle();
    const dir = sim.aimFrom(x, y, z, sim.acquireTarget());
    const angles = upgraded ? [-0.3, -0.15, 0, 0.15, 0.3] : [-0.2, 0, 0.2];
    for (const a of angles) sim.beam(x, y, z, spread(dir, a), 18, 10, "#67e8f9");
    sim.sfx("laser");
  },
  heavy(sim) {
    // Overcharge Beam: a thick laser that pierces the whole line and breaks shields.
    const [x, y, z] = sim.muzzle();
    sim.beam(x, y, z, sim.aimFrom(x, y, z, sim.acquireTarget()), 22, 30, "#a5f3fc", { pierce: true, heavy: true, width: 0.45 });
    sim.addShake(5);
    sim.sfx("laser");
  },
  special(sim) {
    // Turret Drone: hovers beside you for 10 s shooting the nearest robot (max 2 at once).
    const turrets = sim.zones.filter((z) => z.kind === "turret");
    if (turrets.length >= MAX_TURRETS) turrets[0].life = 0;
    const p = sim.player;
    const side = turrets.length % 2 ? -1 : 1;
    sim.zone({ kind: "turret", x: p.x, y: p.y + 2.2, z: p.z, r: 14, angle: side, life: 10, dmg: 7, color: "#22d3ee" });
    sim.fx.burst(p.x, p.y + 2, p.z, 16, "#22d3ee", 4);
    sim.sfx("laser");
  },
  ultimate(sim) {
    // Orbital Strike: up to 6 targets get a laser from orbit (a huge one on a boss).
    const targets = sim.enemies
      .filter((e) => !e.dead && e.allyTimer <= 0)
      .sort((a, b) => b.maxHp - a.maxHp)
      .slice(0, 6);
    targets.forEach((e, i) => {
      const boss = isBoss(e.kind);
      const delay = 1 + i * 0.15;
      sim.zone({ kind: "blast", style: "orbital", x: e.x, y: 0, z: e.z, r: boss ? 4 : 2.5, delay, life: delay + 0.5, dmg: boss ? 150 : 80, color: "#22d3ee", source: e.id });
    });
    if (!targets.length) {
      const p = sim.player;
      sim.zone({ kind: "blast", style: "orbital", x: p.x + p.fx * 5, y: 0, z: p.z + p.fz * 5, r: 3, delay: 1, life: 1.5, dmg: 80, color: "#22d3ee" });
    }
    sim.sfx("laser");
  },
};
