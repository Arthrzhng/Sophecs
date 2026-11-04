-- Rolls back 0021. This reopens the hole 0021 closes: anyone holding the
-- site's public key can then rewrite any column of every challenge. Run it
-- only to undo a mistake in 0021 itself, and close the hole again after.
--
-- Recreates the policy exactly as 0001_phase1.sql made it. Loses nothing:
-- 0021 changed no row.

set local lock_timeout = '5s';

create policy "accept sets challengee" on public.challenges for update to anon, authenticated
  using (true) with check (true);
