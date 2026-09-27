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

  useLayoutEffect(() => {
    overlay.flash = flash.current;
    overlay.hurt = hurt.current;
    overlay.texts = texts.current ? (Array.from(texts.current.children) as HTMLDivElement[]) : [];
    return () => {
      overlay.flash = null;
      overlay.hurt = null;
      overlay.texts = [];
    };
  }, []);

  return (
    <>
      {/* Green transform flash */}
      <div ref={flash} className="pointer-events-none absolute inset-0 opacity-0 mix-blend-screen" style={{ background: "#4ade80" }} />
      {/* Red edge vignette when hurt */}
      <div ref={hurt} className="pointer-events-none absolute inset-0 opacity-0 shadow-[inset_0_0_120px_30px_rgba(239,68,68,0.85)]" />
      {/* Damage numbers and callouts, positioned by FloatingTextsDriver */}
      <div ref={texts} className="pointer-events-none absolute inset-0 overflow-hidden">
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
