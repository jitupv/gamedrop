// Global leaderboards on Supabase — anonymous users, zero sign-up.
// Everything here no-ops gracefully when the env keys are missing,
// so the game works fully offline/local until Supabase is configured.
import { SupabaseClient, createClient } from "@supabase/supabase-js";

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

// a fun, anonymous, persistent handle — e.g. "SwiftOtter42"
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

// fire-and-forget: never blocks or breaks gameplay
export function submitScore(
  game: string,
  mode: "daily" | "endless",
  day: string, // 'YYYY-MM-DD' for daily, 'all' for endless
  score: number,
  higherIsBetter: boolean
): void {
  const s = sb();
  if (!s || typeof window === "undefined") return;
  void (async () => {
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
      // network/offline — local play continues untouched
    }
  })();
}

// endless bests are always "higher is better" (levels survived / points)
export function reportEndlessBest(game: string, score: number): void {
  submitScore(game, "endless", "all", score, true);
}

// ---- reading boards ----------------------------------------------------

export interface BoardRow {
  handle: string;
  score: number;
  mine: boolean;
}

export interface Board {
  rows: BoardRow[];
  total: number; // players on this board
  myRank: number | null; // 1-based, null if you haven't scored yet
  myScore: number | null;
}

export async function fetchBoard(
  game: string,
  mode: "daily" | "endless",
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
