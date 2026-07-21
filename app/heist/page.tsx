"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import HeistGame from "@/games/heist/HeistGame";

export default function HeistPage() {
  return (
    <>
      <GameHeader name="HEIST" />
      <main className="fit-screen mx-auto w-full max-w-5xl px-2 sm:px-4">
        <ChallengeBanner render={(v) => `A friend dares you: pull today's heists in under ${v} plans 💎`} />
        <div className="flex-1 min-h-0 flex items-center justify-center py-2">
          <div className="board-wide">
            <HeistGame />
          </div>
        </div>
      </main>
    </>
  );
}
