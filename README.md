# Alien Shift 👾⌚

An original browser action game inspired by the classic "kid with an alien-transforming watch" cartoons.
Slam the **Shiftwatch**, turn into one of four aliens, and defend the city from waves of robots — with a boss every 5th wave.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · HTML5 Canvas · Web Audio API
(no game engine and no image/audio files — everything is drawn and synthesized in code).

## Run it in VS Code

```bash
cd alien-shift
npm install
npm run dev        # open http://localhost:3000
```

Production build: `npm run build && npm start` · Typecheck: `npm run typecheck`

## Controls

| Action | Keys |
| --- | --- |
| Move | `A` / `D` or `←` / `→` |
| Jump (Bolt can double‑jump) | `W`, `↑` or `Space` |
| Drop through platform | `S` / `↓` |
| Attack (hold for auto) | `J` or `Z` |
| Special ability | `K` or `X` |
| Transform | `1` Blaze · `2` Titan · `3` Bolt · `4` Shard (or click the watch dial) |
| Revert to human | `Q` |
| Pause / Mute | `P` or `Esc` / `M` |

On phones and tablets, on‑screen touch buttons appear automatically.

## The aliens

| # | Alien | Attack | Special |
| - | --- | --- | --- |
| 1 | **Blaze** – Pyro Alien | Fireballs | *Inferno Nova* – burning shockwave ring |
| 2 | **Titan** – Stone Colossus | Mega punch (huge knockback, takes 55% less damage) | *Quake Slam* – ground waves in both directions |
| 3 | **Bolt** – Speed Alien | Rapid jabs, double jump | *Lightning Dash* – invulnerable dash through enemies |
| 4 | **Shard** – Crystal Alien | 3‑way crystal spread | *Prism Shield* – blocks damage and reflects bullets |

**Shiftwatch energy** drains while you're transformed and recharges while you're Kai (human). If it hits zero you're
forced back to human and locked out until it recharges to 35%. Specials also cost energy. Green orbs refill energy and
pink orbs heal. Chain kills for a combo multiplier (up to ×3). Your high score is saved in `localStorage`.

## Project structure

```
alien-shift/
├── app/                  # Next.js App Router (layout, page, global Tailwind styles)
├── components/
│   ├── Game.tsx          # Mounts the canvas and engine, wires the React HUD to engine state
│   ├── Hud.tsx           # Health/energy bars, score, boss bar, watch dial
│   ├── Overlay.tsx       # Start menu, pause and game-over screens
│   └── TouchControls.tsx # Mobile on-screen buttons
└── game/                 # Framework-free game core (plain TypeScript)
    ├── engine.ts         # Fixed-timestep loop, physics, combat, enemy AI, waves
    ├── render.ts         # Canvas drawing for every character, enemy and effect
    ├── forms.ts          # Alien stats — tweak these to rebalance
    ├── input.ts          # Keyboard/touch input mapping
    ├── audio.ts          # Synthesized sound effects
    ├── world.ts          # Arena size, platforms, helpers
    └── types.ts
```

To add a new alien: add it to `FormId` in `types.ts`, give it stats in `forms.ts`, then add a `case` for it in
`attack()` / `special()` (`engine.ts`) and in `drawPlayer()` (`render.ts`).
