"use client";

import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  type AnimationAction,
  AnimationClip,
  AnimationMixer,
  type Bone,
  Box3,
  type Group,
  LoopOnce,
  LoopRepeat,
  type Material,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  Quaternion,
  Vector3,
} from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { FORMS } from "@/game/core/forms";
import { assetUrl } from "@/game/platform/assets";
import type { AnimState } from "./anim";
import { GunModel } from "./Guns";

/*
 * Kai, the realistic human hero: a rigged CC0 character (Quaternius "Universal Base Characters")
 * animated with the CC0 "Universal Animation Library" clips. Both files live in /public/models/hero
 * (no CDN). Animation runs in two layers so Kai can run with his legs while his upper body aims,
 * shoots, reloads, punches or casts a power; the spine twists towards the aim direction.
 */

export const HERO_MODEL = "/models/hero/hero.glb";
export const HERO_ANIMS = "/models/hero/hero-anims.glb";

/** Bones driven by the upper-body layer (everything above the lower spine). */
const UPPER = /^(spine_02|spine_03|neck_01|Head|clavicle_|upperarm_|lowerarm_|hand_|thumb_|index_|middle_|ring_|pinky_)/;

/** Clip names in hero-anims.glb. */
const CLIP = {
  idle: "Idle_Loop",
  jog: "Jog_Fwd_Loop",
  sprint: "Sprint_Loop",
  jumpStart: "Jump_Start",
  jumpLoop: "Jump_Loop",
  aim: "Pistol_Aim_Neutral",
  shoot: "Pistol_Shoot",
  reload: "Pistol_Reload",
  jab: "Punch_Jab",
  cross: "Punch_Cross",
  smash: "Sword_Attack",
  castEnter: "Spell_Simple_Enter",
  cast: "Spell_Simple_Shoot",
  hit: "Hit_Chest",
  death: "Death01",
  roll: "Roll",
} as const;
type ClipKey = keyof typeof CLIP;

/**
 * The base character ships in underwear (it's meant to be dressed). Kai gets an agent suit with a
 * small shader tweak on the body material — no extra textures to download. Regions are picked in the
 * mesh's bind pose (T-pose, quantised to -1..1): below the neck = suit, hands = gloves, feet = boots,
 * plus a belt and glowing Shiftwatch-green seams.
 */
function dressAsAgent(material: Material) {
  const m = (material as MeshStandardMaterial).clone();
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBindPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvBindPos = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vBindPos;\nfloat agentSeam;")
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        {
          vec3 p = vBindPos;
          float ax = abs(p.x);
          float suit = step(p.y, 0.69);                       // below the neck
          float glove = step(0.74, ax) * step(-0.2, p.y);      // hands (arms are out in the T-pose)
          float boot = step(p.y, -0.78);                        // feet and ankles
          float belt = step(0.04, p.y) * step(p.y, 0.12) * step(ax, 0.3);
          vec3 suitCol = mix(vec3(0.07, 0.09, 0.16), vec3(0.11, 0.14, 0.24), smoothstep(-0.2, 0.6, p.y));
          // Lighter shoulder/arm panels.
          suitCol = mix(suitCol, vec3(0.16, 0.2, 0.3), step(0.2, ax) * step(ax, 0.74) * step(0.45, p.y));
          vec3 c = diffuseColor.rgb;
          float lum = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(c, suitCol * (0.65 + lum * 0.9), suit);
          c = mix(c, vec3(0.05, 0.05, 0.06) * (0.7 + lum), max(glove, boot));
          c = mix(c, vec3(0.1, 0.42, 0.2), belt * (1.0 - glove));
          diffuseColor.rgb = c;
          // Glowing seams down the sides of the torso and legs, and a collar ring.
          float side = smoothstep(0.012, 0.0, abs(ax - 0.16)) * step(-0.75, p.y) * step(p.y, 0.62);
          float collar = smoothstep(0.012, 0.0, abs(p.y - 0.665)) * step(ax, 0.12);
          agentSeam = (side + collar) * suit * (1.0 - glove);
        }`,
      )
      .replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.15, 1.0, 0.45) * agentSeam * 1.6;");
  };
  m.customProgramCacheKey = () => "kai-agent-suit";
  return m;
}

/** Split a clip into upper-body and lower-body tracks (by bone name). */
function splitClip(clip: AnimationClip) {
  const bone = (name: string) => name.split(".")[0];
  const upper = clip.tracks.filter((t) => UPPER.test(bone(t.name)));
  const lower = clip.tracks.filter((t) => !UPPER.test(bone(t.name)));
  return {
    upper: new AnimationClip(clip.name + "_U", clip.duration, upper),
    lower: new AnimationClip(clip.name + "_L", clip.duration, lower),
  };
}

/** One animation layer: cross-fades between actions. */
class Layer {
  current: AnimationAction | null = null;
  key = "";
  play(key: string, action: AnimationAction | undefined, once: boolean, fade = 0.18, restart = false) {
    if (!action) return;
    if (key === this.key && !restart) return;
    action.reset();
    action.setLoop(once ? LoopOnce : LoopRepeat, once ? 1 : Infinity);
    action.clampWhenFinished = once;
    action.enabled = true;
    action.setEffectiveWeight(1);
    if (this.current && this.current !== action) {
      action.crossFadeFrom(this.current, fade, false);
    } else action.fadeIn(fade);
    action.play();
    this.current = action;
    this.key = key;
  }
}

const UP = new Vector3(0, 1, 0);
const qa = new Quaternion();
const qb = new Quaternion();
const qc = new Quaternion();
const axis = new Vector3();
const handPos = new Vector3();

/** Rotate a bone about a world-space axis (applied after the animation pose). */
function rotateBoneWorld(bone: Object3D, worldAxis: Vector3, angle: number) {
  if (!bone.parent || angle === 0) return;
  bone.parent.getWorldQuaternion(qa);
  qb.copy(qa).multiply(bone.quaternion); // bone world rotation
  qc.setFromAxisAngle(worldAxis, angle);
  qb.premultiply(qc);
  bone.quaternion.copy(qa.invert().multiply(qb));
}

export function HeroCharacter({ state }: { state: RefObject<AnimState> }) {
  const base = useGLTF(assetUrl(HERO_MODEL), false, true);
  const animsGltf = useGLTF(assetUrl(HERO_ANIMS), false, true);
  const spinner = useRef<Group>(null);
  const gunHolder = useRef<Group>(null);

  const model = useMemo(() => {
    const obj = cloneSkinned(base.scene);
    const box = new Box3().setFromObject(obj);
    const height = box.max.y - box.min.y || 1;
    const scale = FORMS.human.height / height;
    obj.scale.setScalar(scale);
    obj.position.y = -box.min.y * scale;
    obj.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.frustumCulled = false; // skinned bounds don't follow the animation
        if (!Array.isArray(mesh.material) && mesh.material.name === "MI_Superhero_Male") mesh.material = dressAsAgent(mesh.material);
      }
    });
    return obj;
  }, [base.scene]);

  const rig = useMemo(() => {
    const mixer = new AnimationMixer(model);
    const upper = new Map<ClipKey, AnimationAction>();
    const lower = new Map<ClipKey, AnimationAction>();
    for (const key of Object.keys(CLIP) as ClipKey[]) {
      const clip = animsGltf.animations.find((c) => c.name === CLIP[key]);
      if (!clip) continue;
      const parts = splitClip(clip);
      upper.set(key, mixer.clipAction(parts.upper));
      lower.set(key, mixer.clipAction(parts.lower));
    }
    const find = (name: string) => model.getObjectByName(name) as Bone | undefined;
    return {
      mixer,
      upper,
      lower,
      upperLayer: new Layer(),
      lowerLayer: new Layer(),
      spine: [find("spine_01"), find("spine_02"), find("spine_03")].filter(Boolean) as Bone[],
      hand: find("hand_r"),
      lastShot: 0,
      recoil: 0,
      lastAttackSide: 1,
      lastPower: "",
      wasAir: false,
    };
  }, [model, animsGltf.animations]);

  useEffect(() => () => {
    rig.mixer.stopAllAction();
  }, [rig]);

  useFrame((_, dt) => {
    const s = state.current;
    if (!s) return;
    const { upper, lower, upperLayer: U, lowerLayer: L } = rig;

    // ── Lower body (locomotion / full-body moves) ──
    let full: ClipKey | null = null;
    if (s.death >= 0) full = "death";
    else if (s.dodge >= 0) full = "roll";
    else if (s.power === "punch" || s.power === "smash") full = s.power === "punch" ? "cross" : "smash";

    let loco: ClipKey;
    if (s.locomotion === "jump") loco = rig.wasAir ? "jumpLoop" : "jumpStart";
    else if (s.locomotion === "fall") loco = "jumpLoop";
    else if (s.locomotion === "run") loco = s.runSpeed > 1.1 ? "sprint" : "jog";
    else loco = "idle";
    rig.wasAir = s.locomotion === "jump" || s.locomotion === "fall";

    if (full) L.play(full, lower.get(full), true, 0.12);
    else if (loco === "jumpStart") L.play("jumpStart", lower.get("jumpStart"), true, 0.1);
    else L.play(loco, lower.get(loco), false);
    const la = L.current;
    if (la && (L.key === "jog" || L.key === "sprint")) la.timeScale = 0.7 + Math.min(1.2, s.runSpeed) * 0.5;
    else if (la) la.timeScale = 1;
    // Jump start rolls straight into the loop.
    if (L.key === "jumpStart" && la && la.time > la.getClip().duration * 0.8) L.play("jumpLoop", lower.get("jumpLoop"), false, 0.15);

    // ── Upper body (aim, shoot, reload, punches, powers) ──
    if (full) U.play(full, upper.get(full), true, 0.12, full !== U.key);
    else if (s.hit >= 0) U.play("hit", upper.get("hit"), true, 0.08);
    else if (s.power === "blast" || s.power === "strike" || s.power === "freeze") {
      const key: ClipKey = s.power === "freeze" ? "castEnter" : "cast";
      U.play(key, upper.get(key), true, 0.1, rig.lastPower !== s.power);
    } else if (s.attack >= 0) {
      // Melee punches alternate jab / cross.
      const key: ClipKey = s.attackSide > 0 ? "jab" : "cross";
      U.play(key + s.attackSide, upper.get(key), true, 0.08, s.attackSide !== rig.lastAttackSide);
      rig.lastAttackSide = s.attackSide;
    } else if (s.reload >= 0) {
      U.play("reload", upper.get("reload"), true, 0.12);
      const ra = U.current;
      if (ra) ra.timeScale = ra.getClip().duration / Math.max(0.3, s.reloadTime);
    } else if (s.aim) {
      U.play("aim", upper.get("aim"), false, 0.1);
    } else {
      U.play(L.key === "jumpStart" ? "jumpLoop" : loco, upper.get(L.key === "jumpStart" ? "jumpLoop" : loco), false);
      if (U.current && la) U.current.timeScale = la.timeScale;
    }
    rig.lastPower = s.power ?? "";

    rig.mixer.update(dt);

    // ── Procedural layers on top of the pose ──
    if (s.death < 0 && s.dodge < 0) {
      // Spine twist towards the aim direction (split over the three spine bones).
      const twist = s.aim ? Math.max(-1.4, Math.min(1.4, s.aimTwist)) : 0;
      for (const b of rig.spine) rotateBoneWorld(b, UP, twist / rig.spine.length);
      // Recoil kick on each shot.
      if (s.shots !== rig.lastShot) {
        rig.lastShot = s.shots;
        rig.recoil = 1;
      }
      rig.recoil = Math.max(0, rig.recoil - dt * 9);
      if (rig.recoil > 0 && rig.spine[2]) {
        // Lean back about the axis across the chest.
        axis.set(1, 0, 0).applyQuaternion(rig.spine[2].getWorldQuaternion(qa)).setY(0).normalize();
        rotateBoneWorld(rig.spine[2], axis, -0.12 * rig.recoil * s.kick);
      }
    }

    // 360° aerial somersault around the hips.
    if (spinner.current) spinner.current.rotation.x = s.spin >= 0 ? s.spin * Math.PI * 2 : 0;

    // Gun follows the right hand and points where Kai aims.
    const gun = gunHolder.current;
    if (gun && rig.hand && spinner.current) {
      gun.visible = s.death < 0 && s.dodge < 0 && s.attack < 0 && !full;
      rig.hand.getWorldPosition(handPos);
      gun.parent?.worldToLocal(handPos);
      gun.position.copy(handPos);
      gun.rotation.set(0, s.aim ? s.aimTwist : 0, 0);
    }
  });

  return (
    <group position-y={0.95}>
      <group ref={spinner}>
        <group position-y={-0.95}>
          <primitive object={model} />
          <group ref={gunHolder}>
            <GunModel state={state} />
          </group>
        </group>
      </group>
    </group>
  );
}

/** Start downloading Kai's model and animations early (they're small). */
export function preloadHero() {
  useGLTF.preload(assetUrl(HERO_MODEL), false, true);
  useGLTF.preload(assetUrl(HERO_ANIMS), false, true);
}
