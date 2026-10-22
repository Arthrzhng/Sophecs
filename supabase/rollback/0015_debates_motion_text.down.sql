-- Rolls back 0015 by dropping debates.motion_text.
--
-- NOT LOSS-FREE. Dropping the column discards every stored motion, and for
-- any debate submitted after 2D starts filling it that wording exists
-- nowhere else: debate_topics holds only what the motion says now, which
-- is the whole reason the column was added.
--
-- For the rows that existed at 2C the wording is recoverable, from
-- docs/seed-snapshots/2026-10-21-phase2c-pre-migration.json, which records
-- what the backfill wrote and for which debate id. Nothing records it for
-- rows written later.
--
-- So: before running this, if any row has a motion_text that no snapshot
-- holds, dump the column first.
--
--   \copy (select id, topic_slug, created_at, motion_text from debates
--           where motion_text is not null order by created_at)
--     to 'debates-motion-text.csv' with csv header
--
-- The guard below refuses if there is more stored than 2C's backfill
-- wrote, so the loss cannot happen by accident. Override it only with that
-- dump in hand.
--
-- Locks: DROP COLUMN takes ACCESS EXCLUSIVE and is a catalogue edit. The
-- column's data is not reclaimed until a later VACUUM, which is fine and
-- is also why the drop is instant at any size.

do $$
declare
  stored int;
  backfilled constant int := 1;  -- the one row 2C filled; see the snapshot
begin
  select count(*) into stored from debates where motion_text is not null;
  if stored > backfilled then
    raise exception
      'debates.motion_text holds % rows and 2C backfilled only %. The extra rows were written after the migration and their wording is in no snapshot. Dump the column before dropping it (see the top of this file), then re-run with the guard removed.',
      stored, backfilled;
  end if;
end $$;

alter table debates drop column motion_text;
