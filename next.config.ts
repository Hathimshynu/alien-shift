import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep this app self-contained even when it sits inside another project folder.
  turbopack: { root },
  outputFileTracingRoot: root,
};

export default nextConfig;
