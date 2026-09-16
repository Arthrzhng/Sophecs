-- Phase 3 Task 2. A revision is a separate debates row linked to the
-- original, never an edit in place — the Phase 2 exclusion on editing an
-- argument after submission stands; what changes is that answering the
-- named objection produces a second, comparable attempt.
--
-- Numbered 0009 rather than the brief's 0008: that number went to
-- ai_calls.prompt_version in Task 1. See docs/decisions.md.
alter table debates
  add column kind text not null default 'original' check (kind in ('original', 'revision')),
  add column parent_debate_id text references debates (id);

create index on debates (parent_debate_id);

-- One revision per original, enforced in the database rather than only in
-- the route, so a double-submit races into a constraint violation instead
-- of two rows.
create unique index debates_one_revision_per_parent
  on debates (parent_debate_id)
  where parent_debate_id is not null;

-- RLS is unchanged (insert own / read own). The public view gains the two
-- columns so a verdict page can tell an original from a revision and find
-- its parent without the admin client.
drop view if exists debates_public;
create view debates_public as
  select
    id,
    topic_slug,
    school,
    score,
    verdict,
    elo_before,
    elo_after,
    created_at,
    kind,
    parent_debate_id,
    case when argument_public then argument else null end as argument
  from debates d;
