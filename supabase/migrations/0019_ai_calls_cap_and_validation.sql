-- ai_calls records whether a call counts toward the reader's daily cap,
-- and why a judge reply failed validation.
--
-- Arthur's ruling of 2026-11-03: a judge reply that fails validation is
-- retried up to twice, and if every reply fails, the reader is told it did
-- not use one of their arguments, the attempt does not count against the
-- daily cap, and it is logged. /api/judge counts the cap from ai_calls
-- rows, and nothing in a row said whether its submission ended with a
-- verdict. The route also reuses an unjudged debate row on the next try,
-- so "rows whose debate has a verdict" would count a failed submission's
-- calls again once a later try succeeds. Hence a column.
--
-- counts_toward_cap: true for every row that exists today, so the cap
--   counts exactly what it counted before. judgeDebate sets it to false
--   on the rows of a submission that ends without a verdict.
-- validation_error: why a judge reply failed validation, as the validator
--   summarises it ("verdict_line: verdict_line exceeds 20 words"). Null
--   when the reply validated, and on every row written before this. It
--   names a field and a cap, never the reply's or the argument's text.
--
-- Additive: nothing existing is rewritten. Adding a column with a constant
-- default is a catalogue change on Postgres 11 and later, with no table
-- rewrite; it takes ACCESS EXCLUSIVE on ai_calls for that moment. The
-- monthly budget (src/lib/budget.ts) sums cost_usd and does not read
-- either column, so every billed call still counts toward it.
--
-- Apply before the code that reads and writes these columns deploys: the
-- route's cap query filters on counts_toward_cap. No transaction of its
-- own: the Supabase runner wraps the file, and by hand it is
-- `psql --single-transaction`.

-- Waits at most five seconds for the lock rather than queueing behind a
-- long reader and holding up every ai_calls write behind it.
set local lock_timeout = '5s';

alter table public.ai_calls
  add column counts_toward_cap boolean not null default true,
  add column validation_error text;
