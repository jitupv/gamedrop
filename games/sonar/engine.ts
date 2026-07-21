// SONAR core: seeded maze generation. Pure logic — no DOM.
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
  { cols: 13, rows: 9 },
  { cols: 17, rows: 11 },
  { cols: 21, rows: 13 },
];

export function genMaze(dayKey: string, levelIdx: number): SonarLevel {
  const { cols, rows } = LEVELS[levelIdx];
  const rng = mulberry32(hashSeed(`sonar:${dayKey}:L${levelIdx}`));
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
