import { ARENA, STEP, clamp, rand } from "./arena";
import { BOSSES } from "./bosses";
import { ENEMY_DEFS } from "./enemies";
import { levelById, type LevelDef, type SpawnMode, type WaveDef } from "./levels";
import type { GameSim } from "./sim";
import type { Enemy, EnemyKind } from "./types";

/**
 * Campaign flow: a level is a list of stages; each stage is a checkpoint. Dying lets the player
 * retry from the start of the current stage (shards already found stay found).
 */
export interface CampaignRun {
  level: LevelDef;
  stage: number;
  /** Wave index inside a "waves" stage. */
  wave: number;
  /** fight = stage running, break = checkpoint pause before the next stage, done = level complete. */
  state: "fight" | "break" | "done";
  /** Survive countdown, or break countdown. */
  timer: number;
  /** Robots waiting to appear, and the time to the next one. */
  queue: { kind: EnemyKind; mode: SpawnMode }[];
  queueCd: number;
  /** Survive stages: time to the next spawn. */
  spawnTimer: number;
  bossId: number;
  /** Per hazard: time to the next trigger and a rotating counter. */
  hazardT: number[];
  hazardStep: number[];
  /** Shards found (by index into level.shards). */
  shards: boolean[];
  /** Briefing lines still to show. */
  briefing: string[];
  briefT: number;
}

const BREAK_TIME = 2.6;
/** Hostile robots that count towards clearing a stage (fixed turrets don't hold it up). */
const counts = (e: Enemy) => !e.dead && e.allyTimer <= 0 && e.kind !== "turret";

export function startCampaign(sim: GameSim, levelId: number): CampaignRun {
  const level = levelById(levelId);
  const run: CampaignRun = {
    level,
    stage: 0,
    wave: 0,
    state: "fight",
    timer: 0,
    queue: [],
    queueCd: 0,
    spawnTimer: 0,
    bossId: -1,
    hazardT: level.hazards.map((h) => ("period" in h ? h.period * 0.6 : 0)),
    hazardStep: level.hazards.map(() => 0),
    shards: level.shards.map(() => false),
    briefing: [...level.briefing],
    briefT: 0,
  };
  sim.run = run;
  sim.showBanner(`LEVEL ${level.id} — ${level.name.toUpperCase()}`, 2.6);
  run.briefT = 2.6;
  placeLevelObjects(sim, run);
  beginStage(sim, run, 3.2);
  return run;
}

/** Shards still to find, and the fixed turrets. Called at the start and on every checkpoint retry. */
export function placeLevelObjects(sim: GameSim, run: CampaignRun) {
  run.level.shards.forEach(([x, y, z], i) => {
    if (run.shards[i]) return;
    sim.pickups.push({ id: sim.newId(), kind: "shard", x, y, z, vx: 0, vy: 0, vz: 0, onGround: true, life: Infinity, value: i });
  });
  for (const h of run.level.hazards) {
    if (h.kind !== "turrets") continue;
    for (const [x, y, z] of h.spots) sim.enemies.push(sim.makeEnemy("turret", x, y, z));
  }
}

/** Start (or restart, after a retry) the current stage. `delay` holds the first spawn back. */
export function beginStage(sim: GameSim, run: CampaignRun, delay = 1.5) {
  const st = run.level.stages[run.stage];
  run.state = "fight";
  run.wave = 0;
  run.queue = [];
  run.queueCd = delay;
  run.bossId = -1;
  sim.nestPool = [];
  switch (st.kind) {
    case "waves":
      queueWave(sim, run, st.waves[0]);
      break;
    case "survive":
      run.timer = st.seconds;
      run.spawnTimer = delay;
      break;
    case "destroy":
      sim.nestPool = st.spawns;
      for (const [x, y, z] of st.nests) sim.enemies.push(sim.makeEnemy("nest", x, y, z));
      if (st.escorts) queueWave(sim, run, st.escorts);
      break;
    case "boss": {
      const info = BOSSES[st.boss];
      const boss = sim.makeEnemy(st.boss, info.spawn[0], info.spawn[1], info.spawn[2], 1 + (run.level.id >= 10 ? 0 : (run.level.id - 5) * 0.08));
      if (sim.difficulty.bossStartsAngry) boss.bossPhase = 1;
      sim.enemies.push(boss);
      run.bossId = boss.id;
      if (st.adds) queueWave(sim, run, st.adds);
      sim.showBanner(info.name.toUpperCase(), 2.6);
      sim.sfx("phase");
      break;
    }
  }
  if (run.stage > 0 || delay < 3) sim.showBanner(st.title.toUpperCase(), 2.2);
}

function queueWave(sim: GameSim, run: CampaignRun, w: WaveDef) {
  for (const [kind, n] of w.enemies) {
    // Difficulty adds (or removes) robots — but never more than one extra elite.
    const count = kind === "elite" ? n : Math.max(1, Math.round(n * sim.difficulty.spawn));
    for (let i = 0; i < count; i++) run.queue.push({ kind, mode: w.spawn ?? "edges" });
  }
  // Shuffle so mixed waves arrive mixed.
  for (let i = run.queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [run.queue[i], run.queue[j]] = [run.queue[j], run.queue[i]];
  }
}

export function updateCampaign(sim: GameSim) {
  const run = sim.run;
  if (!run) return;
  sim.banner = Math.max(0, sim.banner - STEP);
  if (run.briefing.length && (run.briefT -= STEP) <= 0) {
    sim.showBanner(run.briefing.shift()!, 2.8);
    run.briefT = 2.8;
  }
  if (run.state === "done") return;
  if (run.state === "break") {
    run.timer -= STEP;
    if (run.timer <= 0) {
      run.stage++;
      beginStage(sim, run);
    }
    return;
  }

  // Spawn queued robots one by one.
  if (run.queue.length) {
    run.queueCd -= STEP;
    if (run.queueCd <= 0 && sim.enemies.length < 14) {
      const next = run.queue.shift()!;
      sim.spawnKind(next.kind, next.mode);
      run.queueCd = next.mode === "ambush" ? 0.35 : rand(0.5, 0.9) / sim.difficulty.spawn;
    }
  }

  const st = run.level.stages[run.stage];
  const hostile = sim.enemies.filter(counts).length;
  let cleared = false;
  switch (st.kind) {
    case "waves":
      if (!run.queue.length && hostile === 0) {
        if (run.wave + 1 < st.waves.length) {
          run.wave++;
          queueWave(sim, run, st.waves[run.wave]);
          run.queueCd = 1.6;
          sim.showBanner(`WAVE ${run.wave + 1} / ${st.waves.length}`, 1.6);
          sim.sfx("wave");
        } else cleared = true;
      }
      break;
    case "survive": {
      run.timer -= STEP;
      run.spawnTimer -= STEP;
      if (run.spawnTimer <= 0 && hostile < st.max) {
        run.spawnTimer = st.every / sim.difficulty.spawn;
        sim.spawnKind(st.pool[Math.floor(Math.random() * st.pool.length)], Math.random() < 0.25 ? "sky" : "edges");
      }
      if (run.timer <= 0) {
        // The rift closes: every robot still standing is destroyed.
        for (const e of sim.enemies) {
          if (!counts(e)) continue;
          sim.fx.burst(e.x, e.y + e.height / 2, e.z, 20, "#fde047", 6);
          sim.removeEnemy(e);
        }
        sim.flashScreen("#fef9c3", 0.6);
        cleared = true;
      }
      break;
    }
    case "destroy":
      if (!run.queue.length && hostile === 0) cleared = true;
      break;
    case "boss":
      if (!sim.enemies.some((e) => e.id === run.bossId && !e.dead)) {
        for (const e of sim.enemies) if (counts(e)) sim.removeEnemy(e);
        run.queue = [];
        cleared = true;
      }
      break;
  }
  if (!cleared) return;

  if (run.stage + 1 >= run.level.stages.length) {
    run.state = "done";
    sim.completeLevel();
    return;
  }
  run.state = "break";
  run.timer = BREAK_TIME;
  const p = sim.player;
  sim.healPlayer(p.maxHp * 0.25);
  sim.showBanner("CHECKPOINT REACHED", BREAK_TIME);
  sim.sfx("checkpoint");
}

/** Hazards only run while a stage is being fought. */
export function updateHazards(sim: GameSim) {
  const run = sim.run;
  if (!run || run.state !== "fight" || sim.timeFreeze > 0) return;
  const p = sim.player;
  run.level.hazards.forEach((h, i) => {
    if (h.kind === "turrets") return;
    run.hazardT[i] -= STEP;
    if (run.hazardT[i] > 0) return;
    run.hazardT[i] = h.period;
    const step = run.hazardStep[i]++;
    if (h.kind === "vents") {
      // Two vents erupt at once, in turn.
      for (let k = 0; k < 2; k++) {
        const [x, z] = h.spots[(step * 2 + k) % h.spots.length];
        const delay = sim.tele(1.2);
        sim.zone({ kind: "blast", owner: "enemy", x, y: 0, z, r: 2.2, delay, life: delay + 0.4, dmg: h.dmg, color: "#f97316" });
      }
    } else if (h.kind === "lasers") {
      h.pylons.forEach(([x, z], k) => {
        const toCentre = Math.atan2(-z, -x);
        const dir = (step + k) % 2 ? 1 : -1;
        const delay = sim.tele(1.2);
        sim.zone({ kind: "laser", owner: "enemy", x, y: 0, z, r: h.length, angle: toCentre - dir * 0.9, spin: dir * 0.6, delay, life: delay + 3, dmg: h.dmg, color: "#ef4444" });
      });
      sim.sfx("laser");
    } else if (h.kind === "meteors") {
      for (let k = 0; k < h.count; k++) {
        const delay = sim.tele(1.4) + k * 0.2;
        const x = clamp(p.x + rand(-6, 6), ARENA.minX + 1, ARENA.maxX - 1);
        const z = clamp(p.z + rand(-4, 4), ARENA.minZ + 1, ARENA.maxZ - 1);
        sim.zone({ kind: "blast", style: "meteor", owner: "enemy", x, y: 0, z, r: 2.2, delay, life: delay + 0.3, dmg: h.dmg, color: "#f97316" });
      }
    }
  });
}

/** The objective line for the HUD. */
export function objectiveText(sim: GameSim): string {
  const run = sim.run;
  if (!run) return "";
  if (run.state === "done") return "Level complete!";
  if (run.state === "break") return "Checkpoint — get ready";
  const st = run.level.stages[run.stage];
  const hostile = sim.enemies.filter(counts).length + run.queue.length;
  switch (st.kind) {
    case "waves":
      return `${st.title} · wave ${run.wave + 1}/${st.waves.length} · ${hostile} left`;
    case "survive":
      return `${st.title} · ${Math.max(0, Math.ceil(run.timer))}s`;
    case "destroy": {
      const nests = sim.enemies.filter((e) => e.kind === "nest" && !e.dead).length;
      return nests > 0 ? `${st.title} · ${nests} nest${nests > 1 ? "s" : ""} left` : `Finish off the robots · ${hostile} left`;
    }
    case "boss":
      return st.title;
  }
}

/** A nest pumps out one robot from the stage's pool (capped so it can't flood the arena). */
export function nestSpawn(sim: GameSim, nest: Enemy) {
  if (!sim.nestPool.length || sim.enemies.length >= 13) return;
  const kind = sim.nestPool[Math.floor(Math.random() * sim.nestPool.length)];
  const flying = ENEMY_DEFS[kind].flying;
  const a = Math.random() * Math.PI * 2;
  const x = clamp(nest.x + Math.cos(a) * (nest.radius + 0.8), ARENA.minX + 1, ARENA.maxX - 1);
  const z = clamp(nest.z + Math.sin(a) * (nest.radius + 0.8), ARENA.minZ + 1, ARENA.maxZ - 1);
  sim.enemies.push(sim.makeEnemy(kind, x, flying ? nest.y + 2.5 : nest.y + 0.2, z));
  nest.hitFlash = 0.15;
  sim.fx.burst(x, nest.y + 0.8, z, 14, "#a855f7", 4);
}
