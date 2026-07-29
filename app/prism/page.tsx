"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import PrismGame from "@/games/prism/PrismGame";

export default function PrismPage() {
  return (
    <div className="game-frame">
      <GameHeader gameId="prism" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-2 sm:px-4 flex flex-col">
        <ChallengeBanner render={(v) => `A friend dares you: beat today's PRISM in ${v} mirrors 🪞`} />
        <div className="flex-1 min-h-0">
          <PrismGame />
        </div>
      </main>
    </div>
  );
}
