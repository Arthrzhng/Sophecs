# Progress

A few lines per step: what shipped, the merge commit on `main`, its
production deploy, and what was checked and how. Newest last. The
decisions behind each step are in `docs/decisions.md`; this file is only
the log.

A pull request cannot know its own merge commit, so each entry is written
in its own pull request and the next step's pull request fills in the
merge commit and deploy state of the one before.

Eval key spend is kept as a running total against Arthur's cumulative cap
of $4.80, set in the brief of 2026-11-03. The total is the sum of
`total_cost_usd` over the run files in `tests/judge/golden-runs/`.

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
- The v3 run on `fe5fd3d`, 75 calls, $1.0806, is on branch
  `claude/beautiful-edison-aofswd`. Eval key total after it: $3.5005.

## 2026-11-03: security, the public views

- #50: migrations 0016 and 0017 applied in production and read back;
  0018 written and tested locally, to be applied once the verdict page
  that goes with it is live. Checks: the five gates, the judge request
  fixtures, `check:bundle`, two local Postgres test scripts (156 and 87
  checks), the security advisor before and after each migration,
  styleguide screenshots at 390 and 1280, contrast of the new text.
  Details in the pull request and in `docs/decisions.md`.
