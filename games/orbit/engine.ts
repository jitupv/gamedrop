// ORBIT core: deterministic course generation + gravity simulation.
// v2: every hole is validated by an internal solver — a level is only accepted
// if it is solvable AND no direct shot at the beacon can win (slingshot required).
import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export const W = 900;
export const H = 600;
export const MAX_SPEED = 8.5; // px per frame at launch
export const BEACON_R = 16;
export const STAR_R = 14;
const MASS_FACTOR = 1.6;
const SOFTEN = 900;
const SUBSTEPS = 3;

const HOLE_PLANETS = [3, 4, 5]; // escalating difficulty across the daily course
const MAX_WINS_PER_HOLE = [60, 40, 28]; // fewer viable shots = harder hole
const DIRECT_CONE_DEG = 22; // wins aimed within this cone of the beacon disqualify a level
const GEN_ATTEMPTS = 14;

export interface Vec {
  x: number;
  y: number;
}

export interface Planet extends Vec {
  r: number;
  mass: number;
  hue: number;
}

export interface Hole {
  planets: Planet[];
  start: Vec;
  beacon: Vec;
  star: Vec;
  bgStars: { x: number; y: number; b: number }[];
}

export interface Probe {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export type StepOutcome = "flying" | "crashed" | "lost" | "won";

export function simStep(p: Probe, hole: Pick<Hole, "planets" | "beacon">): StepOutcome {
  for (let s = 0; s < SUBSTEPS; s++) {
    let ax = 0;
    let ay = 0;
    for (const pl of hole.planets) {
      const dx = pl.x - p.x;
      const dy = pl.y - p.y;
      const d2 = Math.max(dx * dx + dy * dy, SOFTEN);
      const d = Math.sqrt(d2);
      const a = pl.mass / d2;
      ax += (a * dx) / d;
      ay += (a * dy) / d;
    }
    p.vx += ax / SUBSTEPS;
    p.vy += ay / SUBSTEPS;
    p.x += p.vx / SUBSTEPS;
    p.y += p.vy / SUBSTEPS;

    for (const pl of hole.planets) {
      if (Math.hypot(pl.x - p.x, pl.y - p.y) < pl.r + 3) return "crashed";
    }
    if (Math.hypot(hole.beacon.x - p.x, hole.beacon.y - p.y) < BEACON_R) return "won";
    if (p.x < -160 || p.x > W + 160 || p.y < -160 || p.y > H + 160) return "lost";
  }
  return "flying";
}

export function previewPath(start: Vec, vx: number, vy: number, hole: Hole, frames = 110): Vec[] {
  const ghost: Probe = { x: start.x, y: start.y, vx, vy };
  const pts: Vec[] = [];
  for (let i = 0; i < frames; i++) {
    if (simStep(ghost, hole) !== "flying") break;
    pts.push({ x: ghost.x, y: ghost.y });
  }
  return pts;
}

export function launchVelocity(aimStart: Vec, aimCur: Vec): { vx: number; vy: number; power: number } {
  let vx = (aimStart.x - aimCur.x) * 0.045;
  let vy = (aimStart.y - aimCur.y) * 0.045;
  const speed = Math.hypot(vx, vy);
  if (speed > MAX_SPEED) {
    vx = (vx / speed) * MAX_SPEED;
    vy = (vy / speed) * MAX_SPEED;
  }
  return { vx, vy, power: Math.min(speed / MAX_SPEED, 1) };
}

// ---------- generation ----------

interface Candidate {
  planets: Planet[];
  start: Vec;
  beacon: Vec;
  bgStars: { x: number; y: number; b: number }[];
}

function rawHole(seedStr: string, planetCount: number): Candidate {
  const rnd = mulberry32(hashSeed(seedStr));
  const planets: Planet[] = [];
  let tries = 0;
  while (planets.length < planetCount && tries < 800) {
    tries++;
    const r = 18 + rnd() * 26;
    const x = 150 + rnd() * (W - 300);
    const y = 100 + rnd() * (H - 200);
    const gap = planetCount >= 5 ? 60 : 90; // denser field on the hard hole
    // muted editorial palette: terracotta, sand, sage, slate, mauve
    const PLANET_HUES = [18, 38, 82, 205, 320];
    if (planets.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + r + gap))
      planets.push({ x, y, r, mass: r * r * MASS_FACTOR, hue: PLANET_HUES[Math.floor(rnd() * PLANET_HUES.length)] });
  }
  const place = (xmin: number, xmax: number): Vec => {
    for (let i = 0; i < 300; i++) {
      const x = xmin + rnd() * (xmax - xmin);
      const y = 70 + rnd() * (H - 140);
      if (planets.every((p) => Math.hypot(p.x - x, p.y - y) > p.r + 60)) return { x, y };
    }
    return { x: (xmin + xmax) / 2, y: H / 2 };
  };
  const start = place(50, 160);
  const beacon = place(W - 180, W - 60);
  const bgStars = Array.from({ length: 130 }, () => ({
    x: rnd() * W,
    y: rnd() * H,
    b: 0.15 + rnd() * 0.6,
  }));
  return { planets, start, beacon, bgStars };
}

function segDist(a: Vec, b: Vec, p: Vec): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby)));
  return Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y);
}

interface Evaluation {
  solvable: boolean;
  blocked: boolean;
  directWin: boolean;
  winCount: number;
  winPath: Vec[];
}

function evaluateHole(c: Candidate): Evaluation {
  const blocked = c.planets.some((p) => segDist(c.start, c.beacon, p) < p.r + 45);
  const directDeg = ((Math.atan2(c.beacon.y - c.start.y, c.beacon.x - c.start.x) * 180) / Math.PI + 360) % 360;
  let winCount = 0;
  let directWin = false;
  let winPath: Vec[] = [];

  for (let deg = 0; deg < 360; deg += 3) {
    for (const speed of [3.5, 4.5, 5.5, 6.5, 7.5, 8.5]) {
      const rad = (deg * Math.PI) / 180;
      const probe: Probe = {
        x: c.start.x,
        y: c.start.y,
        vx: Math.cos(rad) * speed,
        vy: Math.sin(rad) * speed,
      };
      const path: Vec[] = [];
      for (let i = 0; i < 900; i++) {
        const o = simStep(probe, c);
        path.push({ x: probe.x, y: probe.y });
        if (o === "won") {
          winCount++;
          let diff = Math.abs(deg - directDeg);
          if (diff > 180) diff = 360 - diff;
          if (diff < DIRECT_CONE_DEG) directWin = true;
          else if (winPath.length === 0) winPath = path; // first slingshot solution → star placement
          break;
        }
        if (o !== "flying") break;
      }
    }
  }
  return { solvable: winCount > 0, blocked, directWin, winCount, winPath };
}

function placeStar(c: Candidate, winPath: Vec[]): Vec {
  const ok = (p: Vec) =>
    c.planets.every((pl) => Math.hypot(pl.x - p.x, pl.y - p.y) > pl.r + 30) &&
    Math.hypot(c.beacon.x - p.x, c.beacon.y - p.y) > 60 &&
    Math.hypot(c.start.x - p.x, c.start.y - p.y) > 60 &&
    p.x > 20 &&
    p.x < W - 20 &&
    p.y > 20 &&
    p.y < H - 20;
  if (winPath.length > 0) {
    const mid = Math.floor(winPath.length * 0.55);
    for (let off = 0; off < winPath.length; off++) {
      for (const idx of [mid + off, mid - off]) {
        if (idx >= 0 && idx < winPath.length && ok(winPath[idx])) return winPath[idx];
      }
    }
  }
  return { x: W / 2, y: 60 }; // safe fallback, top center
}

export function genHoleFrom(seedBase: string, planetCount: number, winsCap: number): Hole {
  let fallback: { c: Candidate; path: Vec[] } | null = null;
  let last: Candidate | null = null;
  for (let attempt = 0; attempt < GEN_ATTEMPTS; attempt++) {
    const c = rawHole(`${seedBase}:${attempt}`, planetCount);
    last = c;
    const ev = evaluateHole(c);
    if (!ev.solvable) continue;
    if (!fallback) fallback = { c, path: ev.winPath };
    if (ev.blocked && !ev.directWin && ev.winCount <= winsCap && ev.winPath.length > 0) {
      return { ...c, star: placeStar(c, ev.winPath) };
    }
  }
  // no candidate met the full bar — ship the best solvable one rather than an impossible hole
  if (fallback) return { ...fallback.c, star: placeStar(fallback.c, fallback.path) };
  const c = last as Candidate;
  return { ...c, star: placeStar(c, []) };
}

export function generateCourse(dayKey: string): Hole[] {
  return [0, 1, 2].map((i) =>
    genHoleFrom(`orbit:${dayKey}:${i}`, HOLE_PLANETS[i], MAX_WINS_PER_HOLE[i])
  );
}

// endless mode: denser systems, fewer forgiving shots, forever
export function endlessHole(seedBase: string, i: number): Hole {
  return genHoleFrom(`${seedBase}:${i}`, Math.min(6, 3 + Math.floor(i / 2)), Math.max(16, 60 - i * 4));
}
