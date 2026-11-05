# Checkpoint B

Written on 2026-11-05, after Arthur's rulings on Checkpoint A were carried
out and the first steps of Stage 5 were built. Every open item below is
Arthur's to decide, except the list under Housekeeping, which is mine.
Each names the file it lives in. Nothing here is decided by being written
down.

What shipped is in `docs/progress.md`; why, in `docs/decisions.md`; the
plan for the six schools, in `docs/stage5-plan.md`.

## Where things stand

- **Checkpoint A's rulings are carried out**, except four that wait on
  Arthur below: 6, 7 and 8, which are #71 and wait on migration 0026, and
  5, which is migration 0025 for the SQL Editor.
- **The Node 24 actions and the in-range dependency updates** are merged
  (#76).
- **Stage 5.** The plan (#78) and step 1, the `SIX_SCHOOLS` build flag
  (#79), are merged. Step 2, the pages that only read, is in two pull
  requests: 2a, the school pages, lessons and table, and 2b, Today's view
  from elsewhere. Production shows the three live schools exactly as
  before; a preview deployment shows six, because `SIX_SCHOOLS=1` is set
  in Vercel for Preview only. Steps 3 to 6 wait on the gates below.

To see the six schools, open any preview deployment built after 19:11
UTC on 2026-11-05: `/`, `/s/confucian`, `/s/ubuntu`, `/s/buddhist`,
`/lessons`, `/table`, and Today when signed in.

## Production database writes: (a)

1. **Migration 0026, for the judge's daily ceiling and budget (#71).**
   Ready, reviewed three times, waiting on your yes. On it: advisor,
   apply, advisor, read-back, merge. The pull request has the SQL, the
   lock each statement takes, the rollback and the local test.
   `supabase/migrations/0026_ai_spend_since.sql` on branch `judge-caps`.
2. **Migration 0025, dropping the five unreachable insert policies.**
   Posted for you to run in the SQL Editor. Not run: all five were still
   present at 19:12 UTC. I read it back once you have.
   `supabase/migrations/0025_drop_unreachable_policies.sql`, rollback in
   `supabase/rollback/`.
3. **Stage 5, Gate 1: a migration for quiz v2's results**, before step 3.
   `quiz_results` gains `quiz_version` (default 1) and a nullable point;
   `vector` becomes nullable with a check by version; `public_results`
   is redefined to carry both. Step 3 also edits `src/app/actions.ts`,
   which is frozen. `docs/stage5-plan.md`, "Gates for Arthur", 1.
4. **Stage 5, Gate 2: what a flag-on preview writes**, before step 4.
   Previews share production's database, so a v2 quiz taken on one writes
   a v2 result there and can move a real account into one of the three.
   Three options: (i) accept marked rows, never move an account's school
   to a v2 result's until launch, and clear the rows at launch; (ii) a
   second, free Supabase project for previews; (iii) read-only previews.
   **I recommend (i)**: it needs no new project or secrets, step 3's
   guards keep production safe from the rows, and the clearing is
   already planned into the launch. (ii) is cleaner, and would also stop
   what every preview writes today, flag or none.
   `docs/stage5-plan.md`, "What a preview can reach" and Gate 2.
5. **`blocks own` is `for all` (ruling 25).** It lets a reader delete
   their own block rows, which makes the pair matchable again; the site
   never does this. Put to you after the ruling, which accepted the
   policies as they were. A change would be a migration.
   `docs/decisions.md`, ruling 25.

## What the judge receives: (b)

1. **Stage 5, Gate 3: judging the new schools**, before step 5. Their
   fidelity criteria would go into what the judge receives, on flag-on
   builds only, and the three would join the rival schools it may name.
   A golden run for them would be billed (d). `docs/stage5-plan.md`,
   Gate 3.
2. **#68's last changes to judge v3 were made after its last review**:
   the response format puts `unanswered_objection` before the scores, a
   tighter comment-stripping pattern, and a wording fix. v3 is not live,
   and none of it is measured until a v3 golden run ($0.97 for a full run,
   $0.32 at one sample). `content/prompts/judge.v3.md`.
3. **For the record: `src/lib/judge/schema.ts`, which is frozen under
   (b), was edited under ruling 13.** zod 4 counts code points where zod
   3 counted UTF-16 units, so the 200-character caps now say so
   explicitly (`maxUnits`), and the judge's replies parse exactly as
   before: 91 replies checked on both versions. `docs/decisions.md`,
   "zod 4".

## Publishing: (c)

1. **Stage 5, Gate 4: the launch.** On your instruction only: the sample
   teardown; clearing a preview's v2 rows (if Gate 2 is (i)); the flag on
   for Production, with `next.config.ts`'s refusal of it removed; the
   three content files' status and colour tokens; the share lines and
   other front matter; `README.md`; then the fresh sample run.
   `docs/stage5-plan.md`, step 6.
2. **Nothing may promote a flag-on preview to Production before then.** A
   promotion does not rebuild, so it would pass every check.
   `next.config.ts` refuses a flag-on production build but cannot see a
   promotion. `docs/review-charter.md`, rule 4.

## Spending, rate limits and budget: (d)

1. **An atomic reservation for the judge's ceiling and cap (#71).** Two
   submissions sent at once can both pass on the same count. Each extra
   costs about $0.03 and the monthly budget bounds the total.
   `src/app/api/judge/route.ts`.
2. **Whether allowlisted reviewers face the daily ceiling (#71).** Today
   they have only the monthly budget. `src/lib/judge-allowlist.ts`.
3. **Golden runs:** v3 after #68 (above), and the three new schools under
   Gate 3.

## Content and philosophy: (e)

1. **The adherent nouns for the three.** Proposed, and shown on previews
   only: "Confucian", "Ubuntu Ethicist", "Buddhist Ethicist", with
   plurals. Ubuntu has no settled English noun for one of its arguers,
   and arguing from Buddhist Ethics does not make someone a Buddhist.
   "Ubuntu Ethicist" takes "an", and six places write "a" (step 4 handles
   them). `src/lib/school-registry.ts` (`SHOWN_DRAFTS`) and
   `school-registry.drafts.ts`.
2. **Darker card surfaces for the new schools?** The live three's result
   cards are darker than their markers; the new three's are the marker
   itself, except Buddhist Ethics', darkened only for contrast.
   `src/app/six-schools.css`, `docs/decisions.md`, "The new schools'
   colours".
3. **The share lines that describe the quiz as about AI or name v1's
   questions**, by file and index, with two proposed rewordings.
   `docs/quiz-v2.md`, section 8, "For Arthur".
4. **"A few minutes"** for v2's length, in place of "about eighty
   seconds". `docs/quiz-v2.md`, section 8.
5. **When a school is ranked on the table.** The Phase 3 preview's table
   ranks a school once it has N judged original arguments; N is unset,
   so step 2 shows the new schools unranked with no average instead.
   `docs/daily-path-copy.md`, "School table, a school not yet ranked".
6. **When Today shows the view from elsewhere.** Step 2b shows it all
   week, after step 4 in the path. It could instead wait until the
   reader reaches step 4. `src/components/today/TodayClient.tsx`.
7. **The three's school pages offer "Take the quiz" and "Argue a motion
   from it"**, on previews, before the quiz can place anyone in them
   (step 4) or the judge can judge them (step 5). Hide the two until
   then, or leave them as the pages will be at launch?
   `src/app/s/[school]/page.tsx`.
8. **Pending arena replies are never re-screened (#71).** A reply held
   because screening was paused, over budget or failed stays pending,
   and its author is told it "will be delivered once it has been
   checked", which nothing does. A re-screening job would spend (d); the
   copy is (e). `src/app/api/counterpart/turn/route.ts`,
   `src/components/counterpart/TurnComposer.tsx`.

## Housekeeping

Mine to do, or for your information:

- **`CLAUDE.md` says `check:bundle` looks for a draft's "id or name".** It
  now also looks for its adherent nouns and colours, and Stage 5 adds
  `npm run check:bundle:six`. The file is yours, so I have not changed
  it; `CONTRIBUTING.md` and `docs/review-charter.md` say it in full.
- **GitHub's schedule has run one of the sample workflow's three slots
  today.** The 06:41 UTC slot never ran, the 12:41 one started at 14:57,
  and the 18:41 one had not started at 19:30. So the first run on the
  Node 24 actions and #72's engine is still to come. Scheduled runs on
  GitHub are best effort; if extending the run on time matters, a
  manual run from the Actions tab does the same thing.
- **The sample emails become an HMAC at launch**, for the fresh run.
  `docs/sample-activity.md`, "At launch".
- **`actions/checkout` and `actions/setup-node` v6 and v7** exist; v5 was
  the smallest step to Node 24. `docs/decisions.md`, "Node 24 actions and
  the in-range fixes".
- **`npm audit` listed 10 packages** at #76's merge, none reachable from a
  request. Same entry.
