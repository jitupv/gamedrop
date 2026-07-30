// Shared renderer behind every per-game `app/<id>/opengraph-image.tsx`.
// Without a game-specific file, Next.js falls back to the nearest ancestor
// opengraph-image (the homepage's), which is why every game link used to
// preview with the homepage banner - each game route needs its own file, but
// they all share this one drawing routine so the look stays consistent.
import { ImageResponse } from "next/og";
import { GAMES } from "./games";
import { GAME_CONTENT } from "./gameContent";
import { SITE_DOMAIN, SITE_NAME } from "./site";

export const ogImageSize = { width: 1200, height: 630 };
export const ogImageContentType = "image/png";

export function gameOgAlt(gameId: string): string {
  const meta = GAMES.find((g) => g.id === gameId);
  return meta ? `${meta.name} - ${meta.tagline}` : SITE_NAME;
}

export function gameOgImage(gameId: string) {
  const meta = GAMES.find((g) => g.id === gameId);
  const content = GAME_CONTENT[gameId];
  const accent = meta?.accent ?? "#e6c26b";
  const name = meta?.name ?? gameId.toUpperCase();
  const tagline = meta?.tagline ?? "";
  const genre = content?.genre ?? "";

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
            `radial-gradient(760px 520px at 78% 22%, ${accent}29, transparent 60%),` +
            `radial-gradient(620px 460px at 16% 92%, ${accent}1a, transparent 60%),` +
            "linear-gradient(160deg, #181b22, #0e1014)",
          color: "#eef0f5",
          fontFamily: "sans-serif",
        }}
      >
        {/* brand, small - the game is the star of this card, not the site */}
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: 2,
            color: "rgba(238,240,245,0.5)",
          }}
        >
          {SITE_NAME}
        </div>

        {/* genre eyebrow */}
        {genre && (
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 8,
              color: accent,
              textTransform: "uppercase",
            }}
          >
            {genre}
          </div>
        )}

        {/* the game's own wordmark - giant, matching the in-app hero treatment */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            marginTop: 16,
            fontSize: 156,
            fontWeight: 900,
            letterSpacing: -6,
          }}
        >
          {name}
          <span style={{ color: accent }}>.</span>
        </div>

        {/* tagline */}
        <div
          style={{
            display: "flex",
            marginTop: 8,
            fontSize: 34,
            fontWeight: 500,
            color: "rgba(238,240,245,0.72)",
            maxWidth: 900,
            textAlign: "center",
          }}
        >
          {tagline}
        </div>

        {/* chips */}
        <div style={{ display: "flex", gap: 14, marginTop: 40 }}>
          {["Daily challenge", "Free", "No download"].map((t) => (
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
            color: accent,
          }}
        >
          {SITE_DOMAIN}
        </div>

        {/* a single solid accent bar - one game, one color, unlike the
            homepage card's multi-color "we have many games" spectrum stripe */}
        <div
          style={{ display: "flex", position: "absolute", bottom: 0, left: 0, right: 0, height: 12, background: accent }}
        />
      </div>
    ),
    ogImageSize
  );
}
