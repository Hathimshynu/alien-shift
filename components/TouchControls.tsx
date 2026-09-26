"use client";

import { useEffect } from "react";
import type { GameEngine } from "@/game/engine";
import type { Action } from "@/game/input";

const PAD_ACTIONS: Action[] = ["left", "right", "down", "attack", "special", "jump"];

function Pad({ engine, action, label, className = "" }: { engine: GameEngine; action: Action; label: string; className?: string }) {
  const release = () => engine.input.release(action);
  return (
    <button
      type="button"
      aria-label={action}
      className={`pointer-events-auto grid touch-none select-none place-items-center rounded-full border border-white/25 bg-white/10 font-display font-bold text-white backdrop-blur-sm active:bg-green-500/40 ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        engine.input.press(action);
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
 * On-screen buttons overlaid on the game view, only on touch devices (coarse pointer).
 * Phase 4 replaces these with a joystick + radial watch wheel.
 */
export default function TouchControls({ engine }: { engine: GameEngine }) {
  // If we unmount while a finger is down (pause, game over), no pointerup will ever arrive —
  // release everything this component could have pressed.
  useEffect(() => () => PAD_ACTIONS.forEach((a) => engine.input.release(a)), [engine]);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden items-end justify-between p-2 pointer-coarse:flex">
      <div className="flex flex-col items-center gap-1.5">
        <Pad engine={engine} action="down" label="▼" className="h-10 w-10 text-sm" />
        <div className="flex gap-1.5">
          <Pad engine={engine} action="left" label="◀" className="h-14 w-14 text-xl" />
          <Pad engine={engine} action="right" label="▶" className="h-14 w-14 text-xl" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <Pad engine={engine} action="special" label="SP" className="mr-16 h-12 w-12 bg-green-500/20 text-xs" />
        <div className="flex gap-1.5">
          <Pad engine={engine} action="attack" label="ATK" className="h-14 w-14 bg-red-500/20 text-xs" />
          <Pad engine={engine} action="jump" label="▲" className="h-14 w-14 text-xl" />
        </div>
      </div>
    </div>
  );
}
