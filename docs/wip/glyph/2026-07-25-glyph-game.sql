-- GLYPH (Drop 07) - allow 'glyph' scores through the check constraint.
-- Paste ONLY this file into: Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Run this BEFORE (or with) the deploy that ships GLYPH, or its scores are rejected.

alter table public.scores drop constraint if exists scores_game_check;
alter table public.scores add constraint scores_game_check
  check (game in ('glyph', 'tilt', 'orbit', 'sonar', 'heist', 'rush', 'trace'));
