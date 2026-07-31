"use client";

import GameHeader from "@/components/GameHeader";
import HeistGame from "@/games/heist/HeistGame";

export default function HeistPage() {
  return (
    <div className="game-frame">
      <GameHeader gameId="heist" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-2 sm:px-4 flex flex-col">
        <div className="flex-1 min-h-0">
          <HeistGame />
        </div>
      </main>
    </div>
  );
}
