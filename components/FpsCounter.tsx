"use client";

import { useEffect, useState } from "react";
import { overlay } from "@/game/view/overlay";
import { useGameStore } from "@/game/store";

/** Performance readout, hidden until F3 is pressed (press again to hide). */
export default function FpsCounter() {
  const show = useGameStore((s) => s.showFps);
  const quality = useGameStore((s) => s.settings.quality);
  const [perf, setPerf] = useState({ ...overlay.perf });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "F3") return;
      e.preventDefault(); // F3 is "find" in some browsers
      useGameStore.getState().toggleFps();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!show) return;
    const id = window.setInterval(() => setPerf({ ...overlay.perf }), 500);
    return () => window.clearInterval(id);
  }, [show]);

  if (!show) return null;
  const color = perf.fps >= 55 ? "text-green-400" : perf.fps >= 40 ? "text-yellow-300" : "text-red-400";
  return (
    <div className="pointer-events-none absolute left-1/2 top-1 z-50 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 font-mono text-[11px] text-gray-200">
      <span className={`font-bold ${color}`}>{perf.fps} FPS</span> · {perf.frameMs.toFixed(1)} ms · {perf.calls} draws ·{" "}
      {(perf.triangles / 1000).toFixed(0)}k tris · {quality.toUpperCase()}
    </div>
  );
}
