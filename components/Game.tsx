"use client";

import { useEffect, useRef, useState } from "react";
import { GameEngine } from "@/game/engine";
import { setDisplayFont } from "@/game/render";
import { useGameStore } from "@/game/store";
import Hud from "./Hud";
import Overlay from "./Overlay";
import TouchControls from "./TouchControls";

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const status = useGameStore((s) => s.hud.status);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    void useGameStore.getState().hydrate();
    setDisplayFont(getComputedStyle(document.documentElement).getPropertyValue("--font-orbitron"));
    const instance = new GameEngine(canvas);
    instance.start();
    setEngine(instance);
    return () => {
      instance.destroy();
      setEngine(null);
    };
  }, []);

  return (
    // `game-frame` sizes the 16:9 view to fit both width and height, so it never scrolls on a landscape phone.
    <div className="game-frame relative aspect-video overflow-hidden rounded-xl border border-green-500/30 bg-black shadow-[0_0_60px_-10px_#22c55e55]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="Alien Shift game canvas" />
      {engine && status !== "menu" && <Hud engine={engine} />}
      {engine && status === "playing" && <TouchControls engine={engine} />}
      {engine && <Overlay engine={engine} />}
    </div>
  );
}
