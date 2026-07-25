"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/sdk/analytics";
import { todayKey } from "@/lib/sdk/daily";

// One-tap "how was today's puzzle?" - the per-game daily quality signal.
// Fires a single PostHog event; remembers the answer per game per day on-device.
// `quiet`: once rated, render nothing at all - for screens the player sees
// many times a day (e.g. RUSH's crash panel), where a lingering "thanks" nags.
export default function PuzzleRating({ game, quiet }: { game: string; quiet?: boolean }) {
  const [rated, setRated] = useState(false);

  useEffect(() => {
    try {
      setRated(!!window.localStorage.getItem(`gd:rating:${game}:${todayKey()}`));
    } catch {}
  }, [game]);

  const rate = (rating: 1 | 2 | 3) => {
    if (rated) return;
    track("daily_rated", { game, day: todayKey(), rating });
    try {
      window.localStorage.setItem(`gd:rating:${game}:${todayKey()}`, String(rating));
    } catch {}
    setRated(true);
  };

  if (rated && quiet) return null;

  return (
    <div className="mt-4">
      {rated ? (
        <p className="text-xs tx-soft">Thanks - tomorrow&apos;s puzzle gets better for it 🙌</p>
      ) : (
        <div className="flex items-center justify-center gap-2">
          <span className="text-xs tx-soft">Today&apos;s puzzle?</span>
          {([
            [1, "😩"],
            [2, "😐"],
            [3, "🤩"],
          ] as const).map(([v, e]) => (
            <button
              key={v}
              type="button"
              aria-label={`Rate today's puzzle ${v} of 3`}
              className="text-xl leading-none p-1 rounded-lg hover:scale-125 transition-transform"
              onClick={() => rate(v)}
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
