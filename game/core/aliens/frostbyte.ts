import { rand } from "../arena";
import type { AlienKit } from "./kit";

export const frostbyte: AlienKit = {
  light(sim) {
    // Freeze Shot: slows; hitting an already-slowed robot freezes it (handled in the sim).
    const [x, y, z] = sim.muzzle();
    sim.fire("frost", sim.aimFrom(x, y, z, sim.acquireTarget()), 22, 0.25, 8, 1.2, { slow: 2 });
    sim.sfx("crystal");
  },
  finisher(sim, upgraded) {
    // Deep Freeze: an icy burst around Frostbyte; upgraded, it freezes instead of slowing.
    const p = sim.player;
    const r = upgraded ? 4 : 3;
    sim.area(p.x, p.y, p.z, r, 22, 10, { slow: 2.5, freeze: upgraded ? 1.5 : 0 });
    sim.ring("nova", p.x, p.y + 1, p.z, r, 0.35, 0, "#bae6fd", 0);
    sim.fx.burst(p.x, p.y + 1, p.z, 30, "#e0f2fe", 6);
    sim.sfx("freeze");
  },
  heavy(sim) {
    // Frost Cone: a wide blast of cold in front.
    sim.melee(4, 20, 8, "#bae6fd", { arc: (40 * Math.PI) / 180, slow: 3 });
    const p = sim.player;
    for (let i = 0; i < 16; i++) {
      const a = Math.atan2(p.fz, p.fx) + rand(-0.6, 0.6);
      const s = rand(6, 12);
      sim.fx.spark(p.x, p.y + p.height * 0.6, p.z, Math.cos(a) * s, rand(-1, 1), Math.sin(a) * s, "#e0f2fe", 0.4, 0);
    }
    sim.sfx("freeze");
  },
  special(sim) {
    // Ice Wall: a solid wall across the facing direction that blocks bullets and robots for 6 s.
    const p = sim.player;
    const x = p.x + p.fx * 2.5;
    const z = p.z + p.fz * 2.5;
    // The wall runs perpendicular to the facing direction.
    const yaw = Math.atan2(-p.fz, p.fx) + Math.PI / 2;
    const handle = sim.physics.addWall(x, z, yaw, 6, 2.2, 0.6);
    sim.zone({ kind: "iceWall", x, y: 0, z, r: 6, angle: yaw, life: 6, handle, color: "#bae6fd" });
    sim.fx.burst(x, 1, z, 30, "#e0f2fe", 5);
    sim.sfx("freeze");
  },
  ultimate(sim) {
    // Blizzard: freeze the whole street and grind everything down for 5 s.
    for (const e of sim.enemies) {
      if (!e.dead && e.allyTimer <= 0) sim.hurtEnemy(e, 10 * sim.mul, 0, 0, { freeze: 3, pierceShield: true });
    }
    sim.zone({ kind: "blizzard", life: 5, dmg: 15, color: "#e0f2fe" });
    sim.flashScreen("#e0f2fe", 0.9);
    sim.sfx("freeze");
  },
  tick(sim) {
    const p = sim.player;
    if (Math.random() < 0.15) sim.fx.spark(p.x + rand(-0.4, 0.4), p.y + rand(0, p.height), p.z + rand(-0.4, 0.4), 0, -0.4, 0, "#e0f2fe", 0.7, 0);
  },
};
