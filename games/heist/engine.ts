// HEIST core: seeded museum generation + turn simulation.
// A level is only shipped if a spacetime BFS proves the exit is reachable
// without being caught, and every gem is physically reachable.
import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export interface Cell {
  c: number;
  r: number;
}

export interface Guard {
  path: Cell[]; // patrol loop, walked forward forever
  offset: number; // starting index into the loop
}

export interface HeistLevel {
  cols: number;
  rows: number;
  walls: boolean[][];
  gems: Cell[];
  start: Cell;
  exit: Cell;
  guards: Guard[];
}

export interface HeistCfg {
  cols: number;
  rows: number;
  guards: number;
  gems: number;
}

export const LEVELS: HeistCfg[] = [
  { cols: 12, rows: 9, guards: 2, gems: 3 },
  { cols: 14, rows: 10, guards: 3, gems: 4 },
  { cols: 16, rows: 11, guards: 4, gems: 5 },
];

// endless mode: museums keep growing and gaining guards, forever
export function endlessCfg(i: number): HeistCfg {
  return {
    cols: Math.min(16, 11 + Math.floor(i / 2)),
    rows: Math.min(11, 8 + Math.floor(i / 3)),
    guards: Math.min(6, 1 + Math.floor((i + 1) / 2)),
    gems: Math.min(5, 2 + Math.floor(i / 2)),
  };
}

export function guardAt(g: Guard, t: number): Cell {
  return g.path[(g.offset + t) % g.path.length];
}

// thief moved old→new on tick t-1→t; caught if sharing a cell or swapping with any guard
export function caughtAt(guards: Guard[], oldPos: Cell, newPos: Cell, t: number): boolean {
  for (const g of guards) {
    const gNow = guardAt(g, t);
    const gPrev = guardAt(g, t - 1);
    if (gNow.c === newPos.c && gNow.r === newPos.r) return true;
    if (gPrev.c === newPos.c && gPrev.r === newPos.r && gNow.c === oldPos.c && gNow.r === oldPos.r) return true;
  }
  return false;
}

function rectLoop(x0: number, y0: number, w: number, h: number): Cell[] {
  const path: Cell[] = [];
  for (let c = x0; c < x0 + w; c++) path.push({ c, r: y0 });
  for (let r = y0 + 1; r < y0 + h; r++) path.push({ c: x0 + w - 1, r });
  for (let c = x0 + w - 2; c >= x0; c--) path.push({ c, r: y0 + h - 1 });
  for (let r = y0 + h - 2; r >= y0 + 1; r--) path.push({ c: x0, r });
  return path;
}

function plainBFS(lv: Pick<HeistLevel, "cols" | "rows" | "walls">, from: Cell, to: Cell): boolean {
  const seen = new Set<string>([`${from.c},${from.r}`]);
  const q: Cell[] = [from];
  while (q.length > 0) {
    const cur = q.shift() as Cell;
    if (cur.c === to.c && cur.r === to.r) return true;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const c = cur.c + dc;
      const r = cur.r + dr;
      const key = `${c},${r}`;
      if (c < 0 || r < 0 || c >= lv.cols || r >= lv.rows || lv.walls[r][c] || seen.has(key)) continue;
      seen.add(key);
      q.push({ c, r });
    }
  }
  return false;
}

// full-loot proof: can the thief collect EVERY gem and then reach the exit,
// dodging guards the whole way? State = (cell, time, gem bitmask); the exit
// only counts with all gems in the bag — matching the in-game locked vault.
function spacetimeBFS(lv: HeistLevel, horizon = 220): boolean {
  const fullMask = (1 << lv.gems.length) - 1;
  const gemAt = new Map<number, number>();
  lv.gems.forEach((gm, i) => gemAt.set(gm.r * lv.cols + gm.c, i));
  const startMask = gemAt.has(lv.start.r * lv.cols + lv.start.c)
    ? 1 << (gemAt.get(lv.start.r * lv.cols + lv.start.c) as number)
    : 0;

  const cells = lv.cols * lv.rows;
  const key = (c: number, r: number, t: number, mask: number) =>
    ((t * cells + r * lv.cols + c) << 5) | mask; // gems ≤ 5 → mask fits in 5 bits
  const seen = new Set<number>([key(lv.start.c, lv.start.r, 0, startMask)]);
  const q: { c: number; r: number; t: number; mask: number }[] = [
    { c: lv.start.c, r: lv.start.r, t: 0, mask: startMask },
  ];
  while (q.length > 0) {
    if (seen.size > 600000) return false; // state-space blowout — reject, try next seed
    const cur = q.shift() as { c: number; r: number; t: number; mask: number };
    if (cur.c === lv.exit.c && cur.r === lv.exit.r && cur.mask === fullMask) return true;
    if (cur.t >= horizon) continue;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const c = cur.c + dc;
      const r = cur.r + dr;
      if (c < 0 || r < 0 || c >= lv.cols || r >= lv.rows || lv.walls[r][c]) continue;
      const t = cur.t + 1;
      const gi = gemAt.get(r * lv.cols + c);
      const mask = gi === undefined ? cur.mask : cur.mask | (1 << gi);
      const k = key(c, r, t, mask);
      if (seen.has(k)) continue;
      if (caughtAt(lv.guards, { c: cur.c, r: cur.r }, { c, r }, t)) continue;
      seen.add(k);
      q.push({ c, r, t, mask });
    }
  }
  return false;
}

export function genLevel(dayKey: string, levelIdx: number): HeistLevel {
  return genLevelFrom(`heist:${dayKey}:L${levelIdx}`, LEVELS[levelIdx]);
}

export function genLevelFrom(seedBase: string, cfg: HeistCfg): HeistLevel {
  for (let attempt = 0; attempt < 30; attempt++) {
    const rng = mulberry32(hashSeed(`${seedBase}:${attempt}`));
    const { cols, rows } = cfg;
    const walls: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const start: Cell = { c: 0, r: Math.floor(rows / 2) };
    const exit: Cell = { c: cols - 1, r: Math.floor(rows / 2) };

    // scatter display cases (walls)
    const wallCount = Math.floor(cols * rows * 0.13);
    for (let i = 0; i < wallCount; i++) {
      const c = Math.floor(rng() * cols);
      const r = Math.floor(rng() * rows);
      if ((Math.abs(c - start.c) + Math.abs(r - start.r)) < 2) continue;
      if ((Math.abs(c - exit.c) + Math.abs(r - exit.r)) < 2) continue;
      walls[r][c] = true;
    }

    // guards on rectangular patrol loops; loop cells are always floor
    const guards: Guard[] = [];
    let guardTries = 0;
    while (guards.length < cfg.guards && guardTries < 60) {
      guardTries++;
      const w = 3 + Math.floor(rng() * 3);
      const h = 2 + Math.floor(rng() * 3);
      const x0 = 1 + Math.floor(rng() * (cols - w - 2));
      const y0 = Math.floor(rng() * (rows - h));
      const path = rectLoop(x0, y0, w, h);
      if (path.some((p) => (p.c === start.c && p.r === start.r) || (p.c === exit.c && p.r === exit.r))) continue;
      for (const p of path) walls[p.r][p.c] = false;
      guards.push({ path, offset: Math.floor(rng() * path.length) });
    }

    // gems on floor cells, spread out
    const gems: Cell[] = [];
    let gemTries = 0;
    while (gems.length < cfg.gems && gemTries < 200) {
      gemTries++;
      const c = 1 + Math.floor(rng() * (cols - 2));
      const r = Math.floor(rng() * rows);
      if (walls[r][c]) continue;
      if (Math.abs(c - start.c) + Math.abs(r - start.r) < 3) continue;
      if (Math.abs(c - exit.c) + Math.abs(r - exit.r) < 2) continue;
      if (gems.some((gm) => Math.abs(gm.c - c) + Math.abs(gm.r - r) < 3)) continue;
      gems.push({ c, r });
    }

    const lv: HeistLevel = { cols, rows, walls, gems, start, exit, guards };
    if (gems.length < cfg.gems) continue;
    if (!plainBFS(lv, start, exit)) continue;
    if (!gems.every((gm) => plainBFS(lv, start, gm))) continue;
    if (!spacetimeBFS(lv)) continue;
    return lv;
  }
  // deterministic fallback: guard-free open room (should practically never happen)
  const { cols, rows } = cfg;
  return {
    cols,
    rows,
    walls: Array.from({ length: rows }, () => Array(cols).fill(false)),
    gems: [{ c: Math.floor(cols / 2), r: 1 }],
    start: { c: 0, r: Math.floor(rows / 2) },
    exit: { c: cols - 1, r: Math.floor(rows / 2) },
    guards: [],
  };
}
