-- Phase 2b: the debate. Topics, arguments, verdicts.

create table debate_topics (
  slug text primary key,
  title text not null,
  motion text not null,
  stances jsonb not null,           -- {stoicism: "...", utilitarianism: "...", "virtue-ethics": "..."}
  micro_before text not null,       -- slug of a content/micro/*.md file, read via fs like content/schools
  micro_after text not null,
  sort int not null default 0,
  active boolean not null default true,
  par_elo numeric not null default 1200,
  par_n int not null default 0,
  created_at timestamptz not null default now()
);
alter table debate_topics enable row level security;
create policy "public read" on debate_topics for select using (true);
-- Written only by scripts/seed-topics.ts with the admin client (upserts from
-- content/topics/*.md) and by the judge route updating par_elo/par_n.

create table debates (
  id text primary key,                                  -- nanoid(10)
  user_id uuid not null references auth.users,
  topic_slug text not null references debate_topics (slug),
  challenge_id text references challenges (id),
  school text not null check (school in ('stoicism', 'utilitarianism', 'virtue-ethics')),
  argument text not null,
  rejected boolean not null default false,
  rejection_reason text,
  verdict jsonb,                                         -- full judge response; null until judged
  score numeric,                                         -- denormalized from verdict.score for querying
  prompt_version text,
  argument_public boolean not null default false,
  elo_before numeric,
  elo_after numeric,
  elo_recomputed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on debates (user_id);
create index on debates (topic_slug);
create index on debates (challenge_id);

alter table debates enable row level security;
create policy "debates insert own" on debates for insert with check (auth.uid () = user_id);
create policy "debates read own" on debates for select using (auth.uid () = user_id);
-- Public verdict pages read via debates_public (below) using the admin
-- client server-side — no client ever queries `debates` directly for
-- someone else's row.

create view debates_public as
  select
    d.id, d.topic_slug, d.school, d.score, d.verdict, d.elo_before, d.elo_after, d.created_at,
    case when d.argument_public then d.argument else null end as argument
  from debates d;

-- Phase 1's challenges."public read" (using (true)) is tightened now that
-- accounts exist: only the two participants (via their claimed
-- quiz_results.user_id) may read a challenge row directly. /c/[id] and the
-- Phase 1 server actions already go through the admin client, so this
-- doesn't affect them — see docs/decisions.md.
drop policy "public read" on challenges;
create policy "challenges read party" on challenges for select using (
  exists (
    select 1 from quiz_results r
    where (r.id = challenger_result_id or r.id = challengee_result_id)
      and r.user_id = auth.uid ()
  )
);
