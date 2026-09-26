"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { BackSide, BufferAttribute, Color, type DirectionalLight, type Group, SphereGeometry, BufferGeometry, Float32BufferAttribute } from "three";
import type { QualityPreset } from "@/game/quality";
import { mulberry32 } from "./geometry";
import { useRuntime } from "./runtime-context";

const FOG_COLOR = "#140c2e";

/** Sphere with a vertical colour gradient (no texture), drawn behind everything. */
function useSkyGeometry() {
  return useMemo(() => {
    const geo = new SphereGeometry(95, 24, 16);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const top = new Color("#04030f");
    const mid = new Color("#1e1b4b");
    const horizon = new Color("#4c1d95");
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i) / 95; // -1..1
      if (h > 0.25) c.copy(mid).lerp(top, Math.min(1, (h - 0.25) / 0.6));
      else c.copy(horizon).lerp(mid, Math.max(0, (h + 0.05) / 0.3));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    return geo;
  }, []);
}

function useStarGeometry() {
  return useMemo(() => {
    const rnd = mulberry32(99);
    const pts: number[] = [];
    for (let i = 0; i < 350; i++) {
      const a = rnd() * Math.PI * 2;
      const y = 0.2 + rnd() * 0.8;
      const r = Math.sqrt(1 - y * y);
      pts.push(Math.cos(a) * r * 90, y * 90, Math.sin(a) * r * 90);
    }
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(pts, 3));
    return geo;
  }, []);
}

export function Environment({ preset }: { preset: QualityPreset }) {
  const runtime = useRuntime();
  const sky = useRef<Group>(null);
  const light = useRef<DirectionalLight>(null);
  const skyGeo = useSkyGeometry();
  const starGeo = useStarGeometry();
  const shadows = preset.shadows !== "none";

  useLayoutEffect(() => {
    const l = light.current;
    if (!l || !shadows) return;
    l.shadow.mapSize.set(preset.shadowMapSize, preset.shadowMapSize);
    // Tight frustum around the player: sharper shadows for the same map size.
    const cam = l.shadow.camera;
    cam.left = -16;
    cam.right = 16;
    cam.top = 16;
    cam.bottom = -16;
    cam.near = 1;
    cam.far = 60;
    cam.updateProjectionMatrix();
    l.shadow.bias = -0.0008;
    l.shadow.normalBias = 0.03;
    l.shadow.radius = preset.shadows === "soft" ? 5 : 1.5;
  }, [preset, shadows]);

  useFrame(({ camera }) => {
    // The sky dome follows the camera so it's always "infinitely" far away.
    sky.current?.position.copy(camera.position);
    const l = light.current;
    if (l) {
      const p = runtime.sim.player;
      l.position.set(p.x - 8, 20, p.z + 10);
      l.target.position.set(p.x, 0, p.z);
      l.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <fog attach="fog" args={[FOG_COLOR, 16, preset.fogFar]} />
      <color attach="background" args={[FOG_COLOR]} />
      <hemisphereLight args={["#8b93ff", "#2a1a44", 1.25]} />
      <directionalLight ref={light} color="#b4c0ff" intensity={1.3} castShadow={shadows} />
      {/* Magenta rim light from behind the buildings: silhouettes pop against the dark street. */}
      <directionalLight color="#ff4fd8" intensity={0.45} position={[4, 6, -20]} />

      <group ref={sky}>
        <mesh geometry={skyGeo} renderOrder={-10}>
          <meshBasicMaterial vertexColors side={BackSide} fog={false} depthWrite={false} />
        </mesh>
        <points geometry={starGeo} renderOrder={-9}>
          <pointsMaterial color="#e0e7ff" size={1.6} sizeAttenuation={false} fog={false} depthWrite={false} />
        </points>
        <mesh position={[30, 38, -70]} renderOrder={-8}>
          <sphereGeometry args={[4, 24, 16]} />
          <meshBasicMaterial color="#e0e7ff" fog={false} toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}
