import type { GameEngine } from "./engine";
import type { Enemy, Player } from "./types";
import { GROUND_Y, PLATFORMS, WORLD_H, WORLD_W } from "./world";

type Ctx = CanvasRenderingContext2D;

let displayFont = "system-ui, sans-serif";
/** Canvas can't resolve CSS variables, so the UI passes in the loaded web-font family. */
export function setDisplayFont(family: string) {
  if (family.trim()) displayFont = `${family.trim()}, system-ui, sans-serif`;
}

// ───────────────────────────── static background (drawn once) ─────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let background: HTMLCanvasElement | null = null;
const rng = mulberry32(10);
const stars = Array.from({ length: 110 }, () => ({
  x: rng() * WORLD_W,
  y: rng() * 300,
  r: rng() * 1.4 + 0.3,
  tw: rng() * Math.PI * 2,
}));

function buildBackground() {
  const S = 2;
  const c = document.createElement("canvas");
  c.width = WORLD_W * S;
  c.height = WORLD_H * S;
  const g = c.getContext("2d");
  if (!g) return c;
  g.scale(S, S);

  const sky = g.createLinearGradient(0, 0, 0, GROUND_Y);
  sky.addColorStop(0, "#050816");
  sky.addColorStop(0.6, "#1e1b4b");
  sky.addColorStop(1, "#4c1d95");
  g.fillStyle = sky;
  g.fillRect(0, 0, WORLD_W, WORLD_H);

  // Moon
  g.fillStyle = "#e0e7ff";
  g.shadowColor = "#a5b4fc";
  g.shadowBlur = 40;
  g.beginPath();
  g.arc(800, 90, 34, 0, Math.PI * 2);
  g.fill();
  g.shadowBlur = 0;
  g.fillStyle = "#1e1b4b";
  g.beginPath();
  g.arc(786, 80, 30, 0, Math.PI * 2);
  g.globalAlpha = 0.25;
  g.fill();
  g.globalAlpha = 1;

  // Two layers of city skyline
  const layers = [
    { color: "#1e1b4b", minH: 90, maxH: 200, win: "rgba(250,204,21,0.25)" },
    { color: "#0f0a2e", minH: 50, maxH: 150, win: "rgba(250,204,21,0.55)" },
  ];
  const r = mulberry32(42);
  for (const layer of layers) {
    let x = -10;
    while (x < WORLD_W) {
      const w = 40 + r() * 60;
      const h = layer.minH + r() * (layer.maxH - layer.minH);
      g.fillStyle = layer.color;
      g.fillRect(x, GROUND_Y - h, w, h);
      g.fillStyle = layer.win;
      for (let wy = GROUND_Y - h + 10; wy < GROUND_Y - 12; wy += 14) {
        for (let wx = x + 6; wx < x + w - 8; wx += 12) {
          if (r() < 0.35) g.fillRect(wx, wy, 5, 7);
        }
      }
      x += w + 4 + r() * 10;
    }
  }

  // Ground
  const ground = g.createLinearGradient(0, GROUND_Y, 0, WORLD_H);
  ground.addColorStop(0, "#1f2937");
  ground.addColorStop(1, "#030712");
  g.fillStyle = ground;
  g.fillRect(0, GROUND_Y, WORLD_W, WORLD_H - GROUND_Y);
  g.strokeStyle = "rgba(34,197,94,0.35)";
  g.lineWidth = 1;
  for (let x = 0; x <= WORLD_W; x += 48) {
    g.beginPath();
    g.moveTo(x, GROUND_Y);
    g.lineTo(WORLD_W / 2 + (x - WORLD_W / 2) * 1.6, WORLD_H);
    g.stroke();
  }
  g.strokeStyle = "#22c55e";
  g.lineWidth = 2;
  g.shadowColor = "#22c55e";
  g.shadowBlur = 12;
  g.beginPath();
  g.moveTo(0, GROUND_Y);
  g.lineTo(WORLD_W, GROUND_Y);
  g.stroke();
  return c;
}

// ───────────────────────────── main render ─────────────────────────────

export function renderGame(ctx: Ctx, game: GameEngine) {
  background ??= buildBackground();
  const t = game.time;

  ctx.save();
  if (game.shake > 0) ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);

  ctx.drawImage(background, -20, -20, WORLD_W + 40, WORLD_H + 40);
  for (const s of stars) {
    ctx.globalAlpha = 0.5 + Math.sin(t * 2 + s.tw) * 0.4;
    ctx.fillStyle = "#fff";
    ctx.fillRect(s.x, s.y, s.r, s.r);
  }
  ctx.globalAlpha = 1;

  drawPlatforms(ctx, t);
  for (const pk of game.pickups) drawPickup(ctx, pk.x + pk.w / 2, pk.y + pk.h / 2, pk.kind, t, pk.life);
  for (const e of game.enemies) drawEnemy(ctx, e, t);
  if (game.status !== "gameover") drawPlayer(ctx, game.player, t);
  drawProjectiles(ctx, game);
  drawEffects(ctx, game);

  ctx.restore();

  // Screen-space overlays
  const p = game.player;
  if (p.flash > 0) {
    ctx.fillStyle = `rgba(34,197,94,${p.flash * 0.45})`;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  }
  if (p.form !== "human" && p.energy < 20 && game.status === "playing" && Math.sin(t * 12) > 0) {
    ctx.strokeStyle = "rgba(239,68,68,0.6)";
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, WORLD_W - 8, WORLD_H - 8);
  }
  if (game.banner > 0 && game.status === "playing") {
    const a = Math.min(1, game.banner * 2);
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 210, WORLD_W, 70);
    ctx.font = `900 38px ${displayFont}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = game.bannerText.includes("BOSS") ? "#c084fc" : "#22c55e";
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 20;
    ctx.fillText(game.bannerText, WORLD_W / 2, 246);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }
}

function drawPlatforms(ctx: Ctx, t: number) {
  for (const pl of PLATFORMS) {
    ctx.fillStyle = "#111827";
    ctx.fillRect(pl.x, pl.y, pl.w, pl.h);
    ctx.fillStyle = "#374151";
    ctx.fillRect(pl.x, pl.y, pl.w, 4);
    ctx.shadowColor = "#22c55e";
    ctx.shadowBlur = 10 + Math.sin(t * 3) * 4;
    ctx.fillStyle = "#22c55e";
    ctx.fillRect(pl.x, pl.y, pl.w, 2);
    ctx.shadowBlur = 0;
  }
}

function drawPickup(ctx: Ctx, x: number, y: number, kind: "energy" | "health", t: number, life: number) {
  if (life < 2 && Math.sin(t * 20) > 0) return; // blink before vanishing
  const bob = Math.sin(t * 4) * 2;
  ctx.save();
  ctx.translate(x, y + bob);
  const color = kind === "energy" ? "#22c55e" : "#f472b6";
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff";
  if (kind === "health") {
    ctx.fillRect(-5, -1.5, 10, 3);
    ctx.fillRect(-1.5, -5, 3, 10);
  } else {
    ctx.beginPath();
    ctx.moveTo(1, -6);
    ctx.lineTo(-4, 1);
    ctx.lineTo(0, 1);
    ctx.lineTo(-1, 6);
    ctx.lineTo(4, -1);
    ctx.lineTo(0, -1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// ───────────────────────────── player forms ─────────────────────────────

function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, width: number, color: string) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function emblem(ctx: Ctx, x: number, y: number, r: number, t: number) {
  ctx.shadowColor = "#22c55e";
  ctx.shadowBlur = 8 + Math.sin(t * 5) * 3;
  ctx.fillStyle = "#111827";
  ctx.beginPath();
  ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  // Shiftwatch symbol: two chevrons meeting in the middle
  ctx.moveTo(x - r, y - r * 0.8);
  ctx.lineTo(x, y);
  ctx.lineTo(x - r, y + r * 0.8);
  ctx.moveTo(x + r, y - r * 0.8);
  ctx.lineTo(x, y);
  ctx.lineTo(x + r, y + r * 0.8);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function polygon(ctx: Ctx, pts: number[], fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer(ctx: Ctx, p: Player, t: number) {
  if (p.invuln > 0 && p.flash <= 0 && p.dashTimer <= 0 && Math.floor(t * 20) % 2 === 0) return;

  const moving = p.onGround && Math.abs(p.vx) > 0.5;
  const swing = moving ? Math.sin(p.anim * (p.form === "bolt" ? 0.6 : 1.2)) * (p.form === "titan" ? 5 : 7) : 0;
  const punch = p.attackAnim > 0 ? 10 : 0;
  const cx = p.x + p.w / 2;

  // Transformation beam
  if (p.flash > 0) {
    ctx.fillStyle = `rgba(134,239,172,${p.flash})`;
    ctx.fillRect(cx - 30, 0, 60, p.y + p.h);
  }

  ctx.save();
  ctx.translate(cx, p.y + p.h);
  ctx.scale(p.facing, 1);
  if (!p.onGround) ctx.translate(0, -1);

  switch (p.form) {
    case "human": {
      limb(ctx, -4, -16, -4 - swing * 0.6, 0, 5, "#1f2937");
      limb(ctx, 4, -16, 4 + swing * 0.6, 0, 5, "#1f2937");
      limb(ctx, -4, -28, -8 - swing * 0.4, -18, 4, "#1d4ed8");
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.roundRect(-9, -33, 18, 19, 4);
      ctx.fill();
      ctx.fillStyle = "#e5e7eb";
      ctx.fillRect(-1, -33, 2, 19);
      limb(ctx, 4, -28, 11 + punch, -21, 4, "#1d4ed8");
      ctx.fillStyle = "#f1c27d";
      ctx.beginPath();
      ctx.arc(12 + punch, -21, 3, 0, Math.PI * 2);
      ctx.fill();
      // The Shiftwatch
      ctx.shadowColor = "#22c55e";
      ctx.shadowBlur = 10;
      ctx.fillStyle = "#22c55e";
      ctx.fillRect(7 + punch, -25, 4, 4);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#f1c27d";
      ctx.beginPath();
      ctx.arc(0, -39, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#3b2314";
      ctx.beginPath();
      ctx.arc(-1, -42, 8.5, Math.PI * 0.95, Math.PI * 2.1);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.fillRect(3, -40, 2, 3);
      break;
    }

    case "blaze": {
      limb(ctx, -5, -20, -5 - swing * 0.6, 0, 7, "#7c2d12");
      limb(ctx, 5, -20, 5 + swing * 0.6, 0, 7, "#7c2d12");
      limb(ctx, -8, -36, -13 - swing * 0.3, -22, 6, "#9a3412");
      const body = ctx.createLinearGradient(0, -42, 0, -18);
      body.addColorStop(0, "#ea580c");
      body.addColorStop(1, "#7c2d12");
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.roundRect(-12, -42, 24, 24, 6);
      ctx.fill();
      // Magma cracks
      ctx.strokeStyle = "#fde047";
      ctx.lineWidth = 1.5;
      ctx.shadowColor = "#fde047";
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(-8, -38);
      ctx.lineTo(-3, -30);
      ctx.lineTo(-7, -22);
      ctx.moveTo(7, -36);
      ctx.lineTo(3, -26);
      ctx.stroke();
      ctx.shadowBlur = 0;
      limb(ctx, 8, -36, 15 + punch, -30, 6, "#9a3412");
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(16 + punch, -30, 4, 0, Math.PI * 2);
      ctx.fill();
      emblem(ctx, 0, -33, 4, t);
      // Flame head
      const f1 = Math.sin(t * 18) * 3;
      const f2 = Math.cos(t * 23) * 3;
      ctx.shadowColor = "#f97316";
      ctx.shadowBlur = 18;
      polygon(ctx, [-11, -44, -9 + f1, -60, -3, -54, 1 + f2, -70, 5, -56, 10 + f1, -62, 11, -44], "#f97316");
      polygon(ctx, [-7, -44, -4 + f2, -56, 1, -52, 3 + f1, -62, 7, -44], "#fde047");
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#7c2d12";
      ctx.beginPath();
      ctx.ellipse(0, -47, 9, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fef08a";
      ctx.fillRect(1, -49, 6, 2.5);
      break;
    }

    case "titan": {
      limb(ctx, -10, -26, -10 - swing * 0.5, 0, 13, "#57534e");
      limb(ctx, 10, -26, 10 + swing * 0.5, 0, 13, "#57534e");
      // Back arm
      limb(ctx, -18, -56, -26, -34, 11, "#57534e");
      ctx.fillStyle = "#57534e";
      ctx.beginPath();
      ctx.arc(-26, -32, 10, 0, Math.PI * 2);
      ctx.fill();
      polygon(ctx, [-25, -26, -22, -62, 22, -62, 25, -26], "#78716c");
      ctx.strokeStyle = "#44403c";
      ctx.lineWidth = 2;
      ctx.stroke();
      // Glowing cracks
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#fb923c";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.moveTo(-16, -56);
      ctx.lineTo(-9, -45);
      ctx.lineTo(-14, -34);
      ctx.moveTo(14, -52);
      ctx.lineTo(8, -40);
      ctx.lineTo(13, -30);
      ctx.stroke();
      ctx.shadowBlur = 0;
      emblem(ctx, 0, -46, 6, t);
      ctx.fillStyle = "#a8a29e";
      ctx.beginPath();
      ctx.roundRect(-9, -72, 18, 13, 4);
      ctx.fill();
      ctx.fillStyle = "#fb923c";
      ctx.fillRect(1, -68, 7, 3);
      // Front arm + giant fist
      limb(ctx, 18, -56, 28 + punch * 1.6, -36, 12, "#78716c");
      ctx.fillStyle = "#a8a29e";
      ctx.beginPath();
      ctx.arc(30 + punch * 1.6, -34, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#57534e";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }

    case "bolt": {
      ctx.rotate(Math.min(Math.abs(p.vx) / 40, 0.2));
      limb(ctx, -4, -20, -4 - swing, 0, 5, "#1e3a8a");
      limb(ctx, 4, -20, 4 + swing, 0, 5, "#1e3a8a");
      limb(ctx, -5, -32, -12 - swing * 0.5, -22, 4, "#1e40af");
      ctx.fillStyle = "#1d4ed8";
      ctx.beginPath();
      ctx.roundRect(-9, -38, 18, 20, 5);
      ctx.fill();
      polygon(ctx, [2, -38, -4, -28, 1, -28, -3, -18, 5, -30, 0, -30, 5, -38], "#facc15");
      emblem(ctx, -4, -33, 3, t);
      limb(ctx, 5, -32, 13 + punch, -27, 4, "#1e40af");
      ctx.fillStyle = "#facc15";
      ctx.beginPath();
      ctx.arc(14 + punch, -27, 3, 0, Math.PI * 2);
      ctx.fill();
      // Helmet + visor
      ctx.fillStyle = "#1e40af";
      ctx.beginPath();
      ctx.arc(0, -44, 8.5, 0, Math.PI * 2);
      ctx.fill();
      polygon(ctx, [-6, -52, -14, -56, -4, -47], "#facc15");
      ctx.fillStyle = "#22d3ee";
      ctx.shadowColor = "#22d3ee";
      ctx.shadowBlur = 8;
      ctx.fillRect(0, -47, 8, 4);
      ctx.shadowBlur = 0;
      break;
    }

    case "shard": {
      polygon(ctx, [-9, -22, -4, -22, -6 - swing * 0.5, 0, -11 - swing * 0.5, 0], "#0f766e");
      polygon(ctx, [4, -22, 9, -22, 11 + swing * 0.5, 0, 6 + swing * 0.5, 0], "#0f766e");
      polygon(ctx, [-14, -40, -20, -24, -12, -26], "#0d9488");
      polygon(ctx, [-13, -46, 13, -46, 16, -34, 9, -20, -9, -20, -16, -34], "#14b8a6");
      ctx.globalAlpha = 0.5;
      polygon(ctx, [-13, -46, 0, -46, -4, -20, -9, -20, -16, -34], "#5eead4");
      ctx.globalAlpha = 1;
      // Shoulder crystals
      polygon(ctx, [-13, -46, -18, -60, -8, -46], "#99f6e4");
      polygon(ctx, [13, -46, 18, -60, 8, -46], "#99f6e4");
      emblem(ctx, 0, -35, 4, t);
      polygon(ctx, [12, -42, 20 + punch, -34, 12, -30], "#5eead4");
      // Diamond head
      polygon(ctx, [0, -60, 9, -52, 0, -44, -9, -52], "#99f6e4");
      polygon(ctx, [0, -60, 9, -52, 0, -52], "#ccfbf1");
      ctx.fillStyle = "#134e4a";
      ctx.fillRect(2, -54, 5, 3);
      break;
    }
  }
  ctx.restore();

  // Prism Shield
  if (p.shieldTimer > 0) {
    const cy = p.y + p.h / 2;
    const r = 46 + Math.sin(t * 10) * 2;
    ctx.save();
    ctx.globalAlpha = p.shieldTimer < 0.8 && Math.sin(t * 25) > 0 ? 0.25 : 0.55;
    ctx.strokeStyle = "#a5f3fc";
    ctx.fillStyle = "rgba(165,243,252,0.15)";
    ctx.lineWidth = 3;
    ctx.shadowColor = "#22d3ee";
    ctx.shadowBlur = 16;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + t;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
}

// ───────────────────────────── enemies ─────────────────────────────

function drawEnemy(ctx: Ctx, e: Enemy, t: number) {
  const white = e.hitFlash > 0;
  const cx = e.x + e.w / 2;
  ctx.save();

  switch (e.kind) {
    case "crawler": {
      const legT = t * 14 + e.id;
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        const lx = e.x + 6 + i * 11;
        const lift = Math.sin(legT + i * 2) * 3;
        ctx.beginPath();
        ctx.moveTo(lx, e.y + 14);
        ctx.lineTo(lx - 4, e.y + e.h + Math.min(0, lift));
        ctx.stroke();
      }
      ctx.fillStyle = white ? "#fff" : "#374151";
      ctx.beginPath();
      ctx.ellipse(cx, e.y + 12, e.w / 2, 12, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = white ? "#fff" : "#4b5563";
      ctx.fillRect(e.x + 2, e.y + 10, e.w - 4, 6);
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx + Math.sign(e.vx || 1) * 8, e.y + 7, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case "drone": {
      ctx.fillStyle = `rgba(56,189,248,${0.4 + Math.random() * 0.4})`;
      ctx.beginPath();
      ctx.moveTo(cx - 6, e.y + e.h - 2);
      ctx.lineTo(cx, e.y + e.h + 10 + Math.random() * 6);
      ctx.lineTo(cx + 6, e.y + e.h - 2);
      ctx.fill();
      ctx.fillStyle = white ? "#fff" : "#9ca3af";
      ctx.beginPath();
      ctx.ellipse(cx, e.y + 8, 11, 9, 0, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = white ? "#fff" : "#4b5563";
      ctx.beginPath();
      ctx.ellipse(cx, e.y + 14, e.w / 2, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f43f5e";
      ctx.shadowColor = "#f43f5e";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(cx, e.y + 14, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#fde047";
      for (let i = -1; i <= 1; i += 2) ctx.fillRect(cx + i * 14 - 1.5, e.y + 13, 3, 3);
      break;
    }

    case "brute": {
      const dir = Math.sign(e.vx || 1);
      ctx.fillStyle = white ? "#fff" : "#1f2937";
      ctx.fillRect(e.x + 8, e.y + e.h - 20, 14, 20);
      ctx.fillRect(e.x + e.w - 22, e.y + e.h - 20, 14, 20);
      ctx.fillStyle = white ? "#fff" : "#4c1d95";
      ctx.beginPath();
      ctx.roundRect(e.x + 2, e.y + 10, e.w - 4, e.h - 28, 8);
      ctx.fill();
      ctx.fillStyle = white ? "#fff" : "#6d28d9";
      ctx.fillRect(e.x - 6, e.y + 18, 10, 30);
      ctx.fillRect(e.x + e.w - 4, e.y + 18, 10, 30);
      ctx.fillStyle = white ? "#fff" : "#312e81";
      ctx.beginPath();
      ctx.roundRect(cx - 14, e.y, 28, 16, 5);
      ctx.fill();
      ctx.fillStyle = "#e879f9";
      ctx.shadowColor = "#e879f9";
      ctx.shadowBlur = 12;
      ctx.fillRect(cx - 10 + dir * 3, e.y + 5, 20, 4);
      ctx.beginPath();
      ctx.arc(cx, e.y + 32, 5 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case "boss": {
      const pulse = 0.6 + Math.sin(t * 5) * 0.4;
      ctx.fillStyle = white ? "#fff" : "#312e81";
      ctx.beginPath();
      ctx.ellipse(cx, e.y + e.h * 0.55, e.w / 2, e.h * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = white ? "#fff" : "#1e1b4b";
      ctx.fillRect(e.x + 20, e.y + e.h * 0.6, 16, 26);
      ctx.fillRect(e.x + e.w - 36, e.y + e.h * 0.6, 16, 26);
      ctx.fillStyle = "rgba(167,139,250,0.85)";
      ctx.beginPath();
      ctx.ellipse(cx, e.y + e.h * 0.4, 42, 32, 0, Math.PI, 0);
      ctx.fill();
      // Lights around the hull
      for (let i = 0; i < 9; i++) {
        const lx = e.x + 18 + i * ((e.w - 36) / 8);
        ctx.fillStyle = Math.floor(t * 6 + i) % 3 === 0 ? "#fde047" : "#6366f1";
        ctx.fillRect(lx - 2, e.y + e.h * 0.55 - 2, 4, 4);
      }
      ctx.fillStyle = "#ef4444";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 30 * pulse;
      ctx.beginPath();
      ctx.arc(cx, e.y + e.h * 0.75, 12 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // Pilot silhouette
      ctx.fillStyle = "#1e1b4b";
      ctx.beginPath();
      ctx.arc(cx, e.y + e.h * 0.3, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(cx - 7, e.y + e.h * 0.28, 5, 3);
      ctx.fillRect(cx + 2, e.y + e.h * 0.28, 5, 3);
      break;
    }
  }
  ctx.restore();

  if (e.kind !== "boss" && e.hp < e.maxHp) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(e.x, e.y - 8, e.w, 4);
    ctx.fillStyle = "#ef4444";
    ctx.fillRect(e.x, e.y - 8, (e.w * Math.max(0, e.hp)) / e.maxHp, 4);
  }
}

// ───────────────────────────── projectiles & effects ─────────────────────────────

function drawProjectiles(ctx: Ctx, game: GameEngine) {
  for (const pr of game.projectiles) {
    ctx.save();
    ctx.shadowColor = pr.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = pr.color;
    switch (pr.kind) {
      case "fire":
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fef08a";
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      case "crystal": {
        ctx.translate(pr.x, pr.y);
        ctx.rotate(Math.atan2(pr.vy, pr.vx));
        polygon(ctx, [10, 0, 0, -4, -8, 0, 0, 4], pr.color);
        break;
      }
      case "wave":
        ctx.globalAlpha = Math.min(1, pr.life * 2);
        ctx.beginPath();
        ctx.moveTo(pr.x - 20, GROUND_Y);
        ctx.lineTo(pr.x - 6, GROUND_Y - 34);
        ctx.lineTo(pr.x + 2, GROUND_Y - 18);
        ctx.lineTo(pr.x + 10, GROUND_Y - 40);
        ctx.lineTo(pr.x + 22, GROUND_Y);
        ctx.fillStyle = "#a8a29e";
        ctx.fill();
        break;
      default:
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(pr.x, pr.y, pr.r * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();
  }
}

function drawEffects(ctx: Ctx, game: GameEngine) {
  for (const s of game.slashes) {
    ctx.save();
    ctx.globalAlpha = s.life / 0.15;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 4;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 12;
    const cx = s.facing > 0 ? s.x : s.x + s.w;
    ctx.beginPath();
    ctx.ellipse(cx, s.y + s.h / 2, s.w, s.h / 2, 0, s.facing > 0 ? -1.1 : Math.PI - 1.1, s.facing > 0 ? 1.1 : Math.PI + 1.1);
    ctx.stroke();
    ctx.restore();
  }

  for (const ring of game.rings) {
    const k = 1 - ring.life / ring.maxLife;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = ring.color;
    ctx.lineWidth = 10 * (1 - k) + 2;
    ctx.shadowColor = ring.color;
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(ring.x, ring.y, ring.maxR * k, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const pt of game.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const tx of game.texts) {
    ctx.globalAlpha = Math.min(1, tx.life * 2);
    ctx.font = `800 ${tx.size}px ${displayFont}`;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(tx.text, tx.x, tx.y);
    ctx.fillStyle = tx.color;
    ctx.fillText(tx.text, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
}
