// Spoiler-free share artifacts — the free growth channel.
// Text grids (the Wordle pattern) + a rendered stat-card image for the share sheet.
import { track } from "./analytics";

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

// everything the stat-card image needs — each game passes its own vibe
export interface ShareCard {
  game: string; // "SONAR"
  num: number; // challenge number
  emoji: string; // game glyph, drawn as a giant watermark
  accent: string; // game accent color
  headline: string; // the big stat, e.g. "9 pings"
  lines: string[]; // emoji grid lines (spoiler-free)
  streak?: number;
}

// 1080×1080 share card: dark card, game-colored glow, giant emoji watermark,
// brand + challenge number, big stat, emoji grid, gamedrop.day footer
async function renderCard(card: ShareCard): Promise<Blob | null> {
  try {
    if (typeof document === "undefined") return null;
    await document.fonts.ready;
    const S = 1080;
    const canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const fam = getComputedStyle(document.body).fontFamily || "Inter, sans-serif";

    // ground
    ctx.fillStyle = "#14161c";
    ctx.fillRect(0, 0, S, S);
    // game-colored glow, top right
    const glow = ctx.createRadialGradient(820, 210, 0, 820, 210, 560);
    glow.addColorStop(0, card.accent + "3a");
    glow.addColorStop(1, "transparent");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, S, S);
    // faint gold glow, bottom left
    const glow2 = ctx.createRadialGradient(160, 980, 0, 160, 980, 480);
    glow2.addColorStop(0, "rgba(230,194,107,0.10)");
    glow2.addColorStop(1, "transparent");
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, S, S);
    // giant emoji watermark
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.font = `520px ${fam}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(card.emoji, 790, 820);
    ctx.restore();

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // brand
    ctx.fillStyle = "#eef0f5";
    ctx.font = `800 56px ${fam}`;
    ctx.fillText("GAMEDROP", 72, 118);
    const bw = ctx.measureText("GAMEDROP").width;
    ctx.fillStyle = "#e6c26b";
    ctx.fillText(".", 72 + bw + 4, 118);

    // game + challenge number
    ctx.fillStyle = card.accent;
    ctx.font = `700 36px ${fam}`;
    ctx.fillText(`${card.game.toUpperCase()}  ·  CHALLENGE #${String(card.num).padStart(2, "0")}`, 72, 208);

    // the big stat
    ctx.fillStyle = "#eef0f5";
    ctx.font = `800 124px ${fam}`;
    ctx.fillText(card.headline, 72, 368);

    // emoji grid lines
    ctx.font = `54px ${fam}`;
    let y = 480;
    for (const line of card.lines.slice(0, 5)) {
      ctx.fillStyle = "rgba(238,240,245,0.92)";
      ctx.fillText(line, 72, y);
      y += 82;
    }
    // streak
    if (card.streak && card.streak > 0) {
      ctx.fillStyle = "#e6c26b";
      ctx.font = `700 42px ${fam}`;
      ctx.fillText(`🔥 ${card.streak}-day streak`, 72, y + 14);
    }

    // footer
    ctx.strokeStyle = card.accent + "55";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(72, 930);
    ctx.lineTo(S - 72, 930);
    ctx.stroke();
    ctx.fillStyle = "rgba(238,240,245,0.6)";
    ctx.font = `500 34px ${fam}`;
    ctx.fillText("Same challenge for everyone · new puzzle at midnight", 72, 992);
    ctx.fillStyle = card.accent;
    ctx.font = `800 46px ${fam}`;
    ctx.fillText("gamedrop.day", 72, 1052);

    return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  } catch {
    return null;
  }
}

// mobile: native share sheet with the stat-card IMAGE + text (link included);
// desktop: image to clipboard; final fallback: plain text
export async function shareResult(text: string, card?: ShareCard): Promise<ShareOutcome> {
  track("share_clicked", { game: text.split("\n")[0]?.split(" ")[0]?.toLowerCase() });

  if (card) {
    const blob = await renderCard(card);
    if (blob) {
      const file = new File([blob], `gamedrop-${card.game.toLowerCase()}-${card.num}.png`, {
        type: "image/png",
      });
      // 1) native sheet with image + caption (WhatsApp keeps both)
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
          return "shared";
        } catch {
          // user closed the sheet — fall through
        }
      }
      // 2) clipboard image (+ text when the browser allows multi-type)
      try {
        const item: Record<string, Blob> = { "image/png": blob };
        try {
          item["text/plain"] = new Blob([text], { type: "text/plain" });
          await navigator.clipboard.write([new ClipboardItem(item)]);
        } catch {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        }
        return "copied";
      } catch {
        // clipboard image not allowed — fall through to text
      }
    }
  }

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
