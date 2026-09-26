"use client";

import type { GameEngine } from "@/game/engine";
import type { Action } from "@/game/input";

function Pad({ engine, action, label, className = "" }: { engine: GameEngine; action: Action; label: string; className?: string }) {
  const release = () => engine.input.release(action);
  return (
    <button
      type="button"
      className={`grid touch-none select-none place-items-center rounded-full border border-white/20 bg-white/10 font-display font-bold text-white active:bg-green-500/40 ${className}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        engine.input.press(action);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}

/** On-screen controls, only shown on touch devices (coarse pointer). */
export default function TouchControls({ engine }: { engine: GameEngine }) {
  return (
    <div className="mt-3 hidden items-center justify-between px-2 pointer-coarse:flex">
      <div className="flex gap-2">
        <Pad engine={engine} action="left" label="◀" className="h-16 w-16 text-2xl" />
        <Pad engine={engine} action="right" label="▶" className="h-16 w-16 text-2xl" />
        <Pad engine={engine} action="down" label="▼" className="h-12 w-12 self-end text-lg" />
      </div>
      <Pad engine={engine} action="pause" label="II" className="h-10 w-10 text-xs" />
      <div className="flex items-end gap-2">
        <Pad engine={engine} action="special" label="K" className="h-14 w-14 bg-green-500/20" />
        <Pad engine={engine} action="attack" label="J" className="h-16 w-16 bg-red-500/20" />
        <Pad engine={engine} action="jump" label="▲" className="h-16 w-16 text-2xl" />
      </div>
    </div>
  );
}
