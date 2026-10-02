import type { SfxName } from "./core/events";

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

/** Most sounds allowed to play at the same moment; extra ones are skipped (they'd only add noise). */
const MAX_VOICES = 14;
/** Overall loudness at 100% volume (individual sounds were tuned against this). */
const MASTER_LEVEL = 0.9;

/**
 * Tiny WebAudio synth — every sound effect is generated, no audio files needed.
 * Every sound goes through one master volume and a compressor (an automatic limiter), so when a
 * lot happens at once (rifle fire, hits, explosions, a boss) the total can't suddenly get loud.
 */
class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private voices = 0;
  private _muted = false;
  private _volume = 0.8;

  get muted() {
    return this._muted;
  }

  set muted(m: boolean) {
    this._muted = m;
    this.applyVolume();
  }

  /** 0..1, from the settings. */
  get volume() {
    return this._volume;
  }

  set volume(v: number) {
    this._volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  private applyVolume() {
    if (!this.ctx || !this.master) return;
    const target = this._muted ? 0 : this._volume * MASTER_LEVEL;
    // Short ramp: changing the volume never clicks or jumps.
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.03);
  }

  unlock() {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -20;
      limiter.knee.value = 10;
      limiter.ratio.value = 8;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      const master = ctx.createGain();
      master.gain.value = this._muted ? 0 : this._volume * MASTER_LEVEL;
      master.connect(limiter).connect(ctx.destination);
      // One reusable second of white noise (explosions, punches) instead of a new buffer per sound.
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.noiseBuffer = buf;
    }
    void this.ctx.resume();
  }

  /** Reserve a voice; false when too many sounds are already playing. */
  private voice(node: AudioScheduledSourceNode) {
    if (this.voices >= MAX_VOICES) return false;
    this.voices++;
    node.onended = () => {
      this.voices = Math.max(0, this.voices - 1);
    };
    return true;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.06, slideTo?: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this._muted || ctx.state !== "running") return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    if (!this.voice(osc)) return;
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  private noise(dur: number, vol = 0.08) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noiseBuffer || this._muted || ctx.state !== "running") return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    if (!this.voice(src)) return;
    const gain = ctx.createGain();
    src.buffer = this.noiseBuffer;
    // Fade out over the sound's length (the old version baked this fade into each new buffer).
    gain.gain.setValueAtTime(vol, t);
    gain.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(gain).connect(this.master);
    const d = Math.min(dur, 0.95);
    src.start(t, Math.random() * (1 - d), d);
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

  sting() {
    // Transformation sting: rising sweep + chord.
    this.tone(220, 0.45, "sawtooth", 0.05, 1760);
    [523, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, "triangle", 0.05), 180 + i * 40));
  }
  ultimate() {
    this.tone(110, 0.8, "sawtooth", 0.07, 880);
    this.noise(0.6, 0.06);
    [659, 880, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, "square", 0.04), 300 + i * 70));
  }
  dodge() { this.noise(0.12, 0.05); this.tone(600, 0.1, "sine", 0.03, 300); }
  block() { this.tone(1500, 0.06, "square", 0.04, 900); }
  freeze() { this.tone(2000, 0.25, "sine", 0.04, 700); this.noise(0.15, 0.03); }
  laser() { this.tone(1800, 0.12, "sawtooth", 0.03, 600); }
  vortex() { this.tone(80, 0.5, "sine", 0.08, 40); this.tone(300, 0.4, "triangle", 0.03, 60); }
  boom() { this.noise(0.5, 0.14); this.tone(70, 0.5, "sine", 0.1, 30); }
  core() { this.tone(1320, 0.07, "sine", 0.04, 1760); }
  phase() {
    this.tone(90, 0.9, "sawtooth", 0.08, 45);
    [196, 185, 175].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, "square", 0.05), i * 150));
  }

  // Kai's guns and powers
  pistol() { this.noise(0.06, 0.05); this.tone(900, 0.07, "square", 0.03, 300); }
  rifle() { this.noise(0.04, 0.04); this.tone(700, 0.05, "square", 0.025, 250); }
  shotgun() { this.noise(0.22, 0.12); this.tone(120, 0.18, "sawtooth", 0.06, 50); }
  plasmaShot() { this.tone(500, 0.16, "sine", 0.05, 1400); this.tone(250, 0.12, "triangle", 0.03, 700); }
  cannon() { this.noise(0.4, 0.14); this.tone(60, 0.45, "sawtooth", 0.09, 30); }
  reload() { this.tone(300, 0.05, "square", 0.03); setTimeout(() => this.tone(520, 0.06, "square", 0.03), 140); }
  empty() { this.tone(1200, 0.03, "square", 0.02); }
  charge() { this.tone(150, 0.25, "sawtooth", 0.05, 900); }
  blast() { this.tone(200, 0.35, "sawtooth", 0.06, 900); this.noise(0.2, 0.05); }
  whoosh() { this.noise(0.18, 0.05); this.tone(900, 0.15, "sine", 0.025, 250); }
  impact() {
    this.noise(0.6, 0.16);
    this.tone(55, 0.7, "sine", 0.12, 25);
    this.tone(160, 0.3, "sawtooth", 0.06, 40);
  }
  shard() { [880, 1175, 1568].forEach((f, i) => setTimeout(() => this.tone(f, 0.15, "sine", 0.05), i * 70)); }
  checkpoint() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, "triangle", 0.05), i * 90)); }
  levelComplete() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, "triangle", 0.06), i * 140));
  }
  enrage() { this.tone(70, 0.8, "sawtooth", 0.09, 140); this.noise(0.4, 0.06); }
  bossDeath() {
    this.noise(1.2, 0.16);
    [200, 150, 110, 80].forEach((f, i) => setTimeout(() => this.tone(f, 0.4, "sawtooth", 0.07, f / 2), i * 260));
  }

  private lastPlayed = new Map<SfxName, number>();

  /**
   * Play a sound requested by the simulation (see `SfxName`). The same sound is played at most
   * once every 40 ms: an ultimate can land dozens of hits in one frame, and every tone creates
   * audio nodes, which is costly on weak phones.
   */
  play(name: SfxName) {
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) ?? -1e9) < 40) return;
    this.lastPlayed.set(name, now);
    this[name]();
  }

  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, "triangle", 0.07), i * 220));
  }
}

export const sfx = new Sfx();
