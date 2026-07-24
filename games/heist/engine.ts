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

// fewer, BIGGER tiles - phone-friendly touch targets; the difficulty comes
// from guards + the all-gems vault lock + the no-revisit rule, not from size
export const LEVELS: HeistCfg[] = [
  { cols: 9, rows: 7, guards: 2, gems: 3 },
  { cols: 10, rows: 7, guards: 3, gems: 4 },
  { cols: 11, rows: 8, guards: 4, gems: 4 },
];

// endless mode: museums keep growing and gaining guards, forever
export function endlessCfg(i: number): HeistCfg {
  return {
    cols: Math.min(13, 9 + Math.floor(i / 2)),
    rows: Math.min(9, 7 + Math.floor(i / 3)),
    guards: Math.min(5, 2 + Math.floor((i + 1) / 2)),
    gems: Math.min(5, 3 + Math.floor(i / 3)),
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

// full-loot, NO-REVISIT proof: one self-avoiding route must collect EVERY gem
// and END on the exit, dodging moving guards - exactly the rules the player
// plans under (each tile once, vault locked until the bag is full).
function fullLootRoute(lv: HeistLevel, budget = 150000): boolean {
  const fullMask = (1 << lv.gems.length) - 1;
  const gemIdx = new Map<number, number>();
  lv.gems.forEach((gm, i) => gemIdx.set(gm.r * lv.cols + gm.c, i));
  const startId = lv.start.r * lv.cols + lv.start.c;
  const startGem = gemIdx.get(startId);
  const startMask = startGem === undefined ? 0 : 1 << startGem;
  const visited = new Uint8Array(lv.cols * lv.rows);
  visited[startId] = 1;
  let nodes = 0;

  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  const dfs = (c: number, r: number, t: number, mask: number): boolean => {
    if (nodes++ > budget) return false; // search blowout - reject, try next seed
    if (mask === fullMask && c === lv.exit.c && r === lv.exit.r) return true;

    // move ordering: head toward the nearest missing gem (exit once bag is full)
    let target: Cell = lv.exit;
    if (mask !== fullMask) {
      let bd = Infinity;
      lv.gems.forEach((gm, i) => {
        if (mask & (1 << i)) return;
        const d = Math.abs(gm.c - c) + Math.abs(gm.r - r);
        if (d < bd) {
          bd = d;
          target = gm;
        }
      });
    }
    const opts = dirs
      .map(([dc, dr]) => ({ c: c + dc, r: r + dr }))
      .filter(
        (p) => p.c >= 0 && p.r >= 0 && p.c < lv.cols && p.r < lv.rows && !lv.walls[p.r][p.c]
      )
      .sort(
        (a, b) =>
          Math.abs(a.c - target.c) + Math.abs(a.r - target.r) -
          (Math.abs(b.c - target.c) + Math.abs(b.r - target.r))
      );

    for (const p of opts) {
      const id = p.r * lv.cols + p.c;
      if (visited[id]) continue;
      const gi = gemIdx.get(id);
      const m2 = gi === undefined ? mask : mask | (1 << gi);
      // the exit is a locked door until every gem is in the bag
      if (p.c === lv.exit.c && p.r === lv.exit.r && m2 !== fullMask) continue;
      if (caughtAt(lv.guards, { c, r }, p, t + 1)) continue;
      visited[id] = 1;
      if (dfs(p.c, p.r, t + 1, m2)) return true;
      visited[id] = 0;
    }
    return false;
  };

  return dfs(lv.start.c, lv.start.r, 0, startMask);
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
    if (!fullLootRoute(lv)) continue;
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
