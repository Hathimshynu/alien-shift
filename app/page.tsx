import Game from "@/components/Game";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-2 sm:p-4">
      <Game />
      <p className="hidden text-center text-xs text-gray-500 sm:block">
        Move <b>WASD</b> / <b>arrows</b> · Jump <b>Space</b> · Drop <b>C</b> · Attack <b>J</b> · Special <b>K</b> · Transform{" "}
        <b>1–4</b> · Revert <b>Q</b> · Pause <b>P</b> · Mute <b>M</b> · FPS <b>F3</b>
      </p>
    </main>
  );
}
