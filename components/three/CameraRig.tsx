"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { clamp } from "@/game/core/arena";
import { isBoss } from "@/game/core/types";
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
      const c = sim.cinematic;
      if (c) {
        // Transform: push in on Kai. Ultimate: tight zoom that slowly circles the alien.
        const h = sim.player.height;
        target.set(p.x, p.y + h * 0.55, p.z);
        const zoom = c.kind === "ultimate" ? 0.32 + h * 0.06 : 0.5;
        const swing = c.kind === "ultimate" ? (c.t / c.dur - 0.5) * 0.9 : 0;
        desired.set(Math.sin(swing) * OFFSET.z, OFFSET.y * 0.8, Math.cos(swing) * OFFSET.z).multiplyScalar(zoom).add(target);
        camera.position.lerp(desired, damp(c.kind === "ultimate" ? 9 : 7));
      } else {
        // Keep the view inside the street so the fog-hidden ends don't take up half the screen.
        target.set(clamp(p.x, -11, 11), p.y * 0.5 + 1, clamp(p.z, -7, 8));
        // Bosses need a wider view; a hovering one also flies above the normal framing.
        const boss = sim.enemies.find((e) => isBoss(e.kind));
        if (boss && boss.y > 2) target.y += 1.2;
        // Tall forms (Titan, Behemoth) get a little more room too.
        const tall = 1 + Math.max(0, sim.player.height - 2) * 0.25;
        desired.copy(boss ? bossOffset : OFFSET).multiplyScalar(boss ? Math.max(1, tall * 0.9) : tall).add(target);
        if (sim.status === "gameover") desired.lerp(target, 0.35 * Math.min(1, sim.statusTime / 2)); // slow push-in
        camera.position.lerp(desired, damp(5));
      }
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
