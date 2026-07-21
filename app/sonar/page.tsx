"use client";

import ChallengeBanner from "@/components/ChallengeBanner";
import GameHeader from "@/components/GameHeader";
import SonarGame from "@/games/sonar/SonarGame";

export default function SonarPage() {
  return (
    <>
      <GameHeader name="SONAR" />
      <main className="fit-screen mx-auto w-full max-w-5xl px-0 sm:px-4">
        <ChallengeBanner render={(v) => `A friend dares you: escape today's mazes in under ${v} pings 🔦`} />
        <div className="flex-1 min-h-0">
          <SonarGame />
        </div>
      </main>
    </>
  );
}
