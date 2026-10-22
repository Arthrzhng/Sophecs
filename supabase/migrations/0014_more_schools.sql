-- Phase 2C, part one: the school CHECK constraints admit the three new
-- schools.
--
-- Four constraints on three tables, not three. docs/phase1-recon.md listed
-- the tables and missed quiz_results.secondary, which is its own
-- constraint and needs its own statement.
--
-- Every existing row already passes: the only school values anywhere in
-- the database are the original three (recorded in
-- docs/seed-snapshots/2026-10-21-phase2c-pre-migration.json). A widened
-- CHECK is strictly weaker than the one it replaces, so there is no row
-- this can reject.
--
-- One thing this opens, deliberately and on the record. Nothing writes a
-- draft school into profiles.school: the quiz scores only the original
-- three and the registry keeps drafts off every surface. But until 2E
-- lands, the only thing standing between a reader whose profile said
-- "confucian" and a 500 from /api/judge is that nothing writes it, because
-- FIDELITY_CRITERIA throws for a school with no criteria. See
-- docs/decisions.md, "Two things 2E owes before any school is published".
--
-- Locks: each statement takes ACCESS EXCLUSIVE on its table. DROP
-- CONSTRAINT is a catalogue edit and does not read the table. ADD
-- CONSTRAINT validates every existing row, so it scans. At the current row
-- counts (27 / 1 / 1) that is well under a millisecond per statement;
-- measured timings and the figures at a million rows are in the pull
-- request. The NOT VALID / VALIDATE CONSTRAINT split, which takes only
-- SHARE UPDATE EXCLUSIVE for the scan, is the right shape for a large
-- table and pointless at this size.
--
-- The whole file is one transaction, so the old constraint is never absent
-- to a concurrent writer: it is replaced, not removed and then restored.
--
-- This file does not open its own transaction. Supabase's migration runner
-- wraps each migration in one, and nesting a `begin` inside that would end
-- the runner's transaction early at the `commit`. Run it by hand with
-- `psql --single-transaction` so a failure rolls the whole file back;
-- scripts/test-migrations.sh does.


alter table quiz_results drop constraint quiz_results_school_check;
alter table quiz_results
  add constraint quiz_results_school_check
  check (school in ('stoicism','utilitarianism','virtue-ethics','confucian','ubuntu','buddhist'));

alter table quiz_results drop constraint quiz_results_secondary_check;
alter table quiz_results
  add constraint quiz_results_secondary_check
  check (secondary in ('stoicism','utilitarianism','virtue-ethics','confucian','ubuntu','buddhist'));

alter table profiles drop constraint profiles_school_check;
alter table profiles
  add constraint profiles_school_check
  check (school in ('stoicism','utilitarianism','virtue-ethics','confucian','ubuntu','buddhist'));

alter table debates drop constraint debates_school_check;
alter table debates
  add constraint debates_school_check
  check (school in ('stoicism','utilitarianism','virtue-ethics','confucian','ubuntu','buddhist'));

-- The counterpart exchange table had no school constraint at all, only
-- `school_a <> school_b`. Adding one is new enforcement rather than a
-- widening, so it was reported before being written: the table holds zero
-- rows, and zero of them would fail, so nothing existing is at stake.
--
-- Both columns are copied from debates.school at exchange creation, which
-- is constrained above, so this makes the two agree instead of trusting
-- the writer. Named for the column rather than the table so a later
-- single-column change does not have to touch both.
alter table exchanges
  add constraint exchanges_school_a_check
  check (school_a in ('stoicism','utilitarianism','virtue-ethics','confucian','ubuntu','buddhist'));
alter table exchanges
  add constraint exchanges_school_b_check
  check (school_b in ('stoicism','utilitarianism','virtue-ethics','confucian','ubuntu','buddhist'));
