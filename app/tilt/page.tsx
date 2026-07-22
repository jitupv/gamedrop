"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import TiltGame from "@/games/tilt/TiltGame";

export default function TiltPage() {
  return (
    <div className="game-frame">
      <GameHeader name="TILT" />
      <main className="flex-1 min-h-0 mx-auto w-full max-w-5xl px-0 sm:px-4 flex flex-col">
        <ChallengeBanner render={(v) => `A friend dares you: beat ${v} points on today's TILT 🍬`} />
        <div className="flex-1 min-h-0">
          <TiltGame />
        </div>
      </main>
    </div>
  );
}
