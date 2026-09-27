"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  type Group,
  type InstancedMesh,
  Matrix4,
  type Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from "three";
import { floorHeightAt } from "@/game/core/arena";
import type { Enemy } from "@/game/core/types";
import { getRadialTexture } from "./geometry";
import { dampAngle, interpolated, useRuntime, yawOf } from "./runtime-context";

const RIM_LIGHTS = 14;
const pos = new Vector3();
const m = new Matrix4();
const lightOn = new Color("#fde047").multiplyScalar(3);
const lightOff = new Color("#6366f1").multiplyScalar(1.5);

/** "Overlord Vexx" mothership + the red footprint that warns where its dive will land. */
export function VexxBoss() {
  const runtime = useRuntime();
  const ship = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const rim = useRef<InstancedMesh>(null);
  const warning = useRef<Group>(null);
  const warnMat = useRef<MeshBasicMaterial>(null);
  const yaw = useRef(0);
  const hullMat = useMemo(() => new MeshStandardMaterial({ color: "#312e81", roughness: 0.35, metalness: 0.25, emissive: "#312e81", emissiveIntensity: 0.5 }), []);
  const hullColor = useMemo(() => new Color("#312e81"), []);
  const rimGeo = useMemo(() => new BoxGeometry(0.22, 0.22, 0.22), []);

  useLayoutEffect(() => {
    const r = rim.current;
    if (!r) return;
    for (let i = 0; i < RIM_LIGHTS; i++) {
      const a = (i / RIM_LIGHTS) * Math.PI * 2;
      r.setMatrixAt(i, m.makeTranslation(Math.cos(a) * 2.72, 0.92, Math.sin(a) * 2.72));
      r.setColorAt(i, lightOff);
    }
    r.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, dt) => {
    const t = runtime.time;
    const boss: Enemy | undefined = runtime.sim.enemies.find((e) => e.kind === "vexx");
    const g = ship.current;
    if (!g) return;
    g.visible = !!boss;
    if (warning.current) warning.current.visible = !!boss && boss.move === "dive";
    if (!boss) return;

    interpolated(boss, runtime.alpha, pos);
    g.position.copy(pos);
    yaw.current = dampAngle(yaw.current, yawOf(boss.fx, boss.fz), 2, dt);
    g.rotation.y = yaw.current;
    g.rotation.z = boss.move === "dive" ? 0 : Math.sin(t * 1.1) * 0.05; // gentle hover wobble

    // Hit flash on the hull.
    hullMat.color.copy(hullColor);
    if (boss.hitFlash > 0) hullMat.color.setRGB(2.5, 2.5, 2.5);

    const enraged = boss.hp < boss.maxHp / 2;
    if (core.current) core.current.scale.setScalar(0.45 + Math.sin(t * (enraged ? 12 : 6)) * 0.08);

    const r = rim.current;
    if (r) {
      for (let i = 0; i < RIM_LIGHTS; i++) r.setColorAt(i, Math.floor(t * 6 + i) % 3 === 0 ? lightOn : lightOff);
      if (r.instanceColor) r.instanceColor.needsUpdate = true;
    }

    // Dive warning: pulses faster and brighter as the ship gets closer to the street.
    const w = warning.current;
    if (w && boss.move === "dive") {
      w.position.set(pos.x, floorHeightAt(pos.x, pos.z, 0.5) + 0.04, pos.z);
      const closeness = 1 - Math.min(1, pos.y / 5);
      if (warnMat.current) warnMat.current.opacity = (0.35 + closeness * 0.5) * (0.65 + Math.sin(t * (10 + closeness * 14)) * 0.35);
      w.scale.setScalar(boss.radius * (1.15 - closeness * 0.15));
    }
  });

  return (
    <>
      <group ref={ship} visible={false}>
        <mesh material={hullMat} position-y={0.95} scale={[2.8, 0.7, 2.8]} castShadow>
          <sphereGeometry args={[1, 32, 16]} />
        </mesh>
        <mesh position-y={0.4} castShadow>
          <cylinderGeometry args={[2.1, 1.5, 0.45, 24]} />
          <meshStandardMaterial color="#1e1b4b" roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position-y={1.45} scale={[1.15, 0.95, 1.15]}>
          <sphereGeometry args={[1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#a78bfa" transparent opacity={0.55} roughness={0.1} metalness={0.2} emissive="#7c3aed" emissiveIntensity={0.6} />
        </mesh>
        {/* Pilot silhouette with glowing eyes */}
        <mesh position-y={1.65}>
          <sphereGeometry args={[0.38, 16, 12]} />
          <meshStandardMaterial color="#1e1b4b" />
        </mesh>
        {[-0.13, 0.13].map((x) => (
          <mesh key={x} position={[x, 1.7, 0.33]}>
            <boxGeometry args={[0.12, 0.05, 0.05]} />
            <meshBasicMaterial color={[3, 0.3, 0.3]} toneMapped={false} />
          </mesh>
        ))}
        {[-1.2, 1.2].map((x) => (
          <mesh key={x} position={[x, 0.25, 0.6]} rotation-x={Math.PI / 2} castShadow>
            <cylinderGeometry args={[0.16, 0.2, 0.9, 10]} />
            <meshStandardMaterial color="#111827" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        <mesh ref={core} position-y={0.12}>
          <sphereGeometry args={[1, 20, 12]} />
          <meshBasicMaterial color={[3, 0.25, 0.25]} toneMapped={false} />
        </mesh>
        <instancedMesh ref={rim} args={[rimGeo, undefined, RIM_LIGHTS]}>
          <meshBasicMaterial toneMapped={false} />
        </instancedMesh>
      </group>

      <group ref={warning} visible={false}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1, 40]} />
          <meshBasicMaterial ref={warnMat} color={[2.2, 0.2, 0.35]} alphaMap={getRadialTexture()} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
          <ringGeometry args={[0.92, 1, 48]} />
          <meshBasicMaterial color={[2.5, 0.25, 0.4]} transparent opacity={0.9} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}
