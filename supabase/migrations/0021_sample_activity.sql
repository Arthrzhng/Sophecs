-- Sample activity: a durable marker for sample rows, a registry of which
-- seed run owns each row, protection for both, and the two public views
-- and one function that must tell sample rows from genuine ones.
--
-- What it is for: scripts/seed-production.ts creates labelled sample
-- accounts and activity that render through the normal pages. Everything
-- here exists so that those rows can be (1) recognised wherever they are
-- shown, (2) kept out of genuine competitive calibration, and (3) removed
-- by the run that made them and by nothing else. docs/sample-activity.md
-- has the design.
--
-- Additive: new columns default to false, so every existing row stays
-- genuine without being rewritten (a constant default is a catalogue
-- change on Postgres 11 and later). New tables start empty. The two views
-- gain columns at the end, which create or replace allows, and keep their
-- owner and grants. elo_percentile keeps its signature.
--
-- Locks, until commit: ACCESS EXCLUSIVE, briefly, on profiles,
-- quiz_results, debates, challenges and exchanges for the column adds and
-- the triggers, and on the two views. No row is rewritten. No transaction
-- of its own: the Supabase runner wraps the file, and by hand it is
-- `psql --single-transaction`.

set local lock_timeout = '5s';

-- 1. The marker. True only for rows a seed run created.
alter table public.profiles add column is_sample boolean not null default false;
alter table public.quiz_results add column is_sample boolean not null default false;
alter table public.debates add column is_sample boolean not null default false;
alter table public.challenges add column is_sample boolean not null default false;
alter table public.exchanges add column is_sample boolean not null default false;

-- A verdict written from a template rather than by the judge. The verdict
-- page shows "Sample assessment" for these. A sample debate judged by the
-- real judge (scripts/seed-production.ts --real-judge) keeps false.
alter table public.debates add column verdict_is_template boolean not null default false;

-- 2. The registry. One row per seed run, and one per row a run intends to
-- create, recorded before the row is created so a crash between the two
-- leaves an intent that the next attempt reconciles, never an orphan.
create table public.seed_runs (
  id text primary key check (id ~ '^[a-z0-9-]{6,64}$'),
  status text not null check (status in ('running', 'complete', 'failed', 'tearing_down', 'torn_down')),
  plan_hash text not null,
  generator_version text not null,
  seed integer not null,
  window_from timestamptz not null,
  window_to timestamptz not null,
  counts jsonb not null default '{}'::jsonb,
  lock_token text,
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.seed_run_items (
  run_id text not null references public.seed_runs(id),
  kind text not null check (kind in (
    'auth_user', 'profile', 'quiz_result', 'debate', 'challenge',
    'exchange', 'turn', 'reading_response', 'class', 'class_member'
  )),
  logical_id text not null,
  row_id text,
  state text not null default 'intended' check (state in ('intended', 'created', 'deleted')),
  updated_at timestamptz not null default now(),
  primary key (run_id, kind, logical_id)
);
-- One owner per real row: a row can never be claimed by two runs.
create unique index seed_run_items_row on public.seed_run_items (kind, row_id) where row_id is not null;

-- Only the server role reads or writes the registry.
alter table public.seed_runs enable row level security;
alter table public.seed_run_items enable row level security;
revoke all on public.seed_runs, public.seed_run_items from public, anon, authenticated;
grant all on public.seed_runs, public.seed_run_items to service_role;

-- 3. Nobody but the server role sets or clears the marker. The tables
-- already refuse most client writes through row level security; this
-- holds even where a policy lets a client write its own row.
create or replace function public.guard_sample_marker() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'service_role', 'supabase_admin') then
    return new;
  end if;
  if tg_op = 'INSERT' and new.is_sample then
    raise exception 'is_sample is set only by the seed tooling';
  end if;
  if tg_op = 'UPDATE' and new.is_sample is distinct from old.is_sample then
    raise exception 'is_sample is set only by the seed tooling';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_sample before insert or update on public.profiles
  for each row execute function public.guard_sample_marker();
create trigger quiz_results_guard_sample before insert or update on public.quiz_results
  for each row execute function public.guard_sample_marker();
create trigger debates_guard_sample before insert or update on public.debates
  for each row execute function public.guard_sample_marker();
create trigger challenges_guard_sample before insert or update on public.challenges
  for each row execute function public.guard_sample_marker();
create trigger exchanges_guard_sample before insert or update on public.exchanges
  for each row execute function public.guard_sample_marker();

-- 4. The public views carry the marker, so the pages that read them can
-- label sample rows. debates_public is 0020's definition, unchanged, with
-- two columns appended; public_results is 0001's with one.
create or replace view public.debates_public as
  select
    d.id,
    d.topic_slug,
    d.school,
    d.score,
    case
      when d.verdict is null then d.verdict
      when d.argument_public and coalesce(p.argument_public, true) then d.verdict
      when jsonb_typeof(d.verdict) <> 'object' then null
      else (
        select coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
        from jsonb_each(d.verdict) e
        where e.key in (
          'rejected',
          'score',
          'fidelity',
          'rigor',
          'engagement',
          'objection_answered',
          'prompt_version'
        )
        and case
          when e.key = 'rejected' or e.key = 'objection_answered'
            then jsonb_typeof(e.value) = 'boolean'
          when e.key = 'prompt_version'
            then jsonb_typeof(e.value) = 'string' and (e.value #>> '{}') ~ '^v[0-9]+$'
          else jsonb_typeof(e.value) in ('number', 'null')
        end
      ) || case
        when jsonb_typeof(d.verdict -> 'unanswered_objection' -> 'school') = 'string'
          and (d.verdict -> 'unanswered_objection' ->> 'school') ~ '^[a-z-]+$'
          then jsonb_build_object(
            'unanswered_objection',
            jsonb_build_object(
              'school', d.verdict -> 'unanswered_objection' -> 'school',
              'claim', null,
              'why_it_stands', null
            )
          )
        else '{}'::jsonb
      end
    end as verdict,
    d.elo_before,
    d.elo_after,
    d.created_at,
    d.kind,
    d.parent_debate_id,
    case when d.argument_public then d.argument else null end as argument,
    d.motion_text,
    d.is_sample,
    d.verdict_is_template
  from debates d
  left join debates p on p.id = d.parent_debate_id;

create or replace view public.public_results as
  select id, school, secondary, vector, challenge_from, created_at, is_sample from quiz_results;

-- 5. A genuine reader's percentile is among genuine readers. Sample
-- ratings are shown, labelled, but never move where a real reader stands.
create or replace function public.elo_percentile(user_elo numeric)
returns numeric
language sql
stable
as $$
  select case when (select count(*) from profiles where not is_sample) = 0 then 0
    else (select count(*) from profiles where not is_sample and elo < user_elo)::numeric
         / (select count(*) from profiles where not is_sample)::numeric
  end;
$$;
