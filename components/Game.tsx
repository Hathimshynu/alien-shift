"use client";

import { useEffect, useRef, useState } from "react";
import { GameEngine } from "@/game/engine";
import { setDisplayFont } from "@/game/render";
import type { HudState } from "@/game/types";
import Hud from "./Hud";
import Overlay from "./Overlay";
import TouchControls from "./TouchControls";

const INITIAL_HUD: HudState = {
  status: "menu",
  form: "human",
  hp: 100,
  maxHp: 100,
  energy: 100,
  watchLocked: false,
  wave: 0,
  score: 0,
  highScore: 0,
  combo: 0,
  enemiesLeft: 0,
  bossHp: null,
  muted: false,
  specialReady: false,
};

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [hud, setHud] = useState<HudState>(INITIAL_HUD);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setDisplayFont(getComputedStyle(document.documentElement).getPropertyValue("--font-orbitron"));
    const instance = new GameEngine(canvas, setHud);
    instance.start();
    setEngine(instance);
    return () => {
      instance.destroy();
      setEngine(null);
    };
  }, []);

  return (
    <div className="w-full max-w-[1200px]">
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-green-500/30 bg-black shadow-[0_0_60px_-10px_#22c55e55]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Alien Shift game canvas" />
        {engine && hud.status !== "menu" && <Hud hud={hud} engine={engine} />}
        {engine && <Overlay hud={hud} engine={engine} />}
      </div>
      {engine && hud.status === "playing" && <TouchControls engine={engine} />}
    </div>
  );
}
