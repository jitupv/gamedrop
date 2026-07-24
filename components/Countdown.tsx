"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

// live ticker to the next local midnight — the daily reset moment
export default function Countdown({ prefix = "New challenge in" }: { prefix?: string }) {
  const [left, setLeft] = useState("--:--:--");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const ms = midnight.getTime() - now.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${h}:${pad(m)}:${pad(s)}`);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <span className="tabular-nums">
      {prefix} <span className="font-semibold tx-ink">{left}</span>
    </span>
  );
}
