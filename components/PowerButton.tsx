"use client";

import { POWERS } from "@/game/core/powers";
import type { PowerHud } from "@/game/core/types";
import type { Action } from "@/game/input";
import type { GameRuntime } from "@/game/runtime";

const POWER_ACTIONS: Action[] = ["power1", "power2", "power3"];
export const POWER_KEYS = ["E", "R", "T"];

/**
 * A circular power button with a cooldown ring (conic gradient) and the seconds left.
 * Pressing it goes through the same input action as the E / R / T keys, so it uses the exact
 * gameplay path (cooldowns, locks) — it is never "just a picture".
 */
export function PowerButton({ runtime, power, slot, size = 48, showKey = true }: { runtime: GameRuntime; power: PowerHud; slot: number; size?: number; showKey?: boolean }) {
  const def = POWERS[power.id];
  const ready = power.cd <= 0;
  const frac = power.total > 0 ? Math.min(1, power.cd / power.total) : 0;
  const action = POWER_ACTIONS[slot];
  const release = () => runtime.input.release(action);
  return (
    <button
      type="button"
      aria-label={`${def.name}${ready ? "" : ` (${Math.ceil(power.cd)} s)`}`}
      title={`${def.name} (${POWER_KEYS[slot]}) — ${def.description}`}
      className="pointer-events-auto relative grid touch-none select-none place-items-center rounded-full"
      style={{
        width: size,
        height: size,
        background: ready
          ? `radial-gradient(circle at 35% 30%, ${def.color}aa, #000a)`
          : `conic-gradient(#000c ${frac * 360}deg, ${def.color}55 0)`,
        boxShadow: ready ? `0 0 14px ${def.color}, inset 0 0 0 2px ${def.color}` : "inset 0 0 0 2px #ffffff33",
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        runtime.input.press(action);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className={ready ? "" : "opacity-50"} style={{ fontSize: size * 0.42 }}>
        {def.icon}
      </span>
      {!ready && <span className="absolute inset-0 grid place-items-center font-display text-sm font-black text-white [text-shadow:0_0_4px_#000]">{Math.ceil(power.cd)}</span>}
      {showKey && (
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-black font-display text-[9px] text-white ring-1 ring-white/40">{POWER_KEYS[slot]}</span>
      )}
    </button>
  );
}
