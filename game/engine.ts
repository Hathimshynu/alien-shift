import { sfx } from "./audio";
import { GameSim } from "./core/sim";
import type { FormId } from "./core/types";
import { STEP, WORLD_H, WORLD_W } from "./core/world";
import { Input } from "./input";
import { renderGame } from "./render";
import { QUALITY_DPR, useGameStore } from "./store";

/**
 * Browser driver around the pure `GameSim`: owns the requestAnimationFrame loop, the canvas,
 * input and audio, and bridges simulation events to the zustand store (HUD + save data).
 */
export class GameEngine {
  readonly input = new Input();
  readonly sim = new GameSim();

  private ctx: CanvasRenderingContext2D;
  private time = 0;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private hudTimer = 0;
  private resizeObserver: ResizeObserver;
  private unsubscribe: () => void;

  constructor(private canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D is not supported in this browser");
    this.ctx = ctx;
    this.input.attach(window);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);

    sfx.muted = useGameStore.getState().settings.muted;
    this.unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.settings.quality !== prev.settings.quality) this.resize();
      sfx.muted = s.settings.muted;
    });

    // Browsers only allow audio after a user gesture; unlock on the first one of any kind.
    window.addEventListener("pointerdown", this.unlockAudio);
    window.addEventListener("keydown", this.unlockAudio);
    window.addEventListener("pagehide", this.persist);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
  }

  // ───────────────────────────── lifecycle ─────────────────────────────

  start() {
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
    this.emitHud();
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.input.detach();
    this.resizeObserver.disconnect();
    this.unsubscribe();
    window.removeEventListener("pointerdown", this.unlockAudio);
    window.removeEventListener("keydown", this.unlockAudio);
    window.removeEventListener("pagehide", this.persist);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.persist();
  }

  startGame() {
    sfx.unlock();
    this.acc = 0;
    this.sim.startGame();
    this.flushEvents();
  }

  togglePause() {
    this.sim.togglePause();
    this.flushEvents();
  }

  toggleMute() {
    useGameStore.getState().toggleMuted();
  }

  requestTransform(id: FormId) {
    this.sim.requestTransform(id);
  }

  private unlockAudio = () => sfx.unlock();

  private persist = () => useGameStore.getState().persistSave();

  /** Auto-pause when the tab/app goes to the background (phone call, app switch). */
  private onVisibility = () => {
    if (document.visibilityState !== "hidden") return;
    if (this.sim.status === "playing") this.togglePause();
    this.persist();
  };

  private resize() {
    const maxDpr = QUALITY_DPR[useGameStore.getState().settings.quality];
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private loop = (now: number) => {
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    const sim = this.sim;
    const input = this.input;

    if (input.consume("mute")) this.toggleMute();

    if (sim.status === "playing") {
      this.acc += dt;
      while (this.acc >= STEP) {
        sim.update(input);
        // Clear edges after *each* step: when a slow frame runs several steps, a single
        // key press must not be replayed (it used to fire Bolt's double jump instantly).
        input.clearPressed();
        this.acc -= STEP;
        if (sim.status !== "playing") break;
      }
    } else {
      if (sim.status === "paused" && input.consume("pause")) this.togglePause();
      else if ((sim.status === "menu" || sim.status === "gameover") && input.consume("start")) this.startGame();
      input.clearPressed();
    }
    this.flushEvents();

    this.ctx.setTransform(this.canvas.width / WORLD_W, 0, 0, this.canvas.height / WORLD_H, 0, 0);
    renderGame(this.ctx, sim, this.time);

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.emitHud();
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  /** Perform the side effects the simulation queued since the last flush. */
  private flushEvents() {
    const events = this.sim.events;
    for (const ev of events) {
      switch (ev.type) {
        case "sfx":
          sfx.play(ev.name);
          break;
        case "status":
          this.input.releaseAll();
          this.emitHud();
          if (ev.status !== "playing") this.persist();
          break;
        case "waveCleared":
          this.persist();
          break;
      }
    }
    events.length = 0;
  }

  private emitHud() {
    const hud = this.sim.hudSnapshot();
    const store = useGameStore.getState();
    store.setHud(hud);
    store.recordScore(hud.score);
  }
}
