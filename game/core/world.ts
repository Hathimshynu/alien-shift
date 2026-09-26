import type { Rect } from "./types";

export const WORLD_W = 960;
export const WORLD_H = 540;
export const GROUND_Y = 480;
export const GRAVITY = 0.6;
export const MAX_FALL = 16;
/** Fixed simulation step (seconds). */
export const STEP = 1 / 60;

/** One-way platforms: you can jump up through them and drop down with S / ↓. */
export const PLATFORMS: Rect[] = [
  { x: 90, y: 360, w: 210, h: 14 },
  { x: 660, y: 360, w: 210, h: 14 },
  { x: 375, y: 255, w: 210, h: 14 },
];

export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const rand = (min: number, max: number) => min + Math.random() * (max - min);

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export function circleHitsRect(cx: number, cy: number, r: number, b: Rect) {
  const nx = clamp(cx, b.x, b.x + b.w);
  const ny = clamp(cy, b.y, b.y + b.h);
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}
