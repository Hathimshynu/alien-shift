"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { AdditiveBlending, CircleGeometry, CylinderGeometry, DoubleSide, MeshStandardMaterial, PlaneGeometry, type BufferGeometry } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { ARENA, PLATFORMS, SOLIDS } from "@/game/core/arena";
import type { ThemeId } from "@/game/core/levels";
import type { QualityPreset } from "@/game/quality";
import { GeometryBatch, getRadialTexture, mulberry32 } from "./geometry";
import { useRuntime } from "./runtime-context";
import { buildThemeArena } from "./ThemeArena";
import { THEMES } from "./themes";

const NEON = ["#ff2bd6", "#22d3ee", "#22c55e", "#fb923c", "#a855f7", "#facc15"];
const BUILDING_COLORS = ["#1e1b4b", "#231942", "#2e1065", "#1f2937", "#172554"];
const WINDOW_COLORS = ["#fde68a", "#fcd34d", "#a5f3fc", "#f9a8d4"];
const LAMPS: [number, number][] = [
  [-18, 12.2],
  [-6, 12.2],
  [6, 12.2],
  [18, 12.2],
  [-15, -12.3],
  [0, -12.3],
  [15, -12.3],
];

interface ArenaGeometry {
  solid: BufferGeometry;
  /** Platform slabs live in their own mesh so they can fade out when the player is underneath. */
  slabs: BufferGeometry;
  glow: BufferGeometry;
  pools: BufferGeometry;
  barrier: BufferGeometry;
}

/**
 * Builds the whole static street procedurally: one merged "solid" mesh (lit), one merged "glow"
 * mesh (unlit neon/windows/lamps that bloom on Medium/High), soft light pools and the end barriers.
 */
function buildArena(skyline: boolean): ArenaGeometry {
  const rnd = mulberry32(7);
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const solid = new GeometryBatch();
  const slabs = new GeometryBatch();
  const glow = new GeometryBatch();

  // Street, sidewalks and curbs (visual only — the physics street is a flat plane at y = 0).
  solid.decal(240, 60, "#16141f", 0, 0, 0);
  solid.box(240, 0.12, 4, "#2a2838", 0, 0, -13.5);
  solid.box(240, 0.12, 4, "#2a2838", 0, 0, 13.2);
  solid.box(240, 0.16, 0.25, "#3f3d52", 0, 0, -11.45);
  solid.box(240, 0.16, 0.25, "#3f3d52", 0, 0, 11.2);
  // Lane dashes and the glowing arena edge lines.
  for (let x = -110; x < 110; x += 5) glow.decal(2.4, 0.18, "#eab308", x, 0.015, 0, 0.8);
  glow.decal(240, 0.08, "#22c55e", 0, 0.02, ARENA.minZ + 0.05, 0.9);
  glow.decal(240, 0.08, "#22c55e", 0, 0.02, ARENA.maxZ - 0.05, 0.9);
  // Crosswalks near both barriers.
  for (const cx of [-17, 17]) for (let z = -9; z <= 9; z += 1.5) glow.decal(2.2, 0.7, "#d4d4d8", cx, 0.012, z, 0.35);

  // Back row of buildings with lit windows and neon signs.
  let x = -70;
  while (x < 70) {
    const w = 5 + rnd() * 6;
    const h = 8 + rnd() * 18;
    const d = 8;
    const z = -15.5 - d / 2 - rnd() * 1.5;
    const front = z + d / 2;
    solid.box(w, h, d, pick(BUILDING_COLORS), x + w / 2, 0, z);
    // Ground-floor shopfront glow strip.
    glow.quad(w * 0.8, 0.25, pick(NEON), x + w / 2, 3.1, front + 0.03, 0, 1.8);
    for (let wy = 4.2; wy < h - 1; wy += 1.9) {
      for (let wx = x + 0.9; wx < x + w - 0.9; wx += 1.3) {
        if (rnd() < 0.36) glow.quad(0.7, 1.05, pick(WINDOW_COLORS), wx + 0.35, wy, front + 0.02, 0, 0.55 + rnd() * 0.5);
      }
    }
    if (rnd() < 0.55) {
      const c = pick(NEON);
      if (rnd() < 0.5) {
        // Horizontal sign with a frame.
        const sw = Math.min(w - 1, 2.5 + rnd() * 2);
        const sy = 4.5 + rnd() * Math.max(1, h - 8);
        solid.box(sw + 0.3, 1.3, 0.2, "#0b0b12", x + w / 2, sy - 0.65, front + 0.1);
        glow.quad(sw, 0.18, c, x + w / 2, sy + 0.4, front + 0.22, 0, 2.6);
        glow.quad(sw, 0.18, c, x + w / 2, sy - 0.4, front + 0.22, 0, 2.6);
        glow.quad(sw * 0.6, 0.35, pick(NEON), x + w / 2, sy, front + 0.22, 0, 2.2);
      } else {
        // Vertical blade sign sticking out from the facade.
        const sh = 3 + rnd() * 3;
        const sx = x + (rnd() < 0.5 ? 0.6 : w - 0.6);
        solid.box(0.15, sh, 1.2, "#0b0b12", sx, 5, front + 0.6);
        glow.add(new PlaneGeometry(1, sh - 0.4), c, [sx + 0.09, 5 + sh / 2, front + 0.6], Math.PI / 2, 2.6);
        glow.add(new PlaneGeometry(1, sh - 0.4), c, [sx - 0.09, 5 + sh / 2, front + 0.6], -Math.PI / 2, 2.6);
      }
    }
    // Rooftop warning light.
    if (rnd() < 0.3) glow.box(0.25, 0.25, 0.25, "#ef4444", x + w / 2, h, z, 0, 2);
    x += w + 0.4 + rnd() * 1.2;
  }

  // Low front details (the camera looks from this side, so nothing tall here).
  for (let fx = -60; fx < 60; fx += 3.2) solid.box(0.12, 0.9, 0.12, "#4b5563", fx, 0.12, 14.8);
  solid.box(120, 0.08, 0.08, "#6b7280", 0, 0.95, 14.8);

  // Far skyline silhouettes (skipped on Low — the shorter fog hides that distance anyway).
  if (skyline) {
    for (let sx = -90; sx < 90; sx += 6 + rnd() * 6) {
      const h = 20 + rnd() * 35;
      solid.box(6 + rnd() * 5, h, 6, "#0f0d24", sx, 0, -45 - rnd() * 15);
      for (let k = 0; k < 6; k++) glow.quad(0.8, 1.1, pick(WINDOW_COLORS), sx + rnd() * 4 - 2, 5 + rnd() * (h - 8), -41.9, 0, 0.5);
    }
  }

  // Street lamps.
  for (const [lx, lz] of LAMPS) {
    const dir = lz > 0 ? -1 : 1; // arm reaches over the street
    solid.cylinder(0.1, 5.2, "#374151", lx, 0, lz);
    solid.box(0.12, 0.12, 1.4, "#374151", lx, 5.1, lz + dir * 0.7);
    glow.box(0.5, 0.12, 0.35, "#fde68a", lx, 4.98, lz + dir * 1.3, 0, 3);
  }

  // Scaffold platforms: slab + neon edge + posts down to the street.
  for (const p of PLATFORMS) {
    const top = p.y + p.h;
    slabs.box(p.w, p.h, p.d, "#334155", p.x, p.y, p.z);
    glow.box(p.w, 0.06, 0.06, "#22c55e", p.x, top - 0.03, p.z + p.d / 2, 0, 2.2);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) solid.box(0.18, p.y, 0.18, "#475569", p.x + sx * (p.w / 2 - 0.2), 0, p.z + sz * (p.d / 2 - 0.2));
      solid.box(0.1, 0.1, p.d, "#475569", p.x + sx * (p.w / 2 - 0.2), p.y * 0.5, p.z); // cross brace
    }
  }
  // Billboard standing on the rooftop (decoration only).
  const roof = PLATFORMS[2];
  const roofTop = roof.y + roof.h;
  solid.box(0.2, 3, 0.2, "#475569", roof.x - 3, roofTop, roof.z - 1.7);
  solid.box(0.2, 3, 0.2, "#475569", roof.x + 3, roofTop, roof.z - 1.7);
  solid.box(8, 2.6, 0.25, "#0b0b12", roof.x, roofTop + 2.2, roof.z - 1.8);
  glow.quad(7.4, 2.1, "#16a34a", roof.x, roofTop + 3.5, roof.z - 1.66, 0, 1.2);
  glow.quad(3, 0.35, "#dcfce7", roof.x - 1.2, roofTop + 3.9, roof.z - 1.64, 0, 2.2);
  glow.quad(4.6, 0.3, "#dcfce7", roof.x - 0.4, roofTop + 3.2, roof.z - 1.64, 0, 1.6);

  // Cover: cars and crates (match the physics boxes in SOLIDS).
  for (const b of SOLIDS) {
    if (b.kind === "car") {
      solid.box(b.w, 0.75, b.d, b.color, b.x, 0.3, b.z);
      solid.box(b.w * 0.52, 0.5, b.d * 0.9, "#111827", b.x - 0.2, 1.05, b.z); // cabin + dark glass
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid.add(new CylinderGeometry(0.36, 0.36, 0.25, 10), "#0a0a0a", [b.x + sx * b.w * 0.32, 0.36, b.z + sz * (b.d / 2)], 0, 1, Math.PI / 2);
      for (const sz of [-1, 1]) {
        glow.box(0.05, 0.14, 0.35, "#fef9c3", b.x + b.w / 2 + 0.01, 0.75, b.z + sz * 0.6, 0, 2.5);
        glow.box(0.05, 0.12, 0.3, "#ef4444", b.x - b.w / 2 - 0.01, 0.8, b.z + sz * 0.6, 0, 2.2);
      }
    } else {
      solid.box(b.w, b.h, b.d, b.color, b.x, b.y, b.z);
      // Darker frame bands so crates read as crates.
      solid.box(b.w + 0.02, 0.1, b.d + 0.02, "#451a03", b.x, b.y + b.h - 0.1, b.z);
      solid.box(b.w + 0.02, 0.1, b.d + 0.02, "#451a03", b.x, b.y, b.z);
    }
  }

  // Energy barriers at the street ends (robots walk through them; Kai can't).
  const barrier = new GeometryBatch();
  for (const bx of [ARENA.minX - 0.4, ARENA.maxX + 0.4]) {
    barrier.quad(ARENA.maxZ - ARENA.minZ, 1.3, "#22c55e", bx, 0.65, 0, Math.PI / 2, 1.2);
    for (let z = ARENA.minZ; z <= ARENA.maxZ; z += 2.75) solid.box(0.25, 1.5, 0.25, "#1f2937", bx, 0, z);
    for (let z = ARENA.minZ; z <= ARENA.maxZ; z += 2.75) glow.box(0.27, 0.12, 0.27, "#22c55e", bx, 1.5, z, 0, 2.5);
  }

  // Soft light pools under the lamps (these keep their UVs for the radial alpha texture).
  const pools = mergeGeometries(
    LAMPS.map(([lx, lz]) => {
      const g = new CircleGeometry(3.4, 24);
      g.rotateX(-Math.PI / 2);
      g.translate(lx, 0.03, lz + (lz > 0 ? -1.3 : 1.3));
      return g;
    }),
  );
  if (!pools) throw new Error("light pools merge failed");

  return { solid: solid.build(), slabs: slabs.build(), glow: glow.build(), pools, barrier: barrier.build() };
}

/** True when a slab sits between the (high, front) camera and the player: under it or just behind it. */
function playerHiddenBySlab(x: number, y: number, z: number) {
  return PLATFORMS.some((p) => {
    const top = p.y + p.h;
    return y < top - 0.1 && Math.abs(x - p.x) < p.w / 2 + 0.6 && z < p.z + p.d / 2 + 0.6 && z > p.z - p.d / 2 - top * 1.4;
  });
}

/** A campaign level's arena (see ThemeArena.ts); no street-lamp light pools there. */
function buildLevelArena(theme: ThemeId, skyline: boolean, seed: number): ArenaGeometry {
  const t = buildThemeArena(theme, THEMES[theme], skyline, seed);
  const pools = new CircleGeometry(0.01, 3);
  pools.rotateX(-Math.PI / 2);
  pools.translate(0, -5, 0);
  return { solid: t.solid.build(), slabs: t.slabs.build(), glow: t.glow.build(), pools, barrier: t.barrier.build() };
}

/**
 * The static world. Endless mode is the neon city street; each campaign level has its own theme.
 * The parent remounts this (key) whenever the layout changes, so geometry is rebuilt once per level.
 */
export function Arena({ preset, theme = "city", seed = 7 }: { preset: QualityPreset; theme?: ThemeId; seed?: number }) {
  const runtime = useRuntime();
  const geo = useMemo(() => (theme === "city" ? buildArena(preset.skyline) : buildLevelArena(theme, preset.skyline, seed)), [preset.skyline, theme, seed]);
  const castShadows = preset.shadows !== "none";
  const slabMat = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.1, transparent: true }), []);

  useFrame((_, dt) => {
    const p = runtime.sim.player;
    const target = playerHiddenBySlab(p.x, p.y, p.z) ? 0.25 : 1;
    slabMat.opacity += (target - slabMat.opacity) * (1 - Math.exp(-10 * dt));
    // A see-through slab must not write depth, or it would still hide the player behind it.
    slabMat.depthWrite = slabMat.opacity > 0.95;
  });

  return (
    <group>
      <mesh geometry={geo.solid} receiveShadow={castShadows} castShadow={castShadows}>
        <meshStandardMaterial vertexColors roughness={0.85} metalness={0.1} />
      </mesh>
      <mesh geometry={geo.slabs} material={slabMat} receiveShadow={castShadows} castShadow={castShadows} />
      {/* Unlit + not tone-mapped: colours above 1.0 feed the bloom pass on Medium/High. */}
      <mesh geometry={geo.glow}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>
      <mesh geometry={geo.pools}>
        <meshBasicMaterial
          color="#fcd34d"
          alphaMap={getRadialTexture()}
          transparent
          opacity={0.22}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={geo.barrier}>
        <meshBasicMaterial vertexColors transparent opacity={0.22} blending={AdditiveBlending} depthWrite={false} side={DoubleSide} toneMapped={false} />
      </mesh>
    </group>
  );
}
