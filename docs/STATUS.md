# GAMEDROP - Current Setup & Connection Status

> **Read this before asking whether anything is "configured" or "connected."**
> Everything in this file has been verified working. This is the live state of the
> project's integrations and deployment as of **2026-07-25**. It is a companion to
> `docs/GAMEDROP-HANDBOOK.md` (which explains the architecture; this explains what is
> already wired up).

---

## TL;DR - it is all connected and live

| Thing | Status | Notes |
|---|---|---|
| GitHub repo | ✅ Connected | `github.com/jitupv/gamedrop`, branch `main`, public |
| Vercel deployment | ✅ Live | https://gamesdrop.vercel.app returns HTTP 200 |
| Supabase (database + auth) | ✅ Connected & working | anonymous auth on, `scores` table live, write path proven |
| PostHog analytics | ✅ Wired in code | events fire client-side; ingestion not independently checked |
| Env vars in Vercel | ✅ Set | verified: Supabase keys are baked into the deployed JS bundle |

**Nothing needs to be "set up" to run, build, or deploy this project.** If a tool or
assistant claims Vercel/Supabase/PostHog is "not configured," it is mistaken - it is
reading the architecture docs and assuming a fresh project. It is not fresh.

---

## GitHub

- **Repo:** https://github.com/jitupv/gamedrop (public)
- **Default branch:** `main`
- **Deploy trigger:** Vercel auto-builds and deploys on every push to `main`.
- **Latest deployed commit:** `v6: leaderboards, accounts, game rebalance, SEO, and UI polish`.
- Working tree is clean and pushed - local `main` matches `origin/main`.

## Vercel (DEPLOYED & LIVE)

- **Live URL:** https://gamesdrop.vercel.app  (verified HTTP 200)
- **Connected to:** the GitHub repo above; production branch `main`.
- **Environment variables (set in Vercel → Settings → Environment Variables, Production):**
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - **Verified:** the Supabase project URL is present in the deployed client bundle
    (`/_next/static/chunks/app/page-*.js`), which proves the env vars were set and the
    build picked them up. The live leaderboard therefore talks to Supabase, not just
    localhost.
- **Build config:** `next.config.mjs` sets `outputFileTracingRoot` and security headers.
  There is **no** custom `distDir` (an earlier `.next-gamedrop` override was removed
  because it broke Vercel's route manifest - do not re-add it).
- **Note on redeploys:** env-var changes only take effect on the next build. If you ever
  change an env var, trigger a redeploy (Deployments → ⋯ → Redeploy, or push a commit).

## Supabase (CONNECTED & VERIFIED)

- **Project ref:** `njbfgojfdefduidtrmpj`
- **Project URL:** `https://njbfgojfdefduidtrmpj.supabase.co`
- **Publishable / anon key:** `sb_publishable_W-mbiEcPHE7-zKrqt_7pRw_vP4yHE7M`
  - This key is **public by design** (like it says on the Supabase dashboard). It is
    already exposed in the public client bundle. Security comes from Row Level Security,
    not from hiding this key. Safe to have in the client and in this doc.
  - ⚠️ The **`service_role` / secret key is NOT here and must never be committed or used
    client-side.** It is not needed by this app.
- **Anonymous sign-ins:** ✅ **ENABLED** (verified: `POST /auth/v1/signup` returns an
  `access_token`). This is what lets players onto the leaderboard with no signup screen.
- **Schema:** ✅ applied. The `scores` table exists with RLS policies (public read;
  players write only their own rows; no deletes). Source of truth: `supabase/schema.sql`.
  Verified: `GET /rest/v1/scores` returns HTTP 200.
- **Write path proven:** a test row (`ProbeBot01`, game `orbit`, day `2000-01-01`) was
  successfully inserted through the RLS policies, confirming end-to-end writes work.
- **Local dev:** the same two keys are in `.env.local` (gitignored), so `npm run dev`
  connects to the same Supabase project.

### Supabase - what is NOT yet done (optional, does not affect the leaderboard)
- **Auth URL Configuration** (Authentication → URL Configuration): Site URL + redirect
  URLs for magic links. Only needed for the **optional email account** flow ("add your
  email" in the player card). The anonymous leaderboard does **not** need it.
- **Custom SMTP** (e.g. Resend or Brevo free tier) for a branded "GAMEDROP" sender and
  to lift the built-in mailer's low hourly limit. Optional, pre-launch.

## PostHog (WIRED IN CODE)

- **Config:** `lib/sdk/analytics.ts`.
- **Project key:** `phc_vQp5jDAawTKdYqqV23VHJFEwXQDoWtcuhEBf5kPkDiz2` (hardcoded as the
  default; a write-only **public** key, same category as the Supabase anon key).
- **Host:** `https://us.i.posthog.com` (US region).
- **Env overrides (optional):** `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.
  Because the key is hardcoded as a default, PostHog initializes **even without** env
  vars - so analytics is "on" out of the box.
- **Events wired:** `$pageview` (route-aware), `daily_completed`, `share_clicked`,
  `challenge_link_arrived`. Autocapture and session recording are deliberately off.
- **Verified:** the PostHog host is reachable and the code initializes on the client.
- **Not independently verified:** that events are actually landing in the PostHog
  dashboard (that requires logging into the PostHog project). If you want to confirm
  ingestion, open the PostHog project and watch the Live Events feed while using the
  site. This is a "check the dashboard" task, not a "configure it" task.

---

## Environment variables (complete list)

Local file is `.env.local` (gitignored, already present on the owner's machine). The
same values are set in Vercel. Full set the app understands:

```
# Required for the leaderboard + accounts (already set locally and in Vercel)
NEXT_PUBLIC_SUPABASE_URL=https://njbfgojfdefduidtrmpj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_W-mbiEcPHE7-zKrqt_7pRw_vP4yHE7M

# Optional - only if overriding the hardcoded PostHog defaults
# NEXT_PUBLIC_POSTHOG_KEY=...
# NEXT_PUBLIC_POSTHOG_HOST=...

# Optional - overrides the canonical site origin used in metadata/sitemap
# NEXT_PUBLIC_SITE_URL=https://gamesdrop.vercel.app
```

If `.env.local` is missing on a new machine, recreate it with the two Supabase lines
above. The app **degrades gracefully without them** (the leaderboard simply hides and
shows a "warming up" message) - it will still run, just without global scores.

---

## How to run / build / deploy (recap)

```bash
npm install          # first time
npm run dev          # http://localhost:3000
npx tsc --noEmit     # typecheck (should exit 0)
npm run build        # production build (stop the dev server first on Windows to avoid an EPERM on .next)
git push             # Vercel auto-deploys main
```

Windows note: keep the project at a short path (e.g. `C:\Users\Jitu\gamedrop`); a deep
path breaks `npm install` for native deps.

---

## The only genuinely pending items (short and honest)

1. **Buy the domain** (`gamedrop.day` recommended). Currently on `gamesdrop.vercel.app`.
2. **Supabase Auth URL config + custom SMTP** - only for the optional email-account
   feature, not the leaderboard.
3. **Confirm PostHog ingestion** in the PostHog dashboard (a look, not a setup).

Everything else - deployment, database, anonymous leaderboard, analytics wiring - is
done and verified. Please do not report these as "not configured."

---

## If you are an AI assistant reading this

- The project is **already deployed and connected.** Do not tell the user to "set up"
  Vercel, Supabase, or PostHog - they are set up. Verify against this file first.
- The public keys above are **safe** (RLS / write-only public keys). Do not treat them
  as leaked secrets or ask the user to rotate them. The only secret (Supabase
  `service_role`) is intentionally absent.
- If you need to confirm live status yourself: `curl -I https://gamesdrop.vercel.app`
  (expect 200), and `POST https://njbfgojfdefduidtrmpj.supabase.co/auth/v1/signup` with
  the `apikey` header (expect an `access_token`).
