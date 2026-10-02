import type { ThemeId } from "@/game/core/levels";

/** Look of each environment: sky, fog, lights and the colours the arena builder uses. */
export interface ThemeLook {
  fog: string;
  sky: [top: string, mid: string, horizon: string];
  stars: boolean;
  /** Big moon / planet in the sky (null = none). */
  planet: { color: string; size: number; pos: [number, number, number] } | null;
  hemi: [sky: string, ground: string, intensity: number];
  sun: [color: string, intensity: number];
  rim: [color: string, intensity: number];
  ground: string;
  /** Glowing accent (edge lines, platform trims, signs). */
  accent: string;
  slab: string;
}

export const THEMES: Record<ThemeId, ThemeLook> = {
  city: {
    fog: "#140c2e", sky: ["#04030f", "#1e1b4b", "#4c1d95"], stars: true, planet: { color: "#e0e7ff", size: 4, pos: [30, 38, -70] },
    hemi: ["#8b93ff", "#2a1a44", 1.25], sun: ["#b4c0ff", 1.3], rim: ["#ff4fd8", 0.45], ground: "#16141f", accent: "#22c55e", slab: "#334155",
  },
  crash: {
    fog: "#2a130b", sky: ["#0c0604", "#3b1a0e", "#9a3412"], stars: true, planet: { color: "#fed7aa", size: 6, pos: [-35, 30, -70] },
    hemi: ["#fdba74", "#3b1d12", 1.15], sun: ["#ffd8a8", 1.4], rim: ["#f97316", 0.6], ground: "#2b211c", accent: "#fb923c", slab: "#44403c",
  },
  ruins: {
    fog: "#1d2a2a", sky: ["#061212", "#134e4a", "#5eead4"], stars: false, planet: { color: "#ccfbf1", size: 9, pos: [25, 30, -75] },
    hemi: ["#99f6e4", "#3f3a2a", 1.3], sun: ["#fef3c7", 1.5], rim: ["#2dd4bf", 0.5], ground: "#57534e", accent: "#2dd4bf", slab: "#78716c",
  },
  colony: {
    fog: "#1b2433", sky: ["#0b1020", "#1e3a5f", "#64748b"], stars: true, planet: { color: "#bfdbfe", size: 7, pos: [-30, 32, -72] },
    hemi: ["#bae6fd", "#24303f", 1.3], sun: ["#e0f2fe", 1.4], rim: ["#38bdf8", 0.45], ground: "#334155", accent: "#38bdf8", slab: "#475569",
  },
  facility: {
    fog: "#05070b", sky: ["#020304", "#0b0f16", "#111827"], stars: false, planet: null,
    hemi: ["#64748b", "#0b0f16", 0.55], sun: ["#cbd5e1", 0.55], rim: ["#ef4444", 0.6], ground: "#111827", accent: "#ef4444", slab: "#1f2937",
  },
  hive: {
    fog: "#1f0a2e", sky: ["#09030f", "#3b0764", "#86198f"], stars: false, planet: { color: "#f0abfc", size: 5, pos: [28, 35, -70] },
    hemi: ["#e879f9", "#2e1037", 1.1], sun: ["#f5d0fe", 1.1], rim: ["#d946ef", 0.7], ground: "#2e1065", accent: "#d946ef", slab: "#4c1d95",
  },
  frozen: {
    fog: "#b6c8dc", sky: ["#1e3a5f", "#7dd3fc", "#e0f2fe"], stars: false, planet: { color: "#ffffff", size: 5, pos: [-20, 40, -70] },
    hemi: ["#e0f2fe", "#94a3b8", 1.5], sun: ["#ffffff", 1.6], rim: ["#a5f3fc", 0.5], ground: "#dbeafe", accent: "#38bdf8", slab: "#93c5fd",
  },
  desert: {
    fog: "#c08a52", sky: ["#3b82f6", "#fbbf24", "#fde68a"], stars: false, planet: { color: "#fff7ed", size: 7, pos: [30, 40, -70] },
    hemi: ["#fde68a", "#7c4a1e", 1.5], sun: ["#fff1d6", 1.8], rim: ["#fb923c", 0.35], ground: "#c2925a", accent: "#f59e0b", slab: "#92400e",
  },
  station: {
    fog: "#05060f", sky: ["#000000", "#05061a", "#1e1b4b"], stars: true, planet: { color: "#60a5fa", size: 22, pos: [40, 10, -85] },
    hemi: ["#a5b4fc", "#111827", 1.1], sun: ["#e0e7ff", 1.3], rim: ["#22d3ee", 0.6], ground: "#1e293b", accent: "#22d3ee", slab: "#334155",
  },
  fortress: {
    fog: "#1a0a0a", sky: ["#050101", "#3f0d0d", "#7f1d1d"], stars: true, planet: { color: "#fecaca", size: 8, pos: [-25, 34, -72] },
    hemi: ["#fca5a5", "#1f0f0f", 1.05], sun: ["#fee2e2", 1.2], rim: ["#ef4444", 0.7], ground: "#27272a", accent: "#ef4444", slab: "#3f3f46",
  },
  dimension: {
    fog: "#0c0418", sky: ["#000000", "#2e1065", "#c026d3"], stars: true, planet: { color: "#f5d0fe", size: 12, pos: [0, 30, -80] },
    hemi: ["#c4b5fd", "#1e0b33", 1.15], sun: ["#ede9fe", 1.2], rim: ["#a855f7", 0.9], ground: "#120822", accent: "#a855f7", slab: "#3b0764",
  },
};
