import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { DETECT_TOUCH_SCRIPT } from "@/game/platform/touch-script";
import "./globals.css";

// Fonts ship with the project (app/fonts, SIL Open Font License) instead of being downloaded from
// Google during the build: cloud builds can't fail on a network hiccup, and the game works offline.
const orbitron = localFont({ src: "./fonts/orbitron-latin.woff2", weight: "400 900", variable: "--font-orbitron", display: "swap" });
const inter = localFont({ src: "./fonts/inter-latin.woff2", weight: "100 900", variable: "--font-body", display: "swap" });
const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Alien Shift — Transform. Fight. Survive.",
  description: "A 3D browser action game: slam the Shiftwatch, transform into ten alien heroes and defend the city from a robot invasion.",
  applicationName: "Alien Shift",
  // iPhone / iPad "Add to Home Screen": run fullscreen without Safari's bars.
  appleWebApp: { capable: true, title: "Alien Shift", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: `${base}/icon.svg`, type: "image/svg+xml" }], apple: `${base}/icons/apple-touch-icon.png` },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#030712",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Let the game draw under the notch; the HUD keeps clear of it with safe-area padding.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-touch / data-portrait and the --app-w/--app-h sizes are set on <html> by script before React hydrates.
    <html lang="en" className={`${orbitron.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: DETECT_TOUCH_SCRIPT }} />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
