"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode } from "react";
import {
  BoxGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  type BufferGeometry,
  type Group,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  SphereGeometry,
  TorusGeometry,
} from "three";
import type { ModelId } from "@/game/core/types";

// ───────────────────────────── shared geometry & materials ─────────────────────────────

/** Unit primitives shared by every rig (scaled per part), so all characters reuse a few buffers. */
export const GEO = {
  capsule: new CapsuleGeometry(0.5, 1, 4, 10), // 1 wide, 2 tall
  sphere: new SphereGeometry(1, 16, 12),
  box: new BoxGeometry(1, 1, 1),
  octa: new OctahedronGeometry(1, 0),
  cone: new ConeGeometry(1, 1, 8),
  hex: new CylinderGeometry(1, 1, 1, 6),
  dodeca: new DodecahedronGeometry(1, 0),
  torus: new TorusGeometry(1, 0.08, 8, 28),
};

const materials = new Map<string, Material>();

/** Lit material with a faint self-glow so characters stay readable on the dark street. */
export function solid(color: string, rough = 0.6, metal = 0.1, emissive = 0.1): Material {
  const key = `s${color}${rough}${metal}${emissive}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: new Color(color), emissiveIntensity: emissive });
    materials.set(key, m);
  }
  return m;
}

/** Unlit, not tone-mapped: blooms on Medium/High, still reads as "glowing" on Low. */
export function glow(color: string, intensity = 2.2): Material {
  const key = `g${color}${intensity}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity), toneMapped: false });
    materials.set(key, m);
  }
  return m;
}

export type V3 = [number, number, number];

export function Part({ geo, mat, p, s, r }: { geo: BufferGeometry; mat: Material; p?: V3; s?: V3 | number; r?: V3 }) {
  return <mesh geometry={geo} material={mat} position={p} scale={s} rotation={r} castShadow />;
}

/** The Shiftwatch emblem (original design): hexagonal bezel with a glowing diamond core. */
export function Emblem({ p, s, r }: { p: V3; s: number; r?: V3 }) {
  return (
    <group position={p} scale={s} rotation={r}>
      <Part geo={GEO.hex} mat={solid("#111827", 0.4, 0.2, 0)} r={[Math.PI / 2, 0, 0]} s={[1, 0.3, 1]} />
      <Part geo={GEO.octa} mat={glow("#22c55e", 3)} p={[0, 0, 0.16]} s={[0.5, 0.8, 0.12]} />
      <Part geo={GEO.box} mat={glow("#dcfce7", 3)} p={[0, 0, 0.27]} s={[0.2, 0.2, 0.05]} />
    </group>
  );
}

// ───────────────────────────── animated extras ─────────────────────────────

/** Fire crown that flickers every frame. */
function Flames({ y }: { y: number }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    group.current?.children.forEach((c, i) => {
      c.scale.y = c.userData.h * (1 + Math.sin(t * 17 + i * 2.1) * 0.18 + Math.sin(t * 29 + i) * 0.08);
    });
  });
  const cones: [number, number, number, number, string][] = [
    [0, 0.34, 0.14, 0, "#f97316"],
    [-0.09, 0.24, 0.1, 0.05, "#fb923c"],
    [0.09, 0.26, 0.1, -0.04, "#fb923c"],
    [0, 0.2, 0.08, 0.08, "#fde047"],
  ];
  return (
    <group ref={group} position-y={y}>
      {cones.map(([x, h, r, z, c], i) => (
        <mesh key={i} geometry={GEO.cone} material={glow(c, 2.4)} position={[x, h / 2, z]} scale={[r, h, r]} userData={{ h }} />
      ))}
    </group>
  );
}

/** Rocks orbiting Gravix's body. */
function Orbiters({ y, radius }: { y: number; radius: number }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    g.rotation.y = clock.elapsedTime * 1.4;
    g.rotation.z = Math.sin(clock.elapsedTime * 0.7) * 0.25;
  });
  return (
    <group ref={group} position-y={y}>
      {[0, 1, 2].map((i) => {
        const a = (i / 3) * Math.PI * 2;
        return <Part key={i} geo={GEO.dodeca} mat={solid("#4c1d95", 0.9, 0.1, 0.2)} p={[Math.cos(a) * radius, Math.sin(a * 2) * 0.15, Math.sin(a) * radius]} s={0.11 + i * 0.02} />;
      })}
    </group>
  );
}

// ───────────────────────────── rig descriptions ─────────────────────────────

export interface RigSpec {
  hipY: number;
  hipW: number;
  legR: number;
  legColor: string;
  footColor: string;
  /** "tail": no legs, a ghostly tail instead (Phantom). */
  legShape?: "legs" | "tail";
  torsoH: number;
  torsoW: number;
  torsoD: number;
  torsoShape: "capsule" | "box" | "crystal";
  torsoColor: string;
  shoulderW: number;
  armLen: number;
  armR: number;
  armColor: string;
  fistR: number;
  fistColor: string;
  fistGlow: boolean;
  fistShape: "sphere" | "dodeca" | "crystal";
  headR: number;
  headShape: "sphere" | "box" | "crystal";
  headColor: string;
  /** Run-cycle frequency multiplier (heavy forms stride slower). */
  stride: number;
  emblem: "chest" | "wrist" | "none";
  emblemScale: number;
  /** Hovers above the ground instead of walking (Gravix, Phantom). */
  hover?: boolean;
  rough?: number;
  metal?: number;
  emissive?: number;
  headExtras?: (s: RigSpec) => ReactNode;
  torsoExtras?: (s: RigSpec) => ReactNode;
}

const eyes = (s: RigSpec, color: string, w = 0.06, spread = 0.06, y = 0.02) => (
  <>
    <Part geo={GEO.box} mat={glow(color, 3)} p={[spread, y, s.headR * 0.9]} s={[w, 0.025, 0.02]} />
    <Part geo={GEO.box} mat={glow(color, 3)} p={[-spread, y, s.headR * 0.9]} s={[w, 0.025, 0.02]} />
  </>
);

export const RIGS: Record<ModelId, RigSpec> = {
  human: {
    hipY: 0.62, hipW: 0.09, legR: 0.075, legColor: "#1f2937", footColor: "#111827",
    torsoH: 0.46, torsoW: 0.36, torsoD: 0.22, torsoShape: "capsule", torsoColor: "#2563eb",
    shoulderW: 0.22, armLen: 0.5, armR: 0.055, armColor: "#2563eb",
    fistR: 0.06, fistColor: "#f1c27d", fistGlow: false, fistShape: "sphere",
    headR: 0.165, headShape: "sphere", headColor: "#f1c27d", stride: 1.1,
    emblem: "wrist", emblemScale: 0.07,
    headExtras: (s) => (
      <>
        <Part geo={GEO.sphere} mat={solid("#3b2314", 0.9)} p={[0, 0.045, -0.02]} s={[s.headR * 1.06, s.headR * 0.78, s.headR * 1.06]} />
        <Part geo={GEO.sphere} mat={solid("#111111")} p={[0.055, 0.0, s.headR * 0.9]} s={0.022} />
        <Part geo={GEO.sphere} mat={solid("#111111")} p={[-0.055, 0.0, s.headR * 0.9]} s={0.022} />
      </>
    ),
    torsoExtras: (s) => <Part geo={GEO.box} mat={solid("#e5e7eb")} p={[0, s.torsoH / 2, s.torsoD / 2]} s={[0.05, s.torsoH * 0.85, 0.02]} />,
  },
  blaze: {
    hipY: 0.85, hipW: 0.13, legR: 0.095, legColor: "#9a3412", footColor: "#431407",
    torsoH: 0.62, torsoW: 0.5, torsoD: 0.32, torsoShape: "capsule", torsoColor: "#ea580c",
    shoulderW: 0.31, armLen: 0.66, armR: 0.08, armColor: "#9a3412",
    fistR: 0.11, fistColor: "#fde047", fistGlow: true, fistShape: "sphere",
    headR: 0.16, headShape: "sphere", headColor: "#7c2d12", stride: 1,
    emblem: "chest", emblemScale: 0.08, emissive: 0.25,
    headExtras: (s) => (
      <>
        {eyes(s, "#fef08a", 0.07)}
        <Flames y={s.headR * 0.4} />
      </>
    ),
    torsoExtras: (s) => (
      <>
        <Part geo={GEO.box} mat={glow("#fde047", 2)} p={[-0.12, s.torsoH * 0.4, s.torsoD / 2]} s={[0.025, 0.22, 0.02]} r={[0, 0, 0.5]} />
        <Part geo={GEO.box} mat={glow("#fde047", 2)} p={[0.13, s.torsoH * 0.3, s.torsoD / 2]} s={[0.025, 0.18, 0.02]} r={[0, 0, -0.4]} />
      </>
    ),
  },
  titan: {
    hipY: 0.9, hipW: 0.3, legR: 0.2, legColor: "#57534e", footColor: "#44403c",
    torsoH: 1.1, torsoW: 1.2, torsoD: 0.75, torsoShape: "box", torsoColor: "#78716c",
    shoulderW: 0.72, armLen: 1.0, armR: 0.17, armColor: "#57534e",
    fistR: 0.3, fistColor: "#a8a29e", fistGlow: false, fistShape: "dodeca",
    headR: 0.2, headShape: "box", headColor: "#a8a29e", stride: 0.7,
    emblem: "chest", emblemScale: 0.13, rough: 0.95,
    headExtras: (s) => <Part geo={GEO.box} mat={glow("#fb923c", 2.6)} p={[0, 0.03, s.headR + 0.01]} s={[0.26, 0.06, 0.02]} />,
    torsoExtras: (s) => (
      <>
        <Part geo={GEO.dodeca} mat={solid("#a8a29e", 0.95)} p={[0.62, s.torsoH * 0.95, 0]} s={0.3} />
        <Part geo={GEO.dodeca} mat={solid("#a8a29e", 0.95)} p={[-0.62, s.torsoH * 0.95, 0]} s={0.3} />
        <Part geo={GEO.box} mat={glow("#fb923c", 2)} p={[-0.3, s.torsoH * 0.7, s.torsoD / 2 + 0.005]} s={[0.04, 0.35, 0.02]} r={[0, 0, 0.5]} />
        <Part geo={GEO.box} mat={glow("#fb923c", 2)} p={[-0.38, s.torsoH * 0.42, s.torsoD / 2 + 0.005]} s={[0.04, 0.3, 0.02]} r={[0, 0, -0.4]} />
        <Part geo={GEO.box} mat={glow("#fb923c", 2)} p={[0.32, s.torsoH * 0.35, s.torsoD / 2 + 0.005]} s={[0.04, 0.4, 0.02]} r={[0, 0, 0.3]} />
      </>
    ),
  },
  bolt: {
    hipY: 0.88, hipW: 0.09, legR: 0.07, legColor: "#1e3a8a", footColor: "#facc15",
    torsoH: 0.55, torsoW: 0.36, torsoD: 0.24, torsoShape: "capsule", torsoColor: "#1d4ed8",
    shoulderW: 0.23, armLen: 0.6, armR: 0.055, armColor: "#1e40af",
    fistR: 0.07, fistColor: "#facc15", fistGlow: true, fistShape: "sphere",
    headR: 0.15, headShape: "sphere", headColor: "#1e40af", stride: 1.45,
    emblem: "chest", emblemScale: 0.06, metal: 0.15, rough: 0.35,
    headExtras: (s) => (
      <>
        <Part geo={GEO.box} mat={glow("#22d3ee", 2.8)} p={[0, 0.01, s.headR * 0.85]} s={[0.2, 0.05, 0.05]} />
        <Part geo={GEO.cone} mat={solid("#facc15", 0.4)} p={[0, s.headR * 0.75, -s.headR * 0.35]} s={[0.05, 0.3, 0.12]} r={[-1.2, 0, 0]} />
      </>
    ),
    torsoExtras: (s) => (
      <>
        <Part geo={GEO.box} mat={glow("#facc15", 2.2)} p={[0.04, s.torsoH * 0.72, s.torsoD / 2]} s={[0.04, 0.16, 0.02]} r={[0, 0, -0.6]} />
        <Part geo={GEO.box} mat={glow("#facc15", 2.2)} p={[0, s.torsoH * 0.5, s.torsoD / 2]} s={[0.04, 0.16, 0.02]} r={[0, 0, 0.6]} />
        <Part geo={GEO.box} mat={glow("#facc15", 2.2)} p={[-0.04, s.torsoH * 0.28, s.torsoD / 2]} s={[0.04, 0.16, 0.02]} r={[0, 0, -0.6]} />
      </>
    ),
  },
  shard: {
    hipY: 0.85, hipW: 0.12, legR: 0.09, legColor: "#0f766e", footColor: "#134e4a",
    torsoH: 0.72, torsoW: 0.62, torsoD: 0.4, torsoShape: "crystal", torsoColor: "#14b8a6",
    shoulderW: 0.36, armLen: 0.7, armR: 0.075, armColor: "#0d9488",
    fistR: 0.15, fistColor: "#5eead4", fistGlow: false, fistShape: "crystal",
    headR: 0.19, headShape: "crystal", headColor: "#99f6e4", stride: 0.95,
    emblem: "chest", emblemScale: 0.08, rough: 0.2, metal: 0.15, emissive: 0.3,
    headExtras: (s) => <Part geo={GEO.box} mat={glow("#ccfbf1", 2.4)} p={[0, 0.02, s.headR * 0.62]} s={[0.14, 0.03, 0.02]} />,
    torsoExtras: (s) => (
      <>
        <Part geo={GEO.cone} mat={solid("#99f6e4", 0.2, 0.15, 0.3)} p={[0.3, s.torsoH * 0.98, 0]} s={[0.08, 0.38, 0.08]} r={[0, 0, -0.35]} />
        <Part geo={GEO.cone} mat={solid("#99f6e4", 0.2, 0.15, 0.3)} p={[-0.3, s.torsoH * 0.98, 0]} s={[0.08, 0.38, 0.08]} r={[0, 0, 0.35]} />
        <Part geo={GEO.cone} mat={solid("#5eead4", 0.2, 0.15, 0.3)} p={[0, s.torsoH * 0.7, -s.torsoD / 2]} s={[0.07, 0.3, 0.07]} r={[-0.9, 0, 0]} />
      </>
    ),
  },
  gravix: {
    hipY: 0.8, hipW: 0.12, legR: 0.08, legColor: "#312e81", footColor: "#1e1b4b",
    torsoH: 0.68, torsoW: 0.5, torsoD: 0.34, torsoShape: "capsule", torsoColor: "#7c3aed",
    shoulderW: 0.32, armLen: 0.66, armR: 0.075, armColor: "#4c1d95",
    fistR: 0.12, fistColor: "#c4b5fd", fistGlow: true, fistShape: "sphere",
    headR: 0.17, headShape: "sphere", headColor: "#1e1b4b", stride: 0.9,
    emblem: "chest", emblemScale: 0.08, emissive: 0.2, hover: true,
    headExtras: (s) => (
      <>
        {eyes(s, "#c4b5fd", 0.07)}
        {/* Tilted halo ring */}
        <Part geo={GEO.torus} mat={glow("#a78bfa", 2.4)} p={[0, s.headR * 1.4, -0.03]} s={s.headR * 1.1} r={[Math.PI / 2 - 0.25, 0, 0]} />
      </>
    ),
    torsoExtras: (s) => (
      <>
        <Part geo={GEO.sphere} mat={glow("#a78bfa", 2.2)} p={[0, s.torsoH * 0.25, s.torsoD / 2]} s={0.07} />
        <Orbiters y={s.torsoH * 0.5} radius={0.62} />
      </>
    ),
  },
  frostbyte: {
    hipY: 0.85, hipW: 0.11, legR: 0.085, legColor: "#0369a1", footColor: "#e0f2fe",
    torsoH: 0.62, torsoW: 0.46, torsoD: 0.3, torsoShape: "capsule", torsoColor: "#38bdf8",
    shoulderW: 0.3, armLen: 0.64, armR: 0.07, armColor: "#0ea5e9",
    fistR: 0.13, fistColor: "#e0f2fe", fistGlow: false, fistShape: "crystal",
    headR: 0.17, headShape: "crystal", headColor: "#e0f2fe", stride: 1,
    emblem: "chest", emblemScale: 0.08, rough: 0.25, emissive: 0.3,
    headExtras: (s) => (
      <>
        <Part geo={GEO.box} mat={glow("#67e8f9", 2.6)} p={[0, 0.02, s.headR * 0.62]} s={[0.16, 0.035, 0.02]} />
        {[-0.08, 0, 0.08].map((x, i) => (
          <Part key={i} geo={GEO.cone} mat={solid("#f0f9ff", 0.2, 0.1, 0.4)} p={[x, s.headR * 1.25, 0]} s={[0.04, i === 1 ? 0.3 : 0.2, 0.04]} r={[0, 0, -x * 3]} />
        ))}
      </>
    ),
    torsoExtras: (s) => (
      <>
        <Part geo={GEO.cone} mat={solid("#bae6fd", 0.2, 0.1, 0.35)} p={[0.28, s.torsoH * 0.95, 0]} s={[0.07, 0.32, 0.07]} r={[0, 0, -0.9]} />
        <Part geo={GEO.cone} mat={solid("#bae6fd", 0.2, 0.1, 0.35)} p={[-0.28, s.torsoH * 0.95, 0]} s={[0.07, 0.32, 0.07]} r={[0, 0, 0.9]} />
      </>
    ),
  },
  thornback: {
    hipY: 0.8, hipW: 0.16, legR: 0.12, legColor: "#3f6212", footColor: "#365314",
    torsoH: 0.8, torsoW: 0.75, torsoD: 0.55, torsoShape: "box", torsoColor: "#4d7c0f",
    shoulderW: 0.45, armLen: 0.85, armR: 0.075, armColor: "#65a30d",
    fistR: 0.1, fistColor: "#84cc16", fistGlow: false, fistShape: "sphere",
    headR: 0.2, headShape: "sphere", headColor: "#365314", stride: 0.9,
    emblem: "chest", emblemScale: 0.09, rough: 0.85,
    headExtras: (s) => (
      <>
        {eyes(s, "#bef264", 0.06)}
        {[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2;
          return <Part key={i} geo={GEO.cone} mat={solid("#f472b6", 0.6, 0, 0.3)} p={[Math.cos(a) * 0.12, s.headR * 0.95, Math.sin(a) * 0.12]} s={[0.05, 0.14, 0.05]} r={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]} />;
        })}
      </>
    ),
    torsoExtras: (s) => (
      <>
        {[0, 1, 2].map((row) =>
          [-1, 1].map((side) => (
            <Part key={`${row}${side}`} geo={GEO.cone} mat={solid("#bef264", 0.7, 0, 0.25)} p={[side * 0.18, s.torsoH * (0.35 + row * 0.25), -s.torsoD / 2]} s={[0.06, 0.28, 0.06]} r={[-2.2, 0, side * 0.3]} />
          )),
        )}
      </>
    ),
  },
  phantom: {
    hipY: 0.6, hipW: 0.1, legR: 0.07, legColor: "#e2e8f0", footColor: "#e2e8f0", legShape: "tail",
    torsoH: 0.7, torsoW: 0.44, torsoD: 0.3, torsoShape: "capsule", torsoColor: "#e2e8f0",
    shoulderW: 0.28, armLen: 0.62, armR: 0.06, armColor: "#cbd5e1",
    fistR: 0.1, fistColor: "#c4b5fd", fistGlow: true, fistShape: "crystal",
    headR: 0.18, headShape: "sphere", headColor: "#f1f5f9", stride: 0.8,
    emblem: "chest", emblemScale: 0.07, emissive: 0.45, hover: true,
    headExtras: (s) => (
      <>
        <Part geo={GEO.sphere} mat={solid("#94a3b8", 0.7, 0, 0.2)} p={[0, 0.04, -0.05]} s={[s.headR * 1.12, s.headR * 1.08, s.headR * 1.05]} />
        {eyes(s, "#a78bfa", 0.07, 0.065, 0.01)}
      </>
    ),
  },
  behemoth: {
    hipY: 1.5, hipW: 0.45, legR: 0.3, legColor: "#7c2d12", footColor: "#431407",
    torsoH: 1.9, torsoW: 1.9, torsoD: 1.2, torsoShape: "box", torsoColor: "#9a3412",
    shoulderW: 1.15, armLen: 1.6, armR: 0.28, armColor: "#7c2d12",
    fistR: 0.45, fistColor: "#b45309", fistGlow: false, fistShape: "dodeca",
    headR: 0.3, headShape: "box", headColor: "#9a3412", stride: 0.55,
    emblem: "chest", emblemScale: 0.2, rough: 0.9,
    headExtras: (s) => (
      <>
        {eyes(s, "#fbbf24", 0.12, 0.12, 0.04)}
        <Part geo={GEO.cone} mat={solid("#fbbf24", 0.5)} p={[0.3, s.headR * 0.9, 0]} s={[0.09, 0.45, 0.09]} r={[0, 0, -0.6]} />
        <Part geo={GEO.cone} mat={solid("#fbbf24", 0.5)} p={[-0.3, s.headR * 0.9, 0]} s={[0.09, 0.45, 0.09]} r={[0, 0, 0.6]} />
      </>
    ),
    torsoExtras: (s) => (
      <>
        <Part geo={GEO.box} mat={solid("#b45309", 0.5, 0.2)} p={[0, s.torsoH * 0.62, s.torsoD / 2 + 0.03]} s={[1.2, 0.9, 0.08]} />
        <Part geo={GEO.box} mat={solid("#b45309", 0.5, 0.2)} p={[1.0, s.torsoH * 0.98, 0]} s={[0.6, 0.3, 0.9]} />
        <Part geo={GEO.box} mat={solid("#b45309", 0.5, 0.2)} p={[-1.0, s.torsoH * 0.98, 0]} s={[0.6, 0.3, 0.9]} />
        <Part geo={GEO.box} mat={glow("#fbbf24", 2)} p={[0.55, s.torsoH * 0.35, s.torsoD / 2 + 0.01]} s={[0.05, 0.6, 0.02]} r={[0, 0, 0.4]} />
        <Part geo={GEO.box} mat={glow("#fbbf24", 2)} p={[-0.6, s.torsoH * 0.3, s.torsoD / 2 + 0.01]} s={[0.05, 0.5, 0.02]} r={[0, 0, -0.3]} />
      </>
    ),
  },
  nanotek: {
    hipY: 0.85, hipW: 0.1, legR: 0.07, legColor: "#334155", footColor: "#0f172a",
    torsoH: 0.58, torsoW: 0.42, torsoD: 0.28, torsoShape: "capsule", torsoColor: "#94a3b8",
    shoulderW: 0.27, armLen: 0.6, armR: 0.06, armColor: "#475569",
    fistR: 0.07, fistColor: "#22d3ee", fistGlow: true, fistShape: "sphere",
    headR: 0.16, headShape: "sphere", headColor: "#cbd5e1", stride: 1.1,
    emblem: "chest", emblemScale: 0.07, metal: 0.15, rough: 0.3,
    headExtras: (s) => (
      <>
        <Part geo={GEO.box} mat={glow("#22d3ee", 2.8)} p={[0, 0.02, s.headR * 0.8]} s={[0.28, 0.05, 0.08]} />
        <Part geo={GEO.box} mat={solid("#334155")} p={[0.1, s.headR * 1.2, 0]} s={[0.02, 0.2, 0.02]} />
        <Part geo={GEO.sphere} mat={glow("#22d3ee", 3)} p={[0.1, s.headR * 1.2 + 0.11, 0]} s={0.03} />
      </>
    ),
    torsoExtras: (s) => (
      <>
        <Part geo={GEO.box} mat={solid("#334155", 0.4, 0.2)} p={[0, s.torsoH * 0.55, -s.torsoD / 2 - 0.08]} s={[0.3, 0.36, 0.14]} />
        <Part geo={GEO.box} mat={glow("#22d3ee", 2.4)} p={[0, s.torsoH * 0.55, -s.torsoD / 2 - 0.16]} s={[0.2, 0.04, 0.01]} />
        <Part geo={GEO.box} mat={glow("#22d3ee", 2)} p={[0.12, s.torsoH * 0.35, s.torsoD / 2]} s={[0.02, 0.2, 0.01]} />
        <Part geo={GEO.box} mat={glow("#22d3ee", 2)} p={[-0.12, s.torsoH * 0.35, s.torsoD / 2]} s={[0.02, 0.2, 0.01]} />
      </>
    ),
  },
  // ── the rival hunter (boss) — three forms ──
  hunter: {
    hipY: 0.9, hipW: 0.12, legR: 0.09, legColor: "#111827", footColor: "#0b0b12",
    torsoH: 0.7, torsoW: 0.5, torsoD: 0.34, torsoShape: "box", torsoColor: "#1f2937",
    shoulderW: 0.33, armLen: 0.68, armR: 0.075, armColor: "#374151",
    fistR: 0.09, fistColor: "#111827", fistGlow: false, fistShape: "sphere",
    headR: 0.16, headShape: "sphere", headColor: "#111827", stride: 1,
    emblem: "none", emblemScale: 0, metal: 0.2, rough: 0.4,
    headExtras: (s) => <Part geo={GEO.box} mat={glow("#ef4444", 3)} p={[0, 0.02, s.headR * 0.85]} s={[0.24, 0.05, 0.06]} />,
    torsoExtras: (s) => (
      <>
        <Part geo={GEO.box} mat={solid("#b91c1c", 0.5, 0.2)} p={[0.3, s.torsoH * 0.95, 0]} s={[0.26, 0.14, 0.4]} />
        <Part geo={GEO.box} mat={solid("#b91c1c", 0.5, 0.2)} p={[-0.3, s.torsoH * 0.95, 0]} s={[0.26, 0.14, 0.4]} />
        {/* The hunter's mark: a glowing downward triangle. */}
        <Part geo={GEO.cone} mat={glow("#ef4444", 2.6)} p={[0, s.torsoH * 0.6, s.torsoD / 2 + 0.01]} s={[0.1, 0.18, 0.02]} r={[0, 0, Math.PI]} />
      </>
    ),
  },
  hunterBrute: {
    hipY: 1.1, hipW: 0.3, legR: 0.2, legColor: "#450a0a", footColor: "#1c0505",
    torsoH: 1.3, torsoW: 1.3, torsoD: 0.8, torsoShape: "box", torsoColor: "#7f1d1d",
    shoulderW: 0.8, armLen: 1.1, armR: 0.19, armColor: "#450a0a",
    fistR: 0.3, fistColor: "#991b1b", fistGlow: false, fistShape: "dodeca",
    headR: 0.2, headShape: "box", headColor: "#1f2937", stride: 0.7,
    emblem: "none", emblemScale: 0, rough: 0.7,
    headExtras: (s) => <Part geo={GEO.box} mat={glow("#ef4444", 3)} p={[0, 0.02, s.headR + 0.01]} s={[0.3, 0.06, 0.02]} />,
    torsoExtras: (s) => (
      <>
        {[-1, 1].map((side) => (
          <Part key={side} geo={GEO.cone} mat={solid("#fca5a5", 0.5)} p={[side * 0.7, s.torsoH * 1.05, 0]} s={[0.1, 0.4, 0.1]} r={[0, 0, -side * 0.5]} />
        ))}
        <Part geo={GEO.cone} mat={glow("#ef4444", 2.6)} p={[0, s.torsoH * 0.6, s.torsoD / 2 + 0.01]} s={[0.18, 0.3, 0.02]} r={[0, 0, Math.PI]} />
      </>
    ),
  },
  hunterBlade: {
    hipY: 0.9, hipW: 0.1, legR: 0.07, legColor: "#0b0b12", footColor: "#111827",
    torsoH: 0.62, torsoW: 0.4, torsoD: 0.26, torsoShape: "capsule", torsoColor: "#111827",
    shoulderW: 0.27, armLen: 0.66, armR: 0.06, armColor: "#1f2937",
    fistR: 0.17, fistColor: "#f43f5e", fistGlow: true, fistShape: "crystal",
    headR: 0.15, headShape: "sphere", headColor: "#111827", stride: 1.3,
    emblem: "none", emblemScale: 0, metal: 0.2, rough: 0.3,
    headExtras: (s) => <Part geo={GEO.box} mat={glow("#f43f5e", 3)} p={[0, 0.02, s.headR * 0.85]} s={[0.22, 0.04, 0.06]} />,
    torsoExtras: (s) => (
      <>
        <Part geo={GEO.cone} mat={solid("#be123c", 0.6)} p={[0, s.torsoH * 0.9, -s.torsoD / 2 - 0.1]} s={[0.12, 0.6, 0.04]} r={[2.6, 0, 0]} />
        <Part geo={GEO.cone} mat={glow("#f43f5e", 2.6)} p={[0, s.torsoH * 0.6, s.torsoD / 2 + 0.01]} s={[0.1, 0.18, 0.02]} r={[0, 0, Math.PI]} />
      </>
    ),
  },
};
