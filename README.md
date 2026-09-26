# Alien Shift 👾⌚

An original browser action game. Kai, a kid with a mysterious **Shiftwatch**, transforms into one of four alien
heroes to defend the city from waves of robots — with a boss every 5th wave.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · zustand · HTML5 Canvas ·
Web Audio API (no image/audio files — everything is drawn and synthesized in code).

> A full 3D version (three.js / React Three Fiber), a PWA and an Android APK are being built in phases.
> This README grows with each phase.

## Run it in VS Code (Windows)

Open the VS Code terminal (**Terminal → New Terminal**) and run:

```powershell
npm install        # first time only — downloads the libraries
npm run dev        # starts the game; open http://localhost:3000 in your browser
```

Stop the dev server with **Ctrl + C**.

Other commands (run them only while `npm run dev` is **stopped** — the PC has limited RAM):

```powershell
npm run typecheck  # checks the TypeScript code for errors
npm run build      # makes a production build (the same thing the cloud build will do)
```

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
| Pause / Mute | `P` or `Esc` (or the **II** button) / `M` |

On phones and tablets, on‑screen touch buttons appear automatically over the game.
Graphics quality (Low / Medium / High) can be changed on the start screen or the pause menu. Weak PCs and phones
start on **Low** automatically; your choice is remembered.

## The aliens

| # | Alien | Attack | Special |
| - | --- | --- | --- |
| 1 | **Blaze** – Pyro Alien | Fireballs | *Inferno Nova* – burning shockwave ring |
| 2 | **Titan** – Stone Colossus | Mega punch (huge knockback, takes 55% less damage) | *Quake Slam* – ground waves in both directions |
| 3 | **Bolt** – Speed Alien | Rapid jabs, double jump | *Lightning Dash* – invulnerable dash through enemies |
| 4 | **Shard** – Crystal Alien | 3‑way crystal spread | *Prism Shield* – blocks damage and reflects bullets |

**Shiftwatch energy** drains while you're transformed and recharges while you're Kai (human). If it hits zero you're
forced back to human and locked out until it recharges to 35%. Specials also cost energy. The watch needs **1 second**
to cool down between transformations (reverting included). Green orbs refill energy and pink orbs heal. Chain kills
for a combo multiplier (up to ×3).

**Bosses** fire spreads, aimed bursts and drones — and sometimes **dive into the street** (watch for the red
warning on the ground). Don't be under it when it lands; while it's down, even Kai's punches can reach it.

Your high score and settings are saved in the browser.

## Project structure

```
alien-shift/
├── app/                  # Next.js App Router (layout, page, global Tailwind styles, icon)
├── components/
│   ├── Game.tsx          # Mounts the canvas + engine
│   ├── Hud.tsx           # Health/energy bars, score, boss bar, watch dial, pause button
│   ├── Overlay.tsx       # Start menu, pause (with graphics quality) and game-over screens
│   └── TouchControls.tsx # Mobile on-screen buttons
└── game/
    ├── core/             # Pure simulation — no DOM, audio or storage (reused by the 3D version)
    │   ├── sim.ts        # Physics, combat, enemy AI, waves, Shiftwatch energy
    │   ├── events.ts     # Side effects the sim asks for (sounds, status changes…)
    │   ├── forms.ts      # Alien stats — tweak these to rebalance
    │   ├── world.ts      # Arena size, platforms, helpers
    │   └── types.ts
    ├── engine.ts         # Browser driver: fixed-timestep loop, canvas, input, audio, HUD/store bridge
    ├── render.ts         # Canvas drawing (retired when the 3D renderer lands)
    ├── store.ts          # zustand store: HUD snapshot, settings (quality, mute), save data
    ├── platform/storage.ts  # Save/load (localStorage now, Capacitor Preferences on Android later)
    ├── input.ts          # Keyboard/touch input mapping
    └── audio.ts          # Synthesized sound effects
```

To add a new alien: add it to `FormId` in `game/core/types.ts`, give it stats in `game/core/forms.ts`, then add a
`case` for it in `attack()` / `special()` (`game/core/sim.ts`) and in `drawPlayer()` (`game/render.ts`).

## Put the project on GitHub

You only need a free GitHub account and the VS Code terminal. The project is already a git repository with
commits on the `main` branch.

1. Go to <https://github.com/new> in your browser (log in if asked).
2. **Repository name:** `alien-shift`. Choose **Public** (needed later for free GitHub Pages hosting).
3. **Do not** tick "Add a README", ".gitignore" or "license" — the repository must start empty.
4. Click **Create repository**.
5. In the VS Code terminal, run these (replace `YOUR-USERNAME` with your GitHub username):

   ```powershell
   git remote add origin https://github.com/YOUR-USERNAME/alien-shift.git
   git push -u origin main
   ```

   The first push opens a browser window asking you to sign in to GitHub — approve it.
6. Refresh the GitHub page: your code is there. From now on, after each commit just run `git push`.
