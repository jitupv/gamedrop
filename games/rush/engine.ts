// RUSH core: geometry + tuning for the one-light crossroads.
// Directions: 0 = eastbound (from left), 1 = westbound, 2 = southbound (from top), 3 = northbound.
import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export const CW = 900;
export const CH = 600;
export const XC = 450;
export const YC = 300;
export const HALF = 56; // intersection half-size
export const LANE = 28; // lane offset from road center
export const CAR_LEN = 46;
export const CAR_W = 24;
export const GAP = 14; // bumper gap when queuing
export const CRUISE = 175; // px/s
export const ACCEL = 380; // px/s^2
export const CARS_PER_LEVEL = 50;
export const TOTAL_LEVELS = 100;

export interface RushProgress {
  completed: number;
  level: number;
  carsInLevel: number;
}

export function progressFromCars(totalCars: number): RushProgress {
  const value = Number.isFinite(totalCars) ? totalCars : 0;
  const safeCars = Math.max(0, Math.min(TOTAL_LEVELS * CARS_PER_LEVEL, Math.floor(value)));
  const completed = Math.min(TOTAL_LEVELS, Math.floor(safeCars / CARS_PER_LEVEL));
  return {
    completed,
    level: completed >= TOTAL_LEVELS ? TOTAL_LEVELS : completed + 1,
    carsInLevel: completed >= TOTAL_LEVELS ? CARS_PER_LEVEL : safeCars % CARS_PER_LEVEL,
  };
}

// Drivers will not sit on a red forever. Without this, leaving one light green
// was a risk-free infinite score: the ignored road just queued up quietly and
// the game stopped sending cars down it, so doing nothing was the best play.
// Now a neglected road leaks a red-runner into the crossing, which means
// starving an axis is the losing move rather than the winning one.
export const PATIENCE_MAX = 7; // seconds a front car will wait early on
export const PATIENCE_MIN = 3.4; // ...and once the rush is in full swing
export const CREEP_FRAC = 0.6; // fraction of patience spent still, then it nudges
export const CREEP_SPEED = 11; // px/s of visible "I'm going" creep
export const CREEP_MAX = 26; // px it can nudge past the line before it commits

export type Dir = 0 | 1 | 2 | 3;

export interface Car {
  dir: Dir;
  pos: number; // front-of-car distance along travel axis from its entry edge
  v: number;
  color: number;
  counted: boolean;
  wait: number; // seconds spent stopped at a red, front-of-queue only
  jumped: boolean; // ran the red - the light no longer holds this one back
}

// How long the front car of a red queue tolerates the wait. Tightens as the
// traffic thickens so the endgame squeezes from both sides at once.
export function patienceFor(elapsed: number, level = 1): number {
  const levelPressure = (Math.max(1, Math.min(TOTAL_LEVELS, level)) - 1) * 0.008;
  return Math.max(PATIENCE_MIN, PATIENCE_MAX - levelPressure - elapsed * 0.045);
}

// Visible tell before a car runs the red: it sits still, then starts inching
// forward. That nudge is the player's warning, so a red-run never feels random.
export function creepOf(car: Car, patience: number): number {
  const still = patience * CREEP_FRAC;
  if (car.wait <= still) return 0;
  return Math.min(CREEP_MAX, (car.wait - still) * CREEP_SPEED);
}

// axis length a car travels for each direction
export const AXIS_LEN: Record<number, number> = { 0: CW, 1: CW, 2: CH, 3: CH };

// front position (along travel) where a car must stop on red
export const STOP: Record<number, number> = {
  0: XC - HALF - 8,
  1: CW - (XC + HALF + 8),
  2: YC - HALF - 8,
  3: CH - (YC + HALF + 8),
};

// pos → canvas rect (x, y = top-left)
export function carRect(car: Car): { x: number; y: number; w: number; h: number } {
  switch (car.dir) {
    case 0:
      return { x: car.pos - CAR_LEN, y: YC + LANE - CAR_W / 2, w: CAR_LEN, h: CAR_W };
    case 1:
      return { x: CW - car.pos, y: YC - LANE - CAR_W / 2, w: CAR_LEN, h: CAR_W };
    case 2:
      return { x: XC - LANE - CAR_W / 2, y: car.pos - CAR_LEN, w: CAR_W, h: CAR_LEN };
    default:
      return { x: XC + LANE - CAR_W / 2, y: CH - car.pos, w: CAR_W, h: CAR_LEN };
  }
}

export function isHorizontal(dir: number): boolean {
  return dir === 0 || dir === 1;
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

export interface SpawnEvent {
  t: number; // seconds into the run when this car arrives
  dir: Dir;
  color: number;
}

// A run's seeded traffic, as a schedule rather than a per-frame dice roll.
//
// The old spawner drew its jitter inside the "is it time yet?" check, so it
// burned a random number every frame (~60/s) and rolled a direction again on
// every rejected spawn. Both made the stream depend on the player's framerate
// and their own light choices, which quietly broke deterministic traffic.
// Here each event
// consumes exactly one draw per field, and its time comes from the schedule
// rather than the clock, so the sequence is identical on a 60Hz laptop and a
// 120Hz phone no matter how the player drives it.
export function makeTrafficStream(seedKey: string, level = 1) {
  const rng = mulberry32(hashSeed(`rush:${seedKey}`));
  let t = 0;
  return {
    next(): SpawnEvent {
      t += spawnInterval(t, level) * (0.78 + rng() * 0.44);
      return { t, dir: Math.floor(rng() * 4) as Dir, color: Math.floor(rng() * 6) };
    },
  };
}

// Ramps for 75s and then floors. The floor is deliberately below what any
// alternation pattern can serve: at 0.30s a spawn arrives every ~1.2s per
// direction while a green axis only drains ~2.9 cars/s, so both axes together
// demand more than 100% of the light's time. That gives each run a real ceiling
// instead of letting a steady player idle at a plateau forever.
export function spawnInterval(elapsed: number, level = 1): number {
  const levelPressure = 1 - (Math.max(1, Math.min(TOTAL_LEVELS, level)) - 1) * 0.0022;
  return Math.max(0.3, (2.4 - elapsed * 0.028) * levelPressure);
}
