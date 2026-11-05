-- Undoes 0026_ai_spend_since.sql. A DROP, so Arthur's to run, in the SQL
-- Editor. Revert src/lib/budget.ts first: without the function every
-- budget check fails, so the judge route sends nothing and answers that
-- the spending limit could not be checked, and counterpart replies are
-- held unscreened.
drop function public.ai_spend_since(timestamptz);
