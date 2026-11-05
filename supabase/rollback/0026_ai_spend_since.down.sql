-- Undoes 0026_ai_spend_since.sql. A DROP, so Arthur's to run, in the SQL
-- Editor. First revert the merge commit of the PR that added it (#71) and
-- confirm that production deploy is Ready: reverting src/lib/budget.ts
-- alone does not build, since the judge route imports budgetState. Without
-- the function, the new code's every budget check fails, so the judge
-- route sends nothing and counterpart replies are held unscreened.
drop function public.ai_spend_since(timestamptz);
