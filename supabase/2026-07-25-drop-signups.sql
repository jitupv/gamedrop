-- Drop-notify list (v1) - emails of players who want a ping when a new game drops.
-- Paste ONLY this file into: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- (Do NOT re-run schema.sql - it drops and recreates the scores table.)

create table if not exists public.drop_signups (
  id bigint generated always as identity primary key,
  email text not null,
  created_at timestamptz not null default now()
);

-- one row per email, case-insensitive
create unique index if not exists drop_signups_email_idx
  on public.drop_signups (lower(email));

alter table public.drop_signups enable row level security;

-- anyone (anon or signed-in) may add an email; nobody can read the list from
-- the client - emails are private and only visible in the dashboard.
create policy "anyone can join the list"
  on public.drop_signups for insert
  to anon, authenticated
  with check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254);

-- no select / update / delete policies on purpose.
