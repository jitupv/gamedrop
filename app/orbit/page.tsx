"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChallengeBanner from "@/components/ChallengeBanner";
import OrbitGame from "@/games/orbit/OrbitGame";
import { dayNumber } from "@/lib/sdk/daily";

export default function OrbitPage() {
  const [num, setNum] = useState<number | null>(null);
  useEffect(() => setNum(dayNumber()), []);

  return (
    <main className="fit-screen mx-auto w-full max-w-5xl px-4">
      <div className="text-center pt-4 pb-2 shrink-0">
        <p className="overline">
          From the vault{num !== null ? ` · daily challenge #${num}` : ""}
        </p>
        <h1 className="font-serif text-3xl font-bold text-stone-900 leading-tight">ORBIT</h1>
      </div>

      <ChallengeBanner render={(v) => `A friend dares you: finish today's ORBIT in under ${v} launches 🪐`} />

      <div className="flex-1 min-h-0 flex items-center justify-center py-1">
        <div className="board-wide board-flip">
          <div className="card p-3 sm:p-4">
            <OrbitGame />
          </div>
        </div>
      </div>

      <div className="shrink-0 py-3 text-center text-xs text-stone-400">
        <Link href="/" className="text-stone-700 font-semibold underline-offset-2 hover:underline">
          ← Back to this week&apos;s game: TILT 🍬
        </Link>
      </div>
    </main>
  );
}
