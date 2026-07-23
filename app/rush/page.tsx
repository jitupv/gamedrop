"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import RushGame from "@/games/rush/RushGame";

export default function RushPage() {
  return (
    <div className="game-frame">
      <GameHeader gameId="rush" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-0 sm:px-4 flex flex-col">
        <ChallengeBanner render={(v) => `A friend dares you: pass ${v} cars on today's RUSH 🚦`} />
        <div className="flex-1 min-h-0">
          <RushGame />
        </div>
      </main>
    </div>
  );
}
