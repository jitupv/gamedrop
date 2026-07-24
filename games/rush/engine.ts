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
export const DAILY_GOAL = 25; // cars passed = daily challenge cleared

export interface Car {
  dir: 0 | 1 | 2 | 3;
  pos: number; // front-of-car distance along travel axis from its entry edge
  v: number;
  color: number;
  counted: boolean;
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

// seeded spawn stream - same traffic for everyone today
export function makeSpawner(dayKey: string) {
  const rng = mulberry32(hashSeed(`rush:${dayKey}`));
  return {
    nextDir(): 0 | 1 | 2 | 3 {
      return Math.floor(rng() * 4) as 0 | 1 | 2 | 3;
    },
    nextColor(): number {
      return Math.floor(rng() * 6);
    },
    jitter(): number {
      return 0.75 + rng() * 0.5;
    },
  };
}

export function spawnInterval(elapsed: number): number {
  return Math.max(0.62, 2.4 - elapsed * 0.028);
}
