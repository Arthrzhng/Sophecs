-- Recreates the five policies 0025 drops, exactly as production held them
-- on 2026-11-05 (docs/seed-snapshots/2026-11-05-before-0024.json): name,
-- command, roles and expression. Unreachable while 0022's grants stand.

create policy "debates insert own" on public.debates
  for insert with check (auth.uid() = user_id);

create policy "own insert" on public.profiles
  for insert with check (auth.uid() = id);

create policy "anon insert own" on public.challenges
  for insert to anon, authenticated with check (true);

create policy "anon insert own" on public.quiz_results
  for insert to anon, authenticated with check (true);

create policy "member join self" on public.class_members
  for insert with check (auth.uid() = user_id);
