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
2026-11-03 on the Stage 1 miss"). The total is the sum of `total_cost_usd` over every
golden run file, including any on a branch not yet merged, which each
entry names.

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

## 2026-11-04: sample activity, built and tested locally, not run

- Branch `sample-activity`: migration 0021 (the `is_sample` marker, the
  `seed_runs` and `seed_run_items` registry, a trigger that lets only the
  server role set the marker, the marker on `debates_public` and
  `public_results`, `elo_percentile` over genuine profiles, an index on
  `debates(created_at)`), the Sample label and sample-assessment wording,
  the par-window filter in `/api/judge` and the challenge guard, the
  school table and Today read in full past 1,000 rows, and the seed
  tooling in `scripts/seed/`. `docs/sample-activity.md` has the design.
- Not applied and not run anywhere but a local Postgres 16. Migration
  0021: `scripts/test-0021-sample-activity.sh`, all checks passed, and
  `scripts/test-migrations.sh` with 0021 in the rollback round trip, exit
  0. The seed: a local run of 4,000 accounts end to end (create, plan,
  canary of 40, full, validate, teardown preview, teardown), with genuine
  rows in the database that it left as they were.
- Production plan `docs/seed-plans/sample-20261104-202611040204.json`,
  waiting on Arthur's approval with everything else that run needs.
