-- Phase 1: the acquisition loop (quiz -> result -> share -> challenge capture).
-- RLS on from this first migration, per the brief.

create table quiz_results (
  id text primary key,                     -- nanoid(10)
  anon_id uuid not null,                    -- from the anon_id cookie
  user_id uuid references auth.users,       -- null until Phase 2 claim
  school text not null check (school in ('stoicism','utilitarianism','virtue-ethics')),
  secondary text check (secondary in ('stoicism','utilitarianism','virtue-ethics')),
  vector jsonb not null,                    -- {stoicism: 0.61, utilitarianism: 0.22, ...}
  answers jsonb not null,                   -- [{q: 1, opt: 'b'}, ...]
  challenge_from text references quiz_results (id),
  referrer text,                            -- utm/ref at quiz start
  created_at timestamptz not null default now()
);
create index on quiz_results (anon_id);
create index on quiz_results (challenge_from);

alter table quiz_results enable row level security;

-- Public read of the card's needs only; answers stay private.
create view public_results as
  select id, school, secondary, vector, challenge_from, created_at from quiz_results;

create policy "anon insert own" on quiz_results for insert to anon, authenticated
  with check (true); -- id and anon_id are generated server-side in a server action

create policy "read own" on quiz_results for select to anon, authenticated
  using (anon_id = (current_setting('request.headers', true)::json ->> 'x-anon-id')::uuid);

-- /r/[id] reads via public_results using the admin client server-side.
-- No client ever holds service role.

-- Challenge capture. The brief's own SQL groups this under "Phase 2", but its
-- prose is explicit that the row is created in Phase 1 ("the table ships in
-- Phase 1 for this reason") — that inconsistency is resolved in favor of the
-- prose; see docs/decisions.md. topic_slug and the challenger_debate_id /
-- challengee_debate_id columns arrive via ALTER once debate_topics and
-- debates exist in Phase 2.
create table challenges (
  id text primary key,
  challenger_result_id text not null references quiz_results (id),
  challengee_result_id text references quiz_results (id),
  status text not null default 'open' check (status in ('open', 'accepted', 'complete')),
  created_at timestamptz not null default now()
);
alter table challenges enable row level security;

create policy "public read" on challenges for select to anon, authenticated using (true);
create policy "anon insert own" on challenges for insert to anon, authenticated with check (true);
create policy "accept sets challengee" on challenges for update to anon, authenticated
  using (true) with check (true);

-- Optional Phase 1 auth scaffolding (magic link + Google), pulled forward
-- from Phase 2 at Arthur's request. The quiz/card/share path never
-- references this table or gates on it. elo/streak/school/streak_updated_on
-- arrive via ALTER once debates exist in Phase 2.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  handle text unique,
  display_name text,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

create policy "public read" on profiles for select using (true);
create policy "own update" on profiles for update using (auth.uid () = id);
create policy "own insert" on profiles for insert with check (auth.uid () = id);
