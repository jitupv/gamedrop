"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import RushGame from "@/games/rush/RushGame";

export default function RushPage() {
  return (
    <>
      <GameHeader name="RUSH" />
      <main className="fit-screen mx-auto w-full max-w-5xl px-0 sm:px-4">
        <ChallengeBanner render={(v) => `A friend dares you: pass ${v} cars on today's RUSH 🚦`} />
        <div className="flex-1 min-h-0">
          <RushGame />
        </div>
      </main>
    </>
  );
}
