// PRISM core: seeded grid generation + beam simulation.
// Generation is construct-then-place, not generate-then-search: a valid beam
// path is built directly (walk, bend, walk, bend...) using the level's intended
// route length, targets are dropped ON that path (never on a bend cell, since
// a mirror can't share a cell with a target), and cosmetic walls are scattered
// everywhere the path doesn't go. This guarantees a solution exists by
// construction - no risk of an unsolvable board. A turn-cost search proves the
// minimum mirror count without enumerating every self-avoiding path, so normal
// open layouts remain practical even on the largest boards.
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
  par: number; // solver-verified minimum mirrors
  verifiedRoutes: number; // distinct solver-verified beam paths (at least 3)
  solutionMirrorCounts: number[]; // verified mirror counts represented by those paths
  noCrossing: boolean;
}

export interface PrismCfg {
  cols: number;
  rows: number;
  targets: number;
  routeMirrors: number;
  wallRatio: number;
  noCrossing: boolean;
}

export const TOTAL_LEVELS = 100;

// Boards widen steadily while their row count stays touch-friendly on phones.
// Difficulty comes from route choice, target spread, and efficiency rather
// than fixed mirrors or a prescribed target order.
export function levelCfg(levelIdx: number): PrismCfg {
  const n = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  if (n < 10) {
    return {
      cols: 7 + Math.floor((n + 1) / 2),
      rows: 7 + Math.floor(n / 3),
      targets: n === 0 ? 3 : Math.min(8, 3 + n),
      routeMirrors: n === 0 ? 2 : 3 + Math.floor(n / 2),
      wallRatio: n === 0 ? 0.05 : 0.1 + n * 0.008,
      noCrossing: n >= 2,
    };
  }

  const advanced = n - 9;
  return {
    cols: Math.min(18, 11 + Math.floor(advanced / 12)),
    rows: Math.min(12, 10 + Math.floor(advanced / 30)),
    targets: Math.min(13, 8 + Math.floor(advanced / 8)),
    routeMirrors: Math.min(14, 8 + Math.floor(advanced / 8)),
    wallRatio: Math.min(0.18, 0.13 + advanced * 0.0007),
    noCrossing: true,
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
  level: Pick<PrismLevel, "walls" | "emitter" | "receiver" | "targets">,
  c: number,
  r: number
): boolean {
  if (level.walls[r][c]) return false;
  if (level.emitter.cell.c === c && level.emitter.cell.r === r) return false;
  if (level.receiver.c === c && level.receiver.r === r) return false;
  if (level.targets.some((t) => t.c === c && t.r === r)) return false;
  return true;
}

function targetIndexAt(targets: Cell[], c: number, r: number): number {
  return targets.findIndex((t) => t.c === c && t.r === r);
}

interface DetourVariant {
  mirrors: Map<string, MirrorType>;
  addedMirrorKeys: string[];
  protectedKeys: string[];
  replacedCorner: string;
}

function mirrorForTurn(
  from: [number, number],
  to: [number, number]
): MirrorType | null {
  const [sx, sy] = reflectSlash(from[0], from[1]);
  if (sx === to[0] && sy === to[1]) return "/";
  const [bx, by] = reflectBack(from[0], from[1]);
  return bx === to[0] && by === to[1] ? "\\" : null;
}

// Replace one normal corner mirror with a three-mirror square detour. Each
// detour rejoins the original beam one cell later, so it still crosses every
// target in the same order while using two extra movable mirrors.
function buildDetourVariants(
  path: Cell[],
  solution: Map<string, MirrorType>,
  cols: number,
  rows: number
): DetourVariant[] {
  const variants: DetourVariant[] = [];
  const baseKeys = new Set(path.map((cell) => `${cell.c},${cell.r}`));
  const signatures = new Set<string>();
  const inBounds = (cell: Cell) =>
    cell.c >= 0 && cell.r >= 0 && cell.c < cols && cell.r < rows;

  const addVariant = (
    corner: Cell,
    external: Cell[],
    placements: { cell: Cell; from: [number, number]; to: [number, number] }[]
  ) => {
    if (external.some((cell) => !inBounds(cell) || baseKeys.has(`${cell.c},${cell.r}`))) return;
    if (
      placements.some(
        ({ cell }) =>
          !inBounds(cell) ||
          solution.has(`${cell.c},${cell.r}`) ||
          (cell.c === path[0].c && cell.r === path[0].r) ||
          (cell.c === path[path.length - 1].c && cell.r === path[path.length - 1].r)
      )
    ) return;

    const mirrors = new Map(solution);
    const replacedCorner = `${corner.c},${corner.r}`;
    mirrors.delete(replacedCorner);
    const addedMirrorKeys: string[] = [];
    for (const placement of placements) {
      const type = mirrorForTurn(placement.from, placement.to);
      if (!type) return;
      const key = `${placement.cell.c},${placement.cell.r}`;
      mirrors.set(key, type);
      addedMirrorKeys.push(key);
    }
    const signature = [...mirrors.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, type]) => `${key}:${type}`)
      .join("|");
    if (signatures.has(signature)) return;
    signatures.add(signature);
    variants.push({
      mirrors,
      addedMirrorKeys,
      protectedKeys: external.map((cell) => `${cell.c},${cell.r}`),
      replacedCorner,
    });
  };

  for (let index = 1; index < path.length - 1; index++) {
    const corner = path[index];
    if (!solution.has(`${corner.c},${corner.r}`)) continue;
    const previous = path[index - 1];
    const next = path[index + 1];
    const incoming: [number, number] = [corner.c - previous.c, corner.r - previous.r];
    const outgoing: [number, number] = [next.c - corner.c, next.r - corner.r];
    const before = previous;
    const preA = { c: before.c - outgoing[0], r: before.r - outgoing[1] };
    const preB = { c: corner.c - outgoing[0], r: corner.r - outgoing[1] };
    const oppositeOutgoing: [number, number] = [-outgoing[0], -outgoing[1]];
    addVariant(corner, [preA, preB], [
      { cell: before, from: incoming, to: oppositeOutgoing },
      { cell: preA, from: oppositeOutgoing, to: incoming },
      { cell: preB, from: incoming, to: outgoing },
    ]);

    const postA = { c: corner.c + incoming[0], r: corner.r + incoming[1] };
    const postB = { c: postA.c + outgoing[0], r: postA.r + outgoing[1] };
    const oppositeIncoming: [number, number] = [-incoming[0], -incoming[1]];
    addVariant(corner, [postA, postB], [
      { cell: postA, from: incoming, to: outgoing },
      { cell: postB, from: outgoing, to: oppositeIncoming },
      { cell: next, from: oppositeIncoming, to: outgoing },
    ]);
  }
  return variants;
}

function chooseDiverseDetours(variants: DetourVariant[], count: number): DetourVariant[] {
  const chosen: DetourVariant[] = [];
  const remaining = [...variants];
  while (chosen.length < count && remaining.length > 0) {
    let bestIndex = 0;
    let bestDistance = -1;
    for (let index = 0; index < remaining.length; index++) {
      const [c, r] = remaining[index].replacedCorner.split(",").map(Number);
      const distance = chosen.length === 0
        ? index
        : Math.min(
            ...chosen.map((variant) => {
              const [otherC, otherR] = variant.replacedCorner.split(",").map(Number);
              return Math.abs(c - otherC) + Math.abs(r - otherR);
            })
          );
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    chosen.push(remaining.splice(bestIndex, 1)[0]);
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
    const m = mirrors.get(`${c},${r}`);
    if (m) [dx, dy] = reflect(dx, dy, m);
  }
  return { path, hitTargets: hit, hitOrder, outcome: "looping" };
}

export function isSolved(level: PrismLevel, trace: TraceResult): boolean {
  return (
    trace.outcome === "receiver" &&
    trace.hitTargets.size === level.targets.length
  );
}

type PrismBoard = Omit<
  PrismLevel,
  "par" | "verifiedRoutes" | "solutionMirrorCounts"
>;

// Exact minimum-turn search on a relaxed board state. Revisiting a cell is
// allowed here, so this search can only find the same or a lower mirror count
// than the playable no-crossing rules. Therefore, when its minimum equals the
// constructed route count, that route is proven globally minimal as well.
function minimumMirrors(level: PrismBoard, upperBound: number): number | null {
  const targetAt = new Int16Array(level.cols * level.rows).fill(-1);
  level.targets.forEach((target, index) => {
    targetAt[target.r * level.cols + target.c] = index;
  });
  const blockedForMirror = new Uint8Array(level.cols * level.rows);
  for (let r = 0; r < level.rows; r++) {
    for (let c = 0; c < level.cols; c++) {
      const id = r * level.cols + c;
      if (
        level.walls[r][c] ||
        targetAt[id] !== -1 ||
        (level.emitter.cell.c === c && level.emitter.cell.r === r) ||
        (level.receiver.c === c && level.receiver.r === r)
      ) {
        blockedForMirror[id] = 1;
      }
    }
  }

  const fullTargetState = (1 << level.targets.length) - 1;
  const advanceTargets = (state: number, cellId: number): number => {
    const target = targetAt[cellId];
    if (target === -1) return state;
    return state | (1 << target);
  };
  const encode = (c: number, r: number, dir: Dir, targetState: number) =>
    (((targetState * level.rows + r) * level.cols + c) * 4) + dir;
  const stateCount = (1 << level.targets.length) * level.rows * level.cols * 4;
  const buckets: number[][] = Array.from(
    { length: upperBound + 1 },
    () => []
  );
  const best = new Uint8Array(stateCount);
  best.fill(255);
  const startTargetState = advanceTargets(
    0,
    level.emitter.cell.r * level.cols + level.emitter.cell.c
  );
  const start = encode(
    level.emitter.cell.c,
    level.emitter.cell.r,
    level.emitter.dir,
    startTargetState
  );
  buckets[0].push(start);
  best[start] = 0;

  const slashDir: Dir[] = [3, 2, 1, 0];
  const backDir: Dir[] = [1, 0, 3, 2];
  for (let mirrors = 0; mirrors <= upperBound; mirrors++) {
    const bucket = buckets[mirrors];
    for (let cursor = 0; cursor < bucket.length; cursor++) {
      const encoded = bucket[cursor];
      if (best[encoded] !== mirrors) continue;
      const dir = (encoded % 4) as Dir;
      let packed = (encoded - dir) / 4;
      const c = packed % level.cols;
      packed = (packed - c) / level.cols;
      const r = packed % level.rows;
      const targetState = (packed - r) / level.rows;
      const cellId = r * level.cols + c;
      const exits: { dir: Dir; extra: number }[] = [
        { dir, extra: 0 },
        ...(blockedForMirror[cellId] || mirrors >= upperBound
          ? []
          : [
              { dir: slashDir[dir], extra: 1 },
              { dir: backDir[dir], extra: 1 },
            ]),
      ];

      for (const exit of exits) {
        const nextMirrors = mirrors + exit.extra;
        if (nextMirrors > upperBound) continue;
        const [dx, dy] = DIR_VECS[exit.dir];
        const nc = c + dx;
        const nr = r + dy;
        if (nc < 0 || nr < 0 || nc >= level.cols || nr >= level.rows) continue;
        if (level.walls[nr][nc]) continue;
        const nextCellId = nr * level.cols + nc;
        const nextTargetState = advanceTargets(targetState, nextCellId);
        if (nc === level.receiver.c && nr === level.receiver.r) {
          if (nextTargetState === fullTargetState) return nextMirrors;
          continue;
        }
        const key = encode(nc, nr, exit.dir, nextTargetState);
        if (best[key] <= nextMirrors) continue;
        best[key] = nextMirrors;
        buckets[nextMirrors].push(key);
      }
    }
  }
  return null;
}

function scatterInteriorWalls(
  cols: number,
  rows: number,
  ratio: number,
  protectedCells: Set<string>,
  rng: () => number
): boolean[][] {
  const walls: boolean[][] = Array.from({ length: rows }, () => Array(cols).fill(false));
  const requested = Math.floor(cols * rows * ratio);
  let placed = 0;
  for (let tries = 0; placed < requested && tries < requested * 40; tries++) {
    const c = 1 + Math.floor(rng() * Math.max(1, cols - 2));
    const r = 1 + Math.floor(rng() * Math.max(1, rows - 2));
    const key = `${c},${r}`;
    if (c >= cols - 1 || r >= rows - 1 || protectedCells.has(key) || walls[r][c]) continue;
    let touchesWall = false;
    for (let dr = -1; dr <= 1 && !touchesWall; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if ((dc !== 0 || dr !== 0) && walls[r + dr]?.[c + dc]) {
          touchesWall = true;
          break;
        }
      }
    }
    if (touchesWall) continue;
    walls[r][c] = true;
    placed++;
  }
  return walls;
}

export function genLevelFrom(seedBase: string, cfg: PrismCfg): PrismLevel {
  const {
    cols,
    rows,
    targets: targetCount,
    routeMirrors,
    wallRatio,
    noCrossing,
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
    const detourVariants = buildDetourVariants(pathCells, mirrorsSolution, cols, rows);
    if (detourVariants.length < 2) continue;
    const chosenDetours = chooseDiverseDetours(detourVariants, 2);
    const detourMirrorKeys = new Set(chosenDetours.flatMap((variant) => variant.addedMirrorKeys));
    const protectedCells = new Set(visited);
    chosenDetours.forEach((variant) =>
      variant.protectedKeys.forEach((key) => protectedCells.add(key))
    );

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
           !detourMirrorKeys.has(`${p.c},${p.r}`) &&
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

    // Obstacles stay sparse, separated, and inside the playable area. They
    // shape route choices without turning the outer rows into solid barriers.
    const walls = scatterInteriorWalls(cols, rows, wallRatio, protectedCells, rng);

    const bare: PrismBoard = {
      cols,
      rows,
      walls,
      targets,
      emitter,
      receiver,
      noCrossing,
    };
    const par = minimumMirrors(bare, routeMirrors);
    if (par !== routeMirrors) continue;
    const candidate: PrismLevel = {
      ...bare,
      par,
      verifiedRoutes: 0,
      solutionMirrorCounts: [],
    };
    const playerSolutions = [mirrorsSolution, ...chosenDetours.map((variant) => variant.mirrors)];
    const solutionPaths = new Set<string>();
    const solutionMirrorCounts = new Set<number>([par]);
    for (const solution of playerSolutions) {
      const trace = traceBeam(candidate, solution);
      if (!isSolved(candidate, trace)) continue;
      solutionPaths.add(trace.path.map((cell) => `${cell.c},${cell.r}`).join(">"));
      solutionMirrorCounts.add(solution.size);
    }
    if (solutionPaths.size < 3) continue;
    candidate.verifiedRoutes = solutionPaths.size;
    candidate.solutionMirrorCounts = [...solutionMirrorCounts].sort((a, b) => a - b);
    return candidate;
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
  const fallbackDetours = chooseDiverseDetours(buildDetourVariants(
    fallbackPath,
    fallbackMirrors,
    cols,
    rows
  ), 2);
  const fallbackDetourMirrorKeys = new Set(
    fallbackDetours.flatMap((variant) => variant.addedMirrorKeys)
  );
  const eligibleTargets = fallbackPath.slice(1, -1).filter(
    (cell) =>
      cell.segment >= 1 &&
      !fallbackMirrors.has(`${cell.c},${cell.r}`) &&
      !fallbackDetourMirrorKeys.has(`${cell.c},${cell.r}`)
  );
  const fallbackTargets: Cell[] = [];
  for (let i = 0; i < targetCount; i++) {
    const index = Math.min(
      eligibleTargets.length - 1,
      Math.floor((i + 0.5) * (eligibleTargets.length / targetCount))
    );
    fallbackTargets.push({ c: eligibleTargets[index].c, r: eligibleTargets[index].r });
  }

  // Even the fallback remains an open board. Its sparse interior obstacles use
  // a separate deterministic seed, so weekly variants do not collapse into the
  // old solid-row corridor layout.
  const fallbackProtected = new Set(fallbackVisited);
  fallbackDetours.forEach((variant) =>
    variant.protectedKeys.forEach((key) => fallbackProtected.add(key))
  );
  const fallbackWalls = scatterInteriorWalls(
    cols,
    rows,
    wallRatio,
    fallbackProtected,
    mulberry32(hashSeed(`${seedBase}:fallback-walls`))
  );
  const fallbackBare: PrismBoard = {
    cols,
    rows,
    walls: fallbackWalls,
    targets: fallbackTargets,
    emitter,
    receiver,
    noCrossing,
  };
  const fallbackPar = minimumMirrors(fallbackBare, routeMirrors) ?? routeMirrors;
  const fallbackCounts = new Set<number>([fallbackPar]);
  const fallbackPaths = new Set<string>();
  [fallbackMirrors, ...fallbackDetours.map((variant) => variant.mirrors)].forEach(
    (solution) => {
      const candidate: PrismLevel = {
        ...fallbackBare,
        par: fallbackPar,
        verifiedRoutes: 0,
        solutionMirrorCounts: [],
      };
      const trace = traceBeam(candidate, solution);
      if (!isSolved(candidate, trace)) return;
      fallbackPaths.add(trace.path.map((cell) => `${cell.c},${cell.r}`).join(">"));
      fallbackCounts.add(solution.size);
    }
  );
  return {
    ...fallbackBare,
    par: fallbackPar,
    verifiedRoutes: fallbackPaths.size,
    solutionMirrorCounts: [...fallbackCounts].sort((a, b) => a - b),
  };
}

export function genProgressLevel(levelIdx: number, seasonKey = "all"): PrismLevel {
  const safeIndex = Math.max(0, Math.min(TOTAL_LEVELS - 1, levelIdx));
  const cfg = levelCfg(safeIndex);
  let level = genLevelFrom(`prism:weekly:v7:${seasonKey}:L${safeIndex + 1}:0`, cfg);
  const needsStrongerVariant = () =>
    level.par === 0 ||
    level.par !== cfg.routeMirrors ||
    level.targets.length !== cfg.targets ||
    level.verifiedRoutes < 3 ||
    !level.solutionMirrorCounts.some((count) => count > level.par);
  for (let variant = 1; needsStrongerVariant() && variant < 12; variant++) {
    level = genLevelFrom(
      `prism:weekly:v7:${seasonKey}:L${safeIndex + 1}:${variant}`,
      cfg
    );
  }
  return level;
}

export function starsFor(mirrorsUsed: number, par: number): number {
  if (mirrorsUsed <= par) return 3;
  if (mirrorsUsed <= par + 1) return 2;
  return 1;
}
