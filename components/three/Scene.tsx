"use client";

import { Canvas } from "@react-three/fiber";
import { levelById } from "@/game/core/levels";
import { QUALITY_PRESETS } from "@/game/quality";
import type { GameRuntime } from "@/game/runtime";
import { useGameStore } from "@/game/store";
import { AimResolver } from "./AimResolver";
import { Arena } from "./Arena";
import { CameraRig } from "./CameraRig";
import { BlobShadows, CombatEffects, Particles } from "./Effects";
import { Enemies } from "./Enemies";
import { Environment } from "./Environment";
import { FloatingTextsDriver, FrameDriver } from "./FrameDriver";
import { HunterBoss } from "./HunterBoss";
import { BossAura, OmegaBoss } from "./OmegaBoss";
import { PlayerView } from "./PlayerView";
import { PostFx } from "./PostFx";
import { Pickups, Projectiles } from "./Projectiles";
import { RuntimeContext } from "./runtime-context";
import { SpiderBoss } from "./SpiderBoss";
import { VexxBoss } from "./VexxBoss";
import { Zones } from "./Zones";

/**
 * The 3D view. It only *reads* the simulation (via the runtime) — all game logic lives in
 * game/core. Changing the quality remounts the canvas (key) so shadow/AA settings apply cleanly.
 */
export default function Scene({ runtime }: { runtime: GameRuntime }) {
  const quality = useGameStore((s) => s.settings.quality);
  const preset = QUALITY_PRESETS[quality];
  // The arena/theme only changes when a run starts (mode + level).
  const mode = useGameStore((s) => s.hud.mode);
  const level = useGameStore((s) => s.hud.level);
  const theme = mode === "campaign" && level > 0 ? levelById(level).theme : "city";
  const layoutKey = mode === "campaign" ? `level-${level}` : "city";

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
        <AimResolver />
        <Environment preset={preset} theme={theme} />
        <Arena key={layoutKey} preset={preset} theme={theme} seed={level + 3} />
        <PlayerView />
        <Enemies />
        <VexxBoss />
        <SpiderBoss />
        <HunterBoss />
        <OmegaBoss />
        <BossAura />
        <Zones />
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
