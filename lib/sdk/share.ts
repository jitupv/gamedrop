// Spoiler-free share artifacts - the free growth channel.
// Text grids (the Wordle pattern) + a rendered stat-card image for the share sheet.
import { track } from "./analytics";
import { SITE_DOMAIN, SITE_NAME } from "../site";

export function buildShare(game: string, num: number, lines: string[], challengeUrl?: string): string {
  return [`${game} #${num}`, ...lines, challengeUrl ? `🎯 beat me: ${challengeUrl}` : `🪐 ${SITE_DOMAIN}`].join("\n");
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

// everything the stat-card image needs - each game passes its own vibe
export interface ShareCard {
  game: string; // "SONAR"
  num: number; // challenge number
  emoji: string; // game glyph, drawn as a giant watermark
  accent: string; // game accent color
  headline: string; // the big stat, e.g. "9 pings"
  lines: string[]; // emoji grid lines (spoiler-free)
  streak?: number;
}

// Per-game vector watermark. Drawn with paths, not emoji, because emoji in canvas
// depend on the platform's emoji font: the same card rendered on Android and on
// Apple produced a visible mark and a missing one. Vectors look identical
// everywhere, survive WhatsApp's JPEG compression, and each game gets its own
// silhouette instead of every card sharing one generic background.
const WATERMARK_ALPHA = 0.13;

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  game: string,
  cx: number,
  cy: number,
  s: number, // overall size of the mark
  color: string
): boolean {
  ctx.save();
  ctx.globalAlpha = WATERMARK_ALPHA;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  let drawn = true;

  switch (game) {
    case "pulse": {
      ctx.lineWidth = s * 0.035;
      const points = [[-.36,-.28],[.05,-.42],[.38,-.05],[-.22,.34],[.28,.36]];
      const links = [[0,1],[1,2],[0,3],[1,4],[2,4],[3,4]];
      links.forEach(([a, b]) => {
        ctx.beginPath();
        ctx.moveTo(cx + points[a][0] * s, cy + points[a][1] * s);
        ctx.lineTo(cx + points[b][0] * s, cy + points[b][1] * s);
        ctx.stroke();
      });
      points.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(cx + x * s, cy + y * s, s * 0.09, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    }
    case "prism": {
      // a bent beam bouncing off a mirror line - the game's whole mechanic in one mark
      ctx.lineWidth = s * 0.045;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.46, cy - s * 0.28);
      ctx.lineTo(cx - s * 0.04, cy - s * 0.28);
      ctx.lineTo(cx + s * 0.42, cy + s * 0.4);
      ctx.stroke();
      ctx.save();
      ctx.translate(cx - s * 0.04, cy - s * 0.28);
      ctx.rotate(-Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(-s * 0.16, 0);
      ctx.lineTo(s * 0.16, 0);
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(cx - s * 0.46, cy - s * 0.28, s * 0.06, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "tilt": {
      // a 3x3 slab of tiles - the board you swipe
      const n = 3;
      const gap = s * 0.07;
      const t = (s - gap * (n - 1)) / n;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          ctx.beginPath();
          ctx.roundRect(cx - s / 2 + c * (t + gap), cy - s / 2 + r * (t + gap), t, t, t * 0.24);
          ctx.fill();
        }
      }
      break;
    }
    case "orbit": {
      // a planet with its orbital path and a probe on the arc
      ctx.lineWidth = s * 0.04;
      ctx.beginPath();
      ctx.ellipse(cx, cy, s * 0.48, s * 0.21, -0.55, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.19, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx + s * 0.34, cy - s * 0.3, s * 0.045, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "sonar": {
      // ping rings radiating from the blind dot
      ctx.lineWidth = s * 0.038;
      for (const r of [0.5, 0.35, 0.2]) {
        ctx.beginPath();
        ctx.arc(cx, cy, s * r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, s * 0.07, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "heist": {
      // the gem you have to collect, with facet lines
      ctx.beginPath();
      ctx.moveTo(cx, cy - s * 0.44);
      ctx.lineTo(cx + s * 0.4, cy - s * 0.08);
      ctx.lineTo(cx, cy + s * 0.46);
      ctx.lineTo(cx - s * 0.4, cy - s * 0.08);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = WATERMARK_ALPHA * 1.7;
      ctx.lineWidth = s * 0.022;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.4, cy - s * 0.08);
      ctx.lineTo(cx + s * 0.4, cy - s * 0.08);
      ctx.moveTo(cx, cy - s * 0.44);
      ctx.lineTo(cx - s * 0.17, cy - s * 0.08);
      ctx.moveTo(cx, cy - s * 0.44);
      ctx.lineTo(cx + s * 0.17, cy - s * 0.08);
      ctx.stroke();
      break;
    }
    case "rush": {
      // the traffic light you control
      const w = s * 0.5;
      ctx.lineWidth = s * 0.035;
      ctx.beginPath();
      ctx.roundRect(cx - w / 2, cy - s / 2, w, s, w * 0.44);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.29 + i * s * 0.29, w * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "trace": {
      // one continuous stroke, the way the game is played
      ctx.lineWidth = s * 0.08;
      ctx.beginPath();
      ctx.moveTo(cx - s * 0.42, cy + s * 0.3);
      ctx.bezierCurveTo(cx - s * 0.32, cy - s * 0.46, cx + s * 0.3, cy - s * 0.44, cx + s * 0.34, cy - s * 0.02);
      ctx.bezierCurveTo(cx + s * 0.38, cy + s * 0.36, cx - s * 0.04, cy + s * 0.42, cx - s * 0.14, cy + s * 0.12);
      ctx.stroke();
      break;
    }
    default:
      drawn = false;
  }

  ctx.restore();
  return drawn;
}

// 1080×1080 share card: dark card, game-colored glow, per-game vector watermark,
// brand + challenge number, big stat, emoji grid, domain footer
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
    // per-game vector watermark, bottom right; emoji only as a last resort for a
    // game that has no mark drawn yet
    if (!drawWatermark(ctx, card.game.toLowerCase(), 800, 760, 440, card.accent)) {
      ctx.save();
      ctx.globalAlpha = WATERMARK_ALPHA;
      ctx.font = `440px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",${fam}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(card.emoji, 800, 760);
      ctx.restore();
    }

    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    // brand
    ctx.fillStyle = "#eef0f5";
    ctx.font = `800 56px ${fam}`;
    ctx.fillText(SITE_NAME, 72, 118);
    const bw = ctx.measureText(SITE_NAME).width;
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
    ctx.fillText(SITE_DOMAIN, 72, 1052);

    return await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  } catch {
    return null;
  }
}

// mobile: native share sheet with the stat-card IMAGE + text (link included);
// desktop: image to clipboard; final fallback: plain text
export async function shareResult(text: string, card?: ShareCard): Promise<ShareOutcome> {
  const game = text.split("\n")[0]?.split(" ")[0]?.toLowerCase();
  track("share_clicked", { game });

  // report HOW the share went, not just that it was clicked - an image share and a
  // text-only fallback are very different for growth, and we could not tell them
  // apart before.
  const done = (outcome: ShareOutcome, method: string): ShareOutcome => {
    track("share_done", { game, outcome, method, withImage: method.startsWith("image") });
    return outcome;
  };

  if (card) {
    const blob = await renderCard(card);
    if (blob) {
      const file = new File([blob], `${SITE_NAME.toLowerCase()}-${card.game.toLowerCase()}-${card.num}.png`, {
        type: "image/png",
      });
      // 1) native sheet with image + caption (WhatsApp keeps both)
      if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text });
          return done("shared", "image-native");
        } catch {
          // user closed the sheet - fall through
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
        return done("copied", "image-clipboard");
      } catch {
        // clipboard image not allowed - fall through to text
      }
    }
  }

  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ text });
      return done("shared", "text-native");
    } catch {
      // user closed the sheet - fall through to clipboard
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return done("copied", "text-clipboard");
  } catch {
    return done("failed", "none");
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
