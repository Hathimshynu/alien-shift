"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial, Vector3 } from "three";
import { FORMS } from "@/game/core/forms";
import type { FormId } from "@/game/core/types";
import { newAnimState } from "./characters/anim";
import { CharacterModel } from "./characters/CharacterModel";
import { dampAngle, interpolated, useRuntime, yawOf } from "./runtime-context";

const pos = new Vector3();
/** Overshooting ease for the transform "pop". */
const easeOutBack = (t: number) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

export function PlayerView() {
  const runtime = useRuntime();
  const [form, setForm] = useState<FormId>(runtime.sim.player.form);
  const root = useRef<Group>(null);
  const body = useRef<Group>(null);
  const beam = useRef<Mesh>(null);
  const shield = useRef<Group>(null);
  const anim = useRef(newAnimState());
  const yaw = useRef(0);
  const pop = useRef(1);
  const lastAttack = useRef(0);

  useFrame((_, dt) => {
    const sim = runtime.sim;
    const p = sim.player;
    const g = root.current;
    if (!g || !body.current) return;
    // Form switches are rare, so a React state update here is fine (it swaps the model).
    if (p.form !== form) {
      setForm(p.form);
      pop.current = 0;
    }

    interpolated(p, runtime.alpha, pos);
    g.position.copy(pos);
    yaw.current = dampAngle(yaw.current, yawOf(p.fx, p.fz), p.dashTimer > 0 ? 40 : 14, dt);
    g.rotation.y = yaw.current;

    // Transform pop: shrink-and-overshoot back to full size.
    pop.current = Math.min(1, pop.current + dt / 0.35);
    body.current.scale.setScalar(0.55 + 0.45 * easeOutBack(pop.current));

    // Drive the character animation from simulation state.
    const a = anim.current;
    const f = FORMS[p.form];
    const speed = Math.hypot(p.vx, p.vz) / f.speed;
    a.death = sim.status === "gameover" ? sim.statusTime : -1;
    a.runSpeed = p.dashTimer > 0 ? 1.5 : speed;
    a.locomotion = !p.onGround && p.dashTimer <= 0 ? (p.vy > 0 ? "jump" : "fall") : speed > 0.12 || p.dashTimer > 0 ? "run" : "idle";
    if (p.attackAnim > lastAttack.current) a.attackSide = a.attackSide > 0 ? -1 : 1; // new swing → other arm
    lastAttack.current = p.attackAnim;
    a.attack = p.attackAnim > 0 ? 1 - p.attackAnim / 0.2 : -1;
    a.special = p.specialAnim > 0 ? 1 - p.specialAnim / 0.45 : -1;
    a.hit = p.hurtAnim > 0 ? 1 - p.hurtAnim / 0.35 : -1;

    // Invulnerability blink (not during the transform flash or a dash).
    const blinking = sim.status === "playing" && p.invuln > 0 && p.flash <= 0 && p.dashTimer <= 0;
    body.current.visible = !blinking || Math.floor(runtime.time * 20) % 2 === 0;

    // Green transformation beam.
    if (beam.current) {
      const k = p.flash / 0.45;
      beam.current.visible = k > 0;
      (beam.current.material as MeshBasicMaterial).opacity = k * 0.7;
      beam.current.scale.set(0.6 + (1 - k) * 0.8, 1, 0.6 + (1 - k) * 0.8);
    }

    // Prism Shield bubble (flickers as it runs out).
    const sh = shield.current;
    if (sh) {
      sh.visible = p.shieldTimer > 0 && (p.shieldTimer > 0.8 || Math.sin(runtime.time * 25) > 0);
      sh.rotation.y += dt * 1.2;
      sh.rotation.x += dt * 0.5;
      sh.position.y = p.height / 2;
    }
  });

  return (
    <group ref={root}>
      <group ref={body}>
        <CharacterModel form={form} state={anim} />
      </group>
      <mesh ref={beam} position-y={4} visible={false}>
        <cylinderGeometry args={[1, 1, 8, 20, 1, true]} />
        <meshBasicMaterial color={[0.5, 3, 1]} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <group ref={shield} visible={false}>
        <mesh>
          <icosahedronGeometry args={[1.45, 1]} />
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.14} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[1.47, 1]} />
          <meshBasicMaterial color={[0.6, 2.2, 2.6]} wireframe transparent opacity={0.6} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
