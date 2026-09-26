"use client";

import { Bloom, EffectComposer, Vignette } from "@react-three/postprocessing";
import type { QualityPreset } from "@/game/quality";

/**
 * Bloom only on Medium/High (never mounted on Low). Only colours above 1.0 bloom — the neon,
 * windows, projectiles and alien glow parts use unlit, non-tone-mapped materials for that.
 */
export function PostFx({ preset }: { preset: QualityPreset }) {
  const multisampling = preset.antialias ? 4 : 0;
  if (preset.vignette) {
    return (
      <EffectComposer multisampling={multisampling}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={1} luminanceSmoothing={0.25} />
        <Vignette offset={0.3} darkness={0.65} />
      </EffectComposer>
    );
  }
  return (
    <EffectComposer multisampling={multisampling}>
      <Bloom mipmapBlur intensity={0.75} luminanceThreshold={1} luminanceSmoothing={0.25} />
    </EffectComposer>
  );
}
