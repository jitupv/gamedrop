"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import SonarGame from "@/games/sonar/SonarGame";

export default function SonarPage() {
  return (
    <div className="game-frame">
      <GameHeader gameId="sonar" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-2 sm:px-4 flex flex-col">
        <ChallengeBanner render={(v) => `A friend dares you: escape today's mazes in under ${v} pings 🔦`} />
        <div className="flex-1 min-h-0">
          <SonarGame />
        </div>
      </main>
    </div>
  );
}
