# Alien Shift 👾⌚

An original 3D browser action game. Kai, a kid with a mysterious **Shiftwatch**, transforms into one of four alien
heroes to defend a neon city street from waves of robots — with a boss every 5th wave.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · three.js ·
React Three Fiber + drei · @react-three/postprocessing · Rapier physics (`@dimforge/rapier3d-compat`) · zustand ·
Web Audio API. There are no image, model or audio files yet: the city, the characters and the sounds are all generated
in code, and real `.glb` models can be dropped in later (see below).

> A PWA and an Android APK are coming in later phases. This README grows with each phase.

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

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move (all directions) | `W` `A` `S` `D` or arrow keys | drag anywhere on the **left half** of the screen |
| Jump (Bolt can double‑jump) | `Space` | **▲** |
| Drop through a scaffold | `C` | **DROP** |
| Attack (hold for auto) | `J` or `Z` | **ATK** |
| Special ability | `K` or `X` | **SP** |
| Transform | `1` Blaze · `2` Titan · `3` Bolt · `4` Shard | tap an alien on the watch dial |
| Revert to human | `Q` | **KAI** on the watch dial |
| Pause / Mute | `P` or `Esc` (or the **II** button) / `M` | **II** |
| Show FPS / performance | `F3` | — |

Ranged attacks (fireballs, crystals) **auto-aim** at the nearest robot in front of you; punches snap towards nearby
robots too.

### Graphics quality

Pick **Low / Medium / High** on the start screen or in the pause menu. Weak PCs and phones start on **Low**
automatically; your choice is remembered.

| | Low | Medium | High |
| --- | --- | --- | --- |
| Resolution (device pixel ratio) | 1× | up to 1.5× | up to 2× |
| Shadows | soft "blob" shadows only | real shadows | softer, sharper real shadows |
| Glow (bloom) | off | on | on + vignette |
| Particles | fewer | more | most |
| Far skyline | hidden in fog | shown | shown |

Press **F3** in game to see FPS, frame time and draw calls.

## The aliens

| # | Alien | Attack | Special |
| - | --- | --- | --- |
| 1 | **Blaze** – Pyro Alien | Auto-aimed fireballs | *Inferno Nova* – burning shockwave ring |
| 2 | **Titan** – Stone Colossus | Mega punch (huge knockback, takes 55% less damage) | *Quake Slam* – shockwave along the ground |
| 3 | **Bolt** – Speed Alien | Rapid jabs, double jump | *Lightning Dash* – invulnerable dash through enemies |
| 4 | **Shard** – Crystal Alien | Auto-aimed 3‑way crystal spread | *Prism Shield* – blocks damage and reflects bullets at robots |

**Shiftwatch energy** drains while you're transformed and recharges while you're Kai (human). If it hits zero you're
forced back to human and locked out until it recharges to 35%. Specials also cost energy. The watch needs **1 second**
to cool down between transformations (reverting included). Green crystals refill energy and pink orbs heal. Chain
kills for a combo multiplier (up to ×3).

**The street:** parked cars and crates are solid cover — they block bullets and you can stand on them. The two side
scaffolds and the rooftop are one-way platforms: jump up through them from below, press **drop** to fall through.
The rooftop is reached by jumping from the end of a side scaffold.

**Bosses** fire bullet rings, aimed bursts and drones — and sometimes **dive into the street** (watch for the red
warning circle on the ground). Don't be under it when it lands; while it's down, even Kai's punches can reach it.

Your high score and settings are saved in the browser.

## Replacing the placeholder characters with real 3D models

Every character is drawn through one component, `CharacterModel`. If a file named
`public/models/<id>.glb` exists, it is used automatically. Otherwise the built-in placeholder made from simple
shapes is used. **No code changes are needed.**

| File name | Character |
| --- | --- |
| `public/models/human.glb` | Kai |
| `public/models/blaze.glb` | Blaze |
| `public/models/titan.glb` | Titan |
| `public/models/bolt.glb` | Bolt |
| `public/models/shard.glb` | Shard |

Steps:

1. Download a rigged, animated character in **glTF binary (`.glb`)** format (free sources below).
2. Rename it to one of the names above and copy it into `public/models/`.
3. Restart `npm run dev`. On start, a small script lists the models it found (you'll see
   `[prepare-assets] … models: blaze` in the terminal).

The game scales the model to the character's height and stands it on the ground. The model should **face forward
along +Z**, which is the glTF standard; Quaternius, Kenney and Mixamo exports do. Animations are matched by name, so
you don't need to rename them:

| Game animation | Clip names it looks for (any part of the name, any case) |
| --- | --- |
| idle | `idle`, `stand`, `breath` |
| run | `run`, `sprint`, `jog`, `walk` |
| jump / fall | `jump`, `leap`, `fall`, `air` |
| attack | `attack`, `punch`, `slash`, `shoot` |
| special | `special`, `cast`, `spell`, `power`, `kick` |
| hit | `hit`, `hurt`, `damage`, `receive` |
| death | `death`, `die`, `dead`, `defeat` |

If a model file is broken, the game logs a warning and keeps using the placeholder.

**Free model sources**

- **Quaternius** (<https://quaternius.com>): CC0, free for any use. The "Ultimate Monsters", "Animated Robots" and
  character packs include ready-made animations and `.glb` exports.
- **Kenney** (<https://kenney.nl/assets>): CC0. "Animated Characters" and "Blocky Characters" packs.
- **Mixamo** (<https://www.mixamo.com>): free with an Adobe account; it auto-rigs and animates characters. Its
  licence lets you use the models in your game, but not share the raw model files on their own. Export as FBX, then
  convert to `.glb` (for example with Blender: *File → Import FBX*, then *File → Export → glTF 2.0 (.glb)*).

**Smaller files for phones.** Large models can be shrunk with the free `gltf-transform` tool, no install needed:

```powershell
npx @gltf-transform/cli optimize in.glb out.glb --compress draco --texture-compress webp
```

Draco-compressed meshes, WebP textures and KTX2 textures (`--texture-compress ktx2`; this one also needs the free
KTX-Software tools installed) are all supported. Their decoders are served from this site (`public/draco`,
`public/basis`, copied automatically), so models still load offline.

## How it's built

- **`game/core/`** is the whole game (movement, combat, enemy AI, waves, watch energy) in plain TypeScript, with no
  graphics. Rapier handles collisions: walking into cars and crates, one-way platforms, bullets hitting cover. The
  game advances in fixed steps of 1/60 s.
- **`components/three/`** only *draws* the game each frame and never changes it. Robots, projectiles, pickups and
  particles use GPU instancing, so 20 robots cost the same as one. The static street is merged into a handful of
  meshes.
- The React **HUD and menus** sit on top of the 3D view and read the game state from a zustand store.

## Project structure

```
alien-shift/
├── app/                      # Next.js App Router (layout, page, global Tailwind styles, icon)
├── components/
│   ├── Game.tsx              # Loads settings + physics, mounts the 3D scene and the UI layers
│   ├── Hud.tsx               # Health/energy bars, score, boss bar, wave banner, watch dial, pause button
│   ├── Overlay.tsx           # Start menu, pause (with graphics quality) and game-over screens
│   ├── TouchControls.tsx     # Mobile: left-half joystick + action buttons
│   ├── FxOverlay.tsx         # Transform flash, hurt vignette, floating damage numbers
│   ├── FpsCounter.tsx        # F3 performance readout
│   └── three/                # The 3D view (React Three Fiber)
│       ├── Scene.tsx         # <Canvas> setup per quality preset
│       ├── Arena.tsx         # Procedural neon street, buildings, scaffolds, cars, crates
│       ├── Environment.tsx   # Sky, stars, moon, fog, lights, shadows
│       ├── CameraRig.tsx     # 3/4 follow camera with damping + screen shake
│       ├── PlayerView.tsx    # Player, transform beam, shield bubble
│       ├── characters/       # CharacterModel (glb or placeholder), procedural animations
│       ├── Enemies.tsx       # Instanced robots + health bars
│       ├── Boss.tsx          # Boss ship + dive warning
│       ├── Projectiles.tsx   # Instanced shots and pickups
│       ├── Effects.tsx       # Particles, rings, slashes, blob shadows
│       └── PostFx.tsx        # Bloom / vignette (Medium & High only)
├── game/
│   ├── core/                 # Pure simulation (no DOM / graphics / audio)
│   │   ├── sim.ts            # Combat, enemy AI, waves, Shiftwatch energy, auto-aim
│   │   ├── physics.ts        # Rapier world: character controller, one-way platforms, raycasts
│   │   ├── arena.ts          # Arena size, platforms, cover, gravity
│   │   ├── forms.ts          # Alien stats — tweak these to rebalance
│   │   ├── events.ts         # Sounds/effects the sim asks for
│   │   └── types.ts
│   ├── runtime.ts            # Browser driver: fixed-step loop, input, audio, HUD/store bridge
│   ├── view/                 # Effect pools (particles, floating text) + DOM overlay handles
│   ├── store.ts              # zustand store: HUD snapshot, settings, save data
│   ├── quality.ts            # Low / Medium / High presets
│   ├── platform/             # Storage + asset URL helpers
│   ├── input.ts              # Keyboard/touch input mapping
│   └── audio.ts              # Synthesized sound effects
├── public/models/            # Drop real .glb character models here
└── scripts/prepare-assets.mjs  # Copies model decoders + lists models (runs before dev/build)
```

To add a new alien: add it to `FormId` in `game/core/types.ts`, give it stats in `game/core/forms.ts`, add a `case`
for it in `attack()` / `special()` (`game/core/sim.ts`) and give it a placeholder rig in
`components/three/characters/PlaceholderCharacter.tsx` (or just drop in a `.glb`).

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
