-- Sophecs schema. Everything is keyed by school_id so a fourth school is an
-- insert, not a migration.

create table schools (
  id text primary key,               -- 'stoicism' | 'utilitarianism' | 'virtue-ethics'
  name text not null,
  color_token text not null          -- CSS custom property, e.g. '--color-stoic'
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  school_id text references schools (id),
  rating integer not null default 1000,
  streak_days integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz not null default now()
);

create table quiz_questions (
  id text primary key,
  prompt text not null,
  position integer not null
);

create table quiz_options (
  id text primary key,
  question_id text not null references quiz_questions (id) on delete cascade,
  label text not null,
  school_id text not null references schools (id)
);

create table quiz_results (
  id uuid primary key default gen_random_uuid (),
  profile_id uuid references profiles (id) on delete set null, -- null for anon
  pct_stoic integer not null,
  pct_util integer not null,
  pct_virtue integer not null,
  assigned_school_id text not null references schools (id),
  created_at timestamptz not null default now()
);

-- id matches a debate_topics[].id in the module named by module_id; the
-- motion's text lives only in that frontmatter, never duplicated here.
create table motions (
  id text primary key,
  module_id text not null,           -- frontmatter id of a content module
  opens_at timestamptz not null,
  closes_at timestamptz not null
);

-- Standalone condensed teaching shown after a debate, keyed by motion.
create table micro_lessons (
  id text primary key,
  motion_id text not null references motions (id) on delete cascade,
  body text not null
);

create table submissions (
  id text primary key default gen_random_uuid ()::text,
  motion_id text not null references motions (id),
  -- 'system' marks the stubbed opponent used when no human is available,
  -- so this is a plain text column rather than a profiles FK.
  profile_id text not null,
  side text not null check (side in ('for', 'against')),
  body text not null check (char_length(body) <= 600),
  created_at timestamptz not null default now()
);

create table matches (
  id text primary key default gen_random_uuid ()::text,
  motion_id text not null references motions (id),
  submission_a text not null references submissions (id),
  submission_b text not null references submissions (id),
  status text not null default 'pending' check (status in ('pending', 'judged'))
);

create table verdicts (
  id text primary key default gen_random_uuid ()::text,
  match_id text not null references matches (id),
  winner_submission_id text not null references submissions (id),
  -- {a: {logic, sources, answers_opponent, clarity}, b: {...}}
  scores jsonb not null,
  rationale text not null
);

-- Defection is a first-class event: switching school writes a row here,
-- updates profiles.school_id, and can seed a thread in the Defections channel.
create table defections (
  id text primary key default gen_random_uuid ()::text,
  profile_id uuid not null references profiles (id) on delete cascade,
  from_school_id text not null references schools (id),
  to_school_id text not null references schools (id),
  reason text,
  created_at timestamptz not null default now()
);

create table threads (
  id text primary key default gen_random_uuid ()::text,
  channel text not null,             -- a school id or 'defections'
  profile_id uuid not null references profiles (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now()
);

create table posts (
  id text primary key default gen_random_uuid ()::text,
  thread_id text not null references threads (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Row-level security. Reading is public everywhere (lessons and the arena are
-- readable without an account); writing requires auth and ownership.

alter table schools enable row level security;
alter table profiles enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_options enable row level security;
alter table quiz_results enable row level security;
alter table motions enable row level security;
alter table micro_lessons enable row level security;
alter table submissions enable row level security;
alter table matches enable row level security;
alter table verdicts enable row level security;
alter table defections enable row level security;
alter table threads enable row level security;
alter table posts enable row level security;

create policy "public read" on schools for select using (true);
create policy "public read" on profiles for select using (true);
create policy "public read" on quiz_questions for select using (true);
create policy "public read" on quiz_options for select using (true);
create policy "public read" on quiz_results for select using (true);
create policy "public read" on motions for select using (true);
create policy "public read" on micro_lessons for select using (true);
create policy "public read" on submissions for select using (true);
create policy "public read" on matches for select using (true);
create policy "public read" on verdicts for select using (true);
create policy "public read" on defections for select using (true);
create policy "public read" on threads for select using (true);
create policy "public read" on posts for select using (true);

create policy "own profile update" on profiles
  for update using (auth.uid () = id);

-- Anonymous quiz results are allowed; a signed-in user may only claim their own.
create policy "insert quiz result" on quiz_results
  for insert with check (profile_id is null or auth.uid () = profile_id);

create policy "own submission insert" on submissions
  for insert with check (auth.uid ()::text = profile_id);

create policy "own defection insert" on defections
  for insert with check (auth.uid () = profile_id);

create policy "own thread insert" on threads
  for insert with check (auth.uid () = profile_id);

create policy "own post insert" on posts
  for insert with check (auth.uid () = profile_id);
