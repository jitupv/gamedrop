"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/sdk/analytics";

// shows when the page was opened from a "beat me" share link (?beat=<score>)
export default function ChallengeBanner({ render }: { render: (value: string) => string }) {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("beat");
    if (v && v.length <= 12) {
      setValue(v);
      track("challenge_link_arrived", { path: window.location.pathname });
    }
  }, []);

  if (!value) return null;
  return <div className="challenge-banner">🎯 {render(value)}</div>;
}
