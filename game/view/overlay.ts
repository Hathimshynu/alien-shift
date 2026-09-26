/**
 * DOM elements that are updated every frame from inside the 3D render loop (without React
 * re-renders): the transform flash, pooled floating texts and the perf counters for the F3 overlay.
 * The React components register their elements here on mount.
 */
export const overlay = {
  flash: null as HTMLDivElement | null,
  hurt: null as HTMLDivElement | null,
  texts: [] as HTMLDivElement[],
  perf: { fps: 0, frameMs: 0, calls: 0, triangles: 0 },
};
