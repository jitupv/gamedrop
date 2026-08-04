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

export interface FixedMirror extends Cell {
  type: MirrorType;
}

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
  fixedMirrors: FixedMirror[];
  budget: number; // max mirrors that may be placed at once
  par: number; // solver-verified minimum movable mirrors for 3 stars
  noCrossing: boolean;
  orderedTargets: boolean;
}

export interface PrismCfg {
  cols: number;
  rows: number;
  targets: number;
  routeMirrors: number;
  wallRatio: number;
  fixedMirrors: number;
  noCrossing: boolean;
  orderedTargets: boolean;
}

export const TOTAL_LEVELS = 100;
export const MIRROR_ALLOWANCE = 3;

// Fixed progression shared by every player. Advanced values rise every few
// levels instead of sitting on long 10-13 level plateaus. Every generated
// board separately verifies its minimum and then grants three extra mirrors.
export function levelCfg(levelIdx: number): PrismCfg {
  const n = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  if (n < 10) {
    return {
      cols: 7 + Math.floor(n / 3),
      rows: 7 + Math.floor(n / 4),
      targets: 3 + Math.floor(n / 2),
      routeMirrors: 2 + Math.floor((n + 1) / 2),
      wallRatio: 0.06 + n * 0.007,
      fixedMirrors: 0,
      noCrossing: false,
      orderedTargets: false,
    };
  }

  const advanced = n - 9;
  return {
    cols: Math.min(15, 10 + Math.floor(advanced / 12)),
    rows: Math.min(14, 9 + Math.floor(advanced / 18)),
    targets: Math.min(16, 7 + Math.floor(advanced / 9)),
    routeMirrors: Math.min(18, 7 + Math.floor(advanced / 7)),
    wallRatio: Math.min(0.29, 0.12 + advanced * 0.0019),
    fixedMirrors: n < 50 ? 0 : n < 60 ? 1 : n < 75 ? 2 : n < 90 ? 3 : 4,
    noCrossing: n >= 25,
    orderedTargets: n >= 75,
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

export function isPlaceable(
  level: Pick<PrismLevel, "walls" | "emitter" | "receiver" | "targets" | "fixedMirrors">,
  c: number,
  r: number
): boolean {
  if (level.walls[r][c]) return false;
  if (level.emitter.cell.c === c && level.emitter.cell.r === r) return false;
  if (level.receiver.c === c && level.receiver.r === r) return false;
  if (level.targets.some((t) => t.c === c && t.r === r)) return false;
  if (level.fixedMirrors.some((mirror) => mirror.c === c && mirror.r === r)) return false;
  return true;
}

function targetIndexAt(targets: Cell[], c: number, r: number): number {
  return targets.findIndex((t) => t.c === c && t.r === r);
}

function chooseFixedMirrors(
  solution: Map<string, MirrorType>,
  requested: number
): FixedMirror[] {
  const entries = [...solution.entries()];
  const count = Math.min(requested, Math.max(0, entries.length - 2));
  const chosen: FixedMirror[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    let index = Math.min(entries.length - 1, Math.floor((i + 0.5) * (entries.length / count)));
    while (used.has(index) && index + 1 < entries.length) index++;
    used.add(index);
    const [key, type] = entries[index];
    const [c, r] = key.split(",").map(Number);
    chosen.push({ c, r, type });
  }
  return chosen;
}

export interface TraceResult {
  path: Cell[];
  hitTargets: Set<number>;
  hitOrder: number[];
  outcome: "receiver" | "wall" | "escaped" | "looping" | "crossing";
}

// live beam trace - used every frame during play with the player's own mirrors
export function traceBeam(level: PrismLevel, mirrors: Map<string, MirrorType>): TraceResult {
  const { cols, rows, walls, targets, emitter, receiver } = level;
  let c = emitter.cell.c;
  let r = emitter.cell.r;
  let [dx, dy] = DIR_VECS[emitter.dir];
  const path: Cell[] = [{ c, r }];
  const hit = new Set<number>();
  const hitOrder: number[] = [];
  const fixedMirrors = new Map(
    level.fixedMirrors.map((mirror) => [`${mirror.c},${mirror.r}`, mirror.type] as const)
  );
  const t0 = targetIndexAt(targets, c, r);
  if (t0 !== -1) {
    hit.add(t0);
    hitOrder.push(t0);
  }

  const seen = new Set<string>();
  const visitedCells = new Set<string>([`${c},${r}`]);
  const maxSteps = cols * rows * 4 + 40;
  for (let step = 0; step < maxSteps; step++) {
    const stateKey = `${c},${r},${dx},${dy}`;
    if (seen.has(stateKey)) return { path, hitTargets: hit, hitOrder, outcome: "looping" };
    seen.add(stateKey);

    const nc = c + dx;
    const nr = r + dy;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) {
      return { path, hitTargets: hit, hitOrder, outcome: "escaped" };
    }
    if (walls[nr][nc]) return { path, hitTargets: hit, hitOrder, outcome: "wall" };
    if (level.noCrossing && visitedCells.has(`${nc},${nr}`)) {
      return { path, hitTargets: hit, hitOrder, outcome: "crossing" };
    }
    c = nc;
    r = nr;
    path.push({ c, r });
    visitedCells.add(`${c},${r}`);
    const ti = targetIndexAt(targets, c, r);
    if (ti !== -1 && !hit.has(ti)) {
      hit.add(ti);
      hitOrder.push(ti);
    }
    if (c === receiver.c && r === receiver.r) {
      return { path, hitTargets: hit, hitOrder, outcome: "receiver" };
    }
    const m = fixedMirrors.get(`${c},${r}`) ?? mirrors.get(`${c},${r}`);
    if (m) [dx, dy] = reflect(dx, dy, m);
  }
  return { path, hitTargets: hit, hitOrder, outcome: "looping" };
}

export function isSolved(level: PrismLevel, trace: TraceResult): boolean {
  const correctOrder =
    !level.orderedTargets || trace.hitOrder.every((target, index) => target === index);
  return (
    trace.outcome === "receiver" &&
    trace.hitTargets.size === level.targets.length &&
    correctOrder
  );
}

type SolveCheck = "solved" | "unsolved" | "exhausted";

// Self-avoiding DFS used to prove the minimum movable-mirror count. Exhaustion
// is distinct from "unsolved": a board is discarded if the search budget is
// reached, so an uncertain result can never be presented as a verified par.
function canSolveWithinMirrors(
  level: Omit<PrismLevel, "budget" | "par">,
  maxMirrors: number,
  nodeBudget = 120000
): SolveCheck {
  const fullMask = (1 << level.targets.length) - 1;
  const visitedCells = new Set<string>();
  let nodes = 0;
  let exhausted = false;

  const dfs = (c: number, r: number, dx: number, dy: number, mask: number, used: number): boolean => {
    if (nodes++ > nodeBudget) {
      exhausted = true;
      return false;
    }

    const tryDir = (ndx: number, ndy: number, placedNew: boolean): boolean => {
      const nc = c + ndx;
      const nr = r + ndy;
      if (nc < 0 || nr < 0 || nc >= level.cols || nr >= level.rows) return false;
      if (level.walls[nr][nc]) return false;
      const key = `${nc},${nr}`;
      if (visitedCells.has(key)) return false; // the beam can't cross its own path
      let nmask = mask;
      const ti = targetIndexAt(level.targets, nc, nr);
      if (ti !== -1 && (nmask & (1 << ti)) === 0) {
        if (level.orderedTargets) {
          let expected = 0;
          while ((nmask & (1 << expected)) !== 0) expected++;
          if (ti !== expected) return false;
        }
        nmask |= 1 << ti;
      }
      const nused = used + (placedNew ? 1 : 0);
      if (nc === level.receiver.c && nr === level.receiver.r) return nmask === fullMask;
      if (nused > maxMirrors) return false;
      visitedCells.add(key);
      const ok = dfs(nc, nr, ndx, ndy, nmask, nused);
      visitedCells.delete(key);
      return ok;
    };

    const fixed = level.fixedMirrors.find((mirror) => mirror.c === c && mirror.r === r);
    if (fixed) {
      const [fdx, fdy] = reflect(dx, dy, fixed.type);
      return tryDir(fdx, fdy, false);
    }
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
  const solved = dfs(start.c, start.r, edx, edy, startMask, 0);
  return solved ? "solved" : exhausted ? "exhausted" : "unsolved";
}

export function genLevelFrom(seedBase: string, cfg: PrismCfg): PrismLevel {
  const {
    cols,
    rows,
    targets: targetCount,
    routeMirrors,
    wallRatio,
    fixedMirrors: requestedFixedMirrors,
    noCrossing,
    orderedTargets,
  } = cfg;
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

    const fixedMirrors = chooseFixedMirrors(mirrorsSolution, requestedFixedMirrors);
    const variableMirrors = routeMirrors - fixedMirrors.length;
    const bare = {
      cols,
      rows,
      walls,
      targets,
      emitter,
      receiver,
      fixedMirrors,
      noCrossing,
      orderedTargets,
    };
    const oneMirrorCheck = canSolveWithinMirrors(bare, 1);
    if (oneMirrorCheck !== "unsolved") continue; // too easy or not fully verified
    // also reject anything solvable well under the intended budget - the
    // board should genuinely need most of what it hands out
    if (variableMirrors >= 3) {
      const shortcutCheck = canSolveWithinMirrors(bare, variableMirrors - 2);
      if (shortcutCheck !== "unsolved") continue;
    }
    const nearParCheck = canSolveWithinMirrors(bare, variableMirrors - 1);
    if (nearParCheck === "exhausted") continue;
    const par = nearParCheck === "solved" ? variableMirrors - 1 : variableMirrors;
    return {
      ...bare,
      budget: par + MIRROR_ALLOWANCE,
      par,
    };
  }

  // Deterministic non-trivial fallback. A horizontal snake supplies the full
  // configured mirror count and target count, so a rare exhausted random
  // search can never turn a late level into the old zero-mirror straight shot.
  const emitter = { cell: { c: 0, r: 1 }, dir: 0 as Dir };
  const fallbackPath: (Cell & { segment: number })[] = [
    { ...emitter.cell, segment: 0 },
  ];
  const fallbackMirrors = new Map<string, MirrorType>();
  const fallbackVisited = new Set<string>([`${emitter.cell.c},${emitter.cell.r}`]);
  let fc = emitter.cell.c;
  let fr = emitter.cell.r;
  let fallbackDir: Dir = 0;
  let fallbackSegment = 0;

  for (let bend = 0; bend <= routeMirrors; bend++) {
    const isLast = bend === routeMirrors;
    const horizontal: boolean = fallbackDir === 0 || fallbackDir === 2;
    const steps: number = horizontal
      ? fallbackDir === 0
        ? cols - 1 - fc
        : fc
      : 1;
    const [dx, dy] = DIR_VECS[fallbackDir];
    for (let step = 0; step < steps; step++) {
      fc += dx;
      fr += dy;
      fallbackVisited.add(`${fc},${fr}`);
      fallbackPath.push({ c: fc, r: fr, segment: fallbackSegment });
    }
    if (isLast) break;
    const nextDir: Dir = horizontal ? 1 : fc === cols - 1 ? 2 : 0;
    const [ndx, ndy] = DIR_VECS[nextDir];
    const [sdx, sdy] = reflectSlash(dx, dy);
    fallbackMirrors.set(`${fc},${fr}`, sdx === ndx && sdy === ndy ? "/" : "\\");
    fallbackSegment++;
    fallbackDir = nextDir;
  }

  const receiver: Cell = { c: fc, r: fr };
  const eligibleTargets = fallbackPath.slice(1, -1).filter(
    (cell) => cell.segment >= 1 && !fallbackMirrors.has(`${cell.c},${cell.r}`)
  );
  const fallbackTargets: Cell[] = [];
  for (let i = 0; i < targetCount; i++) {
    const index = Math.min(
      eligibleTargets.length - 1,
      Math.floor((i + 0.5) * (eligibleTargets.length / targetCount))
    );
    fallbackTargets.push({ c: eligibleTargets[index].c, r: eligibleTargets[index].r });
  }

  // Seal every non-route cell so this rare fallback is a one-cell corridor.
  // Every non-fixed bend is therefore mandatory, which proves its minimum by
  // construction even if the bounded verifier exhausted all random variants.
  const fallbackWalls: boolean[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => !fallbackVisited.has(`${c},${r}`))
  );

  const fixedMirrors = chooseFixedMirrors(fallbackMirrors, requestedFixedMirrors);
  const variableMirrors = routeMirrors - fixedMirrors.length;

  return {
    cols,
    rows,
    walls: fallbackWalls,
    targets: fallbackTargets,
    emitter,
    receiver,
    fixedMirrors,
    budget: variableMirrors + MIRROR_ALLOWANCE,
    par: variableMirrors,
    noCrossing,
    orderedTargets,
  };
}

export function genProgressLevel(levelIdx: number, seasonKey = "all"): PrismLevel {
  const safeIndex = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  const cfg = levelCfg(safeIndex);
  let level = genLevelFrom(`prism:weekly:v4:${seasonKey}:L${safeIndex + 1}:0`, cfg);
  const needsStrongerVariant = () =>
    level.par === 0 ||
    level.targets.length !== cfg.targets;
  for (let variant = 1; needsStrongerVariant() && variant < 12; variant++) {
    level = genLevelFrom(
      `prism:weekly:v4:${seasonKey}:L${safeIndex + 1}:${variant}`,
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
