import type { AlienKit } from "./kit";

export const titan: AlienKit = {
  light(sim) {
    sim.melee(2.4, 20, 16, "#fb923c");
    sim.addShake(4);
    sim.sfx("heavy");
  },
  finisher(sim, upgraded) {
    // Fault Line: a haymaker plus a ground shockwave (bigger when upgraded).
    const p = sim.player;
    sim.melee(2.6, 34, 24, "#fb923c", { heavy: true });
    sim.ring("shock", p.x, p.y, p.z, upgraded ? 5 : 3.5, 0.35, upgraded ? 30 : 18, "#fb923c", 14);
    sim.addShake(10);
    sim.sfx("heavy");
  },
  heavy(sim) {
    // Hammer Smash: both fists into the ground just ahead.
    const p = sim.player;
    const x = p.x + p.fx * 1.8;
    const z = p.z + p.fz * 1.8;
    sim.area(x, p.y, z, 2.4, 45, 18, { heavy: true, ground: true, launch: true });
    sim.ring("shock", x, p.y, z, 2.4, 0.3, 0, "#fb923c", 0);
    sim.fx.burst(x, p.y + 0.2, z, 24, "#a8a29e", 6);
    sim.addShake(12);
    sim.sfx("heavy");
  },
  special(sim) {
    const p = sim.player;
    sim.ring("quake", p.x, p.y, p.z, 9, 0.9, 40, "#a8a29e", 13);
    sim.addShake(16);
    sim.fx.burst(p.x, p.y + 0.2, p.z, 30, "#a8a29e", 6);
    sim.sfx("heavy");
  },
  ultimate(sim) {
    // Earthquake: rings of rock spikes burst out of the street, one ring after another.
    const p = sim.player;
    for (let ring = 0; ring < 5; ring++) {
      const radius = 3 + ring * 3;
      const count = 6 + ring * 4;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + ring * 0.4;
        sim.zone({
          kind: "blast",
          style: "rock",
          x: p.x + Math.cos(a) * radius,
          y: 0,
          z: p.z + Math.sin(a) * radius,
          r: 1.7,
          delay: 0.15 + ring * 0.22,
          life: 0.15 + ring * 0.22 + 1.6,
          dmg: 50,
          color: "#a8a29e",
        });
      }
    }
    sim.addShake(22);
    sim.sfx("boom");
  },
};
