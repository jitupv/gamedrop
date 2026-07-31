// PRISM core: seeded grid generation + beam simulation.
// Generation is construct-then-place, not generate-then-search: a valid beam
// path is built directly (walk, bend, walk, bend...) using the level's intended
// route length, targets are dropped ON that path (never on a bend cell, since
// a mirror can't share a cell with a target), and cosmetic walls are scattered
// everywhere the path doesn't go. This guarantees a solution exists by
// construction - no search needed, no risk of an unsolvable board - and stays
// fast even as boards grow. The only search left is a cheap "reject if solvable
// with 0-1 mirrors" quality check. The beam may never cross a cell it has
// already visited - a clean, visible constraint (you can see your own trail)
// that also keeps that quality check's search small.
import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export interface Cell {
  c: number;
  r: number;
}

export type MirrorType = "/" | "\\";
export type Dir = 0 | 1 | 2 | 3; // E, S, W, N

// (dx, dy) for each Dir - row increases downward, col increases rightward
export const DIR_VECS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

export interface PrismLevel {
  cols: number;
  rows: number;
  walls: boolean[][];
  targets: Cell[];
  emitter: { cell: Cell; dir: Dir };
  receiver: Cell;
  budget: number; // max mirrors that may be placed at once
  par: number; // expected minimum mirrors for 3 stars
}

export interface PrismCfg {
  cols: number;
  rows: number;
  targets: number;
  routeMirrors: number;
  wallRatio: number;
}

export const TOTAL_LEVELS = 100;

// Fixed progression shared by every player. Difficulty rises through larger
// boards, longer routes, more targets, and more blocking walls.
export function levelCfg(levelIdx: number): PrismCfg {
  const n = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  if (n < 10) {
    return {
      cols: 7 + Math.floor(n / 3),
      rows: 7 + Math.floor(n / 4),
      targets: 3 + Math.floor(n / 2),
      routeMirrors: 2 + Math.floor((n + 1) / 2),
      wallRatio: 0.05 + n * 0.006,
    };
  }

  const advanced = n - 9;
  return {
    cols: Math.min(14, 10 + Math.floor(advanced / 18)),
    rows: Math.min(12, 9 + Math.floor(advanced / 25)),
    targets: Math.min(12, 7 + Math.floor(advanced / 18)),
    routeMirrors: Math.min(14, 7 + Math.floor(advanced / 13)),
    wallRatio: Math.min(0.22, 0.1 + advanced * 0.00135),
  };
}

function reflectSlash(dx: number, dy: number): [number, number] {
  return [-dy, -dx]; // "/" mirror: E<->N, W<->S
}
function reflectBack(dx: number, dy: number): [number, number] {
  return [dy, dx]; // "\" mirror: E<->S, W<->N
}
export function reflect(dx: number, dy: number, type: MirrorType): [number, number] {
  return type === "/" ? reflectSlash(dx, dy) : reflectBack(dx, dy);
}

export function isPlaceable(level: Pick<PrismLevel, "walls" | "emitter" | "receiver" | "targets">, c: number, r: number): boolean {
  if (level.walls[r][c]) return false;
  if (level.emitter.cell.c === c && level.emitter.cell.r === r) return false;
  if (level.receiver.c === c && level.receiver.r === r) return false;
  if (level.targets.some((t) => t.c === c && t.r === r)) return false;
  return true;
}

function targetIndexAt(targets: Cell[], c: number, r: number): number {
  return targets.findIndex((t) => t.c === c && t.r === r);
}

export interface TraceResult {
  path: Cell[];
  hitTargets: Set<number>;
  outcome: "receiver" | "wall" | "escaped" | "looping";
}

// live beam trace - used every frame during play with the player's own mirrors
export function traceBeam(level: PrismLevel, mirrors: Map<string, MirrorType>): TraceResult {
  const { cols, rows, walls, targets, emitter, receiver } = level;
  let c = emitter.cell.c;
  let r = emitter.cell.r;
  let [dx, dy] = DIR_VECS[emitter.dir];
  const path: Cell[] = [{ c, r }];
  const hit = new Set<number>();
  const t0 = targetIndexAt(targets, c, r);
  if (t0 !== -1) hit.add(t0);

  const seen = new Set<string>();
  const maxSteps = cols * rows * 4 + 40;
  for (let step = 0; step < maxSteps; step++) {
    const stateKey = `${c},${r},${dx},${dy}`;
    if (seen.has(stateKey)) return { path, hitTargets: hit, outcome: "looping" };
    seen.add(stateKey);

    const nc = c + dx;
    const nr = r + dy;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) return { path, hitTargets: hit, outcome: "escaped" };
    if (walls[nr][nc]) return { path, hitTargets: hit, outcome: "wall" };
    c = nc;
    r = nr;
    path.push({ c, r });
    const ti = targetIndexAt(targets, c, r);
    if (ti !== -1) hit.add(ti);
    if (c === receiver.c && r === receiver.r) return { path, hitTargets: hit, outcome: "receiver" };
    const m = mirrors.get(`${c},${r}`);
    if (m) [dx, dy] = reflect(dx, dy, m);
  }
  return { path, hitTargets: hit, outcome: "looping" };
}

export function isSolved(level: PrismLevel, trace: TraceResult): boolean {
  return trace.outcome === "receiver" && trace.hitTargets.size === level.targets.length;
}

// self-avoiding DFS: does SOME mirror placement using at most `maxMirrors`
// mirrors thread every target and reach the receiver? Node-budgeted, same
// pragmatic approach HEIST's fullLootRoute uses. Only used here for the cheap
// "is this solvable with 0-1 mirrors" quality check - real solvability comes
// from construction, not this search.
function canSolveWithinMirrors(
  level: Omit<PrismLevel, "budget" | "par">,
  maxMirrors: number,
  nodeBudget = 120000
): boolean {
  const fullMask = (1 << level.targets.length) - 1;
  const visitedCells = new Set<string>();
  let nodes = 0;

  const dfs = (c: number, r: number, dx: number, dy: number, mask: number, used: number): boolean => {
    if (nodes++ > nodeBudget) return false;

    const tryDir = (ndx: number, ndy: number, placedNew: boolean): boolean => {
      const nc = c + ndx;
      const nr = r + ndy;
      if (nc < 0 || nr < 0 || nc >= level.cols || nr >= level.rows) return false;
      if (level.walls[nr][nc]) return false;
      const key = `${nc},${nr}`;
      if (visitedCells.has(key)) return false; // the beam can't cross its own path
      let nmask = mask;
      const ti = targetIndexAt(level.targets, nc, nr);
      if (ti !== -1) nmask |= 1 << ti;
      const nused = used + (placedNew ? 1 : 0);
      if (nc === level.receiver.c && nr === level.receiver.r) return nmask === fullMask;
      if (nused > maxMirrors) return false;
      visitedCells.add(key);
      const ok = dfs(nc, nr, ndx, ndy, nmask, nused);
      visitedCells.delete(key);
      return ok;
    };

    if (tryDir(dx, dy, false)) return true;
    if (used < maxMirrors && isPlaceable(level, c, r)) {
      const [ax, ay] = reflectSlash(dx, dy);
      if (tryDir(ax, ay, true)) return true;
      const [bx, by] = reflectBack(dx, dy);
      if (tryDir(bx, by, true)) return true;
    }
    return false;
  };

  const start = level.emitter.cell;
  visitedCells.add(`${start.c},${start.r}`);
  const [edx, edy] = DIR_VECS[level.emitter.dir];
  let startMask = 0;
  const ti0 = targetIndexAt(level.targets, start.c, start.r);
  if (ti0 !== -1) startMask |= 1 << ti0;
  return dfs(start.c, start.r, edx, edy, startMask, 0);
}

export function genLevelFrom(seedBase: string, cfg: PrismCfg): PrismLevel {
  const { cols, rows, targets: targetCount, routeMirrors, wallRatio } = cfg;
  const maxRun = Math.max(4, Math.floor((cols + rows) / 4));

  for (let attempt = 0; attempt < 240; attempt++) {
    const rng = mulberry32(hashSeed(`${seedBase}:${attempt}`));
    const visited = new Set<string>();
    const emitterRow = 1 + Math.floor(rng() * (rows - 2));
    let c = 0;
    let r = emitterRow;
    let dirIdx: Dir = 0; // East
    visited.add(`${c},${r}`);
    // segment = how many bends precede this cell - segment 0 is the emitter's
    // first straight run, reachable with zero mirrors, so nothing eligible for
    // a target may come from it (that would be a free, unearned hit)
    const pathCells: (Cell & { segment: number })[] = [{ c, r, segment: 0 }];
    const mirrorsSolution = new Map<string, MirrorType>();
    let segment = 0;
    let ok = true;

    // walk the beam's own solution: a random-length straight run, a bend, repeat,
    // ending on a final run whose endpoint becomes the receiver. Runs are at
    // least 2 cells so bends can't sit immediately next to each other - short
    // adjacent bends are the easiest pattern to brute-force guess.
    for (let bend = 0; bend <= routeMirrors; bend++) {
      const isLast = bend === routeMirrors;
      const [dx, dy] = DIR_VECS[dirIdx];
      const desired = 2 + Math.floor(rng() * (maxRun - 1));
      let steps = 0;
      let cc = c;
      let rr = r;
      for (let s = 0; s < desired; s++) {
        const nc = cc + dx;
        const nr = rr + dy;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) break;
        if (visited.has(`${nc},${nr}`)) break; // never cross the path's own trail
        cc = nc;
        rr = nr;
        steps++;
      }
      if (steps === 0) {
        ok = false; // boxed in - abandon this attempt, try a fresh seed
        break;
      }
      for (let s = 1; s <= steps; s++) {
        c += dx;
        r += dy;
        visited.add(`${c},${r}`);
        pathCells.push({ c, r, segment });
      }
      if (isLast) break;
      segment++;

      // bend to one of the two directions perpendicular to the current heading
      // (a 45-degree mirror only ever turns 90 degrees, never straight or back)
      const horiz = dirIdx === 0 || dirIdx === 2;
      const options: Dir[] = horiz ? [1, 3] : [0, 2];
      const newDir = options[rng() < 0.5 ? 0 : 1];
      const [ndx, ndy] = DIR_VECS[newDir];
      const [sx, sy] = reflectSlash(dx, dy);
      const type: MirrorType = sx === ndx && sy === ndy ? "/" : "\\";
      mirrorsSolution.set(`${c},${r}`, type);
      dirIdx = newDir;
    }
    if (!ok) continue;

    const receiver: Cell = { c, r };
    const emitter = { cell: { c: 0, r: emitterRow }, dir: 0 as Dir };

    // targets live on the solution path itself (guaranteeing the beam crosses
    // them when the intended mirrors are placed), never on a bend cell (a
    // mirror and a target can't share a cell), and never on segment 0 (every
    // target must require at least one correct mirror already placed)
    const interior = pathCells
      .slice(1, -1)
      .filter(
        (p) =>
          !(p.c === receiver.c && p.r === receiver.r) &&
          !mirrorsSolution.has(`${p.c},${p.r}`) &&
          p.segment >= 1
      );
    if (interior.length < targetCount) continue;
    const seenTargets = new Set<string>();
    const targets: Cell[] = [];
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.min(interior.length - 1, Math.floor((i + 0.5) * (interior.length / targetCount)));
      const p = interior[idx];
      const key = `${p.c},${p.r}`;
      if (seenTargets.has(key)) continue;
      seenTargets.add(key);
      targets.push(p);
    }
    if (targets.length < targetCount) continue;

    // cosmetic walls, scattered anywhere the solution path doesn't run
    const walls: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
    const wallCount = Math.floor(cols * rows * wallRatio);
    let wallsPlaced = 0;
    for (let tries = 0; wallsPlaced < wallCount && tries < wallCount * 10; tries++) {
      const wc = Math.floor(rng() * cols);
      const wr = Math.floor(rng() * rows);
      if (visited.has(`${wc},${wr}`) || walls[wr][wc]) continue;
      walls[wr][wc] = true;
      wallsPlaced++;
    }

    const bare = { cols, rows, walls, targets, emitter, receiver };
    if (canSolveWithinMirrors(bare, 1)) continue; // a shortcut exists - too easy, reject
    // also reject anything solvable well under the intended budget - the
    // board should genuinely need most of what it hands out
    if (routeMirrors >= 3 && canSolveWithinMirrors(bare, routeMirrors - 2)) continue;
    const par = canSolveWithinMirrors(bare, routeMirrors - 1)
      ? routeMirrors - 1
      : routeMirrors;
    return { ...bare, budget: par + 2, par };
  }

  // deterministic fallback: a straight, trivial shot (should practically never trigger)
  const emitter = { cell: { c: 0, r: Math.floor(rows / 2) }, dir: 0 as Dir };
  const receiver: Cell = { c: cols - 1, r: Math.floor(rows / 2) };
  return {
    cols,
    rows,
    walls: Array.from({ length: rows }, () => Array(cols).fill(false)),
    targets: [{ c: Math.floor(cols / 2), r: Math.floor(rows / 2) }],
    emitter,
    receiver,
    budget: routeMirrors + 2,
    par: 0,
  };
}

export function genProgressLevel(levelIdx: number, seasonKey = "all"): PrismLevel {
  const safeIndex = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  const cfg = levelCfg(safeIndex);
  let level = genLevelFrom(`prism:weekly:v1:${seasonKey}:L${safeIndex + 1}:0`, cfg);
  for (let variant = 1; (level.par === 0 || level.targets.length !== cfg.targets) && variant < 12; variant++) {
    level = genLevelFrom(
      `prism:weekly:v1:${seasonKey}:L${safeIndex + 1}:${variant}`,
      cfg
    );
  }
  return level;
}

export function starsFor(mirrorsUsed: number, par: number): number {
  if (mirrorsUsed <= par) return 3;
  if (mirrorsUsed === par + 1) return 2;
  return 1;
}
