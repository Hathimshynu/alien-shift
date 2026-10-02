import { ConeGeometry, SphereGeometry } from "three";
import { ARENA, PLATFORMS, SOLIDS, type ArenaBox } from "@/game/core/arena";
import type { ThemeId } from "@/game/core/levels";
import { GeometryBatch, mulberry32 } from "./geometry";
import type { ThemeLook } from "./themes";

/** The pieces the Arena component draws (same shape as the city street). */
export interface ThemeGeometry {
  solid: GeometryBatch;
  slabs: GeometryBatch;
  glow: GeometryBatch;
  barrier: GeometryBatch;
}

const sphere = (r: number) => new SphereGeometry(r, 12, 8);
const cone = (r: number, h: number, seg = 6) => new ConeGeometry(r, h, seg);

/**
 * Builds a campaign level's arena: its ground, the platforms and cover from the level layout
 * (PLATFORMS / SOLIDS), and a backdrop unique to the theme (wrecked ship, ruins, colony domes,
 * facility walls, hive pods, ice spires, dunes, space station, fortress walls, the void).
 */
export function buildThemeArena(theme: ThemeId, look: ThemeLook, skyline: boolean, seed: number): ThemeGeometry {
  const rnd = mulberry32(seed);
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const solid = new GeometryBatch();
  const slabs = new GeometryBatch();
  const glow = new GeometryBatch();
  const barrier = new GeometryBatch();

  // Ground, arena edge lines, end barriers.
  solid.decal(240, 70, look.ground, 0, 0, 0);
  glow.decal(240, 0.08, look.accent, 0, 0.02, ARENA.minZ + 0.05, 0.9);
  glow.decal(240, 0.08, look.accent, 0, 0.02, ARENA.maxZ - 0.05, 0.9);
  for (const bx of [ARENA.minX - 0.4, ARENA.maxX + 0.4]) {
    barrier.quad(ARENA.maxZ - ARENA.minZ, 1.3, look.accent, bx, 0.65, 0, Math.PI / 2, 1.2);
    for (let z = ARENA.minZ; z <= ARENA.maxZ; z += 2.75) {
      solid.box(0.25, 1.5, 0.25, "#18181b", bx, 0, z);
      glow.box(0.27, 0.12, 0.27, look.accent, bx, 1.5, z, 0, 2.5);
    }
  }

  // Platforms: slab + glowing front trim + support posts.
  for (const p of PLATFORMS) {
    const top = p.y + p.h;
    slabs.box(p.w, p.h, p.d, look.slab, p.x, p.y, p.z);
    glow.box(p.w, 0.06, 0.06, look.accent, p.x, top - 0.03, p.z + p.d / 2, 0, 2.2);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) solid.box(0.2, p.y, 0.2, "#3f3f46", p.x + sx * (p.w / 2 - 0.2), 0, p.z + sz * (p.d / 2 - 0.2));
  }
  for (const b of SOLIDS) drawSolid(solid, glow, b, look);

  const back = (z0: number) => z0 - rnd() * 3;
  switch (theme) {
    case "crash": {
      // The crashed ship: a huge tilted hull half-buried behind the arena, burning.
      solid.add(sphere(1), "#3f3f46", [-6, 3, -24], 0.3).add(sphere(1), "#52525b", [4, 2, -22], -0.2);
      solid.box(26, 6, 7, "#3f3f46", -4, -1.5, -24, 0.18).box(9, 3, 5, "#27272a", 12, 0, -21, -0.4);
      solid.add(cone(2.4, 12, 8), "#52525b", [-19, 4, -23], 0, 1, 1.2);
      for (let i = 0; i < 14; i++) glow.add(sphere(r(0.3, 0.8)), i % 2 ? "#f97316" : "#fde047", [r(-20, 18), r(0.2, 4), r(-27, -18)], 0, 2.4);
      for (let i = 0; i < 10; i++) solid.add(sphere(r(0.8, 2)), "#292524", [r(-60, 60), 0, r(-40, -16)]);
      for (let i = 0; i < 18; i++) solid.decal(r(1, 3), r(1, 3), "#1a120e", r(-19, 19), 0.012, r(-10, 10)); // scorch marks
      break;
    }
    case "ruins": {
      // Broken colonnade and an archway with glowing glyphs.
      for (let x = -40; x <= 40; x += 6) {
        const h = rnd() < 0.3 ? r(2, 4) : r(7, 10);
        solid.cylinder(1, h, "#a8a29e", x, 0, back(-17), 10);
        if (h > 6) solid.box(2.6, 0.7, 2.6, "#d6d3d1", x, h, -17.5);
      }
      solid.box(3, 12, 3, "#a8a29e", -8, 0, -26).box(3, 12, 3, "#a8a29e", 8, 0, -26).box(19, 3, 3, "#d6d3d1", 0, 12, -26);
      for (const side of [-8, 8]) for (const y of [2, 5, 8]) glow.quad(1.2, 1.2, look.accent, side, y, -24.45, 0, 2.2);
      for (let i = 0; i < 16; i++) glow.decal(0.5, 3, look.accent, r(-18, 18), 0.013, r(-10, 10), 0.8);
      for (let i = 0; i < 12; i++) solid.add(sphere(r(0.6, 1.4)), "#78716c", [r(-60, 60), 0, r(-40, -20)]);
      break;
    }
    case "colony": {
      // Prefab domes, antenna masts, stacked containers and blinking beacons.
      for (let i = 0; i < 7; i++) {
        const x = -36 + i * 12 + r(-2, 2);
        const rad = r(3.5, 5.5);
        solid.add(new SphereGeometry(rad, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), "#cbd5e1", [x, 0, back(-22)]);
        glow.box(1.6, 1.2, 0.1, "#fde68a", x, 0.2, -22 + rad - 0.6, 0, 1.6);
      }
      for (const x of [-24, 4, 30]) {
        solid.cylinder(0.25, 16, "#64748b", x, 0, -30);
        glow.add(sphere(0.35), "#ef4444", [x, 16.2, -30], 0, 3);
      }
      for (let i = 0; i < 6; i++) solid.box(6, 2.5, 2.5, i % 2 ? "#0e7490" : "#9a3412", r(-50, 50), (i % 3) * 2.5, r(-40, -32));
      for (let i = 0; i < 10; i++) glow.decal(3, 0.2, "#f59e0b", r(-18, 18), 0.014, r(-10, 10), 1);
      break;
    }
    case "facility": {
      // Enclosed: panelled walls, pipes and red warning strips. Very little light.
      solid.box(240, 14, 1, "#1f2937", 0, 0, -16).box(240, 1, 1, "#374151", 0, 14, -15.5);
      for (let x = -60; x <= 60; x += 4) {
        solid.box(0.3, 14, 0.5, "#111827", x, 0, -15.4);
        glow.quad(2.4, 0.15, "#ef4444", x + 2, 3, -15.45, 0, rnd() < 0.5 ? 2.4 : 0.6);
      }
      for (let i = 0; i < 4; i++) solid.box(240, 0.45, 0.45, "#4b5563", 0, 5 + i * 2, -15.1); // pipes
      for (let x = -18; x <= 18; x += 3) glow.decal(0.1, 22, "#1e293b", x, 0.012, 0, 2);
      for (let z = -9; z <= 9; z += 3) glow.decal(40, 0.1, "#1e293b", 0, 0.012, z, 2);
      for (const x of [-12, 0, 12]) glow.box(1.2, 0.2, 0.4, "#fef3c7", x, 9, -12, 0, 1.6); // ceiling lamps (dim)
      break;
    }
    case "hive": {
      // Organic pods, ribbed spikes and glowing veins.
      for (let i = 0; i < 16; i++) {
        const x = r(-55, 55);
        const z = r(-40, -16);
        const s = r(1.5, 4);
        solid.add(sphere(1).scale(s, s * 1.4, s), "#4c1d95", [x, s * 0.9, z]);
        glow.add(sphere(s * 0.35), "#e879f9", [x, s * 1.3, z + s * 0.75], 0, 2);
      }
      for (let i = 0; i < 20; i++) solid.add(cone(r(0.5, 1.2), r(4, 10)), "#3b0764", [r(-60, 60), 2, r(-45, -18)], 0, 1, r(-0.3, 0.3));
      for (let i = 0; i < 24; i++) glow.decal(r(0.15, 0.3), r(3, 8), "#d946ef", r(-19, 19), 0.013, r(-10, 10), 1.2);
      break;
    }
    case "frozen": {
      // Ice spires, snow drifts and a glowing aurora band.
      for (let i = 0; i < 22; i++) solid.add(cone(r(0.8, 2.2), r(5, 16), 5), rnd() < 0.5 ? "#bfdbfe" : "#e0f2fe", [r(-60, 60), 3, r(-45, -16)]);
      for (let i = 0; i < 14; i++) solid.add(sphere(1).scale(r(3, 7), r(0.8, 1.6), r(2, 4)), "#f1f5f9", [r(-50, 50), 0, r(-30, -14)]);
      for (let i = 0; i < 6; i++) glow.quad(30, 2.5, i % 2 ? "#5eead4" : "#a78bfa", -60 + i * 24, 30 + (i % 3) * 3, -60, 0, 1.3);
      for (let i = 0; i < 12; i++) glow.decal(r(2, 5), r(1, 3), "#ffffff", r(-19, 19), 0.013, r(-10, 10), 1.1);
      break;
    }
    case "desert": {
      // Dunes, mesas and a burnt-out tank.
      for (let i = 0; i < 14; i++) solid.add(sphere(1).scale(r(8, 16), r(1.5, 4), r(5, 9)), "#d6a464", [r(-70, 70), 0, r(-50, -18)]);
      for (const [x, z, h] of [[-30, -45, 18], [22, -50, 24], [50, -40, 14]] as const) solid.box(r(10, 16), h, 10, "#9a5b2b", x, 0, z);
      solid.box(5, 1.6, 3, "#57534e", -12, 0, -17, 0.3).box(2.4, 1, 2, "#44403c", -12, 1.6, -17, 0.3).box(0.3, 0.3, 4, "#292524", -10.5, 2, -17.5, 0.3);
      for (let i = 0; i < 20; i++) glow.decal(r(2, 6), r(0.1, 0.3), "#a16207", r(-19, 19), 0.012, r(-10, 10), 0.7); // wind ripples
      break;
    }
    case "station": {
      // Deck plating, a huge window onto space, consoles and light strips.
      solid.box(240, 1, 1, "#334155", 0, 0, -16).box(240, 1.2, 1, "#334155", 0, 17, -16);
      for (let x = -60; x <= 60; x += 8) {
        solid.box(0.8, 17, 1.2, "#1e293b", x, 0, -16);
        glow.box(0.12, 15, 0.12, look.accent, x + 0.5, 1, -15.4, 0, 1.8);
      }
      for (let x = -18; x <= 18; x += 2) glow.decal(0.06, 22, "#0e7490", x, 0.012, 0, 1.4);
      for (let i = 0; i < 6; i++) solid.box(2.2, 1.2, 1, "#1e293b", -15 + i * 6, 0, -14.2);
      for (let i = 0; i < 6; i++) glow.quad(1.8, 0.6, i % 2 ? "#22d3ee" : "#a78bfa", -15 + i * 6, 1.4, -13.65, 0, 2);
      break;
    }
    case "fortress": {
      // Tall battlemented walls, towers, banners and braziers.
      solid.box(240, 10, 3, "#27272a", 0, 0, -19);
      for (let x = -60; x <= 60; x += 3) solid.box(1.4, 1.4, 3, "#3f3f46", x, 10, -19);
      for (const x of [-26, 0, 26]) {
        solid.cylinder(3.2, 18, "#3f3f46", x, 0, -21, 12);
        solid.add(cone(4, 5, 12), "#450a0a", [x, 20.5, -21]);
        glow.quad(1.2, 1.8, "#fbbf24", x, 12, -17.75, 0, 2);
      }
      for (let x = -20; x <= 20; x += 10) glow.quad(2, 5, "#b91c1c", x, 4, -17.45, 0, 1.4);
      for (const x of [-19, 19]) {
        solid.cylinder(0.25, 1.4, "#18181b", x, 0, -9);
        glow.add(sphere(0.45), "#f97316", [x, 1.7, -9], 0, 3);
      }
      break;
    }
    case "dimension": {
      // The void: a glowing grid, floating crystal islands and rifts in the sky.
      for (let x = -40; x <= 40; x += 4) glow.decal(0.05, 80, "#7c3aed", x, 0.012, 0, 1.6);
      for (let z = -40; z <= 40; z += 4) glow.decal(80, 0.05, "#7c3aed", 0, 0.012, z, 1.6);
      for (let i = 0; i < 18; i++) {
        const x = r(-55, 55);
        const y = r(4, 22);
        const z = r(-50, -18);
        solid.add(cone(r(1, 3), r(2, 5), 5), "#1e0b33", [x, y, z], 0, 1, Math.PI);
        glow.add(cone(0.4, r(1.5, 3), 4), "#c084fc", [x, y + 2, z], rnd() * 3, 2.4);
      }
      for (let i = 0; i < 5; i++) glow.quad(r(6, 14), 0.5, i % 2 ? "#f0abfc" : "#a855f7", r(-40, 40), r(20, 40), -60, r(-0.5, 0.5), 2.2);
      break;
    }
    default:
      break;
  }

  // A little distant silhouette band for depth (skipped on Low).
  if (skyline && theme !== "facility" && theme !== "station") {
    for (let sx = -90; sx < 90; sx += r(6, 12)) solid.box(r(5, 10), r(4, 14), 6, look.fog, sx, 0, r(-62, -50));
  }

  return { solid, slabs, glow, barrier };
}

/** Cover objects, drawn by kind (the physics box is always the same: w × h × d). */
function drawSolid(solid: GeometryBatch, glow: GeometryBatch, b: ArenaBox, look: ThemeLook) {
  switch (b.kind) {
    case "crate":
      solid.box(b.w, b.h, b.d, b.color, b.x, b.y, b.z);
      solid.box(b.w + 0.02, 0.1, b.d + 0.02, "#451a03", b.x, b.y + b.h - 0.1, b.z);
      solid.box(b.w + 0.02, 0.1, b.d + 0.02, "#451a03", b.x, b.y, b.z);
      break;
    case "rock":
      solid.box(b.w, b.h * 0.7, b.d, b.color, b.x, b.y, b.z);
      solid.box(b.w * 0.8, b.h * 0.3, b.d * 0.8, b.color, b.x, b.y + b.h * 0.7, b.z, 0.2);
      break;
    case "pillar":
      solid.cylinder(b.w / 2, b.h, b.color, b.x, b.y, b.z, 10);
      solid.box(b.w * 1.25, 0.3, b.d * 1.25, "#d6d3d1", b.x, b.y + b.h - 0.3, b.z);
      glow.box(b.w * 0.2, b.h * 0.5, 0.05, look.accent, b.x, b.y + b.h * 0.2, b.z + b.d / 2, 0, 1.8);
      break;
    case "wreck":
      solid.box(b.w, b.h, b.d, b.color, b.x, b.y, b.z, 0.05);
      glow.box(0.4, 0.1, 0.4, "#f97316", b.x - b.w * 0.25, b.y + b.h, b.z, 0, 2.6);
      glow.box(0.3, 0.1, 0.3, "#fde047", b.x + b.w * 0.2, b.y + b.h, b.z + 0.3, 0, 2.6);
      break;
    case "container":
      solid.box(b.w, b.h, b.d, b.color, b.x, b.y, b.z);
      for (let i = 0; i < 5; i++) {
        if (b.w > b.d) solid.box(0.08, b.h, b.d + 0.04, "#1f2937", b.x - b.w / 2 + (i + 0.5) * (b.w / 5), b.y, b.z);
        else solid.box(b.w + 0.04, b.h, 0.08, "#1f2937", b.x, b.y, b.z - b.d / 2 + (i + 0.5) * (b.d / 5));
      }
      break;
    case "wall":
      solid.box(b.w, b.h, b.d, b.color, b.x, b.y, b.z);
      glow.box(b.w + 0.02, 0.08, b.d + 0.02, look.accent, b.x, b.y + b.h - 0.1, b.z, 0, 2);
      break;
    case "ice":
      solid.box(b.w, b.h, b.d, b.color, b.x, b.y, b.z, 0.3);
      glow.box(b.w * 0.5, b.h * 0.8, b.d * 0.5, "#e0f2fe", b.x, b.y + 0.1, b.z, 0.3, 1.1);
      break;
    case "console":
      solid.box(b.w, b.h, b.d, b.color, b.x, b.y, b.z);
      glow.box(b.w * 0.85, 0.05, b.d * 0.6, look.accent, b.x, b.y + b.h, b.z, 0, 2);
      break;
    case "shard":
      solid.box(b.w, b.h, b.d, "#1e0b33", b.x, b.y, b.z, Math.PI / 4);
      glow.box(b.w * 0.4, b.h * 1.05, b.d * 0.4, b.color, b.x, b.y, b.z, Math.PI / 4, 2.6);
      break;
    default:
      solid.box(b.w, b.h, b.d, b.color, b.x, b.y, b.z);
      break;
  }
}
