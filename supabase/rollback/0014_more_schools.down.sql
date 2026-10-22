-- Rolls back 0014: the school CHECK constraints go back to the original
-- three, and the two new constraints on exchanges are dropped.
--
-- This one can legitimately fail, and failing is the correct behaviour. A
-- narrowed CHECK is stronger than the one it replaces, so any row written
-- with one of the new schools in the meantime would be rejected. Rather
-- than let the ALTER report that as a constraint violation on an unnamed
-- row, the guard below counts them first and names the table and the
-- count.
--
-- If it does fail, the rows are the decision: either they are test data to
-- delete, or a new school is genuinely in use and rolling back the
-- constraint is not what you want.
--
-- Locks: the same as the forward migration. ACCESS EXCLUSIVE per
-- statement, a validating scan on each ADD.

do $$
declare
  bad_quiz int;
  bad_secondary int;
  bad_profiles int;
  bad_debates int;
  bad_exchanges int;
begin
  select count(*) into bad_quiz from quiz_results
    where school not in ('stoicism','utilitarianism','virtue-ethics');
  select count(*) into bad_secondary from quiz_results
    where secondary is not null and secondary not in ('stoicism','utilitarianism','virtue-ethics');
  select count(*) into bad_profiles from profiles
    where school is not null and school not in ('stoicism','utilitarianism','virtue-ethics');
  select count(*) into bad_debates from debates
    where school not in ('stoicism','utilitarianism','virtue-ethics');
  select count(*) into bad_exchanges from exchanges
    where school_a not in ('stoicism','utilitarianism','virtue-ethics')
       or school_b not in ('stoicism','utilitarianism','virtue-ethics');

  if bad_quiz + bad_secondary + bad_profiles + bad_debates + bad_exchanges > 0 then
    raise exception
      'cannot narrow the school constraints: quiz_results.school %, quiz_results.secondary %, profiles %, debates %, exchanges % row(s) hold a school the original three do not include. Decide what happens to those rows first.',
      bad_quiz, bad_secondary, bad_profiles, bad_debates, bad_exchanges;
  end if;
end $$;

alter table quiz_results drop constraint quiz_results_school_check;
alter table quiz_results
  add constraint quiz_results_school_check
  check (school in ('stoicism','utilitarianism','virtue-ethics'));

alter table quiz_results drop constraint quiz_results_secondary_check;
alter table quiz_results
  add constraint quiz_results_secondary_check
  check (secondary in ('stoicism','utilitarianism','virtue-ethics'));

alter table profiles drop constraint profiles_school_check;
alter table profiles
  add constraint profiles_school_check
  check (school in ('stoicism','utilitarianism','virtue-ethics'));

alter table debates drop constraint debates_school_check;
alter table debates
  add constraint debates_school_check
  check (school in ('stoicism','utilitarianism','virtue-ethics'));

-- Back to no school constraint on exchanges at all, which is what 0012
-- left and what 0014 changed.
alter table exchanges drop constraint exchanges_school_a_check;
alter table exchanges drop constraint exchanges_school_b_check;
