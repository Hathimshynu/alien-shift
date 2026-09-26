"use client";

import { createContext, useContext } from "react";
import type { Vector3 } from "three";
import type { Actor } from "@/game/core/types";
import type { GameRuntime } from "@/game/runtime";

export const RuntimeContext = createContext<GameRuntime | null>(null);

export function useRuntime(): GameRuntime {
  const runtime = useContext(RuntimeContext);
  if (!runtime) throw new Error("useRuntime must be used inside <RuntimeContext.Provider>");
  return runtime;
}

/** Actor position smoothly interpolated between the last two fixed simulation steps. */
export function interpolated(a: Actor, alpha: number, out: Vector3) {
  return out.set(a.prevX + (a.x - a.prevX) * alpha, a.prevY + (a.y - a.prevY) * alpha, a.prevZ + (a.z - a.prevZ) * alpha);
}

/** Yaw (rotation.y) for a model built facing +Z that should look along (fx, fz). */
export const yawOf = (fx: number, fz: number) => Math.atan2(fx, fz);

/** Shortest-path angle damping (frame-rate independent). */
export function dampAngle(current: number, target: number, lambda: number, dt: number) {
  let diff = target - current;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return current + diff * (1 - Math.exp(-lambda * dt));
}
