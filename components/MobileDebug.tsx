"use client";

import { useEffect, useState } from "react";

/**
 * DEVELOPMENT-ONLY mobile layout check (Game.tsx renders it only when NODE_ENV is "development", so the
 * production build doesn't include it). Open the dev server with `?mobiledebug` in the URL.
 * Shows the viewport, orientation, safe-area insets and whether each control is fully on screen.
 * It re-checks on resize/orientation/fullscreen events and once a second — never every frame.
 */
const CONTROLS = ["joystick", "jump", "shoot", "power-0", "power-1", "power-2", "roll", "pause", "hp", "score"];

export default function MobileDebug() {
  const [text, setText] = useState("");
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (!/[?&]mobiledebug/.test(location.search)) return;
    setOn(true);
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
    document.body.appendChild(probe);
    const check = () => {
      const w = Math.round(window.visualViewport?.width ?? innerWidth);
      const h = Math.round(window.visualViewport?.height ?? innerHeight);
      const cs = getComputedStyle(probe);
      const lines = [
        `Viewport: ${w} × ${h}`,
        `Orientation: ${h > w ? "PORTRAIT" : "LANDSCAPE"}`,
        `Touch UI: ${document.documentElement.hasAttribute("data-touch") ? "yes" : "no"}`,
        `Safe area: L ${cs.paddingLeft} R ${cs.paddingRight} T ${cs.paddingTop} B ${cs.paddingBottom}`,
        "Controls:",
      ];
      for (const c of CONTROLS) {
        const el = document.querySelector<HTMLElement>(`[data-control="${c}"]`);
        if (!el) {
          lines.push(`  ${c}: — (not shown)`);
          continue;
        }
        const r = el.getBoundingClientRect();
        const inside = r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= w && r.bottom <= h;
        lines.push(`  ${c}: ${inside ? "✓" : "✗ OFF-SCREEN"} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      setText(lines.join("\n"));
    };
    check();
    const id = window.setInterval(check, 1000);
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    document.addEventListener("fullscreenchange", check);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
      document.removeEventListener("fullscreenchange", check);
      probe.remove();
    };
  }, []);

  if (!on) return null;
  return (
    <pre className="pointer-events-none fixed left-1/2 top-12 z-[200] -translate-x-1/2 rounded bg-black/80 p-2 font-mono text-[10px] leading-tight text-lime-300">{text}</pre>
  );
}
