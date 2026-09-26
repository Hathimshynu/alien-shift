"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  BoxGeometry,
  type BufferGeometry,
  Color,
  type InstancedMesh,
  type Material,
  Matrix4,
  MeshBasicMaterial,
  OctahedronGeometry,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { STEP } from "@/game/core/arena";
import type { ProjectileKind } from "@/game/core/types";
import { useRuntime } from "./runtime-context";

const CAPACITY = 96;
const FORWARD = new Vector3(0, 0, 1);
const pos = new Vector3();
const dir = new Vector3();
const quat = new Quaternion();
const scale = new Vector3();
const m = new Matrix4();

const glow = (color: string, k: number) => new MeshBasicMaterial({ color: new Color(color).multiplyScalar(k), toneMapped: false });

interface KindDef {
  kind: ProjectileKind;
  geo: BufferGeometry;
  mat: Material;
  /** Scale relative to the projectile radius; crystals are stretched along their flight direction. */
  size: [number, number, number];
}

/** All shots, one InstancedMesh per look (fire has an extra bright core). */
export function Projectiles() {
  const runtime = useRuntime();
  const defs = useMemo<KindDef[]>(() => {
    const sphere = new SphereGeometry(1, 12, 8);
    return [
      { kind: "fire", geo: sphere, mat: glow("#f97316", 2.6), size: [1.1, 1.1, 1.4] },
      { kind: "fire", geo: sphere, mat: glow("#fef08a", 3), size: [0.55, 0.55, 0.7] },
      { kind: "crystal", geo: new OctahedronGeometry(1, 0), mat: glow("#5eead4", 2.4), size: [0.55, 0.55, 2] },
      { kind: "bullet", geo: sphere, mat: glow("#f43f5e", 2.8), size: [1, 1, 1.6] },
      { kind: "plasma", geo: sphere, mat: glow("#c084fc", 2.6), size: [1, 1, 1.3] },
    ];
  }, []);
  const meshes = useRef<(InstancedMesh | null)[]>([]);

  useFrame(() => {
    const counts = defs.map(() => 0);
    // Draw each shot where it was a fraction of a step ago, for smooth motion between sim steps.
    const back = (runtime.alpha - 1) * STEP;
    for (const pr of runtime.sim.projectiles) {
      pos.set(pr.x + pr.vx * back, pr.y + pr.vy * back, pr.z + pr.vz * back);
      dir.set(pr.vx, pr.vy, pr.vz).normalize();
      quat.setFromUnitVectors(FORWARD, dir);
      defs.forEach((d, j) => {
        const mesh = meshes.current[j];
        if (d.kind !== pr.kind || !mesh || counts[j] >= CAPACITY) return;
        m.compose(pos, quat, scale.set(d.size[0] * pr.r, d.size[1] * pr.r, d.size[2] * pr.r));
        mesh.setMatrixAt(counts[j]++, m);
      });
    }
    defs.forEach((_, j) => {
      const mesh = meshes.current[j];
      if (!mesh) return;
      mesh.count = counts[j];
      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <>
      {defs.map((d, j) => (
        <instancedMesh
          key={j}
          ref={(mesh) => {
            meshes.current[j] = mesh;
          }}
          args={[d.geo, d.mat, CAPACITY]}
          count={0}
          frustumCulled={false}
        />
      ))}
    </>
  );
}

const PICKUP_CAPACITY = 24;

/** Energy crystals (green) and health orbs (pink with a white cross), bobbing and spinning. */
export function Pickups() {
  const runtime = useRuntime();
  const energy = useRef<InstancedMesh>(null);
  const health = useRef<InstancedMesh>(null);
  const cross = useRef<InstancedMesh>(null);
  const geos = useMemo(() => ({ octa: new OctahedronGeometry(1, 0), sphere: new SphereGeometry(1, 14, 10), box: new BoxGeometry(1, 1, 1) }), []);
  const mats = useMemo(() => ({ energy: glow("#22c55e", 2.4), health: glow("#f472b6", 2), cross: glow("#ffffff", 2.5) }), []);

  useFrame(() => {
    const t = runtime.time;
    let ne = 0;
    let nh = 0;
    for (const pk of runtime.sim.pickups) {
      if (pk.life < 2 && Math.sin(t * 20) > 0) continue; // blink before vanishing
      const y = pk.y + 0.4 + Math.sin(t * 4 + pk.id) * 0.08;
      quat.setFromAxisAngle(pos.set(0, 1, 0), t * 2 + pk.id);
      if (pk.kind === "energy" && energy.current && ne < PICKUP_CAPACITY) {
        m.compose(pos.set(pk.x, y, pk.z), quat, scale.set(0.22, 0.34, 0.22));
        energy.current.setMatrixAt(ne++, m);
      } else if (pk.kind === "health" && health.current && cross.current && nh < PICKUP_CAPACITY) {
        m.compose(pos.set(pk.x, y, pk.z), quat, scale.setScalar(0.24));
        health.current.setMatrixAt(nh, m);
        m.compose(pos, quat, scale.set(0.3, 0.08, 0.3)); // flat cross bars
        cross.current.setMatrixAt(nh * 2, m);
        m.compose(pos, quat, scale.set(0.08, 0.3, 0.3));
        cross.current.setMatrixAt(nh * 2 + 1, m);
        nh++;
      }
    }
    for (const [mesh, count] of [
      [energy.current, ne],
      [health.current, nh],
      [cross.current, nh * 2],
    ] as const) {
      if (!mesh) continue;
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={energy} args={[geos.octa, mats.energy, PICKUP_CAPACITY]} count={0} frustumCulled={false} />
      <instancedMesh ref={health} args={[geos.sphere, mats.health, PICKUP_CAPACITY]} count={0} frustumCulled={false} />
      <instancedMesh ref={cross} args={[geos.box, mats.cross, PICKUP_CAPACITY * 2]} count={0} frustumCulled={false} />
    </>
  );
}
