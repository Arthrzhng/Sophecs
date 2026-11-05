# Stage 5: Phase 3 behind `SIX_SCHOOLS`

The plan for building the six-school product so that production stays as
it is until launch. Written on 2026-11-05, after Arthur's rulings on
Checkpoint A; each step is its own pull request, reviewed and merged as
usual, and the gates below are Arthur's before the step that needs them.

## The flag

`SIX_SCHOOLS=1` is read **at build time**, set in Vercel for Preview
deployments only, and never for Production until launch. A runtime flag
would not do: a production build must not carry the three new schools'
ids, names or colours in any client chunk or stylesheet, which
`npm run check:bundle` already enforces and keeps enforcing for a build
without the flag. With the flag, the three are published for that build:
the registry, the colour tokens, the quiz, the result pages, the cards,
the school pages, the lessons, the table.

At launch the flag is set for Production, the build carries the six, and
the launch steps in `docs/sample-activity.md` ("At launch") run around
that deploy: sample teardown first, the launch, then a fresh run.

**Preview deployments share production's database** (the same Supabase
project), so a preview built with the flag would write v2 quiz results
and new-school debates into production tables. Gate 2 asks how to handle
that before anything that writes is built. Checked in Vercel on
2026-11-05: the Supabase URL, anon key and service-role key are set for
Production and Preview alike. `ANTHROPIC_API_KEY`, `KILL_SWITCH_JUDGE`,
`JUDGE_ALLOWLIST_USER_IDS`, `AI_MONTHLY_BUDGET_USD` and the PostHog
project key are set for Production only. On a preview, then, a call to
the judge or the screener has no key and fails without reaching a model,
and no analytics are sent. A preview can show the arena but not judge an
argument in it; step 5 is tested locally, or on a preview only once
Gate 3 says how.

## Steps

1. **The flag and the registry.** A build-time `SIX_SCHOOLS` read in one
   server module; with it, the draft schools are published for that build
   (ids, names, adherents, colour tokens from `docs/phase3-styleguide/
   colour-candidates.json`, chosen under ruling 16); without it, nothing
   changes. `check:bundle` runs on the flag-off build as now and fails on
   any draft string; a second check builds with the flag and confirms the
   six are present only where meant. Colour tokens for the three go into
   a stylesheet that only a flag-on build includes. No database change.
2. **The pages that only read.** School pages for the three
   (`/s/[school]`, from `content/schools/*.md`), the lessons index and
   filter chips for six, the six-row school table, Today's "view from
   elsewhere" card, the result card and its image for six schools, and
   the landing and sharing copy that names three schools
   (`docs/quiz-v2.md`, section 8). From the Stage 4 previews on
   `/styleguide/phase3`, which stay as the review surface. No database
   change.
3. **Quiz v2.** The questions from `docs/quiz-v2.json`, the map
   (`SchoolMap`) in place of the triangle, the nearest-school result
   logic of `scripts/simulate-quiz-v2.mjs`, and storage of a point rather
   than three weights. **Gate 1.**
4. **v1 and v2 side by side.** v1 results keep opening on the triangle;
   a v2 result opens on the map; the share page's comparison columns and
   a challenge across versions never feed one version's data to the
   other's code (`docs/quiz-v2.md`, section 6).
5. **Debating as a new school.** The arena, the judge and the micro-lessons
   for a reader placed in one of the three. **Gate 3.**
6. **Launch.** On Arthur's instruction only: the sample teardown, the
   flag on for Production, the copy that is true only of v2 and six
   schools (`docs/quiz-v2.md`, section 8), then the fresh sample run.
   **Gate 4.**

## Gates for Arthur

1. **(a) A migration for quiz v2's results.** An additive
   `quiz_results.quiz_version` (default 1, so every existing row stays v1
   unrewritten) and a nullable point (`map_x`, `map_y`), with the v1
   `vector` left as it is. Written and tested locally with a rollback,
   then applied only on his yes, as 0024 was.
2. **Preview writes.** A flag-on preview writes v2 results and new-school
   debates into production's tables. Options: (i) accept it, with every
   such row marked (a `quiz_version` of 2 already marks quiz rows) and
   cleared at launch; (ii) give previews their own Supabase project
   (a second free project, no cost, but its own migrations and secrets);
   (iii) let a flag-on preview read but not write, which tests less.
3. **(b) The judge for the new schools.** Judging an argument from
   Confucianism, Ubuntu or Buddhist Ethics needs their fidelity criteria
   in what the judge receives. The approved drafts stay out of
   `rubric.ts` until he publishes the schools; under the flag they would
   be used on flag-on builds only. That changes what the judge receives
   on those builds, and a golden run for the three would be a billed run
   (d).
4. **(c) Publishing.** The launch itself, with the content judgements
   listed for Checkpoint B (`docs/quiz-v2.md`, section 8, and
   `docs/decisions.md`).

Steps 1 and 2 need no gate and start now.
