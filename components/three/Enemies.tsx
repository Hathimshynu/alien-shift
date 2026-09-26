"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  ConeGeometry,
  Euler,
  type InstancedMesh,
  type Material,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import type { Enemy, EnemyKind } from "@/game/core/types";
import { interpolated, useRuntime, yawOf } from "./runtime-context";

/** Max robots of one kind on screen (the sim caps the total at 14 + boss drones). */
const CAPACITY = 18;

const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpEuler = new Euler();
const base = new Matrix4();
const local = new Matrix4();
const WHITE = new Color(3, 3, 3); // over-bright so the hit flash really pops

/** Writes one part's local transform (relative to the robot's feet, facing +Z) into `local`. */
type PartTransform = (e: Enemy, i: number, t: number) => void;

interface PartDef {
  geo: BufferGeometry;
  mat: Material;
  /** Instances per robot (e.g. 6 legs). */
  per?: number;
  /** Base colour for lit parts; they flash white when the robot is hit. Unlit glow parts leave it undefined. */
  color?: string;
  transform: PartTransform;
}

function setLocal(px: number, py: number, pz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number) {
  local.compose(tmpPos.set(px, py, pz), tmpQuat.setFromEuler(tmpEuler.set(rx, ry, rz)), tmpScale.set(sx, sy, sz));
}

// Low metalness: with no environment map, metallic surfaces would render nearly black at night.
const lit = () => new MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, metalness: 0.1, emissive: "#1a1a2e", emissiveIntensity: 1 });
const glowMat = (color: string, k = 2.5) => new MeshBasicMaterial({ color: new Color(color).multiplyScalar(k), toneMapped: false });

function useParts(kind: Exclude<EnemyKind, "boss">): PartDef[] {
  return useMemo(() => {
    const sphere = new SphereGeometry(1, 14, 10);
    const box = new BoxGeometry(1, 1, 1);
    const cone = new ConeGeometry(1, 1, 8);
    switch (kind) {
      case "crawler":
        return [
          { geo: sphere, mat: lit(), color: "#9ca3af", transform: () => setLocal(0, 0.42, 0, 0, 0, 0, 0.5, 0.36, 0.56) },
          { geo: box, mat: lit(), color: "#ef4444", transform: () => setLocal(0, 0.36, 0, 0, 0, 0, 0.92, 0.1, 0.84) },
          { geo: sphere, mat: glowMat("#ef4444", 3), transform: () => setLocal(0, 0.56, 0.44, 0, 0, 0, 0.09, 0.09, 0.09) },
          {
            // Six scuttling legs: three per side, phase-shifted.
            geo: box,
            mat: lit(),
            color: "#4b5563",
            per: 6,
            transform: (e, i, t) => {
              const side = i < 3 ? 1 : -1;
              const z = ((i % 3) - 1) * 0.3;
              const moving = Math.hypot(e.vx, e.vz) > 0.5 ? 1 : 0.15;
              const swing = Math.sin(t * 14 + e.id + i * 2.1) * 0.45 * moving;
              setLocal(side * 0.44, 0.2, z, swing, 0, side * 0.65, 0.06, 0.48, 0.06);
            },
          },
        ];
      case "drone":
        return [
          { geo: sphere, mat: lit(), color: "#94a3b8", transform: () => setLocal(0, 0.3, 0, 0, 0, 0, 0.6, 0.17, 0.6) },
          { geo: sphere, mat: lit(), color: "#e2e8f0", transform: () => setLocal(0, 0.42, 0, 0, 0, 0, 0.32, 0.25, 0.32) },
          { geo: sphere, mat: glowMat("#f43f5e", 3), transform: () => setLocal(0, 0.3, 0.55, 0, 0, 0, 0.1, 0.1, 0.1) },
          {
            geo: cone,
            mat: glowMat("#38bdf8", 2),
            transform: (e, _i, t) => {
              const flicker = 0.8 + Math.sin(t * 40 + e.id) * 0.2;
              setLocal(0, 0.02, 0, Math.PI, 0, 0, 0.14, 0.4 * flicker, 0.14);
            },
          },
          { geo: box, mat: glowMat("#fde047", 2.2), per: 2, transform: (_e, i) => setLocal(i ? 0.62 : -0.62, 0.3, 0, 0, 0, 0, 0.08, 0.08, 0.08) },
        ];
      case "brute":
        return [
          {
            geo: box,
            mat: lit(),
            color: "#475569",
            per: 2,
            transform: (e, i, t) => {
              const side = i ? 1 : -1;
              const swing = Math.sin(t * 6 + e.id) * 0.4 * side * (Math.hypot(e.vx, e.vz) > 0.5 ? 1 : 0);
              setLocal(side * 0.3, 0.42, 0, swing, 0, 0, 0.34, 0.84, 0.38);
            },
          },
          { geo: box, mat: lit(), color: "#7c3aed", transform: () => setLocal(0, 1.28, 0, 0.1, 0, 0, 1.3, 0.95, 0.8) },
          {
            geo: box,
            mat: lit(),
            color: "#8b5cf6",
            per: 2,
            transform: (e, i, t) => {
              const side = i ? 1 : -1;
              const swing = -Math.sin(t * 6 + e.id) * 0.35 * side;
              setLocal(side * 0.82, 1.15, 0.05, swing, 0, side * 0.08, 0.32, 1.05, 0.36);
            },
          },
          { geo: box, mat: lit(), color: "#4338ca", transform: () => setLocal(0, 1.95, 0.05, 0, 0, 0, 0.56, 0.36, 0.5) },
          { geo: box, mat: glowMat("#e879f9", 3), transform: () => setLocal(0, 1.97, 0.31, 0, 0, 0, 0.46, 0.08, 0.04) },
          { geo: sphere, mat: glowMat("#e879f9", 2.6), transform: (e, _i, t) => setLocal(0, 1.32, 0.41, 0, 0, 0, 0.13 + Math.sin(t * 6 + e.id) * 0.02, 0.13, 0.05) },
        ];
    }
  }, [kind]);
}

const enemyPos = new Vector3();
const flashColor = new Color();

function EnemyKindView({ kind }: { kind: Exclude<EnemyKind, "boss"> }) {
  const runtime = useRuntime();
  const parts = useParts(kind);
  const meshes = useRef<(InstancedMesh | null)[]>([]);

  useFrame(() => {
    const t = runtime.time;
    let n = 0;
    for (const e of runtime.sim.enemies) {
      if (e.kind !== kind || n >= CAPACITY) continue;
      interpolated(e, runtime.alpha, enemyPos);
      // Drones bank a little as they drift.
      const tilt = kind === "drone" ? Math.sin(t * 2 + e.id) * 0.12 : 0;
      base.compose(enemyPos, tmpQuat.setFromEuler(tmpEuler.set(tilt, yawOf(e.fx, e.fz), 0)), tmpScale.set(1, 1, 1));
      const flashing = e.hitFlash > 0;
      parts.forEach((part, j) => {
        const mesh = meshes.current[j];
        if (!mesh) return;
        const per = part.per ?? 1;
        for (let k = 0; k < per; k++) {
          part.transform(e, k, t);
          local.premultiply(base);
          mesh.setMatrixAt(n * per + k, local);
          if (part.color) mesh.setColorAt(n * per + k, flashing ? WHITE : flashColor.set(part.color));
        }
      });
      n++;
    }
    parts.forEach((part, j) => {
      const mesh = meshes.current[j];
      if (!mesh) return;
      mesh.count = n * (part.per ?? 1);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  });

  return (
    <>
      {parts.map((part, j) => (
        <instancedMesh
          key={j}
          ref={(m) => {
            meshes.current[j] = m;
          }}
          args={[part.geo, part.mat, CAPACITY * (part.per ?? 1)]}
          count={0}
          castShadow
          // Instances move all over the arena; the base geometry's bounds would cull them wrongly.
          frustumCulled={false}
        />
      ))}
    </>
  );
}

const barGeo = new PlaneGeometry(1, 1);
const barBg = new MeshBasicMaterial({ color: "#000000", transparent: true, opacity: 0.6, depthWrite: false });
// Both quads are "transparent" so renderOrder (bg first, then fill) decides the draw order.
const barFill = new MeshBasicMaterial({ color: new Color("#ef4444").multiplyScalar(1.5), toneMapped: false, transparent: true, depthWrite: false });
const right = new Vector3();

/** Camera-facing health bars above damaged robots (two instanced quads for all of them). */
function HealthBars() {
  const runtime = useRuntime();
  const bg = useRef<InstancedMesh>(null);
  const fill = useRef<InstancedMesh>(null);

  useFrame(({ camera }) => {
    if (!bg.current || !fill.current) return;
    right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    let n = 0;
    for (const e of runtime.sim.enemies) {
      if (e.kind === "boss" || e.hp >= e.maxHp || n >= CAPACITY * 3) continue;
      interpolated(e, runtime.alpha, enemyPos);
      const w = Math.max(0.8, e.radius * 1.8);
      const ratio = Math.max(0, e.hp / e.maxHp);
      enemyPos.y += e.height + 0.35;
      base.compose(enemyPos, camera.quaternion, tmpScale.set(w, 0.1, 1));
      bg.current.setMatrixAt(n, base);
      // Anchor the fill on the left edge: shift it along the camera's right axis.
      enemyPos.addScaledVector(right, (-(1 - ratio) * w) / 2);
      base.compose(enemyPos, camera.quaternion, tmpScale.set(w * ratio, 0.1, 1));
      fill.current.setMatrixAt(n, base);
      n++;
    }
    bg.current.count = fill.current.count = n;
    bg.current.instanceMatrix.needsUpdate = true;
    fill.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={bg} args={[barGeo, barBg, CAPACITY * 3]} count={0} frustumCulled={false} renderOrder={5} />
      <instancedMesh ref={fill} args={[barGeo, barFill, CAPACITY * 3]} count={0} frustumCulled={false} renderOrder={6} />
    </>
  );
}

export function Enemies() {
  return (
    <>
      <EnemyKindView kind="crawler" />
      <EnemyKindView kind="drone" />
      <EnemyKindView kind="brute" />
      <HealthBars />
    </>
  );
}
