"use client";

import { useEffect, useRef } from "react";
import type { Action } from "@/game/input";
import type { GameRuntime } from "@/game/runtime";

const PAD_ACTIONS: Action[] = ["attack", "special", "ultimate", "jump", "drop", "dodge"];
/** Joystick travel in CSS pixels and the dead zone (fraction of travel). */
const STICK_RADIUS = 56;
const DEAD_ZONE = 0.15;

function Pad({ runtime, action, label, className = "" }: { runtime: GameRuntime; action: Action; label: string; className?: string }) {
  const release = () => runtime.input.release(action);
  return (
    <button
      type="button"
      aria-label={action}
      className={`pointer-events-auto grid touch-none select-none place-items-center rounded-full border border-white/25 bg-white/10 font-display font-bold text-white active:bg-green-500/40 ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        runtime.input.press(action);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

/**
 * Floating virtual joystick: touch anywhere on the left half of the screen, the stick appears
 * under your thumb and you drag to move. (Phase 4 replaces this with the full joystick UI.)
 */
function Joystick({ runtime }: { runtime: GameRuntime }) {
  const zone = useRef<HTMLDivElement>(null);
  const baseEl = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<{ id: number; ox: number; oy: number } | null>(null);

  const end = () => {
    active.current = null;
    runtime.input.setStick(0, 0);
    if (baseEl.current) baseEl.current.style.opacity = "0";
  };

  useEffect(() => () => runtime.input.setStick(0, 0), [runtime]);

  return (
    <div
      ref={zone}
      className="pointer-events-auto absolute inset-y-0 left-0 w-1/2 touch-none select-none"
      onPointerDown={(e) => {
        if (active.current || !zone.current) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = zone.current.getBoundingClientRect();
        active.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY };
        if (baseEl.current) {
          baseEl.current.style.left = `${e.clientX - rect.left}px`;
          baseEl.current.style.top = `${e.clientY - rect.top}px`;
          baseEl.current.style.opacity = "1";
        }
        if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
      }}
      onPointerMove={(e) => {
        const a = active.current;
        if (!a || a.id !== e.pointerId) return;
        let dx = e.clientX - a.ox;
        let dy = e.clientY - a.oy;
        const len = Math.hypot(dx, dy);
        if (len > STICK_RADIUS) {
          dx = (dx / len) * STICK_RADIUS;
          dy = (dy / len) * STICK_RADIUS;
        }
        if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        const mag = Math.min(1, len / STICK_RADIUS);
        // Screen down = towards the camera (+Z), matching the fixed 3/4 camera.
        if (mag < DEAD_ZONE) runtime.input.setStick(0, 0);
        else runtime.input.setStick(dx / STICK_RADIUS, dy / STICK_RADIUS);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      <div
        ref={baseEl}
        className="pointer-events-none absolute h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/30 bg-white/5 opacity-0 transition-opacity"
      >
        <div ref={knob} className="absolute left-1/2 top-1/2 h-12 w-12 rounded-full bg-green-400/60 shadow-[0_0_16px_#22c55e]" />
      </div>
      <div className="pointer-events-none absolute bottom-3 left-4 font-display text-[10px] tracking-widest text-white/30">DRAG TO MOVE</div>
    </div>
  );
}

/** On-screen controls, only on touch devices (coarse pointer). */
export default function TouchControls({ runtime }: { runtime: GameRuntime }) {
  // If we unmount while a finger is down (pause, game over), no pointerup will ever arrive —
  // release everything this component could have pressed.
  useEffect(() => () => PAD_ACTIONS.forEach((a) => runtime.input.release(a)), [runtime]);

  return (
    <div className="pointer-events-none absolute inset-0 hidden pointer-coarse:block">
      <Joystick runtime={runtime} />
      <div className="absolute bottom-2 right-2 flex flex-col items-end gap-1.5">
        <div className="flex items-end gap-1.5">
          <Pad runtime={runtime} action="drop" label="DROP" className="h-10 w-10 text-[9px]" />
          <Pad runtime={runtime} action="ultimate" label="ULT" className="h-11 w-11 bg-purple-500/30 text-[10px]" />
          <Pad runtime={runtime} action="special" label="SP" className="h-12 w-12 bg-green-500/20 text-xs" />
        </div>
        <div className="flex gap-1.5">
          <Pad runtime={runtime} action="dodge" label="ROLL" className="h-12 w-12 self-end bg-sky-500/20 text-[10px]" />
          <Pad runtime={runtime} action="attack" label="ATK" className="h-16 w-16 bg-red-500/20 text-xs" />
          <Pad runtime={runtime} action="jump" label="▲" className="h-16 w-16 text-xl" />
        </div>
      </div>
    </div>
  );
}
