"use client";

import { useShallow } from "zustand/react/shallow";
import { ALIEN_ORDER, FORMS, slotKey } from "@/game/core/forms";
import type { FormId } from "@/game/core/types";
import { WEAPONS } from "@/game/core/weapons";
import type { GameRuntime } from "@/game/runtime";
import { useGameStore } from "@/game/store";
import { FullscreenButton } from "./MobileControls";
import { PowerButton } from "./PowerButton";

export function AlienBadge({ id, size = 40, locked = false }: { id: FormId; size?: number; locked?: boolean }) {
  const f = FORMS[id];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-display font-black text-black"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: locked ? "#374151" : `radial-gradient(circle at 35% 30%, ${f.accent}, ${f.color})`,
        boxShadow: locked ? "none" : `0 0 12px ${f.color}`,
        color: locked ? "#9ca3af" : undefined,
      }}
    >
      {locked ? "🔒" : f.name[0]}
    </span>
  );
}

function Bar({ value, max, color, label, blink, right }: { value: number; max: number; color: string; label: string; blink?: boolean; right?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="w-full">
      <div className="mb-0.5 flex justify-between gap-1 whitespace-nowrap font-display text-[9px] tracking-wider text-gray-300 sm:text-[11px] sm:tracking-widest pointer-coarse:text-[8px]!">
        <span>{label}</span>
        <span>{right ?? Math.ceil(value)}</span>
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

/** Top-left: current form, HP, Shiftwatch energy and the ultimate meter. */
function Vitals() {
  const { form, hp, maxHp, energy, watchLocked, ult } = useGameStore(
    useShallow((s) => ({ form: s.hud.form, hp: s.hud.hp, maxHp: s.hud.maxHp, energy: s.hud.energy, watchLocked: s.hud.watchLocked, ult: s.hud.ult })),
  );
  const f = FORMS[form];
  const transformed = form !== "human";
  const ready = ult >= 100 && transformed;
  return (
    <div className="flex w-44 items-center gap-2 rounded-lg bg-black/50 p-1.5 sm:w-64 sm:p-2 pointer-coarse:w-40! pointer-coarse:p-1.5!">
      <AlienBadge id={form} size={34} />
      <div className="flex w-full flex-col gap-1">
        <div className="font-display text-[10px] font-bold tracking-wider sm:text-xs" style={{ color: f.accent }}>
          {f.name.toUpperCase()} <span className="text-gray-400 pointer-coarse:hidden">· {f.title}</span>
        </div>
        <Bar value={hp} max={maxHp} color={hp < maxHp * 0.25 ? "#ef4444" : "#f43f5e"} label="HP" right={`${hp} / ${maxHp}`} blink={hp < maxHp * 0.25} />
        <Bar
          value={energy}
          max={100}
          color={watchLocked ? "#6b7280" : "#22c55e"}
          label={watchLocked ? "WATCH RECHARGING" : transformed ? "SHIFTWATCH ▼" : "SHIFTWATCH ▲"}
          blink={transformed && energy < 20}
        />
        <Bar
          value={ult}
          max={100}
          color={ready ? "#fde047" : "#a855f7"}
          label={ready ? `ULTIMATE READY · L` : "ULTIMATE"}
          right={`${Math.floor(ult)}%`}
          blink={ready}
        />
      </div>
    </div>
  );
}

/** Boss name and health, split into its three phases. */
function BossBar() {
  const boss = useGameStore((s) => s.hud.boss);
  if (!boss) return null;
  return (
    <div className="mt-1 flex w-full flex-col items-center">
      <div className="truncate font-display text-[9px] font-bold tracking-[0.2em] text-purple-300 sm:text-xs sm:tracking-[0.3em]">
        {boss.name.toUpperCase()} <span className="text-purple-400/70">· PHASE {boss.phase + 1}</span>
        {boss.enraged && <span className="ml-1 animate-pulse text-red-400">· ENRAGED</span>}
      </div>
      <div className="relative mt-1 h-2 w-full max-w-sm overflow-hidden rounded-full bg-gray-800 ring-1 ring-purple-400/40 sm:h-3">
        <div
          className={`h-full transition-[width] ${boss.enraged ? "bg-linear-to-r from-red-600 to-orange-500" : "bg-linear-to-r from-fuchsia-500 to-purple-500"}`}
          style={{ width: `${boss.hp * 100}%` }}
        />
        {/* Phase dividers at 1/3 and 2/3 */}
        {Array.from({ length: boss.phases - 1 }, (_, i) => (
          <div key={i} className="absolute inset-y-0 w-0.5 bg-black/70" style={{ left: `${((i + 1) / boss.phases) * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Top-right: score, wave, best, combo and Shift Cores picked up this run. */
function ScorePanel() {
  const { score, wave, enemiesLeft, combo, runCores, mode, level, stage, stages, shards, shardsTotal } = useGameStore(
    useShallow((s) => ({
      score: s.hud.score,
      wave: s.hud.wave,
      enemiesLeft: s.hud.enemiesLeft,
      combo: s.hud.combo,
      runCores: s.hud.runCores,
      mode: s.hud.mode,
      level: s.hud.level,
      stage: s.hud.stage,
      stages: s.hud.stages,
      shards: s.hud.shards,
      shardsTotal: s.hud.shardsTotal,
    })),
  );
  const highScore = useGameStore((s) => s.save.highScore);
  const multiplier = Math.min(3, 1 + Math.floor(combo / 5) * 0.5);
  return (
    <div className="rounded-lg bg-black/50 p-1.5 text-right font-display sm:p-2">
      <div className="text-base font-black text-white sm:text-2xl">{score.toLocaleString()}</div>
      {mode === "campaign" ? (
        <>
          <div className="text-[9px] tracking-widest text-gray-400 sm:text-[11px]">
            LEVEL {level} · CHECKPOINT {stage}/{stages}
          </div>
          <div className="text-[9px] tracking-widest text-cyan-300 sm:text-[11px]">
            ◇ {shards}/{shardsTotal} SHARDS
          </div>
        </>
      ) : (
        <>
          <div className="text-[9px] tracking-widest text-gray-400 sm:text-[11px]">
            WAVE {wave} · {enemiesLeft} LEFT
          </div>
          <div className="text-[9px] tracking-widest text-gray-500 sm:text-[11px]">BEST {highScore.toLocaleString()}</div>
        </>
      )}
      <div className="text-[9px] tracking-widest text-amber-300 sm:text-[11px]">◆ {runCores} CORES</div>
      {combo >= 3 && (
        <div className="mt-1 text-xs font-black text-yellow-300 sm:text-sm">
          {combo} COMBO {multiplier > 1 && <span className="text-green-400">×{multiplier}</span>}
        </div>
      )}
    </div>
  );
}

/** Bottom: the Shiftwatch dial — four favourite aliens, the wheel button and revert. */
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
  const favorites = useGameStore((s) => s.save.favorites);
  const unlocked = useGameStore((s) => s.save.unlocked);
  const transformed = form !== "human";
  return (
    <div
      className={`pointer-events-auto flex items-center gap-1 rounded-full border border-green-500/40 bg-black/60 px-2 py-1 transition-opacity sm:gap-2 sm:px-3 sm:py-2 pointer-coarse:gap-1 pointer-coarse:px-1.5 pointer-coarse:py-1 ${
        transformReady ? "" : "opacity-60"
      }`}
    >
      {favorites.map((id) => {
        const active = form === id;
        const locked = !unlocked.includes(id);
        const disabled = locked || watchLocked || (energy < 15 && !active);
        return (
          <button
            key={id}
            type="button"
            onClick={() => runtime.requestTransform(id)}
            disabled={disabled}
            title={`${FORMS[id].name} — ${FORMS[id].title} (key ${slotKey(ALIEN_ORDER.indexOf(id))})`}
            // Extra padding on touch screens gives a bigger tap target without a bigger badge.
            className={`relative rounded-full p-0.5 transition pointer-coarse:p-1 ${active ? "scale-110 ring-2 ring-white" : "opacity-80 hover:opacity-100"} ${
              disabled ? "cursor-not-allowed grayscale" : "cursor-pointer"
            }`}
          >
            <AlienBadge id={id} size={30} locked={locked} />
            <span className="absolute -right-1 -top-1 grid h-4 w-4 place-items-center rounded-full bg-black font-display text-[9px] text-white ring-1 ring-white/40 pointer-coarse:hidden">
              {slotKey(ALIEN_ORDER.indexOf(id))}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={() => runtime.openWheel()}
        title="All aliens (hold Tab)"
        className="grid h-8 w-8 place-items-center rounded-full bg-green-500/20 font-display text-[10px] font-black text-green-300 ring-1 ring-green-400/50 hover:bg-green-500/30 pointer-coarse:h-9 pointer-coarse:w-9"
      >
        ⌚
      </button>
      <button
        type="button"
        onClick={() => runtime.requestTransform("human")}
        disabled={!transformed}
        className="ml-1 rounded-full bg-gray-800 px-2 py-1 font-display text-[10px] text-gray-300 ring-1 ring-white/20 disabled:opacity-40 pointer-coarse:px-2.5 pointer-coarse:py-1.5 sm:text-xs"
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

/** Campaign objective line (top centre). */
function Objective() {
  const { objective, levelName, mode } = useGameStore(useShallow((s) => ({ objective: s.hud.objective, levelName: s.hud.levelName, mode: s.hud.mode })));
  if (mode !== "campaign" || !objective) return null;
  return (
    <div className="max-w-full truncate rounded-full bg-black/55 px-3 py-0.5 text-center font-display text-[9px] tracking-wider text-amber-200 ring-1 ring-amber-300/30 sm:text-xs">
      <span className="text-gray-400">{levelName.toUpperCase()} · </span>
      {objective}
    </div>
  );
}

/** Kai's gun: name, ammo and the reload bar. Click / tap to switch guns. */
export function WeaponPanel({ runtime, compact = false }: { runtime: GameRuntime; compact?: boolean }) {
  const { weapon, ammo, magazine, reloading, form } = useGameStore(
    useShallow((s) => ({ weapon: s.hud.weapon, ammo: s.hud.ammo, magazine: s.hud.magazine, reloading: s.hud.reloading, form: s.hud.form })),
  );
  if (form !== "human") return null;
  const w = WEAPONS[weapon];
  const low = ammo <= Math.ceil(magazine * 0.25);
  return (
    <button
      type="button"
      title="Switch gun (V)"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        runtime.input.press("weapon");
      }}
      onPointerUp={() => runtime.input.release("weapon")}
      onPointerCancel={() => runtime.input.release("weapon")}
      className={`pointer-events-auto flex items-center gap-2 rounded-lg bg-black/55 px-2 py-1 text-left ring-1 ring-white/15 ${compact ? "" : "sm:px-3 sm:py-1.5"}`}
    >
      <span className="text-lg sm:text-xl">{w.icon}</span>
      <span className="flex flex-col">
        <span className="font-display text-[9px] font-bold tracking-widest sm:text-[11px]" style={{ color: w.color }}>
          {w.name.toUpperCase()}
        </span>
        {reloading > 0 ? (
          <span className="mt-0.5 h-1.5 w-20 overflow-hidden rounded-full bg-gray-800">
            <span className="block h-full bg-amber-300" style={{ width: `${reloading * 100}%` }} />
          </span>
        ) : (
          <span className={`font-display text-sm font-black leading-none sm:text-base ${low ? "animate-pulse text-red-400" : "text-white"}`}>
            {ammo}
            <span className="text-[10px] text-gray-400"> / {magazine}</span>
          </span>
        )}
      </span>
      {!compact && <span className="hidden font-display text-[9px] text-gray-500 sm:inline">V · G</span>}
    </button>
  );
}

/** The three equipped power buttons (desktop: bottom centre, with E / R / T). */
function PowerBar({ runtime }: { runtime: GameRuntime }) {
  const powers = useGameStore((s) => s.hud.powers);
  return (
    <div className="flex items-center gap-2">
      {powers.map((p, i) => (
        <PowerButton key={p.id} runtime={runtime} power={p} slot={i} size={46} />
      ))}
    </div>
  );
}

/** Time Freeze: cold blue tint over everything. */
function FreezeTint() {
  const on = useGameStore((s) => s.hud.timeFreeze);
  if (!on) return null;
  return <div className="pointer-events-none absolute inset-0 bg-blue-300/10 shadow-[inset_0_0_160px_40px_rgba(147,197,253,0.5)]" />;
}

/** Big centred "WAVE 3" / "BOSS INCOMING" announcement. */
function Banner() {
  const banner = useGameStore((s) => s.hud.banner);
  const cinematic = useGameStore((s) => s.hud.cinematicTitle);
  const bossActive = useGameStore((s) => s.hud.boss !== null);
  if (!banner || cinematic) return null;
  const boss = bossActive || /WAVE \d+ —/.test(banner);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[38%] flex justify-center">
      <div
        key={banner}
        className={`banner-in bg-black/45 max-w-[90%] px-8 py-2 text-center font-display text-xl font-black tracking-widest sm:text-4xl short:px-4 short:py-1 short:text-base ${boss ? "text-purple-400" : "text-green-400"}`}
        style={{ textShadow: `0 0 20px ${boss ? "#c084fc" : "#22c55e"}` }}
      >
        {banner}
      </div>
    </div>
  );
}

/** Ultimate cinematic: letterbox bars and the move's name. */
function CinematicOverlay() {
  const title = useGameStore((s) => s.hud.cinematicTitle);
  const form = useGameStore((s) => s.hud.form);
  if (!title) return null;
  const color = FORMS[form].accent;
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="letterbox-in absolute inset-x-0 top-0 h-[12%] origin-top bg-black" />
      <div className="letterbox-in absolute inset-x-0 bottom-0 h-[12%] origin-bottom bg-black" />
      <div className="absolute inset-x-0 bottom-[16%] flex justify-center">
        <div className="banner-in font-display text-3xl font-black italic tracking-widest sm:text-6xl" style={{ color, textShadow: `0 0 24px ${color}, 0 0 4px #000` }}>
          {title}!
        </div>
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

/** Frosty screen tint while Frostbyte's blizzard rages. */
function BlizzardTint() {
  const on = useGameStore((s) => s.hud.blizzard);
  if (!on) return null;
  return <div className="pointer-events-none absolute inset-0 bg-sky-200/15 shadow-[inset_0_0_140px_40px_rgba(224,242,254,0.55)]" />;
}

export default function Hud({ runtime }: { runtime: GameRuntime }) {
  return (
    <div className="hud-pad pointer-events-none absolute inset-0 flex flex-col justify-between">
      <BlizzardTint />
      <FreezeTint />
      <LowEnergyWarning />
      <Banner />
      <CinematicOverlay />
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <Vitals />
        {/* Centre column: on phones the watch dial lives up here (thumbs and buttons own the bottom). */}
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div className="hidden pointer-coarse:block">
            <WatchDial runtime={runtime} />
          </div>
          <Objective />
          <BossBar />
        </div>
        <div className="flex items-start gap-1.5 sm:gap-2">
          <ScorePanel />
          <FullscreenButton className="h-10 w-10" />
          <button
            type="button"
            aria-label="Pause"
            title="Pause (P / Esc)"
            onClick={() => runtime.togglePause()}
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-lg bg-black/50 font-display text-xs font-black text-white ring-1 ring-white/20 hover:bg-white/10 pointer-coarse:h-10 pointer-coarse:w-10"
          >
            II
          </button>
        </div>
      </div>
      {/* Desktop bottom row: gun on the left, powers + watch dial in the middle. */}
      <div className="flex items-end justify-between gap-2 pointer-coarse:hidden">
        <div className="w-44 sm:w-64">
          <WeaponPanel runtime={runtime} />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <PowerBar runtime={runtime} />
          <WatchDial runtime={runtime} />
        </div>
        <div className="w-44 sm:w-64" />
      </div>
    </div>
  );
}
