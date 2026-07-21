"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dayNumber } from "@/lib/sdk/daily";

// In-game header: the game takes over the top bar — back arrow, game name, day chip.
export default function GameHeader({ name }: { name: string }) {
  const [num, setNum] = useState<number | null>(null);
  useEffect(() => setNum(dayNumber()), []);

  return (
    <header className="header-glass sticky top-0 z-30 border-b border-stone-300/70">
      <div className="mx-auto max-w-5xl px-3 h-12 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Back to GAMEDROP"
          className="w-9 h-9 flex items-center justify-center rounded-full border border-stone-300 bg-[var(--surface)] text-stone-700 text-lg hover:bg-stone-100 transition"
        >
          ←
        </Link>
        <span className="font-serif text-xl font-bold text-stone-900 tracking-wide">{name}</span>
        <span className="overline w-9 text-right">{num !== null ? `#${num}` : ""}</span>
      </div>
    </header>
  );
}
