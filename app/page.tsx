"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import TiltGame from "@/games/tilt/TiltGame";
import Countdown from "@/components/Countdown";
import { dayNumber } from "@/lib/sdk/daily";

export default function Home() {
  const [num, setNum] = useState<number | null>(null);
  useEffect(() => setNum(dayNumber()), []);

  return (
    <main className="fit-screen mx-auto w-full max-w-5xl px-4">
      <div className="text-center pt-4 pb-2 shrink-0">
        <p className="overline">
          This week&apos;s game{num !== null ? ` · daily challenge #${num}` : ""}
        </p>
        <h1 className="font-serif text-3xl font-bold text-stone-900 leading-tight">TILT</h1>
      </div>

      <div className="flex-1 min-h-0 flex items-center justify-center py-1">
        <div className="board-square">
          <div className="card p-3 sm:p-4">
            <TiltGame />
          </div>
        </div>
      </div>

      <div className="shrink-0 py-3 text-center text-xs text-stone-400">
        <Countdown prefix="New challenge in" /> · next drop{" "}
        <span className="text-amber-700 font-semibold">Friday</span> ·{" "}
        <Link href="/vault" className="text-stone-700 font-semibold underline-offset-2 hover:underline">
          The Vault →
        </Link>
      </div>
    </main>
  );
}
