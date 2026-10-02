"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { AdditiveBlending, Color, DoubleSide, type Group, type Mesh, MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, RingGeometry, TorusGeometry, Vector3 } from "three";
import { isBoss } from "@/game/core/types";
import { dampAngle, interpolated, useRuntime, yawOf } from "./runtime-context";

const pos = new Vector3();
const SHARDS = 6;
const BODY = new Color("#3b0764");
const ENRAGED = new Color("#7f1d1d");

/** The Void Sovereign (campaign level 10): a floating crystal titan with orbiting shards and a halo. */
export function OmegaBoss() {
  const runtime = useRuntime();
  const root = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const shards = useRef<(Mesh | null)[]>([]);
  const yaw = useRef(0);
  const res = useMemo(
    () => ({
      octa: new OctahedronGeometry(1, 0),
      torus: new TorusGeometry(1.3, 0.07, 6, 40),
      body: new MeshStandardMaterial({ color: BODY.clone(), roughness: 0.25, metalness: 0.2, emissive: "#6b21a8", emissiveIntensity: 0.7, flatShading: true }),
      glow: new MeshBasicMaterial({ color: new Color("#e879f9").multiplyScalar(3), toneMapped: false }),
      shard: new MeshBasicMaterial({ color: new Color("#c084fc").multiplyScalar(2.2), toneMapped: false }),
    }),
    [],
  );

  useFrame((_, dt) => {
    const boss = runtime.sim.enemies.find((e) => e.kind === "omega");
    const g = root.current;
    if (!g) return;
    g.visible = !!boss;
    if (!boss) return;
    const t = runtime.time;
    interpolated(boss, runtime.alpha, pos);
    g.position.copy(pos);
    yaw.current = dampAngle(yaw.current, yawOf(boss.fx, boss.fz), 2.5, dt);
    g.rotation.y = yaw.current;
    // Death: shake apart and tilt over.
    if (boss.dying > 0) {
      g.position.x += Math.sin(t * 60) * 0.12;
      g.rotation.z = (2.2 - boss.dying) * 0.25;
    } else g.rotation.z = 0;

    res.body.color.copy(boss.enraged ? ENRAGED : BODY);
    if (boss.hitFlash > 0) res.body.color.setRGB(2.5, 2.5, 2.5);
    const charging = boss.move === "laser" || boss.move === "collapse";
    if (core.current) core.current.scale.setScalar(0.42 + Math.sin(t * (boss.enraged ? 14 : 6)) * 0.06 + (charging ? 0.15 : 0));
    if (halo.current) {
      halo.current.rotation.z = t * (boss.enraged ? 2 : 0.7);
      halo.current.scale.setScalar(1 + boss.bossPhase * 0.15);
    }
    shards.current.forEach((m, i) => {
      if (!m) return;
      const a = (i / SHARDS) * Math.PI * 2 + t * (0.8 + boss.bossPhase * 0.4);
      const r = 2.3 + Math.sin(t * 2 + i) * 0.2;
      m.position.set(Math.cos(a) * r, 2 + Math.sin(t * 1.5 + i * 1.3) * 0.6, Math.sin(a) * r);
      m.rotation.set(t * 2 + i, t * 1.4, 0);
    });
  });

  return (
    <group ref={root} visible={false}>
      {/* Main crystal body, head and arms. */}
      <mesh geometry={res.octa} material={res.body} position={[0, 2, 0]} scale={[0.95, 1.9, 0.95]} castShadow />
      <mesh geometry={res.octa} material={res.body} position={[0, 3.85, 0]} scale={[0.45, 0.6, 0.45]} castShadow />
      <mesh geometry={res.octa} material={res.body} position={[1.2, 2.4, 0.1]} rotation={[0, 0, -0.5]} scale={[0.3, 1.1, 0.3]} castShadow />
      <mesh geometry={res.octa} material={res.body} position={[-1.2, 2.4, 0.1]} rotation={[0, 0, 0.5]} scale={[0.3, 1.1, 0.3]} castShadow />
      <mesh ref={core} geometry={res.octa} material={res.glow} position={[0, 2.3, 0.55]} />
      <mesh geometry={res.octa} material={res.glow} position={[0, 3.9, 0.32]} scale={[0.16, 0.06, 0.05]} />
      <mesh ref={halo} geometry={res.torus} material={res.glow} position={[0, 3.9, -0.45]} />
      {Array.from({ length: SHARDS }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            shards.current[i] = m;
          }}
          geometry={res.octa}
          material={res.shard}
          scale={[0.18, 0.45, 0.18]}
        />
      ))}
    </group>
  );
}

const auraMat = new MeshBasicMaterial({ color: new Color("#ef4444").multiplyScalar(2), transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false });
const auraGeo = new RingGeometry(0.75, 1, 40).rotateX(-Math.PI / 2);

/** Pulsing red ring under any enraged boss (all four bosses share it). */
export function BossAura() {
  const runtime = useRuntime();
  const ring = useRef<Mesh>(null);
  useFrame(() => {
    const m = ring.current;
    if (!m) return;
    const boss = runtime.sim.enemies.find((e) => isBoss(e.kind) && e.enraged && e.dying <= 0);
    m.visible = !!boss;
    if (!boss) return;
    interpolated(boss, runtime.alpha, pos);
    const pulse = 1 + Math.sin(runtime.time * 10) * 0.08;
    m.position.set(pos.x, Math.max(0.06, pos.y > 1 ? 0.06 : pos.y + 0.06), pos.z);
    m.scale.setScalar((boss.radius + 1.2) * pulse);
  });
  return <mesh ref={ring} geometry={auraGeo} material={auraMat} visible={false} renderOrder={3} />;
}
