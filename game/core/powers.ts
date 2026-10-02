import { rand } from "./arena";
import type { GameSim } from "./sim";
import type { PowerId } from "./types";
import { isBoss } from "./types";

/**
 * Kai's superhuman powers. Each one is self-contained: `activate` uses the sim's combat API.
 * The sim handles cooldowns, the power buttons and upgrades (damage × `sim.powerMul`,
 * cooldown × `sim.powerCdMul`). To add a power: add a PowerId in types.ts, an entry here,
 * an icon/colour, and a sound in audio.ts.
 */
export interface SpecialPower {
  id: PowerId;
  name: string;
  icon: string;
  description: string;
  /** Seconds before it can be used again (before upgrades). */
  cooldown: number;
  duration?: number;
  damage: number;
  range: number;
  color: string;
  /** Shift Cores to unlock and the campaign level that must be cleared first (0 = available from the start). */
  cost: number;
  requiresLevel: number;
  activate(sim: GameSim): void;
}

/** Speed of the Power Punch shockwave (m/s). */
export const PUNCH_WAVE_SPEED = 34;
export const PUNCH_WINDUP = 0.2;

export const POWERS: Record<PowerId, SpecialPower> = {
  punch: {
    id: "punch",
    name: "Power Punch",
    icon: "👊",
    description: "A superhuman punch that sends a shockwave 22 m down the street — normal robots in its path are destroyed.",
    cooldown: 8,
    damage: 150,
    range: 22,
    color: "#67e8f9",
    cost: 0,
    requiresLevel: 0,
    activate(sim) {
      // Wind up (fist charges with energy), then GameSim.releasePowerPunch fires the shockwave.
      const p = sim.player;
      sim.acquireTarget(this.range, Math.cos((40 * Math.PI) / 180));
      p.punchCharge = PUNCH_WINDUP;
      p.vx *= 0.3;
      p.vz *= 0.3;
      sim.sfx("charge");
    },
  },
  blast: {
    id: "blast",
    name: "Energy Blast",
    icon: "⚡",
    description: "Fires a ball of raw energy that explodes on impact, hurting everything around it.",
    cooldown: 6,
    damage: 90,
    range: 20,
    color: "#a78bfa",
    cost: 0,
    requiresLevel: 0,
    activate(sim) {
      const [x, y, z] = sim.muzzle();
      const t = sim.acquireTarget(20);
      sim.fire("energy", sim.aimFrom(x, y, z, t), 22, 0.6, this.damage * sim.powerMul, 1.2, { aoe: 4.5, heavy: true }, false);
      sim.fx.burst(x, y, z, 20, this.color, 4);
      sim.addShake(6);
      sim.sfx("blast");
    },
  },
  dash: {
    id: "dash",
    name: "Super Dash",
    icon: "💨",
    description: "A blinding burst of speed that slams through every robot in the way.",
    cooldown: 3.5,
    damage: 55,
    range: 13,
    color: "#fde047",
    cost: 0,
    requiresLevel: 0,
    activate(sim) {
      const p = sim.player;
      const m = sim.lastMove;
      if (Math.hypot(m.x, m.z) > 0.2) {
        const l = Math.hypot(m.x, m.z);
        p.fx = m.x / l;
        p.fz = m.z / l;
      } else sim.acquireTarget(13);
      sim.dash(p.fx, p.fz, 42, 0.3, this.damage * sim.powerMul, 22, this.color, false);
      sim.sfx("whoosh");
    },
  },
  freeze: {
    id: "freeze",
    name: "Time Freeze",
    icon: "⏱️",
    description: "Stops time for every robot (and their bullets) for 4 seconds. You keep moving.",
    cooldown: 18,
    duration: 4,
    damage: 0,
    range: 99,
    color: "#93c5fd",
    cost: 70,
    requiresLevel: 2,
    activate(sim) {
      const d = (this.duration ?? 4) * (1 + (sim.agentLevel("power") - 1) * 0.1);
      sim.timeFreeze = d;
      for (const e of sim.enemies) {
        if (e.dead || e.allyTimer > 0) continue;
        e.frozenTimer = Math.max(e.frozenTimer, isBoss(e.kind) ? d * 0.4 : d);
      }
      sim.flashScreen("#bfdbfe", 0.7);
      sim.sfx("freeze");
    },
  },
  smash: {
    id: "smash",
    name: "Ground Smash",
    icon: "🌋",
    description: "Leap up and slam into the street: a huge shockwave and rock spikes around you.",
    cooldown: 9,
    damage: 85,
    range: 7.5,
    color: "#fb923c",
    cost: 90,
    requiresLevel: 4,
    activate(sim) {
      const p = sim.player;
      p.vy = p.onGround ? 15 : -8;
      p.onGround = false;
      p.airSlam = true;
      p.slamDmg = this.damage * sim.powerMul;
      p.slamRadius = this.range;
      p.slamRocks = true;
      sim.sfx("jump");
    },
  },
  strike: {
    id: "strike",
    name: "Air Strike",
    icon: "🚀",
    description: "Launch into the air and rain energy bolts on up to 8 nearby robots.",
    cooldown: 14,
    damage: 45,
    range: 22,
    color: "#f472b6",
    cost: 120,
    requiresLevel: 6,
    activate(sim) {
      const p = sim.player;
      p.vy = 17;
      p.onGround = false;
      p.strikeShots = 8;
      p.strikeTimer = 0.35;
      sim.fx.burst(p.x, p.y, p.z, 24, this.color, 5);
      sim.sfx("whoosh");
    },
  },
};

export const POWER_ORDER: PowerId[] = ["punch", "blast", "dash", "freeze", "smash", "strike"];

/** Air Strike: one bolt from Kai to a robot (round-robin over the nearest ones). Called by the sim. */
export function fireStrikeBolt(sim: GameSim) {
  const p = sim.player;
  const targets = sim.enemiesNear(p.x, p.z, POWERS.strike.range).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
  if (!targets.length) return false;
  const e = targets[(8 - p.strikeShots) % Math.min(targets.length, 8)];
  const ox = p.x;
  const oy = p.y + p.height * 0.7;
  const oz = p.z;
  sim.zone({ kind: "beam", x: ox, y: oy, z: oz, x2: e.x, y2: e.y + e.height / 2, z2: e.z, life: 0.18, r: 0.16, color: POWERS.strike.color });
  sim.area(e.x, e.y + e.height / 2, e.z, 1.6, POWERS.strike.damage * sim.powerMul, 8, { raw: true, heavy: true, height: 3 });
  sim.fx.burst(e.x, e.y + e.height / 2, e.z, 14, POWERS.strike.color, 5);
  p.fx = (e.x - p.x) / (Math.hypot(e.x - p.x, e.z - p.z) || 1);
  p.fz = (e.z - p.z) / (Math.hypot(e.x - p.x, e.z - p.z) || 1);
  p.shootAnim = 0.15;
  sim.sfx("laser");
  return true;
}

/** Power Punch release: the shockwave zone travels forward; zones.ts moves it and applies the hits. */
export function releasePowerPunch(sim: GameSim) {
  const p = sim.player;
  const def = POWERS.punch;
  sim.zone({
    kind: "wave",
    x: p.x + p.fx * 0.8,
    y: p.y,
    z: p.z + p.fz * 0.8,
    angle: Math.atan2(p.fz, p.fx),
    r: def.range,
    spin: 2.4, // starting width (grows as it travels)
    life: def.range / PUNCH_WAVE_SPEED + 0.25,
    dmg: def.damage * sim.powerMul,
    color: def.color,
  }, false);
  p.powerAnim = "punch";
  p.powerAnimT = 0.45;
  sim.ring("shock", p.x + p.fx, p.y + 0.1, p.z + p.fz, 3, 0.3, 0, def.color, 0);
  sim.fx.burst(p.x + p.fx * 1.2, p.y + p.height * 0.6, p.z + p.fz * 1.2, 40, def.color, 9);
  for (let i = 0; i < 16; i++) sim.fx.spark(p.x, p.y + 0.2, p.z, p.fx * rand(8, 16) + rand(-2, 2), rand(1, 4), p.fz * rand(8, 16) + rand(-2, 2), "#e0f2fe", 0.5, 6);
  sim.addShake(22);
  sim.flashScreen("#e0f2fe", 0.45);
  sim.slowMo(0.35, 0.3);
  sim.sfx("impact");
}
