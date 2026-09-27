import type { Metadata, Viewport } from "next";
import { Inter, Orbitron } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({ subsets: ["latin"], weight: ["500", "700", "900"], variable: "--font-orbitron" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });
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
    <html lang="en" className={`${orbitron.variable} ${inter.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
