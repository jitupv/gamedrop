"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { GAMES } from "@/lib/games";
import { todayKey } from "@/lib/sdk/daily";
import { DayRecord, getAllResults, getStreak, maxStreak } from "@/lib/sdk/storage";

// Your story with this game — the Wordle stats moment. All local data.
export default function StatsModal({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const meta = GAMES.find((g) => g.id === gameId);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setRecords(getAllResults(gameId));
    setStreak(getStreak(gameId, todayKey()));
  }, [gameId]);

  if (!meta) return null;

  const wins = records.filter((r) => r.won);
  const winPct = records.length ? Math.round((wins.length / records.length) * 100) : 0;
  const best =
    wins.length === 0
      ? null
      : meta.higherIsBetter
        ? Math.max(...wins.map((r) => r.score))
        : Math.min(...wins.map((r) => r.score));
  const longest = maxStreak(records);
  const recent = [...records].slice(-5).reverse();

  // portal to <body>: the blurred header would otherwise trap this "fixed"
  // overlay inside its own 48px box (backdrop-filter creates a containing block)
  return createPortal(
    <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="panel max-w-sm w-full max-h-full overflow-y-auto">
        <button className="panel-x" aria-label="Close" onClick={onClose}>
          ✕
        </button>
        <h2 className="font-serif text-2xl font-bold text-stone-900 text-center mb-1">
          {meta.name} {meta.emoji}
        </h2>
        <p className="overline text-center mb-4">Your stats</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            ["Days played", String(records.length)],
            ["Completed", `${winPct}%`],
            ["Current streak", `${streak}🔥`],
            ["Longest streak", String(longest)],
          ].map(([lab, val]) => (
            <div key={lab} className="rounded-xl border border-stone-200 bg-stone-900/[0.03] px-3 py-2.5 text-center">
              <span className="block text-[9px] font-semibold tracking-[0.14em] uppercase text-stone-400">
                {lab}
              </span>
              <span className="block text-xl font-bold text-stone-900 tabular-nums">{val}</span>
            </div>
          ))}
        </div>

        {best !== null && (
          <p className="text-center text-sm text-stone-500 mb-4">
            Best daily result:{" "}
            <span className="text-stone-900 font-bold">
              {best.toLocaleString()} {meta.unit}
            </span>
          </p>
        )}

        {recent.length > 0 && (
          <div className="border-t border-stone-200 pt-3">
            <p className="overline mb-2">Recent days</p>
            <ul className="space-y-1.5 text-sm">
              {recent.map((r) => (
                <li key={r.day} className="flex justify-between text-stone-600">
                  <span>{r.day}</span>
                  <span className="font-semibold text-stone-900 tabular-nums">
                    {r.won ? `${r.score.toLocaleString()} ${meta.unit}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {records.length === 0 && (
          <p className="text-center text-sm text-stone-400">
            No games on this device yet — finish today&apos;s challenge and your story starts here.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
