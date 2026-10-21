-- Phase 2C, part two: debates remember the motion they were argued
-- against.
--
-- Today every verdict page, the verdict OG image, the revise page, the
-- counterpart exchange page and /api/judge read the motion live from
-- debate_topics by slug. Nothing is stored with the argument, so rewording
-- a motion rewrites what every past verdict page says the argument was
-- arguing, and an argument submitted before a reword and judged after it
-- would be scored against a motion its author never read. That is recorded
-- in docs/decisions.md as "A motion is read live, so a reword rewrites the
-- past".
--
-- This adds the column and fills it for the rows that already exist.
-- Nothing reads it yet: 2D changes the readers and starts filling it at
-- submission. Additive and nullable on purpose, so the column can land
-- ahead of the code and so a row written by today's code is not rejected
-- for lacking it.
--
-- Locks: ADD COLUMN of a nullable column with no default is a catalogue
-- edit under ACCESS EXCLUSIVE and does not rewrite the table, so it is
-- effectively instant at any size. The backfill is an ordinary UPDATE
-- taking row locks, not a table lock; it touches one row here.

begin;

alter table debates add column motion_text text;

comment on column debates.motion_text is
  'The motion as it read when this argument was submitted. Written at submission from 2D onward; read in preference to debate_topics.motion so that rewording a motion does not rewrite what a past verdict was about. Null means the row predates the column.';

-- The backfill is a mapping, not a join, and that distinction is the whole
-- point of the column.
--
-- `update debates set motion_text = t.motion from debate_topics t` would
-- be one line and would be wrong. The one existing debate was argued on
-- 2026-09-14; the Phase 1F reword reached this table on 2026-10-19. A join
-- would stamp today's wording onto an argument written against different
-- words and make it permanent, which is the falsehood this column exists
-- to prevent.
--
-- So rows created before the reword get the wording from
-- docs/seed-snapshots/2026-10-19-debate-topics.json, which was taken
-- before it was seeded. Rows created after it read the same words that are
-- live now.
update debates d
set motion_text = v.motion
from (values
  ('opaque-benefit',
   'An AI system that reliably reduces suffering should be deployed even where nobody can explain its decisions.'),
  ('crash-arithmetic',
   'A self-driving car should be programmed to minimise total deaths in an unavoidable crash, even when that means sacrificing its own passenger.'),
  ('no-decision',
   'It is a mistake to say that a language model decides anything.'),
  ('moral-training',
   'Training a model on human feedback can make it good in the same sense that habit makes a person good.'),
  ('careful-builder',
   'When an AI system causes harm, the people who built it are to blame in proportion to the harm, however careful they were.'),
  ('borrowed-judgement',
   'Handing your daily choices to an AI assistant costs you something that matters, even when its choices are better than yours.')
) as v(slug, motion)
where d.topic_slug = v.slug
  and d.created_at < timestamptz '2026-10-19 16:00:00+00'
  and d.motion_text is null;

update debates d
set motion_text = t.motion
from debate_topics t
where t.slug = d.topic_slug
  and d.created_at >= timestamptz '2026-10-19 16:00:00+00'
  and d.motion_text is null;

-- Refuse rather than guess.
--
-- A debate this migration has no wording for would otherwise be left null
-- and quietly fall back to the live motion for ever. If that happens the
-- mapping above needs extending from a snapshot of the wording at the
-- time, which is a decision for a person, not a default.
do $$
declare unfilled int;
begin
  select count(*) into unfilled from debates where motion_text is null;
  if unfilled > 0 then
    raise exception
      'motion_text backfill left % debate(s) null. Extend the mapping in this migration from a snapshot of the wording those arguments were written against. Do not join debate_topics: that records the current wording, which is what this column exists to stop.',
      unfilled;
  end if;
end $$;

commit;
