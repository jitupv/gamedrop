"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import TraceGame from "@/games/trace/TraceGame";

export default function TracePage() {
  return (
    <>
      <GameHeader name="TRACE" />
      <main className="fit-screen mx-auto w-full max-w-5xl px-2 sm:px-4">
        <ChallengeBanner render={(v) => `A friend dares you: beat ${v}% accuracy on today's TRACE ✏️`} />
        <div className="flex-1 min-h-0 flex items-center justify-center py-2">
          <div className="board-wide board-flip">
            <TraceGame />
          </div>
        </div>
      </main>
    </>
  );
}
