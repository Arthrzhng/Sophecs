# Progress

A few lines per step: what shipped, the merge commit on `main`, its
production deploy, and what was checked and how. Newest last. The
decisions behind each step are in `docs/decisions.md`; this file is only
the log.

A pull request cannot know its own merge commit, so each entry is written
in its own pull request and the next step's pull request fills in the
merge commit and deploy state of the one before.

Eval key spend is kept as a running total against Arthur's cumulative
cap: $4.80 in the brief of 2026-11-03, raised to $8.00 by his ruling of
the same evening (recorded in `docs/decisions.md`, "Arthur's rulings of
2026-11-03 on the Stage 1 miss"), to $12.00 by his ruling of
2026-11-06 after #68 ("Eval key cap $12.00 cumulative.", recorded in
`docs/decisions.md`, "Judge v3 after #68: two single-sample checks, and a
stop", and restated in his ruling on steps A and B), and to
$15.00 by his reversal of ruling 12 the same day, "Eval cap raised to
$15.00 cumulative" (`docs/decisions.md`, "Judge v3: the head comment sent
again, by Arthur's reversal of ruling 12"). The total is the sum of
`total_cost_usd` over every golden run file, including any on a branch
not yet merged, which each entry names.

## 2026-11-03: 2F, Arthur's rulings on #47 and #48

- #48, merged as `bde5ca2`: the objection line in every school's v3
  criteria, the stoic-analogy consent sentences, one judge retry on a
  reply that fails validation. Production deploy
  `dpl_DA1UgsTsK8g5dVFesTj4XngSzBtB`, Ready (read from Vercel on
  2026-11-03).
- #49, merged as `fe5fd3d`: the held-out case `confucian-hierarchy-school`,
  the objection paragraph in `judge.v3.md`, the daily-cap pre-pilot item.
  Production deploy `dpl_6y5YM3N2BaLrTk9hRd9bJz981j7b`, Ready (same
  check).
- The v3 run on `fe5fd3d`, 75 calls, $1.0806, and the run after the
  engagement fix, 78 calls, $1.1559, were added by #51. Eval key total
  after them: $4.6563 (the sum of the six run files' unrounded totals).

## 2026-11-03: security, the public views

- #50: migrations 0016 and 0017 applied in production and read back;
  0018 written and tested locally, to be applied once the verdict page
  that goes with it is live. Checks: the five gates, the judge request
  fixtures, `check:bundle`, two local Postgres test scripts (156 and 107
  checks), the security advisor before and after each migration,
  styleguide screenshots at 390 and 1280, contrast of the new text.
  Details in the pull request and in `docs/decisions.md`.
- #50 merged as `e492812`. Production deploy
  `dpl_9iY5j8sFupw6kbZL2CShNrVZg9ru`, Ready and aliased to sophecs.com
  (read from Vercel on 2026-11-03).
- 0018 applied in production at 23:12 UTC (migration version
  `20261103231244`), after the deploy. Read back with SQL: the view
  definition carries the keep-list and the parent join; no private row's
  public verdict holds `verdict_line`, `improvement`, `reasons` or an
  objection's wording (0 rows); no public row's verdict differs from the
  table's (0 rows); grants are SELECT only for anon and authenticated.
  Security advisor after: the same three `security_definer_view` errors
  as before, nothing new. The private verdict page
  (`/debate/opaque-benefit/jjSZVZFBmu`) fetched through Vercel at 23:15
  UTC: status 200, the private heading, and a page payload whose verdict
  holds only rejected, score, fidelity, rigor, engagement and
  prompt_version.

## 2026-11-03: two judge retries, and a failed submission off the cap

- #52: migration 0019 (`counts_toward_cap`, `validation_error` on
  `ai_calls`) applied in production at 23:17 UTC (migration version
  `20261103231729`), before the code that filters on it, because the cap
  query fails closed. Before applying: no `ai_calls` row and no unjudged
  debate in the previous 10 minutes, no other active database session,
  and a snapshot of the table in
  `docs/seed-snapshots/2026-11-03-ai-calls-before-0019.json`. Local test
  `scripts/test-0019-ai-calls-cap.sh`, 16 checks, forward and rollback,
  passed again just before. Read back: both columns present with the
  intended type and default, the one existing row still counts toward
  the cap with its cost unchanged, row level security unchanged.
  Security advisor before and after: the same findings.
- #52 review: three passes by a fresh reviewer. Pass 3 found that the two
  claims in the failure copy were not guaranteed (a failed cap update or
  a failed save of the new text went unchecked); both are now checked and
  the copy follows them, and each fix was broken on purpose and caught by
  a test. It also found that the monthly budget cannot be relied on past
  about 1000 calls a month and fails open on an error; that is Arthur's
  under (d) and is written up in `docs/decisions.md` for Checkpoint A.
  Gates on the final head: the five, 514 tests, `check:bundle`. The
  failure states are on `/styleguide/arena`, section 3b, screenshotted at
  390 and 1280 in `docs/phase3-styleguide/judging-failed/`; every text in
  them measures at least 6.95:1 against its background (WCAG AA asks
  4.5:1), read from computed styles with Playwright.
- #52 merged as `27a7275`. Production deploy
  `dpl_1kDgNbhGtLkK8NnaEp29j2A7rjBh`, Ready and aliased to sophecs.com
  (read from Vercel); `/debate` answered 200 through Vercel at 23:42 UTC.

## 2026-11-03: Stage 1, the v3 runs and the objection voices

- #51: the two v3 runs above (their run files), the Stage 1 result (the
  pass test is not met: `confucian-hierarchy-school` out of band, the
  power objection never returned, and in run 2 a verdict_line failure,
  one sample's retry also running over the cap and leaving it no
  result), and Arthur's rulings on it. Under v3
  only, each school's criteria now name the rival that normally voices its
  best-known objection (`src/lib/judge/objection-voices.ts`), Confucianism's
  two in Arthur's words and the other five drafted for him to confirm at
  Checkpoint A. Production's judge is v2 and does not change: the v2
  request fixtures are unchanged, which the test suite checks. Checks: the
  five gates, the judge request fixtures, `check:bundle`, a dry run of the
  golden set under v3 (no calls, no spend). Eval key total unchanged at
  $4.6563.
- #51 merged as `8490b96`. Production deploy
  `dpl_FpKc3kRUFBCk2Mu3fVfKF7AkcQ1i`, Ready and aliased to sophecs.com
  (read from Vercel); `/robots.txt` answered 200 at 00:03 UTC on
  2026-11-04.
- The rerun Arthur asked for, on `8490b96`: run file
  `2026-11-04T00-02-04-581Z-v3.json`, 76 calls, $1.1371, under a watchdog
  set to stop the runner at $2.00. Eval key total $5.7934 of $8.00. On my
  reading, which is Arthur's to confirm on the power question, every part
  of the pass test now holds except `confucian-hierarchy-school`, out of
  band on score and engagement as in both earlier runs; the power
  objection is now returned, in Utilitarianism's voice. Details in
  `docs/decisions.md`, "2F, the rerun after the objection voices".

## 2026-11-03: Stage 2, `motion_text` into `debates_public`

- Migration 0020 adds `motion_text` to `debates_public` as its last
  column, on 0018's definition unchanged; the verdict page and its OG
  image then read it from the view and stop reading `debates` for it. In
  that order: 0020 is applied in production and read back before this
  merges, because the code asks the view for the column. Checks before
  the pull request: the five gates, `check:bundle`,
  `scripts/test-0020-motion-text-view.sh` (142 checks, run on every
  migration through 0019), `scripts/test-migrations.sh`, and deliberate
  breaks of the migration and its rollback, each caught
  (`docs/decisions.md`, "Phase 3 item: move `motion_text` into
  `debates_public`").
- 0020 applied in production at 00:13:54 UTC on 2026-11-04 (migration
  version `20261104001354`), after a check that nothing was being judged,
  the security advisor, and a snapshot of the view's definition, rows and
  ACL. Read back: `motion_text` last, every other column of every row
  unchanged by digest, `motion_text` equal to `debates.motion_text` for
  every row, owner, options and ACL unchanged; advisor unchanged.
- #54 merged as `bbb9390`. Production deploy
  `dpl_7sFvLWk1ojKEc29bwkjEeqLsCyLE`, Ready and aliased to sophecs.com
  (read from Vercel). The private verdict page
  (`/debate/opaque-benefit/jjSZVZFBmu`) fetched through Vercel at 00:17
  UTC, just after Vercel reported sophecs.com aliased to
  `dpl_7sFvLWk1ojKEc29bwkjEeqLsCyLE`: 200, the private heading, and the
  debate's stored wording, which differs from the topic's current wording.
  That deployment's code reads the stored wording only from the view.

## 2026-11-03: Stage 3, the quiz v2 design

- `docs/quiz-v2.md`, `docs/quiz-v2.json` and
  `scripts/simulate-quiz-v2.mjs`: a draft of the two-axis, six-school quiz
  for Arthur to decide at Checkpoint A. Nothing is built and nothing in
  the product changes. The simulation scores every answer pattern from
  the JSON and exits non-zero if a school is unreachable, lands outside
  8% to 30%, or a school's own persona misses it; it exits 0 on the
  draft.
- #53 merged as `d283316`, after two review passes. Production deploy
  `dpl_466taYAkDfiFcHAqxVaMoJbz6DxB`, Ready (read from Vercel); docs and
  a script only, nothing served changes. Vercel reported sophecs.com
  aliased to it.
- `backup_20261022` (the open item in `docs/decisions.md`): on 2026-11-04,
  after 00:17 UTC, a read through the Supabase tool (`execute_sql`,
  counting `pg_class` rows in that namespace) found the schema with its 4
  relations: `debates`, `exchanges`, `profiles`, `quiz_results`. Arthur's
  ruling said the drop had been done on retry; it had not. `drop schema
  backup_20261022 cascade;` was retried through the same tool, which asked
  Arthur to confirm; no answer came within its 230-second limit, and the
  tool reported the question unanswered, so the drop should not have run.
  That has not been read back yet. It waits on his approval and a
  read-back.

## 2026-11-03: Stage 4, the Phase 3.0 items on `/styleguide/phase3`

- Preview only: `/styleguide/phase3` renders nothing in production, and the
  card preview route answers only on a preview deployment or with
  `SOPHECS_PREVIEW` set. Colour candidates for the three draft schools
  (`scripts/colour-candidates.mjs`, `docs/phase3-styleguide/colour-candidates.json`),
  the two-axis map in the quiz preview and in Profile history, the school
  table with six rows, the "view from elsewhere" card on Today and in the
  lesson player, result cards and their card images for six schools, the
  lesson filter chips, and a nav icon for the school table. Screenshots of
  every section at 390 and 1280 in `docs/phase3-styleguide/`, taken from
  a local production build. Contrast: 203 text elements on the page
  measured from computed styles with Playwright, each text colour blended
  by its own alpha and every ancestor's opacity, none below WCAG AA, the
  lowest 4.54:1; 16 inside SVG or on an image background not measured.
  (A first measurement ignored opacity and reported 5.03:1; review found
  the draft cards' attribution at 3.86:1, which led to the derived card
  surfaces.)
  The colour choice, and everything shown, is Arthur's at Checkpoint A.
- #55 merged as `0729d1f`, after two review passes. Production deploy
  `dpl_EwjphTGXXpsSApZqtUcB36ojUVs8`, Ready and aliased to sophecs.com
  (read from Vercel). Fetched through Vercel at 00:43 UTC on 2026-11-04:
  `/styleguide/phase3/card/confucian` answered 404, as it should in
  production, and `/robots.txt` 200.

## 2026-11-04: Checkpoint A

- #56 merged as `7f0406e`: the Stage 1 rerun, the merge log for #51, #53,
  #54 and #55, and `docs/checkpoint-a.md`. Production deploy
  `dpl_12RLEjQrBzewYW9gw79ZRUsAmFZY`, Ready (read from Vercel on
  2026-11-04).

## 2026-11-04: a counterpart exchange can take its first turn

- `seekCounterpart` opened exchanges whose first turn the turn route
  refused from both sides. The newer seeker is now `user_a`, who opens.
  `docs/decisions.md`, "The newer seeker is user_a (2026-11-04)".
  `tests/counterpart-pairing.test.ts`, which fails on the old code.
- #58 merged as `0d27bec`, after one review pass. Production deploy
  `dpl_EN7wdCkr5A8swchrj232XD2vgd2a`, Ready and aliased to sophecs.com
  (read from Vercel).

## 2026-11-04: a challenge can be accepted

- `submitQuizResult` wrote a challenge's id into `challenge_from`, which
  references `quiz_results(id)`, so taking the quiz from a challenge link
  lost the result. It now stores the challenger's result id, and accepts
  an open challenge once. `docs/decisions.md`, "A challenge link stores
  the challenger's result (2026-11-04)". `tests/challenge-accept.test.ts`.
  `src/app/actions.ts` is frozen; Arthur's ruling of 2026-11-04 asked for
  this fix.
- #59 merged as `759b0bd`, after one review pass. Production deploy
  `dpl_4q3FDcdbaPcTvCpirGPPEek6igvr`, Ready (read from Vercel).

## 2026-11-04: only a result's owner can challenge from it

- `createChallenge` checks the caller owns the result (cookie or saved
  account), and `/r/[id]` offers "Challenge a friend" to the owner only,
  "Take the quiz" to anyone else. `docs/decisions.md`, "Only a result's
  owner can challenge from it (2026-11-04)". `tests/create-challenge.test.ts`.
  `src/app/actions.ts` is frozen; Arthur's ruling of 2026-11-04 asked for
  this fix.
- #60 merged as `fc42fdf`, after one review pass. Production deploy
  `dpl_64CL9LcFpwZtU8i5kzAi3MGC35yg`, Ready (read from Vercel).

## 2026-11-04: no client may update a challenge (migration 0021)

- Arthur's ruling of 2026-11-04, ahead of sample activity: drop the
  `challenges` update policy, and a party check in `assignChallengeTopic`.
  `docs/decisions.md`, "No client may update a challenge (migration 0021)".
- Tested on local Postgres: `scripts/test-0021-challenges-update.sh`, all
  checks passed; `tests/challenge-topic.test.ts`, which fails two of its
  five cases with the check removed.
- The private verdict check that 0018 left open (Arthur, 2026-11-04:
  "Finish 0018 and the private verdict check"). Production's page for the
  one genuine argument, which is private, fetched as a stranger through
  Vercel at 08:06 UTC on 2026-11-04: status 200, not from cache. It shows
  the score and the three sub-scores, "The verdict on a private
  argument", the withheld-note line and "The author has not published
  this argument." The verdict the page receives has exactly `rejected`,
  `score`, `fidelity`, `rigor`, `engagement` and `prompt_version`, with
  `argument: null` and `textWithheld: true`: no field that can quote the
  argument reaches a stranger, as 0018 and 0020's keep-list intend.
- **0021 applied by hand.** The Supabase tool's confirmation prompt for
  a DROP timed out unanswered four times, so on 2026-11-05 Arthur ran the
  file himself in the Supabase SQL Editor, the whole of it as reviewed
  (`supabase/migrations/0021_challenges_no_client_update.sql`, sha256
  `16ac74c0...6358d0a`), and reported "Success. No rows returned". **It
  is not in Supabase's migration list** (`supabase_migrations`), which
  goes from 0020 to 0022: the SQL Editor runs a statement without
  recording a migration. Anyone comparing that list with the repository
  should expect the gap. 0022 had gone in first, at 03:00:50 UTC; the two
  are independent.
  - Before: the snapshot is
    `docs/seed-snapshots/2026-11-04-challenges-policies-before-0021.json`,
    re-checked at 02:59 UTC on 2026-11-05 (the same three policies). The
    security advisor before is the one run for 0022 that morning.
  - Read back at 03:10 UTC: the policies on `challenges` are
    "anon insert own" and "challenges read party", none for UPDATE; row
    level security on; grants as 0022 left them (`anon=r`,
    `authenticated=r`); 3 rows, none past open.
  - Security advisor after: the same findings as before.
- **`backup_20261022` dropped by hand.** For the same reason Arthur ran
  `drop schema backup_20261022 cascade;` in the SQL Editor on
  2026-11-05. Before, a read found only its four tables, their TOAST
  tables and array types, with nothing outside the schema depending on
  them. Read back at 03:05 UTC: no schema named `backup%`; the live
  tables keep their rows (1 debate, 1 profile, 28 quiz results, 3
  challenges). The open item in `docs/decisions.md` is closed.
- #61 merged as `4099df7`, after 0021 was read back. Production deploy
  `dpl_4YzpiJmPGv56YPGcoBmKjFAVpj4b`, Ready (read from Vercel).

## 2026-11-04: clients keep only the writes the site makes (migration 0022)

- Arthur's "yes, the grants fix" of 2026-11-04, under the views process.
  `docs/decisions.md`, "Clients keep only the writes the site makes
  (migration 0022)".
- Tested on local Postgres: `scripts/test-0022-client-write-grants.sh`,
  all checks passed, and thirteen deliberate breaks each caught (named in
  `docs/decisions.md`); `scripts/test-migrations.sh`;
  `tests/client-writes.test.ts`.
- Three fresh review passes, no blocking finding. Fixed after the first:
  the test's Postgres 17 check counted every table; a REVOKE that takes
  nothing passed silently (the migration now checks what is left and
  fails); the client-writes scan missed five ways of reaching a session
  client; what goes beyond the approved wording is now listed; four doc
  errors. After the second: the closing check missed column-only grants
  and was tested on one case only; the scan passed a comment inside a
  chain, a builder kept in a variable, and update keys it could not read.
  After the third: the scan read strings and comments as code, reported
  storage buckets, and trusted any `admin` parameter; two stale counts.
- Arthur said yes to the revokes beyond the approved wording on
  2026-11-05 ("Yes, with the extras").
- **Applied in production at 03:00:50 UTC on 2026-11-05**, migration
  version `20261105030050`, through the Supabase tool, with no prompt
  (it has no DROP). Applied before 0021, which Arthur then ran by hand (above); the
  two are independent, and 0022 alone already takes UPDATE on
  `challenges` from both roles.
  - Before: security advisor run (3 `security_definer_view` errors, the
    known warnings and one info); no active session, no `ai_calls` row and
    no unjudged debate in the previous 10 minutes; snapshot taken,
    `docs/seed-snapshots/2026-11-05-client-grants-before-0022.json`. Every
    grant's grantor was `postgres`, the owner and the runner, with no
    column privileges: the state the local test models and the rollback
    restores.
  - The migration's own closing check passed.
  - Read back at 03:01 UTC: each table `anon=r`, `authenticated=r`
    (`class_members`: `authenticated=rd`); the views `anon=r`,
    `authenticated=r`, `profiles_public` nothing; column grants only
    `authenticated=w` on `profiles.display_name` and
    `profiles.argument_default_public`; owner and `service_role` unchanged
    (`arwdDxtm`). Privilege probes: no INSERT, UPDATE or DELETE left for
    either role on the five tables but the kept three; no MAINTAIN;
    SELECT kept on the tables and views; `reading_responses` unchanged.
    13 policies and every row count unchanged.
  - Security advisor after: the same findings as before.
- #62 merged as `0fa7177`, after #61. Production deploy
  `dpl_6XNYtqoou38NHB4975hQxnjc5X8G`, Ready (read from Vercel).

## 2026-11-04: sample activity, revised to Arthur's ruling

- Arthur approved the run on 2026-11-04 in a revised form: 3,278 accounts;
  permanent, with new activity on a schedule; a GitHub Actions workflow
  holding the service key and the seed as secrets; "Sample" on
  every surface, share and link-preview images included; no synthetic
  referrers and nothing in PostHog; real numbers kept real; a reader's
  own rating, percentile and streak against real readers only; class
  pages that never show a sample; exact duplicate arguments under 5%; no
  genuine-row export. `docs/sample-activity.md` has the design.
- Branch `sample-activity`:
  - migration 0023 (0021 went to the challenges fix, 0022 to the client
    grants fix): the marker, the
    registry (no seed stored; `base_to`, `last_report`), eleven triggers,
    the marker on the two views, `elo_percentile` over genuine profiles,
    an index on `debates(created_at)`;
  - a generator whose base window is fixed and whose arguments run on
    without changing anything already made, texts given out without
    repeats (0% exact duplicates at full size), and an engine that
    extends a run and brings profiles up to date;
  - `.github/workflows/sample-activity.yml` and `scripts/seed-ci.ts`:
    canary, full, extend every six hours, and teardown by hand with the
    run's id typed in; a public log with counts and check names only;
  - the Sample mark on the verdict, result and card images and in the
    three pages' titles; a sample-page marker that stops every analytics
    event; samples left out of class pages; a sample challenge never
    accepted; a query in the doc for real and sample counts.
- Tested on local Postgres 16: the sample migration's test and the round trip
  pass; 600 accounts end to end, canary, full, an extension three days on
  that wrote only the 59 new arguments and the 24 profiles they moved, the
  earlier plan then refused, validation passing, and teardown leaving the
  genuine reader as it was.
- A fifth review (Arthur waived the three-pass cap for this PR) found nine
  things, all fixed:
  - PostHog still loaded on sample pages, and autocapture, `$identify`,
    and the project's session replay and heatmaps (on, read from PostHog)
    sent from them. Now `before_send` drops anything from a sample page or
    recorded on one, replay pauses while one is open, and a visit that
    starts on one loads nothing.
  - A killed job's lock stopped every later scheduled run; the workflow now
    clears a lock older than 15 minutes.
  - A failed validation did not stop the schedule; it now halts the run
    until a full stage run by hand passes.
  - The secrets move to a GitHub environment limited to main, since any
    branch's workflow can read a repository secret.
  - The checks read every genuine profile, debate and result into the
    runner; they now read counts and each topic's par window only.
  - Exact duplicates are now a validation check (5%), and the docs give
    the measured timescale (about 16 months).
  - Link previews of sample verdicts and challenges now say Sample.
  - Sample addresses carry a seed-derived tag, so they cannot be worked
    out from the public run id.
  - The docs say the motions and passages are fixed for a run's life.
- Retested after the fixes: the five gates, the migration's test, and the 600
  account end-to-end run with the extension and teardown. That run caught
  the local adapter still reading the old address format at teardown,
  which refused rather than deleted; fixed.
- Renumbered to 0023 once #61 and #62 were on `main`, and its database
  test rebuilt to run under production's grants as 0022 left them: each
  client write 0022 took is checked as denied, and again with the
  privilege granted back for one transaction to show the guard still
  refuses it. Gates, the 0023 test, the migration round trip and the 600
  account end-to-end run pass on `ada1ac0`.
- **0023 applied in production at 03:23:59 UTC on 2026-11-05**, migration
  version `20261105032359`, through the Supabase tool (no DROP, no
  prompt), with Arthur's go-ahead of the same morning.
  - Before: no active session, no `ai_calls` row and no unjudged debate in
    the previous 10 minutes; security advisor as after 0021; snapshot,
    `docs/seed-snapshots/2026-11-05-before-0023.json`.
  - Read back at 03:24 UTC: the six columns, `not null default false`, no
    row marked; `seed_runs` and `seed_run_items` with row level security
    on, no privilege for anon or authenticated, empty; the eleven
    triggers; the guard not executable by clients; both views with their
    columns appended, owner, options and ACL unchanged, every row's
    digest as before (`95f4c9b1...`, `38d85702...`);
    `elo_percentile(1200)` unchanged; `debates_created_at_idx`; 0022's
    grants intact.
  - Security advisor after: no new ERROR or WARN. One INFO added, as
    expected: `seed_runs` and `seed_run_items` have row level security and
    no policy, which is the design (server role only).
- #57 merged as `d9d09e0`, after 0023 was read back. Production deploy
  `dpl_4hW6CV31ipCQe4xbSXGQ6rgf4iRY`, Ready (read from Vercel).

## 2026-11-05: the sample canary and the full run

Both through `.github/workflows/sample-activity.yml` on `main`, in the
`sample-activity` environment, as run `sample-202611050327`. Read back
with read-only SQL; pages fetched from sophecs.com through Vercel.

- **Canary**, workflow run 41961657900, about 1.5 minutes, with Arthur's
  go-ahead of the same morning.
  - Wrote 40 accounts (all banned from signing in), 100 quiz results, 151
    arguments with template verdicts, 1 challenge, 1 exchange and 26
    reading answers. All 34 checks passed.
  - Unchanged: every genuine count, every topic's par, the percentile of
    a 1200 rating and the `ai_calls` count. No sample result has a
    referrer.
  - The public log holds counts and check names only, with both secrets
    masked.
- **Live, on the canary's rows:**
  - A sample verdict shows the Sample mark, "Sample assessment" and "The
    judge did not read this argument", with "Sample verdict" in the
    page and preview titles, and no share row.
  - A sample result and a sample challenge each show the mark and say
    "A sample account's" result or challenge, in the page and in the
    preview titles.
  - All three carry the marker that keeps them out of PostHog.
  - `/table` shows "This week's table includes sample accounts", linking
    to `/method#samples`.
  - Not checked live: what the share and preview images draw (the fetch
    returns a PNG as text; the mark rests on `tests/seed/cards.test.ts`),
    and PostHog (no browser visited; the exclusion rests on
    `tests/seed/analytics-sample.test.ts`).
- Two things the live check found, fixed in their own pull requests:
  - a sample verdict page still sent its share sentence, "The judge's
    note ...", in the page's data;
  - a sample challenge's link preview had no image.
- **Full run**, workflow run 41965190975, with Arthur's "run full" of
  2026-11-05.
  - The job ran 04:01:34 to 04:11:10 UTC: 508.4 s of writing, about 55
    rows a second and, as the log reports it, 12.5 auth users a second.
  - 36 checks, none failed. Exact duplicate arguments 0.3%, under the 5%
    check, which counts every copy of a repeated text, the first
    included (read back: 15 of the 8,297 texts repeat an earlier one).
    That is above the 0.02% `docs/sample-activity.md` gave for the start;
    re-measured with two other seeds it is 0.2% at the start and 3% after
    a year, so the doc's estimate of a halt after about 16 months stands.
  - The lock was released, and the run reads `complete`, stage `full`.
- **Read back at 04:11:51 UTC** (reading answers rechecked at 04:16):
  - Sample rows:

    | Table | Sample rows |
    | --- | --- |
    | profiles, and auth users (all banned, none signed in) | 3,278 |
    | quiz_results | 8,500 |
    | debates, all template verdicts (465 of them revisions) | 8,297 |
    | challenges | 328 |
    | exchanges / turns | 492 / 1,700 |
    | reading_responses | 2,398 |
    | classes / class_members | 10 / 241 |

  - Genuine rows unchanged: 1 profile, 28 quiz results, 1 debate, 3
    challenges, 0 exchanges, 2 reading answers; 1 `ai_calls` row.
  - `elo_percentile(1200)` still 0, and each topic's par as before
    (`opaque-benefit` 1200 over 1 debate, the rest 1200 over none).
  - No sample result with a referrer, no sample argument seeking a
    counterpart, no genuine member of a sample class.
  - Database size 55 MB.
- **`/table` at 04:15 UTC** shows all three schools: Utilitarianism 150
  arguments (average fidelity 6.3), Virtue Ethics 90 (6.2), Stoicism 171
  (6.0), with the sample note.
- From here the schedule is set to extend the run every six hours, at 41
  minutes past 06, 12, 18 and 00 UTC. No extension had run when this was
  written.
- The job's annotations: `actions/checkout@v4` and `actions/setup-node@v4`
  target Node 20, which GitHub now runs on Node 24 with a deprecation
  warning. Moving both to their Node 24 majors is a small change for a
  later pull request.

## 2026-11-05: three follow-ups to the sample run

Arthur, 2026-11-05: "do the three follow-ups as their own small PRs".
Each had three fresh review passes, none blocking; the findings and fixes
are in each pull request.

- #63 merged as `71a050f`: a sample verdict page sends no share sentence.
  The sentence is built by `verdictShareLine` (`src/lib/verdict-share.ts`),
  which gives a sample "" and a genuine verdict exactly main's sentence
  (6,912 and 6,480 inputs compared in review). Production deploy
  `dpl_9uzqXfEnBbwJwtLBwG9Tk6PwGzSd`, Ready (read from Vercel).
- #65 merged as `4703f8e`: Next.js 15.5.24 to 15.5.29 for its critical
  and high advisories; and PostHog started with product tours off, so the
  extension bundling a vulnerable DOMPurify is not loaded (mitigated, not
  fixed: a tour preview, which nothing in the site starts, could still
  load it, and `npm audit` still lists it).
  `docs/decisions.md`, "Dependency audit (2026-11-05)", lists the 16
  packages `npm audit` still names. Production deploy
  `dpl_CVTRWBdd7ma7Bb7MzYa3QyiwCgH6`, Ready.
- #64 merged as `680a35b`: a sample challenge's link preview is the
  challenger's marked result card; and the three card routes answer 404,
  not cached, for a row they cannot read, instead of an unmarked default
  cached for a year. Production deploy `dpl_251Cn4rfC19Tor6m4emuSiS6q6hh`,
  Ready.
- **Live at 04:51 UTC**, fetched from sophecs.com through Vercel:
  - the sample challenge `/c/NGYu6MPcLo` names
    `https://sophecs.com/r/CfgqMNeSa2/opengraph-image` as its `og:image`
    and `twitter:image`, alt "A sample account's result card";
  - `/r/zzzzzzzzzz/opengraph-image` answers 404 with `no-store`;
  - the sample verdict `/debate/no-decision/zJh6SPcchZ` sends
    `"shareLine":""`, and "The judge's note" is nowhere in the page.
  - Not checked live: the card image's pixels (the fetch returns a PNG as
    text); the mark rests on `tests/seed/challenge-preview.test.ts`, which
    runs the routes.

## 2026-11-05: Arthur's rulings on Checkpoint A

Each pull request had one to three fresh review passes; the findings and
fixes are in each. Every production deploy below was read from Vercel
as Ready.

- #67 merged as `82fbffe`: the rulings recorded in `docs/decisions.md`.
  Deploy `dpl_77cYToNKoHMQPNr9BgCUkDpSyzSD`.
- #68 merged as `a5ee501`: judge v3's engagement cap tied to its own
  reply, comments stripped before v3 is sent, Utilitarianism's
  Virtue Ethics voice (rulings 2/11, 12, 14). v3 is not live. Deploy
  `dpl_HcvfPv5KGmqQWTpc8UBUc8gLdL5J`.
- #69 merged as `5f95ad2`: migration 0024 (rulings 4, 21, 22, 23),
  applied through the Supabase tool at 14:53 UTC (migration version
  `20261105145333`), before the merge, with the security advisor before
  and after and a read-back (the
  display_name check, the narrowed class policies, the class functions
  and `exchanges_public` closed to clients, `elo_percentile`'s search
  path). 0025, which drops the five unreachable insert policies (ruling
  5), is with Arthur for the SQL Editor; not yet run (all five policies
  still present, read at 16:44 UTC).
  Deploy `dpl_x9X8rtfSy3pk3uZ2dvQGLjUYB8Eu`.
- #70 merged as `9003c1b`: sample pages pass no referrer on (ruling 18).
  Live, fetched from sophecs.com through Vercel at 16:45 UTC: a sample
  account's result (`/r/HREvvktgxx`) carries `<meta name="referrer"
  content="no-referrer">`, and the landing page (`/`)
  `strict-origin-when-cross-origin`.
  Deploy `dpl_APWR1Ybh5fTCTcd9ihQWkDq2eAvh`.
- #73 merged as `bfadb6d`: zod 4.6.7 (ruling 13), the six request
  fixtures unchanged, a 91-reply corpus parsing the same on zod 3 and 4;
  `schema.ts` and `screen.ts` keep zod 3's UTF-16 count for their
  200-character caps. Deploy `dpl_ECaMA5sGPQmGPRUu7DBSEBg8AJgP`.
- #74 merged as `99744fe`: the new schools' colours, Confucianism
  `#562b05`, Ubuntu `#1e3b4f`, Buddhist Ethics `#7d56b8` (ruling 16), on
  a preview deployment's `/styleguide/phase3`; nothing live changes.
  Deploy `dpl_HKH9Yj851bjdXvaDAUVRC7cRBtg9`.
- #75 merged as `0dd59cf`: Quiz v2 as ruled (ruling 15), and the live
  copy no longer calls the quiz "about AI". Deploy
  `dpl_BsD2uG8bYyp4B3SiBpnyWkA3TuoA`.
- #72 merged as `ac5ceec`: the fixes from the fresh review of #57's last
  fixes (ruling 19): a sample run's halt now holds until a validation
  passes, refusals halt, the duplicate check runs before writing, console
  logs are dropped once a sample page has been shown, and `return_visit`
  is sent from the first genuine page of a visit. The scheduled job uses
  it from its next run. Deploy `dpl_3K6kxcR6EhKSgDdB2ZLt2fibb3tz`.
- #76 merged as `099c3b1`: the sample workflow's actions on Node 24,
  pinned by commit; follow-redirects, vite and vitest within range.
  `npm audit` listed 10 packages at the merge. Deploy
  `dpl_Ccd4XCRVK5o4WALuxPey627jxDgj`.
- Open: #71, the judge's caps and budget (rulings 6, 7, 8), three passes
  done, waiting on Arthur's yes to migration 0026 before it is applied
  and merged.

## 2026-11-05: Stage 5, the flag and the pages that only read

Each pull request had one to three fresh review passes; the findings and
fixes are in each. The fixes from the last pass of #78, #79, #80 and
#81 were made after it, and each pull request says so. Every production
deploy below was read from Vercel as Ready.

- #77 merged as `d9ec035`: the entry above. Deploy
  `dpl_4xL5QRpN7MNPnBuau38ctoPF6awi`.
- #78 merged as `de35849`: `docs/stage5-plan.md`, the plan for building
  the six schools behind a build-time `SIX_SCHOOLS` flag, in six steps
  with four gates. Three passes. Deploy
  `dpl_ATcouqnPoLLmdLvtSDovnWU9m6PA`.
- #79 merged as `d733c59`: step 1, the flag. A flag-on build shows the
  three after the live schools; a flag-off build is unchanged, which
  `npm run check:bundle` now checks over nineteen strings, colours
  included, and `npm run check:bundle:six` checks the other way. The
  judge reads the published list, which does not move. Review found
  webpack's cache carrying the flag-on stylesheet into a flag-off build;
  the flag is now in the cache's version. `next.config.ts` refuses a
  flag-on production build. Deploy `dpl_GzthwxDF9xovry1oWNFcyYsefBUV`,
  and sophecs.com read at 17:48 UTC showed three schools and the same
  stylesheet as before.
- `SIX_SCHOOLS=1` set in Vercel for Preview only, at 19:11 UTC.
- #80 merged as `979d9d8`: step 2a. On a flag-on build the three have
  pages, modules on `/lessons`, rows on the table, and places on the
  landing page and in the footer. Its preview, the first flag-on Vercel
  build, served `/s/ubuntu` with "The other five". Deploy
  `dpl_Ch8vXgMsrppWuKuLxALpafN7VUNb`.
- #81 merged as `132a7bd`: step 2b. On a flag-on build Today offers the
  week's view from elsewhere after step 4, and each of the six passages
  has a page; the before and after pages still number their pair 1 and 2
  of 2. Review found the passages keyed on the three being drafts, which
  would have hidden them at launch; they are keyed on the flag. Deploy
  `dpl_5uMbDJm478A2ZAtxYcBh9m4fGLVS`.
- Not done: migration 0025 is still with Arthur (all five policies
  present at 19:41 UTC), #71 waits on his yes to 0026, and the sample
  workflow's 18:41 UTC run had not started by 19:41. Checkpoint B
  (`docs/checkpoint-b.md`) lists everything open.

## 2026-11-05: one address

- #82 merged as `c2d9ac9`: Checkpoint B (`docs/checkpoint-b.md`) and the
  entry above. Deploy `dpl_DvxqBK2MBNx1z4uSz2An6BSTuwEW`, Ready.
- Migration 0025, run by Arthur in the SQL Editor, read back at 20:52
  UTC: the five unreachable insert policies are gone, `own update` on
  profiles is kept, and the other policies on the five tables are as
  before. Security advisor after: the same findings as before, nothing
  new.
- #83 merged as `c682e82`: one address. Every host but sophecs.com and
  the deployment's own URL sends a page to the same path and query on
  sophecs.com; a sign-in that falls
  back to Supabase's Site URL (`https://sophecs.vercel.app`, which is how
  readers reached that host) completes on sophecs.com; `/auth/callback`
  keeps `next` on the site, closing an open redirect. Three review
  passes; the second found the first fix to the open redirect let dot
  segments through. Deploy `dpl_Hf57AxRGc6MVg814fyrGMdJRDfD3`, Ready and
  aliased to all five hosts.
- The live check of #83, through Vercel's fetch at 21:41 UTC:

  | Request | Result |
  | --- | --- |
  | `https://sophecs.com/robots.txt` | 200, no Location |
  | `https://sophecs.vercel.app/debate?x=1` | 307 to `https://sophecs.com/debate?x=1` |
  | `https://www.sophecs.com/lessons` | 307 to `https://sophecs.com/lessons` |
  | `https://sophecs-arthurrzhang-1874s-projects.vercel.app/table` | 307 to `https://sophecs.com/table` |
  | `https://sophecs.vercel.app/?code=x` | 307 to `https://sophecs.com/auth/callback?code=x` |
  | `https://sophecs.com/auth/callback?next=/..//evil.example` (no code) | ends at `/login` on sophecs.com, 200 (with no code the route never reads `next`; `tests/auth-callback.test.ts` checks `next` itself) |
  | `https://sophecs.com/api/cron/keepalive` | 401, the route's own, not redirected |

  The fetch tool adds a `_vercel_share` parameter to the Locations it
  reports; the site does not. sophecs.com is left alone, so #85 makes the
  host rule a 308: Arthur's message of 2026-11-05 asked for
  "sophecs.vercel.app permanently redirecting to it (www too)".
- Still Arthur's (#83 lists the clicks): Supabase Auth's Site URL and
  redirect allow-list, and Vercel's domain redirect for www. Until then
  a sign-in returns to `/me`, or to the quiz for a reader who has not
  taken it, rather than to the page it started from.

## 2026-11-05: sample scores that do not look generated

- #84 merged as `ebacb28`. Sample verdicts dated from 2026-11-06 06:00
  UTC, and every verdict of a run begun after then, follow score rule 2:
  whole-number criteria, as the judge gives, and composites on a multiple
  of 5 about 13% of the time (23.3% of the live run's 8,111 before it;
  the judge's own replies 16.3%). The live run's earlier rows keep rule
  1, regenerate unchanged, and go at launch. Every run now checks every
  stored sample score against its plan, and refuses a run whose rule-2
  scores are more than 20% on a multiple of 5. Two review passes; the
  first found that a late merge would not have failed safely, which the
  stored check fixes. At merge (21:48 UTC) the live run's `window_to` was
  2026-11-05 14:57 UTC, before the cutover. Deploy
  `dpl_Dziy9W1qdng5Cu4czFodCyp4Bor1`, Ready (the engine runs from GitHub
  Actions, not from the deploy).
- Not yet seen: the first scheduled run on #84's code. The 18:41 UTC slot
  had not run by 21:48; the schedule has fired once since #57 merged.

## 2026-11-05: Checkpoint B's rulings

- #71 merged as `dcebda3`: the judge's caps and budget. Migration 0026
  applied as version 20261105220626 and read back (Arthur's (a) 1).
  Deploy `dpl_DujFSaUBCWZiCzHzJ4gY24Vy3Kph`, Ready and aliased to
  sophecs.com (read from Vercel at 22:25 UTC).
- 0025, which Arthur ran in the SQL Editor, read back: the five insert
  policies are gone and nothing else changed.
- A manual sample run on the Node 24 actions and #72's engine, as Arthur
  asked: Actions run 42117727476, 22:00 to 22:03 UTC, success. 51
  debates written, 38 of 38 checks passed, the stored-score check
  compared 8,403 rows, and the round-score check read "rule 2: 0
  verdicts; too few to judge", as expected before the 06:00 cutover.
  The schedule itself has fired once (14:57 UTC, for the 12:41 slot);
  the 18:41 slot had not run by 22:45 UTC.
- The full v3 golden run after #68, (b) 2: 105 calls, $1.3586, on branch
  `rulings-e` (#86). Eval key spend is now **$7.1520 of $8.00**. It does
  not pass; `docs/decisions.md`, "Arthur's rulings of 2026-11-05 on
  Checkpoint B", has the cases, and the fix goes back to Arthur under
  (b). The new-schools run waits on it.
- #86: the (e) rulings (a/an, darker surfaces for the three, the two
  share lines, ranking at 20 arguments, the view from elsewhere at step
  4, UNVERIFIED). Its merge commit and deploy go in the next entry.

## 2026-11-05: Stage 5 step 3, the (e) rulings merged, the re-screening job

- Migration 0027 (Gate 1) applied as version 20261105225938 at 22:59 UTC
  and read back against a snapshot from 22:53: 8,528 rows with the same
  checksum, all v1 in shape, the table not rewritten (same file), the
  view's grants and options unchanged. The security advisor showed the
  same six findings before and after.
- #87 merged as `41cb359`: every reader of a quiz result knows its
  version (`src/lib/quiz-result.ts`), and `submitQuizResult` (frozen,
  under Gate 1) takes up a challenge only from a v1 result. Two review
  passes. Deploy `dpl_4mbiV5twFNWD6hTziFpJDKGhR7oz`, Ready; a sample
  result at `https://sophecs.com/r/pDinF29GNH` answered 200 at 23:16
  UTC, read through the new columns.
- #86 merged as `79ec12a`: the (e) rulings. Three review passes; the
  third moved the 20-argument threshold to SIX_SCHOOLS builds, the table
  Checkpoint B asked about, and put the live table to Arthur. Deploy
  `dpl_4HNKdj5P8nF11oocZzu3RxsNy4sU`, Ready; `https://sophecs.com/table`
  at 23:26 UTC ranked the three 1, 2 and 3 on 186, 202 and 112
  arguments, with no unranked note, as before.
- #88 (draft): the judge's cap and ceiling reserved in one step,
  migration 0028. Waiting for Arthur's (a) on 0028.
- #89: the daily re-screening job for pending arena replies, (d) 4, and
  the copy that goes with it. Its merge commit and deploy go in the next
  entry.

## 2026-11-06: 0028, the source check, quiz v2, the exemplars, and a morning check

- #89 merged as `7a6f2e6`: the daily re-screening job for pending arena
  replies. Two review passes. Deploy `dpl_4jv4atKM7VLLsf522oC8WoQwBD4a`,
  Ready.
- #88 merged as `72c58ca`: the judge's cap and ceiling reserved in one
  step. Two review passes. Arthur ran migration 0028 in the SQL Editor before the merge, so
  it has no row in `schema_migrations`. Read back: the table's and the
  sequence's grants are the owner's and `service_role`'s only, as are
  the two functions' EXECUTE; a functional check of the two functions,
  run in a transaction that was rolled back, passed. The security
  advisor shows the same six findings as before, plus the INFO
  `rls_enabled_no_policy` on `judge_reservations`, which is meant: no
  client reads or writes it. Deploy `dpl_4J2VXu8KnrirXwpBMJgS1CErPetr`,
  Ready.
- #91 merged as `10a8995`: Arthur's check of the Ubuntu sources, and the
  Gate 4 checklist. One review pass. Deploy `dpl_9fYsLbrJBSrDPuLU495h3aMK6VJo`, Ready.
- #92 merged as `1c79b84`: Stage 5 step 4, quiz v2 on SIX_SCHOOLS
  builds. Three review passes. Deploy `dpl_7AQLYsimzpJ5B3FpnMUs1A4imFtL`,
  Ready.
- #93 merged as `09a58b9`: "Exemplar ways to argue this motion". Three
  review passes. Deploy `dpl_8PasLWebRKv6R8NT2iYaXLSAtQPy`, Ready;
  `https://sophecs.com/debate/opaque-benefit/exemplars` at 06:46 UTC
  answered 200 with 12 arguments, four a school, the line under the
  heading, the sample page marker and the site's preview image, and the
  landing page linked to it.
- #90 (draft): five single-sample checks of v3 on branch
  `judge-v3-order`, run files `2026-11-06T00-01-04-700Z`,
  `T01-06-11-994Z`, `T01-08-52-100Z`, `T01-38-01-934Z` and
  `T06-05-12-649Z`. The last shows that sending v3's old head comment is
  what separates the prompt from the 4 Nov one. Stopped, and put to
  Arthur under (b). Eval key spend is now **$8.8780 of $12.00** (the sum
  over the 13 run files on that branch).
- Morning check at 07:10 UTC:
  - Production: `dpl_8PasLWebRKv6R8NT2iYaXLSAtQPy`, Ready.
    `https://sophecs.com/robots.txt` answered 200, with no `Location`.
  - Sample activity: the 18:41 UTC slot ran from 23:50 to 23:52
    (Actions run 42132397210, success): 13 debates, every check passed.
    The 00:41 and 06:41 slots had not run by 07:10, and the newest
    debate in production is dated 23:44 UTC, the end of that run's
    window. So no run has yet begun after the 06:00
    cutover, and the round-score check has no rule-2 verdicts to judge.
    GitHub has started this schedule two to five hours late, or not at
    all, since it began.
  - The re-screening job (`43 5 * * *`): Vercel's Hobby plan keeps
    runtime logs for an hour, so whether it fired at 05:43 could not be
    read at 07:10. Nothing was waiting for it: every one of the 1,700
    arena replies in production is a sample's, screened `ok`, so a run
    would have read none. The next check reads the logs inside the hour.
- Waiting on Arthur: the v3 prompt under (b), with the two ways forward
  set out in #90; Supabase Auth's Site URL and redirect list, and the Vercel
  redirect from www to sophecs.com.

## 2026-11-06: judge v3 merged, Gate 3, the new-schools run

- #94 merged as `20e7e76`: the previous entry. Deploy
  `dpl_2fDgRTespR2N1GtL9C5pfcpPtQBn`, Ready.
- #95 merged as `8dcea34`: quiz v1 scored on the server, from the
  answers alone (frozen `src/app/actions.ts`, Arthur's yes of
  2026-11-06). One review pass. Deploy
  `dpl_CBAofJaCHRy5W4nVWbwMNj6nSXsQ`, Ready. Every one of the 28 genuine
  v1 results in production, rescored read-only, matches its stored
  school.
- #96 merged as `d263a82`: the v2 copy list for the Gate 4 pack, in
  `docs/stage5-plan.md`. One review pass. Deploy
  `dpl_51pMekq4rAXacb9rWdtF9xDU7SUu`, Ready.
- #90 merged as `7e3a746`: judge v3 sends the 4 Nov head comment again
  (ruling 12 reversed); the full run of 16:58 UTC passes 23 of 25; a null
  `objection_answered` or `improvement_note` is accepted on an original
  only. Three review passes. Deploy `dpl_DZnq3f1Ds97NGCgLDKoQPY3ELbHQ`,
  Ready.
- #97 merged as `cd49c49`: Gate 3. A SIX_SCHOOLS build judges all six
  with v3; production is unchanged. The new-schools run of 18:14 UTC: 23
  of 25 in every band; counting the objection, 16 or 23 of 25 pass in
  full, depending on whether the voices the flag-on prompt names count.
  Three review passes.
  Deploy `dpl_CC7xqkvxjH3nsmsUC9sr4GKLZvvR`, Ready.
- Eval key spend is now **$12.2431 of $15.00**, over the 18 run files.
- Sample activity: the first run after the 06:00 cutover, Actions run
  42180458429, ran from 07:22 to 07:25 UTC: success, 40 debates, 38
  checks passed. Its 11 rows dated from 06:00 are rule 2 (whole criteria);
  2 of the 11 composites fall on a multiple of 5.
- Gate 4 is brought to Arthur in `docs/gate4.md`.
- Waiting on Arthur: the Gate 4 pack; Supabase Auth's Site URL and
  redirect list, and the Vercel redirect from www to sophecs.com.
