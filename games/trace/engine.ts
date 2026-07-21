// TRACE core: seeded target shapes + similarity scoring. Pure logic — no DOM.
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

function wave(x0: number, y0: number, w: number, amp: number): Stroke {
  const pts: Pt[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    pts.push({ x: x0 + t * w, y: y0 + Math.sin(t * Math.PI * 3) * amp });
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

// three rounds, escalating: 1 shape → 2 shapes → complex composition
export function genTargets(dayKey: string): Stroke[][] {
  const rng: Rng = mulberry32(hashSeed(`trace:${dayKey}`));
  const pos = (mx: number) => ({
    x: mx + rng() * (CW - mx * 2),
    y: mx * 0.7 + rng() * (CH - mx * 1.4),
  });

  const simple = (): Stroke => {
    const p = pos(200);
    const r = 90 + rng() * 70;
    const kind = Math.floor(rng() * 4);
    if (kind === 0) return circle(p.x, p.y, r);
    if (kind === 1) return polygon(p.x, p.y, r, 3 + Math.floor(rng() * 2), rng() * Math.PI);
    if (kind === 2) return star(p.x, p.y, r, rng() * Math.PI);
    return polygon(p.x, p.y, r, 4, rng() * Math.PI);
  };

  const linework = (): Stroke => {
    const y = 150 + rng() * 300;
    if (rng() < 0.5) return zigzag(180 + rng() * 80, y, 400 + rng() * 120, 90 + rng() * 60, 5 + Math.floor(rng() * 3));
    return wave(160 + rng() * 80, y, 460 + rng() * 140, 60 + rng() * 50);
  };

  const round1: Stroke[] = [simple()];

  const a = circle(240 + rng() * 80, 200 + rng() * 120, 70 + rng() * 40);
  const b = polygon(580 + rng() * 100, 330 + rng() * 120, 80 + rng() * 40, 3 + Math.floor(rng() * 3), rng() * Math.PI);
  const round2: Stroke[] = [a, b];

  const round3: Stroke[] =
    rng() < 0.5
      ? [spiral(CW / 2 + (rng() - 0.5) * 160, CH / 2 + (rng() - 0.5) * 80, 130 + rng() * 60, 2.5), linework()]
      : [star(260 + rng() * 80, 240 + rng() * 100, 90 + rng() * 40, rng() * Math.PI), linework(), circle(660 + rng() * 60, 200 + rng() * 160, 55 + rng() * 30)];

  return [round1, round2, round3];
}

// endless: one sketch at a time, growing more tangled with depth
export function genSketch(seedStr: string, depth: number): Stroke[] {
  const rng = mulberry32(hashSeed(seedStr));
  const n = 1 + Math.min(4, Math.floor(depth / 2));
  const strokes: Stroke[] = [];
  for (let k = 0; k < n; k++) {
    const kind = Math.floor(rng() * 6);
    const cx = 170 + rng() * (CW - 340);
    const cy = 130 + rng() * (CH - 260);
    const r = 60 + rng() * 80;
    if (kind === 0) strokes.push(circle(cx, cy, r));
    else if (kind === 1) strokes.push(polygon(cx, cy, r, 3 + Math.floor(rng() * 3), rng() * Math.PI));
    else if (kind === 2) strokes.push(star(cx, cy, r, rng() * Math.PI));
    else if (kind === 3) strokes.push(zigzag(cx - r, cy, r * 2, 60 + rng() * 50, 4 + Math.floor(rng() * 3)));
    else if (kind === 4) strokes.push(wave(cx - r, cy, r * 2, 40 + rng() * 40));
    else strokes.push(spiral(cx, cy, r, 2 + rng()));
  }
  return strokes;
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

// 0–100: how close is the drawing to the target (forgiving of small offsets)
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
