// Generates the app icons (PNG) from the Shiftwatch emblem — no image tools needed.
// Run once after changing the design:  node scripts/make-icons.mjs
// Output: public/icons/icon-192.png, icon-512.png, maskable-512.png, apple-touch-icon.png

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

// ── tiny PNG encoder (RGBA, no filtering) ──
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

// ── the emblem, in the same 64-unit space as app/icon.svg ──
const hex = (r) => Array.from({ length: 6 }, (_, i) => [32 + r * Math.cos((Math.PI / 3) * i - Math.PI / 2), 32 + r * Math.sin((Math.PI / 3) * i - Math.PI / 2)]);
const HEX_OUT = hex(31);
const HEX_IN = hex(27);
const DIAMOND = [
  [32, 13],
  [45, 32],
  [32, 51],
  [19, 32],
];
function inside(poly, x, y) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const rgb = (hexStr) => [parseInt(hexStr.slice(1, 3), 16), parseInt(hexStr.slice(3, 5), 16), parseInt(hexStr.slice(5, 7), 16)];
const BG = rgb("#030712");
const HEX_FILL = rgb("#111827");
const GREEN = rgb("#22c55e");
const CORE = rgb("#dcfce7");

/** Colour of the emblem at (u, v) in 64-unit space; null = outside everything. */
function emblem(u, v) {
  if (u >= 28.5 && u <= 35.5 && v >= 28.5 && v <= 35.5) return CORE;
  if (inside(DIAMOND, u, v)) return GREEN;
  if (inside(HEX_IN, u, v)) return HEX_FILL;
  if (inside(HEX_OUT, u, v)) return GREEN;
  return null;
}

/**
 * Render an icon. `scale` shrinks the emblem (maskable icons keep it inside the 80% safe zone);
 * `rounded` gives the plain icons rounded corners with a transparent outside.
 */
function render(size, { scale = 0.86, rounded = true } = {}) {
  const buf = Buffer.alloc(size * size * 4);
  const SS = 4; // 4×4 supersampling for smooth edges
  const radius = size * 0.22;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = x + (sx + 0.5) / SS;
          const py = y + (sy + 0.5) / SS;
          if (rounded) {
            // Rounded-square background mask.
            const cx = Math.min(Math.max(px, radius), size - radius);
            const cy = Math.min(Math.max(py, radius), size - radius);
            if (Math.hypot(px - cx, py - cy) > radius) continue;
          }
          const u = 32 + ((px / size - 0.5) * 64) / scale;
          const v = 32 + ((py / size - 0.5) * 64) / scale;
          const c = emblem(u, v) ?? BG;
          r += c[0];
          g += c[1];
          b += c[2];
          a += 255;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      // Premultiplied average → straight alpha.
      const alpha = a / n;
      buf[i] = alpha ? Math.round((r / n) * (255 / alpha)) : 0;
      buf[i + 1] = alpha ? Math.round((g / n) * (255 / alpha)) : 0;
      buf[i + 2] = alpha ? Math.round((b / n) * (255 / alpha)) : 0;
      buf[i + 3] = Math.round(alpha);
    }
  }
  return png(size, buf);
}

writeFileSync(join(outDir, "icon-192.png"), render(192));
writeFileSync(join(outDir, "icon-512.png"), render(512));
writeFileSync(join(outDir, "maskable-512.png"), render(512, { scale: 0.62, rounded: false }));
writeFileSync(join(outDir, "apple-touch-icon.png"), render(180, { scale: 0.8, rounded: false }));
console.log("[make-icons] wrote public/icons/*.png");
