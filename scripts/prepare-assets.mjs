// Runs automatically before `npm run dev` and `npm run build` (see package.json "predev"/"prebuild").
//
// 1. Copies the Draco (compressed meshes) and Basis/KTX2 (compressed textures) decoders from the
//    installed `three` package into public/, so .glb models load with NO CDN downloads — the game
//    keeps working offline (PWA) and inside the Android app.
// 2. Writes public/models/manifest.json listing every public/models/<id>.glb, so the game knows which
//    characters have a real model and which use the built-in placeholder.

import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const threeLibs = join(root, "node_modules", "three", "examples", "jsm", "libs");

function copyDir(from, to) {
  if (!existsSync(from)) {
    console.warn(`[prepare-assets] missing ${from} — is "three" installed? (run npm install)`);
    return;
  }
  mkdirSync(to, { recursive: true });
  for (const file of readdirSync(from)) {
    if (file.endsWith(".js") || file.endsWith(".wasm")) copyFileSync(join(from, file), join(to, file));
  }
}

copyDir(join(threeLibs, "draco", "gltf"), join(root, "public", "draco"));
copyDir(join(threeLibs, "basis"), join(root, "public", "basis"));

const modelsDir = join(root, "public", "models");
mkdirSync(modelsDir, { recursive: true });
const models = readdirSync(modelsDir)
  .filter((f) => f.toLowerCase().endsWith(".glb"))
  .map((f) => f.slice(0, -4));
writeFileSync(join(modelsDir, "manifest.json"), JSON.stringify({ models }, null, 2) + "\n");

console.log(`[prepare-assets] decoders copied; models: ${models.length ? models.join(", ") : "none (using placeholders)"}`);
