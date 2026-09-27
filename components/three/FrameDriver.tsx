"use client";

import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { Vector3 } from "three";
import { overlay } from "@/game/view/overlay";
import { useRuntime } from "./runtime-context";

/** Steps the game first in every frame (negative priority runs before other useFrame callbacks). */
export function FrameDriver() {
  const runtime = useRuntime();
  const perf = useRef({ frames: 0, elapsed: 0 });

  useFrame(({ gl }, delta) => {
    runtime.frame(delta);

    // gl.info normally resets on every render() call, so with post-processing it would only show the
    // last pass. We reset it ourselves once per frame instead: here it holds the whole previous frame.
    gl.info.autoReset = false;
    const calls = gl.info.render.calls;
    const triangles = gl.info.render.triangles;
    gl.info.reset();

    // Perf stats for the F3 overlay, refreshed twice a second.
    const p = perf.current;
    p.frames++;
    p.elapsed += delta;
    if (p.elapsed >= 0.5) {
      overlay.perf.fps = Math.round(p.frames / p.elapsed);
      overlay.perf.frameMs = (p.elapsed / p.frames) * 1000;
      overlay.perf.calls = calls;
      overlay.perf.triangles = triangles;
      p.frames = 0;
      p.elapsed = 0;
    }

    // Transform flash / ultimate flash + hurt vignette are plain DOM layers over the canvas.
    const player = runtime.sim.player;
    if (overlay.flash) {
      const green = Math.min(1, player.flash / 0.45) * 0.55;
      const big = runtime.sim.screenFlash * 0.7;
      overlay.flash.style.opacity = String(Math.max(green, big));
      overlay.flash.style.background = big > green ? runtime.sim.screenFlashColor : "#4ade80";
    }
    if (overlay.hurt) overlay.hurt.style.opacity = String(Math.min(1, player.hurtAnim / 0.35) * 0.8);
  }, -2);

  return null;
}

const projected = new Vector3();

/** Projects the pooled floating texts (damage numbers etc.) onto the screen after the camera moved. */
export function FloatingTextsDriver() {
  const runtime = useRuntime();
  const shown = useRef<string[]>([]);

  useFrame(({ camera, size }) => {
    const texts = runtime.fx.texts;
    const els = overlay.texts;
    for (let i = 0; i < texts.length && i < els.length; i++) {
      const t = texts[i];
      const el = els[i];
      if (!t.active) {
        if (el.style.display !== "none") el.style.display = "none";
        continue;
      }
      projected.set(t.x, t.y, t.z).project(camera);
      if (projected.z > 1) {
        el.style.display = "none";
        continue;
      }
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (-projected.y * 0.5 + 0.5) * size.height;
      el.style.display = "block";
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.opacity = String(Math.min(1, t.life * 2));
      // Only touch text/colour when they change: DOM writes are the expensive part.
      if (shown.current[i] !== t.text + t.color + t.size) {
        shown.current[i] = t.text + t.color + t.size;
        el.textContent = t.text;
        el.style.color = t.color;
        el.style.fontSize = `${t.size}px`;
      }
    }
  });

  return null;
}
