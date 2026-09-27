"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { AdditiveBlending, type Group, type Mesh, Vector3 } from "three";
import { HUNTER_FORMS } from "@/game/core/bosses/hunter";
import type { HunterForm } from "@/game/core/types";
import { newAnimState } from "./characters/anim";
import { CharacterModel } from "./characters/CharacterModel";
import { dampAngle, interpolated, useRuntime, yawOf } from "./runtime-context";

const pos = new Vector3();

/** Kraye the Hunter, drawn with the same CharacterModel system as the aliens (a .glb can replace it). */
export function HunterBoss() {
  const runtime = useRuntime();
  const [form, setForm] = useState<HunterForm>("hunter");
  const root = useRef<Group>(null);
  const shell = useRef<Mesh>(null);
  const anim = useRef(newAnimState());
  const yaw = useRef(0);

  useFrame((_, dt) => {
    const e = runtime.sim.enemies.find((x) => x.kind === "hunter");
    const g = root.current;
    if (!g) return;
    g.visible = !!e;
    if (!e) return;
    const wanted = HUNTER_FORMS[e.variant].id;
    if (wanted !== form) setForm(wanted);

    interpolated(e, runtime.alpha, pos);
    g.position.copy(pos);
    yaw.current = dampAngle(yaw.current, yawOf(e.fx, e.fz), e.move === "dash" ? 30 : 10, dt);
    g.rotation.y = yaw.current;

    const a = anim.current;
    const speed = Math.hypot(e.vx, e.vz) / HUNTER_FORMS[e.variant].speed;
    a.locomotion = !e.onGround ? (e.vy > 0 ? "jump" : "fall") : speed > 0.12 ? "run" : "idle";
    a.runSpeed = e.move === "dash" ? 1.5 : speed;
    a.dodge = e.move === "roll" ? 1 - Math.max(0, e.stateTimer) / 0.35 : -1;
    a.attack = e.move === "aim" ? 0.3 : e.move === "dash" ? 0.3 : -1;
    a.heavy = e.variant === 1 && e.move === "windup";
    a.special = e.move === "windup" ? 0.5 : -1;
    a.hit = e.hitFlash > 0 ? 0.5 : -1;

    // Red energy shell while it transforms (the phase roar makes it briefly invulnerable).
    if (shell.current) {
      shell.current.visible = e.invuln > 0;
      shell.current.scale.setScalar(1 + (1.2 - e.invuln) * 0.8);
      shell.current.position.y = e.height / 2;
      shell.current.rotation.y += dt * 5;
    }
  });

  return (
    <group ref={root} visible={false}>
      <CharacterModel form={form} state={anim} />
      <mesh ref={shell} visible={false}>
        <icosahedronGeometry args={[1.4, 1]} />
        <meshBasicMaterial color={[2.5, 0.3, 0.3]} wireframe transparent opacity={0.7} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}
