// HEIST core: deterministic campaign generation + turn simulation.
// Each level is built around a safe, self-avoiding route that collects every gem.
import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export interface Cell {
  c: number;
  r: number;
}

export interface Guard {
  path: Cell[]; // patrol loop, walked forever in the configured direction
  offset: number; // starting index into the loop
  direction: 1 | -1;
}

export interface HeistLevel {
  cols: number;
  rows: number;
  walls: boolean[][];
  gems: Cell[];
  start: Cell;
  exit: Cell;
  guards: Guard[];
  solutionSteps: number;
  stepLimit: number | null;
  orderedGems: boolean;
}

export interface HeistCfg {
  cols: number;
  rows: number;
  guards: number;
  gems: number;
  wallRatio: number;
  minSteps: number;
  stepSlack: number | null;
  reverseGuardRatio: number;
  orderedGems: boolean;
}

export const TOTAL_LEVELS = 100;

export function levelCfg(levelIdx: number): HeistCfg {
  const n = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  if (n < 10) {
    return {
      cols: 8 + Math.floor(n / 4),
      rows: 7 + Math.floor(n / 5),
      guards: 1 + Math.floor((n + 2) / 4),
      gems: 3 + Math.floor(n / 4),
      wallRatio: 0.07 + n * 0.006,
      minSteps: 10 + n * 2,
      stepSlack: null,
      reverseGuardRatio: 0,
      orderedGems: false,
    };
  }

  if (n < 25) {
    const d = n - 10;
    return {
      cols: 10 + Math.floor(d / 8),
      rows: 8 + Math.floor(d / 10),
      guards: 3 + Math.floor(d / 7),
      gems: 5 + Math.floor(d / 8),
      wallRatio: 0.13 + d * 0.002,
      minSteps: 28 + Math.floor(d * 0.8),
      stepSlack: 10 - Math.floor(d / 5),
      reverseGuardRatio: 0,
      orderedGems: false,
    };
  }

  if (n < 50) {
    const d = n - 25;
    return {
      cols: 11 + Math.floor(d / 12),
      rows: 9 + Math.floor(d / 15),
      guards: 5 + Math.floor(d / 12),
      gems: 6 + Math.floor(d / 12),
      wallRatio: 0.16 + d * 0.002,
      minSteps: 42 + Math.floor(d * 0.7),
      stepSlack: 7 - Math.floor(d / 8),
      reverseGuardRatio: 0,
      orderedGems: false,
    };
  }

  if (n < 75) {
    const d = n - 50;
    return {
      cols: 13 + Math.floor(d / 16),
      rows: 10 + Math.floor(d / 18),
      guards: 7 + Math.floor(d / 16),
      gems: 8 + Math.floor(d / 16),
      wallRatio: 0.21 + d * 0.0018,
      minSteps: 58 + Math.floor(d * 0.75),
      stepSlack: 4 - Math.floor(d / 16),
      reverseGuardRatio: 0.25 + d * 0.01,
      orderedGems: false,
    };
  }

  const d = n - 75;
  return {
    cols: Math.min(15, 14 + Math.floor(d / 12)),
    rows: Math.min(12, 11 + Math.floor(d / 16)),
    guards: 8,
    gems: Math.min(10, 9 + Math.floor(d / 12)),
    wallRatio: 0.255 + d * 0.0011,
    minSteps: 76 + Math.floor(d * 0.75),
    stepSlack: 3,
    reverseGuardRatio: Math.min(0.7, 0.5 + d * 0.01),
    orderedGems: true,
  };
}

export function guardAt(g: Guard, t: number): Cell {
  const index = (g.offset + g.direction * t) % g.path.length;
  return g.path[index < 0 ? index + g.path.length : index];
}

// Thief and guard both move during tick t-1→t. Treat both swept tiles as
// occupied for that turn: landing together, swapping head-on, or entering one
// another's just-vacated tile from the side all count as a collision.
export function caughtAt(guards: Guard[], oldPos: Cell, newPos: Cell, t: number): boolean {
  for (const g of guards) {
    const gNow = guardAt(g, t);
    const gPrev = guardAt(g, t - 1);
    if (gNow.c === newPos.c && gNow.r === newPos.r) return true;
    if (gPrev.c === newPos.c && gPrev.r === newPos.r) return true;
    if (gNow.c === oldPos.c && gNow.r === oldPos.r) return true;
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

export function genProgressLevel(levelIdx: number, seasonKey = "all"): HeistLevel {
  const safeIndex = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  const cfg = levelCfg(safeIndex);
  let fallback: HeistLevel | null = null;
  for (let variant = 0; variant < 16; variant++) {
    const level = genLevelFrom(
      `heist:weekly:v2:${seasonKey}:L${safeIndex + 1}:v${variant}`,
      cfg
    );
    fallback = level;
    if (
      level.solutionSteps >= cfg.minSteps &&
      level.guards.length === cfg.guards &&
      level.gems.length === cfg.gems
    ) {
      return level;
    }
  }
  return fallback!;
}

function buildReferenceRoute(
  cols: number,
  rows: number,
  start: Cell,
  exit: Cell,
  minSteps: number,
  rng: () => number
): Cell[] | null {
  const visited = new Uint8Array(cols * rows);
  const path: Cell[] = [{ ...start }];
  visited[start.r * cols + start.c] = 1;
  const directSteps = Math.abs(exit.c - start.c) + Math.abs(exit.r - start.r);
  // A grid route must have the same odd/even parity as the direct distance.
  const targetSteps = Math.min(
    cols * rows - 1,
    Math.max(minSteps, directSteps) + ((Math.max(minSteps, directSteps) - directSteps) % 2)
  );
  let nodes = 0;

  const dfs = (c: number, r: number): boolean => {
    if (nodes++ > 180000) return false;
    const steps = path.length - 1;
    if (c === exit.c && r === exit.r) return steps === targetSteps;
    if (steps >= targetSteps) return false;

    const options = [
      { c: c + 1, r, noise: rng() },
      { c: c - 1, r, noise: rng() },
      { c, r: r + 1, noise: rng() },
      { c, r: r - 1, noise: rng() },
    ]
      .filter((p) => {
        if (p.c < 0 || p.r < 0 || p.c >= cols || p.r >= rows) return false;
        if (visited[p.r * cols + p.c]) return false;
        if (p.c === exit.c && p.r === exit.r && steps + 1 < targetSteps) return false;
        const distance = Math.abs(exit.c - p.c) + Math.abs(exit.r - p.r);
        return steps + 1 + distance <= targetSteps;
      })
      .sort((a, b) => {
        const da = Math.abs(exit.c - a.c) + Math.abs(exit.r - a.r);
        const db = Math.abs(exit.c - b.c) + Math.abs(exit.r - b.r);
        // Wander before the minimum length; home in on the exit afterwards.
        const distanceOrder = steps < targetSteps - directSteps ? db - da : da - db;
        return distanceOrder || a.noise - b.noise;
      });

    for (const next of options) {
      const id = next.r * cols + next.c;
      visited[id] = 1;
      path.push({ c: next.c, r: next.r });
      if (dfs(next.c, next.r)) return true;
      path.pop();
      visited[id] = 0;
    }
    return false;
  };

  return dfs(start.c, start.r) ? path : null;
}

export function genLevelFrom(seedBase: string, cfg: HeistCfg): HeistLevel {
  for (let attempt = 0; attempt < 120; attempt++) {
    const rng = mulberry32(hashSeed(`${seedBase}:${attempt}`));
    const { cols, rows } = cfg;
    const start: Cell = { c: 0, r: Math.floor(rows / 2) };
    const exit: Cell = { c: cols - 1, r: Math.floor(rows / 2) };
    const solution = buildReferenceRoute(cols, rows, start, exit, cfg.minSteps, rng);
    if (!solution) continue;

    // Place every gem visibly on the proven route, away from its endpoints.
    const gems: Cell[] = [];
    for (let i = 0; i < cfg.gems; i++) {
      const index = Math.floor(((i + 1) * (solution.length - 1)) / (cfg.gems + 1));
      const gem = solution[Math.max(1, Math.min(solution.length - 2, index))];
      if (gems.some((g) => g.c === gem.c && g.r === gem.r)) break;
      gems.push({ ...gem });
    }
    if (gems.length < cfg.gems) continue;

    // Patrol loops must cross the route so every guard matters, but the
    // reference timing is checked against same-cell, head-on, and side-crossing collisions.
    const guards: Guard[] = [];
    let guardTries = 0;
    while (guards.length < cfg.guards && guardTries < 600) {
      guardTries++;
      const w = 3 + Math.floor(rng() * 3);
      const h = 2 + Math.floor(rng() * 3);
      const x0 = 1 + Math.floor(rng() * (cols - w - 2));
      const y0 = Math.floor(rng() * (rows - h));
      const path = rectLoop(x0, y0, w, h);
      if (path.some((p) => (p.c === start.c && p.r === start.r) || (p.c === exit.c && p.r === exit.r))) continue;
      if (path.some((p) => gems.some((g) => g.c === p.c && g.r === p.r))) continue;
      if (!path.some((p) => solution.some((s) => s.c === p.c && s.r === p.r))) continue;
      const reverseCount = Math.round(cfg.guards * cfg.reverseGuardRatio);
      const direction: 1 | -1 = guards.length >= cfg.guards - reverseCount ? -1 : 1;
      const candidate: Guard = { path, offset: Math.floor(rng() * path.length), direction };
      let safe = true;
      for (let t = 1; t < solution.length; t++) {
        if (caughtAt([candidate], solution[t - 1], solution[t], t)) {
          safe = false;
          break;
        }
      }
      if (!safe) continue;
      const initial = guardAt(candidate, 0);
      if (guards.some((g) => {
        const other = guardAt(g, 0);
        return other.c === initial.c && other.r === initial.r;
      })) continue;
      guards.push(candidate);
    }
    if (guards.length < cfg.guards) continue;

    // Display cases never block the proven route, gems, or patrol loops.
    const walls: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const protectedCells = new Set<string>(solution.map((p) => `${p.c},${p.r}`));
    for (const guard of guards) {
      for (const p of guard.path) protectedCells.add(`${p.c},${p.r}`);
    }
    const wallCount = Math.floor(cols * rows * cfg.wallRatio);
    let wallsPlaced = 0;
    for (let tries = 0; wallsPlaced < wallCount && tries < wallCount * 12; tries++) {
      const c = Math.floor(rng() * cols);
      const r = Math.floor(rng() * rows);
      if (protectedCells.has(`${c},${r}`) || walls[r][c]) continue;
      walls[r][c] = true;
      wallsPlaced++;
    }

    return {
      cols,
      rows,
      walls,
      gems,
      start,
      exit,
      guards,
      solutionSteps: solution.length - 1,
      stepLimit: cfg.stepSlack === null ? null : solution.length - 1 + cfg.stepSlack,
      orderedGems: cfg.orderedGems,
    };
  }

  // Marked fallback so validation can reject any campaign seed that reaches it.
  const { cols, rows } = cfg;
  return {
    cols,
    rows,
    walls: Array.from({ length: rows }, () => Array(cols).fill(false)),
    gems: [{ c: Math.floor(cols / 2), r: 1 }],
    start: { c: 0, r: Math.floor(rows / 2) },
    exit: { c: cols - 1, r: Math.floor(rows / 2) },
    guards: [],
    solutionSteps: 0,
    stepLimit: null,
    orderedGems: cfg.orderedGems,
  };
}
