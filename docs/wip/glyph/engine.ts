// GLYPH - symbol code-break. Crack a hidden code of symbols in 6 guesses.
// After each guess: how many symbols sit in the RIGHT slot (exact) and how
// many are in the code but the WRONG slot (misplaced). Pure deduction - the
// constraint is the guess budget. No solver needed: every code is crackable
// by deduction, and the daily code is the same for everyone on Earth.
import { hashSeed, mulberry32 } from "@/lib/sdk/rng";

export const MAX_GUESSES = 6;

// the daily shape: one 4-symbol code from a palette of 6, no duplicates
export const DAILY_LEN = 4;
export const DAILY_PALETTE = 6;

// full symbol set - shape + color pairs so colorblind players can play on
// shape alone. Order is stable: index = symbol id.
export const SYMBOLS = [
  { color: "#ff6f61", shape: "circle" },
  { color: "#ffd166", shape: "triangle" },
  { color: "#3fd6c0", shape: "square" },
  { color: "#9d8cff", shape: "diamond" },
  { color: "#6fa8ff", shape: "star" },
  { color: "#e06fae", shape: "cross" },
  { color: "#3fbf7f", shape: "moon" },
  { color: "#ffa23e", shape: "hex" },
] as const;

export interface Feedback {
  exact: number; // right symbol, right slot
  misplaced: number; // right symbol, wrong slot
}

// endless difficulty curve: longer codes and bigger palettes as rounds climb.
// Guess budget never changes - the code grows, the information doesn't.
export function roundCfg(round: number): { len: number; palette: number } {
  const len = round < 3 ? 4 : round < 7 ? 5 : 6;
  const palette = Math.min(SYMBOLS.length, round < 2 ? 6 : round < 5 ? 7 : 8);
  return { len, palette };
}

// seeded code with no duplicate symbols (keeps the deduction clean)
export function genCodeFrom(seed: string, len: number, palette: number): number[] {
  const rng = mulberry32(hashSeed(seed));
  const pool = Array.from({ length: palette }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, len);
}

export function dailyCode(dayKey: string): number[] {
  return genCodeFrom(`glyph:${dayKey}`, DAILY_LEN, DAILY_PALETTE);
}

export function endlessCode(runSeed: number, round: number): number[] {
  const { len, palette } = roundCfg(round);
  return genCodeFrom(`glyph:endless:${runSeed}:R${round}`, len, palette);
}

// standard Mastermind feedback, robust to duplicate symbols in the GUESS
export function judge(code: number[], guess: number[]): Feedback {
  let exact = 0;
  const codeLeft: number[] = [];
  const guessLeft: number[] = [];
  for (let i = 0; i < code.length; i++) {
    if (guess[i] === code[i]) exact++;
    else {
      codeLeft.push(code[i]);
      guessLeft.push(guess[i]);
    }
  }
  let misplaced = 0;
  for (const g of guessLeft) {
    const at = codeLeft.indexOf(g);
    if (at !== -1) {
      misplaced++;
      codeLeft.splice(at, 1);
    }
  }
  return { exact, misplaced };
}

export function isCracked(code: number[], guess: number[]): boolean {
  return code.length === guess.length && code.every((s, i) => s === guess[i]);
}

// daily stars: cracked fast = brighter
export function starsFor(guessesUsed: number): number {
  return guessesUsed <= 4 ? 3 : guessesUsed <= 5 ? 2 : 1;
}

// spoiler-free share row for one guess: 🟩 exact, 🟨 misplaced, ⬜ miss
export function shareRow(len: number, fb: Feedback): string {
  return "🟩".repeat(fb.exact) + "🟨".repeat(fb.misplaced) + "⬜".repeat(len - fb.exact - fb.misplaced);
}
