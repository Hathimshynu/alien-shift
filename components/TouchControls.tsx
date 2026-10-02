"use client";

import { useEffect, useRef } from "react";
import type { Action } from "@/game/input";
import type { GameRuntime } from "@/game/runtime";
import { useGameStore } from "@/game/store";
import { WeaponPanel } from "./Hud";
import { PowerButton } from "./PowerButton";

const PAD_ACTIONS: Action[] = ["attack", "special", "ultimate", "jump", "drop", "dodge", "melee", "reload", "weapon", "power1", "power2", "power3"];
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
      <div className="pointer-events-none absolute font-display text-[10px] tracking-widest text-white/30" style={{ left: "max(1rem, env(safe-area-inset-left))", bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        DRAG TO MOVE
      </div>
    </div>
  );
}

/** On-screen controls, only on touch devices (coarse pointer). */
export default function TouchControls({ runtime }: { runtime: GameRuntime }) {
  const form = useGameStore((s) => s.hud.form);
  const powers = useGameStore((s) => s.hud.powers);
  // The roll button dims while the dodge is cooling down.
  const dodgeReady = useGameStore((s) => s.hud.dodgeReady);
  const human = form === "human";
  // If we unmount while a finger is down (pause, game over), no pointerup will ever arrive —
  // release everything this component could have pressed.
  useEffect(() => () => PAD_ACTIONS.forEach((a) => runtime.input.release(a)), [runtime]);

  return (
    <div className="pointer-events-none absolute inset-0 hidden pointer-coarse:block">
      <Joystick runtime={runtime} />
      {/* Gun panel above the joystick area (tap to switch guns). */}
      <div className="absolute" style={{ left: "max(0.5rem, env(safe-area-inset-left))", bottom: "max(2.2rem, calc(env(safe-area-inset-bottom) + 1.7rem))" }}>
        <WeaponPanel runtime={runtime} compact />
      </div>
      <div
        className="absolute flex flex-col items-end gap-1.5 short:gap-1"
        // Stay clear of notches / rounded corners in landscape.
        style={{ right: "max(0.5rem, env(safe-area-inset-right))", bottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        {/* Powers (cooldown rings) — work in every form. */}
        <div className="flex items-end gap-2 short:gap-1.5">
          {powers.map((p, i) => (
            <PowerButton key={p.id} runtime={runtime} power={p} slot={i} size={46} showKey={false} />
          ))}
        </div>
        <div className="flex items-end gap-1.5">
          <Pad runtime={runtime} action="drop" label="DROP" className="h-10 w-10 text-[9px]" />
          {human ? (
            <>
              <Pad runtime={runtime} action="reload" label="⟳" className="h-11 w-11 bg-amber-500/20 text-base" />
              <Pad runtime={runtime} action="melee" label="PUNCH" className="h-12 w-12 bg-orange-500/25 text-[9px]" />
            </>
          ) : (
            <>
              <Pad runtime={runtime} action="ultimate" label="ULT" className="h-11 w-11 bg-purple-500/30 text-[10px]" />
              <Pad runtime={runtime} action="special" label="SP" className="h-12 w-12 bg-green-500/20 text-xs" />
            </>
          )}
        </div>
        <div className="flex gap-1.5">
          <Pad runtime={runtime} action="dodge" label="ROLL" className={`h-12 w-12 self-end bg-sky-500/20 text-[10px] transition-opacity ${dodgeReady ? "" : "opacity-40"}`} />
          <Pad runtime={runtime} action="attack" label={human ? "SHOOT" : "ATK"} className="h-[72px] w-[72px] bg-red-500/25 text-xs short:h-16 short:w-16" />
          <Pad runtime={runtime} action="jump" label="JUMP" className="h-[72px] w-[72px] bg-white/15 text-xs short:h-16 short:w-16" />
        </div>
      </div>
    </div>
  );
}
