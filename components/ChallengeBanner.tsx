"use client";

import { useEffect, useState } from "react";

// shows when the page was opened from a "beat me" share link (?beat=<score>)
export default function ChallengeBanner({ render }: { render: (value: string) => string }) {
  const [value, setValue] = useState<string | null>(null);

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("beat");
    if (v && v.length <= 12) setValue(v);
  }, []);

  if (!value) return null;
  return <div className="challenge-banner">🎯 {render(value)}</div>;
}
