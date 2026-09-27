import type { MetadataRoute } from "next";

// Needed for the static export: the manifest is written once at build time.
export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Web app manifest: makes the game installable ("Add to Home Screen") and launch fullscreen in landscape. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: `${base}/`,
    name: "Alien Shift",
    short_name: "Alien Shift",
    description: "Transform into ten alien heroes and defend a neon city street from waves of robots.",
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "fullscreen",
    display_override: ["fullscreen", "standalone"],
    orientation: "landscape",
    background_color: "#030712",
    theme_color: "#030712",
    categories: ["games", "entertainment"],
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${base}/icons/maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
