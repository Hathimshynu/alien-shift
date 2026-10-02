# Alien Shift 👾⌚

An original 3D browser action game. **Agent Kai** has a gun, six superhuman powers and a mysterious **Shiftwatch**
that turns him into ten alien heroes. Fight through a **10-level campaign** (each level its own world, objectives and
checkpoints, four bosses) or survive the original **Endless** waves on the neon city street.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS v4 · three.js ·
React Three Fiber + drei · @react-three/postprocessing · Rapier physics (`@dimforge/rapier3d-compat`) · zustand ·
Web Audio API. Kai is a realistic rigged 3D character (CC0 assets bundled in `public/models/hero`, see Credits). The
worlds, aliens, robots and sounds are generated in code, and real `.glb` models can be dropped in later (see below).

> It installs on phones as an app (see "Play on your phone"). An Android APK is coming in a later phase.

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
npm run build      # makes the finished game in the out/ folder (the same thing the cloud build does)
npm start          # plays the finished game from out/ (run "npm run build" first)
```

## Play on your phone

### Option A (recommended): GitHub Pages — installable, fullscreen, works offline

Phones only offer **Install app** for websites on **https://**, so the game is published for free on GitHub Pages
automatically every time you `git push`.

**One-time setup:**

1. Push the code to GitHub (see "Put the project on GitHub" below).
2. On GitHub, open your `alien-shift` repository → **Settings** → **Pages** (left menu).
3. Under **Build and deployment → Source**, choose **GitHub Actions**.
4. Open the **Actions** tab. The **Deploy to GitHub Pages** run starts on your next `git push` (or click it and choose
   **Run workflow**). Wait for the green tick, about 2–3 minutes.
5. Your game is now at **`https://YOUR-USERNAME.github.io/alien-shift/`**. Open that link on your phone.

**Install it on the phone:**

- **Android (Chrome / Edge / Samsung Internet):** tap **📲 INSTALL APP** on the start screen, or use the browser menu →
  *Install app* / *Add to Home screen*. The game gets its own icon and opens fullscreen in landscape.
- **iPhone / iPad (Safari):** tap **Share** (the square with an arrow) → **Add to Home Screen**. The 📲 button on the
  start screen shows these steps too.

After the first full load the installed game also works **without internet**. Share the link with friends and they
can install it the same way.

### Option B: test from your PC over Wi-Fi (quick, not installable)

Your phone and PC must be on the **same Wi-Fi**.

1. In the VS Code terminal run `npm run dev`. It prints a **Network** address such as `http://192.168.1.23:3000`.
   For a faster game on the phone, use `npm run build` and then `npm start` instead, which prints the same kind of
   address.
2. The first time, Windows may ask whether to allow Node.js on the network. Tick **Private networks** and click
   **Allow**.
3. Type that address into your phone's browser.

A `http://192.168…` address is fine for playing and testing, but phones won't offer to install it. Use Option A for
that.

**On phones:** the game fills the screen. Hold the phone sideways (you'll see a "rotate your phone" message in
portrait). Tapping **START** goes fullscreen and locks landscape on Android, and there's a **⛶** button if you leave
fullscreen. The left half of the screen is the joystick; the buttons are on the right; the watch dial is at the top.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move (all directions) | `W` `A` `S` `D` or arrow keys | drag anywhere on the **left half** of the screen |
| Jump · press again in the air = **double jump + 360° spin** | `Space` | **JUMP** |
| **Shoot** (Kai) — hold for automatic fire; works running, jumping and falling | hold `J` or **left mouse** (the mouse aims) | hold **SHOOT** |
| Punch (Kai) — 3‑hit combo | `F` | **PUNCH** |
| **Powers** (the three equipped ones, every form) | `E` `R` `T` | the three **round power buttons** |
| Reload / switch gun (Kai) | `G` / `V` | **⟳** / tap the gun panel |
| Alien light attack (combo) / heavy | `J` / hold `J` | **ATK** / hold **ATK** |
| Alien special ability | `K` or `X` | **SP** |
| Alien **Ultimate** (when the purple meter is full) | `L` | **ULT** |
| Dodge roll (short invulnerability) | `Shift` | **ROLL** |
| Transform directly | `1`–`9`, `0` (see the alien list) | the 4 favourites on the watch dial |
| Watch wheel (all aliens, time slows) | hold `Tab`, point with the mouse or move keys, release to transform | **⌚** on the dial, then tap an alien |
| Revert to Kai | `Q` | **KAI** |
| Drop through a scaffold | `C` | **DROP** |
| Pause / Mute | `P` or `Esc` (or the **II** button) / `M` | **II** |
| Show FPS / draw calls / triangles | `F3` | — |

Shots **auto-aim** at the nearest robot in front of you (or anywhere around you if none is in front, and always
360° while you're in the air). With a mouse, Kai shoots where you point. Punches snap towards nearby robots too.

## Agent Kai: health, guns and powers

- **Health: 200 HP** (+25 per Health upgrade), shown as `HP x / 200`. After a hit you're invulnerable for 0.9 s, and
  health **regenerates** after 5 s without damage (faster on Easy, none on Nightmare). Pink **health orbs** heal 35.
- **Damage you take:** normal robots 10–15, elites 20–30, bosses 35–50 (then scaled by difficulty). All values live in
  `game/core/rules.ts`, `game/core/enemies.ts` and `game/core/bosses/*.ts`.
- **Guns** (`game/core/weapons.ts`): Pulse Pistol (start), Assault Rifle, Scatter Shotgun, Plasma Rifle, Energy
  Cannon — each with its own damage, fire rate, magazine, reload time and look. Buy them in the Shift Lab.
- **Powers** (`game/core/powers.ts`, one entry per power: name, description, cooldown, damage, range, `activate`):

| Power | What it does | Cooldown | Unlock |
| --- | --- | --- | --- |
| 👊 **Power Punch** | A superhuman punch: a shockwave rolls 22 m forward and **destroys every normal robot** in its path (elites and bosses take 150 damage). Screen shake, slow motion. | 8 s | start |
| ⚡ **Energy Blast** | A ball of energy that explodes on impact. | 6 s | start |
| 💨 **Super Dash** | A blinding dash that slams through robots. | 3.5 s | start |
| ⏱️ **Time Freeze** | Robots, their bullets and their attacks stop for 4 s. | 18 s | ◆ 70, clear level 2 |
| 🌋 **Ground Smash** | Leap and slam: shockwave + a ring of rock spikes. | 9 s | ◆ 90, clear level 4 |
| 🚀 **Air Strike** | Launch up and rain 8 energy bolts on nearby robots. | 14 s | ◆ 120, clear level 6 |

Robots destroyed while Kai is in the air are **aerial kills** (+50% score). Hits show a marker over the robot (red on a
kill) and damage numbers.

## Campaign and difficulty

Ten levels, unlocked one after another (**LEVELS** on the start screen). Each has its own arena, theme, hazards, robot
mix, objectives, **checkpoints** (each stage — if you fall, **RETRY CHECKPOINT**), three hidden **data shards** and a
results screen with **NEXT LEVEL**:

| # | Level | Highlights |
| - | --- | --- |
| 1 | Crash Site | Tutorial, wrecked ship |
| 2 | Alien Ruins | Erupting vents, survive 45 s |
| 3 | Abandoned Colony | Brutes, Wardens, the Colony Warlord (elite) |
| 4 | Underground Facility | Dark, ambushes, sweeping security lasers (jump them!) |
| 5 | Alien Hive | Destroy 4 robot nests, then **Arachnid Mk-IX** |
| 6 | Frozen Planet | Slippery ice, vents, survive the storm |
| 7 | Desert Battlefield | Snipers at long range, then **Overlord Vexx** |
| 8 | Space Station | Low gravity, nests high on the decks |
| 9 | Alien Fortress | Gun turrets, elites, then **Kraye the Hunter** |
| 10 | Final Dimension | Meteor showers, every robot type, then **The Void Sovereign** |

**Difficulty** (start screen / level select): **Easy**, **Normal**, **Hard**, **Nightmare**. It changes robot health,
damage and speed, how many robots come, how often elites appear, how long the warnings before big attacks last, how
fast bosses attack, regeneration, health drops and rewards. Hard and Nightmare robots fire extra shots; on Nightmare
bosses start angry and there's no regeneration.

### Fighting

- **Combos:** three light hits in a row end with a **finisher**. At upgrade level 3 the finisher becomes that alien's
  special **combo move**.
- **Heavy attacks** hit harder and **break robot shields**. A heavy attack in mid-air becomes a **dive slam**.
- **Dodge roll** (`Shift`) makes you invulnerable for 0.3 s, then has a short cooldown.
- **Ultimate:** dealing damage fills the purple meter. When it's full, press `L` (as an alien) for a slow-motion
  cinematic and a huge attack. An ultimate's own damage doesn't refill the meter.
- **Transforming** plays a short slow-motion sequence with a green energy shell. You can turn it off with *Skip
  transformation sequence* on the start screen or in the pause menu.

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

## The aliens

The first four are unlocked from the start. The others are unlocked in the **Shift Lab** with Shift Cores.

| Key | Alien | Light / Heavy | Special | Ultimate | Unlock |
| - | --- | --- | --- | --- | --- |
| 1 | **Blaze** – Pyro | Fireballs / Magma Bomb (explodes) | Inferno Nova ring | **Supernova**: huge blast that sets everything burning | start |
| 2 | **Titan** – Stone Colossus | Mega Punch / Hammer Smash | Quake Slam ground wave | **Earthquake**: rings of rock spikes burst from the street | start |
| 3 | **Bolt** – Speed | Rapid jabs / Shock Palm (stuns) · double jump | Lightning Dash | **Storm Rush**: blinks from robot to robot striking each | start |
| 4 | **Shard** – Crystal | Crystal spread / Crystal Lance (pierces) | Prism Shield (reflects bullets) | **Crystal Prison**: encases every robot, then shatters them | start |
| 5 | **Gravix** – Gravity | Gravity Pulse (pulls robots together) / Gravity Slam | Levitate: robots float helpless, then crash | **Black Hole**: a vortex that swallows robots for 5 s | ◆ 60 |
| 6 | **Frostbyte** – Ice | Freeze Shot (slows; freezes slowed robots) / Frost Cone | Ice Wall (blocks bullets and robots) | **Blizzard**: freezes the whole street | ◆ 70 |
| 7 | **Thornback** – Plant | Long Vine Whip / Vine Grab (pulls a robot in) | Root Snare (holds robots in place) | **Healing Bloom**: heals half your HP and grows a thorn field | ◆ 80 |
| 8 | **Phantom** – Ghost | Phase Claws (pass through shields) / Spectral Lunge · double jump | Vanish: invisible + intangible 3 s, hits crit ×2 | **Possession**: the toughest robot fights for you for 12 s | ◆ 100 |
| 9 | **Behemoth** – Giant | Stomp / Hammer Fist | Rampage charge | **Meteor Stomp**: leaps sky-high while meteors rain down | ◆ 150 |
| 0 | **Nanotek** – Tech | Instant laser / Overcharge Beam (pierces) | Turret Drone (up to 2) | **Orbital Strike**: lasers from orbit on up to 6 targets | ◆ 120 |

**Shiftwatch energy** drains while you're transformed and recharges while you're Kai (human). If it hits zero you're
forced back to human and locked out until it recharges to 35%. Specials also cost energy. The watch needs **1 second**
to cool down between transformations (reverting included).

## Shift Cores, upgrades and the Shift Lab

Robots drop golden **Shift Cores**: small robots sometimes, big ones more, bosses always. They fly to you when you're
close and are **saved as soon as you pick them up**, even if you lose the run. Spend them in the **Shift Lab**
(start screen or game over):

- **Unlock** Gravix, Frostbyte, Thornback, Phantom, Behemoth and Nanotek.
- **Upgrade** each alien up to level 5 (costs ◆ 25 / 50 / 80 / 120). Every level gives +12% damage, 8% slower watch
  drain and 8% shorter special cooldown. **Level 3 unlocks the alien's combo move** (an upgraded finisher).
- **Dial slots 1–4** choose which four aliens appear on the HUD watch dial.
- The Shift Lab shows a rotating 3D preview of each alien.

## Robots and bosses

| Robot | From wave | How to beat it |
| --- | --- | --- |
| Crawler | 1 | Anything. Hops up onto platforms after you. |
| Drone | 2 | Shoots from the air: use ranged attacks or jump. |
| Brute | 3 | Tough; leaps at you when close. |
| **Bomber** (kamikaze) | 4 | Rushes you, flashes, and explodes. Kill it early, or dodge away when it flashes. If you destroy one, it blows up its neighbours. |
| **Warden** (shielded) | 6 | Its energy shield blocks hits from the front. Hit it from **behind**, break the shield with **heavy attacks**, or use Phantom's claws. |
| **Sniper drone** | 7 | Keeps its distance and paints you with a red **laser sight**, then fires one hard shot. Keep moving or dodge-roll when the laser flickers. |
| **Skitter** (fast) | 3 | Small and quick, zig-zags and pounces. |
| **Gunner** (shooter) | 2 | Keeps 7–11 m away, strafes and fires bursts. |
| **Warlord** (elite) | 9 / campaign | Telegraphed charge, fan volley and a leaping slam (its landing spot is marked). |
| **Turret** | campaign | Fixed gun with a laser sight. |
| **Nest** | campaign | A robot factory: keeps spawning until destroyed. |
| **Elite variants** | any | Gold armour: more health and elite-tier damage (more common on harder difficulties). |

Enemy types are one entry each in `game/core/enemies.ts` (stats, class and behaviour), so adding one is one entry plus
its look in `components/three/Enemies.tsx`.

Every boss has three health **phases** (see the dividers on its health bar). It roars and changes tactics at each one,
and every big attack is **telegraphed** with red warning circles or lines on the street.

- **Wave 5 — Overlord Vexx** (mothership): bullet rings, aimed bursts, drones, **ground-sweeping lasers** and a **dive**
  into the street. While it's down, even Kai can punch it. Titan's jump punches can reach it in the air.
- **Wave 10 — Arachnid Mk-IX** (spider mech): leap slams, slowing webs, hatchling crawlers, leg sweeps, a missile
  barrage and an eye laser.
- **Wave 15 — Kraye the Hunter** (a rival who also transforms): gunner form with an aiming laser, grenades and dodge
  rolls. Then a **brute form** with charges and ground slams, and a **blade form** with triple dashes and plasma fans.
- **The Void Sovereign** (campaign level 10): shard volleys, rune circles, void beams, teleport shockwaves, meteor
  rain, summoned skitters and the **Void Collapse** — everything outside one glowing safe circle is crushed.
- Below 15% health every boss becomes **enraged** (red aura, faster attacks). Defeated bosses explode in a death
  sequence before the rewards drop.
- **Endless mode:** after wave 15 the waves keep coming, and the bosses return every 5 waves, tougher each cycle.

## Replacing the placeholder characters with real 3D models

Every character is drawn through one component, `CharacterModel`. If a file named `public/models/<id>.glb` exists,
it is used automatically. Otherwise the built-in placeholder made from simple shapes is used. **No code changes are
needed.**

| File name | Character |
| --- | --- |
| `human.glb` | Kai |
| `blaze.glb`, `titan.glb`, `bolt.glb`, `shard.glb` | the first four aliens |
| `gravix.glb`, `frostbyte.glb`, `thornback.glb`, `phantom.glb`, `behemoth.glb`, `nanotek.glb` | the six newer aliens |
| `hunter.glb`, `hunterBrute.glb`, `hunterBlade.glb` | the wave-15 boss's three forms |

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
| special / ultimate | `special`, `cast`, `spell`, `power`, `kick` |
| hit | `hit`, `hurt`, `damage`, `receive` |
| dodge | `roll`, `dodge`, `evade`, `dash` |
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

- **`game/core/`** is the whole game in plain TypeScript, with no graphics. `sim.ts` runs the rules (movement,
  combos, energy, waves, status effects) and offers a small "combat API" (`melee`, `fire`, `area`, `beam`, `ring`,
  `zone`, `dash`, `hurtEnemy`…). Each alien's moves live in `aliens/<id>.ts`, robot AI in `enemies.ts`, bosses in
  `bosses/`, lasting area effects and telegraphs in `zones.ts`. Rapier handles collisions: walking into cars and
  crates, one-way platforms, ice walls, and bullets hitting cover. The game advances in fixed steps of 1/60 s. Slow
  motion (cinematics, the watch wheel) just feeds it less time.
- **`components/three/`** only *draws* the game each frame and never changes it. Robots, projectiles, pickups,
  particles, telegraphs and status effects use GPU instancing (hidden when empty), so a crowd costs about the same as
  one robot. Press `F3` to see the draw calls and triangles.
- The React **HUD, menus, watch wheel and Shift Lab** sit on top of the 3D view and read the game state and the save
  data from a zustand store.

## Project structure

```
alien-shift/
├── app/                      # Next.js App Router (layout, page, global Tailwind styles, icon)
├── components/
│   ├── Game.tsx              # Loads settings + physics, mounts the 3D scene and the UI layers
│   ├── Hud.tsx               # Bars, ultimate meter, score, boss bar, banners, watch dial, pause
│   ├── Overlay.tsx           # Start menu, pause and game-over screens (+ settings)
│   ├── WatchWheel.tsx        # Radial alien picker (Tab / ⌚)
│   ├── UpgradeScreen.tsx     # The Shift Lab: unlock / upgrade / dial favourites
│   ├── ModelPreview.tsx      # Small rotating 3D preview used by the Shift Lab
│   ├── TouchControls.tsx     # Mobile: left-half joystick + action buttons
│   ├── FxOverlay.tsx         # Transform / ultimate flash, hurt vignette, floating damage numbers
│   ├── FpsCounter.tsx        # F3 performance readout
│   └── three/                # The 3D view (React Three Fiber)
│       ├── Scene.tsx         # <Canvas> setup per quality preset
│       ├── Arena.tsx         # Procedural neon street, buildings, scaffolds, cars, crates
│       ├── Environment.tsx   # Sky, stars, moon, fog, lights, shadows
│       ├── CameraRig.tsx     # Follow camera, cinematic zooms, screen shake
│       ├── PlayerView.tsx    # Player, transform shell/beam, ultimate aura, shield bubble
│       ├── characters/       # CharacterModel (glb or placeholder), rigs.tsx (every look), animations
│       ├── Enemies.tsx       # Instanced robots, health bars, status effects, laser sights
│       ├── VexxBoss.tsx · SpiderBoss.tsx · HunterBoss.tsx
│       ├── Zones.tsx         # Telegraphs, lasers, meteors, rock spikes, black hole, walls, turrets…
│       ├── Projectiles.tsx   # Instanced shots and pickups (incl. Shift Cores)
│       ├── Effects.tsx       # Particles, rings, slashes, blob shadows
│       └── PostFx.tsx        # Bloom / vignette (Medium & High only)
├── game/
│   ├── core/                 # Pure simulation (no DOM / graphics / audio)
│   │   ├── sim.ts            # Rules + combat API
│   │   ├── aliens/           # One kit per alien (+ index.ts registry, kit.ts interface)
│   │   ├── enemies.ts        # Robot stats, spawn table and AI
│   │   ├── bosses/           # vexx.ts, spider.ts, hunter.ts (+ index.ts)
│   │   ├── zones.ts          # Area effects and telegraphed attacks
│   │   ├── progression.ts    # Levels, upgrade costs, multipliers
│   │   ├── physics.ts        # Rapier world: character controller, platforms, walls, raycasts
│   │   ├── arena.ts · forms.ts · geom.ts · events.ts · types.ts
│   ├── runtime.ts            # Browser driver: fixed-step loop, slow motion, wheel, input, audio, store bridge
│   ├── store.ts              # zustand store: HUD snapshot, settings, save data (cores, unlocks, levels)
│   ├── wheel.ts · quality.ts · input.ts · audio.ts
│   ├── view/                 # Effect pools (particles, floating text) + DOM overlay handles
│   └── platform/             # Storage + asset URL helpers
├── app/manifest.ts           # Web app manifest (install, fullscreen, landscape)
├── public/
│   ├── sw.js                 # Service worker: offline play for the installed app
│   ├── icons/                # App icons (made by scripts/make-icons.mjs)
│   └── models/               # Drop real .glb character models here
├── scripts/
│   ├── prepare-assets.mjs    # Copies model decoders + lists models (runs before dev/build)
│   ├── make-icons.mjs        # Draws the PNG app icons from the emblem (npm run icons)
│   └── serve-out.mjs         # npm start: serves the built game to this PC and phones on the Wi-Fi
└── .github/workflows/pages.yml  # Publishes the game to GitHub Pages on every push
```

### How to add a new alien

1. **Id and stats:** add the id to `AlienId` in `game/core/types.ts`, then its stats (speed, jump, armour,
   cooldowns, unlock cost, move names) to `FORMS` in `game/core/forms.ts`. Add it to `ALIEN_ORDER` if it needs a
   number key and a wheel slot (the wheel is laid out for 10).
2. **Moves:** create `game/core/aliens/<id>.ts` exporting an `AlienKit` with `light`, `finisher`, `heavy`, `special`
   and `ultimate` (optionally `tick`). Copy the closest existing alien and change it; the combat API does the rest.
   Register it in `game/core/aliens/index.ts`.
3. **Look:** add a `RigSpec` to `RIGS` in `components/three/characters/rigs.tsx`, or drop `public/models/<id>.glb`.
4. Run `npm run typecheck`. TypeScript tells you if anything is missing.

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

## Credits

Kai's 3D model and animations are public-domain (CC0) assets by **Quaternius**: "Universal Base Characters" and
"Universal Animation Library" (https://quaternius.com). They were optimised for phones and are bundled locally in
`public/models/hero/` (see `CREDITS.md` and the licence files there). The agent suit is added in code.
