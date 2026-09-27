"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import { Color, type Group, MeshBasicMaterial, MeshStandardMaterial, Vector3 } from "three";
import type { Enemy } from "@/game/core/types";
import { dampAngle, interpolated, useRuntime, yawOf } from "./runtime-context";

const LEGS = 8;
/** Forward component (sin of the angle) of each leg on one side, front to back. */
const LEG_FAN = [0.75, 0.28, -0.28, -0.75];
const pos = new Vector3();
const bodyColor = new Color("#44403c");
const glowColor = new Color("#ef4444");
const FLASH = new Color(2.5, 2.5, 2.5);

/** Arachnid Mk-IX: a spider mech. One of a kind on screen, so plain meshes (≈30 draws) are fine. */
export function SpiderBoss() {
  const runtime = useRuntime();
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const legs = useRef<(Group | null)[]>([]);
  const yaw = useRef(0);
  const mats = useMemo(
    () => ({
      hull: new MeshStandardMaterial({ color: "#44403c", roughness: 0.45, metalness: 0.2, emissive: "#1c1917", emissiveIntensity: 1 }),
      leg: new MeshStandardMaterial({ color: "#292524", roughness: 0.5, metalness: 0.2, emissive: "#0c0a09", emissiveIntensity: 1 }),
      glow: new MeshBasicMaterial({ color: glowColor.clone().multiplyScalar(2.2), toneMapped: false }),
      eyes: new MeshBasicMaterial({ color: new Color("#f43f5e").multiplyScalar(3), toneMapped: false }),
    }),
    [],
  );

  useFrame((_, dt) => {
    const e: Enemy | undefined = runtime.sim.enemies.find((x) => x.kind === "spider");
    const g = root.current;
    if (!g) return;
    g.visible = !!e;
    if (!e) return;
    const t = runtime.time;
    interpolated(e, runtime.alpha, pos);
    g.position.copy(pos);
    yaw.current = dampAngle(yaw.current, yawOf(e.fx, e.fz), 3, dt);
    g.rotation.y = yaw.current;

    // Body bob and hit flash; the glow strips pulse harder each phase.
    if (body.current) body.current.position.y = 2 + Math.sin(t * 6) * 0.06;
    mats.hull.color.copy(e.hitFlash > 0 ? FLASH : bodyColor);
    const pulse = 1.6 + e.bossPhase * 0.8 + Math.sin(t * (4 + e.bossPhase * 4)) * 0.6;
    mats.glow.color.copy(glowColor).multiplyScalar(pulse);

    // Legs: alternate sets swing while walking; all legs tuck during a leap.
    const speed = Math.hypot(e.vx, e.vz);
    const leaping = e.move === "leap";
    legs.current.forEach((leg, i) => {
      if (!leg) return;
      // Each leg points out along its group's +X; rotate so the four legs per side fan from
      // front (+Z) to back (-Z). A Y-rotation θ maps +X to (cos θ, 0, −sin θ).
      const side = i < LEGS / 2 ? 1 : -1;
      const z = LEG_FAN[i % (LEGS / 2)];
      const baseYaw = side > 0 ? -Math.asin(z) : Math.PI + Math.asin(z);
      const swing = Math.sin(t * 9 + (i % 2) * Math.PI) * 0.22 * Math.min(1, speed / 2);
      leg.rotation.set(0, baseYaw + swing, leaping ? -0.5 : Math.max(0, Math.sin(t * 9 + (i % 2) * Math.PI)) * 0.15 * Math.min(1, speed / 2));
    });
  });

  return (
    <group ref={root} visible={false}>
      <group ref={body} position-y={2}>
        {/* Abdomen */}
        <mesh material={mats.hull} position={[0, 0.2, -1.1]} scale={[1.5, 1.1, 1.8]} castShadow>
          <sphereGeometry args={[1, 20, 14]} />
        </mesh>
        {/* Glowing stripes on the abdomen */}
        {[-0.5, 0, 0.5].map((z) => (
          <mesh key={z} material={mats.glow} position={[0, 1.2, -1.1 + z * 1.4]} scale={[1.1, 0.06, 0.12]}>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
        ))}
        {/* Thorax / head */}
        <mesh material={mats.hull} position={[0, 0, 0.6]} scale={[1.1, 0.8, 1]} castShadow>
          <sphereGeometry args={[1, 18, 12]} />
        </mesh>
        {/* Eye cluster */}
        {[
          [0, 0.25, 1.5, 0.16],
          [-0.3, 0.1, 1.45, 0.11],
          [0.3, 0.1, 1.45, 0.11],
          [-0.18, 0.42, 1.38, 0.08],
          [0.18, 0.42, 1.38, 0.08],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} material={mats.eyes} position={[x, y, z]} scale={r}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        ))}
        {/* Mandibles */}
        {[-1, 1].map((s) => (
          <mesh key={s} material={mats.leg} position={[s * 0.3, -0.45, 1.4]} rotation={[0.6, 0, s * 0.3]} scale={[0.1, 0.5, 0.1]}>
            <coneGeometry args={[1, 1, 6]} />
          </mesh>
        ))}
      </group>
      {/* Legs: pivot at the body, an upper segment up to the knee and a lower one down to the street. */}
      {Array.from({ length: LEGS }, (_, i) => (
        <group
          key={i}
          ref={(g) => {
            legs.current[i] = g;
          }}
          position={[0, 2, 0]}
        >
          <mesh material={mats.leg} position={[1.2, 0.5, 0]} rotation={[0, 0, -0.75]} scale={[0.14, 1.7, 0.14]} castShadow>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <mesh material={mats.leg} position={[2.55, -0.55, 0]} rotation={[0, 0, 0.45]} scale={[0.11, 2.4, 0.11]} castShadow>
            <boxGeometry args={[1, 1, 1]} />
          </mesh>
          <mesh material={mats.glow} position={[1.85, 1.05, 0]} scale={0.1}>
            <sphereGeometry args={[1, 8, 6]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
