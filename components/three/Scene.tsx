"use client";

import { Canvas } from "@react-three/fiber";
import { QUALITY_PRESETS } from "@/game/quality";
import type { GameRuntime } from "@/game/runtime";
import { useGameStore } from "@/game/store";
import { Arena } from "./Arena";
import { Boss } from "./Boss";
import { CameraRig } from "./CameraRig";
import { BlobShadows, CombatEffects, Particles } from "./Effects";
import { Enemies } from "./Enemies";
import { Environment } from "./Environment";
import { FloatingTextsDriver, FrameDriver } from "./FrameDriver";
import { PlayerView } from "./PlayerView";
import { PostFx } from "./PostFx";
import { Pickups, Projectiles } from "./Projectiles";
import { RuntimeContext } from "./runtime-context";

/**
 * The 3D view. It only *reads* the simulation (via the runtime) — all game logic lives in
 * game/core. Changing the quality remounts the canvas (key) so shadow/AA settings apply cleanly.
 */
export default function Scene({ runtime }: { runtime: GameRuntime }) {
  const quality = useGameStore((s) => s.settings.quality);
  const preset = QUALITY_PRESETS[quality];

  return (
    <Canvas
      key={quality}
      style={{ position: "absolute", inset: 0 }}
      dpr={[1, preset.dpr]}
      // "percentage" = PCF shadows (three r186 removed PCFSoft; High softens via shadow.radius instead).
      shadows={preset.shadows === "none" ? false : "percentage"}
      // With post-processing on, anti-aliasing is done by the composer instead of the canvas.
      gl={{ antialias: preset.antialias && !preset.bloom, powerPreference: "high-performance", stencil: false }}
      camera={{ fov: 50, near: 0.5, far: 130, position: [0, 11, 14] }}
    >
      <RuntimeContext.Provider value={runtime}>
        <FrameDriver />
        <CameraRig />
        <Environment preset={preset} />
        <Arena preset={preset} />
        <PlayerView />
        <Enemies />
        <Boss />
        <Projectiles />
        <Pickups />
        <Particles />
        <CombatEffects />
        {preset.shadows === "none" && <BlobShadows />}
        <FloatingTextsDriver />
        {preset.bloom && <PostFx preset={preset} />}
      </RuntimeContext.Provider>
    </Canvas>
  );
}
