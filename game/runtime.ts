import { sfx } from "./audio";
import { STEP } from "./core/arena";
import { Physics } from "./core/physics";
import { GameSim } from "./core/sim";
import type { FormId } from "./core/types";
import { Input } from "./input";
import { QUALITY_PRESETS } from "./quality";
import { useGameStore } from "./store";
import { FxSystem } from "./view/fx";
import { pickFromVector } from "./wheel";

/** How much the watch wheel slows the game while it's open. */
const WHEEL_TIME_SCALE = 0.15;

/**
 * Browser driver around the pure `GameSim`. It owns input, audio and the effect pools, and bridges
 * simulation events to the zustand store (HUD + save data). It has no loop of its own: the 3D scene
 * calls `frame(dt)` once per rendered frame, before anything is drawn.
 */
export class GameRuntime {
  readonly input = new Input();
  readonly fx = new FxSystem();
  readonly sim: GameSim;
  /** 0..1: how far we are between the last two fixed steps (for smooth rendering). */
  alpha = 1;
  /** Real seconds since start (cosmetic animation clock; runs while paused too). */
  time = 0;

  private acc = 0;
  /** The wheel was opened by holding Tab (closes + picks on release) rather than by a touch button. */
  private wheelByKey = false;
  private hudTimer = 0;
  private unsubscribe: () => void;

  /** Loads the physics engine (inlined WebAssembly — no network) and builds the runtime. */
  static async create(): Promise<GameRuntime> {
    return new GameRuntime(await Physics.create());
  }

  private constructor(private physics: Physics) {
    this.sim = new GameSim(physics, this.fx);
    this.input.attach(window);

    const applySettings = () => {
      const { quality, muted, volume } = useGameStore.getState().settings;
      const preset = QUALITY_PRESETS[quality];
      this.fx.setQuality(preset.particles, preset.particleDensity);
      sfx.muted = muted;
      sfx.volume = volume;
    };
    applySettings();
    this.unsubscribe = useGameStore.subscribe((s, prev) => {
      if (s.settings !== prev.settings) applySettings();
    });

    // Browsers only allow audio after a user gesture; unlock on the first one of any kind.
    window.addEventListener("pointerdown", this.unlockAudio);
    window.addEventListener("keydown", this.unlockAudio);
    window.addEventListener("pagehide", this.persist);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.emitHud();
  }

  destroy() {
    this.input.detach();
    this.unsubscribe();
    window.removeEventListener("pointerdown", this.unlockAudio);
    window.removeEventListener("keydown", this.unlockAudio);
    window.removeEventListener("pagehide", this.persist);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.persist();
    this.physics.dispose();
  }

  startGame() {
    sfx.unlock();
    this.acc = 0;
    this.fx.clear();
    this.closeWheel();
    const store = useGameStore.getState();
    this.sim.startGame(store.loadout(), store.mode, store.selectedLevel);
    this.flushEvents();
  }

  /** Campaign: after a defeat, restart from the current stage's checkpoint. */
  retryCheckpoint() {
    this.acc = 0;
    this.fx.clear();
    this.sim.retryCheckpoint();
    this.flushEvents();
  }

  /** Campaign: play the next level after the results screen. */
  nextLevel() {
    const store = useGameStore.getState();
    const next = Math.min(store.save.unlockedLevel, (this.sim.run?.level.id ?? 0) + 1);
    store.selectMode("campaign", next);
    this.startGame();
  }

  /** Back to the main menu (from pause, game over or the results screen). */
  quitToMenu() {
    this.closeWheel();
    this.sim.quitToMenu();
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

  /** Open the watch wheel (touch button / Tab). Time slows and the player stops acting until it closes. */
  openWheel(byKey = false) {
    if (this.sim.status !== "playing" || this.sim.cinematic) return;
    this.wheelByKey = byKey;
    useGameStore.getState().setWheel(true);
    this.sim.inputLocked = true;
  }

  /** Close the wheel, transforming into `pick` if given. */
  closeWheel(pick?: FormId | null) {
    const store = useGameStore.getState();
    if (store.wheelOpen) store.setWheel(false);
    this.sim.inputLocked = false;
    this.wheelByKey = false;
    if (pick) this.sim.requestTransform(pick);
  }

  private unlockAudio = () => sfx.unlock();

  private persist = () => useGameStore.getState().persistSave();

  /** Auto-pause when the tab/app goes to the background (phone call, app switch). */
  private onVisibility = () => {
    if (document.visibilityState !== "hidden") return;
    if (this.sim.status === "playing") this.togglePause();
    this.persist();
  };

  /** Advance the game by one rendered frame of `rawDt` seconds. */
  frame(rawDt: number) {
    const dt = Math.min(0.1, rawDt);
    this.time += dt;
    const sim = this.sim;
    const input = this.input;

    if (input.consume("mute")) this.toggleMute();

    if (sim.status === "playing") {
      this.updateWheel();
      // Slow motion: the sim's own cinematics, and the open watch wheel.
      const scale = sim.timeScale * (useGameStore.getState().wheelOpen ? WHEEL_TIME_SCALE : 1);
      this.acc += dt * scale;
      while (this.acc >= STEP) {
        sim.update(input);
        // Clear edges after *each* step: when a slow frame runs several steps, a single
        // key press must not be replayed (it used to fire Bolt's double jump instantly).
        input.clearPressed();
        this.acc -= STEP;
        if (sim.status !== "playing") break;
      }
      this.alpha = sim.status === "playing" ? this.acc / STEP : 1;
    } else {
      if (sim.status === "paused" && input.consume("pause")) this.togglePause();
      // Campaign defeat: Enter / Space retries from the checkpoint (same as the big button).
      else if (sim.status === "gameover" && sim.run && input.consume("start")) this.retryCheckpoint();
      else if ((sim.status === "menu" || sim.status === "gameover") && input.consume("start")) this.startGame();
      else if (sim.status === "complete" && input.consume("start")) this.nextLevel();
      input.clearPressed();
      this.alpha = 1;
    }
    sim.tickIdle(dt);
    if (sim.status !== "paused") this.fx.update(dt);
    this.flushEvents();

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) {
      this.hudTimer = 0.1;
      this.emitHud();
    }
  }

  /** Tab held → wheel open; the movement direction highlights an alien; releasing Tab picks it. */
  private updateWheel() {
    const input = this.input;
    const store = useGameStore.getState();
    if (!store.wheelOpen) {
      if (input.consume("wheel")) this.openWheel(true);
      return;
    }
    if (!this.wheelByKey) return;
    const m = input.move();
    const pick = pickFromVector(m.x, m.z);
    if (pick && pick !== store.wheelPick) store.setWheelPick(pick);
    if (!input.isHeld("wheel")) this.closeWheel(store.wheelPick);
  }

  /** Phone haptics for the big moments (Android browsers; silently ignored elsewhere). */
  private lastVibrate = 0;
  private vibrate(name: string) {
    const pattern = name === "hurt" ? 35 : name === "impact" ? 60 : name === "bossDeath" ? [80, 60, 120] : name === "levelComplete" ? [40, 40, 40] : 0;
    if (!pattern || !useGameStore.getState().settings.vibration || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    const now = performance.now();
    if (now - this.lastVibrate < 150) return;
    this.lastVibrate = now;
    try {
      navigator.vibrate(pattern);
    } catch {
      // Some browsers block vibration until the user has interacted — not important.
    }
  }

  /** Perform the side effects the simulation queued since the last flush. */
  private flushEvents() {
    const events = this.sim.events;
    for (const ev of events) {
      switch (ev.type) {
        case "sfx":
          sfx.play(ev.name);
          this.vibrate(ev.name);
          break;
        case "cores":
          useGameStore.getState().addCores(ev.amount);
          break;
        case "status":
          if (ev.status !== "playing") this.closeWheel();
          this.input.releaseAll();
          this.emitHud();
          if (ev.status !== "playing") this.persist();
          break;
        case "waveCleared":
          this.persist();
          break;
        case "levelComplete":
          useGameStore.getState().recordLevel(ev.result);
          this.persist();
          break;
        case "shard":
          useGameStore.getState().recordShard(ev.level, ev.index);
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
