"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { dayNumber } from "@/lib/sdk/daily";

// In-game header: dark ink chrome — the game takes over the top bar.
export default function GameHeader({ name }: { name: string }) {
  const [num, setNum] = useState<number | null>(null);
  useEffect(() => setNum(dayNumber()), []);

  return (
    <header className="game-header shrink-0 z-30">
      <div className="mx-auto max-w-5xl px-3 h-12 flex items-center justify-between">
        <Link
          href="/"
          aria-label="Back to GAMEDROP"
          className="gh-back w-9 h-9 flex items-center justify-center rounded-full text-lg transition"
        >
          ←
        </Link>
        <span className="gh-name font-serif text-xl font-bold tracking-wide">{name}</span>
        <span className="gh-chip text-[10px] font-bold tracking-[0.18em] w-9 text-right">
          {num !== null ? `#${num}` : ""}
        </span>
      </div>
    </header>
  );
}
