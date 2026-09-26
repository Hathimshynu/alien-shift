import type { SfxName } from "./core/events";

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** Tiny WebAudio synth — every sound effect is generated, no audio files needed. */
class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
    }
    void this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.06, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  private noise(dur: number, vol = 0.08) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    src.buffer = buffer;
    gain.gain.value = vol;
    src.connect(gain).connect(ctx.destination);
    src.start();
  }

  jump() { this.tone(300, 0.15, "square", 0.04, 600); }
  punch() { this.noise(0.08, 0.06); this.tone(160, 0.08, "triangle", 0.06, 80); }
  heavy() { this.noise(0.25, 0.12); this.tone(90, 0.3, "sawtooth", 0.08, 40); }
  shoot() { this.tone(700, 0.1, "sawtooth", 0.03, 250); }
  crystal() { this.tone(1200, 0.12, "triangle", 0.04, 1800); }
  zap() { this.tone(900, 0.18, "square", 0.04, 120); }
  hit() { this.tone(220, 0.06, "square", 0.04, 110); }
  hurt() { this.tone(180, 0.3, "sawtooth", 0.07, 60); }
  explode() { this.noise(0.35, 0.1); }
  pickup() { this.tone(660, 0.08, "sine", 0.06); this.tone(990, 0.12, "sine", 0.05); }
  error() { this.tone(140, 0.15, "square", 0.05); }
  shield() { this.tone(500, 0.4, "sine", 0.05, 1500); }
  enemyShot() { this.tone(400, 0.08, "square", 0.02, 200); }

  transform() {
    [440, 660, 880, 1320].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, "square", 0.04), i * 55));
  }

  timeout() {
    [800, 600, 400, 250].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, "square", 0.05), i * 110));
  }

  wave() {
    [523, 659, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.2, "triangle", 0.06), i * 120));
  }

  /** Play a sound requested by the simulation (see `SfxName`). */
  play(name: SfxName) {
    this[name]();
  }

  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, "triangle", 0.07), i * 220));
  }
}

export const sfx = new Sfx();
