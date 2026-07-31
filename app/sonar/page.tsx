"use client";

import GameHeader from "@/components/GameHeader";
import SonarGame from "@/games/sonar/SonarGame";

export default function SonarPage() {
  return (
    <div className="game-frame">
      <GameHeader gameId="sonar" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-2 sm:px-4 flex flex-col">
        <div className="flex-1 min-h-0">
          <SonarGame />
        </div>
      </main>
    </div>
  );
}
