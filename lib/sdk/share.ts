// Spoiler-free share artifacts — the free growth channel.
// Multi-line emoji grids (the Wordle pattern): tell the story, spoil nothing.

export function buildShare(game: string, num: number, lines: string[], challengeUrl?: string): string {
  return [`${game} #${num}`, ...lines, challengeUrl ? `🎯 beat me: ${challengeUrl}` : "🪐 gamedrop.day"].join("\n");
}

// a live link back to this exact game, carrying the score to beat
export function challengeUrl(score: number | string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}?beat=${encodeURIComponent(String(score))}`;
}

// legacy single-line form, kept for anything not yet on grids
export function buildShareText(game: string, num: number, detail: string): string {
  return buildShare(game, num, [detail]);
}

export type ShareOutcome = "shared" | "copied" | "failed";

// mobile: opens the native share sheet (WhatsApp etc.); desktop: clipboard
export async function shareResult(text: string): Promise<ShareOutcome> {
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return "shared";
    } catch {
      // user closed the sheet — fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
