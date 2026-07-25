import { ImageResponse } from "next/og";
import { SITE_DOMAIN, SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} - ${SITE_TAGLINE}`;

// The card WhatsApp / X / iMessage / Slack render when a Jeetle link is shared.
// Dark "game mode" look to match the site: gold accent, a soft drop-glow behind the
// wordmark, and a spectrum stripe of the game colors as a signature (no game count,
// so it never goes stale as the catalog grows).
export default function OpengraphImage() {
  const accents = ["#3fd6c0", "#9d8cff", "#ff6f61", "#3fbf7f", "#ffa23e", "#6fa8ff"];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          background:
            "radial-gradient(760px 520px at 78% 22%, rgba(230,194,107,0.16), transparent 60%)," +
            "radial-gradient(620px 460px at 16% 92%, rgba(63,214,192,0.10), transparent 60%)," +
            "linear-gradient(160deg, #181b22, #0e1014)",
          color: "#eef0f5",
          fontFamily: "sans-serif",
        }}
      >
        {/* eyebrow */}
        <div
          style={{
            display: "flex",
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 8,
            color: "#e6c26b",
            textTransform: "uppercase",
          }}
        >
          A fresh challenge every midnight
        </div>

        {/* wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: 20,
            fontSize: 156,
            fontWeight: 900,
            letterSpacing: -6,
          }}
        >
          {SITE_NAME}<span style={{ color: "#e6c26b" }}>.</span>
        </div>

        {/* tagline */}
        <div
          style={{
            display: "flex",
            marginTop: 8,
            fontSize: 36,
            fontWeight: 500,
            color: "rgba(238,240,245,0.72)",
          }}
        >
          A fresh daily challenge in every game.
        </div>

        {/* chips */}
        <div style={{ display: "flex", gap: 14, marginTop: 40 }}>
          {["2-4 min", "Free", "No download"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                fontSize: 24,
                fontWeight: 600,
                color: "rgba(238,240,245,0.66)",
                border: "1px solid rgba(238,240,245,0.22)",
                borderRadius: 999,
                padding: "9px 22px",
              }}
            >
              {t}
            </div>
          ))}
        </div>

        {/* the domain - this card travels to people who have never seen the site */}
        <div
          style={{
            display: "flex",
            position: "absolute",
            bottom: 44,
            right: 64,
            fontSize: 30,
            fontWeight: 800,
            color: "#e6c26b",
          }}
        >
          {SITE_DOMAIN}
        </div>

        {/* spectrum signature stripe along the bottom */}
        <div style={{ display: "flex", position: "absolute", bottom: 0, left: 0, right: 0 }}>
          {accents.map((c) => (
            <div key={c} style={{ display: "flex", flex: 1, height: 12, background: c }} />
          ))}
        </div>
      </div>
    ),
    size
  );
}
