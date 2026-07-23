"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import OrbitGame from "@/games/orbit/OrbitGame";

export default function OrbitPage() {
  return (
    <div className="game-frame">
      <GameHeader gameId="orbit" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-0 sm:px-4 flex flex-col">
        <ChallengeBanner render={(v) => `A friend dares you: finish today's ORBIT in under ${v} launches 🪐`} />
        <div className="flex-1 min-h-0">
          <OrbitGame />
        </div>
      </main>
    </div>
  );
}
