import type { AlienId, FormId } from "./types";

/*
 * Stats are in metres and seconds. Damage numbers for each move live in the alien's kit
 * (game/core/aliens/<id>.ts); upgrades multiply them (see progression.ts).
 */
export interface FormStats {
  id: FormId;
  name: string;
  title: string;
  /** Main body colour and accent/glow colour (also used by the HUD badges). */
  color: string;
  accent: string;
  /** Collision cylinder. */
  radius: number;
  height: number;
  /** Top run speed (m/s). */
  speed: number;
  /** Jump take-off speed (m/s). */
  jump: number;
  airJumps: number;
  /** < 1 = floaty jumps (Gravix, Phantom). */
  gravityScale: number;
  /** Damage taken multiplier (lower = tougher). */
  armor: number;
  /** Cooldown between light attacks. */
  attackCooldown: number;
  specialCost: number;
  specialCooldown: number;
  /** Shift Cores needed to unlock (0 = available from the start). */
  unlockCost: number;
  attackLabel: string;
  heavyLabel: string;
  specialLabel: string;
  ultimateLabel: string;
  /** Name of the upgraded 3-hit finisher unlocked at level 3. */
  comboMoveLabel: string;
  blurb: string;
}

export const FORMS: Record<FormId, FormStats> = {
  human: {
    id: "human", name: "Kai", title: "Watch Bearer", color: "#3b82f6", accent: "#22c55e",
    radius: 0.4, height: 1.8, speed: 7, jump: 14, airJumps: 1, gravityScale: 1, armor: 1,
    attackCooldown: 0.3, specialCost: 0, specialCooldown: 0, unlockCost: 0,
    attackLabel: "Shoot", heavyLabel: "Shoulder Bash", specialLabel: "Powers (E/R/T)", ultimateLabel: "—", comboMoveLabel: "Uppercut",
    blurb: "A field agent with a gun, superhuman powers and a Shiftwatch. Recharges the watch while in human form.",
  },
  blaze: {
    id: "blaze", name: "Blaze", title: "Pyro Alien", color: "#f97316", accent: "#fde047",
    radius: 0.45, height: 1.9, speed: 7.5, jump: 14.5, airJumps: 0, gravityScale: 1, armor: 0.8,
    attackCooldown: 0.2, specialCost: 20, specialCooldown: 1.5, unlockCost: 0,
    attackLabel: "Fireball", heavyLabel: "Magma Bomb", specialLabel: "Inferno Nova", ultimateLabel: "Supernova", comboMoveLabel: "Fire Fan",
    blurb: "Hurls fireballs and erupts in a burning nova that scorches everything nearby.",
  },
  titan: {
    id: "titan", name: "Titan", title: "Stone Colossus", color: "#78716c", accent: "#fb923c",
    radius: 0.75, height: 2.7, speed: 5.2, jump: 15, airJumps: 0, gravityScale: 1, armor: 0.45,
    attackCooldown: 0.45, specialCost: 25, specialCooldown: 2.2, unlockCost: 0,
    attackLabel: "Mega Punch", heavyLabel: "Hammer Smash", specialLabel: "Quake Slam", ultimateLabel: "Earthquake", comboMoveLabel: "Fault Line",
    blurb: "Slow but nearly unbreakable. Punches send robots flying; slams split the ground.",
  },
  bolt: {
    id: "bolt", name: "Bolt", title: "Speed Alien", color: "#2563eb", accent: "#facc15",
    radius: 0.4, height: 1.75, speed: 13, jump: 14.5, airJumps: 1, gravityScale: 1, armor: 0.9,
    attackCooldown: 0.12, specialCost: 15, specialCooldown: 0.9, unlockCost: 0,
    attackLabel: "Rapid Jabs", heavyLabel: "Shock Palm", specialLabel: "Lightning Dash", ultimateLabel: "Storm Rush", comboMoveLabel: "Chain Uppercut",
    blurb: "Blazing speed with a double jump. Dashes straight through enemies untouched.",
  },
  shard: {
    id: "shard", name: "Shard", title: "Crystal Alien", color: "#14b8a6", accent: "#a5f3fc",
    radius: 0.45, height: 2, speed: 7, jump: 14, airJumps: 0, gravityScale: 1, armor: 0.7,
    attackCooldown: 0.3, specialCost: 25, specialCooldown: 5, unlockCost: 0,
    attackLabel: "Crystal Spread", heavyLabel: "Crystal Lance", specialLabel: "Prism Shield", ultimateLabel: "Crystal Prison", comboMoveLabel: "Prism Storm",
    blurb: "Fires a fan of crystal shards. Its shield blocks damage and reflects bullets.",
  },
  gravix: {
    id: "gravix", name: "Gravix", title: "Gravity Alien", color: "#7c3aed", accent: "#c4b5fd",
    radius: 0.45, height: 2, speed: 6.5, jump: 15, airJumps: 0, gravityScale: 0.6, armor: 0.8,
    attackCooldown: 0.3, specialCost: 25, specialCooldown: 6, unlockCost: 60,
    attackLabel: "Gravity Pulse", heavyLabel: "Gravity Slam", specialLabel: "Levitate", ultimateLabel: "Black Hole", comboMoveLabel: "Event Horizon",
    blurb: "Bends gravity: pulls robots together, lifts them helpless into the air, and opens a black hole.",
  },
  frostbyte: {
    id: "frostbyte", name: "Frostbyte", title: "Ice Alien", color: "#38bdf8", accent: "#e0f2fe",
    radius: 0.45, height: 1.95, speed: 7, jump: 14, airJumps: 0, gravityScale: 1, armor: 0.75,
    attackCooldown: 0.22, specialCost: 20, specialCooldown: 7, unlockCost: 70,
    attackLabel: "Freeze Shot", heavyLabel: "Frost Cone", specialLabel: "Ice Wall", ultimateLabel: "Blizzard", comboMoveLabel: "Deep Freeze",
    blurb: "Freezing shots slow robots (and freeze slowed ones). Ice walls block bullets; the blizzard freezes everything.",
  },
  thornback: {
    id: "thornback", name: "Thornback", title: "Plant Alien", color: "#65a30d", accent: "#bef264",
    radius: 0.55, height: 2.1, speed: 6.2, jump: 13.5, airJumps: 0, gravityScale: 1, armor: 0.65,
    attackCooldown: 0.32, specialCost: 25, specialCooldown: 8, unlockCost: 80,
    attackLabel: "Vine Whip", heavyLabel: "Vine Grab", specialLabel: "Root Snare", ultimateLabel: "Healing Bloom", comboMoveLabel: "Bramble Spin",
    blurb: "Long-reach vine whips, roots robots in place, and blooms to heal inside a field of thorns.",
  },
  phantom: {
    id: "phantom", name: "Phantom", title: "Ghost Alien", color: "#cbd5e1", accent: "#c4b5fd",
    radius: 0.4, height: 1.9, speed: 8.5, jump: 14.5, airJumps: 1, gravityScale: 0.75, armor: 1,
    attackCooldown: 0.2, specialCost: 30, specialCooldown: 8, unlockCost: 100,
    attackLabel: "Phase Claws", heavyLabel: "Spectral Lunge", specialLabel: "Vanish", ultimateLabel: "Possession", comboMoveLabel: "Soul Rend",
    blurb: "Claws pass through shields. Vanishes for 3 s (hits from the shadows crit) and possesses robots.",
  },
  behemoth: {
    id: "behemoth", name: "Behemoth", title: "Giant Alien", color: "#9a3412", accent: "#fbbf24",
    radius: 1.1, height: 4.2, speed: 3.8, jump: 13, airJumps: 0, gravityScale: 1, armor: 0.35,
    attackCooldown: 0.75, specialCost: 30, specialCooldown: 6, unlockCost: 150,
    attackLabel: "Stomp", heavyLabel: "Hammer Fist", specialLabel: "Rampage", ultimateLabel: "Meteor Stomp", comboMoveLabel: "Aftershock",
    blurb: "Enormous and slow. Every stomp shakes the street; its charge flattens anything in the way.",
  },
  nanotek: {
    id: "nanotek", name: "Nanotek", title: "Tech Alien", color: "#64748b", accent: "#22d3ee",
    radius: 0.42, height: 1.85, speed: 7.2, jump: 14, airJumps: 0, gravityScale: 1, armor: 0.8,
    attackCooldown: 0.16, specialCost: 25, specialCooldown: 10, unlockCost: 120,
    attackLabel: "Laser Beam", heavyLabel: "Overcharge Beam", specialLabel: "Turret Drone", ultimateLabel: "Orbital Strike", comboMoveLabel: "Laser Grid",
    blurb: "Instant auto-aimed lasers, deployable turret drones, and a strike from orbit.",
  },
};

/** Watch order: keys 1–9 and 0 pick these directly. */
export const ALIEN_ORDER: AlienId[] = ["blaze", "titan", "bolt", "shard", "gravix", "frostbyte", "thornback", "phantom", "behemoth", "nanotek"];

/** Key label shown for each alien slot (1…9, then 0). */
export const slotKey = (index: number) => String((index + 1) % 10);
