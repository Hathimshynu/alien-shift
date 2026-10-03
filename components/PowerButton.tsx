"use client";

import { POWERS } from "@/game/core/powers";
import type { PowerHud } from "@/game/core/types";
import type { Action } from "@/game/input";
import type { GameRuntime } from "@/game/runtime";

const POWER_ACTIONS: Action[] = ["power1", "power2", "power3"];
export const POWER_KEYS = ["E", "R", "T"];

/** "Power Punch" → "PUNCH": the short name printed on the touch buttons. */
export const shortPowerName = (name: string) => name.split(" ").pop()!.toUpperCase();

/**
 * A circular power button with a cooldown sweep (conic gradient), the seconds left, and — on touch —
 * the power's short name. Pressing it goes through the same input action as the E / R / T keys, so it
 * uses the exact gameplay path (cooldowns, locks). Each finger is tracked by its own pointer capture,
 * so it works while another finger moves or shoots.
 *
 * `size` is a number of pixels (desktop) or any CSS length such as "var(--btn-m)" (touch).
 */
export function PowerButton({
  runtime,
  power,
  slot,
  size = 48,
  showKey = true,
  showName = false,
}: {
  runtime: GameRuntime;
  power: PowerHud;
  slot: number;
  size?: number | string;
  showKey?: boolean;
  showName?: boolean;
}) {
  const def = POWERS[power.id];
  const ready = power.cd <= 0;
  const frac = power.total > 0 ? Math.min(1, power.cd / power.total) : 0;
  const action = POWER_ACTIONS[slot];
  const css = typeof size === "number" ? `${size}px` : size;
  const release = (e: React.PointerEvent<HTMLButtonElement>) => {
    delete e.currentTarget.dataset.pressed;
    runtime.input.release(action);
  };
  return (
    <button
      type="button"
      data-control={`power-${slot}`}
      aria-label={`${def.name}${ready ? " ready" : ` (${Math.ceil(power.cd)} s)`}`}
      title={`${def.name} (${POWER_KEYS[slot]}) — ${def.description}`}
      className="touch-btn pointer-events-auto relative grid touch-none select-none place-items-center rounded-full"
      style={{
        width: css,
        height: css,
        background: ready ? `radial-gradient(circle at 35% 30%, ${def.color}aa, #000a)` : `conic-gradient(#000c ${frac * 360}deg, ${def.color}55 0)`,
        boxShadow: ready ? `0 0 14px ${def.color}, inset 0 0 0 2px ${def.color}` : "inset 0 0 0 2px #ffffff33",
      }}
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
      <span className={`leading-none ${ready ? "" : "opacity-40"}`} style={{ fontSize: `calc(${css} * ${showName ? 0.36 : 0.42})`, marginTop: showName ? `calc(${css} * -0.14)` : undefined }}>
        {def.icon}
      </span>
      {!ready && (
        <span className="absolute inset-0 grid place-items-center font-display font-black text-white [text-shadow:0_0_4px_#000]" style={{ fontSize: `calc(${css} * 0.32)` }}>
          {Math.ceil(power.cd)}
        </span>
      )}
      {showName && (
        <span
          className="absolute inset-x-0 text-center font-display font-bold leading-none tracking-wide [text-shadow:0_0_3px_#000]"
          style={{ bottom: `calc(${css} * 0.16)`, fontSize: `calc(${css} * 0.15)`, color: ready ? "#ffffff" : "#9ca3af" }}
        >
          {shortPowerName(def.name)}
        </span>
      )}
      {showKey && (
        <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-black font-display text-[9px] text-white ring-1 ring-white/40">{POWER_KEYS[slot]}</span>
      )}
    </button>
  );
}
