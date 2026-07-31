"use client";

import GameHeader from "@/components/GameHeader";
import TraceGame from "@/games/trace/TraceGame";

export default function TracePage() {
  return (
    <div className="game-frame">
      <GameHeader gameId="trace" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-2 sm:px-4 flex flex-col">
        <div className="flex-1 min-h-0">
          <TraceGame />
        </div>
      </main>
    </div>
  );
}
