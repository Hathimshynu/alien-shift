import type { ProjectileKind, WeaponId } from "./types";

/**
 * Kai's guns, data-driven: add a weapon by adding an entry here (and a look in
 * components/three/characters/weapons.tsx). Damage is per projectile; shotguns fire `pellets`.
 */
export interface WeaponDef {
  id: WeaponId;
  name: string;
  icon: string;
  blurb: string;
  dmg: number;
  /** Shots per second while the trigger is held. */
  fireRate: number;
  /** Projectile speed (m/s) and lifetime (s): range ≈ speed × life. */
  speed: number;
  life: number;
  /** Random spread (radians) and projectiles per shot. */
  spread: number;
  pellets: number;
  magazine: number;
  reload: number;
  kind: ProjectileKind;
  radius: number;
  /** Explosion radius on impact (0 = none). */
  aoe: number;
  /** Heavy shots crack warden shields. */
  heavy: boolean;
  color: string;
  /** Screen shake per shot. */
  kick: number;
  /** Shift Cores to buy, and the campaign level that must be cleared first (0 = none). */
  cost: number;
  requiresLevel: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  pistol: {
    id: "pistol", name: "Pulse Pistol", icon: "🔫", blurb: "Reliable, accurate, quick to reload.",
    dmg: 16, fireRate: 4, speed: 34, life: 0.6, spread: 0.02, pellets: 1, magazine: 12, reload: 0.9,
    kind: "tracer", radius: 0.14, aoe: 0, heavy: false, color: "#7dd3fc", kick: 0, cost: 0, requiresLevel: 0,
  },
  rifle: {
    id: "rifle", name: "Assault Rifle", icon: "🎯", blurb: "Fast automatic fire. Great all-rounder.",
    dmg: 10, fireRate: 10, speed: 40, life: 0.55, spread: 0.05, pellets: 1, magazine: 32, reload: 1.5,
    kind: "tracer", radius: 0.12, aoe: 0, heavy: false, color: "#fde047", kick: 0.5, cost: 60, requiresLevel: 1,
  },
  shotgun: {
    id: "shotgun", name: "Scatter Shotgun", icon: "💥", blurb: "Seven pellets — devastating up close, weak at range.",
    dmg: 9, fireRate: 1.4, speed: 30, life: 0.32, spread: 0.32, pellets: 7, magazine: 6, reload: 1.7,
    kind: "pellet", radius: 0.12, aoe: 0, heavy: true, color: "#fb923c", kick: 4, cost: 90, requiresLevel: 2,
  },
  plasma: {
    id: "plasma", name: "Plasma Rifle", icon: "🟣", blurb: "Bolts that burst on impact and splash nearby robots.",
    dmg: 24, fireRate: 3.2, speed: 24, life: 0.85, spread: 0.03, pellets: 1, magazine: 18, reload: 1.6,
    kind: "plasmaBolt", radius: 0.28, aoe: 1.8, heavy: false, color: "#c084fc", kick: 1, cost: 140, requiresLevel: 4,
  },
  cannon: {
    id: "cannon", name: "Energy Cannon", icon: "☄️", blurb: "Slow, huge explosive shells. Breaks shields.",
    dmg: 70, fireRate: 0.8, speed: 20, life: 1.1, spread: 0, pellets: 1, magazine: 4, reload: 2.2,
    kind: "shell", radius: 0.42, aoe: 3.4, heavy: true, color: "#22d3ee", kick: 7, cost: 220, requiresLevel: 6,
  },
};

export const WEAPON_ORDER: WeaponId[] = ["pistol", "rifle", "shotgun", "plasma", "cannon"];
