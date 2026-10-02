import Game from "@/components/Game";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-2 sm:p-4">
      <Game />
      <p className="page-hint hidden text-center text-xs text-gray-500 sm:block">
        Move <b>WASD</b> · Jump <b>Space</b> (×2 spin) · Shoot <b>J</b> / <b>mouse</b> · Punch <b>F</b> · Powers <b>E R T</b> · Reload <b>G</b> · Gun <b>V</b> ·
        Dodge <b>Shift</b> · Aliens <b>1–0</b> / <b>Tab</b> (alien: special <b>K</b>, ultimate <b>L</b>) · Kai <b>Q</b> · Drop <b>C</b> · Pause <b>P</b> · Mute <b>M</b> · FPS <b>F3</b>
      </p>
    </main>
  );
}
