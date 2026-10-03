import { BASE_PATH } from "./assets";

/** Chrome/Edge/Samsung Internet event that lets us show our own "Install app" button. */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Running as an installed app (home-screen icon) rather than in a browser tab. */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone / iPad: there is no install prompt — the user must use Share → "Add to Home Screen". */
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** Touch UI active (see game/platform/viewport.ts for the detection rule). */
export const isTouchDevice = () => typeof document !== "undefined" && document.documentElement.hasAttribute("data-touch");

/** Whether our Install button can open the browser's install dialog right now. */
export const canPromptInstall = () => deferredPrompt !== null;

/** Subscribe to install-availability changes (returns an unsubscribe function). */
export function onInstallChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Open the browser's install dialog. Returns true if the user accepted. */
export async function promptInstall() {
  const e = deferredPrompt;
  if (!e) return false;
  deferredPrompt = null;
  notify();
  await e.prompt();
  const choice = await e.userChoice;
  return choice.outcome === "accepted";
}

let started = false;

/**
 * Register the service worker and start listening for the install offer. Call once in the browser.
 * The service worker only runs in production builds on HTTPS (or localhost): in `npm run dev` it
 * would cache development files and serve stale code.
 */
export function initPwa() {
  if (started || typeof window === "undefined") return;
  started = true;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // we show our own button instead of the mini-infobar
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(`${BASE_PATH}/sw.js`, { scope: `${BASE_PATH}/` }).catch((err) => {
      console.warn("[Alien Shift] service worker registration failed:", err);
    });
  }
}

type LockableOrientation = ScreenOrientation & { lock?: (o: "landscape") => Promise<void> };

/**
 * Go fullscreen and lock to landscape (Android Chrome). Must be called from a tap/click.
 * iPhones can't make a page fullscreen — there, installing to the home screen does it.
 */
export async function enterFullscreen() {
  const el = document.documentElement;
  try {
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
  } catch {
    /* not allowed (iOS Safari, or not triggered by a tap) */
  }
  try {
    await (screen.orientation as LockableOrientation | undefined)?.lock?.("landscape");
  } catch {
    /* orientation lock only works in fullscreen on some browsers */
  }
}

export function isFullscreen() {
  return typeof document !== "undefined" && !!document.fullscreenElement;
}

export const fullscreenSupported = () => typeof document !== "undefined" && !!document.documentElement.requestFullscreen && !isIOS();
