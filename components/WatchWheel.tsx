"use client";

import { useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { ALIEN_ORDER, FORMS, slotKey } from "@/game/core/forms";
import type { GameRuntime } from "@/game/runtime";
import { useGameStore } from "@/game/store";
import { pickFromVector, slotAngle } from "@/game/wheel";
import { AlienBadge } from "./Hud";

/**
 * Radial Shiftwatch wheel with all ten aliens. Open with Tab (hold; the movement keys or the mouse
 * highlight an alien, releasing Tab transforms) or the ⌚ button (tap an alien). Time slows while open.
 */
export default function WatchWheel({ runtime }: { runtime: GameRuntime }) {
  const { open, pick, unlocked, form, energy, watchLocked } = useGameStore(
    useShallow((s) => ({ open: s.wheelOpen, pick: s.wheelPick, unlocked: s.save.unlocked, form: s.hud.form, energy: s.hud.energy, watchLocked: s.hud.watchLocked })),
  );
  const setPick = useGameStore((s) => s.setWheelPick);
  const wheel = useRef<HTMLDivElement>(null);
  if (!open) return null;

  const shown = pick ?? (form !== "human" ? form : null);
  const lowEnergy = watchLocked || energy < 15;

  return (
    <div
      className="absolute inset-0 z-20 grid place-items-center bg-black/55"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) runtime.closeWheel(); // tap outside = cancel
      }}
    >
      <div
        ref={wheel}
        className="wheel-in relative aspect-square h-[82%] rounded-full border-2 border-green-500/50 bg-black/70 shadow-[0_0_60px_-10px_#22c55e]"
        onPointerMove={(e) => {
          const r = wheel.current?.getBoundingClientRect();
          if (!r) return;
          const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
          const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
          const id = pickFromVector(dx, dy);
          if (id !== pick) setPick(id);
        }}
      >
        {ALIEN_ORDER.map((id, i) => {
          const a = slotAngle(i);
          const locked = !unlocked.includes(id);
          const active = shown === id;
          return (
            <button
              key={id}
              type="button"
              disabled={locked}
              onClick={() => runtime.closeWheel(id)}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 transition ${active ? "scale-125" : "opacity-80"} ${locked ? "cursor-not-allowed" : "cursor-pointer"}`}
              style={{ left: `${50 + Math.cos(a) * 38}%`, top: `${50 + Math.sin(a) * 38}%` }}
            >
              <span className={`rounded-full ${active && !locked ? "ring-2 ring-white" : ""}`}>
                <AlienBadge id={id} size={40} locked={locked} />
              </span>
              <span className="font-display text-[9px] font-bold tracking-wider sm:text-[11px]" style={{ color: locked ? "#6b7280" : FORMS[id].accent }}>
                {slotKey(i)} · {FORMS[id].name.toUpperCase()}
              </span>
            </button>
          );
        })}
        {/* Centre: highlighted alien + revert */}
        <div className="absolute left-1/2 top-1/2 flex w-[46%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 text-center">
          {shown ? (
            <>
              <div className="font-display text-sm font-black tracking-widest sm:text-xl" style={{ color: FORMS[shown].accent }}>
                {FORMS[shown].name.toUpperCase()}
              </div>
              <div className="text-[9px] text-gray-400 sm:text-xs">{unlocked.includes(shown) ? FORMS[shown].title : `Locked — ${FORMS[shown].unlockCost} cores in the Shift Lab`}</div>
            </>
          ) : (
            <div className="font-display text-[10px] tracking-widest text-gray-400 sm:text-xs">PICK AN ALIEN</div>
          )}
          {lowEnergy && <div className="font-display text-[9px] text-red-400 sm:text-[11px]">WATCH RECHARGING</div>}
          <button
            type="button"
            onClick={() => runtime.closeWheel("human")}
            className="mt-1 rounded-full bg-gray-800 px-3 py-1 font-display text-[10px] text-gray-300 ring-1 ring-white/20 hover:bg-gray-700"
          >
            KAI
          </button>
          <div className="hidden text-[9px] text-gray-500 pointer-fine:block">Release TAB to transform</div>
        </div>
      </div>
    </div>
  );
}
