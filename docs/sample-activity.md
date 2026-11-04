# Sample activity

About four thousand labelled sample accounts, with seven weeks of quiz
results, arguments, revisions, challenges, counterpart exchanges, reading
answers and classes, rendered through the ordinary pages. Nothing here is
a demo page: the rows sit in the real tables, marked, and the pages that
can show one say what it is.

This file is the design and the runbook. The code is `scripts/seed/`,
`scripts/seed-production.ts`, `scripts/unseed-production.ts`,
`scripts/seed-local.ts` and `scripts/unseed-local.ts`; the schema is
`supabase/migrations/0021_sample_activity.sql`.

## Where a sample account can be seen

The site has no public profile, no per-person leaderboard and no
messaging, so a sample account is seen in fewer places than the word
"accounts" suggests. Building any of those is out of scope.

| Surface | Who can see it | What a sample shows |
| --- | --- | --- |
| `/table` (school table) | anyone | Counted like anyone else in the week it falls in. In any week with a sample argument the table says "This week's rankings include sample accounts." and links here. |
| `/today` school rank | signed-in readers | The same rows as the table. |
| `/debate/<slug>/<id>` (verdict) | anyone with the link | The Sample label; "Sample assessment" in place of "How the judge scored you", "Notes on the argument" in place of "The judge's note", and a line saying the judge did not read it. No share row. |
| `/r/<id>` (result) | anyone with the link | The Sample label, "A sample account's result", and the stranger's view only (no "Debate them"). |
| `/c/<id>` (challenge) | anyone with the link | The Sample label, "A sample account's challenge"; "Take the quiz" goes to `/quiz` without accepting the challenge. |
| `/class/<code>` | the class owner only | The Sample label under each sample member. Sample classes are owned by sample accounts, so no reader sees one. |
| `/counterpart/<id>` | the two participants only | Sample exchanges are between sample accounts only. |
| `/me` | the reader only | Nothing of a sample's. |

No page links to a sample's verdict, result or challenge, and none is in
the sitemap. Because the table counts the current ISO week only and no
activity is generated after the run, sample arguments shape the table in
the week of the run and are history after it.

The label (`src/components/sample/SampleLabel.tsx`) is a `<details>`: it
reads "Sample" and opens to "An illustrative account with generated
activity, not an active member. It does not respond to messages or
challenges." `/method#samples` explains the rest.

## What a sample can never touch

- **Ratings.** `/api/judge` computes a topic's par from the last 50 genuine
  originals (`.eq("is_sample", false)`), so sample ratings never set the
  par a reader is measured against. `recordChallengeDebate` returns early
  when either side of a challenge is a sample, so no pairwise recompute
  can move a reader by a sample's score. `elo_percentile` counts genuine
  profiles only. The generator replays ratings against a par of its own
  and never writes `debate_topics.par_elo` or `par_n`.
- **Matching.** No sample argument has `seeking_counterpart_at` set, so
  `seekCounterpart` never offers one to a reader.
- **Challenges.** A sample never answers; a reader who opens a sample
  challenge takes the quiz without accepting it.
- **Metrics.** A sample verdict, result or challenge page sends no
  `verdict_viewed`, `objection_viewed`, `card_viewed`, `share_page_viewed`
  or `challenge_viewed` event. The seed itself writes rows directly and
  emits no event, so acquisition referrers on sample results are never
  counted.
- **Email and sign-in.** Sample users are created through the Auth admin
  API with `email_confirm: true` (no confirmation mail), no password, a
  ban of 876,000 hours, and addresses on `sophecs.test`, a domain reserved
  never to resolve. Supabase Auth refuses requests that relate to a banned
  user (`user_banned`). No invitation, link or reset is ever requested.
- **Spending.** No model is called. Every sample verdict is a template,
  `prompt_version` `sample-template-1`, `verdict_is_template` true. No
  `ai_calls`, `reports`, `blocks`, payment or analytics row is written.

## The marker and the registry (migration 0021)

- `is_sample boolean not null default false` on `profiles`,
  `quiz_results`, `debates`, `challenges` and `exchanges`, and
  `debates.verdict_is_template`. Existing rows read false without being
  rewritten.
- A trigger lets only the server role set or clear the marker, so a reader
  editing their own profile cannot mark or unmark anything.
- `seed_runs` (one row per run: plan hash, generator version, seed,
  window, status, lock) and `seed_run_items` (one row per row a run
  intends to write, recorded before the write). A unique index on
  `(kind, row_id)` means two runs can never own one row. Both tables are
  readable and writable by the server role only.
- `debates_public` and `public_results` gain the marker, appended, with
  their owner and grants unchanged.
- An index on `debates(created_at)` for the week reads.
- The rollback refuses while any sample row remains.

`scripts/test-0021-sample-activity.sh` proves all of it on a throwaway
local database, including the rollback and re-apply.

## The dataset

Defaults: 4,000 accounts, 6,000 anonymous quiz results, 400 challenges,
600 exchanges, 12 classes, from 2026-09-18 to the moment the plan is made.
`--seed`, `--from` and `--to` change it. The same plan always produces the
same rows with the same ids.

What the generator reuses from the app rather than reimplementing: the
quiz bank and `scoreQuiz` (answers are biased by a leaning; the school
comes out of the answers), `soloElo`, `pairwiseElo` and `applyStreakDay`
in time order, `checkQuote` and `checkBody` for every turn,
`getWeeklyMotion`, `authorForSeq`, and the seven-day topic lock and
five-a-day limit `/api/judge` enforces.

Measured on the production plan `docs/seed-plans/sample-20261104-202611040204.json`
(seed 20261104, window to 2026-11-04 02:04 UTC), from its `distributions`
block. Another seed or window gives other figures; the plan file is the
record for its run.

| | Target | Measured |
| --- | --- | --- |
| Schools, all quiz results (Stoicism / Utilitarianism / Virtue Ethics) | 40 / 35 / 25 | 41.6 / 34.3 / 24.1 |
| Accounts by arguments: none, 1-3, 4-29, 30+ | 60 / 25 / 12 / 3 | 60 / 25.4 / 11.6 / 3 |
| Debaters who revise | about 15% | 13.6% |
| Arguments, revisions included | 9,000 to 12,000 | 9,370 (445 revisions) |
| Rejected | about 3% | 2.6% |
| Score bands 70-90 / 50-69 / 25-49 | 25 / 50 / 25 | 26.4 / 50.5 / 23.1 |
| Exchanges complete / lapsed / open | 70 / 20 / 10 | 413 / 129 / 58 of 600 |
| Challenges complete / accepted / open | | 120 / 80 / 200 |
| Reading answers | about 3,000 | 2,764 |
| Accounts that switched school once / twice | about 8% / a few | 322 / 35 |
| Debaters still active 14 days after joining | most stop | 13% |
| Timezones: London / New York / Los Angeles / Chicago | UK, then US, then a spread | 52.1 / 13 / 6.1 / 5 (rest spread over nine) |
| Arguments sharing their exact text with another | measured | 30.3% (7,666 distinct texts) |
| Near duplicates (not exact) | measured | 43.6% |
| Reading answers sharing text | measured | 100% |

**Arguments.** `scripts/seed/arguments/<topic>.<school>.json`, forty each
(10 strong, 20 mid, 10 weak, 80 to 250 words), composed by `npm run
seed:banks` from hand-written passages in `arguments/fragments/`: four
positions, four reasons, three examples and two objection-and-answer
passages per motion and school, five school-neutral weak passages per
motion, and four closings per school. A generated argument is a bank
argument with controlled variation (another position, example or closing,
the reasons the other way round, an opening sentence, a dropped example).
Duplication is real and measured, not hidden: the plan reports the share
of arguments whose text another argument shares exactly, and the share
that are near duplicates (80% of five-word shingles shared within one
motion and school). Reading answers come from eight per prompt and are
almost all shared.

**Verdicts.** The judge's own response shape, validated in the tests
against `VerdictSchema`. The score is `10 x (0.5 F + 0.25 R + 0.25 E)`
plus at most 2 points of noise, held in the tier's range (strong 70-90,
mid 50-70, weak 25-50); the judge's prompt gives no formula, so this rule
is the seed's own. The strongest and weakest moves quote the argument
verbatim. The named objection is the rival whose objection the argument
does not answer, and a revision adds that answer.

**Time.** Arrivals grow over the window with a launch bump in the first
week, are busier on weekdays, and fall in each account's local evening
(UK first, then the US, then a spread). Most accounts stop within two
weeks; heavy users stay to the end. Every row is causally after what it
depends on.

## Commands

All of them refuse on any mismatch between flags, plan, credentials and
target, before the first write. None runs from a build, install hook,
migration, CI job or route, and there is no HTTP endpoint.

    npm run seed:plan -- --expected-project-ref tekifezydjlgxgndkxul [--seed N] [--from ISO] [--to ISO]
    npm run seed:production -- --expected-project-ref tekifezydjlgxgndkxul --confirm-production tekifezydjlgxgndkxul --run-id <id> --plan <file>
        # dry run: regenerates the rows, checks the plan's hash, reads the target; writes nothing
    ... --execute --canary 40     # the first 40 accounts and what depends only on them
    ... --execute                 # everything; also resumes a failed or cancelled run
    ... --validate                # reads only
    npm run unseed:production -- <same four flags>                                       # preview
    npm run unseed:production -- <same four flags> --execute --confirm-teardown <id>     # teardown

    npm run seed:local -- --create-db | --make-plan | --run-id <id> --plan <file> [--execute|--validate] | --drop-db
    npm run unseed:local -- --run-id <id> --plan <file> [--execute --confirm-teardown <id>]
    npm run test:seed-db          # migration 0021 on a throwaway local database

`--six-schools` is refused: the published quiz scores three schools.
`--real-judge` is refused: the real pipeline is `/api/judge`, which needs a
session a sample account cannot have; calling the judge library directly
would bypass the route's cap, kill switch and budget, and it is a billing
decision.

## Credentials

`.env.seed.production` (`SEED_SUPABASE_URL`, `SEED_SUPABASE_SERVICE_ROLE_KEY`)
and `.env.seed.local` (`SEED_LOCAL_DATABASE_URL`), both git-ignored, are
the only files read. Nothing reads `process.env`, `.env.local` or
`.env.production`. The production URL must be exactly
`https://<ref>.supabase.co` for the ref given twice; a JWT key must be a
`service_role` key issued for that ref. The local URL must be on
127.0.0.1 or localhost. No key is ever printed.

## How a run writes

In foreign-key order (auth users, profiles, quiz results, challenges,
debates, challenge links, exchanges, turns, reading answers, classes,
members), in batches. For each batch: record intents in the registry;
insert with insert-or-ignore on the primary key; read every row back and
check it is marked or owned by the run's users (a row that exists and is
not the run's stops the run rather than be adopted); mark the intents
created. An auth user with an intent from an earlier attempt is looked up
before it is created. A lost response, a crash or Ctrl-C leaves a state
the same command resumes without writing anything twice. One run at a
time: a run takes a lock, and a lock left by a dead process can be
cleared with `--break-stale-lock` after 15 minutes.

## Teardown

Preview by default. It deletes the run's registry items, scoped again by
the marker or the run's own users, in dependency order. First it looks for
genuine rows that point at the run's rows: a nullable reference (a
reader's `challenge_from`, a debate's `challenge_id`) is cleared so the
genuine row stays; anything that would be deleted with the sample row (a
reader's turn in a sample exchange, a reader in a sample class, a report,
a block) stops the teardown and is listed. It never restores old state.
Afterwards it proves by id that none of the run's rows remain, and keeps
the run and its registry rows, marked deleted, as the audit record.

## Backup and recovery

Production is on the free plan, which has no restorable backups
(`docs/decisions.md`, "Open pre-pilot item: there is no restorable
backup"). The recovery path does not need one: every sample row is in the
registry and removable by id, and the genuine data the run could affect is
small enough to snapshot first. Before the run the dry run records a
baseline (genuine row counts, a hash of every genuine profile's rating,
streak and school, each topic's par, `elo_percentile(1200)`), and
validation compares against it. A JSON export of the genuine rows of the
affected tables is part of the rollout below.

## Stop conditions

Stop and report, without retrying past the engine's own retries, if:

- any validation check fails;
- the run refuses to adopt a row;
- a genuine count falls, or a genuine profile, topic par or percentile
  changes with no genuine activity to explain it;
- auth user creation is refused, or any sample user reads back unbanned;
- the dry run shows the motions differ from the plan, or another run holds
  a lock;
- the canary's measured rate puts the full run beyond an hour.

## Findings from building this

- `submitQuizResult` (`src/app/actions.ts`, frozen) writes the challenge's
  id into `quiz_results.challenge_from`, which references
  `quiz_results(id)`, so accepting any challenge should fail on the foreign
  key. Production has no accepted challenge and no result with
  `challenge_from` set, which fits. Sample results put the challenger's
  result id there, which is what the column references and what `/r/[id]`
  reads.
- `seekCounterpart` (`src/app/debate/actions.ts`) opens an exchange with
  `next_turn` set to the newer seeker, while `/api/counterpart/turn`
  (frozen) only accepts turn 1 from `user_a`, the earlier one, so no first
  turn can be posted. Production has no exchanges. Sample exchanges follow
  the turn route's order.
- The school table and Today read a week of debates and every profile's
  school history without a range, so above 1,000 rows they were silently
  cut short. Both now read through `src/lib/read-all.ts`.
