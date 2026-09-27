import os from "node:os";
import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname);

/**
 * Sub-path the site is served from. Empty locally; the GitHub Pages workflow sets it to
 * "/<repo-name>" because Pages serves the game at https://<user>.github.io/<repo-name>/.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * This PC's local network addresses (192.168.x.x …). The dev server refuses internal requests
 * from any host it doesn't know, which broke the game when a phone opened http://<PC-IP>:3000.
 */
const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === "IPv4" && !a.internal)
  .map((a) => a.address);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Static site in out/ — hosted on GitHub Pages and (later) bundled into the Android app.
  output: "export",
  basePath: basePath || undefined,
  allowedDevOrigins: lanAddresses,
  // Keep this app self-contained even when it sits inside another project folder.
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
