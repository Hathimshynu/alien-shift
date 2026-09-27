import { isBoss } from "../types";
import type { AlienKit } from "./kit";

export const thornback: AlienKit = {
  light(sim) {
    // Vine Whip: long, narrow reach.
    sim.melee(3.2, 11, 7, "#84cc16", { arc: (35 * Math.PI) / 180 });
    sim.sfx("punch");
  },
  finisher(sim, upgraded) {
    // Bramble Spin: whips all the way round; upgraded, it also roots what it hits.
    sim.melee(3.5, 20, 12, "#84cc16", { arc: Math.PI, root: upgraded ? 1.5 : 0 });
    sim.sfx("heavy");
  },
  heavy(sim) {
    // Vine Grab: yank the targeted robot right in front of you.
    const p = sim.player;
    const t = sim.acquireTarget(8);
    if (!t) {
      sim.melee(3.2, 15, 6, "#84cc16", { heavy: true });
      return;
    }
    sim.zone({ kind: "beam", x: p.x, y: p.y + p.height * 0.6, z: p.z, x2: t.x, y2: t.y + t.height / 2, z2: t.z, life: 0.25, r: 0.1, color: "#65a30d" });
    if (!isBoss(t.kind) && t.rootTimer <= 0) {
      const d = Math.hypot(p.x - t.x, p.z - t.z) || 1;
      t.vx = ((p.x - t.x) / d) * 16;
      t.vz = ((p.z - t.z) / d) * 16;
    }
    sim.hurtEnemy(t, 15 * sim.mul, 0, 0, { stun: 0.6, heavy: true });
    sim.sfx("heavy");
  },
  special(sim) {
    // Root Snare: vines hold every robot within 7 m for 3 s (bosses are only slowed).
    const p = sim.player;
    for (const e of sim.enemiesNear(p.x, p.z, 7)) {
      if (isBoss(e.kind)) e.slowTimer = Math.max(e.slowTimer, 3);
      sim.hurtEnemy(e, 10 * sim.mul, 0, 0, { root: 3 });
    }
    sim.ring("quake", p.x, p.y, p.z, 7, 0.5, 0, "#65a30d", 0);
    sim.sfx("heavy");
  },
  ultimate(sim) {
    // Healing Bloom: heal half your health and raise a field of thorns for 6 s.
    const p = sim.player;
    sim.healPlayer(p.maxHp * 0.5);
    sim.zone({ kind: "bloom", x: p.x, y: p.y, z: p.z, r: 3, life: 2, color: "#f9a8d4" });
    sim.zone({ kind: "thorns", x: p.x, y: 0, z: p.z, r: 8, life: 6, dmg: 20, color: "#65a30d" });
    sim.fx.burst(p.x, p.y + 1, p.z, 60, "#bef264", 6);
    sim.sfx("pickup");
  },
};
