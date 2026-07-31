// Global leaderboards on Supabase - anonymous users, zero sign-up.
// Everything here no-ops gracefully when the env keys are missing,
// so the game works fully offline/local until Supabase is configured.
import { SupabaseClient, createClient } from "@supabase/supabase-js";
import { weekKey } from "./weekly";

let client: SupabaseClient | null | undefined;

function sb(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key) : null;
  return client;
}

export function leaderboardEnabled(): boolean {
  return sb() !== null;
}

// ---- anonymous identity ------------------------------------------------

const ADJECTIVES = [
  "Swift", "Silent", "Cosmic", "Lucky", "Turbo", "Golden", "Shadow", "Neon",
  "Frosty", "Blazing", "Clever", "Mellow", "Rogue", "Nimble", "Electric", "Mystic",
];
const ANIMALS = [
  "Otter", "Falcon", "Panda", "Tiger", "Koala", "Raven", "Fox", "Dolphin",
  "Gecko", "Lynx", "Owl", "Badger", "Cobra", "Heron", "Wolf", "Mantis",
];

// a fun, anonymous, persistent handle - e.g. "SwiftOtter42"
export function myHandle(): string {
  if (typeof window === "undefined") return "Player";
  try {
    const saved = window.localStorage.getItem("gd:handle");
    if (saved) return saved;
    const h =
      ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)] +
      ANIMALS[Math.floor(Math.random() * ANIMALS.length)] +
      String(10 + Math.floor(Math.random() * 90));
    window.localStorage.setItem("gd:handle", h);
    return h;
  } catch {
    return "Player";
  }
}

// sign in silently on first use; the session persists in the browser
async function ensureUser(): Promise<string | null> {
  const s = sb();
  if (!s) return null;
  try {
    const { data } = await s.auth.getSession();
    if (data.session) return data.session.user.id;
    const { data: anon, error } = await s.auth.signInAnonymously();
    if (error) return null;
    return anon.user?.id ?? null;
  } catch {
    return null;
  }
}

// ---- writing scores ----------------------------------------------------

async function writeScore(
  game: string,
  mode: "daily" | "endless" | "levels",
  day: string,
  score: number,
  higherIsBetter: boolean
): Promise<void> {
  const s = sb();
  if (!s || typeof window === "undefined") return;
  try {
    const uid = await ensureUser();
    if (!uid) return;
    // only touch the row if this run is an improvement
    const { data: existing } = await s
      .from("scores")
      .select("score")
      .eq("user_id", uid)
      .eq("game", game)
      .eq("mode", mode)
      .eq("day", day)
      .maybeSingle();
    if (
      existing &&
      (higherIsBetter ? existing.score >= score : existing.score <= score)
    )
      return;
    await s.from("scores").upsert(
      { user_id: uid, handle: myHandle(), game, mode, day, score },
      { onConflict: "user_id,game,mode,day" }
    );
  } catch {
    // network/offline - local play continues untouched
  }
}

// fire-and-forget: never blocks or breaks gameplay
export function submitScore(
  game: string,
  mode: "daily" | "endless" | "levels",
  day: string,
  score: number,
  higherIsBetter: boolean
): void {
  void writeScore(game, mode, day, score, higherIsBetter);
}

// endless bests are always "higher is better" (levels survived / points)
export function reportEndlessBest(game: string, score: number): void {
  submitScore(game, "endless", "all", score, true);
}

export function reportLevelProgress(game: string, completed: number): void {
  void (async () => {
    await writeScore(game, "levels", weekKey(), completed, true);
    await writeScore(game, "levels", "all", completed, true);
  })();
}

// ---- optional accounts (guest-first; email upgrade keeps the same identity) ----

export interface AccountInfo {
  userId: string | null;
  email: string | null; // null = guest (anonymous)
}

export async function getAccount(): Promise<AccountInfo> {
  const s = sb();
  if (!s) return { userId: null, email: null };
  try {
    const { data } = await s.auth.getSession();
    const u = data.session?.user;
    // signed in on a new device: restore the display name that travels in metadata
    const metaHandle = u?.user_metadata?.handle;
    if (u?.email && typeof metaHandle === "string" && typeof window !== "undefined") {
      try {
        window.localStorage.setItem("gd:handle", metaHandle);
      } catch {}
    }
    return { userId: u?.id ?? null, email: u?.email ?? null };
  } catch {
    return { userId: null, email: null };
  }
}

// attach an email to the current guest - SAME user id, so every score and the
// board name survive. If the email already has an account, send a sign-in link.
export async function attachEmail(email: string): Promise<{ ok: boolean; message: string }> {
  const s = sb();
  if (!s) return { ok: false, message: "The leaderboard is offline right now." };
  try {
    await ensureUser();
    const { error } = await s.auth.updateUser({ email });
    if (!error)
      return { ok: true, message: "Check your inbox - click the link to confirm your account." };
    const { error: e2 } = await s.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (!e2)
      return { ok: true, message: "That email already has an account - we sent a sign-in link." };
    return { ok: false, message: e2.message };
  } catch {
    return { ok: false, message: "Could not reach the server - try again." };
  }
}

export async function signOutAccount(): Promise<void> {
  try {
    await sb()?.auth.signOut();
  } catch {}
}

// display-name rules: public wall, so keep it clean and simple
const RESERVED = ["admin", "jeetle", "gamedrop", "official", "moderator", "system"];
const BLOCKED = ["fuck", "shit", "bitch", "asshole", "chutiya", "madarchod", "bhosdi"];

export function validateHandle(name: string): string | null {
  const n = name.trim();
  if (!/^[A-Za-z0-9 _.\-]{3,24}$/.test(n))
    return "3-24 characters: letters, numbers, spaces, . _ -";
  const low = n.toLowerCase();
  if (RESERVED.some((b) => low.includes(b))) return "That name is reserved.";
  if (BLOCKED.some((b) => low.replace(/[^a-z]/g, "").includes(b)))
    return "Keep it family-friendly.";
  return null;
}

// rename everywhere: this device, the account metadata, and every past score row
export async function renameHandle(name: string): Promise<{ ok: boolean; message: string }> {
  const err = validateHandle(name);
  if (err) return { ok: false, message: err };
  const n = name.trim();
  try {
    window.localStorage.setItem("gd:handle", n);
  } catch {}
  const s = sb();
  if (!s) return { ok: true, message: "Name saved on this device." };
  try {
    const uid = await ensureUser();
    if (uid) {
      await s.auth.updateUser({ data: { handle: n } });
      await s.from("scores").update({ handle: n }).eq("user_id", uid);
    }
    return { ok: true, message: `Done - boards now show ${n}.` };
  } catch {
    return { ok: true, message: "Saved on this device; boards update when you're online." };
  }
}

// ---- reading boards ----------------------------------------------------

export interface BoardRow {
  handle: string;
  score: number;
  mine: boolean;
  gamesPlayed?: number;
  gamesMastered?: number;
}

export interface Board {
  rows: BoardRow[];
  total: number; // players on this board
  myRank: number | null; // 1-based, null if you haven't scored yet
  myScore: number | null;
}

export async function fetchBoard(
  game: string,
  mode: "daily" | "endless" | "levels",
  day: string,
  higherIsBetter: boolean,
  limit = 10
): Promise<Board | null> {
  const s = sb();
  if (!s) return null;
  try {
    const uid = (await s.auth.getSession()).data.session?.user.id ?? null;
    const { data, count, error } = await s
      .from("scores")
      .select("user_id,handle,score", { count: "exact" })
      .eq("game", game)
      .eq("mode", mode)
      .eq("day", day)
      .order("score", { ascending: !higherIsBetter })
      .order("created_at", { ascending: true }) // earlier score wins ties
      .limit(limit);
    if (error || !data) return null;

    let myRank: number | null = null;
    let myScore: number | null = null;
    if (uid) {
      const { data: mine } = await s
        .from("scores")
        .select("score")
        .eq("user_id", uid)
        .eq("game", game)
        .eq("mode", mode)
        .eq("day", day)
        .maybeSingle();
      if (mine) {
        myScore = mine.score;
        const better = await s
          .from("scores")
          .select("id", { count: "exact", head: true })
          .eq("game", game)
          .eq("mode", mode)
          .eq("day", day)
          [higherIsBetter ? "gt" : "lt"]("score", myScore);
        myRank = (better.count ?? 0) + 1;
      }
    }
    return {
      rows: data.map((r) => ({ handle: r.handle, score: r.score, mine: r.user_id === uid })),
      total: count ?? 0,
      myRank,
      myScore,
    };
  } catch {
    return null;
  }
}

export async function fetchWeeklyOverallBoard(
  week = weekKey(),
  limit = 10
): Promise<Board | null> {
  const s = sb();
  if (!s) return null;
  try {
    const uid = (await s.auth.getSession()).data.session?.user.id ?? null;
    const { data, count, error } = await s
      .from("weekly_level_totals")
      .select("user_id,handle,score,games_played,games_mastered", { count: "exact" })
      .eq("week", week)
      .order("score", { ascending: false })
      .order("games_mastered", { ascending: false })
      .limit(limit);
    if (error || !data) return null;

    let myRank: number | null = null;
    let myScore: number | null = null;
    if (uid) {
      const { data: mine } = await s
        .from("weekly_level_totals")
        .select("score")
        .eq("week", week)
        .eq("user_id", uid)
        .maybeSingle();
      if (mine) {
        myScore = mine.score;
        const better = await s
          .from("weekly_level_totals")
          .select("user_id", { count: "exact", head: true })
          .eq("week", week)
          .gt("score", myScore);
        myRank = (better.count ?? 0) + 1;
      }
    }

    return {
      rows: data.map((row) => ({
        handle: row.handle,
        score: row.score,
        mine: row.user_id === uid,
        gamesPlayed: row.games_played,
        gamesMastered: row.games_mastered,
      })),
      total: count ?? 0,
      myRank,
      myScore,
    };
  } catch {
    return null;
  }
}

// ---- drop-notify list ----------------------------------------------------

// add an email to the "tell me when a new game drops" list.
// duplicate emails count as success; returns false only on a real failure.
export async function joinDropList(email: string): Promise<boolean> {
  const s = sb();
  if (!s) return false;
  const clean = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean) || clean.length > 254) return false;
  try {
    const { error } = await s.from("drop_signups").insert({ email: clean });
    if (!error) return true;
    return error.code === "23505"; // unique violation = already on the list
  } catch {
    return false;
  }
}
