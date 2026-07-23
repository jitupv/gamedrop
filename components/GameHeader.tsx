"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GAMES } from "@/lib/games";
import { dayNumber } from "@/lib/sdk/daily";
import { isMuted, setMuted } from "@/lib/sdk/sound";
import StatsModal from "./StatsModal";

// In-game header: dark ink chrome — the game takes over the top bar.
export default function GameHeader({ gameId }: { gameId: string }) {
  const [num, setNum] = useState<number | null>(null);
  const [muted, setMutedState] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const name = GAMES.find((g) => g.id === gameId)?.name ?? gameId.toUpperCase();

  useEffect(() => {
    setNum(dayNumber());
    setMutedState(isMuted());
  }, []);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  return (
    <header className="game-header shrink-0 z-30">
      <div className="mx-auto max-w-5xl px-3 h-12 flex items-center justify-between">
        <div className="flex items-center gap-2 w-24">
          <Link
            href="/"
            aria-label="Back to GAMEDROP"
            className="gh-back w-9 h-9 flex items-center justify-center rounded-full text-lg transition"
          >
            ←
          </Link>
        </div>
        <span className="gh-name font-serif text-xl font-bold tracking-wide">{name}</span>
        <div className="flex items-center gap-2 w-24 justify-end">
          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            className="gh-back w-9 h-9 flex items-center justify-center rounded-full text-sm transition"
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button
            onClick={() => setShowStats(true)}
            aria-label="Your stats"
            className="gh-back w-9 h-9 flex items-center justify-center rounded-full text-sm transition"
          >
            ▦
          </button>
          <span className="gh-chip text-[10px] font-bold tracking-[0.18em]">
            {num !== null ? `#${num}` : ""}
          </span>
        </div>
      </div>
      {showStats && <StatsModal gameId={gameId} onClose={() => setShowStats(false)} />}
    </header>
  );
}
