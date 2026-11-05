# Stage 5: Phase 3 behind `SIX_SCHOOLS`

The plan for building the six-school product so that production stays as
it is until launch. Written on 2026-11-05, after Arthur's rulings on
Checkpoint A; each step is its own pull request, reviewed and merged as
usual, and the gates below are Arthur's before the step that needs them.

## The flag

`SIX_SCHOOLS=1` is set in Vercel for Preview and never for Production
until launch. In Vercel, Preview means every branch's preview: each
step's pull request gets a flag-on preview to review, and a preview of an
unrelated branch shows six schools as well.

**Read when the build starts, not at runtime.** `next.config.ts` reads it
and passes it to the code through `env`, which writes the value into
server and client code alike as a constant. A runtime read would not do:
`school-registry.ts`, `school-colors.ts` and `card-tokens.ts` are imported
by client components (the lessons filter, the quiz result, the verdict),
which cannot read a server variable, so a page would render six schools on
the server and hydrate with three. Every module that holds one of the
three's ids, names, adherent nouns or colours holds it behind that
constant, so a build without the flag drops it as dead code, and
`npm run check:bundle` confirms that it did. The colour tokens are a
stylesheet the build swaps in with the flag, and an empty one without it.
The image routes cannot read a stylesheet, so their colours stay
literals in `card-tokens.ts`, behind the same constant.

**Shown, not published.** With the flag the three are shown on that
build: a list of their own beside `PUBLISHED_SCHOOLS`, which every public
surface moves to in step 2. `PUBLISHED_SCHOOLS` stays the original three
until launch because the judge reads it: the rival schools in its prompt
(`anthropic.ts`) and the schools its reply may name (`judge/schema.ts`,
`judge/rubric.ts`), all frozen under (b). So a flag-on build changes
nothing the judge receives until Gate 3 says otherwise. `DRAFT_SCHOOLS`
does not depend on the flag either, so `check:bundle` always has the
three's strings to look for.

**The three content files stay as they are.** They have no `colour_token`
and `content/**` is frozen, so `tests/school-registry.test.ts` holds the
draft entries to their files and the flag's entries to the flag's own
list; the tokens go into the files at launch, under (c). The adherent
nouns for the three ("a Confucian", and two that have no settled English)
are (e): step 1 uses proposals, on flag-on builds only, and lists them
for Checkpoint B.

At launch the flag is set for Production, the build carries the six, and
the launch steps in `docs/sample-activity.md` ("At launch") run around
that deploy: sample teardown first, the launch, then a fresh run.

## What a preview can reach

Checked in Vercel on 2026-11-05. The Supabase URL, anon key and
service-role key are set for Production and Preview alike, so **a preview
reads and writes production's database**, and signs readers in to
production's accounts. `ANTHROPIC_API_KEY`, `KILL_SWITCH_JUDGE`,
`JUDGE_ALLOWLIST_USER_IDS`, `AI_MONTHLY_BUDGET_USD` and the PostHog
project key are set for Production only. So on a preview:

- **The judge writes nothing.** `/api/judge` checks the monthly budget
  before it inserts a debate, and the budget fails closed when its
  ceiling is unset, so the reader is told judging is paused. Behind that
  there is no key either. A preview can show the arena but not judge an
  argument in it; step 5 is tested locally, or on a preview only once
  Gate 3 says how.
- **An arena reply is saved and never screened.**
  `/api/counterpart/turn` inserts the turn as `pending` and only then
  checks the budget, which fails closed, so the turn stays pending and
  unseen by the counterpart.
- **The quiz writes a result,** and for a signed-in reader moves their
  account's school (`retakeQuizSchool`, `src/lib/claim.ts`).
- **No analytics are sent:** with no project key the client and the
  server send nothing.

All of this is true of every preview today, with or without the flag.
What the flag adds is that the quiz result can be v2 and the school one
of the three; Gate 2 is about that.

## Steps

1. **The flag and the registry.** The build-time read above; the three
   shown on flag-on builds (ids, names, proposed adherents, colour tokens
   from `docs/phase3-styleguide/colour-candidates.json`, chosen under
   ruling 16), with every lookup keyed by school answering for them;
   without the flag, nothing changes. `check:bundle` reads from the build
   whether it was made with the flag rather than from the environment it
   runs in. On a flag-off build it fails on any of the three's ids,
   names, adherent nouns or colours in `.next/static` (colours are new to
   the check). On a flag-on build it fails unless they are there, so a
   flag that did not take is noticed. No database change.
2. **The pages that only read.** School pages for the three
   (`/s/[school]`, from `content/schools/*.md`), the lessons index and
   filter chips for six, the six-row school table, Today's "view from
   elsewhere" card, the result card and its image for six schools, and
   the copy that counts three schools (`docs/quiz-v2.md`, section 8,
   "Three schools become six": `ChallengeInvite.tsx`, the quiz page's
   description, the landing page, the sharing image). From the Stage 4
   previews on `/styleguide/phase3`, which stay as the review surface. No
   database change.
3. **v1 and v2 side by side.** Before anything writes a v2 result,
   because a preview writes into production's tables and production's
   own pages would then read the row: `/r/[id]`, its card and sharing
   image, and `/c/[id]` would put a new school's raw id into server
   HTML (which `check:bundle` never reads), and the share page's
   comparison columns, which read `vector[school]` for each of the three,
   would print NaN% or, with no vector, fail. Every reader of a quiz result
   learns its version: v1 results keep opening on the triangle, a v2
   result opens on the map on a flag-on build and as not found on a
   flag-off one, and the comparison columns and a challenge across
   versions never feed one version's data to the other's code
   (`docs/quiz-v2.md`, section 6). This step reads the version column, so
   it follows **Gate 1**.
4. **Quiz v2.** On flag-on builds: the questions from
   `docs/quiz-v2.json`, the map (`SchoolMap`) in place of the triangle,
   the nearest-school result logic of `scripts/simulate-quiz-v2.mjs`,
   storage of a point, and the copy that is true only of v2 ("a few
   minutes"; the triangle line on the landing page). This is the first
   step that writes something new, so it follows **Gate 2**.
5. **Debating as a new school.** The arena, the judge and the
   micro-lessons for a reader placed in one of the three. **Gate 3.**
6. **Launch.** On Arthur's instruction only: the sample teardown, the
   flag on for Production, the three content files' status and colour
   tokens, the share lines and other front matter in
   `docs/quiz-v2.md`, section 8 (front matter is the same in every
   build, so it cannot be flagged and changes in the launch merge
   itself), `README.md`, then the fresh sample run. **Gate 4.**

## Gates for Arthur

1. **(a) A migration for quiz v2's results**, before step 3:
   - an additive `quiz_results.quiz_version`, default 1, so every
     existing row stays v1 unrewritten;
   - a nullable point (`map_x`, `map_y`);
   - `vector`, which is `not null` today, made nullable, with a check
     that a v1 row has a vector and a v2 row a point. A v2 row has no
     three-school vector to give, and a made-up one would be read as
     real by v1 code;
   - `public_results` redefined to carry the version and the point,
     since the result pages read the view and it names its columns. That
     is a change to what anonymous clients can read, so the security
     advisor runs before and after.

   Written and tested locally with a rollback, then applied only on his
   yes, as 0024 was. The schools themselves need nothing: 0014 already
   lets every school column hold all six.
2. **Preview writes**, before step 4. A flag-on preview writes v2 results
   into production's `quiz_results` (marked, by `quiz_version`), and a
   signed-in reader taking the v2 quiz there moves their real account's
   `profiles.school` and `school_history` into one of the three. Nothing
   marks that, production can show the school only as its raw id, and
   the judge has no criteria for it. Options:
   - (i) accept the result rows, marked and cleared at launch, with
     flag-on builds never moving a profile's school until launch: a v2
     result on a preview stays the anonymous reader's own;
   - (ii) give previews their own Supabase project: a second free
     project, no cost, but its own migrations, secrets and auth;
   - (iii) let a flag-on preview read but not write, which tests least.
3. **(b) The judge for the new schools**, before step 5. Judging an
   argument from Confucianism, Ubuntu or Buddhist Ethics needs their
   fidelity criteria in what the judge receives, and the three among the
   rival schools it may name. The approved drafts stay out of `rubric.ts`
   until he publishes the schools; under the flag they would be used on
   flag-on builds only. That changes what the judge receives on those
   builds, which today cannot reach the judge at all (above), and a golden
   run for the three would be a billed run (d).
4. **(c) Publishing.** The launch itself, with the content judgements
   listed for Checkpoint B (`docs/quiz-v2.md`, section 8, and
   `docs/decisions.md`), and the adherent nouns from step 1.

Steps 1 and 2 need no gate and start now.
