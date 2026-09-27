import { rand } from "../arena";
import { isBoss } from "../types";
import type { AlienKit } from "./kit";

export const phantom: AlienKit = {
  light(sim) {
    // Phase Claws pass straight through warden shields.
    sim.melee(1.4, 12, 5, "#e9d5ff", { pierceShield: true });
    sim.sfx("punch");
  },
  finisher(sim, upgraded) {
    // Soul Rend: a wide ghostly slash; upgraded, it stuns.
    sim.melee(1.8, upgraded ? 34 : 26, 10, "#c4b5fd", { pierceShield: true, arc: (90 * Math.PI) / 180, stun: upgraded ? 0.7 : 0 });
    sim.sfx("zap");
  },
  heavy(sim) {
    // Spectral Lunge: phase forward through everything in the way.
    const p = sim.player;
    sim.acquireTarget(8);
    sim.dash(p.fx, p.fz, 28, 0.2, 25, 8, "#c4b5fd");
    sim.sfx("zap");
  },
  special(sim) {
    // Vanish: invisible and intangible for 3 s — robots lose track of you and hits from hiding crit.
    const p = sim.player;
    p.invisible = 3;
    sim.fx.burst(p.x, p.y + 1, p.z, 30, "#c4b5fd", 4);
    sim.fx.text(p.x, p.y + p.height + 0.4, p.z, "VANISHED", "#c4b5fd", 16);
    sim.sfx("shield");
  },
  ultimate(sim) {
    // Possession: take over the toughest robot for 12 s. With nobody to possess, a spectral blast.
    const p = sim.player;
    const candidates = sim.enemies.filter((e) => !e.dead && e.allyTimer <= 0 && !isBoss(e.kind));
    const target = candidates.sort((a, b) => b.maxHp - a.maxHp)[0];
    sim.area(p.x, p.y, p.z, 5, 30, 10, { pierceShield: true });
    if (target) {
      target.allyTimer = 12;
      target.hp = target.maxHp;
      target.shieldHp = 0;
      target.frozenTimer = target.stunTimer = target.rootTimer = target.liftTimer = 0;
      sim.zone({ kind: "beam", x: p.x, y: p.y + 1, z: p.z, x2: target.x, y2: target.y + target.height / 2, z2: target.z, life: 0.4, r: 0.18, color: "#c4b5fd" });
      sim.fx.burst(target.x, target.y + target.height / 2, target.z, 40, "#c4b5fd", 6);
      sim.fx.text(target.x, target.y + target.height + 0.6, target.z, "POSSESSED!", "#c4b5fd", 20);
    } else {
      for (const e of sim.enemies) if (isBoss(e.kind)) sim.hurtEnemy(e, 80 * sim.mul, 0, 0, { stun: 6, pierceShield: true });
    }
    sim.sfx("vortex");
  },
  tick(sim) {
    const p = sim.player;
    if (Math.random() < (p.invisible > 0 ? 0.1 : 0.3)) {
      sim.fx.spark(p.x + rand(-0.3, 0.3), p.y + rand(0, 0.5), p.z + rand(-0.3, 0.3), 0, 0.5, 0, "#c4b5fd", 0.7, -0.5);
    }
  },
};
