import { ALIEN_ORDER } from "./core/forms";
import type { AlienId } from "./core/types";

/** The watch wheel: ten slots around a circle, slot 0 at the top, going clockwise (screen space). */
export const WHEEL_SLOTS = ALIEN_ORDER.length;

export const slotAngle = (i: number) => -Math.PI / 2 + (i * Math.PI * 2) / WHEEL_SLOTS;

/** Alien under a direction (screen space: x right, y down), or null for a tiny/zero vector. */
export function pickFromVector(x: number, y: number): AlienId | null {
  if (Math.hypot(x, y) < 0.35) return null;
  let a = Math.atan2(y, x) + Math.PI / 2; // 0 = up
  a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const i = Math.round(a / ((Math.PI * 2) / WHEEL_SLOTS)) % WHEEL_SLOTS;
  return ALIEN_ORDER[i];
}
