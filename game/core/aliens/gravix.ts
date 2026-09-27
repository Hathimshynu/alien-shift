import { rand } from "../arena";
import { isBoss } from "../types";
import type { AlienKit } from "./kit";

/** Where gravity moves land: the targeted robot, or a few metres ahead. */
function focusPoint(sim: Parameters<AlienKit["light"]>[0], range: number): [number, number] {
  const p = sim.player;
  const t = sim.acquireTarget(range);
  return t ? [t.x, t.z] : [p.x + p.fx * 4, p.z + p.fz * 4];
}

export const gravix: AlienKit = {
  light(sim) {
    // Gravity Pulse: an orb that drags nearby robots towards where it hits.
    const [x, y, z] = sim.muzzle();
    sim.fire("gravity", sim.aimFrom(x, y, z, sim.acquireTarget()), 16, 0.35, 10, 1.2, { pull: 3 });
    sim.sfx("vortex");
  },
  finisher(sim, upgraded) {
    // Event Horizon: implode everything around the target into one point.
    const [x, z] = focusPoint(sim, 8);
    const r = upgraded ? 5.5 : 4;
    for (const e of sim.enemiesNear(x, z, r)) {
      if (isBoss(e.kind)) continue;
      const d = Math.hypot(x - e.x, z - e.z) || 1;
      e.vx = ((x - e.x) / d) * 10;
      e.vz = ((z - e.z) / d) * 10;
    }
    sim.area(x, 0, z, r, 25, 0, { height: 4, stun: upgraded ? 0.8 : 0 });
    sim.ring("shock", x, 0.2, z, r, 0.4, 0, "#a78bfa", 0);
    sim.fx.burst(x, 1, z, 30, "#7c3aed", 5);
    sim.sfx("vortex");
  },
  heavy(sim) {
    // Gravity Slam: lift everything close by for a moment, then it crashes down.
    const p = sim.player;
    sim.area(p.x, p.y, p.z, 3, 30, 0, { lift: 1, heavy: true, height: 3 });
    sim.ring("shock", p.x, p.y + 0.1, p.z, 3, 0.35, 0, "#a78bfa", 0);
    sim.addShake(6);
    sim.sfx("vortex");
  },
  special(sim) {
    // Levitate: every robot within 7 m floats helplessly for 2.5 s, then drops hard.
    const p = sim.player;
    let n = 0;
    for (const e of sim.enemiesNear(p.x, p.z, 7)) {
      if (isBoss(e.kind)) {
        sim.hurtEnemy(e, 15 * sim.mul, 0, 0, { stun: 1 });
        continue;
      }
      e.liftTimer = 2.5;
      n++;
    }
    sim.ring("nova", p.x, p.y + 1, p.z, 7, 0.5, 0, "#a78bfa", 0);
    sim.fx.text(p.x, p.y + p.height + 0.5, p.z, n ? `LIFTED ×${n}` : "LEVITATE", "#c4b5fd", 16);
    sim.sfx("vortex");
  },
  ultimate(sim) {
    // Black Hole: a vortex that swallows the street for 5 s, then collapses.
    const [x, z] = focusPoint(sim, 14);
    sim.zone({ kind: "vortex", x, y: 1.2, z, r: 12, life: 5, dmg: 25, color: "#7c3aed" });
    sim.flashScreen("#1e1b4b", 0.7);
    sim.addShake(12);
    sim.sfx("vortex");
  },
  tick(sim) {
    const p = sim.player;
    if (Math.random() < 0.25) {
      const a = Math.random() * Math.PI * 2;
      sim.fx.spark(p.x + Math.cos(a) * 0.8, p.y + rand(0.2, p.height), p.z + Math.sin(a) * 0.8, 0, 0.8, 0, "#a78bfa", 0.6, 0);
    }
  },
};
