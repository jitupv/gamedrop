import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "GAMEDROP — a brand-new game every Friday";

// the card WhatsApp/X/iMessage render when a gamedrop link is shared
export default function OpengraphImage() {
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
          background: "#f4efe6",
          color: "#1c1917",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, letterSpacing: 14, fontWeight: 700 }}>
          GAME<span style={{ color: "#b45309" }}>DROP</span>
        </div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 700, marginTop: 28 }}>
          A brand-new game
        </div>
        <div style={{ display: "flex", fontSize: 92, fontWeight: 700 }}>every Friday.</div>
        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 30,
            color: "#78716c",
            fontFamily: "sans-serif",
          }}
        >
          🍬 🪐 🔦 💎 🚦 ✏️ — six originals · a fresh challenge every midnight
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 44,
            background: "#1c1917",
            color: "#faf6ee",
            borderRadius: 999,
            padding: "16px 44px",
            fontSize: 28,
            fontFamily: "sans-serif",
            fontWeight: 600,
          }}
        >
          Play today&apos;s free →
        </div>
      </div>
    ),
    size
  );
}
