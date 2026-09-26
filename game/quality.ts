export type Quality = "low" | "medium" | "high";
export const QUALITY_LEVELS: Quality[] = ["low", "medium", "high"];

export interface QualityPreset {
  /** Max device pixel ratio — the biggest single lever for GPU cost. */
  dpr: number;
  antialias: boolean;
  shadows: "none" | "basic" | "soft";
  shadowMapSize: number;
  bloom: boolean;
  vignette: boolean;
  /** Particle cap and burst density multiplier. */
  particles: number;
  particleDensity: number;
  /** Fog end distance: shorter fog hides (and lets us skip) the distant skyline. */
  fogFar: number;
  /** Draw the far background skyline and extra decoration. */
  skyline: boolean;
}

/*
 * Low must hold ~60 fps on integrated graphics and cheap Android phones:
 * DPR 1, no shadows (blob shadows instead), no post-processing, fewer particles, short fog.
 */
export const QUALITY_PRESETS: Record<Quality, QualityPreset> = {
  low: { dpr: 1, antialias: false, shadows: "none", shadowMapSize: 0, bloom: false, vignette: false, particles: 300, particleDensity: 0.5, fogFar: 42, skyline: false },
  medium: { dpr: 1.5, antialias: false, shadows: "basic", shadowMapSize: 1024, bloom: true, vignette: false, particles: 800, particleDensity: 0.8, fogFar: 60, skyline: true },
  high: { dpr: 2, antialias: true, shadows: "soft", shadowMapSize: 2048, bloom: true, vignette: true, particles: 1500, particleDensity: 1, fogFar: 75, skyline: true },
};
