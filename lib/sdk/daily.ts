// Daily challenge clock. Day #1 = 2026-07-20 (launch day).
const EPOCH_UTC = Date.UTC(2026, 6, 20);

export function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dayNumber(): number {
  const d = new Date();
  const localMidnightUTC = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.floor((localMidnightUTC - EPOCH_UTC) / 86400000) + 1;
}

export function prevKey(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) - 86400000);
  const mm = String(t.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(t.getUTCDate()).padStart(2, "0");
  return `${t.getUTCFullYear()}-${mm}-${dd}`;
}
