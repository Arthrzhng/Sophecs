-- Undoes 0026_ai_spend_since.sql. A DROP, so Arthur's to run, in the SQL
-- Editor. Revert src/lib/budget.ts first: without the function it reads
-- every budget check as an error, and so as over budget, and judging
-- pauses.
drop function public.ai_spend_since(timestamptz);
