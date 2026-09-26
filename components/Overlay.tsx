"use client";

import { ALIEN_ORDER, FORMS } from "@/game/forms";
import type { GameEngine } from "@/game/engine";
import type { HudState } from "@/game/types";
import { AlienBadge } from "./Hud";

function Button({ children, onClick, variant = "primary" }: { children: React.ReactNode; onClick: () => void; variant?: "primary" | "ghost" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        variant === "primary"
          ? "watch-glow rounded-full bg-green-500 px-6 py-2 font-display text-sm font-black tracking-widest text-black transition hover:bg-green-400 sm:px-8 sm:py-3 sm:text-base"
          : "rounded-full border border-white/30 px-5 py-2 font-display text-xs font-bold tracking-widest text-white transition hover:bg-white/10 sm:text-sm"
      }
    >
      {children}
    </button>
  );
}

export default function Overlay({ hud, engine }: { hud: HudState; engine: GameEngine }) {
  if (hud.status === "playing") return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm">
      {hud.status === "menu" && (
        <div className="flex max-w-3xl flex-col items-center gap-3 text-center sm:gap-5">
          <div>
            <h1 className="bg-linear-to-b from-green-300 to-green-600 bg-clip-text font-display text-3xl font-black tracking-widest text-transparent sm:text-6xl">
              ALIEN SHIFT
            </h1>
            <p className="mt-1 text-xs text-gray-300 sm:text-base">
              Robots are invading the city. Slam the Shiftwatch, pick an alien, and hold the line.
            </p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {ALIEN_ORDER.map((id, i) => {
              const f = FORMS[id];
              return (
                <div key={id} className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-2 sm:p-3">
                  <AlienBadge id={id} size={36} />
                  <div className="font-display text-xs font-bold sm:text-sm" style={{ color: f.accent }}>
                    {i + 1}. {f.name}
                  </div>
                  <div className="text-[10px] text-gray-400">{f.title}</div>
                  <p className="hidden text-[11px] leading-snug text-gray-300 sm:block">{f.blurb}</p>
                  <div className="text-[10px] text-gray-400">
                    J: {f.attackLabel} · K: {f.specialLabel}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="max-w-xl text-[11px] text-gray-400 sm:text-xs">
            Transforming drains the watch. If it runs dry you&apos;re stuck as Kai until it recharges — time your
            transformations! Every 5th wave a boss attacks.
          </p>
          <Button onClick={() => engine.startGame()}>START · ENTER</Button>
        </div>
      )}

      {hud.status === "paused" && (
        <div className="flex flex-col items-center gap-4">
          <h2 className="font-display text-3xl font-black tracking-widest text-white sm:text-5xl">PAUSED</h2>
          <div className="flex gap-3">
            <Button onClick={() => engine.togglePause()}>RESUME</Button>
            <Button variant="ghost" onClick={() => engine.startGame()}>
              RESTART
            </Button>
            <Button variant="ghost" onClick={() => engine.toggleMute()}>
              {hud.muted ? "UNMUTE" : "MUTE"}
            </Button>
          </div>
        </div>
      )}

      {hud.status === "gameover" && (
        <div className="flex flex-col items-center gap-3 text-center">
          <h2 className="font-display text-3xl font-black tracking-widest text-red-500 sm:text-5xl">GAME OVER</h2>
          <p className="font-display text-sm text-gray-300 sm:text-lg">
            You survived to wave <span className="text-white">{hud.wave}</span>
          </p>
          <div className="font-display text-4xl font-black text-white sm:text-6xl">{hud.score.toLocaleString()}</div>
          {hud.score > 0 && hud.score >= hud.highScore ? (
            <div className="font-display text-sm font-bold text-yellow-300">★ NEW HIGH SCORE ★</div>
          ) : (
            <div className="font-display text-xs text-gray-400">BEST {hud.highScore.toLocaleString()}</div>
          )}
          <Button onClick={() => engine.startGame()}>PLAY AGAIN · ENTER</Button>
        </div>
      )}
    </div>
  );
}
