"use client";

import { useAnimations, useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import { type AnimationAction, Box3, type Group, LoopOnce, LoopRepeat, type Mesh, type WebGLRenderer } from "three";
import { KTX2Loader } from "three-stdlib";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ModelId } from "@/game/core/types";
import { assetUrl } from "@/game/platform/assets";
import { type AnimName, type AnimState, CLIP_ALIASES, modelHeight, modelPath, primaryAnim } from "./anim";

let ktx2: KTX2Loader | null = null;
/** One KTX2 loader for the app, using the self-hosted Basis transcoder in /public/basis. */
function getKtx2Loader(gl: WebGLRenderer) {
  ktx2 ??= new KTX2Loader().setTranscoderPath(assetUrl("/basis/")).detectSupport(gl);
  return ktx2;
}

const ONE_SHOT: AnimName[] = ["attack", "special", "hit", "death", "dodge"];

/**
 * A real rigged character loaded from /public/models/<form>.glb. It is scaled to the form's height,
 * stands on y = 0 and faces +Z (the glTF convention). Clips are matched by name via CLIP_ALIASES.
 * Draco and KTX2 decoders are served from /public (no CDN), so models work offline.
 */
export function GltfCharacter({ form, state }: { form: ModelId; state: RefObject<AnimState> }) {
  const gl = useThree((s) => s.gl);
  const gltf = useGLTF(assetUrl(modelPath(form)), assetUrl("/draco/"), true, (loader) => {
    loader.setKTX2Loader(getKtx2Loader(gl));
  });
  const holder = useRef<Group>(null);

  // Skinned meshes need SkeletonUtils.clone so several instances don't share one skeleton.
  const model = useMemo(() => {
    const obj = cloneSkinned(gltf.scene);
    const box = new Box3().setFromObject(obj);
    const height = box.max.y - box.min.y || 1;
    const scale = modelHeight(form) / height;
    obj.scale.setScalar(scale);
    obj.position.y = -box.min.y * scale;
    obj.traverse((o) => {
      if ((o as Mesh).isMesh) o.castShadow = true;
    });
    return obj;
  }, [gltf.scene, form]);

  const { actions } = useAnimations(gltf.animations, holder);

  /** Resolve each AnimName to the first clip whose name contains one of its aliases. */
  const clipFor = useMemo(() => {
    const names = Object.keys(actions);
    const map = new Map<AnimName, AnimationAction | null>();
    for (const anim of Object.keys(CLIP_ALIASES) as AnimName[]) {
      const name = CLIP_ALIASES[anim].map((alias) => names.find((n) => n.toLowerCase().includes(alias))).find(Boolean);
      map.set(anim, (name && actions[name]) || null);
    }
    return map;
  }, [actions]);

  const current = useRef<AnimationAction | null>(null);

  useLayoutEffect(
    () => () => {
      current.current?.stop();
    },
    [],
  );

  useFrame(() => {
    const s = state.current;
    if (!s) return;
    const want = primaryAnim(s);
    const next = clipFor.get(want) ?? clipFor.get("idle") ?? null;
    if (next && next !== current.current) {
      const oneShot = ONE_SHOT.includes(want);
      next.reset();
      next.setLoop(oneShot ? LoopOnce : LoopRepeat, oneShot ? 1 : Infinity);
      next.clampWhenFinished = want === "death";
      next.fadeIn(0.15).play();
      current.current?.fadeOut(0.15);
      current.current = next;
    }
    if (next && want === "run") next.timeScale = 0.6 + Math.min(1, s.runSpeed) * 0.8;
  });

  return (
    <group ref={holder}>
      <primitive object={model} />
    </group>
  );
}
