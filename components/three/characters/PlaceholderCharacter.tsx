"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import type { Group } from "three";
import type { ModelId } from "@/game/core/types";
import type { AnimState } from "./anim";
import { Emblem, GEO, Part, RIGS, glow, solid } from "./rigs";

export { Emblem } from "./rigs";

const easeOut = (t: number) => 1 - (1 - t) * (1 - t);
/** Punch envelope: fast extend (first 35%), slower recover. */
const punchCurve = (a: number) => (a < 0.35 ? easeOut(a / 0.35) : 1 - (a - 0.35) / 0.65);

/**
 * Procedural placeholder built from primitives (see rigs.tsx for every character's look).
 * Pivots (hips, torso, head, arms, legs) are rotated every frame from the AnimState: locomotion
 * first, then attack / special / ultimate / hit / dodge / death layered on top.
 */
export function PlaceholderCharacter({ form, state }: { form: ModelId; state: RefObject<AnimState> }) {
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
    rt.position.y = s.hover ? 0.25 + Math.sin(t * 2.2) * 0.08 : 0;
    hp.position.y = s.hipY;
    hp.rotation.set(0, 0, 0);
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
        if (s.hover) {
          // Hovering forms lean into the motion instead of striding.
          to.rotation.x = 0.25 * sp;
          al.rotation.x = 0.4 * sp;
          ar.rotation.x = 0.4 * sp;
          break;
        }
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

    if (a.attack >= 0) {
      const k = punchCurve(a.attack);
      if (a.heavy) {
        // Heavy: both arms raised overhead, then brought crashing down.
        const lift = a.attack < 0.4 ? a.attack / 0.4 : 1 - (a.attack - 0.4) / 0.6;
        const x = -2.6 * lift - 1.1 * (1 - lift) * (a.attack >= 0.4 ? 1 : 0);
        al.rotation.set(x, 0, 0.1);
        ar.rotation.set(x, 0, -0.1);
        to.rotation.x = a.attack < 0.4 ? -0.2 * lift : 0.35 * (1 - lift);
      } else {
        // Light: punch forward with alternating arms, twisting the torso into it.
        const arm = a.attackSide > 0 ? ar : al;
        arm.rotation.x = arm.rotation.x * (1 - k) - 1.55 * k;
        arm.rotation.z *= 1 - k;
        to.rotation.y = -0.35 * k * a.attackSide;
      }
    }
    // Special / ultimate: power pose, arms flung up and out (the ultimate holds it and glows bigger).
    const power = Math.max(a.special >= 0 ? Math.sin(Math.min(1, a.special) * Math.PI) : 0, a.ultimate >= 0 ? Math.min(1, a.ultimate * 3) : 0);
    if (power > 0) {
      al.rotation.z = al.rotation.z * (1 - power) + 2.3 * power;
      ar.rotation.z = ar.rotation.z * (1 - power) - 2.3 * power;
      al.rotation.x *= 1 - power;
      ar.rotation.x *= 1 - power;
      to.rotation.x -= 0.25 * power;
      hd.rotation.x -= 0.3 * power;
      if (a.ultimate >= 0) {
        rt.position.y += 0.4 * power;
        to.scale.setScalar(1 + Math.sin(t * 30) * 0.03 * power);
      }
    }
    // Hit flinch: recoil backwards.
    if (a.hit >= 0) {
      const k = 1 - a.hit;
      to.rotation.x -= 0.45 * k;
      hd.rotation.x -= 0.35 * k;
      al.rotation.z += 0.5 * k;
      ar.rotation.z -= 0.5 * k;
    }
    // Dodge: a forward roll around the hips.
    if (a.dodge >= 0) {
      hp.rotation.x = a.dodge * Math.PI * 2;
      hp.position.y = s.hipY * (1 - 0.45 * Math.sin(a.dodge * Math.PI));
      al.rotation.x = ar.rotation.x = -1.2;
      ll.rotation.x = lr.rotation.x = -1.4;
    }
    // Death: topple backwards around the feet and go limp.
    if (a.death >= 0) {
      const k = easeOut(Math.min(1, a.death / 0.7));
      rt.rotation.x = (-Math.PI / 2) * k;
      rt.position.y *= 1 - k;
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
  const tail = s.legShape === "tail";
  const leg = tail ? null : (
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
        {/* Ghostly tail instead of legs (points down from the hips). */}
        {tail && <Part geo={GEO.cone} mat={skin(s.legColor)} p={[0, -s.hipY * 0.45, -0.05]} s={[s.torsoW * 0.45, s.hipY * 0.95, s.torsoD * 0.5]} r={[Math.PI + 0.25, 0, 0]} />}
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
