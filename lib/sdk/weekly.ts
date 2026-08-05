const LEVEL_METRIC = "levels-completed";
const LEGACY_PROGRESS_KEYS: Record<string, string> = {
  pulse: "gd:pulse:v1:levels-completed",
  prism: "gd:prism:v3:levels-completed",
  tilt: "gd:tilt:v1:levels-completed",
  sonar: "gd:sonar:v1:levels-completed",
  heist: "gd:heist:v1:levels-completed",
  rush: "gd:rush:v1:levels-completed",
  trace: "gd:trace:v1:levels-completed",
};

export const LEVEL_GAME_IDS = [
  "pulse",
  "prism",
  "tilt",
  "sonar",
  "heist",
  "rush",
  "trace",
] as const;

const levelCap = (game: string) => game === "pulse" ? 1000 : 100;

export function weekKey(date = new Date()): string {
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday.toISOString().slice(0, 10);
}

export function weekLabel(key = weekKey()): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const number = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `W${String(number).padStart(2, "0")}`;
}

export function previousWeekKey(key = weekKey()): string {
  const date = new Date(`${key}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 7);
  return date.toISOString().slice(0, 10);
}

export function weeklySeed(game: string, key = weekKey()): string {
  return `${game}:weekly:${key}`;
}

export function weeklyStorageKey(
  game: string,
  metric = LEVEL_METRIC,
  key = weekKey()
): string {
  return `gd:${game}:weekly:${key}:${metric}`;
}

export function readStoredNumber(key: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const value = Number(window.localStorage.getItem(key) || 0);
    return Number.isFinite(value) ? Math.max(0, value) : 0;
  } catch {
    return 0;
  }
}

export function readWeeklyProgress(game: string): number {
  return Math.min(levelCap(game), Math.floor(readStoredNumber(weeklyStorageKey(game))));
}

export function readCareerBest(game: string): number {
  return Math.min(
    levelCap(game),
    Math.floor(
      Math.max(
        readStoredNumber(`gd:${game}:career-best`),
        readStoredNumber(LEGACY_PROGRESS_KEYS[game] ?? "")
      )
    )
  );
}

export function writeWeeklyProgress(game: string, completed: number): void {
  if (typeof window === "undefined") return;
  const safe = Math.max(0, Math.min(levelCap(game), Math.floor(completed)));
  try {
    window.localStorage.setItem(weeklyStorageKey(game), String(safe));
    const careerKey = `gd:${game}:career-best`;
    const career = readCareerBest(game);
    if (!Number.isFinite(career) || safe > career) {
      window.localStorage.setItem(careerKey, String(safe));
    }
  } catch {}
}
