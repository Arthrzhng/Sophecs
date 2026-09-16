-- Task 5: the interactive read step.
--
-- One row per (user, topic, prompt). `chunk_index` is the position of the
-- prompt within its lesson, not the paragraph it follows — a lesson is
-- capped at two prompts, so 0 or 1, and moving a prompt to a different
-- paragraph must not orphan the answer someone already wrote.
--
-- Numbered 0010 rather than the brief's 0009: 0008 went to
-- ai_calls.prompt_version and 0009 to revisions. See docs/decisions.md.
create table if not exists reading_responses (
  id text primary key,                          -- nanoid(10)
  user_id uuid not null references auth.users on delete cascade,
  topic_slug text not null references debate_topics (slug),
  chunk_index int not null check (chunk_index between 0 and 1),
  response text not null check (char_length(response) between 1 and 300),
  created_at timestamptz not null default now(),
  unique (user_id, topic_slug, chunk_index)
);

-- The editor reads every response for one (user, topic) on each render, and
-- getCaseState counts them per topic.
create index if not exists reading_responses_user_topic_idx
  on reading_responses (user_id, topic_slug);

alter table reading_responses enable row level security;

-- `on delete cascade` above is what makes account deletion on /me/settings
-- take these rows with it; the brief asks for the cascade, and doing it in
-- the constraint means no application code has to remember.
drop policy if exists "reading insert own" on reading_responses;
create policy "reading insert own" on reading_responses
  for insert with check (auth.uid() = user_id);

drop policy if exists "reading update own" on reading_responses;
create policy "reading update own" on reading_responses
  for update using (auth.uid() = user_id);

drop policy if exists "reading read own" on reading_responses;
create policy "reading read own" on reading_responses
  for select using (auth.uid() = user_id);
