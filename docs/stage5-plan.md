# Stage 5: Phase 3 behind `SIX_SCHOOLS`

The plan for building the six-school product so that production stays as
it is until launch. Written on 2026-11-05, after Arthur's rulings on
Checkpoint A; each step is its own pull request, reviewed and merged as
usual, and the gates below are Arthur's before the step that needs them.

## The flag

`SIX_SCHOOLS=1` is set in Vercel for Preview and never for Production
until launch. In Vercel, Preview means every branch's preview: each
step's pull request gets a flag-on preview to review, and a preview of an
unrelated branch shows six schools as well. A preview builds when its
branch is pushed, not when it merges, so a step that needs a gate is not
pushed before the gate is answered.

Vercel runs a plain `next build`, which runs no bundle check, so a wrong
tick that set the flag for Production would publish the three with every
gate green. `next.config.ts` therefore refuses to build when the flag is
on and `VERCEL_ENV` is `production`, or when a Vercel build does not say
which environment it is for; the launch merge removes that refusal. It
covers builds only: promoting a flag-on preview to Production does not
rebuild, so it would publish the three past every check, and is never
done before launch. `npm run check:bundle:six` is the other direction:
it catches code that ignores the flag, not a wrong setting in Vercel.

**Read when the build starts, not at runtime.** `next.config.ts` reads it
and passes it to the code through `env`, always as `"0"` or `"1"` (Next
skips an unset value, which would leave nothing to write in), and `env`
writes the value into server and client code alike as a constant. A
runtime read would not do: `school-registry.ts`, `school-colors.ts` and
`card-tokens.ts` are imported by client components (the lessons filter,
the quiz result, the verdict), which cannot read a server variable, so a
page would render six schools on the server and hydrate with three.
Every module that holds one of the three's ids, names, adherent nouns or
colours holds it behind that constant, so a build without the flag drops
it as dead code, and `npm run check:bundle` confirms that it did. The
colour tokens are a stylesheet the build swaps in with the flag, and an
empty one without it.
The image routes cannot read a stylesheet, so their colours stay
literals in `card-tokens.ts`, behind the same constant.

**Shown, not published.** With the flag the three are shown on that
build: a list of their own beside `PUBLISHED_SCHOOLS`, which every public
surface moves to in step 2. `PUBLISHED_SCHOOLS` stays the original three
until launch. The judge read it until Gate 3: the rival schools in its
prompt (`anthropic.ts`) and the schools its reply may name
(`judge/schema.ts`, `judge/rubric.ts`), all frozen under (b). Since Gate
3 it reads the shown list instead, so a flag-on build judges six and a
build without the flag is unchanged (`docs/decisions.md`, "Gate 3: the
three judged on SIX_SCHOOLS builds"). `DRAFT_SCHOOLS`
(server-only) does not depend on the flag either, and carries the
proposed adherent nouns as well as the ids and names, so `check:bundle`
always has the three's strings to look for: those, and every colour in
the flag-only stylesheet. It fails if a draft has no adherent noun or the
stylesheet no colour, so neither direction of the check can pass on an
empty list.

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
  ceiling is unset, so the reader is told "The judge could not be
  reached." over "The spending limit could not be checked, so nothing
  was sent to the judge." (corrected on 2026-11-07; this said "told
  judging is paused"). Behind that
  there is no key either. A preview can show the arena but not judge an
  argument in it; step 5 is tested locally, or on a preview only once
  Gate 3 says how.
- **An arena reply is saved and never screened.**
  `/api/counterpart/turn` inserts the turn as `pending` and only then
  checks the budget, which fails closed, so the turn stays pending and
  unseen by the counterpart.
- **The quiz writes a result,** and moves a real account's school in two
  ways (`src/lib/claim.ts`): a signed-in reader's quiz replaces their
  school (`retakeQuizSchool`), and signing in after an anonymous quiz
  claims the result and gives a new or schoolless account its school
  (`claimAnonymousResults`). Since step 4 a quiz v2 result does neither
  (`docs/decisions.md`, "Stage 5, step 4"): `submitQuizResultV2` never
  calls `retakeQuizSchool`, and `claimAnonymousResults` takes a school
  from v1 results only (noted on 2026-11-07).
- **No analytics are sent:** with no project key the client and the
  server send nothing.
- **Links leave the preview.** Share and challenge links are written for
  `https://sophecs.com` (`ShareSheet.tsx`, `ShareRow.tsx`,
  `ChallengeButton.tsx`, and the layout's `metadataBase`), so a v2 result
  shared or challenged from a preview sends its reader to production,
  where step 3 makes it not found until launch. v2 sharing and challenges
  across versions are tested by opening the same path on the preview's
  own host.

Those are the paths Stage 5 changes. A preview also runs every other
server action against production as it is: pairing a tester with a real
reader in the arena, deleting an account, classes, reports and blocks.
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
   the landing page's "The three schools" section, which lists schools to
   read about. Copy that says what the quiz places you in waits for step
   4, since only v2 can place you in six. From the Stage 4 previews on
   `/styleguide/phase3`, which stay as the review surface. No database
   change.
3. **v1 and v2 side by side.** Before anything writes a v2 result,
   because a preview writes into production's tables and production's
   own pages would then read the row. `/r/[id]`, its card and sharing
   image, and `/c/[id]` all call `getSchool`, which throws for a draft
   (`src/lib/schools.ts`), so a v2 result in one of the three would be an
   error page in production; and the share page's comparison columns,
   which read `vector[school]` for each of the three, would print NaN% or,
   with no vector, fail. Three more readers take a school from a result:
   `claimAnonymousResults` gives a schoolless account the school of its
   newest result, whichever build it signs in on, so a v2 result made on
   a preview would place the account in production; `getPendingChallenges`
   (`src/lib/challenge.ts`) names the other side's school on `/me`; and
   `submitQuizResult` reads the challenger's school. Every reader of a
   quiz result learns its version: v1 results keep opening on the
   triangle, a v2 result opens on the map on a flag-on build and as not
   found on a flag-off one, the claim and the challenge readers take a
   school from v1 results only, on every build, until launch, and the
   comparison columns and a challenge across versions never feed one
   version's data to the other's code (`docs/quiz-v2.md`, section 6).
   `submitQuizResult` is in `src/app/actions.ts`, which is frozen, so
   this step edits a frozen file too. It reads the version column, so it
   follows **Gate 1**, and it is deployed to production before step 4's
   branch is pushed. Done as migration 0027 and `src/lib/quiz-result.ts`
   (`docs/decisions.md`, "Stage 5, step 3"); the map on a v2 result page
   comes with step 4, which brings the v2 quiz's data it draws from.
4. **Quiz v2.** On flag-on builds: the questions from
   `docs/quiz-v2.json`, the map (`SchoolMap`) in place of the triangle,
   the nearest-school result logic of `scripts/simulate-quiz-v2.mjs`,
   storage of a point, and the copy that is true only of v2: "a few
   minutes", the triangle line on the landing page, and everything in
   `docs/quiz-v2.md`, section 8, "Three schools become six", that says
   what the quiz places you in (`ChallengeInvite.tsx`, the quiz page's
   description, the landing page's opening, the sharing image). v2 is
   new files beside v1's: `content/quiz/questions` and v1's scoring in
   `src/lib/scoring.ts` stay byte-identical until the launch teardown,
   because the live sample run replays them and halts if they change
   (`docs/sample-activity.md`, Limits). The result is written by
   `submitQuizResult` in `src/app/actions.ts`, which is frozen and typed
   to v1's three-weight vector, so this step edits a frozen file. It is
   the first step that writes something new, so it follows **Gate 2**.
   Done on SIX_SCHOOLS builds (`docs/decisions.md`, "Stage 5, step 4"):
   `src/lib/quiz-v2.ts`, `src/lib/quiz-v2-score.ts`, `QuizShellV2`, and
   `submitQuizResultV2` in `src/app/actions.ts`, which never moves a
   profile's school and takes up only a v2 challenger's challenge.
5. **Debating as a new school.** The arena, the judge and the
   micro-lessons for a reader placed in one of the three. **Gate 3.**
   The judge is done on SIX_SCHOOLS builds (`docs/decisions.md`, "Gate 3:
   the three judged on SIX_SCHOOLS builds"): v3, the six as rivals, and
   the three's criteria from the draft file; a build without the flag
   sends what it sent.
6. **Launch.** On Arthur's instruction only: the sample teardown; under
   Gate 2's option (i), clearing the preview's v2 results before the
   launch merge, since once production writes v2 results the version can
   no longer tell them apart (an (a) write). A genuine reader's rows may
   point at one: a `quiz_results.challenge_from` is set to null, and a
   challenge a real reader made whose challengee is a v2 row is reopened
   rather than deleted, since `debates.challenge_id` may hold it. Then the
   flag on for Production, with `next.config.ts`'s refusal removed; the
   three content files' status and colour tokens, the share lines and
   other front matter in `docs/quiz-v2.md`, section 8 (front matter is
   the same in every build, so it cannot be flagged and changes in the
   launch merge itself), `README.md`, then the fresh sample run. The
   six "elsewhere" passages stay `status: draft`: the flag, not their
   status, shows them, and their status goes when the flag is retired.
   Turning the flag on also holds the live table to the 20-argument rule
   (`rankThresholdApplies` in `src/lib/school-table.ts`): from the
   launch deploy, over the week in progress, a school is unranked until it
   has 20 judged original arguments in the week. Arthur ruled on 2026-11-06 that it applies at launch,
   with the flag, and not before. The rules steps 3 and 4 set "until
   launch" are lifted in the launch merge, in every file
   `docs/decisions.md`, "Stage 5, step 4", lists under "To undo at
   launch": v2 results take up v1 challengers, move a signed-in reader's
   school, give a school on sign-in (`schoolFromResult` and the claim's
   own filter), count on `/me` and in challenges, and can be debated.
   `src/app/actions.ts` is among them, and is frozen.
   **Gate 4.**

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
   yes, as 0024 was. The rollback can restore `vector`'s `not null` only
   while no v2 row exists. The schools themselves need nothing: 0014
   already lets every school column hold all six. Gate 1 also covers step
   3's edit to the frozen `src/app/actions.ts`.
2. **Preview writes**, before step 4. A flag-on preview writes v2 results
   into production's `quiz_results` (marked, by `quiz_version`), and moves
   a real account into one of the three by either path above: a signed-in
   reader's v2 quiz replaces their `profiles.school` and adds to
   `school_history`, and signing in after an anonymous v2 quiz gives a
   new or schoolless account the v2 result's school. Nothing marks that.
   In production the account would then hit an error on `/today`, which
   calls `getSchool`; `/me` and its class pages would print the school's
   raw id, in server HTML that `check:bundle` never reads; and the judge
   has no criteria for its school, so it refuses before writing a debate.
   Step 4 also edits `src/app/actions.ts`, which is frozen. Options:
   - (i) accept the result rows, marked and cleared at launch (step 6),
     with no build moving a profile's school to a v2 result's until
     launch, on either path: the v2 quiz does not replace a school, and
     the claim on sign-in, on any build, gives no school from a v2 result
     (step 3);
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
   `docs/decisions.md`), and the adherent nouns from step 1. The launch
   also holds the live table to the 20-argument rule, which the flag
   brings with it (ruled 2026-11-06; step 6).

   **Gate 4 checklist.** What step 6 and this gate name, with the golden
   runs from the Checkpoint B ruling below and the source check Arthur
   asked on 2026-11-06 to have ticked here; each is ticked as it is done,
   and the launch itself waits for Arthur's instruction.
   - [x] The golden runs pass (the condition for bringing Gate 4). 23 of
     25 in band in both v3 runs, and every case passing the objection
     check once the fixtures count each school's named voices (a sample's
     objection need not be one of them); the two misses, `confucian-hierarchy-school`
     and `stoic-analogy`'s fidelity, accepted by Arthur as known misses,
     2026-11-07 (`docs/decisions.md`, "Gate 4: Arthur's rulings").
   - [x] The primary sources behind the Ubuntu quotations opened by
     Arthur and checked against the research file word for word: Metz,
     "Toward an African Moral Theory" (2007), pp. 322 and 332; Mhlambi,
     "From Rationality to Relationality" (Carr Center, 2020), pp. 3 and 6.
     2026-11-06 (`docs/decisions.md`, "Primary sources opened by Arthur").
   - [ ] The content judgements listed for Checkpoint B
     (`docs/quiz-v2.md`, section 8, and `docs/decisions.md`) and the
     adherent nouns, as ruled.
   - [ ] The sample teardown.
   - [ ] The preview's v2 results cleared before the launch merge, an (a)
     write: `challenge_from` set to null where a genuine row points at
     one, a real reader's challenge with a v2 challengee reopened
     rather than deleted, and `debates.challenge_id` set to null where it
     points at a cleared challenge (its foreign key has no on-delete
     action).
   - [ ] The flag on for Production, with `next.config.ts`'s refusal
     removed; the live table's 20-argument rule comes with it.
   - [ ] The navigation's three redirects (`/table` to `/schools`,
     `/method` to `/how-it-works`, `/debate/rubric` to its `#rubric`)
     made permanent (308) in the launch merge (`sixSchoolsRedirects` in
     `next.config.ts`, and `tests/nav-six.test.tsx`, which pins
     `permanent: false`; Arthur, 2026-11-06).
   - [ ] The three content files' status and colour tokens (the six
     "elsewhere" passages keep `status: draft`).
   - [ ] The share lines and other front matter (`docs/quiz-v2.md`,
     section 8), in the launch merge itself.
   - [x] The three new schools' stances on the six topics (Arthur,
     2026-11-07, Gate 4 item 9): written in `content/topics/*.md` (#103),
     then seeded into `debate_topics` (a write he approved, (a)) at 06:29
     UTC on 2026-11-07, and read back equal to the hashes `docs/decisions.md`,
     "Gate 4 item 9", gives.
   - [ ] `README.md`.
   - [ ] The "until launch" rules of steps 3 and 4 lifted (step 6), in
     every file `docs/decisions.md`, "Stage 5, step 4", lists, with the
     tests that pin them.
   - [ ] `RUN_QUIZ` set to 2 in `scripts/seed/generate.ts` in the launch
     merge, after the sample teardown, so the scheduled job's runs cover
     all six schools placed by quiz v2 (Gate 4 item 13;
     `docs/sample-activity.md`, "At launch"). The same merge updates the
     one test that pins today's switch, "is still what the scheduled job
     makes" in `tests/seed/six-schools.test.ts`, which expects `RUN_QUIZ`
     unset. The command checks and the scheduled path are tested with it
     set either way, so nothing else changes.
   - [ ] The fresh sample run, canary then full, each on Arthur's word.
   - [ ] The v2 copy below, read and ruled by Arthur in the Gate 4 pack
     (asked for on 2026-11-06).
   - [x] The judge at launch, ruled by Arthur on 2026-11-07
     (`docs/decisions.md`, "Gate 4: Arthur's rulings"): production judges
     with v3, its cost accepted; no score change shown across two
     versions, Elo and par unchanged; v3's head comment left as sent.
   - [x] The rubric showing the v3 criteria the judge is given for all
     six, on every page that says they are published in full (Arthur,
     2026-11-07, Gate 4 item 10): a SIX_SCHOOLS build shows them (#102).
   - [ ] In the launch merge, the three new schools' criteria moved from
     `content/prompts/fidelity-criteria.draft.md` into
     `src/lib/judge/rubric.ts` with the same text, shown by the flag-on
     request fixtures (`tests/judge-request/six-schools/`) passing
     unchanged (Arthur, 2026-11-07, Gate 4 item 6).

   **The v2 copy, for the Gate 4 pack.** Accepted by Arthur on
   2026-11-07 (Gate 4 item 8), with the two fixes marked in the table.
   Every piece of text a reader
   sees only because quiz v2 and the six schools are on, as a flag-on
   build shows it today, with what a reader sees now. Lines already ruled
   are marked so; "New" is text for his (e) judgement. The questions,
   options and axis names themselves were ruled at Checkpoint A
   (`docs/decisions.md`, "Quiz v2, as ruled"; `docs/quiz-v2.json`) and
   are not repeated here.

   | Where | Now | With v2 | Status |
   | --- | --- | --- | --- |
   | Landing page, under the heading (`src/app/page.tsx`) | A short quiz places you with the Stoics, the Utilitarians or the Virtue Ethicists. Then a few minutes a day: ... | A short quiz places you in one of six schools of ethics. Then a few minutes a day: ... | New |
   | Landing page, under the first question | About 80 seconds. No sign-up, and no name attached to your answers. | A few minutes. No sign-up, and no name attached to your answers. | "A few minutes" ruled, (e) 4 |
   | Landing page, first step | A short quiz. Every answer moves you across the triangle. | A short quiz. Every answer moves you across the map. | New |
   | Landing page, the schools' heading | The three schools | The six schools (counted from the list) | New |
   | The quiz page's description (`src/app/quiz/page.tsx`) | Ten questions that place you in Stoicism, Utilitarianism or Virtue Ethics, by what you already think rather than what you have read. | Ten questions that place you in one of six schools of ethics, by what you already think rather than what you have read. | New |
   | The site's sharing image (`src/app/opengraph-image.tsx`) | Ten scenarios. Three schools. One result you'll want to argue about. | Ten scenarios. Six schools. One result you'll want to argue about. The coloured hairline under it is drawn from the published schools, so it shows three colours until they are published. | New |
   | A challenge's invitation (`src/components/share/ChallengeInvite.tsx`) | ... places you in one of three schools of ethics, ... and about eighty seconds. | ... places you in one of six schools of ethics, ... and a few minutes. | "A few minutes" ruled, (e) 4; "six" new |
   | A result's share page (`src/components/share/SharePage.tsx`) | ... No account needed, about eighty seconds. | ... No account needed, a few minutes. | Ruled, (e) 4 |
   | The map beside the landing page's question one | You start here (on v1's triangle) | You start here | Unchanged |
   | The map beside a question, once an answer is selected | The dashed ring shows where answer A (to D) moves you. | Where this answer moves you | The brief's words, on the Stage 4 preview (`docs/daily-path-copy.md`, section 12) |
   | The map's accessible title, beside each question | Your position so far; or Your position so far, between X and Y | Where your answers put you, on the map of the schools | New |
   | The map on the reader's result | (none) | Where your answers put you; accessible title "Where your answers put you, on the map of the schools" | New |
   | The map on a shared result (`/r/<id>`) | (none) | Where these answers landed; accessible title "Where these answers put them, on the map of the schools" | New |
   | Every map's description for screen readers (`src/components/phase3/SchoolMap.tsx`) | (none) | The schools sit on a ring, in this order going round: (the six, in order). A filled dot marks where you stand. A dashed ring marks where this answer would move you. A line joins your earlier positions in order. (Each sentence only where it applies.) | Accepted, 2026-11-07, with one fix: on `/r/<id>` the dot is "where they stand" |
   | The quiz's last button | See your school | See your school | Unchanged |
   | If the server scores a school the page cannot show | (none) | Couldn't show this result. Your result was saved, but this page could not show its school. Open the link again in a moment. | New |
   | Today, after the reader has argued (`src/components/phase3/ElsewhereCard.tsx`) | (none) | Optional; A view from elsewhere; Another tradition on this week's motion. There is no check, and it is not a step.; Read it | When it appears ruled, (e) 6; copy in `docs/daily-path-copy.md`, section 12 |
   | The lesson player's label for that passage (`src/app/lessons/[slug]/page.tsx`) | (none) | A view from elsewhere | As above |
   | The six passages it opens (`content/micro/*-elsewhere.md`) | (none) | Each file's own title, passage and source | Content, for his reading |
   | `/table`, a school under the threshold (`src/lib/school-table.ts`) | (none: the three are always ranked) | Ranked once it has 20 judged original arguments. (n) so far. | The threshold ruled, (e) 5 and 2026-11-06; the copy in `docs/daily-path-copy.md` |
   | The share lines (`content/schools/*.md`), in a result's share sheet | The three published schools' lines | All six schools' lines; the nine of the three new schools are new to readers | The two rewordings ruled, (e) 3, with "the other lines ... unchanged". `utilitarianism.md` [1] rewritten by his ruling of 2026-11-07, not to cite v1's self-driving-car question: "Turns out I'd pick whatever does the most good for the most people, even when I'm the one who pays for it. Sophecs called that Utilitarian." (new wording, for his reading) |
   | `README.md` | one of three schools | To be written in the launch merge | Not written yet |

   Text that changes only because the list of schools is longer needs no
   new judgement and is not in the table: "The other five" on a school's
   page, "All six modules read.", "Fourth", "Fifth" and "Sixth on the
   table this week" on Today, the school names in the footer, the lessons
   filter, `/table` and the exemplars page, the adherent nouns in "You
   argue like an Ubuntu Ethicist" and "They came out a Confucian" (ruled,
   (e) 1), and the three new schools' own pages and modules.

Steps 1 and 2 need no gate and start now.

**Ruled at Checkpoint B, 2026-11-05.** Gate 1: yes, the migration and the
edit to `src/app/actions.ts`. Gate 2: option (i). Gate 3: yes, the new
schools' criteria on flag-on builds only, and the three in the rival list
on flag-on builds; the new-schools golden run follows the full v3 run,
within an $8.00 cumulative cap on the eval key. Gate 4: not yet; it is
brought to Arthur once the golden runs pass. Nothing promotes a flag-on
preview to Production (`docs/decisions.md`, `### Arthur's rulings of
2026-11-05 on Checkpoint B`).
