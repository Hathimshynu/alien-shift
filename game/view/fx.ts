import type { FxSink } from "../core/events";

const colorCache = new Map<string, [number, number, number]>();

/** "#rrggbb" → linear-ish 0..1 floats (cached; the palette is small). */
export function hexToRgb(hex: string): [number, number, number] {
  let c = colorCache.get(hex);
  if (!c) {
    const n = parseInt(hex.slice(1), 16);
    c = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    colorCache.set(hex, c);
  }
  return c;
}

export interface FloatingText {
  active: boolean;
  x: number;
  y: number;
  z: number;
  text: string;
  color: string;
  size: number;
  life: number;
}

export const MAX_PARTICLES = 1500;
export const MAX_TEXTS = 32;
const TEXT_LIFE = 1;

/**
 * Pooled particles (struct-of-arrays) and floating texts. The sim writes into it through the
 * `FxSink` interface; the Particles / FloatingTexts views read it every frame. Nothing is allocated
 * during play. Dead particles are removed with swap-remove so the live ones stay packed at the front.
 */
export class FxSystem implements FxSink {
  /** Live particle count (they occupy indices 0..count-1). */
  count = 0;
  /** Current cap (quality dependent) and a 0..1 multiplier for burst sizes. */
  limit = 400;
  density = 0.5;

  readonly pos = new Float32Array(MAX_PARTICLES * 3);
  readonly vel = new Float32Array(MAX_PARTICLES * 3);
  readonly col = new Float32Array(MAX_PARTICLES * 3);
  readonly life = new Float32Array(MAX_PARTICLES);
  readonly maxLife = new Float32Array(MAX_PARTICLES);
  readonly gravity = new Float32Array(MAX_PARTICLES);

  readonly texts: FloatingText[] = Array.from({ length: MAX_TEXTS }, () => ({
    active: false,
    x: 0,
    y: 0,
    z: 0,
    text: "",
    color: "#fff",
    size: 14,
    life: 0,
  }));
  private nextText = 0;

  setQuality(limit: number, density: number) {
    this.limit = Math.min(MAX_PARTICLES, limit);
    this.density = density;
    this.count = Math.min(this.count, this.limit);
  }

  clear() {
    this.count = 0;
    for (const t of this.texts) t.active = false;
  }

  spark(x: number, y: number, z: number, vx: number, vy: number, vz: number, color: string, life: number, gravity = 9) {
    if (this.count >= this.limit) return;
    const i = this.count++;
    const [r, g, b] = hexToRgb(color);
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx;
    this.vel[i * 3 + 1] = vy;
    this.vel[i * 3 + 2] = vz;
    this.col[i * 3] = r;
    this.col[i * 3 + 1] = g;
    this.col[i * 3 + 2] = b;
    this.life[i] = life;
    this.maxLife[i] = life;
    this.gravity[i] = gravity;
  }

  burst(x: number, y: number, z: number, count: number, color: string, speed: number) {
    const n = Math.max(1, Math.round(count * this.density));
    for (let i = 0; i < n; i++) {
      // Random direction on a sphere, biased slightly upwards so bursts read well from above.
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const v = speed * (0.3 + Math.random() * 0.7);
      this.spark(x, y, z, Math.cos(a) * s * v, (Math.abs(u) * 0.8 + 0.2) * v, Math.sin(a) * s * v, color, 0.3 + Math.random() * 0.5);
    }
  }

  text(x: number, y: number, z: number, text: string, color: string, size: number) {
    // Ring buffer: when all slots are busy the oldest text is recycled.
    const t = this.texts[this.nextText];
    this.nextText = (this.nextText + 1) % MAX_TEXTS;
    t.active = true;
    t.x = x;
    t.y = y;
    t.z = z;
    t.text = text;
    t.color = color;
    t.size = size;
    t.life = TEXT_LIFE;
  }

  /** Integrate particles and texts (cosmetic, so it runs on frame time rather than the fixed step). */
  update(dt: number) {
    const { pos, vel, life, gravity } = this;
    let i = 0;
    while (i < this.count) {
      life[i] -= dt;
      if (life[i] <= 0) {
        this.copy(--this.count, i);
        continue;
      }
      vel[i * 3 + 1] -= gravity[i] * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      if (pos[i * 3 + 1] < 0.02) {
        pos[i * 3 + 1] = 0.02;
        vel[i * 3 + 1] *= -0.3; // tiny bounce off the street
      }
      i++;
    }
    for (const t of this.texts) {
      if (!t.active) continue;
      t.life -= dt;
      t.y += dt * 1.2;
      if (t.life <= 0) t.active = false;
    }
  }

  private copy(from: number, to: number) {
    if (from === to) return;
    for (let k = 0; k < 3; k++) {
      this.pos[to * 3 + k] = this.pos[from * 3 + k];
      this.vel[to * 3 + k] = this.vel[from * 3 + k];
      this.col[to * 3 + k] = this.col[from * 3 + k];
    }
    this.life[to] = this.life[from];
    this.maxLife[to] = this.maxLife[from];
    this.gravity[to] = this.gravity[from];
  }
}
