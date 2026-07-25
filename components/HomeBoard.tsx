"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faBolt,
  faCrown,
  faTrophy,
  faUsers,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { GameMeta } from "@/lib/games";
import { todayKey } from "@/lib/sdk/daily";
import { Board, fetchBoard, leaderboardEnabled } from "@/lib/sdk/leaderboard";

// The "come beat them" leaderboard, shown as a modal from the hero button.
export default function HomeBoard({
  game,
  accent,
  onClose,
}: {
  game: GameMeta;
  accent: string;
  onClose: () => void;
}) {
  const [board, setBoard] = useState<Board | null | undefined>(undefined);
  const enabled = leaderboardEnabled();

  useEffect(() => {
    if (!leaderboardEnabled()) return;
    let on = true;
    setBoard(undefined);
    fetchBoard(game.id, "daily", todayKey(), game.higherIsBetter, 8).then((b) => {
      if (on) setBoard(b);
    });
    return () => {
      on = false;
    };
  }, [game.id, game.higherIsBetter]);

  const rows = board?.rows ?? [];
  // podium render order: 2nd | 1st | 3rd - champion in the middle, elevated
  const podium = [rows[1], rows[0], rows[2]];
  const podiumClass = ["second", "first", "third"];
  const podiumRank = [2, 1, 3];
  const rest = rows.slice(3);

  return createPortal(
    <div
      className="scrim fixed inset-0 flex items-end justify-center sm:items-center z-50 p-3"
      onClick={onClose}
    >
      <div
        className="hb-modal"
        style={{ "--g": accent } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="hb-close" aria-label="Close" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} width={13} height={13} />
        </button>

        <div className="hb-card">
          <div className="hb-head">
            <span className="hb-live">
              <i className="dot" /> Live · today&apos;s {game.name} board
            </span>
            <span className="hb-sub">
              <FontAwesomeIcon icon={faUsers} width={11} height={11} /> {board?.total ?? 0} playing
            </span>
          </div>

          {!enabled && (
            <div className="hb-empty">
              <FontAwesomeIcon icon={faBolt} width={26} height={26} />
              <h3>The global board is warming up.</h3>
              <p>Coming online soon - your scores are safe on this device meanwhile.</p>
            </div>
          )}

          {enabled && board === undefined && (
            <div className="hb-skel" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
          )}

          {enabled && board !== undefined && rows.length === 0 && (
            <div className="hb-empty">
              <FontAwesomeIcon icon={faBolt} width={26} height={26} />
              <h3>Nobody has cracked today&apos;s {game.name} yet.</h3>
              <p>The board is wide open - the first name on it is remembered all day.</p>
            </div>
          )}

          {enabled && rows.length > 0 && (
            <>
              <div className="hb-podium">
                {podium.map((r, i) =>
                  r ? (
                    <div key={podiumRank[i]} className={`hb-step ${podiumClass[i]}`}>
                      <span className="rank">{["2nd", "1st", "3rd"][i]}</span>
                      <span className="medal">
                        <FontAwesomeIcon icon={podiumRank[i] === 1 ? faCrown : faTrophy} width={14} height={14} />
                      </span>
                      <span className="h">
                        {r.handle}
                        {r.mine ? " (you)" : ""}
                      </span>
                      <span className="s">
                        {r.score.toLocaleString()} {game.unit}
                      </span>
                    </div>
                  ) : (
                    <div key={podiumRank[i]} className={`hb-step empty ${podiumClass[i]}`}>
                      <span className="rank">{["2nd", "1st", "3rd"][i]}</span>
                      <span className="medal">
                        <FontAwesomeIcon icon={faTrophy} width={14} height={14} />
                      </span>
                      <span className="h">unclaimed</span>
                      <span className="s">could be you</span>
                    </div>
                  )
                )}
              </div>

              {rest.length > 0 && (
                <ol className="hb-rows" start={4}>
                  {rest.map((r, i) => (
                    <li key={`${r.handle}-${i}`} className={r.mine ? "mine" : ""}>
                      <span className="rk">{i + 4}</span>
                      <span className="h">
                        {r.handle}
                        {r.mine ? " (you)" : ""}
                      </span>
                      <span className="s">
                        {r.score.toLocaleString()} {game.unit}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </>
          )}

          <div className="hb-foot">
            <span className="hb-note">Same puzzle for everyone · resets at midnight</span>
            <Link href={game.path} className="hb-cta">
              {rows.length === 0 ? "Claim the top spot" : "Beat them"}{" "}
              <FontAwesomeIcon icon={faArrowRight} width={13} height={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
