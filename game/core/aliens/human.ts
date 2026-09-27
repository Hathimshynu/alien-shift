import type { AlienKit } from "./kit";

/** Kai: no special or ultimate (the sim blocks those in human form), but a full punch chain. */
export const human: AlienKit = {
  light(sim) {
    sim.melee(1.1, 6, 7, "#ffffff");
    sim.sfx("punch");
  },
  finisher(sim, upgraded) {
    sim.melee(1.3, upgraded ? 14 : 10, 12, "#86efac", { launch: upgraded });
    sim.sfx("punch");
  },
  heavy(sim) {
    const p = sim.player;
    sim.dash(p.fx, p.fz, 14, 0.18, 10, 10, "#86efac");
    sim.sfx("heavy");
  },
  special() {},
  ultimate() {},
};
