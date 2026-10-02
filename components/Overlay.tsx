"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ALIEN_ORDER, FORMS, slotKey } from "@/game/core/forms";
import { LEVELS, levelById } from "@/game/core/levels";
import { DIFFICULTIES, DIFFICULTY } from "@/game/core/rules";
import { enterFullscreen, isTouchDevice } from "@/game/platform/pwa";
import type { GameRuntime } from "@/game/runtime";
import { QUALITY_LEVELS, useGameStore } from "@/game/store";
import { AlienBadge } from "./Hud";
import { FullscreenButton, InstallButton } from "./MobileControls";

/** True on touch devices (phones/tablets); false during the server render. */
function useTouch() {
  const [touch, setTouch] = useState(false);
  useEffect(() => setTouch(isTouchDevice()), []);
  return touch;
}

function Button({ children, onClick, variant = "primary" }: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "ghost" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        variant === "primary"
          ? "watch-glow rounded-full bg-green-500 px-6 py-2 font-display text-sm font-black tracking-widest text-black transition hover:bg-green-400 sm:px-8 sm:py-3 sm:text-base short:px-6 short:py-2 short:text-sm"
          : "rounded-full border border-white/30 px-5 py-2 font-display text-xs font-bold tracking-widest text-white transition hover:bg-white/10 sm:text-sm short:text-xs"
      }
    >
      {children}
    </button>
  );
}

/** Low / Medium / High picker. The choice is saved and overrides the auto-detected default. */
function QualityPicker() {
  const quality = useGameStore((s) => s.settings.quality);
  const setQuality = useGameStore((s) => s.setQuality);
  return (
    <div className="flex items-center gap-2 font-display text-[10px] tracking-widest text-gray-400 sm:text-xs">
      GRAPHICS
      <div className="flex overflow-hidden rounded-full ring-1 ring-white/20">
        {QUALITY_LEVELS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuality(q)}
            className={`px-3 py-1 uppercase transition ${q === quality ? "bg-green-500 font-bold text-black" : "text-gray-300 hover:bg-white/10"}`}
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/** All ten aliens as small badges (locked ones greyed out). */
function AlienStrip({ compact }: { compact: boolean }) {
  const unlocked = useGameStore((s) => s.save.unlocked);
  return (
    <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
      {ALIEN_ORDER.map((id, i) => {
        const own = unlocked.includes(id);
        return (
          <div key={id} className="flex w-12 flex-col items-center gap-0.5 sm:w-16 short:w-12" title={`${FORMS[id].name} — ${FORMS[id].title}`}>
            <AlienBadge id={id} size={compact ? 28 : 34} locked={!own} />
            <div className="truncate font-display text-[8px] font-bold sm:text-[10px] short:text-[8px]" style={{ color: own ? FORMS[id].accent : "#6b7280" }}>
              {compact ? FORMS[id].name : `${slotKey(i)} ${FORMS[id].name}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Easy / Normal / Hard / Nightmare (saved; applies from the next run). */
export function DifficultyPicker() {
  const difficulty = useGameStore((s) => s.settings.difficulty);
  const setDifficulty = useGameStore((s) => s.setDifficulty);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex items-center gap-2 font-display text-[10px] tracking-widest text-gray-400 sm:text-xs">
        DIFFICULTY
        <div className="flex overflow-hidden rounded-full ring-1 ring-white/20">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDifficulty(d)}
              className={`px-2.5 py-1 uppercase transition sm:px-3 ${d === difficulty ? (d === "nightmare" ? "bg-red-600 font-bold text-white" : "bg-green-500 font-bold text-black") : "text-gray-300 hover:bg-white/10"}`}
            >
              {DIFFICULTY[d].label}
            </button>
          ))}
        </div>
      </div>
      <div className="text-[10px] text-gray-400 short:hidden">{DIFFICULTY[difficulty].blurb}</div>
    </div>
  );
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Campaign / Endless switch on the main menu. */
function ModePicker() {
  const mode = useGameStore((s) => s.mode);
  const selectedLevel = useGameStore((s) => s.selectedLevel);
  const selectMode = useGameStore((s) => s.selectMode);
  const lvl = levelById(selectedLevel);
  const card = (active: boolean) =>
    `flex w-40 flex-col items-center rounded-xl border px-3 py-2 transition sm:w-52 short:py-1.5 ${active ? "border-green-400 bg-green-500/15" : "border-white/15 bg-black/40 hover:bg-white/10"}`;
  return (
    <div className="flex flex-wrap items-stretch justify-center gap-2">
      <button type="button" className={card(mode === "campaign")} onClick={() => selectMode("campaign")}>
        <span className="font-display text-xs font-black tracking-widest text-green-300 sm:text-sm">CAMPAIGN</span>
        <span className="font-display text-[10px] text-white sm:text-xs">
          LEVEL {lvl.id} · {lvl.name}
        </span>
        <span className="mt-0.5 font-display text-[9px] tracking-widest text-gray-400">{lvl.subtitle.toUpperCase()}</span>
      </button>
      <button type="button" className={card(mode === "endless")} onClick={() => selectMode("endless")}>
        <span className="font-display text-xs font-black tracking-widest text-purple-300 sm:text-sm">ENDLESS</span>
        <span className="font-display text-[10px] text-white sm:text-xs">Survive the waves</span>
        <span className="mt-0.5 font-display text-[9px] tracking-widest text-gray-400">BOSS EVERY 5 WAVES</span>
      </button>
    </div>
  );
}

/** Level select: the 10 campaign levels (locked until the previous one is cleared). */
export function LevelSelect({ runtime }: { runtime: GameRuntime }) {
  const save = useGameStore((s) => s.save);
  const selectedLevel = useGameStore((s) => s.selectedLevel);
  const selectMode = useGameStore((s) => s.selectMode);
  const setScreen = useGameStore((s) => s.setScreen);
  const touch = useTouch();
  return (
    <div className="hud-pad absolute inset-0 z-30 flex flex-col bg-[#07061a] p-2 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-black tracking-widest text-green-400 sm:text-2xl">CAMPAIGN</h2>
        <DifficultyPicker />
        <button type="button" onClick={() => setScreen(null)} className="rounded-full border border-white/30 px-4 py-1 font-display text-xs font-bold tracking-widest text-white hover:bg-white/10">
          BACK
        </button>
      </div>
      <div className="mt-2 grid min-h-0 flex-1 grid-cols-2 content-start gap-1.5 overflow-y-auto sm:grid-cols-5 sm:gap-2">
        {LEVELS.map((l) => {
          const locked = l.id > save.unlockedLevel;
          const rec = save.levelRecords[l.id];
          const selected = l.id === selectedLevel;
          return (
            <button
              key={l.id}
              type="button"
              disabled={locked}
              onClick={() => {
                selectMode("campaign", l.id);
                setScreen(null);
                if (touch) void enterFullscreen();
                runtime.startGame();
              }}
              className={`flex flex-col rounded-lg border p-2 text-left transition ${locked ? "cursor-not-allowed border-white/5 bg-white/5 opacity-50" : selected ? "border-green-400 bg-green-500/10" : "border-white/15 bg-white/5 hover:bg-white/10"}`}
            >
              <span className="font-display text-[10px] tracking-widest text-gray-400">LEVEL {l.id}</span>
              <span className="font-display text-xs font-black text-white sm:text-sm">{locked ? "🔒 " : ""}{l.name}</span>
              <span className="text-[10px] text-gray-400">{l.subtitle}</span>
              <span className="mt-1 flex flex-wrap gap-x-2 font-display text-[9px] tracking-wider">
                {rec?.cleared && <span className="text-green-400">✓ {fmtTime(rec.bestTime)}</span>}
                <span className="text-cyan-300">◇ {rec?.shards.length ?? 0}/{l.shards.length}</span>
                <span className="text-amber-300">◆ {l.reward}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Setting: skip the slow-motion transformation sequence. */
function CinematicToggle() {
  const skip = useGameStore((s) => s.settings.skipTransform);
  const toggle = useGameStore((s) => s.toggleSkipTransform);
  return (
    <label className="flex cursor-pointer items-center gap-2 font-display text-[10px] tracking-widest text-gray-400 sm:text-xs">
      <input type="checkbox" checked={skip} onChange={toggle} className="accent-green-500" />
      SKIP TRANSFORMATION SEQUENCE
    </label>
  );
}

export default function Overlay({ runtime }: { runtime: GameRuntime }) {
  const { status, score, wave, runCores, mode, level, result } = useGameStore(
    useShallow((s) => ({ status: s.hud.status, score: s.hud.score, wave: s.hud.wave, runCores: s.hud.runCores, mode: s.hud.mode, level: s.hud.level, result: s.hud.result })),
  );
  const menuMode = useGameStore((s) => s.mode);
  const highScore = useGameStore((s) => s.save.highScore);
  const cores = useGameStore((s) => s.save.cores);
  const unlockedCount = useGameStore((s) => s.save.unlocked.length);
  const muted = useGameStore((s) => s.settings.muted);
  const setScreen = useGameStore((s) => s.setScreen);
  const touch = useTouch();

  if (status === "playing") return null;

  // On phones, starting a run also goes fullscreen + landscape (it needs this tap to be allowed).
  const start = () => {
    if (touch) void enterFullscreen();
    runtime.startGame();
  };
  const enter = touch ? "" : " · ENTER";

  return (
    // No backdrop-blur: blurring a live WebGL canvas every frame is expensive on weak GPUs.
    // `my-auto` (not justify-center) keeps the top of a tall menu reachable when it has to scroll.
    <div className={`hud-pad absolute inset-0 flex flex-col items-center overflow-y-auto ${status === "menu" ? "bg-black/45" : "bg-black/65"}`}>
      {status === "menu" && (
        <div className="my-auto flex max-w-3xl flex-col items-center gap-3 py-2 text-center sm:gap-5 short:gap-2">
          <div>
            <h1 className="bg-linear-to-b from-green-300 to-green-600 bg-clip-text font-display text-3xl font-black tracking-widest text-transparent sm:text-6xl short:text-3xl">
              ALIEN SHIFT
            </h1>
            <p className="mt-1 text-xs text-gray-200 [text-shadow:0_1px_3px_#000] sm:text-base short:hidden">
              Robots are invading. Agent Kai has a gun, superhuman powers and a Shiftwatch full of aliens.
            </p>
          </div>
          <ModePicker />
          <AlienStrip compact={touch} />
          <p className="max-w-xl text-[11px] text-gray-300 [text-shadow:0_1px_3px_#000] sm:text-xs short:hidden">
            {touch
              ? "Left thumb moves. SHOOT (hold) fires, JUMP twice = double jump + spin, ROLL dodges, PUNCH for melee, the round buttons are powers, ⌚ = aliens."
              : "WASD move · Space jump (twice = spin) · hold J or left mouse to shoot (mouse aims) · F punch · E R T powers · Shift dodge · G reload · V switch gun · 1–0 aliens."}{" "}
            Collect Shift Cores to buy guns, powers and upgrades in the Shift Lab.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 short:gap-2">
            <Button onClick={start}>{menuMode === "campaign" ? "PLAY" : "START"}{enter}</Button>
            <Button variant="ghost" onClick={() => setScreen("levels")}>
              LEVELS
            </Button>
            <Button variant="ghost" onClick={() => setScreen("upgrades")}>
              SHIFT LAB · ◆ {cores}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <InstallButton />
            <FullscreenButton className="h-8 w-8" />
          </div>
          <div className="text-[10px] tracking-widest text-gray-400 short:hidden">
            {unlockedCount} / {ALIEN_ORDER.length} ALIENS UNLOCKED
          </div>
          <DifficultyPicker />
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <QualityPicker />
            <CinematicToggle />
          </div>
        </div>
      )}

      {status === "paused" && (
        <div className="my-auto flex flex-col items-center gap-4 short:gap-2">
          <h2 className="font-display text-3xl font-black tracking-widest text-white sm:text-5xl short:text-3xl">PAUSED</h2>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => runtime.togglePause()}>RESUME</Button>
            <Button variant="ghost" onClick={start}>
              RESTART
            </Button>
            <Button variant="ghost" onClick={() => runtime.quitToMenu()}>
              MENU
            </Button>
            <Button variant="ghost" onClick={() => runtime.toggleMute()}>
              {muted ? "UNMUTE" : "MUTE"}
            </Button>
            <FullscreenButton className="h-9 w-9" />
          </div>
          <QualityPicker />
          <CinematicToggle />
        </div>
      )}

      {status === "gameover" && mode === "campaign" && (
        <div className="my-auto flex flex-col items-center gap-3 text-center short:gap-1.5">
          <h2 className="font-display text-3xl font-black tracking-widest text-red-500 sm:text-5xl short:text-3xl">MISSION FAILED</h2>
          <p className="font-display text-sm text-gray-300">
            Level {level} · {levelById(level).name}
          </p>
          <div className="font-display text-sm font-bold text-amber-300">◆ +{runCores} SHIFT CORES kept (total {cores})</div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => runtime.retryCheckpoint()}>RETRY CHECKPOINT</Button>
            <Button variant="ghost" onClick={start}>
              RESTART LEVEL
            </Button>
            <Button variant="ghost" onClick={() => setScreen("upgrades")}>
              SHIFT LAB
            </Button>
            <Button variant="ghost" onClick={() => runtime.quitToMenu()}>
              MENU
            </Button>
          </div>
        </div>
      )}

      {status === "complete" && result && (
        <div className="my-auto flex flex-col items-center gap-2 text-center short:gap-1">
          <h2 className="font-display text-3xl font-black tracking-widest text-green-400 sm:text-5xl short:text-3xl">
            {result.levelId >= LEVELS.length ? "CAMPAIGN COMPLETE!" : "LEVEL COMPLETE"}
          </h2>
          <p className="font-display text-sm text-gray-300">
            Level {result.levelId} · {levelById(result.levelId).name}
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 font-display text-xs text-gray-300 sm:text-sm">
            <span>TIME</span>
            <span className="text-white">{fmtTime(result.time)}</span>
            <span>ROBOTS DESTROYED</span>
            <span className="text-white">{result.kills}</span>
            <span>DATA SHARDS</span>
            <span className="text-cyan-300">
              {result.shards} / {result.shardsTotal}
            </span>
            <span>DAMAGE TAKEN</span>
            <span className="text-white">{result.damageTaken}</span>
            <span>SHIFT CORES</span>
            <span className="text-amber-300">◆ +{result.cores}</span>
            <span>SCORE</span>
            <span className="text-white">{score.toLocaleString()}</span>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {result.levelId < LEVELS.length && <Button onClick={() => runtime.nextLevel()}>NEXT LEVEL{enter}</Button>}
            <Button variant="ghost" onClick={start}>
              REPLAY
            </Button>
            <Button variant="ghost" onClick={() => setScreen("upgrades")}>
              SHIFT LAB · ◆ {cores}
            </Button>
            <Button variant="ghost" onClick={() => runtime.quitToMenu()}>
              MENU
            </Button>
          </div>
        </div>
      )}

      {status === "gameover" && mode !== "campaign" && (
        <div className="my-auto flex flex-col items-center gap-3 text-center short:gap-1.5">
          <h2 className="font-display text-3xl font-black tracking-widest text-red-500 sm:text-5xl short:text-3xl">GAME OVER</h2>
          <p className="font-display text-sm text-gray-300 sm:text-lg short:text-sm">
            You survived to wave <span className="text-white">{wave}</span>
          </p>
          <div className="font-display text-4xl font-black text-white sm:text-6xl short:text-4xl">{score.toLocaleString()}</div>
          {score > 0 && score >= highScore ? (
            <div className="font-display text-sm font-bold text-yellow-300">★ NEW HIGH SCORE ★</div>
          ) : (
            <div className="font-display text-xs text-gray-400">BEST {highScore.toLocaleString()}</div>
          )}
          <div className="font-display text-sm font-bold text-amber-300">◆ +{runCores} SHIFT CORES (total {cores})</div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={start}>PLAY AGAIN{enter}</Button>
            <Button variant="ghost" onClick={() => setScreen("upgrades")}>
              SHIFT LAB
            </Button>
            <Button variant="ghost" onClick={() => runtime.quitToMenu()}>
              MENU
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
