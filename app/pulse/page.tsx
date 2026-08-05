"use client";

import GameHeader from "@/components/GameHeader";
import PulseGame from "@/games/pulse/PulseGame";

export default function PulsePage() {
  return (
    <div className="game-frame">
      <GameHeader gameId="pulse" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-2 sm:px-4 flex flex-col">
        <div className="flex-1 min-h-0"><PulseGame /></div>
      </main>
    </div>
  );
}
