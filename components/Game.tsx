"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { loadModelManifest } from "@/game/platform/assets";
import { initPwa } from "@/game/platform/pwa";
import { startViewportTracking, useTouchUi, useViewport } from "@/game/platform/viewport";
import { GameRuntime } from "@/game/runtime";
import { useGameStore } from "@/game/store";
import FpsCounter from "./FpsCounter";
import FxOverlay from "./FxOverlay";
import { RotateHint } from "./MobileControls";
import Hud from "./Hud";
import MobileDebug from "./MobileDebug";
import Overlay, { LevelSelect, SettingsScreen } from "./Overlay";
import TouchControls from "./TouchControls";
import UpgradeScreen from "./UpgradeScreen";
import WatchWheel from "./WatchWheel";

// three.js / WebGL only exist in the browser, so the 3D scene is never server-rendered.
const Scene = dynamic(() => import("./three/Scene"), { ssr: false });

function Loading({ error }: { error: string | null }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black">
      {error ? (
        <p className="max-w-md px-4 text-center text-sm text-red-400">Couldn&apos;t start the game engine: {error}</p>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="watch-glow h-10 w-10 animate-spin rounded-full border-4 border-green-500/30 border-t-green-400" />
          <p className="font-display text-xs tracking-[0.3em] text-green-300">CHARGING SHIFTWATCH…</p>
        </div>
      )}
    </div>
  );
}

export default function Game() {
  const [runtime, setRuntime] = useState<GameRuntime | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = useGameStore((s) => s.hud.status);
  const screen = useGameStore((s) => s.screen);
  const touch = useTouchUi();
  const { portrait } = useViewport();

  useEffect(() => startViewportTracking(), []);

  // Phone turned upright mid-run: pause behind the "rotate your phone" screen.
  useEffect(() => {
    if (touch && portrait && runtime && runtime.sim.status === "playing") runtime.togglePause();
  }, [touch, portrait, runtime]);

  useEffect(() => {
    let alive = true;
    let created: GameRuntime | null = null;
    void useGameStore.getState().hydrate();
    initPwa();
    void loadModelManifest().then((models) => useGameStore.getState().setModels(models));
    GameRuntime.create()
      .then((rt) => {
        // React StrictMode mounts effects twice in dev: throw away a runtime that arrives too late.
        if (!alive) return rt.destroy();
        created = rt;
        setRuntime(rt);
        // Opt-in debugging handle (only when built with NEXT_PUBLIC_DEBUG_HOOK=1): window.__alienShift.sim …
        if (process.env.NEXT_PUBLIC_DEBUG_HOOK === "1") (window as unknown as { __alienShift?: GameRuntime }).__alienShift = rt;
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
      created?.destroy();
      setRuntime(null);
    };
  }, []);

  return (
    // `game-frame` sizes the 16:9 view to fit both width and height, so it never scrolls on a landscape phone.
    // Layers: canvas (0) → effects (1) → HUD (10) → touch controls (20) → menus (30) → screens (40) → rotate hint (100).
    <div
      className="game-frame relative isolate aspect-video overflow-hidden rounded-xl border border-green-500/30 bg-black shadow-[0_0_60px_-10px_#22c55e55]"
      // No long-press menu / image drag inside the game.
      onContextMenu={(e) => e.preventDefault()}
    >
      {runtime ? (
        <>
          <Scene runtime={runtime} />
          <FxOverlay />
          {status === "playing" && <TouchControls runtime={runtime} />}
          {status !== "menu" && <Hud runtime={runtime} />}
          <Overlay runtime={runtime} />
          {status === "playing" && <WatchWheel runtime={runtime} />}
          {screen === "upgrades" && status !== "playing" && <UpgradeScreen />}
          {screen === "settings" && status !== "playing" && <SettingsScreen />}
          {screen === "levels" && status !== "playing" && <LevelSelect runtime={runtime} />}
        </>
      ) : (
        <Loading error={error} />
      )}
      <FpsCounter />
      {process.env.NODE_ENV === "development" && <MobileDebug />}
      <RotateHint />
    </div>
  );
}
