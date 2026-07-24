"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFire, faGlobe, faXmark } from "@fortawesome/free-solid-svg-icons";
import { GAMES } from "@/lib/games";
import { todayKey } from "@/lib/sdk/daily";
import { DayRecord, getAllResults, getStreak, maxStreak } from "@/lib/sdk/storage";
import { Board, fetchBoard, leaderboardEnabled } from "@/lib/sdk/leaderboard";

// Your story with this game — the Wordle stats moment — plus the global board.
export default function StatsModal({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const meta = GAMES.find((g) => g.id === gameId);
  const [records, setRecords] = useState<DayRecord[]>([]);
  const [streak, setStreak] = useState(0);
  const [boardMode, setBoardMode] = useState<"daily" | "endless">("daily");
  // undefined = loading, null = fetch failed
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  const enabled = leaderboardEnabled();

  useEffect(() => {
    setRecords(getAllResults(gameId));
    setStreak(getStreak(gameId, todayKey()));
  }, [gameId]);

  const higherIsBetter = meta?.higherIsBetter ?? false;

  useEffect(() => {
    if (!leaderboardEnabled()) return;
    let on = true;
    setBoard(undefined);
    const daily = boardMode === "daily";
    fetchBoard(gameId, boardMode, daily ? todayKey() : "all", daily ? higherIsBetter : true).then(
      (b) => {
        if (on) setBoard(b);
      }
    );
    return () => {
      on = false;
    };
  }, [gameId, boardMode, higherIsBetter]);

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
  const pct =
    board?.myRank && board.total > 0 ? Math.max(1, Math.ceil((board.myRank / board.total) * 100)) : null;

  // portal to <body>: the blurred header would otherwise trap this "fixed"
  // overlay inside its own 48px box (backdrop-filter creates a containing block)
  return createPortal(
    <div className="scrim fixed inset-0 flex items-center justify-center z-50 p-4">
      <div className="panel max-w-sm w-full max-h-full overflow-y-auto">
        <button className="panel-x" aria-label="Close" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} width={12} height={12} />
        </button>
        <h2 className="text-2xl font-extrabold tracking-tight tx-ink text-center mb-1">
          {meta.name} {meta.emoji}
        </h2>
        <p className="overline text-center mb-4">Your stats</p>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="metric">
            <span className="lab">Days played</span>
            <span className="num">{records.length}</span>
          </div>
          <div className="metric">
            <span className="lab">Completed</span>
            <span className="num">{winPct}%</span>
          </div>
          <div className="metric">
            <span className="lab">Current streak</span>
            <span className="num">
              {streak}
              <FontAwesomeIcon icon={faFire} className="fa-mini" width={13} height={13} />
            </span>
          </div>
          <div className="metric">
            <span className="lab">Longest streak</span>
            <span className="num">{longest}</span>
          </div>
        </div>

        {best !== null && (
          <p className="text-center text-sm tx-muted mb-4">
            Best daily result:{" "}
            <span className="tx-ink font-bold">
              {best.toLocaleString()} {meta.unit}
            </span>
          </p>
        )}

        {/* ---- global leaderboard (always visible — states explain themselves) ---- */}
        <div className="lb">
          <div className="lb-head">
            <span className="overline">
              <FontAwesomeIcon icon={faGlobe} width={10} height={10} /> Global board
            </span>
            {enabled && (
              <div className="lb-tabs">
                <button
                  type="button"
                  className={boardMode === "daily" ? "on" : ""}
                  onClick={() => setBoardMode("daily")}
                >
                  Today
                </button>
                <button
                  type="button"
                  className={boardMode === "endless" ? "on" : ""}
                  onClick={() => setBoardMode("endless")}
                >
                  Endless
                </button>
              </div>
            )}
          </div>

          {!enabled && (
            <p className="lb-note">
              The global leaderboard is warming up — coming online soon. Your scores are safe on
              this device.
            </p>
          )}
          {enabled && board === undefined && <p className="lb-note">Loading the board…</p>}
          {enabled && board === null && (
            <p className="lb-note">Couldn&apos;t load the board — check your connection.</p>
          )}
          {enabled && board && board.rows.length === 0 && (
            <p className="lb-note">No scores yet — be the first in the world!</p>
          )}
          {enabled && board && board.rows.length > 0 && (
              <>
                <ol className="lb-rows">
                  {board.rows.map((r, i) => (
                    <li key={`${r.handle}-${i}`} className={r.mine ? "mine" : ""}>
                      <span className="rk">{i + 1}</span>
                      <span className="hd">{r.handle}</span>
                      <span className="sc">
                        {r.score.toLocaleString()}
                        {boardMode === "daily" ? ` ${meta.unit}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
                {board.myRank && (
                  <p className="lb-you">
                    You: <b>#{board.myRank}</b> of {board.total.toLocaleString()}
                    {pct !== null && pct <= 50 && (
                      <>
                        {" "}
                        · top <b>{pct}%</b>
                      </>
                    )}
                  </p>
                )}
              </>
            )}
          </div>

        {recent.length > 0 && (
          <div className="border-t pt-3 mt-4" style={{ borderColor: "var(--line)" }}>
            <p className="overline mb-2">Recent days</p>
            <ul className="space-y-1.5 text-sm">
              {recent.map((r) => (
                <li key={r.day} className="flex justify-between tx-muted">
                  <span>{r.day}</span>
                  <span className="font-semibold tx-ink tabular-nums">
                    {r.won ? `${r.score.toLocaleString()} ${meta.unit}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {records.length === 0 && (
          <p className="text-center text-sm tx-soft mt-2">
            No games on this device yet — finish today&apos;s challenge and your story starts here.
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
