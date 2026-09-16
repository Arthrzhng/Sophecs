-- Task 8: Counterpart — private, paired, claim-anchored rebuttals.
--
-- Numbered 0012, not the brief's 0010: 0008 ai_calls.prompt_version,
-- 0009 revisions, 0010 reading_responses, 0011 account_deletion_fks.

create table if not exists exchanges (
  id text primary key,                                   -- nanoid(10)
  topic_slug text not null references debate_topics (slug),
  debate_a text not null references debates (id),        -- opener's original debate
  debate_b text not null references debates (id),
  -- set null, not cascade: when one party deletes their account the other
  -- still has a page to land on, which says their counterpart has left.
  user_a uuid references auth.users on delete set null,
  user_b uuid references auth.users on delete set null,
  school_a text not null,
  school_b text not null,
  status text not null default 'open' check (status in ('open','complete','lapsed','blocked')),
  publish_a boolean not null default false,
  publish_b boolean not null default false,
  next_turn uuid references auth.users on delete set null, -- null when not open
  last_turn_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (user_a is null or user_b is null or user_a <> user_b),
  check (school_a <> school_b)
);
create index if not exists exchanges_user_a_idx on exchanges (user_a);
create index if not exists exchanges_user_b_idx on exchanges (user_b);
create index if not exists exchanges_topic_status_idx on exchanges (topic_slug, status);

create table if not exists turns (
  id text primary key,
  exchange_id text not null references exchanges (id) on delete cascade,
  author_id uuid references auth.users on delete set null,
  seq int not null check (seq between 1 and 4),
  quoted_claim text not null check (char_length(quoted_claim) between 10 and 300),
  body text not null check (char_length(body) between 150 and 1200),
  screen_result text not null default 'pending'
    check (screen_result in ('pending','ok','flagged','removed')),
  screen_reason text,
  created_at timestamptz not null default now(),
  unique (exchange_id, seq)
);

alter table debates add column if not exists seeking_counterpart_at timestamptz;
-- Pairing scans for the oldest seeker on a topic; without this it is a
-- sequential scan of every debate ever written on every opt-in.
create index if not exists debates_seeking_idx
  on debates (topic_slug, seeking_counterpart_at)
  where seeking_counterpart_at is not null;

create table if not exists blocks (
  blocker_id uuid references auth.users on delete cascade,
  blocked_id uuid references auth.users on delete cascade,
  created_at timestamptz default now(),
  primary key (blocker_id, blocked_id)
);
-- Pairing checks both directions, so the reverse lookup needs an index too.
create index if not exists blocks_blocked_idx on blocks (blocked_id);

create table if not exists reports (
  id text primary key,
  turn_id text references turns (id) on delete cascade,
  reporter_id uuid references auth.users on delete set null,
  reason text check (reason in ('harassment','personal_info','off_topic','spam','other')),
  note text check (char_length(note) <= 300),
  created_at timestamptz default now(),
  resolved_at timestamptz
);
create index if not exists reports_unresolved_idx on reports (created_at) where resolved_at is null;

-- The screening call is a second kind of AI call and has to be loggable.
alter table ai_calls drop constraint if exists ai_calls_kind_check;
alter table ai_calls add constraint ai_calls_kind_check
  check (kind in ('judge','golden','judge_allowlist','screen'));

alter table exchanges enable row level security;
alter table turns enable row level security;
alter table blocks enable row level security;
alter table reports enable row level security;

drop policy if exists "exchange read party" on exchanges;
create policy "exchange read party" on exchanges
  for select using (auth.uid() in (user_a, user_b));

-- Two select policies, OR-ed by Postgres: a party sees screened turns, and
-- an author always sees their own — including one held for review, which
-- is how they find out it was held.
drop policy if exists "turn read party" on turns;
create policy "turn read party" on turns
  for select using (
    screen_result = 'ok'
    and exists (
      select 1 from exchanges e
      where e.id = exchange_id and auth.uid() in (e.user_a, e.user_b)
    )
  );

drop policy if exists "turn read own" on turns;
create policy "turn read own" on turns for select using (auth.uid() = author_id);

drop policy if exists "blocks own" on blocks;
create policy "blocks own" on blocks
  for all using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

drop policy if exists "reports insert own" on reports;
create policy "reports insert own" on reports
  for insert with check (auth.uid() = reporter_id);

-- exchanges and turns are written only by server routes with the admin
-- client. No insert or update policies, deliberately.

-- Published exchanges, read through the admin client only. Both parties
-- must have opted in and the exchange must have run its course.
drop view if exists exchanges_public;
create view exchanges_public as
  select e.id, e.topic_slug, e.school_a, e.school_b, e.debate_a, e.debate_b, e.created_at
  from exchanges e
  where e.publish_a and e.publish_b and e.status = 'complete';
