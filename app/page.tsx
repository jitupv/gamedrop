"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Countdown from "@/components/Countdown";
import { GAMES } from "@/lib/games";
import { dayNumber } from "@/lib/sdk/daily";

const TODAY_ID = "tilt"; // this week's featured drop

export default function Home() {
  const [num, setNum] = useState<number | null>(null);
  useEffect(() => setNum(dayNumber()), []);

  const today = GAMES.find((g) => g.id === TODAY_ID)!;
  const vault = GAMES.filter((g) => g.id !== TODAY_ID);

  return (
    <>
      <header className="header-glass sticky top-0 z-30 border-b border-stone-300/70">
        <div className="mx-auto max-w-5xl px-4 h-12 flex items-center justify-center">
          <span className="text-lg font-black tracking-[0.25em] text-stone-900">
            GAME<span className="text-amber-700">DROP</span>
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-8 pb-16">
        <div className="text-center mb-8">
          <p className="overline mb-2">
            {num !== null ? `Daily challenge #${num} · ` : ""}new game every Friday
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900 leading-tight">
            One brand-new game,
            <br />
            every Friday.
          </h1>
          <p className="text-sm sm:text-base text-stone-500 mt-3 max-w-md mx-auto leading-relaxed">
            Same challenge for everyone, fresh at midnight. Beat it, brag about it, come back
            tomorrow.
          </p>
        </div>

        {/* today's drop */}
        <Link
          href={today.path}
          className="card lift block max-w-md mx-auto p-6 text-center border-amber-700/25"
        >
          <p className="overline mb-3">This week&apos;s game</p>
          <div className="text-5xl mb-2">{today.emoji}</div>
          <h2 className="font-serif text-3xl font-bold text-stone-900">{today.name}</h2>
          <p className="text-sm text-stone-500 mt-1 mb-5">{today.tagline}</p>
          <span className="btn-ink px-8 py-3 text-base">Play today&apos;s challenge →</span>
          <p className="text-xs text-stone-400 mt-4">
            <Countdown prefix="Next challenge in" />
          </p>
        </Link>

        {/* the vault */}
        <div className="mt-12">
          <div className="rule-ornament max-w-xs mx-auto mb-6">◆</div>
          <h3 className="font-serif text-2xl font-bold text-stone-900 text-center mb-6">The Vault</h3>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-3 max-w-2xl mx-auto">
            {vault.map((g) =>
              g.status === "live" ? (
                <Link key={g.id} href={g.path} className="card lift p-4 text-center">
                  <div className="text-3xl mb-1">{g.emoji}</div>
                  <h4 className="font-serif text-lg font-bold text-stone-900">{g.name}</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{g.tagline}</p>
                  <span className="inline-block mt-3 text-xs font-semibold text-stone-900">
                    Play →
                  </span>
                </Link>
              ) : (
                <div key={g.id} className="card p-4 text-center opacity-60">
                  <div className="text-3xl mb-1">{g.emoji}</div>
                  <h4 className="font-serif text-lg font-bold text-stone-900">{g.name}</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5 leading-snug">{g.tagline}</p>
                  <span className="inline-block mt-3 text-xs text-stone-400">Dropping soon</span>
                </div>
              )
            )}
          </div>
        </div>

        <p className="mt-12 text-center text-xs text-stone-400">
          Every game: a daily challenge (same for everyone) + an endless mode with no bottom.
          <br />
          Free to play · streaks & records saved on your device
        </p>
      </main>
    </>
  );
}
