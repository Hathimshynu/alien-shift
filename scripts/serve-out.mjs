// `npm start`: serve the finished game from out/ (after `npm run build`) — also to phones on the
// same Wi-Fi. No extra packages needed. Stop it with Ctrl + C.

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "out");
const port = Number(process.env.PORT) || 3000;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".wasm": "application/wasm",
  ".glb": "model/gltf-binary",
  ".txt": "text/plain; charset=utf-8",
};

if (!existsSync(root)) {
  console.error('No out/ folder yet — run "npm run build" first.');
  process.exit(1);
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  let file = normalize(join(root, decodeURIComponent(url.pathname)));
  if (!file.startsWith(root)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  else if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file)) {
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    // Hashed build files never change; everything else is re-checked.
    "Cache-Control": file.includes("_next/static") ? "public, max-age=31536000, immutable" : "no-cache",
  });
  createReadStream(file).pipe(res);
}).listen(port, "0.0.0.0", () => {
  console.log(`\nAlien Shift is running:\n  On this PC:     http://localhost:${port}`);
  for (const a of Object.values(networkInterfaces()).flat()) {
    if (a && a.family === "IPv4" && !a.internal) console.log(`  On your phone:  http://${a.address}:${port}   (same Wi-Fi)`);
  }
  console.log("\nPress Ctrl + C to stop.\n");
});
