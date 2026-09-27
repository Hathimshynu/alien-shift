import type { Actor } from "./types";

export type Vec3 = [number, number, number];

/** Auto-aim: ranged attacks lock onto the nearest enemy within this range and cone. */
export const AIM_RANGE = 18;
export const AIM_CONE_COS = Math.cos((75 * Math.PI) / 180);

/** True when two vertical cylinders overlap. */
export function actorsOverlap(a: Actor, b: Actor) {
  const r = a.radius + b.radius;
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return dx * dx + dz * dz < r * r && a.y < b.y + b.height && b.y < a.y + a.height;
}

export function sphereHitsActor(x: number, y: number, z: number, r: number, a: Actor) {
  const rr = r + a.radius;
  const dx = x - a.x;
  const dz = z - a.z;
  return dx * dx + dz * dz < rr * rr && y + r > a.y && y - r < a.y + a.height;
}

/** Rotate a direction about the vertical axis (for shot spreads). */
export function spread(dir: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [dir[0] * c - dir[2] * s, dir[1], dir[0] * s + dir[2] * c];
}

/** Distance from point (px, pz) to the segment (ax, az)–(bx, bz) on the ground plane. */
export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
