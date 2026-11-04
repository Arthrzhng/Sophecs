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
