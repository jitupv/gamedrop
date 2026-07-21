// TILT core: swipe the whole board, tiles slide, 3+ in a line pop, cascades chain.
// Pure logic — no DOM. The component replays the emitted steps as animations.
import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export const SIZE = 7;
export const SPAWN_PER_MOVE = 3;

export interface Tile {
  id: number;
  c: number; // color index
}
export type Grid = (Tile | null)[][]; // [row][col]

export interface Dir {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
}

export type Step =
  | { type: "slide"; moves: { id: number; fromR: number; fromC: number; toR: number; toC: number }[] }
  | { type: "pop"; ids: number[]; points: number; chain: number; cells: { r: number; c: number; color: number }[] }
  | { type: "spawn"; tiles: { id: number; r: number; c: number; color: number }[] };

export interface LevelConfig {
  colors: number;
  target: number;
  moves: number;
}

export const LEVELS: LevelConfig[] = [
  { colors: 4, target: 1800, moves: 12 },
  { colors: 5, target: 2600, moves: 12 },
  { colors: 5, target: 4000, moves: 11 },
];

export interface TiltState {
  grid: Grid;
  nextId: number;
  rng: () => number;
  colors: number;
}

const EMPTY_START = 14; // a full board can't slide — always start with breathing room

export function newLevel(dayKey: string, levelIdx: number): TiltState {
  return newBoard(`tilt:${dayKey}:L${levelIdx}`, LEVELS[levelIdx].colors);
}

// endless mode & daily levels share one board factory
export function newBoard(seedStr: string, colors: number): TiltState {
  const cfg = { colors };
  const rng = mulberry32(hashSeed(seedStr));

  // pick which cells start empty (seeded shuffle)
  const order = Array.from({ length: SIZE * SIZE }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const empty = new Set(order.slice(0, EMPTY_START));

  let nextId = 1;
  const grid: Grid = [];
  for (let r = 0; r < SIZE; r++) {
    const row: (Tile | null)[] = [];
    for (let c = 0; c < SIZE; c++) {
      if (empty.has(r * SIZE + c)) {
        row.push(null);
        continue;
      }
      let col = 0;
      let guard = 0;
      do {
        col = Math.floor(rng() * cfg.colors);
        guard++;
      } while (
        guard < 20 &&
        ((c >= 2 && row[c - 1]?.c === col && row[c - 2]?.c === col) ||
          (r >= 2 && grid[r - 1][c]?.c === col && grid[r - 2][c]?.c === col))
      );
      row.push({ id: nextId++, c: col });
    }
    grid.push(row);
  }
  return { grid, nextId, rng, colors: cfg.colors };
}

function compact(grid: Grid, dir: Dir): Step & { type: "slide" } {
  const moves: { id: number; fromR: number; fromC: number; toR: number; toC: number }[] = [];
  const { dx, dy } = dir;
  for (let line = 0; line < SIZE; line++) {
    const coords: [number, number][] = [];
    for (let k = 0; k < SIZE; k++) {
      const r = dy === 0 ? line : dy === 1 ? SIZE - 1 - k : k;
      const c = dx === 0 ? line : dx === 1 ? SIZE - 1 - k : k;
      coords.push([r, c]);
    }
    let write = 0;
    for (let read = 0; read < SIZE; read++) {
      const [r, c] = coords[read];
      const t = grid[r][c];
      if (!t) continue;
      const [wr, wc] = coords[write];
      if (wr !== r || wc !== c) {
        grid[wr][wc] = t;
        grid[r][c] = null;
        moves.push({ id: t.id, fromR: r, fromC: c, toR: wr, toC: wc });
      }
      write++;
    }
  }
  return { type: "slide", moves };
}

function findRuns(grid: Grid): Set<number> {
  const ids = new Set<number>();
  for (let r = 0; r < SIZE; r++) {
    let c = 0;
    while (c < SIZE) {
      const t = grid[r][c];
      if (!t) {
        c++;
        continue;
      }
      let e = c;
      while (e + 1 < SIZE && grid[r][e + 1] && grid[r][e + 1]!.c === t.c) e++;
      if (e - c + 1 >= 3) for (let x = c; x <= e; x++) ids.add(grid[r][x]!.id);
      c = e + 1;
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let r = 0;
    while (r < SIZE) {
      const t = grid[r][c];
      if (!t) {
        r++;
        continue;
      }
      let e = r;
      while (e + 1 < SIZE && grid[e + 1][c] && grid[e + 1][c]!.c === t.c) e++;
      if (e - r + 1 >= 3) for (let x = r; x <= e; x++) ids.add(grid[x][c]!.id);
      r = e + 1;
    }
  }
  return ids;
}

function popByIds(grid: Grid, ids: Set<number>): { r: number; c: number; color: number }[] {
  const cells: { r: number; c: number; color: number }[] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      const t = grid[r][c];
      if (t && ids.has(t.id)) {
        cells.push({ r, c, color: t.c });
        grid[r][c] = null;
      }
    }
  return cells;
}

function scoreFor(n: number, chain: number): number {
  return (n * 15 + Math.max(0, n - 3) * 20) * chain;
}

export interface MoveResult {
  steps: Step[];
  points: number;
  changed: boolean;
  maxChain: number;
}

export function applyMove(state: TiltState, dir: Dir): MoveResult {
  const { grid } = state;
  const steps: Step[] = [];
  let points = 0;
  let chain = 0;
  let changed = false;

  const slide0 = compact(grid, dir);
  if (slide0.moves.length > 0) {
    changed = true;
    steps.push(slide0);
  }

  const cascade = () => {
    for (;;) {
      const runs = findRuns(grid);
      if (runs.size === 0) break;
      changed = true;
      chain++;
      const n = runs.size;
      const pts = scoreFor(n, chain);
      points += pts;
      const ids = [...runs];
      const cells = popByIds(grid, runs);
      steps.push({ type: "pop", ids, points: pts, chain, cells });
      const s = compact(grid, dir);
      if (s.moves.length > 0) steps.push(s);
    }
  };
  cascade();

  if (!changed) return { steps: [], points: 0, changed: false, maxChain: 0 };

  // spawn new tiles, then let any accidental matches cascade too (no further spawns)
  const empties: [number, number][] = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) if (!grid[r][c]) empties.push([r, c]);
  const k = Math.min(SPAWN_PER_MOVE, empties.length);
  if (k > 0) {
    const tiles: { id: number; r: number; c: number; color: number }[] = [];
    for (let i = 0; i < k; i++) {
      const idx = Math.floor(state.rng() * empties.length);
      const [r, c] = empties.splice(idx, 1)[0];
      const color = Math.floor(state.rng() * state.colors);
      const t: Tile = { id: state.nextId++, c: color };
      grid[r][c] = t;
      tiles.push({ id: t.id, r, c, color });
    }
    steps.push({ type: "spawn", tiles });
    cascade();
  }

  return { steps, points, changed: true, maxChain: chain };
}

// What WOULD happen on this swipe — where tiles land and which pop — without
// touching real state. Powers the drag preview so moves are readable before commit.
export function previewMove(
  state: TiltState,
  dir: Dir
): { dest: { id: number; toR: number; toC: number }[]; popIds: number[] } {
  const clone: Grid = state.grid.map((row) => row.map((t) => (t ? { ...t } : null)));
  const s = compact(clone, dir);
  const runs = findRuns(clone);
  return { dest: s.moves.map((m) => ({ id: m.id, toR: m.toR, toC: m.toC })), popIds: [...runs] };
}

// A board is dead when no direction moves a single tile (i.e. completely jammed).
export function hasAnyMove(state: TiltState): boolean {
  const dirs: Dir[] = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  for (const dir of dirs) {
    const clone: Grid = state.grid.map((row) => row.map((t) => (t ? { ...t } : null)));
    if (compact(clone, dir).moves.length > 0) return true;
  }
  return false;
}
