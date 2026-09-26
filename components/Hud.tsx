"use client";

import { ALIEN_ORDER, FORMS } from "@/game/forms";
import type { GameEngine } from "@/game/engine";
import type { HudState } from "@/game/types";

export function AlienBadge({ id, size = 40 }: { id: keyof typeof FORMS; size?: number }) {
  const f = FORMS[id];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-display font-black text-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: `radial-gradient(circle at 35% 30%, ${f.accent}, ${f.color})`,
        boxShadow: `0 0 12px ${f.color}`,
      }}
    >
      {f.name[0]}
    </span>
  );
}

function Bar({ value, max, color, label, blink }: { value: number; max: number; color: string; label: string; blink?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full">
      <div className="mb-0.5 flex justify-between font-display text-[9px] tracking-widest text-gray-300 sm:text-[11px]">
        <span>{label}</span>
        <span>{Math.ceil(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-800/80 ring-1 ring-white/10 sm:h-3">
        <div
          className={`h-full rounded-full transition-[width] duration-150 ${blink ? "animate-pulse" : ""}`}
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 10px ${color}` }}
        />
      </div>
    </div>
  );
}

export default function Hud({ hud, engine }: { hud: HudState; engine: GameEngine }) {
  const form = FORMS[hud.form];
  const transformed = hud.form !== "human";
  const multiplier = Math.min(3, 1 + Math.floor(hud.combo / 5) * 0.5);

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-4">
      {/* Top row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex w-40 items-center gap-2 rounded-lg bg-black/40 p-1.5 backdrop-blur-sm sm:w-64 sm:p-2">
          <AlienBadge id={hud.form} size={34} />
          <div className="flex w-full flex-col gap-1">
            <div className="font-display text-[10px] font-bold tracking-wider sm:text-xs" style={{ color: form.accent }}>
              {form.name.toUpperCase()} <span className="text-gray-400">· {form.title}</span>
            </div>
            <Bar value={hud.hp} max={hud.maxHp} color="#ef4444" label="HP" blink={hud.hp < 30} />
            <Bar
              value={hud.energy}
              max={100}
              color={hud.watchLocked ? "#6b7280" : "#22c55e"}
              label={hud.watchLocked ? "WATCH RECHARGING" : transformed ? "SHIFTWATCH ▼" : "SHIFTWATCH ▲"}
              blink={transformed && hud.energy < 20}
            />
          </div>
        </div>

        {hud.bossHp !== null && (
          <div className="mt-1 hidden flex-1 flex-col items-center sm:flex">
            <div className="font-display text-xs font-bold tracking-[0.3em] text-purple-300">OVERLORD VEXX</div>
            <div className="mt-1 h-3 w-full max-w-sm overflow-hidden rounded-full bg-gray-800 ring-1 ring-purple-400/40">
              <div className="h-full bg-linear-to-r from-fuchsia-500 to-purple-500 transition-[width]" style={{ width: `${hud.bossHp * 100}%` }} />
            </div>
          </div>
        )}

        <div className="rounded-lg bg-black/40 p-1.5 text-right font-display backdrop-blur-sm sm:p-2">
          <div className="text-base font-black text-white sm:text-2xl">{hud.score.toLocaleString()}</div>
          <div className="text-[9px] tracking-widest text-gray-400 sm:text-[11px]">
            WAVE {hud.wave} · {hud.enemiesLeft} LEFT
          </div>
          <div className="text-[9px] tracking-widest text-gray-500 sm:text-[11px]">BEST {hud.highScore.toLocaleString()}</div>
          {hud.combo >= 3 && (
            <div className="mt-1 text-xs font-black text-yellow-300 sm:text-sm">
              {hud.combo} COMBO {multiplier > 1 && <span className="text-green-400">×{multiplier}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Bottom: the Shiftwatch alien selector */}
      <div className="flex items-end justify-center">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-green-500/40 bg-black/60 px-2 py-1.5 backdrop-blur-sm sm:gap-2 sm:px-3 sm:py-2">
          {ALIEN_ORDER.map((id, i) => {
            const active = hud.form === id;
            const disabled = hud.watchLocked || (hud.energy < 15 && !active);
            return (
              <button
                key={id}
                type="button"
                onClick={() => engine.requestTransform(id)}
                disabled={disabled}
                title={`${FORMS[id].name} — ${FORMS[id].title} (key ${i + 1})`}
                className={`relative rounded-full transition ${active ? "scale-110 ring-2 ring-white" : "opacity-80 hover:opacity-100"} ${
                  disabled ? "cursor-not-allowed grayscale" : "cursor-pointer"
                }`}
              >
                <AlienBadge id={id} size={30} />
                <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-black font-display text-[9px] text-white ring-1 ring-white/40">
                  {i + 1}
                </span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => engine.requestTransform("human")}
            disabled={!transformed}
            className="ml-1 rounded-full bg-gray-800 px-2 py-1 font-display text-[10px] text-gray-300 ring-1 ring-white/20 disabled:opacity-40 sm:text-xs"
          >
            Q · KAI
          </button>
          {transformed && (
            <span
              className={`ml-1 hidden rounded-full px-2 py-1 font-display text-[10px] sm:inline ${hud.specialReady ? "bg-green-500/20 text-green-300" : "text-gray-500"}`}
            >
              K · {form.specialLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
