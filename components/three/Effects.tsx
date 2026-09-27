"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  Color,
  DoubleSide,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  MeshBasicMaterial,
  type Points,
  Quaternion,
  RingGeometry,
  Vector3,
} from "three";
import { floorHeightAt } from "@/game/core/arena";
import { isBoss, type Actor } from "@/game/core/types";
import { MAX_PARTICLES } from "@/game/view/fx";
import { getRadialTexture } from "./geometry";
import { interpolated, useRuntime } from "./runtime-context";

/** Every particle in the game is one vertex of this single Points object (one draw call). */
export function Particles() {
  const runtime = useRuntime();
  const points = useRef<Points>(null);
  const geo = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
    g.setAttribute("color", new BufferAttribute(new Float32Array(MAX_PARTICLES * 3), 3));
    g.setDrawRange(0, 0);
    return g;
  }, []);

  useFrame(() => {
    const fx = runtime.fx;
    const n = fx.count;
    const posAttr = geo.attributes.position as BufferAttribute;
    const colAttr = geo.attributes.color as BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;
    posArr.set(fx.pos.subarray(0, n * 3));
    for (let i = 0; i < n; i++) {
      // Additive blending: fading the colour to black fades the particle out.
      const k = Math.max(0, fx.life[i] / fx.maxLife[i]) * 1.6;
      colArr[i * 3] = fx.col[i * 3] * k;
      colArr[i * 3 + 1] = fx.col[i * 3 + 1] * k;
      colArr[i * 3 + 2] = fx.col[i * 3 + 2] * k;
    }
    // Only upload the live part of the buffers.
    posAttr.clearUpdateRanges();
    colAttr.clearUpdateRanges();
    posAttr.addUpdateRange(0, n * 3);
    colAttr.addUpdateRange(0, n * 3);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    geo.setDrawRange(0, n);
    if (points.current) points.current.visible = n > 0;
  });

  return (
    <points ref={points} geometry={geo} frustumCulled={false}>
      <pointsMaterial
        size={0.26}
        sizeAttenuation
        vertexColors
        map={getRadialTexture()}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

const RING_POOL = 10;
const SLASH_POOL = 8;

/** Blaze's nova / Titan's quake rings and melee slash arcs, from small fixed mesh pools. */
export function CombatEffects() {
  const runtime = useRuntime();
  const rings = useRef<(Mesh | null)[]>([]);
  const slashes = useRef<(Mesh | null)[]>([]);
  const ringGeo = useMemo(() => new RingGeometry(0.88, 1, 56).rotateX(-Math.PI / 2), []);
  // Arc of ~126° centred on +X; rotated per slash to the swing direction.
  const slashGeo = useMemo(() => new RingGeometry(0.45, 1, 20, 1, -1.1, 2.2).rotateX(-Math.PI / 2), []);
  // Full-circle slash for spin attacks (Bramble Spin…).
  const spinGeo = useMemo(() => new RingGeometry(0.6, 1, 40).rotateX(-Math.PI / 2), []);
  const ringMats = useMemo(
    () => Array.from({ length: RING_POOL }, () => new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide })),
    [],
  );
  const slashMats = useMemo(
    () => Array.from({ length: SLASH_POOL }, () => new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false, side: DoubleSide })),
    [],
  );

  useFrame(() => {
    const sim = runtime.sim;
    rings.current.forEach((mesh, i) => {
      if (!mesh) return;
      const ring = sim.rings[i];
      mesh.visible = !!ring;
      if (!ring) return;
      const k = 1 - ring.life / ring.maxLife;
      const r = Math.max(0.05, ring.maxR * k);
      const body = ring.kind === "nova" || ring.kind === "supernova";
      mesh.position.set(ring.x, body ? ring.y : ring.y + 0.06, ring.z);
      mesh.scale.set(r, 1, r);
      const mat = ringMats[i];
      mat.color.set(ring.color).multiplyScalar(ring.kind === "supernova" ? 3 : body ? 2.5 : 1.6);
      mat.opacity = 1 - k;
    });
    slashes.current.forEach((mesh, i) => {
      if (!mesh) return;
      const s = sim.slashes[i];
      mesh.visible = !!s;
      if (!s) return;
      mesh.position.set(s.x, s.y, s.z);
      mesh.geometry = s.arc >= Math.PI * 0.9 ? spinGeo : slashGeo;
      mesh.rotation.y = Math.atan2(-s.fz, s.fx);
      const k = s.life / s.maxLife;
      mesh.scale.setScalar(s.range * (1.05 - k * 0.15));
      const mat = slashMats[i];
      mat.color.set(s.color).multiplyScalar(2.2);
      mat.opacity = k;
    });
  });

  return (
    <>
      {ringMats.map((mat, i) => (
        <mesh
          key={`r${i}`}
          ref={(m) => {
            rings.current[i] = m;
          }}
          geometry={ringGeo}
          material={mat}
          visible={false}
        />
      ))}
      {slashMats.map((mat, i) => (
        <mesh
          key={`s${i}`}
          ref={(m) => {
            slashes.current[i] = m;
          }}
          geometry={slashGeo}
          material={mat}
          visible={false}
        />
      ))}
    </>
  );
}

const BLOB_CAPACITY = 24;
const blobPos = new Vector3();
const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2);
const blobScale = new Vector3();
const blobMatrix = new Matrix4();

/** Low quality has no shadow maps: a soft dark disc under each actor keeps them grounded. */
export function BlobShadows() {
  const runtime = useRuntime();
  const mesh = useRef<InstancedMesh>(null);
  const geo = useMemo(() => new CircleGeometry(1, 20), []);
  const mat = useMemo(() => new MeshBasicMaterial({ color: "#000000", alphaMap: getRadialTexture(), transparent: true, opacity: 0.55, depthWrite: false }), []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    let n = 0;
    const add = (a: Actor, size: number) => {
      if (n >= BLOB_CAPACITY) return;
      interpolated(a, runtime.alpha, blobPos);
      const floor = floorHeightAt(blobPos.x, blobPos.z, blobPos.y + 0.05);
      const fade = 1 - Math.min(0.6, (blobPos.y - floor) / 8); // smaller when high up
      blobPos.y = floor + 0.03;
      blobMatrix.compose(blobPos, flat, blobScale.set(size * fade, size * fade, 1));
      m.setMatrixAt(n++, blobMatrix);
    };
    add(runtime.sim.player, runtime.sim.player.radius * 1.5);
    for (const e of runtime.sim.enemies) add(e, e.radius * (isBoss(e.kind) ? 1.1 : 1.4));
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, BLOB_CAPACITY]} count={0} frustumCulled={false} renderOrder={1} />;
}
