"use client";

import { useEffect, useRef } from "react";
import type { Action } from "@/game/input";
import type { GameRuntime } from "@/game/runtime";
import { useGameStore } from "@/game/store";
import { WatchDial } from "./Hud";
import { PowerButton } from "./PowerButton";

const PAD_ACTIONS: Action[] = ["attack", "special", "ultimate", "jump", "drop", "dodge", "melee", "reload", "weapon", "power1", "power2", "power3"];
/** Dead zone of the stick (fraction of its travel). */
const DEAD_ZONE = 0.15;
/** A touch this close to the resting stick (in stick radii) grabs it where it is; further away it follows your thumb. */
const GRAB_RADIUS = 1.6;
/** Where the stick rests (bottom-left corner of the safe area). */
const REST = { left: "var(--safe-l)", bottom: "var(--safe-b)" };
/** Width of the right-hand button grid: two medium columns + one large + gaps. */
const CLUSTER_W = "calc(var(--btn-m) * 2 + var(--btn-l) + var(--btn-gap) * 2)";

/**
 * One touch button. It captures its own pointer, so several fingers can hold several buttons at once
 * (move + shoot + jump + power) without cancelling each other. Pressed state is shown with a
 * data attribute (scale + glow, see .touch-btn in globals.css).
 */
function Pad({
  runtime,
  action,
  label,
  control,
  size,
  className = "",
  sub,
}: {
  runtime: GameRuntime;
  action: Action;
  label: string;
  control: string;
  size: string;
  className?: string;
  sub?: string;
}) {
  const release = (e: React.PointerEvent<HTMLButtonElement>) => {
    delete e.currentTarget.dataset.pressed;
    runtime.input.release(action);
  };
  return (
    <button
      type="button"
      aria-label={control}
      data-control={control}
      className={`touch-btn pointer-events-auto grid touch-none select-none place-items-center rounded-full border-2 border-white/40 bg-black/35 font-display font-black leading-none text-white shadow-[0_2px_8px_#0008] ${className}`}
      style={{ width: size, height: size, fontSize: `calc(${size} * 0.2)` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.dataset.pressed = "";
        runtime.input.press(action);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="flex flex-col items-center gap-0.5">
        {label}
        {sub && <span className="font-bold text-white/60" style={{ fontSize: `calc(${size} * 0.13)` }}>{sub}</span>}
      </span>
    </button>
  );
}

/**
 * Movement stick, always visible at the bottom-left. Touch on or near it to grab it where it rests;
 * touch elsewhere in the left zone and it jumps under your thumb, then returns when you let go.
 * Only the finger that started the drag moves it (tracked by pointer id), so a second finger on the
 * buttons never disturbs movement. Sizes are read on touch-start only — nothing measures every frame.
 */
function Joystick({ runtime }: { runtime: GameRuntime }) {
  const zone = useRef<HTMLDivElement>(null);
  const baseEl = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const active = useRef<{ id: number; cx: number; cy: number; r: number } | null>(null);

  const reset = () => {
    active.current = null;
    runtime.input.setStick(0, 0);
    const b = baseEl.current;
    if (b) {
      b.style.left = REST.left;
      b.style.top = "";
      b.style.bottom = REST.bottom;
      b.dataset.active = "false";
    }
    if (knob.current) knob.current.style.transform = "translate(-50%, -50%)";
  };

  useEffect(() => () => runtime.input.setStick(0, 0), [runtime]);

  return (
    <div
      ref={zone}
      data-control="joystick-zone"
      // Left side below the top HUD; the alien dial at the bottom centre sits above this layer.
      className="pointer-events-auto absolute left-0 touch-none select-none"
      style={{ top: "max(40%, 140px)", bottom: 0, width: "46%" }}
      onPointerDown={(e) => {
        const b = baseEl.current;
        if (active.current || !zone.current || !b) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const zr = zone.current.getBoundingClientRect();
        const br = b.getBoundingClientRect();
        const r = br.width / 2;
        let cx = br.left + r;
        let cy = br.top + r;
        if (Math.hypot(e.clientX - cx, e.clientY - cy) > r * GRAB_RADIUS) {
          // Float: centre the stick under the thumb (kept fully inside the zone).
          cx = Math.min(Math.max(e.clientX, zr.left + r), zr.right - r);
          cy = Math.min(Math.max(e.clientY, zr.top + r), zr.bottom - r);
          b.style.left = `${cx - zr.left - r}px`;
          b.style.top = `${cy - zr.top - r}px`;
          b.style.bottom = "auto";
        }
        b.dataset.active = "true";
        active.current = { id: e.pointerId, cx, cy, r };
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (active.current?.id === e.pointerId) move(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (active.current?.id === e.pointerId) reset();
      }}
      onPointerCancel={(e) => {
        if (active.current?.id === e.pointerId) reset();
      }}
      onLostPointerCapture={(e) => {
        if (active.current?.id === e.pointerId) reset();
      }}
    >
      <div
        ref={baseEl}
        data-control="joystick"
        data-active="false"
        className="pointer-events-none absolute rounded-full border-2 border-white/35 bg-black/25 opacity-70 transition-opacity data-[active=true]:opacity-100"
        style={{ width: "var(--joy)", height: "var(--joy)", ...REST }}
      >
        {/* Direction marks */}
        <span className="absolute left-1/2 top-1 -translate-x-1/2 text-[10px] text-white/50">▲</span>
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-white/50">▼</span>
        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/50">◀</span>
        <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-white/50">▶</span>
        <div
          ref={knob}
          className="absolute left-1/2 top-1/2 rounded-full bg-green-400/70 shadow-[0_0_16px_#22c55e]"
          style={{ width: "calc(var(--joy) * 0.42)", height: "calc(var(--joy) * 0.42)", transform: "translate(-50%, -50%)" }}
        />
      </div>
    </div>
  );

  function move(x: number, y: number) {
    const a = active.current;
    if (!a) return;
    const travel = a.r * 0.75;
    let dx = x - a.cx;
    let dy = y - a.cy;
    const len = Math.hypot(dx, dy);
    if (len > travel) {
      dx = (dx / len) * travel;
      dy = (dy / len) * travel;
    }
    if (knob.current) knob.current.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    // Screen down = towards the camera (+Z), matching the fixed 3/4 camera.
    if (Math.min(1, len / travel) < DEAD_ZONE) runtime.input.setStick(0, 0);
    else runtime.input.setStick(dx / travel, dy / travel);
  }
}

/**
 * On-screen controls (touch UI only). Layout, all inside the safe area and sized with clamp():
 *
 *   left: movement stick            right:   [power] [power] [power]
 *   bottom centre: alien dial                [⟳/ULT] [PUNCH/SP] [JUMP ]
 *                                            [DROP ] [ROLL    ] [SHOOT]
 */
export default function TouchControls({ runtime }: { runtime: GameRuntime }) {
  const form = useGameStore((s) => s.hud.form);
  const powers = useGameStore((s) => s.hud.powers);
  // The roll button dims while the dodge is cooling down.
  const dodgeReady = useGameStore((s) => s.hud.dodgeReady);
  const specialReady = useGameStore((s) => s.hud.specialReady);
  const ultReady = useGameStore((s) => s.hud.ult >= 100);
  const human = form === "human";
  // If we unmount while a finger is down (pause, game over), no pointerup will ever arrive —
  // release everything this component could have pressed.
  useEffect(() => () => PAD_ACTIONS.forEach((a) => runtime.input.release(a)), [runtime]);

  const M = "var(--btn-m)";
  const L = "var(--btn-l)";
  return (
    <div className="pointer-events-none absolute inset-0 z-20 hidden touch:block">
      <Joystick runtime={runtime} />
      {/* Alien dial: bottom centre, between the thumbs. */}
      <div
        className="absolute flex justify-center"
        style={{
          bottom: "var(--safe-b)",
          left: "calc(var(--safe-l) + var(--joy) + var(--btn-gap))",
          right: `calc(var(--safe-r) + ${CLUSTER_W} + var(--btn-gap))`,
        }}
      >
        <WatchDial runtime={runtime} />
      </div>
      <div
        className="absolute grid items-center justify-items-center"
        style={{
          right: "var(--safe-r)",
          bottom: "var(--safe-b)",
          gridTemplateColumns: `${M} ${M} ${L}`,
          gridTemplateRows: `${M} ${L} ${L}`,
          gap: "var(--btn-gap)",
        }}
      >
        {/* Row 1: the three equipped powers (work in every form). */}
        {powers.map((p, i) => (
          <PowerButton key={p.id} runtime={runtime} power={p} slot={i} size={M} showKey={false} showName />
        ))}
        {/* Row 2 */}
        {human ? (
          <Pad runtime={runtime} action="reload" label="⟳" sub="RELOAD" control="reload" size={M} className="bg-amber-500/25" />
        ) : (
          <Pad runtime={runtime} action="ultimate" label="ULT" control="ultimate" size={M} className={ultReady ? "bg-yellow-400/40" : "bg-purple-500/30"} />
        )}
        {human ? (
          <Pad runtime={runtime} action="melee" label="MELEE" control="punch" size={M} className="bg-orange-500/30" />
        ) : (
          <Pad runtime={runtime} action="special" label="SP" control="special" size={M} className={specialReady ? "bg-green-500/35" : "bg-green-900/30"} />
        )}
        <Pad runtime={runtime} action="jump" label="JUMP" sub="▲▲ SPIN" control="jump" size={L} className="bg-sky-500/30" />
        {/* Row 3 */}
        <Pad runtime={runtime} action="drop" label="DROP" control="drop" size={M} className="bg-white/10" />
        <Pad runtime={runtime} action="dodge" label="ROLL" control="roll" size={M} className={`bg-sky-500/20 ${dodgeReady ? "" : "opacity-40"}`} />
        <Pad runtime={runtime} action="attack" label={human ? "SHOOT" : "ATK"} sub={human ? "HOLD" : undefined} control="shoot" size={L} className="bg-red-500/40" />
      </div>
    </div>
  );
}
