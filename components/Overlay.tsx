"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ALIEN_ORDER, FORMS, slotKey } from "@/game/core/forms";
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
  const { status, score, wave, runCores } = useGameStore(useShallow((s) => ({ status: s.hud.status, score: s.hud.score, wave: s.hud.wave, runCores: s.hud.runCores })));
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
              Robots are invading the city. Slam the Shiftwatch, pick an alien, and hold the line.
            </p>
          </div>
          <AlienStrip compact={touch} />
          <p className="max-w-xl text-[11px] text-gray-300 [text-shadow:0_1px_3px_#000] sm:text-xs short:hidden">
            {touch
              ? "Drag the left side to move. ATK = combo (hold for heavy), SP = special, ULT = ultimate, ROLL = dodge, ⌚ = all aliens."
              : "Tap J for combos, hold J for heavy hits, Shift to dodge, L for your ultimate, Tab for the watch wheel."}{" "}
            The watch drains while you&apos;re an alien. Bosses attack every 5th wave. Collect Shift Cores to unlock and upgrade aliens.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 short:gap-2">
            <Button onClick={start}>START{enter}</Button>
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
            <Button variant="ghost" onClick={() => runtime.toggleMute()}>
              {muted ? "UNMUTE" : "MUTE"}
            </Button>
            <FullscreenButton className="h-9 w-9" />
          </div>
          <QualityPicker />
          <CinematicToggle />
        </div>
      )}

      {status === "gameover" && (
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
          </div>
        </div>
      )}
    </div>
  );
}
