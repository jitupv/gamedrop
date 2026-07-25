"use client";

import { useEffect, useState } from "react";
import { track } from "@/lib/sdk/analytics";
import { joinDropList, leaderboardEnabled } from "@/lib/sdk/leaderboard";

// "Tell me when the next game drops" - a one-field email capture.
// The list lives in Supabase (drop_signups); hidden entirely if Supabase is off.
export default function NotifyMe() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  useEffect(() => {
    try {
      if (window.localStorage.getItem("gd:notify")) setState("done");
    } catch {}
  }, []);

  if (!leaderboardEnabled()) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (state === "busy" || state === "done") return;
    setState("busy");
    const ok = await joinDropList(email);
    if (ok) {
      track("notify_signup");
      try {
        window.localStorage.setItem("gd:notify", "1");
      } catch {}
      setState("done");
    } else {
      setState("error");
    }
  };

  if (state === "done") {
    return <p className="text-xs tx-soft mt-3">You&apos;re on the list - we&apos;ll ping you at the next drop. 🔔</p>;
  }

  return (
    <form onSubmit={submit} className="hm-notify mt-3" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <input
        type="email"
        required
        value={email}
        placeholder="you@email.com"
        aria-label="Email for new-drop alerts"
        onChange={(e) => {
          setEmail(e.target.value);
          if (state === "error") setState("idle");
        }}
        className="btn-line px-4 py-2"
        style={{ minWidth: 190, flex: "1 1 auto" }}
      />
      <button type="submit" className="btn-ink px-5 py-2" disabled={state === "busy"}>
        {state === "busy" ? "..." : "Notify me"}
      </button>
      {state === "error" && (
        <p className="text-xs tx-soft" style={{ width: "100%" }}>
          That didn&apos;t go through - check the email and try again.
        </p>
      )}
    </form>
  );
}
