-- GAMEDROP leaderboard schema (v1)
-- Paste this whole file into: Supabase Dashboard → SQL Editor → New query → Run
--
-- NOTE: this REPLACES the practice tables from the earlier lesson (profiles + scores).
-- v1 uses a single denormalized table - no joins needed to read a board; a separate
-- profiles table returns later when players can rename themselves / claim accounts.
-- Safe to run: your project has no live player data yet.
drop table if exists public.scores cascade;
drop table if exists public.profiles cascade;

-- One table holds both boards:
--   daily rows:   mode='daily',   day='2026-07-24'  (one row per player per game per day)
--   endless rows: mode='endless', day='all'         (one all-time best row per player per game)
-- Players are anonymous Supabase users (no email/password) with a fun generated handle.

create table public.scores (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  handle text not null check (char_length(handle) between 3 and 24),
  game text not null check (game in ('tilt', 'orbit', 'sonar', 'heist', 'rush', 'trace')),
  mode text not null check (mode in ('daily', 'endless')),
  day text not null check (day = 'all' or day ~ '^\d{4}-\d{2}-\d{2}$'),
  score integer not null check (score >= 0 and score <= 1000000),
  created_at timestamptz not null default now(),
  unique (user_id, game, mode, day)
);

-- fast board reads: "top N for this game+mode+day ordered by score"
create index scores_board_idx on public.scores (game, mode, day, score);

-- Row Level Security: anyone can READ the boards; players can only write THEIR OWN rows.
alter table public.scores enable row level security;

create policy "boards are public"
  on public.scores for select
  using (true);

create policy "players insert their own score"
  on public.scores for insert
  with check (auth.uid() = user_id);

create policy "players improve their own score"
  on public.scores for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- no delete policy on purpose: nobody can wipe the board.
