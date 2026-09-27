import { rand } from "../arena";
import { spread } from "../geom";
import { isBoss } from "../types";
import type { AlienKit } from "./kit";

export const shard: AlienKit = {
  light(sim) {
    const [x, y, z] = sim.muzzle();
    const dir = sim.aimFrom(x, y, z, sim.acquireTarget());
    for (const a of [-0.18, 0, 0.18]) sim.fire("crystal", spread(dir, a), 20, 0.22, 9, 1);
    sim.sfx("crystal");
  },
  finisher(sim, upgraded) {
    // Prism Storm: a wider fan of crystals.
    const [x, y, z] = sim.muzzle();
    const dir = sim.aimFrom(x, y, z, sim.acquireTarget());
    const n = upgraded ? 7 : 5;
    for (let i = 0; i < n; i++) sim.fire("crystal", spread(dir, (i - (n - 1) / 2) * 0.16), 22, 0.22, 10, 1.1);
    sim.sfx("crystal");
  },
  heavy(sim) {
    // Crystal Lance: one fast shard that pierces the whole line.
    const [x, y, z] = sim.muzzle();
    sim.fire("crystal", sim.aimFrom(x, y, z, sim.acquireTarget()), 30, 0.32, 30, 1, { pierce: true, heavy: true });
    sim.sfx("crystal");
  },
  special(sim) {
    sim.player.shieldTimer = 3;
    sim.sfx("shield");
  },
  ultimate(sim) {
    // Crystal Prison: encase every robot; they shatter for big damage when it ends.
    for (const e of sim.enemies) {
      if (e.dead || e.allyTimer > 0) continue;
      if (isBoss(e.kind)) {
        sim.hurtEnemy(e, 60 * sim.mul, 0, 0, { stun: 6, pierceShield: true });
        continue;
      }
      e.frozenTimer = Math.max(e.frozenTimer, 4);
      e.prisonDmg = 40 * sim.mul;
      sim.hurtEnemy(e, 20 * sim.mul, 0, 0, { pierceShield: true });
      sim.fx.burst(e.x, e.y + e.height / 2, e.z, 12, "#99f6e4", 4);
    }
    sim.flashScreen("#ccfbf1", 0.8);
    sim.sfx("freeze");
  },
  tick(sim) {
    const p = sim.player;
    if (Math.random() < 0.08) sim.fx.spark(p.x + rand(-0.4, 0.4), p.y + rand(0, p.height), p.z + rand(-0.4, 0.4), 0, 0.6, 0, "#e0f2fe", 0.6, 0);
  },
};
