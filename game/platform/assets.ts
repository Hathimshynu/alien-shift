/**
 * Prefix for files served from /public. It's empty locally; when the site is hosted under a
 * sub-path (GitHub Pages: /alien-shift) the build sets NEXT_PUBLIC_BASE_PATH.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const assetUrl = (path: string) => `${BASE_PATH}${path}`;

/**
 * Which characters have a real .glb model. `scripts/prepare-assets.mjs` writes
 * public/models/manifest.json before every dev/build run by listing public/models/*.glb.
 */
export async function loadModelManifest(): Promise<string[]> {
  try {
    const res = await fetch(assetUrl("/models/manifest.json"), { cache: "no-cache" });
    if (!res.ok) return [];
    const json = (await res.json()) as { models?: unknown };
    return Array.isArray(json.models) ? json.models.filter((m): m is string => typeof m === "string") : [];
  } catch {
    return [];
  }
}
