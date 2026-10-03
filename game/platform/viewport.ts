"use client";

import { useSyncExternalStore } from "react";

/*
 * Touch-UI detection and the real (visible) viewport size.
 *
 * Touch UI is decided ONCE per page load (it doesn't flip while you play) and written to
 * <html data-touch>. CSS uses the `touch:` variant (globals.css) and components use useTouchUi().
 * Rule: the primary pointer is coarse (phones, tablets), or the device has a touchscreen and a
 * small screen (some Android browsers and "desktop site" modes report a fine pointer). Laptops with
 * touchscreens keep the desktop UI. `?touch=1` / `?touch=0` in the URL forces either mode.
 *
 * The viewport size comes from window.visualViewport (falls back to innerWidth/innerHeight) and is
 * published as --app-w / --app-h, so the game frame follows the browser address bar appearing or
 * hiding, rotation, fullscreen changes and window resizes.
 */

export function isTouchUi() {
  return typeof document !== "undefined" && document.documentElement.hasAttribute("data-touch");
}

export interface ViewportInfo {
  width: number;
  height: number;
  portrait: boolean;
}

let info: ViewportInfo = { width: 1280, height: 720, portrait: false };
const listeners = new Set<() => void>();
let started = false;

function measure() {
  const vv = window.visualViewport;
  const width = Math.round(vv?.width ?? window.innerWidth);
  const height = Math.round(vv?.height ?? window.innerHeight);
  const root = document.documentElement.style;
  root.setProperty("--app-w", `${width}px`);
  root.setProperty("--app-h", `${height}px`);
  const portrait = height > width;
  document.documentElement.toggleAttribute("data-portrait", portrait);
  if (width !== info.width || height !== info.height || portrait !== info.portrait) {
    info = { width, height, portrait };
    listeners.forEach((l) => l());
  }
}

/** Start tracking the viewport (idempotent). Measures on resize, rotation, address-bar and fullscreen changes. */
export function startViewportTracking() {
  if (started || typeof window === "undefined") return;
  started = true;
  // Rotation and fullscreen settle a frame or two after their events on some phones: measure again.
  const later = () => {
    measure();
    requestAnimationFrame(measure);
    setTimeout(measure, 250);
  };
  window.addEventListener("resize", measure);
  window.addEventListener("orientationchange", later);
  window.visualViewport?.addEventListener("resize", measure);
  document.addEventListener("fullscreenchange", later);
  measure();
}

export function getViewport() {
  return info;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Live viewport size + orientation (re-renders only when it changes). */
export function useViewport(): ViewportInfo {
  return useSyncExternalStore(subscribe, getViewport, () => info);
}

/** True when the touch UI is active (decided at page load). False during the server render. */
export function useTouchUi(): boolean {
  return useSyncExternalStore(
    () => () => {},
    isTouchUi,
    () => false,
  );
}
