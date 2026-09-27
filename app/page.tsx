import Game from "@/components/Game";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-2 sm:p-4">
      <Game />
      <p className="hidden text-center text-xs text-gray-500 sm:block">
        Move <b>WASD</b> · Jump <b>Space</b> · Attack <b>J</b> (hold = heavy) · Special <b>K</b> · Ultimate <b>L</b> · Dodge <b>Shift</b> ·
        Aliens <b>1–0</b> / wheel <b>Tab</b> · Kai <b>Q</b> · Drop <b>C</b> · Pause <b>P</b> · Mute <b>M</b> · FPS <b>F3</b>
      </p>
    </main>
  );
}
