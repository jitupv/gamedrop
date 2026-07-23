// Local-first progress: results + streaks live in localStorage until accounts arrive.
import { track } from "./analytics";
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
  if (result.won && !existing?.won) {
    bumpStreak(game, day);
    track("daily_completed", { game, score: result.score });
  }
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

export interface DayRecord {
  day: string;
  score: number;
  won: boolean;
}

// every daily result ever saved on this device, oldest first
export function getAllResults(game: string): DayRecord[] {
  const out: DayRecord[] = [];
  if (typeof window === "undefined") return out;
  try {
    const prefix = `gd:${game}:`;
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key || !key.startsWith(prefix)) continue;
      const day = key.slice(prefix.length);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
      const v = read<DayResult>(key);
      if (v && typeof v.score === "number") out.push({ day, score: v.score, won: !!v.won });
    }
  } catch {}
  return out.sort((a, b) => (a.day < b.day ? -1 : 1));
}

// longest run of consecutive winning days
export function maxStreak(records: DayRecord[]): number {
  let best = 0;
  let run = 0;
  let prev = "";
  for (const r of records) {
    if (!r.won) continue;
    run = prev && prevKey(r.day) === prev ? run + 1 : 1;
    best = Math.max(best, run);
    prev = r.day;
  }
  return best;
}
