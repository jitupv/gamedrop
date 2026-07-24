"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import HeistGame from "@/games/heist/HeistGame";

export default function HeistPage() {
  return (
    <div className="game-frame">
      <GameHeader gameId="heist" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-2 sm:px-4 flex flex-col">
        <ChallengeBanner render={(v) => `A friend dares you: pull today's heists in under ${v} plans 💎`} />
        <div className="flex-1 min-h-0">
          <HeistGame />
        </div>
      </main>
    </div>
  );
}
