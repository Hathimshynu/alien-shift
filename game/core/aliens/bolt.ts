import { AIM_CONE_COS } from "../geom";
import type { AlienKit } from "./kit";

export const bolt: AlienKit = {
  light(sim) {
    sim.melee(1.5, 9, 6, "#facc15");
    sim.sfx("punch");
  },
  finisher(sim, upgraded) {
    // Chain Uppercut: launches the target; upgraded, lightning jumps to two more robots.
    const p = sim.player;
    sim.melee(1.7, 20, 10, "#facc15", { launch: true, stun: upgraded ? 0.5 : 0 });
    if (upgraded) {
      const near = sim.enemiesNear(p.x, p.z, 7).slice(0, 2);
      for (const e of near) {
        sim.zone({ kind: "beam", x: p.x, y: p.y + p.height * 0.6, z: p.z, x2: e.x, y2: e.y + e.height / 2, z2: e.z, life: 0.2, r: 0.1, color: "#fde047" });
        sim.hurtEnemy(e, 12 * sim.mul, 0, 0, { stun: 0.4 });
      }
    }
    sim.sfx("zap");
  },
  heavy(sim) {
    // Shock Palm: stuns whatever it hits.
    sim.melee(1.6, 25, 14, "#fde047", { heavy: true, stun: 0.8 });
    sim.sfx("zap");
  },
  special(sim) {
    const p = sim.player;
    sim.acquireTarget(12, AIM_CONE_COS);
    sim.dash(p.fx, p.fz, 36, 0.28, 28, 16, "#facc15");
    sim.sfx("zap");
  },
  ultimate(sim) {
    // Storm Rush: blink from robot to robot, striking every one (see GameSim.startRush).
    sim.startRush(12);
    sim.flashScreen("#fef08a", 0.6);
    sim.sfx("zap");
  },
  tick(sim) {
    const p = sim.player;
    if (Math.hypot(p.vx, p.vz) > 8 && Math.random() < 0.7) {
      sim.fx.spark(p.x, p.y + Math.random() * p.height, p.z, -p.vx * 0.1, 0, -p.vz * 0.1, "#facc15", 0.25, 0);
    }
  },
};
