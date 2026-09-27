"use client";

import { useEffect, useState } from "react";
import { canPromptInstall, enterFullscreen, fullscreenSupported, isFullscreen, isIOS, isStandalone, onInstallChange, promptInstall } from "@/game/platform/pwa";

/** Re-render when fullscreen or install availability changes. */
function usePwaState() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const off = onInstallChange(bump);
    document.addEventListener("fullscreenchange", bump);
    window.addEventListener("resize", bump);
    return () => {
      off();
      document.removeEventListener("fullscreenchange", bump);
      window.removeEventListener("resize", bump);
    };
  }, []);
  return { canInstall: canPromptInstall(), standalone: isStandalone(), ios: isIOS(), fullscreen: isFullscreen(), fsSupported: fullscreenSupported() };
}

/**
 * "Install app" on the start screen. Chrome/Edge/Samsung offer a real install dialog; iPhone needs
 * Share → Add to Home Screen, so we explain that instead. Hidden once the game runs as an app.
 */
export function InstallButton() {
  const { canInstall, standalone, ios } = usePwaState();
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || standalone) return null;

  if (canInstall) {
    return (
      <button
        type="button"
        onClick={() => void promptInstall()}
        className="rounded-full border border-green-400/60 bg-green-500/15 px-4 py-1.5 font-display text-[11px] font-bold tracking-widest text-green-300 hover:bg-green-500/25"
      >
        📲 INSTALL APP
      </button>
    );
  }
  if (ios) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => setShowIosHelp((v) => !v)}
          className="rounded-full border border-green-400/60 bg-green-500/15 px-4 py-1.5 font-display text-[11px] font-bold tracking-widest text-green-300"
        >
          📲 INSTALL APP
        </button>
        {showIosHelp && (
          <p className="max-w-xs text-[11px] text-gray-300">
            In Safari tap <b>Share</b> (the square with an arrow), then <b>Add to Home Screen</b>. Open Alien Shift from your home screen to play fullscreen.
          </p>
        )}
      </div>
    );
  }
  return null;
}

/** ⛶ Fullscreen + landscape lock, for phones/tablets in a browser tab (not needed once installed). */
export function FullscreenButton({ className = "" }: { className?: string }) {
  const { fullscreen, standalone, fsSupported } = usePwaState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || fullscreen || standalone || !fsSupported) return null;
  return (
    <button
      type="button"
      aria-label="Fullscreen"
      title="Fullscreen"
      onClick={() => void enterFullscreen()}
      className={`pointer-events-auto hidden place-items-center rounded-lg bg-black/50 font-display text-base font-black text-white ring-1 ring-white/20 pointer-coarse:grid ${className}`}
    >
      ⛶
    </button>
  );
}

/** Portrait phones: ask to rotate (pure CSS, see .rotate-hint in globals.css). */
export function RotateHint() {
  return (
    <div className="rotate-hint fixed inset-0 z-[100] flex-col items-center justify-center gap-4 bg-[#030712] p-6 text-center">
      <div className="rotate-phone text-6xl">📱</div>
      <div className="font-display text-lg font-black tracking-widest text-green-400">ROTATE YOUR PHONE</div>
      <p className="max-w-xs text-sm text-gray-400">Alien Shift plays in landscape. Turn your phone sideways (and switch off rotation lock).</p>
    </div>
  );
}
