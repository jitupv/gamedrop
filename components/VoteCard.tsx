"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { track } from "@/lib/sdk/analytics";

// "You pick the next drop" - one-tap vote between three candidates from the
// 40-game roadmap. One vote per device per round; results live in PostHog.
// When a round is settled, bump VOTE_ROUND and swap the OPTIONS.
const VOTE_ROUND = "drop08";
const OPTIONS: { id: string; emoji: string; name: string; pitch: string }[] = [
  { id: "prism", emoji: "🔦", name: "PRISM", pitch: "Bend lasers with mirrors" },
  { id: "sums", emoji: "🔢", name: "SUMS", pitch: "Hit the target number" },
  { id: "untangle", emoji: "🕸️", name: "UNTANGLE", pitch: "Unknot the web" },
];

export default function VoteCard() {
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPicked(window.localStorage.getItem(`gd:vote:${VOTE_ROUND}`));
    } catch {}
  }, []);

  const vote = (id: string) => {
    if (picked) return;
    track("drop_vote", { round: VOTE_ROUND, choice: id });
    try {
      window.localStorage.setItem(`gd:vote:${VOTE_ROUND}`, id);
    } catch {}
    setPicked(id);
  };

  return (
    <section className="hm-next hm-wrap">
      <div className="hm-next-card">
        <div className="hm-next-body">
          <span className="k">After that · you decide</span>
          <h3>{picked ? "Locked in." : "Which game should we build next?"}</h3>
          {picked ? (
            <p>
              Your vote is counted - player votes steer what gets built. Watch the workshop for
              the winner.
            </p>
          ) : (
            <p>One tap. The winner joins the build queue.</p>
          )}
          <div className="hm-votes">
            {OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className="btn-line px-4 py-2"
                disabled={!!picked}
                // flex strips inter-text whitespace, so spacing comes from gap
                style={{ gap: 6, ...(picked && picked !== o.id ? { opacity: 0.45 } : {}) }}
                onClick={() => vote(o.id)}
              >
                <span aria-hidden="true">{o.emoji}</span> {o.name}
                {picked === o.id ? (
                  <>
                    {" "}
                    <FontAwesomeIcon icon={faCheck} width={11} height={11} />
                  </>
                ) : (
                  <span className="tx-soft"> · {o.pitch}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
