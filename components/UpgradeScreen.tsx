"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ALIEN_ORDER, FORMS, slotKey } from "@/game/core/forms";
import { COMBO_MOVE_LEVEL, MAX_LEVEL, damageMul, drainMul, specialCdMul } from "@/game/core/progression";
import type { AlienId } from "@/game/core/types";
import { levelOfAlien, nextUpgradeCost, useGameStore } from "@/game/store";
import { AlienBadge } from "./Hud";

const ModelPreview = dynamic(() => import("./ModelPreview"), { ssr: false });

const pct = (x: number) => `${x >= 0 ? "+" : ""}${Math.round(x * 100)}%`;

function LevelPips({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span key={i} className={`h-1.5 w-2.5 rounded-sm ${i < level ? "bg-amber-400" : "bg-gray-700"}`} />
      ))}
    </span>
  );
}

/** The Shift Lab: unlock aliens and upgrade them with Shift Cores, and pick the four dial favourites. */
export default function UpgradeScreen() {
  const { save } = useGameStore(useShallow((s) => ({ save: s.save })));
  const setScreen = useGameStore((s) => s.setScreen);
  const unlockAlien = useGameStore((s) => s.unlockAlien);
  const upgradeAlien = useGameStore((s) => s.upgradeAlien);
  const setFavorite = useGameStore((s) => s.setFavorite);
  const [selected, setSelected] = useState<AlienId>("blaze");

  const f = FORMS[selected];
  const unlocked = save.unlocked.includes(selected);
  const level = levelOfAlien(save, selected);
  const cost = unlocked ? nextUpgradeCost(save, selected) : f.unlockCost;
  const affordable = cost !== null && save.cores >= cost;

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#07061a] p-2 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-black tracking-widest text-green-400 sm:text-2xl">SHIFT LAB</h2>
        <div className="font-display text-sm font-bold text-amber-300 sm:text-lg">◆ {save.cores} CORES</div>
        <button
          type="button"
          onClick={() => setScreen(null)}
          className="rounded-full border border-white/30 px-4 py-1 font-display text-xs font-bold tracking-widest text-white hover:bg-white/10"
        >
          BACK
        </button>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 gap-2 sm:gap-4">
        {/* Roster */}
        <div className="grid w-[46%] grid-cols-2 content-start gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 sm:gap-2">
          {ALIEN_ORDER.map((id, i) => {
            const own = save.unlocked.includes(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => setSelected(id)}
                className={`flex items-center gap-2 rounded-lg border p-1.5 text-left transition ${selected === id ? "border-green-400 bg-green-500/10" : "border-white/10 bg-white/5 hover:bg-white/10"}`}
              >
                <AlienBadge id={id} size={28} locked={!own} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[10px] font-bold sm:text-xs" style={{ color: own ? FORMS[id].accent : "#9ca3af" }}>
                    {slotKey(i)}. {FORMS[id].name}
                  </div>
                  {own ? <LevelPips level={levelOfAlien(save, id)} /> : <div className="text-[9px] text-amber-300">◆ {FORMS[id].unlockCost}</div>}
                </div>
                {save.favorites.includes(id) && <span className="text-[10px] text-green-300">★</span>}
              </button>
            );
          })}
        </div>

        {/* Details */}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto">
          <div className="h-[38%] min-h-24 overflow-hidden rounded-lg border border-white/10">
            <ModelPreview form={selected} locked={!unlocked} />
          </div>
          <div>
            <div className="font-display text-sm font-black tracking-wider sm:text-lg" style={{ color: f.accent }}>
              {f.name.toUpperCase()} <span className="text-xs font-normal text-gray-400">· {f.title}</span>
            </div>
            <p className="text-[10px] leading-snug text-gray-300 sm:text-xs">{f.blurb}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-2 text-[10px] text-gray-300 sm:text-xs">
            <div>
              <b className="text-white">J</b> {f.attackLabel}
            </div>
            <div>
              <b className="text-white">Hold J</b> {f.heavyLabel}
            </div>
            <div>
              <b className="text-white">K</b> {f.specialLabel}
            </div>
            <div>
              <b className="text-white">L</b> {f.ultimateLabel}
            </div>
            <div className="col-span-2">
              <b className="text-white">3-hit combo move:</b> {f.comboMoveLabel}{" "}
              <span className={level >= COMBO_MOVE_LEVEL ? "text-green-400" : "text-gray-500"}>{level >= COMBO_MOVE_LEVEL ? "(unlocked)" : `(level ${COMBO_MOVE_LEVEL})`}</span>
            </div>
          </div>
          {unlocked && (
            <div className="rounded-lg bg-white/5 p-1.5 text-[10px] text-gray-300 sm:text-xs">
              <div className="mb-1 flex items-center gap-2 font-display text-white">
                LEVEL {level} <LevelPips level={level} />
              </div>
              Damage {pct(damageMul(level) - 1)} · Watch drain {pct(drainMul(level) - 1)} · Special cooldown {pct(specialCdMul(level) - 1)}
              {level < MAX_LEVEL && (
                <div className="text-gray-500">
                  Next: damage {pct(damageMul(level + 1) - 1)}, drain {pct(drainMul(level + 1) - 1)}, cooldown {pct(specialCdMul(level + 1) - 1)}
                  {level + 1 === COMBO_MOVE_LEVEL && <span className="text-green-400"> + {f.comboMoveLabel}</span>}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {cost === null ? (
              <span className="font-display text-xs font-bold text-amber-300">MAX LEVEL</span>
            ) : (
              <button
                type="button"
                disabled={!affordable}
                onClick={() => (unlocked ? upgradeAlien(selected) : unlockAlien(selected))}
                className="rounded-full bg-amber-400 px-4 py-1.5 font-display text-xs font-black tracking-widest text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400"
              >
                {unlocked ? "UPGRADE" : "UNLOCK"} · ◆ {cost}
              </button>
            )}
            {unlocked && (
              <div className="flex items-center gap-1 font-display text-[10px] text-gray-400">
                DIAL SLOT
                {[0, 1, 2, 3].map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setFavorite(slot, selected)}
                    title={`Put ${f.name} on dial slot ${slot + 1}`}
                    className={`h-6 w-6 rounded-full text-[10px] font-bold ring-1 ${save.favorites[slot] === selected ? "bg-green-500 text-black ring-green-300" : "text-gray-300 ring-white/20 hover:bg-white/10"}`}
                  >
                    {slot + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
