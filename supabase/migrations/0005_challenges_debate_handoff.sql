-- Phase 2c: challenge-to-debate handoff. Phase 1's challenges table
-- (0001_phase1.sql) deferred these columns to Phase 2, per its own comment.
alter table challenges
  add column topic_slug text references debate_topics (slug),
  add column challenger_debate_id text references debates (id),
  add column challengee_debate_id text references debates (id);
