"use client";

import { useLayoutEffect, useRef } from "react";
import { MAX_TEXTS } from "@/game/view/fx";
import { overlay } from "@/game/view/overlay";

/**
 * Screen-space effect layers. React renders them once; the 3D frame loop then updates their
 * opacity / position directly through `overlay` (no React re-render per frame).
 */
export default function FxOverlay() {
  const flash = useRef<HTMLDivElement>(null);
  const hurt = useRef<HTMLDivElement>(null);
  const texts = useRef<HTMLDivElement>(null);
  const hit = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    overlay.flash = flash.current;
    overlay.hurt = hurt.current;
    overlay.hit = hit.current;
    overlay.texts = texts.current ? (Array.from(texts.current.children) as HTMLDivElement[]) : [];
    return () => {
      overlay.flash = null;
      overlay.hurt = null;
      overlay.hit = null;
      overlay.texts = [];
    };
  }, []);

  return (
    <>
      {/* Green transform flash */}
      <div ref={flash} className="pointer-events-none absolute inset-0 z-[1] opacity-0 mix-blend-screen" style={{ background: "#4ade80" }} />
      {/* Red edge vignette when hurt */}
      <div ref={hurt} className="pointer-events-none absolute inset-0 z-[1] opacity-0 shadow-[inset_0_0_120px_30px_rgba(239,68,68,0.85)]" />
      {/* Hit marker: an X where Kai's shots land (red and bigger on a kill). */}
      <div ref={hit} className="pointer-events-none absolute left-0 top-0 z-[1] h-6 w-6" style={{ display: "none" }}>
        <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 rotate-45 bg-current" />
        <span className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 -rotate-45 bg-current" />
      </div>
      {/* Damage numbers and callouts, positioned by FloatingTextsDriver */}
      <div ref={texts} className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        {Array.from({ length: MAX_TEXTS }, (_, i) => (
          <div
            key={i}
            className="absolute left-0 top-0 whitespace-nowrap font-display font-extrabold [text-shadow:0_0_3px_#000,0_2px_4px_#000]"
            style={{ display: "none" }}
          />
        ))}
      </div>
    </>
  );
}
