"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import TiltGame from "@/games/tilt/TiltGame";

export default function TiltPage() {
  return (
    <>
      <GameHeader name="TILT" />
      <main className="fit-screen mx-auto w-full max-w-5xl px-2 sm:px-4">
        <ChallengeBanner render={(v) => `A friend dares you: beat ${v} points on today's TILT 🍬`} />
        <div className="flex-1 min-h-0 flex items-center justify-center py-2">
          <div className="board-square">
            <TiltGame />
          </div>
        </div>
      </main>
    </>
  );
}
