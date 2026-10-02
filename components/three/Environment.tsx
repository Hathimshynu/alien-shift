"use client";

import { useFrame } from "@react-three/fiber";
import { useLayoutEffect, useMemo, useRef } from "react";
import { BackSide, BufferAttribute, Color, type DirectionalLight, type Group, type PointLight, SphereGeometry, BufferGeometry, Float32BufferAttribute } from "three";
import type { ThemeId } from "@/game/core/levels";
import type { QualityPreset } from "@/game/quality";
import { mulberry32 } from "./geometry";
import { useRuntime } from "./runtime-context";
import { THEMES, type ThemeLook } from "./themes";

/** Sphere with a vertical colour gradient (no texture), drawn behind everything. */
function useSkyGeometry(look: ThemeLook) {
  return useMemo(() => {
    const geo = new SphereGeometry(95, 24, 16);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const top = new Color(look.sky[0]);
    const mid = new Color(look.sky[1]);
    const horizon = new Color(look.sky[2]);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i) / 95; // -1..1
      if (h > 0.25) c.copy(mid).lerp(top, Math.min(1, (h - 0.25) / 0.6));
      else c.copy(horizon).lerp(mid, Math.max(0, (h + 0.05) / 0.3));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    return geo;
  }, [look]);
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

export function Environment({ preset, theme = "city" }: { preset: QualityPreset; theme?: ThemeId }) {
  const runtime = useRuntime();
  const sky = useRef<Group>(null);
  const light = useRef<DirectionalLight>(null);
  const look = THEMES[theme];
  const skyGeo = useSkyGeometry(look);
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
      <fog attach="fog" args={[look.fog, 16, preset.fogFar]} />
      <color attach="background" args={[look.fog]} />
      <hemisphereLight args={[look.hemi[0], look.hemi[1], look.hemi[2]]} />
      <directionalLight ref={light} color={look.sun[0]} intensity={look.sun[1]} castShadow={shadows} />
      {/* Rim light from behind the backdrop: silhouettes pop against the background. */}
      <directionalLight color={look.rim[0]} intensity={look.rim[1]} position={[4, 6, -20]} />
      {/* Dark levels: a soft light follows Kai so the area around him stays visible. */}
      {theme === "facility" && <PlayerLamp />}

      <group ref={sky}>
        <mesh geometry={skyGeo} renderOrder={-10}>
          <meshBasicMaterial vertexColors side={BackSide} fog={false} depthWrite={false} />
        </mesh>
        {look.stars && (
          <points geometry={starGeo} renderOrder={-9}>
            <pointsMaterial color="#e0e7ff" size={1.6} sizeAttenuation={false} fog={false} depthWrite={false} />
          </points>
        )}
        {look.planet && (
          <mesh position={look.planet.pos} renderOrder={-8}>
            <sphereGeometry args={[look.planet.size, 24, 16]} />
            <meshBasicMaterial color={look.planet.color} fog={false} toneMapped={false} />
          </mesh>
        )}
      </group>
    </>
  );
}

/** A point light hovering above Kai (the dark facility level). */
function PlayerLamp() {
  const runtime = useRuntime();
  const lamp = useRef<PointLight>(null);
  useFrame(() => {
    const p = runtime.sim.player;
    lamp.current?.position.set(p.x, p.y + 3.2, p.z + 1);
  });
  return <pointLight ref={lamp} color="#fef3c7" intensity={40} distance={14} decay={2} />;
}
