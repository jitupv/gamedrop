// Local-first progress: results + streaks live in localStorage until accounts arrive.
import { prevKey } from "./daily";

export interface DayResult {
  score: number; // game-specific: launches for ORBIT (lower = better)
  won: boolean;
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full/blocked — play on without persistence
  }
}

export function loadResult(game: string, day: string): DayResult | null {
  return read<DayResult>(`gd:${game}:${day}`);
}

export function saveResult(game: string, day: string, result: DayResult, higherIsBetter = false): void {
  const existing = loadResult(game, day);
  // keep the best score for the day (golf games: lowest; score-attack games: highest)
  const existingIsBetter =
    existing?.won && (higherIsBetter ? existing.score >= result.score : existing.score <= result.score);
  if (!existingIsBetter) write(`gd:${game}:${day}`, result);
  if (result.won && !existing?.won) bumpStreak(game, day);
}

interface Streak {
  count: number;
  lastDay: string;
}

function bumpStreak(game: string, day: string): void {
  const s = read<Streak>(`gd:${game}:streak`);
  if (s && s.lastDay === day) return;
  const count = s && s.lastDay === prevKey(day) ? s.count + 1 : 1;
  write(`gd:${game}:streak`, { count, lastDay: day });
}

export function getStreak(game: string, today: string): number {
  const s = read<Streak>(`gd:${game}:streak`);
  if (!s) return 0;
  // streak is alive if last win was today or yesterday
  if (s.lastDay === today || s.lastDay === prevKey(today)) return s.count;
  return 0;
}
