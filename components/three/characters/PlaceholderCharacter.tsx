"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type ReactNode, type RefObject } from "react";
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
} from "three";
import type { FormId } from "@/game/core/types";
import type { AnimState } from "./anim";

// ───────────────────────────── shared geometry & materials ─────────────────────────────

/** Unit primitives shared by every rig (scaled per part), so all characters reuse a few buffers. */
const GEO = {
  capsule: new CapsuleGeometry(0.5, 1, 4, 10), // 1 wide, 2 tall
  sphere: new SphereGeometry(1, 16, 12),
  box: new BoxGeometry(1, 1, 1),
  octa: new OctahedronGeometry(1, 0),
  cone: new ConeGeometry(1, 1, 8),
  hex: new CylinderGeometry(1, 1, 1, 6),
  dodeca: new DodecahedronGeometry(1, 0),
};

const materials = new Map<string, Material>();

/** Lit material with a faint self-glow so characters stay readable on the dark street. */
function solid(color: string, rough = 0.6, metal = 0.1, emissive = 0.1): Material {
  const key = `s${color}${rough}${metal}${emissive}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: new Color(color), emissiveIntensity: emissive });
    materials.set(key, m);
  }
  return m;
}

/** Unlit, not tone-mapped: blooms on Medium/High, still reads as "glowing" on Low. */
function glow(color: string, intensity = 2.2): Material {
  const key = `g${color}${intensity}`;
  let m = materials.get(key);
  if (!m) {
    m = new MeshBasicMaterial({ color: new Color(color).multiplyScalar(intensity), toneMapped: false });
    materials.set(key, m);
  }
  return m;
}

type V3 = [number, number, number];

function Part({ geo, mat, p, s, r }: { geo: BufferGeometry; mat: Material; p?: V3; s?: V3 | number; r?: V3 }) {
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

// ───────────────────────────── rig description ─────────────────────────────

interface RigSpec {
  hipY: number;
  hipW: number;
  legR: number;
  legColor: string;
  footColor: string;
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
  emblem: "chest" | "wrist";
  emblemScale: number;
  rough?: number;
  metal?: number;
  emissive?: number;
  headExtras?: (s: RigSpec) => ReactNode;
  torsoExtras?: (s: RigSpec) => ReactNode;
}

/** Fire crown that flickers every frame. */
function Flames({ y }: { y: number }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const t = clock.elapsedTime;
    g.children.forEach((c, i) => {
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

const RIGS: Record<FormId, RigSpec> = {
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
        <Part geo={GEO.box} mat={glow("#fef08a", 3)} p={[0.06, 0.02, s.headR * 0.92]} s={[0.07, 0.025, 0.02]} />
        <Part geo={GEO.box} mat={glow("#fef08a", 3)} p={[-0.06, 0.02, s.headR * 0.92]} s={[0.07, 0.025, 0.02]} />
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
};

// ───────────────────────────── animated humanoid ─────────────────────────────

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
/** Punch envelope: fast extend (first 35%), slower recover. */
const punchCurve = (a: number) => (a < 0.35 ? easeOut(a / 0.35) : 1 - (a - 0.35) / 0.65);

/**
 * Procedural placeholder built from primitives. Pivots (hips, torso, head, arms, legs) are rotated
 * every frame from the AnimState: locomotion first, then attack/special/hit/death layered on top.
 */
export function PlaceholderCharacter({ form, state }: { form: FormId; state: RefObject<AnimState> }) {
  const s = RIGS[form];
  const root = useRef<Group>(null);
  const hips = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const phase = useRef(0);

  useFrame(({ clock }, dt) => {
    const a = state.current;
    const [rt, hp, to, hd, al, ar, ll, lr] = [root.current, hips.current, torso.current, head.current, armL.current, armR.current, legL.current, legR.current];
    if (!a || !rt || !hp || !to || !hd || !al || !ar || !ll || !lr) return;
    const t = clock.elapsedTime;

    // Reset to the rest pose.
    rt.rotation.set(0, 0, 0);
    hp.position.y = s.hipY;
    to.rotation.set(0, 0, 0);
    to.scale.set(1, 1, 1);
    hd.rotation.set(0, 0, 0);
    al.rotation.set(0, 0, 0.12);
    ar.rotation.set(0, 0, -0.12);
    ll.rotation.set(0, 0, 0);
    lr.rotation.set(0, 0, 0);

    // Locomotion. (Rotation.x < 0 swings a limb forward; the model faces +Z, its right side is -X.)
    switch (a.locomotion) {
      case "idle": {
        const b = Math.sin(t * 2.4);
        to.scale.y = 1 + b * 0.02;
        al.rotation.z += b * 0.03;
        ar.rotation.z -= b * 0.03;
        hd.rotation.x = b * 0.03;
        break;
      }
      case "run": {
        const sp = Math.min(1, a.runSpeed);
        phase.current += dt * (5 + 9 * sp) * s.stride;
        const ph = phase.current;
        const amp = 0.35 + 0.6 * sp;
        ll.rotation.x = Math.sin(ph) * amp * 1.1;
        lr.rotation.x = -Math.sin(ph) * amp * 1.1;
        al.rotation.x = -Math.sin(ph) * amp;
        ar.rotation.x = Math.sin(ph) * amp;
        hp.position.y = s.hipY + Math.abs(Math.cos(ph)) * 0.05 * s.hipY;
        to.rotation.x = 0.1 + 0.15 * sp;
        break;
      }
      case "jump":
        ll.rotation.x = -1.0;
        lr.rotation.x = 0.35;
        al.rotation.set(-0.5, 0, 0.6);
        ar.rotation.set(-0.5, 0, -0.6);
        break;
      case "fall":
        ll.rotation.x = -0.35;
        lr.rotation.x = 0.25;
        al.rotation.z = 1.1;
        ar.rotation.z = -1.1;
        break;
    }

    // Attack: punch forward with alternating arms, twisting the torso into it.
    if (a.attack >= 0) {
      const k = punchCurve(a.attack);
      const arm = a.attackSide > 0 ? ar : al;
      arm.rotation.x = arm.rotation.x * (1 - k) - 1.55 * k;
      arm.rotation.z *= 1 - k;
      to.rotation.y = -0.35 * k * a.attackSide;
    }
    // Special: power pose, arms flung up and out.
    if (a.special >= 0) {
      const k = Math.sin(Math.min(1, a.special) * Math.PI);
      al.rotation.z = al.rotation.z * (1 - k) + 2.3 * k;
      ar.rotation.z = ar.rotation.z * (1 - k) - 2.3 * k;
      al.rotation.x *= 1 - k;
      ar.rotation.x *= 1 - k;
      to.rotation.x -= 0.25 * k;
      hd.rotation.x -= 0.3 * k;
    }
    // Hit flinch: recoil backwards.
    if (a.hit >= 0) {
      const k = 1 - a.hit;
      to.rotation.x -= 0.45 * k;
      hd.rotation.x -= 0.35 * k;
      al.rotation.z += 0.5 * k;
      ar.rotation.z -= 0.5 * k;
    }
    // Death: topple backwards around the feet and go limp.
    if (a.death >= 0) {
      const k = easeOut(Math.min(1, a.death / 0.7));
      rt.rotation.x = (-Math.PI / 2) * k;
      al.rotation.z = 1.4 * k;
      ar.rotation.z = -1.4 * k;
      ll.rotation.x = -0.3 * k;
    }
  });

  const skin = (color: string) => solid(color, s.rough ?? 0.6, s.metal ?? 0.1, s.emissive ?? 0.1);
  const fistMat = s.fistGlow ? glow(s.fistColor, 2.2) : skin(s.fistColor);
  const fist = (side: number) =>
    s.fistShape === "crystal" ? (
      <Part geo={GEO.octa} mat={fistMat} p={[0, -s.armLen - s.fistR * 0.8, 0]} s={[s.fistR * 0.7, s.fistR * 1.6, s.fistR * 0.7]} />
    ) : (
      <Part geo={s.fistShape === "dodeca" ? GEO.dodeca : GEO.sphere} mat={fistMat} p={[0, -s.armLen, 0]} s={s.fistR} r={[0, side, 0]} />
    );
  const leg = (
    <>
      <Part geo={GEO.capsule} mat={skin(s.legColor)} p={[0, -s.hipY / 2, 0]} s={[s.legR * 2, s.hipY / 2, s.legR * 2]} />
      <Part geo={GEO.box} mat={skin(s.footColor)} p={[0, -s.hipY + 0.05, s.legR * 0.7]} s={[s.legR * 2.2, 0.1, s.legR * 3.6]} />
    </>
  );
  const arm = (side: number) => (
    <>
      <Part geo={GEO.capsule} mat={skin(s.armColor)} p={[0, -s.armLen / 2, 0]} s={[s.armR * 2, s.armLen / 2, s.armR * 2]} />
      {fist(side)}
      {s.emblem === "wrist" && side > 0 && <Emblem p={[0, -s.armLen * 0.75, s.armR + 0.01]} s={s.emblemScale} />}
    </>
  );

  return (
    <group ref={root}>
      <group ref={hips} position-y={s.hipY}>
        <group ref={legL} position-x={s.hipW}>
          {leg}
        </group>
        <group ref={legR} position-x={-s.hipW}>
          {leg}
        </group>
        <group ref={torso}>
          {s.torsoShape === "capsule" && <Part geo={GEO.capsule} mat={skin(s.torsoColor)} p={[0, s.torsoH / 2, 0]} s={[s.torsoW, s.torsoH / 2, s.torsoD]} />}
          {s.torsoShape === "box" && <Part geo={GEO.box} mat={skin(s.torsoColor)} p={[0, s.torsoH / 2, 0]} s={[s.torsoW, s.torsoH, s.torsoD]} />}
          {s.torsoShape === "crystal" && (
            <Part geo={GEO.octa} mat={skin(s.torsoColor)} p={[0, s.torsoH / 2, 0]} s={[s.torsoW * 0.55, s.torsoH * 0.6, s.torsoD * 0.6]} />
          )}
          {s.emblem === "chest" && <Emblem p={[0, s.torsoH * 0.62, s.torsoD / 2 + 0.01]} s={s.emblemScale} />}
          {s.torsoExtras?.(s)}
          <group ref={head} position-y={s.torsoH + s.headR * 0.85}>
            {s.headShape === "sphere" && <Part geo={GEO.sphere} mat={skin(s.headColor)} s={s.headR} />}
            {s.headShape === "box" && <Part geo={GEO.box} mat={skin(s.headColor)} s={[s.headR * 1.8, s.headR * 1.6, s.headR * 1.8]} />}
            {s.headShape === "crystal" && <Part geo={GEO.octa} mat={skin(s.headColor)} s={[s.headR, s.headR * 1.35, s.headR]} />}
            {s.headExtras?.(s)}
          </group>
          <group ref={armL} position={[s.shoulderW, s.torsoH * 0.88, 0]}>
            {arm(1)}
          </group>
          <group ref={armR} position={[-s.shoulderW, s.torsoH * 0.88, 0]}>
            {arm(-1)}
          </group>
        </group>
      </group>
    </group>
  );
}
