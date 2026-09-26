"use client";

import { useShallow } from "zustand/react/shallow";
import { ALIEN_ORDER, FORMS } from "@/game/core/forms";
import type { GameRuntime } from "@/game/runtime";
import { useGameStore } from "@/game/store";

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

/** Top-left: current form, HP and Shiftwatch energy. */
function Vitals() {
  const { form, hp, maxHp, energy, watchLocked } = useGameStore(
    useShallow((s) => ({ form: s.hud.form, hp: s.hud.hp, maxHp: s.hud.maxHp, energy: s.hud.energy, watchLocked: s.hud.watchLocked })),
  );
  const f = FORMS[form];
  const transformed = form !== "human";
  return (
    <div className="flex w-40 items-center gap-2 rounded-lg bg-black/40 p-1.5 sm:w-64 sm:p-2">
      <AlienBadge id={form} size={34} />
      <div className="flex w-full flex-col gap-1">
        <div className="font-display text-[10px] font-bold tracking-wider sm:text-xs" style={{ color: f.accent }}>
          {f.name.toUpperCase()} <span className="text-gray-400">· {f.title}</span>
        </div>
        <Bar value={hp} max={maxHp} color="#ef4444" label="HP" blink={hp < 30} />
        <Bar
          value={energy}
          max={100}
          color={watchLocked ? "#6b7280" : "#22c55e"}
          label={watchLocked ? "WATCH RECHARGING" : transformed ? "SHIFTWATCH ▼" : "SHIFTWATCH ▲"}
          blink={transformed && energy < 20}
        />
      </div>
    </div>
  );
}

function BossBar() {
  const bossHp = useGameStore((s) => s.hud.bossHp);
  if (bossHp === null) return null;
  return (
    <div className="mt-1 hidden flex-1 flex-col items-center sm:flex">
      <div className="font-display text-xs font-bold tracking-[0.3em] text-purple-300">OVERLORD VEXX</div>
      <div className="mt-1 h-3 w-full max-w-sm overflow-hidden rounded-full bg-gray-800 ring-1 ring-purple-400/40">
        <div className="h-full bg-linear-to-r from-fuchsia-500 to-purple-500 transition-[width]" style={{ width: `${bossHp * 100}%` }} />
      </div>
    </div>
  );
}

/** Top-right: score, wave, best and combo. */
function ScorePanel() {
  const { score, wave, enemiesLeft, combo } = useGameStore(
    useShallow((s) => ({ score: s.hud.score, wave: s.hud.wave, enemiesLeft: s.hud.enemiesLeft, combo: s.hud.combo })),
  );
  const highScore = useGameStore((s) => s.save.highScore);
  const multiplier = Math.min(3, 1 + Math.floor(combo / 5) * 0.5);
  return (
    <div className="rounded-lg bg-black/40 p-1.5 text-right font-display sm:p-2">
      <div className="text-base font-black text-white sm:text-2xl">{score.toLocaleString()}</div>
      <div className="text-[9px] tracking-widest text-gray-400 sm:text-[11px]">
        WAVE {wave} · {enemiesLeft} LEFT
      </div>
      <div className="text-[9px] tracking-widest text-gray-500 sm:text-[11px]">BEST {highScore.toLocaleString()}</div>
      {combo >= 3 && (
        <div className="mt-1 text-xs font-black text-yellow-300 sm:text-sm">
          {combo} COMBO {multiplier > 1 && <span className="text-green-400">×{multiplier}</span>}
        </div>
      )}
    </div>
  );
}

/** Bottom: the Shiftwatch alien selector. */
function WatchDial({ runtime }: { runtime: GameRuntime }) {
  const { form, energy, watchLocked, transformReady, specialReady } = useGameStore(
    useShallow((s) => ({
      form: s.hud.form,
      energy: s.hud.energy,
      watchLocked: s.hud.watchLocked,
      transformReady: s.hud.transformReady,
      specialReady: s.hud.specialReady,
    })),
  );
  const transformed = form !== "human";
  return (
    <div
      className={`pointer-events-auto flex items-center gap-1.5 rounded-full border border-green-500/40 bg-black/60 px-2 py-1.5 transition-opacity sm:gap-2 sm:px-3 sm:py-2 ${
        transformReady ? "" : "opacity-60"
      }`}
    >
      {ALIEN_ORDER.map((id, i) => {
        const active = form === id;
        const disabled = watchLocked || (energy < 15 && !active);
        return (
          <button
            key={id}
            type="button"
            onClick={() => runtime.requestTransform(id)}
            disabled={disabled}
            title={`${FORMS[id].name} — ${FORMS[id].title} (key ${i + 1})`}
            // Extra padding on touch screens gives a bigger tap target without a bigger badge.
            className={`relative rounded-full p-0.5 transition pointer-coarse:p-1.5 ${active ? "scale-110 ring-2 ring-white" : "opacity-80 hover:opacity-100"} ${
              disabled ? "cursor-not-allowed grayscale" : "cursor-pointer"
            }`}
          >
            <AlienBadge id={id} size={30} />
            <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-black font-display text-[9px] text-white ring-1 ring-white/40 pointer-coarse:hidden">
              {i + 1}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => runtime.requestTransform("human")}
        disabled={!transformed}
        className="ml-1 rounded-full bg-gray-800 px-2 py-1 font-display text-[10px] text-gray-300 ring-1 ring-white/20 disabled:opacity-40 pointer-coarse:px-3 pointer-coarse:py-2 sm:text-xs"
      >
        <span className="pointer-coarse:hidden">Q · </span>KAI
      </button>
      {transformed && (
        <span
          className={`ml-1 hidden rounded-full px-2 py-1 font-display text-[10px] sm:inline pointer-coarse:hidden ${specialReady ? "bg-green-500/20 text-green-300" : "text-gray-500"}`}
        >
          K · {FORMS[form].specialLabel}
        </span>
      )}
    </div>
  );
}

/** Big centred "WAVE 3" / "BOSS INCOMING" announcement. */
function Banner() {
  const banner = useGameStore((s) => s.hud.banner);
  if (!banner) return null;
  const boss = banner.includes("BOSS");
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center">
      <div
        key={banner}
        className={`banner-in bg-black/45 px-8 py-2 font-display text-2xl font-black tracking-widest sm:text-4xl ${boss ? "text-purple-400" : "text-green-400"}`}
        style={{ textShadow: `0 0 20px ${boss ? "#c084fc" : "#22c55e"}` }}
      >
        {banner}
      </div>
    </div>
  );
}

/** Pulsing red frame while transformed with the watch almost empty. */
function LowEnergyWarning() {
  const warn = useGameStore((s) => s.hud.status === "playing" && s.hud.form !== "human" && s.hud.energy < 20);
  if (!warn) return null;
  return <div className="pointer-events-none absolute inset-1 animate-pulse rounded-lg border-4 border-red-500/60" />;
}

export default function Hud({ runtime }: { runtime: GameRuntime }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 sm:p-4">
      <LowEnergyWarning />
      <Banner />
      <div className="flex items-start justify-between gap-3">
        <Vitals />
        <BossBar />
        <div className="flex items-start gap-1.5 sm:gap-2">
          <ScorePanel />
          <button
            type="button"
            aria-label="Pause"
            title="Pause (P / Esc)"
            onClick={() => runtime.togglePause()}
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-lg bg-black/40 font-display text-xs font-black text-white ring-1 ring-white/20 hover:bg-white/10 pointer-coarse:h-10 pointer-coarse:w-10"
          >
            II
          </button>
        </div>
      </div>
      <div className="flex items-end justify-center">
        <WatchDial runtime={runtime} />
      </div>
    </div>
  );
}
