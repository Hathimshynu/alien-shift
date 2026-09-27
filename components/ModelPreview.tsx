"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import type { Group } from "three";
import { FORMS } from "@/game/core/forms";
import type { FormId } from "@/game/core/types";
import { newAnimState } from "./three/characters/anim";
import { CharacterModel } from "./three/characters/CharacterModel";

/** Slowly spinning character that strikes its special pose every few seconds. */
function Turntable({ form, locked }: { form: FormId; locked: boolean }) {
  const group = useRef<Group>(null);
  const anim = useRef(newAnimState());
  const camera = useThree((s) => s.camera);
  const h = FORMS[form].height;

  useEffect(() => {
    // Frame the whole character, whatever its size (Kai 1.45 m … Behemoth 4.2 m).
    camera.position.set(0, h * 0.62, h * 1.75 + 1.2);
    camera.lookAt(0, h * 0.5, 0);
  }, [camera, h]);

  useFrame(({ clock }, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.8;
    const cycle = clock.elapsedTime % 4;
    anim.current.special = cycle > 3 ? (cycle - 3) : -1;
  });

  return (
    <group ref={group}>
      <CharacterModel form={form} state={anim} />
      {locked && (
        <mesh position-y={h / 2}>
          <boxGeometry args={[h * 0.7, h * 1.05, h * 0.7]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.55} />
        </mesh>
      )}
    </group>
  );
}

/**
 * Small separate 3D view for the Shift Lab. Kept cheap: DPR 1, no shadows, no post-processing.
 * It only exists while the upgrade screen is open (never during play).
 */
export default function ModelPreview({ form, locked }: { form: FormId; locked: boolean }) {
  return (
    <Canvas dpr={1} gl={{ antialias: true, powerPreference: "low-power" }} camera={{ fov: 35, near: 0.1, far: 50 }}>
      <color attach="background" args={["#0b0a1a"]} />
      <hemisphereLight args={["#a5b4fc", "#1e1b4b", 1.3]} />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#ff4fd8" />
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[1.6, 40]} />
        <meshBasicMaterial color="#14532d" />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.01}>
        <ringGeometry args={[1.5, 1.6, 48]} />
        <meshBasicMaterial color={[0.4, 2.5, 0.8]} toneMapped={false} />
      </mesh>
      <Turntable form={form} locked={locked} />
    </Canvas>
  );
}
