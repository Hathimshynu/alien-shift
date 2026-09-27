"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
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
  OctahedronGeometry,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import type { Enemy, EnemyKind } from "@/game/core/types";
import { isBoss } from "@/game/core/types";
import { interpolated, useRuntime, yawOf } from "./runtime-context";

/** Max robots of one kind on screen (the sim caps the total at 14 + boss adds). */
const CAPACITY = 18;
type RegularKind = Exclude<EnemyKind, "vexx" | "spider" | "hunter">;

const tmpPos = new Vector3();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3();
const tmpEuler = new Euler();
const base = new Matrix4();
const local = new Matrix4();
const WHITE = new Color(3, 3, 3); // over-bright so the hit flash really pops
const ICE = new Color("#a5f3fc").multiplyScalar(1.4);
const ALLY = new Color("#c4b5fd");
const BURN = new Color("#fb923c");

/** Writes one part's local transform (relative to the robot's feet, facing +Z) into `local`. */
type PartTransform = (e: Enemy, i: number, t: number) => void;

interface PartDef {
  geo: BufferGeometry;
  mat: Material;
  /** Instances per robot (e.g. 6 legs). */
  per?: number;
  /** Base colour for lit parts; they flash white when hit and tint with status effects. Glow parts leave it undefined. */
  color?: string;
  transform: PartTransform;
}

function setLocal(px: number, py: number, pz: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number) {
  local.compose(tmpPos.set(px, py, pz), tmpQuat.setFromEuler(tmpEuler.set(rx, ry, rz)), tmpScale.set(sx, sy, sz));
}

// Low metalness: with no environment map, metallic surfaces would render nearly black at night.
const lit = () => new MeshStandardMaterial({ color: "#ffffff", roughness: 0.5, metalness: 0.1, emissive: "#1a1a2e", emissiveIntensity: 1 });
const glowMat = (color: string, k = 2.5) => new MeshBasicMaterial({ color: new Color(color).multiplyScalar(k), toneMapped: false });
const moving = (e: Enemy) => (Math.hypot(e.vx, e.vz) > 0.5 && e.frozenTimer <= 0 ? 1 : 0.15);

function useParts(kind: RegularKind): PartDef[] {
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
              const swing = Math.sin(t * 14 + e.id + i * 2.1) * 0.45 * moving(e);
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
            transform: (e, _i, t) => setLocal(0, 0.02, 0, Math.PI, 0, 0, 0.14, 0.4 * (0.8 + Math.sin(t * 40 + e.id) * 0.2), 0.14),
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
              setLocal(side * 0.3, 0.42, 0, Math.sin(t * 6 + e.id) * 0.4 * side * moving(e), 0, 0, 0.34, 0.84, 0.38);
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
              setLocal(side * 0.82, 1.15, 0.05, -Math.sin(t * 6 + e.id) * 0.35 * side * moving(e), 0, side * 0.08, 0.32, 1.05, 0.36);
            },
          },
          { geo: box, mat: lit(), color: "#4338ca", transform: () => setLocal(0, 1.95, 0.05, 0, 0, 0, 0.56, 0.36, 0.5) },
          { geo: box, mat: glowMat("#e879f9", 3), transform: () => setLocal(0, 1.97, 0.31, 0, 0, 0, 0.46, 0.08, 0.04) },
          { geo: sphere, mat: glowMat("#e879f9", 2.6), transform: (e, _i, t) => setLocal(0, 1.32, 0.41, 0, 0, 0, 0.13 + Math.sin(t * 6 + e.id) * 0.02, 0.13, 0.05) },
        ];
      case "warden":
        return [
          {
            geo: box,
            mat: lit(),
            color: "#334155",
            per: 2,
            transform: (e, i, t) => setLocal((i ? 1 : -1) * 0.22, 0.45, 0, Math.sin(t * 5 + e.id) * 0.35 * (i ? 1 : -1) * moving(e), 0, 0, 0.26, 0.9, 0.3),
          },
          { geo: box, mat: lit(), color: "#1e40af", transform: () => setLocal(0, 1.3, -0.05, 0, 0, 0, 0.9, 0.85, 0.6) },
          { geo: box, mat: lit(), color: "#1e3a8a", transform: () => setLocal(0, 1.9, -0.02, 0, 0, 0, 0.42, 0.34, 0.42) },
          { geo: box, mat: glowMat("#67e8f9", 3), transform: () => setLocal(0, 1.92, 0.2, 0, 0, 0, 0.34, 0.06, 0.04) },
          // Shield arm + the energy shield itself (hidden once broken).
          { geo: box, mat: lit(), color: "#1e3a8a", transform: () => setLocal(0.42, 1.2, 0.35, -0.4, 0, 0, 0.18, 0.7, 0.2) },
          {
            geo: box,
            mat: new MeshBasicMaterial({ color: new Color("#60a5fa").multiplyScalar(1.4), transparent: true, opacity: 0.55, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
            transform: (e, _i, t) => {
              const k = e.shieldHp > 0 ? 1 : 0;
              setLocal(0, 1.15, 0.72, 0, 0, 0, 1.25 * k, (1.7 + Math.sin(t * 6 + e.id) * 0.03) * k, 0.08 * k);
            },
          },
        ];
      case "bomber":
        return [
          { geo: sphere, mat: lit(), color: "#ea580c", transform: () => setLocal(0, 0.38, 0, 0, 0, 0, 0.42, 0.3, 0.5) },
          { geo: sphere, mat: lit(), color: "#1f2937", transform: () => setLocal(0, 0.66, -0.05, 0, 0, 0, 0.26, 0.26, 0.26) },
          {
            // Fuse light: blinks faster once armed.
            geo: sphere,
            mat: glowMat("#ef4444", 3.5),
            transform: (e, _i, t) => {
              const rate = e.stateTimer > 0 ? 40 : 8;
              const k = Math.sin(t * rate + e.id) > 0 ? 1 : 0.4;
              setLocal(0, 0.95, -0.05, 0, 0, 0, 0.08 * k, 0.08 * k, 0.08 * k);
            },
          },
          {
            geo: box,
            mat: lit(),
            color: "#4b5563",
            per: 4,
            transform: (e, i, t) => {
              const side = i < 2 ? 1 : -1;
              const z = i % 2 ? 0.2 : -0.2;
              setLocal(side * 0.36, 0.16, z, Math.sin(t * 18 + e.id + i * 1.7) * 0.6 * moving(e), 0, side * 0.6, 0.06, 0.34, 0.06);
            },
          },
        ];
      case "sniper":
        return [
          { geo: box, mat: lit(), color: "#475569", transform: () => setLocal(0, 0.25, -0.1, 0, 0, 0, 0.5, 0.3, 0.8) },
          { geo: box, mat: lit(), color: "#1f2937", transform: () => setLocal(0, 0.22, 0.65, 0, 0, 0, 0.09, 0.09, 1) },
          { geo: sphere, mat: glowMat("#ef4444", 3), transform: () => setLocal(0, 0.38, 0.22, 0, 0, 0, 0.08, 0.08, 0.08) },
          {
            geo: box,
            mat: lit(),
            color: "#94a3b8",
            per: 2,
            transform: (e, i, t) => setLocal(i ? 0.45 : -0.45, 0.42, -0.1, 0, t * 30 + e.id, 0, 0.5, 0.02, 0.08),
          },
        ];
    }
  }, [kind]);
}

const enemyPos = new Vector3();
const tint = new Color();

function EnemyKindView({ kind }: { kind: RegularKind }) {
  const runtime = useRuntime();
  const parts = useParts(kind);
  const meshes = useRef<(InstancedMesh | null)[]>([]);

  useFrame(() => {
    const t = runtime.time;
    let n = 0;
    for (const e of runtime.sim.enemies) {
      if (e.kind !== kind || n >= CAPACITY) continue;
      interpolated(e, runtime.alpha, enemyPos);
      // Drones and snipers bank a little as they drift; frozen robots stop animating.
      const at = e.frozenTimer > 0 ? e.id : t;
      const tilt = kind === "drone" || kind === "sniper" ? Math.sin(at * 2 + e.id) * 0.12 : 0;
      base.compose(enemyPos, tmpQuat.setFromEuler(tmpEuler.set(tilt, yawOf(e.fx, e.fz), 0)), tmpScale.set(1, 1, 1));
      parts.forEach((part, j) => {
        const mesh = meshes.current[j];
        if (!mesh) return;
        const per = part.per ?? 1;
        for (let k = 0; k < per; k++) {
          part.transform(e, k, at);
          local.premultiply(base);
          mesh.setMatrixAt(n * per + k, local);
          if (part.color) {
            let c = tint.set(part.color);
            if (e.hitFlash > 0) c = WHITE;
            else if (e.frozenTimer > 0) c = ICE;
            else if (e.allyTimer > 0) c.lerp(ALLY, 0.6);
            else if (e.burnTimer > 0) c.lerp(BURN, 0.35 + Math.sin(t * 20) * 0.1);
            mesh.setColorAt(n * per + k, c);
          }
        }
      });
      n++;
    }
    parts.forEach((part, j) => {
      const mesh = meshes.current[j];
      if (!mesh) return;
      mesh.count = n * (part.per ?? 1);
      mesh.visible = n > 0; // kinds not on screen cost no draw calls
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
      if (isBoss(e.kind) || e.hp >= e.maxHp || n >= CAPACITY * 3) continue;
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
    bg.current.visible = fill.current.visible = n > 0;
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

const STATUS_CAPACITY = 40;
const FORWARD = new Vector3(0, 0, 1);
const dir = new Vector3();

/**
 * Status visuals for all robots in three instanced meshes: root vines at the feet, Crystal Prison
 * crystals, and laser sights (snipers aiming, the hunter lining up a burst).
 */
function StatusEffects() {
  const runtime = useRuntime();
  const vines = useRef<InstancedMesh>(null);
  const crystals = useRef<InstancedMesh>(null);
  const sights = useRef<InstancedMesh>(null);
  const res = useMemo(
    () => ({
      cone: new ConeGeometry(1, 1, 5),
      octa: new OctahedronGeometry(1, 0),
      beam: new BoxGeometry(1, 1, 1).translate(0, 0, 0.5), // extends along +Z from its origin
      vine: new MeshStandardMaterial({ color: "#4d7c0f", roughness: 0.8, emissive: "#365314", emissiveIntensity: 0.4 }),
      crystal: new MeshBasicMaterial({ color: new Color("#5eead4").multiplyScalar(1.2), transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }),
      sight: new MeshBasicMaterial({ color: new Color("#ef4444").multiplyScalar(2.5), transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    }),
    [],
  );

  useFrame(() => {
    const t = runtime.time;
    let nv = 0;
    let nc = 0;
    let ns = 0;
    for (const e of runtime.sim.enemies) {
      interpolated(e, runtime.alpha, enemyPos);
      if (e.rootTimer > 0 && vines.current) {
        for (let i = 0; i < 5 && nv < STATUS_CAPACITY; i++) {
          const a = (i / 5) * Math.PI * 2 + e.id;
          const r = e.radius * 0.9;
          base.compose(
            tmpPos.set(enemyPos.x + Math.cos(a) * r, enemyPos.y + 0.3, enemyPos.z + Math.sin(a) * r),
            tmpQuat.setFromEuler(tmpEuler.set(-Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5)),
            tmpScale.set(0.08, 0.7 + Math.sin(t * 3 + i) * 0.05, 0.08),
          );
          vines.current.setMatrixAt(nv++, base);
        }
      }
      if (e.prisonDmg > 0 && e.frozenTimer > 0 && crystals.current && nc < STATUS_CAPACITY) {
        base.compose(tmpPos.set(enemyPos.x, enemyPos.y + e.height / 2, enemyPos.z), tmpQuat.setFromEuler(tmpEuler.set(0, e.id, 0)), tmpScale.set(e.radius * 1.5, e.height * 0.85 + 0.3, e.radius * 1.5));
        crystals.current.setMatrixAt(nc++, base);
      }
      const aiming = (e.kind === "sniper" && e.stateFlag) || (e.kind === "hunter" && e.move === "aim");
      if (aiming && sights.current && ns < STATUS_CAPACITY) {
        const from = tmpPos.set(enemyPos.x, enemyPos.y + (e.kind === "hunter" ? 1.3 : e.height / 2), enemyPos.z);
        dir.set(e.aimX - from.x, e.aimY - from.y, e.aimZ - from.z);
        const len = dir.length();
        if (len > 0.01) {
          dir.divideScalar(len);
          const flicker = e.fireCd < 0.35 && e.kind === "sniper" ? 2.2 : 1;
          base.compose(from, tmpQuat.setFromUnitVectors(FORWARD, dir), tmpScale.set(0.04 * flicker, 0.04 * flicker, len));
          sights.current.setMatrixAt(ns++, base);
        }
      }
    }
    for (const [m, n] of [
      [vines.current, nv],
      [crystals.current, nc],
      [sights.current, ns],
    ] as const) {
      if (!m) continue;
      m.count = n;
      m.visible = n > 0;
      m.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={vines} args={[res.cone, res.vine, STATUS_CAPACITY]} count={0} frustumCulled={false} />
      <instancedMesh ref={crystals} args={[res.octa, res.crystal, STATUS_CAPACITY]} count={0} frustumCulled={false} />
      <instancedMesh ref={sights} args={[res.beam, res.sight, STATUS_CAPACITY]} count={0} frustumCulled={false} />
    </>
  );
}

const REGULAR: RegularKind[] = ["crawler", "drone", "brute", "warden", "bomber", "sniper"];

export function Enemies() {
  return (
    <>
      {REGULAR.map((k) => (
        <EnemyKindView key={k} kind={k} />
      ))}
      <HealthBars />
      <StatusEffects />
    </>
  );
}
