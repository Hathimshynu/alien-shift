"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  type BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  type Group,
  type InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from "three";
import { floorHeightAt } from "@/game/core/arena";
import { PUNCH_WAVE_SPEED } from "@/game/core/powers";
import type { Zone } from "@/game/core/types";
import { mulberry32, getRadialTexture } from "./geometry";
import { useRuntime } from "./runtime-context";

const CAP = 64;
const m = new Matrix4();
const p = new Vector3();
const q = new Quaternion();
const s = new Vector3();
const e = new Euler();
const c = new Color();
const FORWARD = new Vector3(0, 0, 1);
const dir = new Vector3();
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);

/** Deterministic spike layout for a thorn field (stable per zone id). */
const thornLayout = (id: number) => {
  const r = mulberry32(id);
  return Array.from({ length: 34 }, () => ({ a: r() * Math.PI * 2, d: Math.sqrt(r()), h: 0.6 + r() * 0.9, tilt: (r() - 0.5) * 0.6 }));
};

/**
 * Draws every zone (see game/core/zones.ts). All pools are InstancedMeshes that are hidden when
 * empty, so an idle arena costs no draw calls here.
 */
export function Zones() {
  const runtime = useRuntime();
  const refs = {
    warnDisc: useRef<InstancedMesh>(null),
    warnRing: useRef<InstancedMesh>(null),
    fallers: useRef<InstancedMesh>(null),
    missiles: useRef<InstancedMesh>(null),
    pillars: useRef<InstancedMesh>(null),
    rocks: useRef<InstancedMesh>(null),
    lines: useRef<InstancedMesh>(null),
    walls: useRef<InstancedMesh>(null),
    thorns: useRef<InstancedMesh>(null),
    petals: useRef<InstancedMesh>(null),
    turretBody: useRef<InstancedMesh>(null),
    turretEye: useRef<InstancedMesh>(null),
    waveFront: useRef<InstancedMesh>(null),
  };
  const vortex = useRef<Group>(null);
  const thornCache = useRef(new Map<number, ReturnType<typeof thornLayout>>());

  const res = useMemo(() => {
    const additive = (opacity = 1) => new MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide });
    return {
      disc: new CircleGeometry(1, 40),
      ring: new RingGeometry(0.9, 1, 48),
      sphere: new SphereGeometry(1, 12, 10),
      cone: new ConeGeometry(1, 1, 7),
      cylinder: new CylinderGeometry(1, 1, 1, 12, 1, true),
      beam: new BoxGeometry(1, 1, 1).translate(0, 0, 0.5), // extends along +Z from its origin
      box: new BoxGeometry(1, 1, 1),
      discMat: Object.assign(additive(0.5), { alphaMap: getRadialTexture() }),
      ringMat: additive(0.95),
      glowMat: new MeshBasicMaterial({ color: "#ffffff", toneMapped: false }),
      pillarMat: additive(0.8),
      lineMat: additive(0.9),
      rockMat: new MeshStandardMaterial({ color: "#78716c", roughness: 0.95, emissive: "#292524", emissiveIntensity: 1 }),
      wallMat: new MeshBasicMaterial({ color: new Color("#bae6fd").multiplyScalar(1.3), transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }),
      thornMat: new MeshStandardMaterial({ color: "#4d7c0f", roughness: 0.8, emissive: "#365314", emissiveIntensity: 0.6 }),
      petalMat: new MeshBasicMaterial({ color: new Color("#f9a8d4").multiplyScalar(1.6), toneMapped: false }),
      turretMat: new MeshStandardMaterial({ color: "#94a3b8", roughness: 0.4, emissive: "#334155", emissiveIntensity: 1 }),
      eyeMat: new MeshBasicMaterial({ color: new Color("#22d3ee").multiplyScalar(3), toneMapped: false }),
    };
  }, []);

  useFrame(() => {
    const sim = runtime.sim;
    const t = runtime.time;
    const n: Record<keyof typeof refs, number> = {
      warnDisc: 0, warnRing: 0, fallers: 0, missiles: 0, pillars: 0, rocks: 0, lines: 0, walls: 0, thorns: 0, petals: 0, turretBody: 0, turretEye: 0, waveFront: 0,
    };
    const put = (key: keyof typeof refs, matrix: Matrix4, color?: Color) => {
      const mesh = refs[key].current;
      if (!mesh || n[key] >= mesh.instanceMatrix.count) return;
      mesh.setMatrixAt(n[key], matrix);
      if (color) mesh.setColorAt(n[key], color);
      n[key]++;
    };
    const line = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, width: number, color: Color) => {
      dir.set(x2 - x1, y2 - y1, z2 - z1);
      const len = dir.length();
      if (len < 0.01) return;
      dir.divideScalar(len);
      m.compose(p.set(x1, y1, z1), q.setFromUnitVectors(FORWARD, dir), s.set(width, width, len));
      put("lines", m, color);
    };
    let vortexZone: Zone | null = null;

    for (const z of sim.zones) {
      const k = z.delay > 0 ? Math.min(1, z.t / z.delay) : 1;
      const floor = z.kind === "blast" || z.kind === "laser" ? floorHeightAt(z.x, z.z, 1) + 0.04 : z.y;
      switch (z.kind) {
        case "blast": {
          if (z.t < z.delay) {
            // Telegraph: filling disc + pulsing ring, faster as it's about to hit.
            const pulse = 0.6 + Math.sin(t * (8 + k * 16)) * 0.4;
            c.set(z.color).multiplyScalar(0.6 + k * 1.2);
            m.compose(p.set(z.x, floor, z.z), FLAT, s.set(z.r * k, z.r * k, 1));
            put("warnDisc", m, c);
            c.set(z.color).multiplyScalar(1.4 * pulse);
            m.compose(p.set(z.x, floor + 0.01, z.z), FLAT, s.set(z.r, z.r, 1));
            put("warnRing", m, c);
            if (z.style === "meteor") {
              m.compose(p.set(z.x + (1 - k) * 6, floor + 28 * (1 - k), z.z - (1 - k) * 4), q.identity(), s.setScalar(0.9));
              put("fallers", m, c.set("#fb923c").multiplyScalar(2.2));
            } else if (z.style === "missile") {
              m.compose(p.set(z.x, floor + 18 * (1 - k) + 0.3, z.z), q.setFromEuler(e.set(Math.PI, 0, 0)), s.set(0.2, 0.9, 0.2));
              put("missiles", m, c.set("#fb923c").multiplyScalar(2));
            } else if (z.style === "orbital") {
              // Thin targeting beam from the sky.
              m.compose(p.set(z.x, floor + 15, z.z), q.identity(), s.set(0.08, 30, 0.08));
              put("pillars", m, c.set(z.color).multiplyScalar(0.8 + pulse * 0.6));
            }
          } else {
            const f = 1 - Math.min(1, (z.t - z.delay) / Math.max(0.05, z.life - z.delay));
            if (z.style === "rock") {
              // Spike erupts, holds, then sinks back.
              const up = Math.min(1, (z.t - z.delay) / 0.12);
              const down = Math.min(1, (z.life - z.t) / 0.4);
              const h = 2.2 * up * down;
              m.compose(p.set(z.x, floor + h / 2 - 0.1, z.z), q.setFromEuler(e.set(0.15 * Math.sin(z.id), z.id, 0.15 * Math.cos(z.id))), s.set(0.7, h, 0.7));
              put("rocks", m);
            } else {
              c.set(z.color).multiplyScalar(2 * f);
              m.compose(p.set(z.x, floor + 0.02, z.z), FLAT, s.set(z.r * (1 + (1 - f) * 0.3), z.r * (1 + (1 - f) * 0.3), 1));
              put("warnRing", m, c);
              if (z.style === "orbital") {
                m.compose(p.set(z.x, floor + 15, z.z), q.identity(), s.set(z.r * 0.8 * f, 30, z.r * 0.8 * f));
                put("pillars", m, c.set(z.color).multiplyScalar(3 * f));
              }
            }
          }
          break;
        }
        case "laser": {
          const ex = z.x + Math.cos(z.angle) * z.r;
          const ez = z.z + Math.sin(z.angle) * z.r;
          const active = z.t >= z.delay && z.dmg > 0;
          const width = active ? 0.55 + Math.sin(t * 40) * 0.08 : 0.08 + k * 0.08;
          c.set(z.color).multiplyScalar(active ? 3 : 0.9 + Math.sin(t * 20) * 0.4);
          line(z.x, floor + 0.05, z.z, ex, floor + 0.05, ez, width, c);
          break;
        }
        case "beam": {
          const f = Math.max(0, 1 - z.t / z.life);
          c.set(z.color).multiplyScalar(2.6 * f);
          line(z.x, z.y, z.z, z.x2, z.y2, z.z2, Math.max(0.04, z.r * (0.5 + f * 0.5)), c);
          break;
        }
        case "iceWall": {
          const grow = Math.min(1, z.t / 0.2) * Math.min(1, (z.life - z.t) / 0.3);
          m.compose(p.set(z.x, 1.1 * grow, z.z), q.setFromEuler(e.set(0, z.angle, 0)), s.set(z.r, 2.2 * grow, 0.6));
          put("walls", m);
          break;
        }
        case "thorns": {
          let layout = thornCache.current.get(z.id);
          if (!layout) thornCache.current.set(z.id, (layout = thornLayout(z.id)));
          const grow = Math.min(1, z.t / 0.4) * Math.min(1, (z.life - z.t) / 0.5);
          for (const th of layout) {
            const x = z.x + Math.cos(th.a) * th.d * z.r;
            const zz = z.z + Math.sin(th.a) * th.d * z.r;
            m.compose(p.set(x, (th.h * grow) / 2, zz), q.setFromEuler(e.set(th.tilt, th.a, -th.tilt)), s.set(0.12, th.h * grow, 0.12));
            put("thorns", m);
          }
          c.set("#65a30d").multiplyScalar(0.8);
          m.compose(p.set(z.x, 0.03, z.z), FLAT, s.set(z.r, z.r, 1));
          put("warnRing", m, c);
          break;
        }
        case "bloom": {
          const open = Math.min(1, z.t / 0.5) * Math.min(1, (z.life - z.t) / 0.4);
          for (let i = 0; i < 8; i++) {
            const a = (i / 8) * Math.PI * 2 + z.t;
            m.compose(p.set(z.x + Math.cos(a) * z.r * 0.6 * open, z.y + 0.2, z.z + Math.sin(a) * z.r * 0.6 * open), q.setFromEuler(e.set(Math.PI / 2 - 0.6, -a + Math.PI / 2, 0)), s.set(0.35 * open, 1.1 * open, 0.12 * open));
            put("petals", m);
          }
          break;
        }
        case "turret": {
          m.compose(p.set(z.x, z.y, z.z), q.setFromEuler(e.set(0, t * 2, 0)), s.set(0.32, 0.18, 0.32));
          put("turretBody", m);
          m.compose(p.set(z.x, z.y - 0.1, z.z), q.identity(), s.setScalar(0.1));
          put("turretEye", m);
          break;
        }
        case "wave": {
          // Power Punch shockwave: a bright wall of force rolling forward, tearing up the ground.
          const front = Math.min(z.r, z.t * PUNCH_WAVE_SPEED);
          const fade = Math.min(1, (z.life - z.t) / 0.25);
          const width = z.spin + (front / z.r) * 2.6;
          const dx = Math.cos(z.angle);
          const dz = Math.sin(z.angle);
          const yaw = Math.atan2(dx, dz);
          c.set(z.color).multiplyScalar(2.6 * fade);
          m.compose(p.set(z.x + dx * front, z.y + 0.6, z.z + dz * front), q.setFromEuler(e.set(0, yaw, 0)), s.set(width, 1.2, 0.5));
          put("waveFront", m, c);
          c.set(z.color).multiplyScalar(1.2 * fade);
          m.compose(p.set(z.x + dx * front * 0.5, z.y + 0.05, z.z + dz * front * 0.5), q.setFromEuler(e.set(-Math.PI / 2, 0, -z.angle)), s.set(front * 0.5 + 0.5, width * 0.45, 1));
          put("warnDisc", m, c);
          if (front < z.r) {
            for (let i = 0; i < 2; i++) {
              const side = (i ? 1 : -1) * width * 0.35;
              m.compose(p.set(z.x + dx * front - dz * side, z.y + 0.3, z.z + dz * front + dx * side), q.setFromEuler(e.set(0.4, z.id + t * 9 + i, 0)), s.set(0.35, 0.9, 0.35));
              put("rocks", m);
            }
          }
          break;
        }
        case "collapse": {
          // Void Collapse: the whole arena darkens; the safe circle glows green.
          if (z.t < z.delay) {
            const pulse = 0.6 + Math.sin(t * (6 + k * 18)) * 0.4;
            c.set(z.color).multiplyScalar(0.25 + k * 0.6);
            m.compose(p.set(0, 0.03, 0), FLAT, s.set(30, 30, 1));
            put("warnDisc", m, c);
            c.set("#4ade80").multiplyScalar(1.5 + pulse);
            m.compose(p.set(z.x, 0.06, z.z), FLAT, s.set(z.r, z.r, 1));
            put("warnRing", m, c);
            m.compose(p.set(z.x, 5, z.z), q.identity(), s.set(z.r * 0.95, 10, z.r * 0.95));
            put("pillars", m, c.set("#4ade80").multiplyScalar(0.5 + pulse * 0.3));
          } else {
            const f = Math.max(0, 1 - (z.t - z.delay) / 0.5);
            c.set(z.color).multiplyScalar(2.5 * f);
            m.compose(p.set(0, 0.05, 0), FLAT, s.set(30 * (1.2 - f * 0.2), 30 * (1.2 - f * 0.2), 1));
            put("warnRing", m, c);
          }
          break;
        }
        case "vortex":
          vortexZone = z;
          break;
        default:
          break;
      }
    }

    for (const key of Object.keys(refs) as (keyof typeof refs)[]) {
      const mesh = refs[key].current;
      if (!mesh) continue;
      mesh.count = n[key];
      mesh.visible = n[key] > 0;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    // One black hole at a time is plenty.
    const v = vortex.current;
    if (v) {
      v.visible = !!vortexZone;
      if (vortexZone) {
        const z = vortexZone;
        const grow = Math.min(1, z.t / 0.4) * Math.min(1, (z.life - z.t) / 0.25 + 0.2);
        v.position.set(z.x, z.y, z.z);
        v.scale.setScalar(grow);
        v.children[1].rotation.set(Math.PI / 2 + 0.3, 0, t * 6);
        v.children[2].rotation.set(Math.PI / 2 - 0.4, 0, -t * 4);
        v.children[3].scale.setScalar(z.r * (0.9 + Math.sin(t * 5) * 0.05));
      }
    }
  });

  const pool = (key: keyof typeof refs, geo: BufferGeometry, mat: MeshBasicMaterial | MeshStandardMaterial, capacity = CAP, order = 0) => (
    <instancedMesh ref={refs[key]} args={[geo, mat, capacity]} count={0} visible={false} frustumCulled={false} renderOrder={order} />
  );

  return (
    <>
      {pool("warnDisc", res.disc, res.discMat, CAP, 2)}
      {pool("warnRing", res.ring, res.ringMat, CAP, 3)}
      {pool("fallers", res.sphere, res.glowMat, 24)}
      {pool("missiles", res.cone, res.glowMat, 24)}
      {pool("pillars", res.cylinder, res.pillarMat, 16, 4)}
      {pool("rocks", res.cone, res.rockMat, 96)}
      {pool("lines", res.beam, res.lineMat, 48, 4)}
      {pool("walls", res.box, res.wallMat, 8, 3)}
      {pool("thorns", res.cone, res.thornMat, 80)}
      {pool("petals", res.cone, res.petalMat, 16)}
      {pool("turretBody", res.sphere, res.turretMat, 4)}
      {pool("turretEye", res.sphere, res.eyeMat, 4)}
      {pool("waveFront", res.box, res.lineMat, 12, 4)}
      <group ref={vortex} visible={false}>
        <mesh>
          <sphereGeometry args={[1.3, 24, 16]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        <mesh>
          <torusGeometry args={[2, 0.12, 8, 48]} />
          <meshBasicMaterial color={[1.6, 0.9, 3]} toneMapped={false} />
        </mesh>
        <mesh>
          <torusGeometry args={[2.8, 0.07, 8, 48]} />
          <meshBasicMaterial color={[0.9, 0.5, 2.4]} toneMapped={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={-1.1}>
          <ringGeometry args={[0.95, 1, 64]} />
          <meshBasicMaterial color={[0.8, 0.4, 2]} transparent opacity={0.6} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}
