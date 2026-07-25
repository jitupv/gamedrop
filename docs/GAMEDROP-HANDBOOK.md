# GAMEDROP - Project Handbook

> A complete record of GAMEDROP: what it is, why every decision was made, how it
> is built, and a full spec for the next 40 games so any developer or AI can keep
> building it. If you were just handed this repo, read this file top to bottom and
> you will understand the whole product.

---

## 1. What GAMEDROP is (the 30-second pitch)

GAMEDROP is a website of original browser games. The rules:

- **A brand-new game drops every Friday.** Older games never disappear - they move
  into "The Vault" and stay playable forever.
- **Every game has a fresh daily challenge at midnight.** The same puzzle for every
  player in the world that day. Beat it, share your result, come back tomorrow to
  keep your streak alive.
- **Every game also has an Endless mode** with no bottom - play until you fail, chase
  a personal best, land on the all-time leaderboard.
- **No install, no forced sign-up, free to play.** Optional account (email) only if
  you want your name and scores to follow you across devices.

The model is a deliberate blend of two proven loops:

- **Wordle** gives us the daily ritual: one shared puzzle, a hard stop, a streak, a
  spoiler-free share grid. Scarcity is why people come back every morning.
- **Arcade / Candy Crush** gives us the "just one more" depth: endless mode and
  leaderboards for players who want to sink an hour in.

You do not have to choose between them. The daily is the social/retention unit; the
endless is the depth. The finish screen of every daily is a springboard straight into
endless.

**Live site:** https://gamesdrop.vercel.app  ·  **Repo:** github.com/jitupv/gamedrop
**Intended domain:** gamedrop.day

---

## 2. The journey: how we got here (brainstorm to product)

This section is the "why". Every decision below was a real fork we took.

### 2.1 The original idea and the first pivot
The starting idea was "a different complex game every day, pay per day." Validation
killed it fast: complex games every day is unsustainable to build, and pay-per-day
kills the top of the funnel. We pivoted to the **weekly-drop + daily-challenge** model
(inspired by how Puzzmo and NYT Games structure things): build one polished game a
week, and squeeze daily replay value out of each one via seeded daily puzzles.

### 2.2 "Engaging" is a bar, not a feature
Early ORBIT could be won on the first attempt. That is the moment we learned the
core design law of this project:

> **Every game needs a constraint that forces a trade-off.** Without one, the player
> is not thinking, they are just doing. A game you can beat without thinking is a
> slot machine, not a puzzle.

- TILT's constraint: a limited number of moves.
- RUSH's constraint: real-time risk (one crash ends it).
- SONAR's constraint: limited memory (pings fade).
- HEIST's constraint: collect every gem AND never step on a tile twice.
- ORBIT's constraint: limited shots per hole AND a shrinking aim timer.
- TRACE's constraint: one stroke, no undo, drawn from memory.

Any new game that does not have a clear constraint should not ship. This is the single
most important lesson in this document.

### 2.3 Daily + Endless: why both, not one
We were challenged: "why not endless-only, let people play forever?" The answer that
held up:

- The **daily** is the thing you can share fairly ("I did today's SONAR in 4 pings" is
  comparable because everyone got the same maze), the thing a streak counts, and the
  thing a future prize competition can be built on. Its scarcity is a feature.
- The **endless** is for the players who want depth. It is the "play until you fail,
  highest score wins" loop.
- The fix for "they leave after 3 levels" was not to remove the daily - it was to make
  the daily's finish screen a **springboard** into endless ("Keep going" button + your
  endless best shown right there).

### 2.4 UI direction
Went through several iterations (colorful arcade, warm editorial beige) and landed on:
**clean, minimal, premium, cool-toned, Inter typography, light default with a dark
toggle.** The hero and game chrome share one design system. The rule the user set:
**no em dashes anywhere** (they read as AI-generated) - use plain hyphens.

### 2.5 Legal reality (India)
Because the founder is in India and prizes may come later: under the **Online Gaming
Act 2025**, free-entry prize contests are fine, paid-entry real-money games are banned.
So: **never gate a prize behind payment.** (Also: 30% TDS applies to winnings over
certain thresholds - a concern for the prize phase, not launch.)

### 2.6 Where the players are (market research, July 2026)
Real data, not vibes:
- **Browser-game traffic** (Poki, CrazyGames, ~30M MAU each): #1 United States, #2
  **India**, then Brazil / Turkey.
- **Daily-puzzle ritual culture** (Wordle, ~12M DAU): strongest in US, UK, Canada,
  Australia, northern Europe. 60% of players aged 25-54.
- **Money vs volume:** US + EU take ~60% of casual-gaming revenue at high CPM; India
  leads in volume at far lower per-user value (roughly 5-10x less ad money per visitor).

**Strategy that falls out of this:** aim the *prestige* (leaderboard, future revenue)
at US/UK/CA/AU via Reddit (r/WebGames, r/puzzles), Hacker News, and X share grids; let
**India supply the volume** that makes the leaderboards look alive (WhatsApp/Telegram
groups, Instagram Reels). A busy board is what converts a US visitor into a competitor,
and Indian volume fills the board within days. Our games are essentially
**language-free** (mazes, gravity, traffic), so Brazil/Turkey/Indonesia are reachable
with zero localization.

---

## 3. Tech stack and architecture

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 15** (App Router) | SSR for SEO on info pages, static export of game pages, fast |
| Language | **TypeScript** (strict) | Catch errors before runtime; the whole codebase typechecks clean |
| Styling | **Tailwind CSS v4** + hand-written CSS in `globals.css` | Utilities for layout, hand-written classes for critical surfaces |
| Games | **Plain HTML5 Canvas** + `requestAnimationFrame` | No game engine dependency; full control; tiny bundle |
| Icons | **Font Awesome** (React, self-hosted) | Consistent iconography, no CDN flicker |
| Backend | **Supabase** (Postgres + Auth) | Leaderboards + anonymous/optional accounts, generous free tier |
| Analytics | **PostHog** | Event funnels (pageview, daily_completed, share_clicked, etc.) |
| Hosting | **Vercel** | Zero-config Next.js deploys, auto-build on git push |

### 3.1 The key architectural ideas

**Deterministic daily generation.** Every game builds its levels from a seed string
that includes the date, e.g. `tilt:2026-07-24:L0`. Same date -> same puzzle for
everyone on Earth, with zero server involvement. The seed feeds a small PRNG
(`mulberry32(hashSeed(seed))` in `lib/sdk/rng.ts`).

**Solver-validated generation.** For games where a bad random level could be
impossible or trivial (ORBIT, HEIST, SONAR), the generator loops: generate a candidate,
run a solver over it, and only ship it if the solver proves it is solvable under the
game's actual rules (and not too easy). This is why every daily is guaranteed fair.

**A shared "game SDK".** All six games are built on the same small set of modules in
`lib/sdk/` (seeding, storage, sound, share, viewport, analytics, leaderboard). A new
game reuses all of it and only writes its own `engine.ts` (pure logic) plus its
`XGame.tsx` (canvas + React shell). See section 6.

**The viewport engine.** Every game defines a fixed "logical world" (e.g. 900x600).
`lib/sdk/viewport.ts` scales/centers/rotates that world to fill whatever screen space
is available, letterboxing with the game's own background color, and rotates 90 degrees
on portrait phones so wide games fill the screen. Input coordinates are mapped back
through the same transform. **New games never worry about screen size** - they draw in
their logical coordinates and the engine handles the rest.

**App-shell layout.** The homepage is an info hub. Each game lives at its own route
(`/tilt`, `/orbit`, ...) inside a `.game-frame` that is `position: fixed; inset: 0` so
it is immune to the mobile URL-bar `100vh` bug and can never scroll. Layout per game
page: `GameHeader` (back, theme, name, day number, mute, stats) -> `ModeSwitch`
(Daily/Endless) -> stat bar -> canvas fills all remaining space -> hint line.

---

## 4. Repository structure

```
gamedrop/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # root layout: Inter font, theme boot script, metadata
│   ├── page.tsx                # homepage (hero, live leaderboard, next-drop teaser, vault)
│   ├── globals.css             # the entire design system + all component styles (~2000 lines)
│   ├── manifest.ts             # PWA manifest
│   ├── opengraph-image.tsx     # 1200x630 social share card
│   ├── tilt/page.tsx           # each game page: <GameHeader/> + <XGame/> in .game-frame
│   ├── orbit/page.tsx
│   ├── sonar/page.tsx
│   ├── heist/page.tsx
│   ├── rush/page.tsx
│   ├── trace/page.tsx
│   ├── vault/page.tsx          # redirects to home
│   ├── about/  privacy/  terms/ page.tsx   # text pages via <SimplePage/>
│
├── components/
│   ├── GameHeader.tsx          # in-game top bar (theme-aware chrome)
│   ├── ModeSwitch.tsx          # Daily <-> Endless segmented toggle
│   ├── StatsModal.tsx          # per-game stats + the compact global board
│   ├── Celebration.tsx         # shared win overlay (stars, confetti, count-up, share)
│   ├── ChallengeBanner.tsx     # "a friend dares you" banner from ?beat= links
│   ├── Countdown.tsx           # live countdown to midnight
│   ├── HomeBoard.tsx           # homepage live leaderboard (podium wall)
│   ├── AccountModal.tsx        # optional account: rename, link email, sign out
│   ├── ThemeToggle.tsx         # light/dark toggle (persists in gd:theme)
│   ├── GameArt.tsx             # pure CSS/SVG gameplay scenes (hero + vault thumbs)
│   ├── SimplePage.tsx          # shell for about/privacy/terms
│   └── Analytics.tsx           # PostHog pageview tracker
│
├── games/                      # one folder per game
│   ├── tilt/  engine.ts + TiltGame.tsx
│   ├── orbit/ engine.ts + OrbitGame.tsx
│   ├── sonar/ engine.ts + SonarGame.tsx
│   ├── heist/ engine.ts + HeistGame.tsx
│   ├── rush/  engine.ts + RushGame.tsx
│   └── trace/ engine.ts + TraceGame.tsx
│
├── lib/
│   ├── games.ts                # the game registry (GameMeta[]) + Friday rotation
│   └── sdk/
│       ├── rng.ts              # hashSeed + mulberry32 seeded PRNG
│       ├── daily.ts            # todayKey, dayNumber, challengeNumber, prevKey
│       ├── storage.ts          # localStorage results, streaks; submits to leaderboard
│       ├── sound.ts            # WebAudio blip/chirp, mute toggle
│       ├── share.ts            # emoji-grid text + 1080x1080 image share card
│       ├── viewport.ts         # applyView / pointToGame / inScreenSpace
│       ├── analytics.ts        # PostHog wrapper (track, trackPageview)
│       └── leaderboard.ts      # Supabase: anon auth, submit/fetch scores, accounts
│
├── supabase/
│   └── schema.sql              # the leaderboard table + RLS policies
│
└── docs/
    └── GAMEDROP-HANDBOOK.md    # this file
```

---

## 5. Core data model

`lib/games.ts` holds the registry. Every game is one `GameMeta`:

```ts
interface GameMeta {
  id: string;            // "sonar"
  name: string;          // "SONAR"
  tagline: string;       // one-line hook
  status: "live" | "soon";
  emoji: string;         // used as watermark on share cards
  path: string;          // "/sonar"
  unit: string;          // what the score measures: "pings", "launches", "pts"
  higherIsBetter: boolean; // true for score-attack, false for golf-style (fewer = better)
  drop: number;          // release order; highest drop = this week's featured game
}
```

- `featuredGameId()` computes which game is "this week's" by counting Fridays since
  `FIRST_DROP_UTC` and rotating through `ROTATION`. **When a new game ships, add its id
  to `ROTATION` and give it the next `drop` number.**
- `challengeNumber(gameId)` (in `daily.ts`) = `dayNumber() + (latestDrop - thisGame.drop) * 7`.
  Because older games have been serving dailies longer, ORBIT (drop 1) shows a much
  higher challenge number than TILT (drop 6). This makes the catalog feel like it has
  real history.

---

## 6. The shared game SDK (read this before building a game)

Every module here is reused by all games. A new game should not reinvent any of it.

### `lib/sdk/rng.ts`
```ts
hashSeed(str): number        // string -> 32-bit seed
mulberry32(seed): () => number  // seed -> deterministic [0,1) generator
```
Usage: `const rng = mulberry32(hashSeed(\`game:\${dayKey}:L\${i}\`))`.
**Never use Math.random() for anything that must be the same for all players.**

### `lib/sdk/daily.ts`
```ts
todayKey(): string           // "2026-07-24" (local date)
dayNumber(): number          // days since launch epoch (2026-07-20 = day 1)
challengeNumber(gameId): number  // per-game challenge number (see section 5)
prevKey(key): string         // yesterday, for streak continuity checks
```

### `lib/sdk/storage.ts`
```ts
saveResult(game, day, {score, won}, higherIsBetter)  // saves best-of-day + submits to leaderboard
loadResult(game, day): DayResult | null
getStreak(game, today): number      // current streak (alive if last win was today/yesterday)
getAllResults(game): DayRecord[]     // every day ever played on this device
maxStreak(records): number
```
All progress is local-first (localStorage keys like `gd:sonar:2026-07-24`). Winning a
daily also fires `submitScore(...)` to Supabase (a no-op if Supabase is not configured).

### `lib/sdk/sound.ts`
```ts
blip(freq, dur, type, gain)          // short tone
chirp(from, to, dur, type, gain)     // pitch sweep
isMuted() / setMuted(bool)           // persisted in gd:muted, respected everywhere
```
Lazy AudioContext singleton (created on first sound, so no autoplay warnings).

### `lib/sdk/share.ts`
```ts
buildShare(game, num, lines[], challengeUrl?): string   // spoiler-free emoji grid text
challengeUrl(score): string                              // link back with ?beat=<score>
shareResult(text, card?): "shared" | "copied" | "failed" // native share sheet / clipboard
```
If a `ShareCard` is passed, `shareResult` renders a **1080x1080 PNG** (dark card, game
accent glow, giant emoji watermark, big stat, emoji grid, streak, `gamedrop.day` footer)
and shares the image + caption. The link always travels in the caption. Falls back to
clipboard image, then plain text.

### `lib/sdk/viewport.ts`
```ts
applyView(canvas, ctx, logicalW, logicalH, rotate, bgColor): View
  // resizes canvas to its element, paints bg, sets the transform, returns the View
pointToGame(view, canvas, clientX, clientY, logicalW): {x, y}
  // maps a pointer event back into logical game coordinates (handles rotation)
inScreenSpace(ctx, view, fn)
  // run fn with the transform temporarily reset (for upright HUD text on rotated boards)
```
The single most important helper. Draw in your logical world; it fits any screen.

### `lib/sdk/analytics.ts`
```ts
track(event, props?)         // PostHog event
trackPageview()
```
Events already wired: `$pageview`, `daily_completed`, `share_clicked`,
`challenge_link_arrived`.

### `lib/sdk/leaderboard.ts`
Supabase client, all no-ops gracefully if env vars are missing.
```ts
leaderboardEnabled(): boolean
submitScore(game, mode, day, score, higherIsBetter)   // fire-and-forget, only if improved
reportEndlessBest(game, score)
fetchBoard(game, mode, day, higherIsBetter, limit): Board  // rows + myRank + total
// accounts:
myHandle() / renameHandle(name) / validateHandle(name)
getAccount() / attachEmail(email) / signOutAccount()
```

---

## 7. The six live games

Each game is two files: `engine.ts` (pure, testable logic - no DOM) and `XGame.tsx`
(the canvas render loop + React state + overlays). The engine emits data; the component
draws it. This separation is why the games are solver-validatable and easy to reason
about.

### TILT (Drop 6) - match / slide puzzle. Score higher = better.
- **Mechanic:** swipe the whole 6x6 board in a direction; all tiles slide; 3+ in a line
  pop for points; gravity refills and cascades chain.
- **Constraint:** a limited number of moves per level.
- **The critical UX:** hold-to-preview. While dragging, color-tinted ghost tiles show
  exactly where every tile will land, and tiles that will pop get a white halo. The
  intended loop is: drag a direction, look, and if the future is bad, drag a different
  direction before releasing. Without this, a full-board slide is unpredictable and the
  game feels random. **This was a real failure we fixed** - the board was 7x7 (too many
  tiles to track) and the preview was too faint to notice. Now 6x6, ~20 tiles, obvious
  preview.
- **Daily:** 3 levels, escalating target/color count. `LEVELS` in engine.
- **Endless:** survival - no move limit, colors increase at score thresholds, game ends
  when the board jams (no valid move). Best saved to `gd:tilt:endless-best`.

### ORBIT (Drop 1) - gravity golf. Fewer launches = better.
- **Mechanic:** drag to aim and set power, release to launch a probe; real gravity from
  planets curves its path; reach the beacon. Grab the bonus star for an extra point.
- **Constraints (two):** (1) a hard shot budget per hole (`DAILY_FUEL = [8,9,10]`) -
  run dry and the hole is a bogey (+2 penalty). (2) an **aim timer**: a ring around the
  probe shrinks (green -> red) over a window that gets shorter each hole
  (`AIM_TIMES = [5,4,3]` seconds; endless squeezes toward a 2.5s floor). Release before
  it closes or the shot is wasted. These stop aim-spamming and force deliberate shots.
- **Generation + solver:** `genHoleFrom(seed, planetCount, winsCap)` generates a hole,
  simulates many candidate shots, and only ships it if it is solvable, is NOT winnable
  with a direct straight shot, and has at most `winsCap` viable solutions (fewer =
  harder). `HOLE_PLANETS = [4,5,6]`, `MAX_WINS_PER_HOLE = [36,22,12]`.
- **Daily:** 3 holes. **Endless:** fuel roguelite - each hole refills some fuel, denser
  systems forever, run ends at 0 fuel.

### SONAR (Drop 2) - memory maze. Fewer pings = better.
- **Mechanic:** you are a dot in a pitch-black maze. Ping to briefly light up nearby
  walls; memorize them; hold-drag to move in the dark toward the exit.
- **Constraint:** limited memory - pings fade fast (`PING_LIFE = 1.25s`) and reveal a
  limited radius (`PING_MAX_R = 4` cells). You must remember, not see.
- **Generation:** recursive-backtracker maze from seed, guaranteed connected. Daily
  sizes 17x11 / 23x15 / 29x17.
- **Daily:** 3 mazes. **Endless:** mazes grow forever and a "lantern" time budget per
  maze tightens; run ends when the lantern burns out.

### HEIST (Drop 3) - stealth route planning. Fewer plans = better.
- **Mechanic:** plan a full route from the thief to the exit, tile by tile, past guards
  that patrol fixed loops. Press GO and watch it execute - guards move when you move. If
  a guard catches you, replan.
- **Constraints (two):** (1) the vault is locked - your route must collect **every gem**
  before the exit opens. (2) **each tile can be stepped on only once** - no doubling back
  to wait out a guard. Together these turn it from "connect two points" into a real
  routing puzzle: find an order to grab all gems and reach the exit, timed against the
  patrols, as one self-avoiding path.
- **Generation + solver:** `genLevelFrom(seed, cfg)` scatters walls, guards on
  rectangular patrol loops, and gems, then runs `fullLootRoute()` - a self-avoiding DFS
  over (cell, time, gems-collected-bitmask) that proves a legal all-gems-then-exit route
  exists before shipping. Grids are small for touch (9x7 / 10x7 / 11x8).
- **Daily:** 3 museums. **Endless:** bigger museums, more guards, forever.

### RUSH (Drop 4) - reflex. More cars = better.
- **Mechanic:** you control one traffic light at a 4-way intersection. Toggle it to let
  cross-traffic through. Cars keep coming, faster and faster.
- **Constraint:** real-time risk - one collision ends the run instantly.
- **Daily:** a seeded traffic sequence with a goal (pass 25 cars). **Endless:** it is
  inherently endless - it IS the score-attack, so it has no separate Daily/Endless
  toggle. Daily = beat today's seeded run to the goal.

### TRACE (Drop 5) - drawing from memory. Higher accuracy = better.
- **Mechanic:** a shape appears for 3 seconds, then vanishes; redraw it from memory in
  one continuous stroke.
- **Constraint:** one stroke, no undo, no reference. Scored by raster overlap
  (precision x recall with dilation) between your drawing and the hidden target.
- **Daily:** 3 sketches of increasing complexity. **Endless:** 3 hearts; scoring below a
  threshold burns a heart; tangled shapes forever.

---

## 8. Design system

Everything lives in `app/globals.css`. Key ideas:

- **Cool, premium palette** (not beige). Light default: paper `#f4f5f7`, white surfaces,
  ink `#171a21`. Dark (opt-in via toggle): `#0e1014` / `#161a21`, ink `#e9ebf1`. Accent
  is gold (`#a97a10` light, `#e6c26b` dark), used sparingly for streaks, medals, CTAs.
- **Per-game accent colors** drive art and card tints: TILT `#ff6f61`, ORBIT `#9d8cff`,
  SONAR `#3fd6c0`, HEIST `#3fbf7f`, RUSH `#ffa23e`, TRACE `#6fa8ff`.
- **Typography:** Inter everywhere, loaded via `next/font`. Headings are heavy (800)
  with tight negative tracking (`-0.02em` to `-0.045em`). This tight-Inter treatment is
  the brand's typographic signature.
- **Theme is token-based.** Colors are CSS custom properties on `:root`; dark mode
  redefines only the tokens under `:root[data-theme="dark"]`. A boot script in
  `layout.tsx` sets the theme before first paint (no flash). Components use
  `var(--ink)` etc. and utility classes `.tx-ink / .tx-muted / .tx-soft` so all text
  flips with the theme. **Never hardcode a gray - use the tokens.**
- **Game chrome** (header, sticky pill, leaderboard card) is intentionally dark in both
  themes - it reads as "game mode."
- **Critical surfaces are hand-written CSS classes** (`.panel`, `.card`, `.btn-ink`,
  `.stat-bar`, `.game-frame`) not Tailwind arbitrary values, because Tailwind v4's
  source scanning silently dropped classes when the dev server ran from the wrong dir.
  Lesson learned: keep load-bearing styles in hand-written CSS.
- **No em dashes** in any copy. Plain hyphens only. (Founder preference - em dashes read
  as AI-written.)

---

## 9. Leaderboard and optional accounts (Supabase)

### 9.1 The model
- **Guest-first, forever.** On first play (while online) the browser silently gets an
  **anonymous** Supabase user - no signup screen - and a fun handle like `SwiftOtter42`.
- **Optional email upgrade.** In the "player card" modal a user can rename themselves
  and/or attach an email. Supabase *upgrades the same anonymous user* to a real account,
  so all their scores, streaks and board name survive. Signing in on another device
  brings everything with them.
- **Two boards per game:** Daily (resets at midnight, fair because everyone played the
  same puzzle) and Endless (all-time). Shown as a podium on the homepage and a compact
  list in the stats modal, with your rank and percentile.
- **Future paid Vault** reuses this exact login - membership becomes a flag on the
  account; the free experience never changes.

### 9.2 The schema (`supabase/schema.sql`)
One denormalized `scores` table (the handle lives on each row, so reading a board is a
single query - no joins):
```
scores(id, user_id, handle, game, mode['daily'|'endless'], day['YYYY-MM-DD'|'all'],
       score, created_at)
unique(user_id, game, mode, day)   -- one row per player/game/mode/day
```
Row Level Security: **anyone can read** the boards, **players can only write their own
rows**, **nobody can delete** (the board cannot be wiped).

### 9.3 Setup checklist (one-time)
1. Create a Supabase project (region closest to your users).
2. SQL Editor -> paste `supabase/schema.sql` -> Run.
3. Authentication -> enable **Anonymous sign-ins** (easy to miss; without it no score
   can be written).
4. Authentication -> URL Configuration -> Site URL + redirect URLs (localhost + prod)
   so magic links work.
5. Project Settings -> API -> copy the **Project URL** and **anon/publishable key**.
6. `.env.local` (and Vercel env vars, Production):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
7. Redeploy Vercel after adding env vars (env only bakes in at build time).
8. (Pre-launch) Custom SMTP (Resend / Brevo free tier) for a "GAMEDROP" sender name and
   to lift the built-in mailer's low hourly limit; edit templates at Auth -> Emails.

### 9.4 Anti-cheat (staged)
- **Now:** server rejects impossible scores via DB check constraints; RLS stops writing
  other people's rows.
- **Before any prize competition:** a Supabase Edge Function that replays the submitted
  move history server-side and rejects scores whose moves do not reproduce the claimed
  result. The engine/component split makes this feasible because the engine is pure.

---

## 10. Growth and monetization plan

- **Free channels (launch):** Reddit r/WebGames, r/playmygame, r/puzzles; Show HN;
  faceless Instagram Reels / YouTube Shorts of gameplay; WhatsApp/Telegram groups
  (India); game directories.
- **Paid (only after retention is proven):** boost the best-performing Reel, Meta ads at
  Rs 100-200/day, meme-page shoutouts. Kill any channel whose cost per visitor exceeds
  ~Rs 5.
- **Viral loop (built):** spoiler-free emoji share grids + 1080x1080 image cards +
  "beat me" challenge links (`?beat=<score>`) + a live homepage leaderboard that makes
  the site feel busy + a next-drop teaser + midnight countdowns.
- **Monetization order:** (1) audience + retention first, (2) unobtrusive ads once
  traffic is real, (3) optional paid "Vault membership" (full archive, extra endless
  perks) - never pay-to-win, never gate prizes behind payment.
- **Domain:** `.day` is the canonical choice (matches the daily concept). WHOIS privacy
  on. Keep the whole thing anonymous from friends/relatives per the founder's wish.

---

## 11. Running and deploying

```bash
# install (first time)
npm install

# develop
npm run dev            # http://localhost:3000

# typecheck (do this before every commit)
npx tsc --noEmit

# production build (verifies everything compiles + static-generates)
npm run build

# deploy: push to main; Vercel auto-builds
git add -A && git commit -m "..." && git push
```

Notes for future maintainers:
- The project MUST live at a short path (e.g. `C:\Users\Jitu\gamedrop`), not deep inside
  a long directory, because Windows' 260-char path limit breaks `npm install` for some
  native deps.
- The dev server holds a lock on `.next`; stop it before `npm run build` on Windows to
  avoid an EPERM on `.next/trace`.
- While editing a game file, a hot-reloading tab can briefly show a compile error - hard
  refresh (Ctrl+Shift+R) before judging a change.
- On each Friday drop: add the new game to `ROTATION` in `lib/games.ts` and give it the
  next `drop` number; the featured game then advances automatically.

---

## 12. Game design principles (the rulebook for new games)

Any new game MUST satisfy all of these, or it does not fit GAMEDROP:

1. **One clear constraint that forces a trade-off.** (See 2.2. This is non-negotiable.)
2. **Seeded daily** - the same puzzle for everyone that day, from a date-based seed.
3. **Solvable-guaranteed** - if generation is random, a solver must validate every daily
   before it ships. If hand-authored, the author guarantees it.
4. **2 to 4 minute daily** (3 levels is the usual shape) + a natural **endless** mode.
5. **One-finger input** - drag, tap, or swipe. Works on a phone with no instructions
   beyond a one-line hint and a short help overlay.
6. **Language-free if possible** - shapes, colors, motion travel globally; avoid text
   the player must read to play.
7. **A spoiler-free share artifact** - an emoji grid that tells the story of your run
   without giving away the answer.
8. **Reuse the SDK** - seeding, viewport, storage, sound, share, leaderboard. Only write
   `engine.ts` + `XGame.tsx`.
9. **Fits the 100dvh no-scroll game frame** and the shared header/stat-bar/canvas layout.
10. **A readable "juice" moment** on win (Celebration overlay: stars, count-up, confetti,
    share, springboard to endless).

### How to add a game (the mechanical checklist)
1. `games/<id>/engine.ts` - pure logic: a `newLevel(dayKey, i)` / `genLevelFrom(seed,cfg)`
   generator (+ solver if random), a `LEVELS` config array, and any step/sim functions.
2. `games/<id>/<Id>Game.tsx` - the canvas component: rAF draw loop using `applyView`,
   pointer handling via `pointToGame`, React state for HUD only (mutable sim state in
   refs), `ModeSwitch`, stat bar, `Celebration` on win, help overlay, share via
   `shareResult(text, card)`, endless best via `reportEndlessBest`.
3. `app/<id>/page.tsx` - `<div className="game-frame"><GameHeader gameId="<id>"/>
   <main ...><ChallengeBanner/><XGame/></main></div>`.
4. `lib/games.ts` - add the `GameMeta` (with `drop` = next number) and add the id to
   `ROTATION`.
5. Homepage `HOME` map in `app/page.tsx` - add accent, genre, description, difficulty,
   time, lede.
6. `GameArt.tsx` - add a small CSS/SVG scene for the hero + vault thumbnail.
7. Typecheck, build, playtest.

---

## 13. The next 40 games (specs for AI/dev to build)

Each spec gives everything needed to build the game in the GAMEDROP style: the hook, the
**constraint** (the thing that makes it a real puzzle), the daily and endless shapes, the
generation/solver approach, and which SDK pieces to reuse. They are grouped by family and
roughly ordered so you can pick a balanced rotation (do not ship five reflex games in a
row - alternate families).

> Build order suggestion for the next 6 drops (Drops 7-12): **PRISM, GLYPH, FLOW,
> PULSE, SUMS, UNTANGLE** - one from each family, maximum variety, all high-confidence.

### Family A - Logic and deduction (pure reasoning; best for the US/UK "smart" audience)

**7. PRISM** - laser and mirrors.
- Hook: place mirrors on a grid to bend a laser into every target.
- Constraint: a limited number of mirrors; the beam must hit ALL targets with one path.
- Daily: 3 boards, score = fewest mirrors used. Endless: boards grow, more targets.
- Generation + solver: place targets, then search mirror placements (BFS/DFS over beam
  paths) to guarantee a solution exists within the mirror budget; reject boards solvable
  with 0-1 mirrors (too easy). Reuse the grid + seeded rng + fewest-move scoring like
  HEIST.

**8. GLYPH** - symbol code-break (language-free Wordle x Mastermind).
- Hook: crack a hidden 4-symbol code in limited guesses; after each guess you learn how
  many symbols are right and how many are right-but-misplaced.
- Constraint: limited guesses; pure deduction, no luck if played optimally.
- Daily: one code, 6 guesses, share grid = colored pegs per guess (the best share
  mechanic of all 40 - travels across every language). Endless: codes get longer
  (5, 6 symbols) / more colors.
- Generation: just pick a seeded random code from N symbols; no solver needed (always
  solvable by deduction). Trivial to build, huge viral upside. **High priority.**

**9. NONO** - nonogram / picross.
- Hook: fill the grid so the row/column number clues are satisfied; a hidden picture
  emerges.
- Constraint: the clues have exactly one solution; guessing is punished (mistakes cost).
- Daily: one 10x10 (or 15x15) puzzle. Endless: bigger grids.
- Generation + solver: draw a seeded pixel picture, derive clues, then run a nonogram
  solver to confirm the clues yield a **unique** solution (reject if ambiguous). Share:
  the finished picture as emoji, or a completion time grid.

**10. CIRCUIT** - power routing, no crossings.
- Hook: connect each power source to its matching sink by drawing wires that never cross.
- Constraint: wires cannot overlap and must fill / respect the board (like Flow Free but
  daily + validated).
- Daily: 3 boards. Endless: bigger grids, more pairs.
- Generation + solver: generate a known non-crossing solution first (lay paths), then
  present just the endpoints; a solver confirms uniqueness or near-uniqueness.

**11. LIGHTS** - lights-out toggle.
- Hook: tap a cell to flip it and its neighbors; turn the whole grid off.
- Constraint: solvable in a minimum number of taps; score = taps used.
- Daily: 3 grids. Endless: bigger grids / colored (mod-3) variants.
- Generation + solver: start from all-off, apply a seeded set of random taps to scramble
  (guarantees solvability); minimum-tap solution via linear algebra over GF(2) for star
  scoring.

**12. LOOM** - loop drawing (Slitherlink-style).
- Hook: draw a single closed loop so each numbered cell has exactly that many of its
  edges used.
- Constraint: exactly one loop, no branches, satisfying all clues.
- Daily: one board. Endless: larger.
- Generation + solver: generate a random loop, derive edge-count clues, solver confirms
  uniqueness. Harder to build - schedule later.

**13. VAULT** - safe-crack deduction.
- Hook: three rotating dials; clues ("the sum is even", "no two adjacent match") narrow
  the combination; enter it in fewest tries.
- Constraint: pure logic from clue set; guessing wastes tries.
- Daily: one combination + clue set. Endless: more dials / tighter clues.
- Generation: pick a combo, generate a consistent minimal clue set, verify the clues
  uniquely determine it.

**14. DEDUCE** - logic grid (who/what/where).
- Hook: from a set of statements, deduce which icon pairs with which (the classic
  "Einstein's riddle" in miniature, using icons not words to stay language-free).
- Constraint: exactly one consistent assignment.
- Daily: one 4x4 grid of relationships. Endless: 5x5, more clues.
- Generation + solver: pick a solution, generate clues, use a constraint solver to
  ensure the clues force a unique answer and are minimal.

**15. SEGMENT** - shikaku / area division.
- Hook: divide the grid into rectangles, each containing exactly one number equal to its
  area.
- Constraint: rectangles tile the whole grid, no overlaps, one number each.
- Daily: one board. Endless: bigger.
- Generation + solver: cut the grid into random rectangles, place the area numbers,
  solver confirms uniqueness.

**16. BRIDGES** - hashi.
- Hook: connect numbered islands with bridges (1-2 each), no crossings, all connected.
- Constraint: bridge counts match, single connected network, no crossings.
- Daily: one board. Endless: more islands.
- Generation + solver: build a valid planar bridge network, present island counts,
  solver confirms uniqueness.

### Family B - Physics and trajectory (satisfying, shareable "how did you do that")

**17. RICOCHET** - bank shot.
- Hook: fire a ball that bounces off walls to hit the target; set angle and power.
- Constraint: limited shots; walls make direct hits impossible (like ORBIT's no-direct-
  shot rule). Reuse ORBIT's aim + shrinking-ring timer.
- Daily: 3 rooms. Endless: more walls / moving targets.
- Generation + solver: place walls + target, simulate candidate shots, ship only if a
  bank-shot solution exists and a direct shot does not.

**18. LOB** - artillery.
- Hook: pick angle and power to arc a projectile over obstacles onto a target, with wind.
- Constraint: limited attempts; wind + obstacles force calculation, not spamming.
- Daily: 3 shots. Endless: stronger wind, taller walls.
- Generation: seeded terrain + wind; solver confirms a firing solution exists in range.

**19. CASCADE** - one-bomb chain reaction.
- Hook: place a single detonation point; it triggers nearby cells which trigger their
  neighbors; clear enough of the board.
- Constraint: exactly one placement; you must read the chain before committing (show a
  preview like TILT).
- Daily: 3 boards with a clear-percentage target. Endless: denser boards.
- Generation + solver: simulate the chain from every cell; guarantee at least one
  placement clears the target, but not trivially many.

**20. BRIDGE-IT** - structural build.
- Hook: place a limited number of beams to build a bridge that holds a rolling weight to
  the other side.
- Constraint: limited beams + a simple physics sim (load/stress) that fails weak builds.
- Daily: 3 gaps. Endless: wider gaps, heavier loads.
- Generation: seeded terrain; validation = the reference solution passes the sim under
  the beam budget.

**21. MAGNET** - polarity steering.
- Hook: place + / - magnets to steer a charged ball through a gate; like polarity.
- Constraint: limited magnets; the ball's path is a physics sim.
- Daily: 3 boards. Endless: more gates / obstacles.
- Generation + solver: simulate ball paths under magnet placements; confirm a solution
  within budget.

**22. DROP** - peg strategy (plinko you design).
- Hook: place pegs so a dropped ball lands in the goal slot; not luck - you build the path.
- Constraint: limited pegs; deterministic physics (same drop = same path).
- Daily: 3 layouts. Endless: narrower goals / more forbidden slots.
- Generation: deterministic ball sim; ship layouts where a peg arrangement within budget
  routes the ball to the goal.

**23. SWING** - pendulum timing.
- Hook: a hook swings on a rope; release at the right moment to fling to the next hook;
  cross the gap in fewest releases.
- Constraint: real-time timing window; mis-timed release falls.
- Daily: a seeded course of 5 hooks. Endless: longer, faster courses.
- Reuse: PULSE-style timing ring; simple pendulum physics.

### Family C - Spatial and routing (broad appeal, mobile-perfect)

**24. FLOW** - pipe connect.
- Hook: connect matching colored dots with pipes that fill the whole board without
  crossing.
- Constraint: pipes fill every cell, no overlaps.
- Daily: 3 boards. Endless: bigger grids, more colors.
- Generation + solver: generate a full-board non-crossing solution, present endpoints,
  confirm uniqueness. (Very popular genre; high-confidence.)

**25. UNTANGLE** - planar graph.
- Hook: drag nodes so no two edges cross; untangle the web.
- Constraint: it is always solvable (the graph is planar); score = time or moves.
- Daily: one seeded planar graph, scrambled. Endless: more nodes.
- Generation: generate a random planar graph, scramble node positions. No solver needed
  (planarity guarantees a crossing-free layout exists). **Easy to build, satisfying.**

**26. HAMILTON** - fill every cell.
- Hook: draw one path that visits every cell exactly once, from start to end (HEIST's
  no-revisit rule as its own game).
- Constraint: visit every cell once; some cells are walls / forced waypoints.
- Daily: 3 grids. Endless: bigger.
- Generation + solver: generate a Hamiltonian path, add walls/waypoints, confirm a
  unique-ish solution via the same self-avoiding DFS HEIST already uses. **Reuses HEIST
  code directly.**

**27. LABYRINTH** - rotating tiles.
- Hook: rotate maze tiles to carve a path from entrance to exit.
- Constraint: limited rotations; a single connected path must form.
- Daily: 3 boards. Endless: bigger, more junction tiles.
- Generation + solver: build a solved tile layout, randomize rotations, confirm
  solvable within the rotation budget.

**28. FOLD** - paper folding.
- Hook: fold the shape along shown creases so it matches the target silhouette.
- Constraint: a fixed set of folds; order matters.
- Daily: 3 shapes. Endless: more folds.
- Generation: work backwards from a target by unfolding; the recorded folds are the
  puzzle.

**29. SLIDE** - 15-puzzle (daily image).
- Hook: slide tiles to reassemble the day's scrambled picture in fewest moves.
- Constraint: fewest moves; the scramble is always solvable (even-permutation check).
- Daily: one 4x4 from a seeded generated image (use GameArt-style scenes). Endless:
  5x5, 6x6.
- Generation: scramble via random legal moves (guarantees solvability); optimal-move
  count via IDA* for star scoring.

**30. TETRA** - perfect pack.
- Hook: place the given polyomino pieces to fill the board with no gaps.
- Constraint: pieces must tile the region exactly (a packing/exact-cover puzzle).
- Daily: one board + piece set. Endless: bigger boards / more pieces.
- Generation + solver: tile a region with random polyominoes, present the pieces, use an
  exact-cover (Dancing Links) solver to confirm a solution/uniqueness.

**31. HOP** - peg solitaire jumps.
- Hook: jump pegs over each other to remove them; clear the board to one peg.
- Constraint: only legal jumps; must reach the target end state.
- Daily: 3 boards. Endless: bigger patterns.
- Generation + solver: generate solvable boards by playing jumps backwards; DFS confirms
  a clearing sequence exists.

### Family D - Memory (short sessions, streak-friendly)

**32. ECHO** - spatial Simon.
- Hook: watch a sequence of tiles light up, then repeat it; the sequence grows.
- Constraint: memory under growth; one wrong tap ends it.
- Daily: a seeded sequence to a target length (everyone gets the same order). Endless:
  grows until you fail.
- Generation: seeded sequence of grid positions. No solver. Trivial to build.

**33. PAIRS** - one-glimpse match.
- Hook: all cards flash face-up for a moment, then flip down; find every matching pair
  from memory in fewest flips.
- Constraint: limited peeks; scored by flips used.
- Daily: one seeded board. Endless: bigger grids.
- Generation: seeded pair layout. No solver.

**34. RECALL-PATH** - route memory.
- Hook: a path is drawn across a grid, then hidden; retrace it exactly.
- Constraint: from memory, no reference; a wrong step costs.
- Daily: 3 paths. Endless: longer paths.
- Generation: seeded random path.

**35. SHIFT** - spot the change.
- Hook: a scene is shown, blinks, and one thing changes; tap what changed, fast.
- Constraint: time pressure + subtlety; wrong taps cost.
- Daily: a seeded sequence of scenes. Endless: subtler, faster.
- Generation: seeded scene + one seeded mutation (color, position, count).

### Family E - Reflex and timing (fills the "active" slot; use sparingly)

**36. PULSE** - release at the ring.
- Hook: a ring pulses in and out around a target; tap when it aligns exactly; chain
  perfect hits.
- Constraint: precise timing window; the window shrinks as you chain.
- Daily: a seeded rhythm sequence. Endless: faster, tighter.
- Reuse: exactly ORBIT's shrinking-ring code, standalone. **Easy, satisfying.**

**37. WEAVE** - lane dodge.
- Hook: steer a dot down lanes, dodging a seeded stream of obstacles; survive / go far.
- Constraint: real-time; one hit ends it.
- Daily: a seeded obstacle stream to a distance goal. Endless: faster.
- Reuse: RUSH-style spawner and collision.

**38. STACK** - timing tower.
- Hook: a moving block slides; tap to drop it on the stack; overhang is trimmed; build
  high.
- Constraint: precision; the platform narrows with every miss until you drop off.
- Daily: seeded speed pattern to a height goal. Endless: forever.
- Generation: seeded speed sequence.

**39. TEMPO** - rhythm tap.
- Hook: tap in time with a seeded beat pattern; keep the combo.
- Constraint: timing accuracy; misses break the combo.
- Daily: one seeded beat map. Endless: faster patterns.
- Reuse: sound.ts for the beat; language-free.

**40. SPIN** - stop the wheel.
- Hook: a marker spins around a wheel; tap to stop it in the shrinking green zone;
  chain to shrink it further.
- Constraint: timing; the safe zone shrinks each round.
- Daily: seeded speeds. Endless: forever.

### Family F - Numbers (language-light, huge in India + globally)

**41. SUMS** - reach the target.
- Hook: combine the given numbers with + - x to hit the target (the "24 game" /
  Countdown numbers round).
- Constraint: use each number at most once; find a valid expression.
- Daily: 3 seeded number sets + targets. Endless: harder targets.
- Generation + solver: pick numbers, compute a reachable target by brute force over
  expressions; guarantee at least one solution exists. **High-confidence, addictive.**

**42. DIGITS** - build up to numbers (NYT Digits style).
- Hook: from six starting numbers, use arithmetic to reach a series of target numbers;
  closer = more stars.
- Constraint: each intermediate result is consumed; limited operations.
- Daily: 5 targets from one seed. Endless: bigger targets.
- Generation + solver: ensure each target is reachable; score partial solutions.

**43. LADDER** - number sequence logic.
- Hook: deduce the rule of a number sequence and supply the missing terms.
- Constraint: exactly one consistent rule (kept simple: arithmetic/geometric/alternating).
- Daily: 3 sequences. Endless: trickier rules.
- Generation: pick a rule, blank some terms, verify the visible terms determine it.

**44. KAKURO** - cross sums.
- Hook: fill cells with 1-9 so each run sums to its clue, no repeats in a run.
- Constraint: unique digits per run, sums match, one solution.
- Daily: one board. Endless: bigger.
- Generation + solver: generate a filled valid board, derive clues, solver confirms
  uniqueness.

**45. BALANCE** - equation scale.
- Hook: place weights (numbers) on a balance so both sides equal, using the given set.
- Constraint: use the exact set; both pans must balance.
- Daily: 3 puzzles. Endless: more weights.
- Generation: partition a seeded multiset into two equal-sum halves; guarantee a
  partition exists.

**46. GRID-SUM** - magic-square-lite.
- Hook: place the given numbers so every row and column hits its target sum.
- Constraint: each number used once; all row/col targets satisfied.
- Daily: one 3x3 or 4x4. Endless: bigger.
- Generation + solver: fill a valid grid, present partial + targets, confirm uniqueness.

> That is 40 new games (Drops 7-46) across six families. Every one has a stated
> constraint, a daily+endless shape, and a generation/validation approach. When building
> any of them, follow section 12's checklist and reuse the SDK. Prefer the ones marked
> "high-confidence / easy" for early drops (GLYPH, FLOW, UNTANGLE, PULSE, SUMS, ECHO,
> HAMILTON) - they are satisfying, quick to build, and hard to get wrong.

---

## 14. A ready-to-use prompt for building a new game with AI

Paste this to an AI coding assistant, filling in the brackets:

> You are adding a new game to GAMEDROP, a Next.js 15 + TypeScript + Canvas daily-puzzle
> site. Read `docs/GAMEDROP-HANDBOOK.md` sections 6, 7, and 12 first. Build the game
> **[NAME]** from its spec in section 13 (#[N]). Follow the existing patterns exactly:
> a pure `games/[id]/engine.ts` (seeded generation via `lib/sdk/rng.ts`, a solver that
> validates every daily is solvable under the game's constraint, a `LEVELS` config, and
> step/sim functions), and a `games/[id]/[Id]Game.tsx` canvas component that uses
> `applyView`/`pointToGame` from `lib/sdk/viewport.ts`, keeps mutable sim state in refs
> and only HUD state in React, renders `ModeSwitch`, a stat bar, a `Celebration` on win
> with a share card, a help overlay, and endless mode. Wire it into `lib/games.ts`
> (registry + ROTATION + next `drop`), `app/[id]/page.tsx`, the homepage `HOME` map, and
> `GameArt.tsx`. Enforce the game's constraint strictly (that is what makes it a real
> puzzle). No em dashes in copy. Run `npx tsc --noEmit` and `npm run build` and fix all
> errors. Keep the 100dvh no-scroll game frame.

---

*Handbook maintained alongside the code. When you change a system, update the relevant
section here so the next person (or AI) inherits the truth.*
