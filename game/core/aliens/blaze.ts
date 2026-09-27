import { rand } from "../arena";
import { spread } from "../geom";
import type { AlienKit } from "./kit";

export const blaze: AlienKit = {
  light(sim) {
    const [x, y, z] = sim.muzzle();
    sim.fire("fire", sim.aimFrom(x, y, z, sim.acquireTarget()), 18, 0.3, 12, 1.4);
    sim.sfx("shoot");
  },
  finisher(sim, upgraded) {
    // Fire Fan: three fireballs, five once upgraded.
    const [x, y, z] = sim.muzzle();
    const dir = sim.aimFrom(x, y, z, sim.acquireTarget());
    const angles = upgraded ? [-0.4, -0.2, 0, 0.2, 0.4] : [-0.2, 0, 0.2];
    for (const a of angles) sim.fire("fire", spread(dir, a), 18, 0.3, 12, 1.4);
    sim.sfx("shoot");
  },
  heavy(sim) {
    // Magma Bomb: slow, big, explodes on impact.
    const [x, y, z] = sim.muzzle();
    sim.fire("fireBig", sim.aimFrom(x, y, z, sim.acquireTarget()), 13, 0.55, 30, 1.6, { aoe: 2.4, heavy: true });
    sim.sfx("heavy");
  },
  special(sim) {
    const p = sim.player;
    const cy = p.y + p.height / 2;
    sim.ring("nova", p.x, cy, p.z, 5.5, 0.45, 30, "#f97316", 18);
    sim.fx.burst(p.x, cy, p.z, 50, "#fde047", 8);
    sim.addShake(8);
    sim.sfx("heavy");
  },
  ultimate(sim) {
    // Supernova: a huge blast that sets everything burning.
    const p = sim.player;
    const cy = p.y + p.height / 2;
    sim.ring("supernova", p.x, cy, p.z, 14, 0.8, 90, "#fde047", 22);
    sim.fx.burst(p.x, cy, p.z, 160, "#fde047", 14);
    sim.fx.burst(p.x, cy, p.z, 80, "#f97316", 9);
    sim.flashScreen("#fef9c3", 1);
    sim.addShake(24);
    sim.sfx("boom");
  },
  tick(sim) {
    const p = sim.player;
    if (Math.random() < 0.5) {
      sim.fx.spark(p.x + rand(-0.2, 0.2), p.y + p.height, p.z + rand(-0.2, 0.2), rand(-0.3, 0.3), rand(1.5, 3), rand(-0.3, 0.3), Math.random() < 0.5 ? "#fde047" : "#f97316", 0.5, -1);
    }
  },
};
