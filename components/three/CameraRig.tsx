"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { clamp } from "@/game/core/arena";
import { interpolated, useRuntime } from "./runtime-context";

/** Camera offset from the player: high and in front for the 3/4 brawler view (low enough to see the skyline). */
const OFFSET = new Vector3(0, 6.4, 9.6);
/** How much of the sim's shake value (2D-era pixels) becomes metres of camera jitter. */
const SHAKE_SCALE = 0.012;

const target = new Vector3();
const desired = new Vector3();
const look = new Vector3();
const playerPos = new Vector3();
const bossOffset = new Vector3(0, 8.4, 11.5);

export function CameraRig() {
  const runtime = useRuntime();
  const lookAt = useRef(new Vector3(0, 1, 0));

  useFrame(({ camera }, dt) => {
    const sim = runtime.sim;
    const t = runtime.time;
    const damp = (lambda: number) => 1 - Math.exp(-lambda * dt);

    if (sim.status === "menu") {
      // Slow cinematic orbit around the street while the title screen is up.
      const a = t * 0.08;
      desired.set(Math.sin(a) * 16, 9 + Math.sin(t * 0.3), 14 + Math.cos(a) * 4);
      target.set(0, 1.5, -3);
      camera.position.lerp(desired, damp(1.5));
    } else {
      const p = interpolated(sim.player, runtime.alpha, playerPos);
      // Keep the view inside the street so the fog-hidden ends don't take up half the screen.
      target.set(clamp(p.x, -11, 11), p.y * 0.5 + 1, clamp(p.z, -7, 8));
      // A hovering boss flies above the normal view: pull back and aim a little higher.
      const boss = sim.enemies.find((e) => e.kind === "boss" && e.y > 2);
      if (boss) target.y += 1.2;
      desired.copy(target).add(boss ? bossOffset : OFFSET);
      if (sim.status === "gameover") desired.lerp(target, 0.35 * Math.min(1, sim.statusTime / 2)); // slow push-in
      camera.position.lerp(desired, damp(5));
    }
    lookAt.current.lerp(target, damp(6));
    look.copy(lookAt.current);

    // Screen shake: jitter both the eye and the look-at point.
    const s = sim.status === "playing" ? sim.shake * SHAKE_SCALE : 0;
    if (s > 0) {
      camera.position.x += (Math.random() - 0.5) * s;
      camera.position.y += (Math.random() - 0.5) * s;
      look.x += (Math.random() - 0.5) * s * 0.5;
    }
    camera.lookAt(look);
  }, -1);

  return null;
}
