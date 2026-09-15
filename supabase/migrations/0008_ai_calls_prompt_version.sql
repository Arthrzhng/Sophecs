-- Phase 3 Task 1. The cost ledger records model, cost and latency but not
-- which prompt version produced the call, so cost-per-call can't be compared
-- across a prompt bump — which is exactly what raising max_tokens from 700
-- to 850 for judge v2 makes worth watching. `debates.prompt_version` stamps
-- the verdict; this stamps the call, including calls whose response failed
-- validation and so never produced a verdict row to stamp.
--
-- Nullable with no default on purpose: rows written before this migration
-- genuinely have no known version, and backfilling them with 'v1' would
-- assert something the ledger never recorded.
alter table ai_calls add column prompt_version text;
create index on ai_calls (prompt_version, created_at);
