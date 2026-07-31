"use client";

import GameHeader from "@/components/GameHeader";
import TiltGame from "@/games/tilt/TiltGame";

export default function TiltPage() {
  return (
    <div className="game-frame">
      <GameHeader gameId="tilt" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-2 sm:px-4 flex flex-col">
        <div className="flex-1 min-h-0">
          <TiltGame />
        </div>
      </main>
    </div>
  );
}
