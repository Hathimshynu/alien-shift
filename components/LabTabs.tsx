"use client";

import dynamic from "next/dynamic";
import { POWERS, POWER_ORDER } from "@/game/core/powers";
import { AGENT_STATS, MAX_LEVEL } from "@/game/core/progression";
import { RULES } from "@/game/core/rules";
import { WEAPONS, WEAPON_ORDER } from "@/game/core/weapons";
import { agentLevel, levelsCleared, nextAgentCost, useGameStore } from "@/game/store";
import { POWER_KEYS } from "./PowerButton";

const ModelPreview = dynamic(() => import("./ModelPreview"), { ssr: false });

function Pips({ level }: { level: number }) {
  return (
    <span className="flex gap-0.5">
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <span key={i} className={`h-1.5 w-2.5 rounded-sm ${i < level ? "bg-amber-400" : "bg-gray-700"}`} />
      ))}
    </span>
  );
}

const buyClass =
  "rounded-full bg-amber-400 px-3 py-1 font-display text-[10px] font-black tracking-widest text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:bg-gray-700 disabled:text-gray-400 sm:text-xs";
const card = "flex flex-col gap-1 rounded-lg border border-white/10 bg-white/5 p-2";

/** Kai's six upgrade tracks. */
export function AgentTab() {
  const save = useGameStore((s) => s.save);
  const upgrade = useGameStore((s) => s.upgradeAgent);
  const hp = RULES.player.maxHp + (agentLevel(save, "health") - 1) * RULES.player.healthPerUpgrade;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <div className="flex items-stretch gap-2">
        <div className="h-28 w-24 shrink-0 overflow-hidden rounded-lg border border-white/10 sm:h-36 sm:w-32">
          <ModelPreview form="human" locked={false} />
        </div>
        <p className="self-center text-[10px] text-gray-300 sm:text-xs">
          Agent Kai — max health <b className="text-white">{hp}</b>. Upgrades apply to Kai (health also protects every alien form).
        </p>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
        {AGENT_STATS.map((st) => {
          const lvl = agentLevel(save, st.id);
          const cost = nextAgentCost(save, st.id);
          return (
            <div key={st.id} className={card}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-xs font-bold text-white sm:text-sm">
                  {st.icon} {st.name}
                </span>
                <Pips level={lvl} />
              </div>
              <div className="text-[10px] text-gray-400 sm:text-xs">{st.perLevel}</div>
              <div>
                {cost === null ? (
                  <span className="font-display text-[10px] font-bold text-amber-300">MAX LEVEL</span>
                ) : (
                  <button type="button" disabled={save.cores < cost} onClick={() => upgrade(st.id)} className={buyClass}>
                    UPGRADE · ◆ {cost}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Guns: buy (cores + a cleared campaign level) and choose the one Kai starts with. */
export function WeaponsTab() {
  const save = useGameStore((s) => s.save);
  const buy = useGameStore((s) => s.buyWeapon);
  const equip = useGameStore((s) => s.equipWeapon);
  const cleared = levelsCleared(save);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <p className="text-[10px] text-gray-300 sm:text-xs">Switch between owned guns during a run with V (or tap the gun panel). The equipped gun is in your hand when a run starts.</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
        {WEAPON_ORDER.map((id) => {
          const w = WEAPONS[id];
          const owned = save.weapons.includes(id);
          const equipped = save.weapon === id;
          const locked = cleared < w.requiresLevel;
          return (
            <div key={id} className={`${card} ${equipped ? "border-green-400/70" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-xs font-bold sm:text-sm" style={{ color: w.color }}>
                  {w.icon} {w.name}
                </span>
                {equipped && <span className="font-display text-[9px] text-green-300">EQUIPPED</span>}
              </div>
              <div className="text-[10px] text-gray-400 sm:text-xs">{w.blurb}</div>
              <div className="font-display text-[9px] tracking-wider text-gray-300 sm:text-[10px]">
                DMG {w.dmg}
                {w.pellets > 1 ? `×${w.pellets}` : ""} · {w.fireRate}/s · MAG {w.magazine} · RELOAD {w.reload}s{w.aoe > 0 ? " · SPLASH" : ""}
              </div>
              <div>
                {owned ? (
                  <button type="button" disabled={equipped} onClick={() => equip(id)} className={buyClass}>
                    {equipped ? "IN HAND" : "EQUIP"}
                  </button>
                ) : locked ? (
                  <span className="font-display text-[10px] text-gray-500">🔒 Clear campaign level {w.requiresLevel}</span>
                ) : (
                  <button type="button" disabled={save.cores < w.cost} onClick={() => buy(id)} className={buyClass}>
                    BUY · ◆ {w.cost}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Powers: buy them and put three on the E / R / T buttons. */
export function PowersTab() {
  const save = useGameStore((s) => s.save);
  const buy = useGameStore((s) => s.buyPower);
  const equip = useGameStore((s) => s.equipPower);
  const cleared = levelsCleared(save);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      <p className="text-[10px] text-gray-300 sm:text-xs">Three powers are on your buttons (E / R / T, or the round buttons on a phone). They work in every form.</p>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-2">
        {POWER_ORDER.map((id) => {
          const p = POWERS[id];
          const owned = save.powers.includes(id);
          const locked = cleared < p.requiresLevel;
          const slot = save.equippedPowers.indexOf(id);
          return (
            <div key={id} className={`${card} ${slot >= 0 ? "border-green-400/70" : ""}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-xs font-bold sm:text-sm" style={{ color: p.color }}>
                  {p.icon} {p.name}
                </span>
                <span className="font-display text-[9px] text-gray-400">
                  {p.damage > 0 ? `DMG ${p.damage} · ` : ""}CD {p.cooldown}s
                </span>
              </div>
              <div className="text-[10px] text-gray-400 sm:text-xs">{p.description}</div>
              <div className="flex flex-wrap items-center gap-1">
                {owned ? (
                  <>
                    <span className="font-display text-[9px] text-gray-400">BUTTON</span>
                    {[0, 1, 2].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => equip(s, id)}
                        className={`h-6 w-6 rounded-full font-display text-[10px] font-bold ring-1 ${slot === s ? "bg-green-500 text-black ring-green-300" : "text-gray-300 ring-white/20 hover:bg-white/10"}`}
                      >
                        {POWER_KEYS[s]}
                      </button>
                    ))}
                  </>
                ) : locked ? (
                  <span className="font-display text-[10px] text-gray-500">🔒 Clear campaign level {p.requiresLevel}</span>
                ) : (
                  <button type="button" disabled={save.cores < p.cost} onClick={() => buy(id)} className={buyClass}>
                    UNLOCK · ◆ {p.cost}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
