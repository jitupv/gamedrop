import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export const TOTAL_LEVELS = 1000;

export interface PulseNode { x: number; y: number; locked: boolean }
export interface PulseLevel {
  nodes: PulseNode[];
  edges: [number, number][];
  effects: bigint[];
  start: bigint;
  par: number;
}

const cache = new Map<string, PulseLevel>();
const bit = (n: number) => 1n << BigInt(n);

function popcount(value: bigint): number {
  let count = 0;
  while (value) { value &= value - 1n; count++; }
  return count;
}

function dimensions(index: number): [number, number] {
  if (index < 10) return [3, 2 + (index >= 4 ? 1 : 0)];
  if (index < 100) return [4, index < 35 ? 3 : 4];
  if (index < 250) return [5, 4];
  if (index < 500) return [5, 5];
  if (index < 750) return [6, 5];
  return [6, 6];
}

function solveMinimum(effects: bigint[], start: bigint, locked: Set<number>): number | null {
  const variables = effects.map((_, i) => i).filter((i) => !locked.has(i));
  const width = variables.length;
  const rows = effects.map((_, node) => {
    let row = 0n;
    variables.forEach((source, column) => {
      if (effects[source] & bit(node)) row |= bit(column);
    });
    if (start & bit(node)) row |= bit(width);
    return row;
  });
  const pivots: number[] = [];
  let rank = 0;
  for (let column = 0; column < width; column++) {
    const pivot = rows.findIndex((row, r) => r >= rank && (row & bit(column)) !== 0n);
    if (pivot < 0) continue;
    [rows[rank], rows[pivot]] = [rows[pivot], rows[rank]];
    for (let r = 0; r < rows.length; r++) {
      if (r !== rank && (rows[r] & bit(column))) rows[r] ^= rows[rank];
    }
    pivots[rank++] = column;
  }
  const variableMask = bit(width) - 1n;
  if (rows.some((row, r) => r >= rank && !(row & variableMask) && (row & bit(width)))) return null;
  const pivotSet = new Set(pivots);
  const free = Array.from({ length: width }, (_, i) => i).filter((i) => !pivotSet.has(i));
  if (free.length > 16) return null;
  let particular = 0n;
  pivots.forEach((column, r) => { if (rows[r] & bit(width)) particular |= bit(column); });
  const basis = free.map((column) => {
    let vector = bit(column);
    pivots.forEach((pivot, r) => { if (rows[r] & bit(column)) vector |= bit(pivot); });
    return vector;
  });
  let minimum = popcount(particular);
  for (let mask = 1; mask < 1 << basis.length; mask++) {
    let candidate = particular;
    basis.forEach((vector, i) => { if (mask & (1 << i)) candidate ^= vector; });
    minimum = Math.min(minimum, popcount(candidate));
  }
  return minimum;
}

function makeLevel(seed: string, levelIndex: number): PulseLevel {
  const [cols, rows] = dimensions(levelIndex);
  const count = cols * rows;
  const desired = Math.min(count - 1, 2 + Math.floor(Math.sqrt(levelIndex + 1) / 2));
  for (let attempt = 0; attempt < 300; attempt++) {
    const rng = mulberry32(hashSeed(`${seed}:${attempt}`));
    const nodes: PulseNode[] = Array.from({ length: count }, (_, i) => ({
      x: 55 + (i % cols) * (490 / Math.max(1, cols - 1)),
      y: 55 + Math.floor(i / cols) * (490 / Math.max(1, rows - 1)),
      locked: false,
    }));
    const edgeKeys = new Set<string>();
    const edges: [number, number][] = [];
    const addEdge = (a: number, b: number) => {
      const key = a < b ? `${a},${b}` : `${b},${a}`;
      if (a !== b && !edgeKeys.has(key)) { edgeKeys.add(key); edges.push([a, b]); }
    };
    for (let i = 1; i < count; i++) {
      const c = i % cols;
      const r = Math.floor(i / cols);
      if (c > 0 && (r === 0 || rng() < 0.58)) addEdge(i, i - 1);
      else addEdge(i, i - cols);
    }
    const extraChance = Math.min(0.38, 0.1 + levelIndex / 3500);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (c + 1 < cols && rng() < extraChance) addEdge(i, i + 1);
      if (r + 1 < rows && rng() < extraChance) addEdge(i, i + cols);
    }
    const lockCount = levelIndex < 250 ? 0 : Math.min(Math.floor(count / 6), 1 + Math.floor((levelIndex - 250) / 180));
    const locked = new Set<number>();
    while (locked.size < lockCount) locked.add(Math.floor(rng() * count));
    locked.forEach((i) => { nodes[i].locked = true; });
    const effects = Array.from({ length: count }, (_, i) => bit(i));
    edges.forEach(([a, b]) => { effects[a] |= bit(b); effects[b] |= bit(a); });
    const available = Array.from({ length: count }, (_, i) => i).filter((i) => !locked.has(i));
    let chosen = 0n;
    while (popcount(chosen) < Math.min(desired, available.length)) {
      chosen |= bit(available[Math.floor(rng() * available.length)]);
    }
    let start = 0n;
    available.forEach((node) => { if (chosen & bit(node)) start ^= effects[node]; });
    const par = solveMinimum(effects, start, locked);
    if (start && par !== null && par >= Math.max(2, desired - 1)) return { nodes, edges, effects, start, par };
  }
  throw new Error(`Unable to generate PULSE level ${levelIndex + 1}`);
}

export function genLevel(levelIndex: number, season = "all"): PulseLevel {
  const safe = Math.max(0, Math.min(TOTAL_LEVELS - 1, Math.floor(levelIndex)));
  const key = `${season}:${safe}`;
  const saved = cache.get(key);
  if (saved) return saved;
  const level = makeLevel(`pulse:v1:${season}:L${safe + 1}`, safe);
  cache.set(key, level);
  return level;
}

export function isLit(state: bigint, node: number): boolean { return (state & bit(node)) !== 0n; }
export function starsFor(moves: number, par: number): number {
  if (moves <= par) return 3;
  if (moves <= par + 2) return 2;
  return 1;
}
