import { BoxGeometry, BufferAttribute, CanvasTexture, Color, CylinderGeometry, type BufferGeometry, Matrix4, PlaneGeometry, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Small deterministic RNG so the procedural city looks the same every run. */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const tmpColor = new Color();
const tmpMatrix = new Matrix4();
const tmpQuat = new Quaternion();
const tmpScale = new Vector3(1, 1, 1);
const tmpPos = new Vector3();

/**
 * Collects primitive parts (each with a colour and transform) and merges them into ONE geometry
 * with a per-vertex colour attribute — the whole static street becomes a handful of draw calls.
 * `intensity` > 1 pushes colours above 1.0 so unlit, non-tone-mapped materials bloom.
 */
export class GeometryBatch {
  private parts: BufferGeometry[] = [];

  add(geo: BufferGeometry, color: string, pos: [number, number, number], rotY = 0, intensity = 1, rotX = 0) {
    geo.deleteAttribute("uv");
    tmpColor.set(color);
    const n = geo.attributes.position.count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = tmpColor.r * intensity;
      colors[i * 3 + 1] = tmpColor.g * intensity;
      colors[i * 3 + 2] = tmpColor.b * intensity;
    }
    geo.setAttribute("color", new BufferAttribute(colors, 3));
    tmpQuat.setFromAxisAngle(new Vector3(0, 1, 0), rotY);
    if (rotX) tmpQuat.multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), rotX));
    geo.applyMatrix4(tmpMatrix.compose(tmpPos.set(...pos), tmpQuat, tmpScale));
    this.parts.push(geo);
    return this;
  }

  /** Axis-aligned box given by its bottom-centre position. */
  box(w: number, h: number, d: number, color: string, x: number, y: number, z: number, rotY = 0, intensity = 1) {
    return this.add(new BoxGeometry(w, h, d), color, [x, y + h / 2, z], rotY, intensity);
  }

  cylinder(r: number, h: number, color: string, x: number, y: number, z: number, segments = 8, intensity = 1) {
    return this.add(new CylinderGeometry(r, r, h, segments), color, [x, y + h / 2, z], 0, intensity);
  }

  /** Flat quad facing +Z (or rotated about Y), centred on the given point. */
  quad(w: number, h: number, color: string, x: number, y: number, z: number, rotY = 0, intensity = 1) {
    return this.add(new PlaneGeometry(w, h), color, [x, y, z], rotY, intensity);
  }

  /** Flat quad lying on the ground. */
  decal(w: number, d: number, color: string, x: number, y: number, z: number, intensity = 1) {
    return this.add(new PlaneGeometry(w, d), color, [x, y, z], 0, intensity, -Math.PI / 2);
  }

  build(): BufferGeometry {
    const merged = mergeGeometries(this.parts, false);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    if (!merged) throw new Error("GeometryBatch: parts have incompatible attributes");
    merged.computeBoundingSphere();
    return merged;
  }
}

let radialTexture: CanvasTexture | null = null;

/** 64×64 soft radial gradient (white centre → black edge), generated at runtime (no image files). Shared. */
export function getRadialTexture() {
  if (radialTexture) return radialTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  if (g) {
    // Opaque white→black: alphaMap reads brightness (not alpha), and additive maps fade to black.
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.4, "#8c8c8c");
    grad.addColorStop(1, "#000000");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  radialTexture = new CanvasTexture(c);
  return radialTexture;
}
