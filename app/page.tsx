import Game from "@/components/Game";

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-2 sm:p-4">
      <Game />
      <p className="hidden text-center text-xs text-gray-500 sm:block">
        Move <b>A/D</b> or <b>←/→</b> · Jump <b>W/Space</b> · Drop <b>S</b> · Attack <b>J</b> · Special <b>K</b> · Transform{" "}
        <b>1–4</b> · Revert <b>Q</b> · Pause <b>P</b> · Mute <b>M</b>
      </p>
    </main>
  );
}
