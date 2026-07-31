"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft, faChartColumn, faVolumeHigh, faVolumeXmark } from "@fortawesome/free-solid-svg-icons";
import { GAMES } from "@/lib/games";
import { challengeNumber } from "@/lib/sdk/daily";
import { isMuted, setMuted } from "@/lib/sdk/sound";
import StatsModal from "./StatsModal";
import ThemeToggle from "./ThemeToggle";
import { weekKey } from "@/lib/sdk/weekly";

// In-game header: same glass chrome as the homepage, flips with the theme.
export default function GameHeader({ gameId }: { gameId: string }) {
  const [num, setNum] = useState<number | null>(null);
  const [muted, setMutedState] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const loadedWeekRef = useRef(weekKey());
  const name = GAMES.find((g) => g.id === gameId)?.name ?? gameId.toUpperCase();
  const levelGame =
    gameId === "prism" ||
    gameId === "tilt" ||
    gameId === "heist" ||
    gameId === "sonar" ||
    gameId === "rush" ||
    gameId === "trace";

  useEffect(() => {
    if (!levelGame) {
      setNum(challengeNumber(gameId));
    }
    setMutedState(isMuted());
  }, [gameId, levelGame]);

  useEffect(() => {
    if (!levelGame) return;
    const timer = window.setInterval(() => {
      if (weekKey() !== loadedWeekRef.current) window.location.reload();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [levelGame]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <header className="game-header shrink-0 z-30">
      <div className="mx-auto max-w-5xl px-3 h-12 flex items-center justify-between">
        <div className="flex items-center gap-1.5 w-28">
          <Link
            href="/"
            aria-label="Back to JEETLE"
            className="gh-back w-8 h-8 flex items-center justify-center rounded-full text-[13px] transition"
          >
            <FontAwesomeIcon icon={faArrowLeft} width={13} height={13} />
          </Link>
          <ThemeToggle />
        </div>
        <span className="gh-name text-lg font-extrabold">{name}</span>
        <div className="flex items-center gap-1.5 w-28 justify-end">
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            aria-pressed={muted}
            className="gh-back w-8 h-8 flex items-center justify-center rounded-full text-[13px] transition"
          >
            <FontAwesomeIcon icon={muted ? faVolumeXmark : faVolumeHigh} width={14} height={14} />
          </button>
          <button
            onClick={() => setShowStats(true)}
            aria-label="Your stats"
            className="gh-back w-8 h-8 flex items-center justify-center rounded-full text-[13px] transition"
          >
            <FontAwesomeIcon icon={faChartColumn} width={13} height={13} />
          </button>
          {!levelGame && num !== null && (
            <span className="gh-chip text-[10px] font-bold tracking-[0.14em] tabular-nums">
              #{String(num).padStart(2, "0")}
            </span>
          )}
        </div>
      </div>
      {showStats && <StatsModal gameId={gameId} onClose={() => setShowStats(false)} />}
    </header>
  );
}
