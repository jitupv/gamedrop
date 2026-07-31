// One place that turns "I just cleared level N of <game>" into a share.
// Every level game needs the same thing, so none of them assembles a card of
// its own - they hand over a game id and a level number and this reads the rest
// (name, glyph, accent) from the GAMES registry.
import { GAMES } from "../games";
import { ShareOutcome, buildShare, challengeUrl, shareResult } from "./share";
import { weekLabel } from "./weekly";

export async function shareLevel(gameId: string, level: number): Promise<ShareOutcome> {
  const meta = GAMES.find((g) => g.id === gameId);
  const name = meta?.name ?? gameId.toUpperCase();
  const headline = `level ${level}`;
  const lines = [`📍 reached ${headline}`, `🗓️ ${weekLabel()}`];

  const text = buildShare(name, level, lines, challengeUrl(level));
  return shareResult(text, {
    game: name,
    num: level,
    emoji: meta?.emoji ?? "🎮",
    accent: meta?.accent ?? "#e6c26b",
    headline,
    lines,
  });
}
