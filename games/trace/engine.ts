// TRACE core: seeded target shapes + similarity scoring. Pure logic - no DOM.
import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export const CW = 900;
export const CH = 600;
const GW = 112; // scoring raster
const GH = 75;

export interface Pt {
  x: number;
  y: number;
}
export type Stroke = Pt[];

export interface TraceLevel {
  target: Stroke[];
  memorizeSeconds: number;
  peekSeconds: number;
  peekCost: number;
  passAccuracy: number;
  twoStarAccuracy: number;
  threeStarAccuracy: number;
}

export const TOTAL_LEVELS = 100;

type Rng = () => number;

function circle(cx: number, cy: number, r: number): Stroke {
  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function polygon(cx: number, cy: number, r: number, sides: number, rot: number): Stroke {
  const pts: Pt[] = [];
  for (let i = 0; i <= sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function star(cx: number, cy: number, r: number, rot: number): Stroke {
  const pts: Pt[] = [];
  for (let i = 0; i <= 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45;
    const a = rot + (i / 10) * Math.PI * 2;
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return pts;
}

function zigzag(x0: number, y0: number, w: number, h: number, n: number): Stroke {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    pts.push({ x: x0 + (i / n) * w, y: y0 + (i % 2 === 0 ? 0 : h) });
  }
  return pts;
}

function wave(x0: number, y0: number, w: number, amp: number, cycles = 3): Stroke {
  const pts: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    pts.push({ x: x0 + t * w, y: y0 + Math.sin(t * Math.PI * cycles) * amp });
  }
  return pts;
}

function spiral(cx: number, cy: number, rMax: number, turns: number): Stroke {
  const pts: Pt[] = [];
  const n = 70;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = t * Math.PI * 2 * turns;
    const r = rMax * t;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function strokeCountFor(levelIdx: number): number {
  if (levelIdx < 10) return 1 + Math.floor(levelIdx / 3);
  return levelIdx < 55 ? 4 : 5;
}

export function genProgressLevel(levelIdx: number, seasonKey = "all"): TraceLevel {
  const safeIndex = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  const difficulty = safeIndex / (TOTAL_LEVELS - 1);
  const rng: Rng = mulberry32(hashSeed(`trace:weekly:v1:${seasonKey}:L${safeIndex + 1}`));
  const count = strokeCountFor(safeIndex);
  const slotWidth = (CW - 160) / count;
  const target: Stroke[] = [];

  for (let i = 0; i < count; i++) {
    const cx = 80 + slotWidth * (i + 0.5) + (rng() - 0.5) * slotWidth * 0.18;
    const cy = 110 + rng() * (CH - 220);
    const r = Math.min(92, slotWidth * 0.34) * (0.72 + rng() * 0.24);
    const kindCount = safeIndex < 3 ? 2 : safeIndex < 10 ? 4 : safeIndex < 35 ? 5 : 6;
    const kind = (Math.floor(rng() * kindCount) + i + safeIndex) % kindCount;

    if (kind === 0) {
      target.push(circle(cx, cy, r));
    } else if (kind === 1) {
      const sideRange = 2 + Math.floor(difficulty * 4);
      target.push(polygon(cx, cy, r, 3 + Math.floor(rng() * sideRange), rng() * Math.PI));
    } else if (kind === 2) {
      target.push(star(cx, cy, r, rng() * Math.PI));
    } else if (kind === 3) {
      const width = slotWidth * 0.72;
      const height = Math.min(110, r * 1.35);
      target.push(
        zigzag(
          cx - width / 2,
          cy - height / 2,
          width,
          height,
          4 + Math.floor(difficulty * 8) + Math.floor(rng() * 2)
        )
      );
    } else if (kind === 4) {
      const width = slotWidth * 0.76;
      target.push(
        wave(
          cx - width / 2,
          cy,
          width,
          Math.min(64, r * 0.62),
          2 + Math.floor(difficulty * 3)
        )
      );
    } else {
      target.push(spiral(cx, cy, r, 1.8 + difficulty * 2.2 + rng() * 0.35));
    }
  }

  return {
    target,
    memorizeSeconds: Math.round((4.5 - difficulty * 2.7) * 10) / 10,
    peekSeconds: Math.round((1.4 - difficulty * 0.5) * 10) / 10,
    peekCost: 8,
    passAccuracy: 35,
    twoStarAccuracy: 55,
    threeStarAccuracy: 75,
  };
}

export function starsForAccuracy(level: TraceLevel, accuracy: number): number {
  if (accuracy >= level.threeStarAccuracy) return 3;
  if (accuracy >= level.twoStarAccuracy) return 2;
  return accuracy >= level.passAccuracy ? 1 : 0;
}

// ---------- scoring ----------

function rasterize(strokes: Stroke[]): Uint8Array {
  const mask = new Uint8Array(GW * GH);
  const sx = GW / CW;
  const sy = GH / CH;
  const stamp = (x: number, y: number) => {
    const c0 = Math.round(x * sx);
    const r0 = Math.round(y * sy);
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const c = c0 + dc;
        const r = r0 + dr;
        if (c >= 0 && r >= 0 && c < GW && r < GH) mask[r * GW + c] = 1;
      }
  };
  for (const st of strokes) {
    if (st.length === 1) stamp(st[0].x, st[0].y);
    for (let i = 0; i < st.length - 1; i++) {
      const p = st[i];
      const q = st[i + 1];
      const steps = Math.max(1, Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / 5));
      for (let s = 0; s <= steps; s++) {
        stamp(p.x + ((q.x - p.x) * s) / steps, p.y + ((q.y - p.y) * s) / steps);
      }
    }
  }
  return mask;
}

function dilate(mask: Uint8Array, rad: number): Uint8Array {
  const out = new Uint8Array(GW * GH);
  for (let r = 0; r < GH; r++)
    for (let c = 0; c < GW; c++) {
      if (!mask[r * GW + c]) continue;
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++) {
          const rr = r + dr;
          const cc = c + dc;
          if (cc >= 0 && rr >= 0 && cc < GW && rr < GH) out[rr * GW + cc] = 1;
        }
    }
  return out;
}

// 0-100: how close is the drawing to the target (forgiving of small offsets)
export function similarity(target: Stroke[], drawing: Stroke[]): number {
  const T = rasterize(target);
  const D = rasterize(drawing);
  let dCount = 0;
  for (let i = 0; i < D.length; i++) if (D[i]) dCount++;
  if (dCount === 0) return 0;
  const Td = dilate(T, 3);
  const Dd = dilate(D, 3);
  let tCount = 0;
  let dIn = 0;
  let tIn = 0;
  for (let i = 0; i < T.length; i++) {
    if (T[i]) {
      tCount++;
      if (Dd[i]) tIn++;
    }
    if (D[i] && Td[i]) dIn++;
  }
  const precision = dIn / dCount; // did you draw only where the shape was?
  const recall = tCount > 0 ? tIn / tCount : 0; // did you cover the whole shape?
  return Math.round(precision * recall * 1000) / 10;
}
