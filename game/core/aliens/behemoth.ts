import { ARENA, rand } from "../arena";
import type { AlienKit } from "./kit";

export const behemoth: AlienKit = {
  light(sim) {
    // Stomp: crushes everything on the ground just ahead.
    const p = sim.player;
    const x = p.x + p.fx * 1.6;
    const z = p.z + p.fz * 1.6;
    sim.area(x, p.y, z, 2.8, 26, 14, { ground: true, heavy: true });
    sim.ring("shock", x, p.y, z, 2.8, 0.3, 0, "#fbbf24", 0);
    sim.fx.burst(x, p.y + 0.2, z, 16, "#a8a29e", 5);
    sim.addShake(6);
    sim.sfx("heavy");
  },
  finisher(sim, upgraded) {
    // Aftershock: a shockwave rolling out from both feet.
    const p = sim.player;
    sim.ring("shock", p.x, p.y, p.z, upgraded ? 6.5 : 5, 0.45, 40, "#fbbf24", 16);
    sim.addShake(12);
    sim.sfx("heavy");
  },
  heavy(sim) {
    // Hammer Fist: an overhead double fist.
    const p = sim.player;
    const x = p.x + p.fx * 2.2;
    const z = p.z + p.fz * 2.2;
    sim.area(x, p.y, z, 3, 60, 20, { heavy: true, launch: true, height: 3.5 });
    sim.fx.burst(x, p.y + 0.3, z, 30, "#fbbf24", 7);
    sim.addShake(14);
    sim.sfx("boom");
  },
  special(sim) {
    // Rampage: charge 12 m, trampling everything (breaks shields).
    const p = sim.player;
    sim.acquireTarget(12);
    sim.dash(p.fx, p.fz, 16, 0.75, 35, 20, "#fbbf24");
    sim.sfx("heavy");
  },
  ultimate(sim) {
    // Meteor Stomp: leap sky-high while meteors rain on the street, then slam down.
    const p = sim.player;
    p.vy = 24;
    p.onGround = false;
    p.airSlam = true;
    p.slamDmg = 80;
    p.slamRadius = 6.5;
    for (let i = 0; i < 12; i++) {
      const x = rand(ARENA.minX + 2, ARENA.maxX - 2);
      const z = rand(ARENA.minZ + 2, ARENA.maxZ - 2);
      const delay = 0.7 + i * 0.12;
      sim.zone({ kind: "blast", style: "meteor", x, y: 0, z, r: 3, delay, life: delay + 0.4, dmg: 70, color: "#fb923c" });
    }
    sim.addShake(10);
    sim.sfx("boom");
  },
};
