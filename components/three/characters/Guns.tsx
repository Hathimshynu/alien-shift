"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef, type RefObject } from "react";
import { AdditiveBlending, BoxGeometry, Color, ConeGeometry, CylinderGeometry, type Group, type Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import type { WeaponId } from "@/game/core/types";
import { WEAPONS } from "@/game/core/weapons";
import type { AnimState } from "./anim";

/** One part of a gun: a box or a cylinder (pointing along +Z), in metres. */
type Part = { shape: "box" | "cyl"; pos: [number, number, number]; size: [number, number, number]; mat: "dark" | "metal" | "accent" | "glow" };

/** Procedural looks for Kai's guns (the barrel points along +Z; the grip sits at the origin = the hand). */
const LOOKS: Record<WeaponId, { parts: Part[]; muzzle: number }> = {
  pistol: {
    muzzle: 0.26,
    parts: [
      { shape: "box", pos: [0, 0.04, 0.08], size: [0.05, 0.07, 0.24], mat: "dark" },
      { shape: "box", pos: [0, -0.04, 0], size: [0.04, 0.11, 0.05], mat: "metal" },
      { shape: "box", pos: [0, 0.08, 0.08], size: [0.03, 0.012, 0.2], mat: "glow" },
    ],
  },
  rifle: {
    muzzle: 0.62,
    parts: [
      { shape: "box", pos: [0, 0.04, 0.18], size: [0.06, 0.09, 0.5], mat: "dark" },
      { shape: "cyl", pos: [0, 0.05, 0.52], size: [0.018, 0.018, 0.2], mat: "metal" },
      { shape: "box", pos: [0, -0.06, 0.12], size: [0.04, 0.12, 0.05], mat: "metal" },
      { shape: "box", pos: [0, -0.02, -0.12], size: [0.05, 0.08, 0.16], mat: "accent" },
      { shape: "box", pos: [0, 0.11, 0.16], size: [0.03, 0.03, 0.12], mat: "glow" },
    ],
  },
  shotgun: {
    muzzle: 0.58,
    parts: [
      { shape: "cyl", pos: [-0.022, 0.05, 0.3], size: [0.022, 0.022, 0.55], mat: "dark" },
      { shape: "cyl", pos: [0.022, 0.05, 0.3], size: [0.022, 0.022, 0.55], mat: "dark" },
      { shape: "box", pos: [0, 0.0, 0.18], size: [0.07, 0.06, 0.22], mat: "accent" },
      { shape: "box", pos: [0, -0.02, -0.12], size: [0.05, 0.08, 0.2], mat: "metal" },
    ],
  },
  plasma: {
    muzzle: 0.5,
    parts: [
      { shape: "box", pos: [0, 0.04, 0.16], size: [0.08, 0.1, 0.42], mat: "metal" },
      { shape: "cyl", pos: [0, 0.05, 0.42], size: [0.035, 0.035, 0.12], mat: "glow" },
      { shape: "cyl", pos: [0, 0.05, 0.12], size: [0.06, 0.06, 0.04], mat: "glow" },
      { shape: "cyl", pos: [0, 0.05, 0.22], size: [0.06, 0.06, 0.04], mat: "glow" },
      { shape: "box", pos: [0, -0.06, 0.08], size: [0.04, 0.12, 0.05], mat: "dark" },
    ],
  },
  cannon: {
    muzzle: 0.62,
    parts: [
      { shape: "cyl", pos: [0, 0.07, 0.25], size: [0.09, 0.09, 0.6], mat: "dark" },
      { shape: "cyl", pos: [0, 0.07, 0.56], size: [0.11, 0.11, 0.06], mat: "glow" },
      { shape: "box", pos: [0, -0.04, 0.05], size: [0.06, 0.12, 0.14], mat: "accent" },
      { shape: "cyl", pos: [0, 0.07, 0.0], size: [0.1, 0.1, 0.12], mat: "metal" },
    ],
  },
};

const box = new BoxGeometry(1, 1, 1);
// Cylinder along +Z.
const cyl = new CylinderGeometry(1, 1, 1, 10).rotateX(Math.PI / 2);
const flashGeo = new ConeGeometry(1, 1, 8).rotateX(-Math.PI / 2).translate(0, 0, 0.5);

export function GunModel({ state }: { state: RefObject<AnimState> }) {
  const groups = useRef<Partial<Record<WeaponId, Group | null>>>({});
  const flash = useRef<Mesh>(null);
  const mats = useMemo(
    () => ({
      dark: new MeshStandardMaterial({ color: "#1f2937", roughness: 0.45, metalness: 0.3 }),
      metal: new MeshStandardMaterial({ color: "#9ca3af", roughness: 0.35, metalness: 0.5 }),
      accent: Object.fromEntries(Object.values(WEAPONS).map((w) => [w.id, new MeshStandardMaterial({ color: new Color(w.color).multiplyScalar(0.55), roughness: 0.5 })])) as Record<WeaponId, MeshStandardMaterial>,
      glow: Object.fromEntries(Object.values(WEAPONS).map((w) => [w.id, new MeshBasicMaterial({ color: new Color(w.color).multiplyScalar(2.2), toneMapped: false })])) as Record<WeaponId, MeshBasicMaterial>,
      flash: new MeshBasicMaterial({ color: "#ffffff", transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }),
    }),
    [],
  );

  useFrame(() => {
    const s = state.current;
    if (!s) return;
    for (const id of Object.keys(LOOKS) as WeaponId[]) {
      const g = groups.current[id];
      if (g) g.visible = id === s.weapon;
    }
    const f = flash.current;
    if (f) {
      f.visible = s.flash > 0.05;
      const k = s.flash;
      const look = LOOKS[s.weapon];
      f.position.set(0, 0.05, look.muzzle);
      f.scale.set(0.07 + k * 0.08, 0.07 + k * 0.08, 0.15 + k * 0.35 * (s.kick > 2 ? 1.6 : 1));
      f.rotation.z = s.shots * 1.7;
      mats.flash.color.set(WEAPONS[s.weapon].color).multiplyScalar(2 + k * 2);
      mats.flash.opacity = k;
    }
  });

  return (
    <group>
      {(Object.keys(LOOKS) as WeaponId[]).map((id) => (
        <group
          key={id}
          ref={(g) => {
            groups.current[id] = g;
          }}
          visible={id === "pistol"}
        >
          {LOOKS[id].parts.map((p, i) => (
            <mesh
              key={i}
              geometry={p.shape === "box" ? box : cyl}
              material={p.mat === "dark" ? mats.dark : p.mat === "metal" ? mats.metal : p.mat === "accent" ? mats.accent[id] : mats.glow[id]}
              position={p.pos}
              scale={p.shape === "box" ? p.size : [p.size[0], p.size[1], p.size[2]]}
              castShadow={p.mat !== "glow"}
            />
          ))}
        </group>
      ))}
      <mesh ref={flash} geometry={flashGeo} material={mats.flash} visible={false} />
    </group>
  );
}
