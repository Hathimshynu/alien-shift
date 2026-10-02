"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, useState } from "react";
import { AdditiveBlending, type Group, type Mesh, type MeshBasicMaterial, Vector3 } from "three";
import { FORMS } from "@/game/core/forms";
import type { FormId } from "@/game/core/types";
import { WEAPONS } from "@/game/core/weapons";
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
  const shell = useRef<Group>(null);
  const aura = useRef<Mesh>(null);
  const shield = useRef<Group>(null);
  const anim = useRef(newAnimState());
  const yaw = useRef(0);
  const pop = useRef(1);
  const lastAttack = useRef(0);
  const lastShoot = useRef(0);
  const shots = useRef(0);
  const aimHold = useRef(0);

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
    const fast = p.dashTimer > 0 || p.dodgeTimer > 0 || p.rushTargets.length > 0;
    // Kai keeps aiming for a moment after each shot. If the aim is far behind his running
    // direction he turns his whole body; otherwise only the spine twists (legs keep running).
    if (p.shootAnim > lastShoot.current) {
      shots.current++;
      aimHold.current = 0.6;
    }
    lastShoot.current = p.shootAnim;
    aimHold.current = Math.max(0, aimHold.current - dt);
    const aiming = p.form === "human" && aimHold.current > 0 && sim.status === "playing";
    const aimYaw = yawOf(p.aimFx, p.aimFz);
    let bodyYaw = yawOf(p.fx, p.fz);
    const moving = Math.hypot(p.vx, p.vz) > 1;
    if (aiming) {
      const diff = Math.atan2(Math.sin(aimYaw - bodyYaw), Math.cos(aimYaw - bodyYaw));
      if (!moving || Math.abs(diff) > 1.75) bodyYaw = aimYaw;
    }
    yaw.current = dampAngle(yaw.current, bodyYaw, fast ? 40 : 14, dt);
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
    a.heavy = p.lastAttack === "heavy";
    const attackLen = a.heavy ? 0.35 : p.lastAttack === "finisher" ? 0.3 : 0.2;
    a.attack = p.attackAnim > 0 ? 1 - p.attackAnim / attackLen : -1;
    a.special = p.specialAnim > 0 && sim.cinematic?.kind !== "ultimate" ? 1 - Math.min(1, p.specialAnim / 0.45) : -1;
    a.ultimate = sim.cinematic?.kind === "ultimate" ? sim.cinematic.t / sim.cinematic.dur : -1;
    a.hit = p.hurtAnim > 0 ? 1 - p.hurtAnim / 0.35 : -1;
    a.dodge = p.dodgeTimer > 0 ? 1 - p.dodgeTimer / 0.35 : -1;
    // Kai's gunplay and powers.
    const w = WEAPONS[p.weapon];
    a.aim = aiming;
    a.aimTwist = Math.atan2(Math.sin(aimYaw - yaw.current), Math.cos(aimYaw - yaw.current));
    a.shots = shots.current;
    a.flash = p.shootAnim / 0.16;
    a.kick = Math.max(1, w.kick);
    a.weapon = p.weapon;
    a.reload = p.reloadTimer > 0 ? 1 : -1;
    a.reloadTime = w.reload;
    a.power = p.powerAnim ?? (p.punchCharge > 0 ? "punch" : null);
    a.spin = p.airSpin > 0 ? 1 - p.airSpin / 0.55 : -1;

    // Invulnerability blink, and Phantom's vanish (a faint ghostly flicker).
    const t = runtime.time;
    const blinking = sim.status === "playing" && p.invuln > 0 && p.flash <= 0 && p.dashTimer <= 0 && p.dodgeTimer <= 0 && !sim.cinematic && p.rushTargets.length === 0;
    body.current.visible = p.invisible > 0 ? Math.floor(t * 12) % 4 === 0 : !blinking || Math.floor(t * 20) % 2 === 0;

    // Green transformation beam (after the switch) and energy shell (during the slow-motion sequence).
    if (beam.current) {
      const k = p.flash / 0.45;
      beam.current.visible = k > 0;
      (beam.current.material as MeshBasicMaterial).opacity = k * 0.7;
      beam.current.scale.set(0.6 + (1 - k) * 0.8, 1, 0.6 + (1 - k) * 0.8);
    }
    const c = sim.cinematic;
    if (shell.current) {
      const on = c?.kind === "transform";
      shell.current.visible = on;
      if (on) {
        const k = c.t / c.dur;
        // Contracts onto Kai, then bursts outward as the new form appears.
        const r = k < 0.5 ? 1.8 - k * 1.6 : 1 + (k - 0.5) * 3;
        shell.current.scale.setScalar(r);
        shell.current.position.y = p.height / 2;
        shell.current.rotation.y += dt * 4;
        shell.current.rotation.x += dt * 2;
      }
    }
    if (aura.current) {
      const on = c?.kind === "ultimate";
      aura.current.visible = on;
      if (on) {
        const k = c.t / c.dur;
        aura.current.scale.set(0.5 + k * 1.5, 1 + k * 0.5, 0.5 + k * 1.5);
        const mat = aura.current.material as MeshBasicMaterial;
        mat.color.set(FORMS[c.form].accent).multiplyScalar(2.5);
        mat.opacity = 0.6 * (1 - k * 0.5);
      }
    }

    // Prism Shield bubble (flickers as it runs out).
    const sh = shield.current;
    if (sh) {
      sh.visible = p.shieldTimer > 0 && (p.shieldTimer > 0.8 || Math.sin(t * 25) > 0);
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
      <group ref={shell} visible={false}>
        <mesh>
          <icosahedronGeometry args={[1, 1]} />
          <meshBasicMaterial color={[0.3, 2.5, 0.8]} transparent opacity={0.18} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
        </mesh>
        <mesh>
          <icosahedronGeometry args={[1.02, 1]} />
          <meshBasicMaterial color={[0.5, 3, 1]} wireframe transparent opacity={0.8} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={aura} position-y={1.5} visible={false}>
        <cylinderGeometry args={[1, 1.4, 3.5, 24, 1, true]} />
        <meshBasicMaterial transparent opacity={0.5} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
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
