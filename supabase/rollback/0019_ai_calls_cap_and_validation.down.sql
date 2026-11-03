-- Rolls back 0019. Run the code from before it first: the route's cap
-- query filters on counts_toward_cap and errors without the column, and
-- the route then refuses every submission (it will not judge with the cap
-- unchecked). logAiCall's insert would also fail for a failed reply,
-- which names validation_error, leaving that billed call unlogged.
--
-- Loses the two columns' values: which calls were taken out of the daily
-- cap, and why each failed reply failed. Every ai_calls row stays, with
-- its cost, so the monthly budget is unchanged. After this, a failed
-- submission's calls count toward the cap again, as before 0019.

alter table public.ai_calls
  drop column validation_error,
  drop column counts_toward_cap;
