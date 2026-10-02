"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Plane, Raycaster, Vector2, Vector3 } from "three";
import type { MoveVector } from "@/game/core/types";
import { useRuntime } from "./runtime-context";

const ray = new Raycaster();
const ndc = new Vector2();
const hit = new Vector3();
/** Aim plane at chest height, so the cursor lines up with robots rather than their feet. */
const plane = new Plane(new Vector3(0, 1, 0), -1.1);

/** Gives the input system a way to turn the mouse position into a point on the arena floor. */
export function AimResolver() {
  const runtime = useRuntime();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const resolve = (clientX: number, clientY: number, out: MoveVector) => {
      const rect = gl.domElement.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, hit)) return false;
      out.x = hit.x;
      out.z = hit.z;
      return true;
    };
    runtime.input.setAimResolver(resolve);
    return () => runtime.input.setAimResolver(null);
  }, [runtime, camera, gl]);

  return null;
}
