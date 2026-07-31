// SONAR core: deterministic maze generation. Pure logic - no DOM.
import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export interface Cell {
  c: number;
  r: number;
}

export interface SonarCfg {
  cols: number;
  rows: number;
  extraRatio: number;
  pingRadius: number;
  pingLife: number;
  trailAlpha: number;
}

export interface SonarLevel extends SonarCfg {
  grid: number[][]; // 1 = wall, 0 = floor
  start: Cell;
  exit: Cell;
  solutionSteps: number;
  parPings: number;
  twoStarPings: number;
  pingLimit: number;
}

type MazeBase = SonarCfg & Pick<SonarLevel, "grid" | "start">;

export const TOTAL_LEVELS = 100;

export function levelCfg(levelIdx: number): SonarCfg {
  const n = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  const difficulty = n / (TOTAL_LEVELS - 1);
  let cols: number;
  let rows: number;

  // The opening ten levels ramp visibly; later growth is steadier so the
  // board remains usable on phones.
  if (n < 10) {
    cols = 9 + 2 * Math.floor(n / 3);
    rows = 7 + 2 * Math.floor(n / 4);
  } else {
    const progress = (n - 9) / 90;
    cols = 15 + 2 * Math.floor(progress * 8);
    rows = 11 + 2 * Math.floor(progress * 5);
  }

  return {
    cols,
    rows,
    extraRatio: 0.075 - difficulty * 0.055,
    pingRadius: 5.2 - difficulty * 2.4,
    pingLife: 1.6 - difficulty * 0.7,
    trailAlpha: 0.07 - difficulty * 0.045,
  };
}

function chooseExit(grid: number[][], start: Cell, minimumSteps: number): { exit: Cell; steps: number } {
  const rows = grid.length;
  const cols = grid[0].length;
  const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
  const queue: { c: number; r: number; steps: number }[] = [{ ...start, steps: 0 }];
  seen[start.r][start.c] = true;
  let head = 0;
  let best = { exit: { ...start }, steps: 0 };
  let eligible: { exit: Cell; steps: number } | null = null;

  while (head < queue.length) {
    const cur = queue[head++];
    if (cur.c % 2 === 1 && cur.r % 2 === 1) {
      if (cur.steps > best.steps) best = { exit: { c: cur.c, r: cur.r }, steps: cur.steps };
      if (cur.steps >= minimumSteps && (!eligible || cur.steps < eligible.steps)) {
        eligible = { exit: { c: cur.c, r: cur.r }, steps: cur.steps };
      }
    }
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const c = cur.c + dc;
      const r = cur.r + dr;
      if (c < 0 || r < 0 || c >= cols || r >= rows || grid[r][c] === 1 || seen[r][c]) continue;
      seen[r][c] = true;
      queue.push({ c, r, steps: cur.steps + 1 });
    }
  }
  return eligible ?? best;
}

function buildMaze(seedStr: string, cfg: SonarCfg): MazeBase {
  const rng = mulberry32(hashSeed(seedStr));
  const { cols, rows } = cfg;
  const grid: number[][] = Array.from({ length: rows }, () => Array(cols).fill(1));

  // Recursive backtracker over odd cells creates one connected maze.
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

  // Early levels get more alternate routes; later levels preserve more dead ends.
  const extra = Math.floor(cols * rows * cfg.extraRatio);
  for (let i = 0; i < extra; i++) {
    const c = 1 + Math.floor(rng() * (cols - 2));
    const r = 1 + Math.floor(rng() * (rows - 2));
    if (grid[r][c] !== 1) continue;
    const horiz = grid[r][c - 1] === 0 && grid[r][c + 1] === 0;
    const vert = grid[r - 1][c] === 0 && grid[r + 1][c] === 0;
    if (horiz !== vert) grid[r][c] = 0;
  }

  return {
    ...cfg,
    grid,
    start: { c: 1, r: 1 },
  };
}

const campaignCaches = new Map<string, SonarLevel[]>();

function buildCampaignLevel(
  levelIdx: number,
  seasonKey: string,
  campaignCache: SonarLevel[]
): SonarLevel {
  const cfg = levelCfg(levelIdx);
  const priorSteps = campaignCache[levelIdx - 1]?.solutionSteps ?? 0;
  const targetSteps =
    levelIdx < 10
      ? 10 + levelIdx * 2
      : 28 + 2 * Math.floor((levelIdx - 9) * 0.6);
  const minimumSteps = Math.max(priorSteps, targetSteps);
  const candidates: { maze: MazeBase; exit: Cell; steps: number }[] = [];

  // Choose the shortest candidate that is at least as long as the previous
  // level. Visibility and breadcrumbs also tighten every level.
  for (let attempt = 0; attempt < 48; attempt++) {
    const maze = buildMaze(`sonar:weekly:v1:${seasonKey}:L${levelIdx + 1}:${attempt}`, cfg);
    const choice = chooseExit(maze.grid, maze.start, minimumSteps);
    candidates.push({ maze, ...choice });
  }
  candidates.sort((a, b) => a.steps - b.steps);
  const chosen =
    candidates.find((candidate) => candidate.steps >= minimumSteps) ??
    candidates[candidates.length - 1];

  const parPings = Math.max(2, Math.ceil(chosen.steps / (cfg.pingRadius * 2.2)));
  const pingLimit = parPings + Math.max(4, Math.ceil(parPings * 0.5));
  const twoStarPings = parPings + Math.ceil((pingLimit - parPings) / 2);
  return {
    ...chosen.maze,
    exit: chosen.exit,
    solutionSteps: chosen.steps,
    parPings,
    twoStarPings,
    pingLimit,
  };
}

export function genProgressLevel(levelIdx: number, seasonKey = "all"): SonarLevel {
  const safeIndex = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  const campaignCache = campaignCaches.get(seasonKey) ?? [];
  campaignCaches.set(seasonKey, campaignCache);
  while (campaignCache.length <= safeIndex) {
    campaignCache.push(buildCampaignLevel(campaignCache.length, seasonKey, campaignCache));
  }
  return campaignCache[safeIndex];
}

export function starsForPings(level: SonarLevel, pings: number): number {
  if (pings <= level.parPings) return 3;
  if (pings <= level.twoStarPings) return 2;
  return 1;
}
