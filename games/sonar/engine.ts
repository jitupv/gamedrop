// SONAR core: seeded maze generation. Pure logic - no DOM.
import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export interface Cell {
  c: number;
  r: number;
}

export interface SonarLevel {
  cols: number;
  rows: number;
  grid: number[][]; // 1 = wall, 0 = floor
  start: Cell;
  exit: Cell;
}

export const LEVELS = [
  { cols: 17, rows: 11 },
  { cols: 23, rows: 15 },
  { cols: 29, rows: 17 },
];

export function genMaze(dayKey: string, levelIdx: number): SonarLevel {
  const { cols, rows } = LEVELS[levelIdx];
  return genMazeCfg(`sonar:${dayKey}:L${levelIdx}`, cols, rows);
}

// endless: mazes keep growing, and the lantern (time budget) gets tighter per cell
export function endlessMazeSize(i: number): { cols: number; rows: number } {
  return { cols: Math.min(29, 13 + 2 * i), rows: Math.min(17, 9 + 2 * Math.floor(i / 2)) };
}

export function lanternBudget(cols: number, rows: number): number {
  return Math.round(14 + (cols * rows) / 9); // seconds to escape before the dark wins
}

export function genMazeCfg(seedStr: string, cols: number, rows: number): SonarLevel {
  const rng = mulberry32(hashSeed(seedStr));
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(1));

  // recursive backtracker over odd cells
  const stack: [number, number][] = [[1, 1]];
  grid[1][1] = 0;
  while (stack.length > 0) {
    const [c, r] = stack[stack.length - 1];
    const dirs = [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
    ]
      .map((d) => ({ d, k: rng() }))
      .sort((a, b) => a.k - b.k);
    let moved = false;
    for (const { d } of dirs) {
      const nc = c + d[0];
      const nr = r + d[1];
      if (nc > 0 && nc < cols - 1 && nr > 0 && nr < rows - 1 && grid[nr][nc] === 1) {
        grid[nr][nc] = 0;
        grid[r + d[1] / 2][c + d[0] / 2] = 0;
        stack.push([nc, nr]);
        moved = true;
        break;
      }
    }
    if (!moved) stack.pop();
  }

  // knock out a few walls so there are alternate routes (less dead-end frustration)
  const extra = Math.floor(cols * rows * 0.03);
  for (let i = 0; i < extra; i++) {
    const c = 1 + Math.floor(rng() * (cols - 2));
    const r = 1 + Math.floor(rng() * (rows - 2));
    if (grid[r][c] !== 1) continue;
    const horiz = grid[r][c - 1] === 0 && grid[r][c + 1] === 0;
    const vert = grid[r - 1][c] === 0 && grid[r + 1][c] === 0;
    if (horiz !== vert) grid[r][c] = 0; // only simple wall segments, keep borders intact
  }

  return { cols, rows, grid, start: { c: 1, r: 1 }, exit: { c: cols - 2, r: rows - 2 } };
}
