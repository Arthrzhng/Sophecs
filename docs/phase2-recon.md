# Phase 2A: recon

Report only. No loader, component, type, migration, prompt or content file
was changed to produce it, and nothing was written to the production
database. The only file this branch adds is this document.

Scope: the staged expansion that adds Confucianism, Ubuntu and Buddhist
ethics alongside the existing three schools. Phase 1 put the content in
the repository behind a draft gate. Phase 2 is the wiring, and 2A is the
survey before any of it is cut.

Measured against `main` at 1f99e39 on 20 October 2026. This is a different
Phase 2 from `docs/phase2-brief.md`, which is the September brief that
built the arena.

---

## 1. The kill switch, and who can trigger a verdict

### 1.1 Where the switch is read

| Site | What it does | Consults the allowlist |
|---|---|---|
| `src/app/api/judge/route.ts:52` | The only gate that stops a model call | Yes, `:49` |
| `src/app/today/page.tsx:51` | Shows the daily path as locked | Yes |
| `src/app/table/page.tsx:105` | Shows a paused notice on the school table | Yes |
| `src/app/debate/page.tsx:139` | Shows the topic list as paused | **No** |

`src/lib/judge-allowlist.ts` is the single reader of
`JUDGE_ALLOWLIST_USER_IDS`: a comma-separated list of `auth.users` ids,
empty by default.

One inconsistency to note, because `docs/daily-path-copy.md` claims
otherwise. It says the locks "read the same `KILL_SWITCH_JUDGE` +
allowlist check the judge uses, so they lift on their own when judging
resumes", and that is true of `/today` and `/table` but not of `/debate`.
`/debate/page.tsx:139` reads the switch alone, so an allowlisted reviewer
is told on `/debate` that judging is paused and can then submit anyway.
Cosmetic, and only reviewers ever see it, but it is a real difference
between what that page says and what the route does.

### 1.2 The configured state in production

All three judging variables exist on Vercel with the **production target
only**. None of them is set for preview.

| Variable | Target | Created | Last edited |
|---|---|---|---|
| `KILL_SWITCH_JUDGE` | production | 2026-09-10 19:06 UTC | 2026-09-20 21:19 UTC |
| `JUDGE_ALLOWLIST_USER_IDS` | production | 2026-09-06 14:37 UTC | never |
| `AI_MONTHLY_BUDGET_USD` | production | 2026-09-14 15:42 UTC | never |

The values are encrypted and I did not decrypt them. What the
configuration does say in the clear is the comment you left on
`KILL_SWITCH_JUDGE`:

> Judge is LIVE. Set to the exact string "true" and redeploy to pause all
> judging. Allowlisted ids bypass this.

The database corroborates the history rather than the present state:

| Measure | Value |
|---|---|
| `ai_calls` rows, all time | 1 |
| of kind `judge` | 0 |
| of kind `judge_allowlist` | 1 |
| Timestamp of that call | 2026-09-14 15:45:30 UTC |
| `debates` rows | 1, judged, `prompt_version` v1 |
| `exchanges` / `turns` rows | 0 / 0 |
| `profiles` / `auth.users` | 1 / 2 |

So: exactly one verdict has ever been produced, and it came through the
allowlist, six days before the comment was last edited. No ordinary
judged call has ever been logged, which is what you would expect if the
switch was on until 20 September and nobody has submitted since.

**What I can state and what I cannot.** The configuration says judging is
live and the comment was written to say so. I cannot read the value, and
this sandbox has no route to production (`CONNECT tunnel failed, response
403` for sophecs.com), so I cannot confirm the running state by
observation. You can, in one click: `/table` is public, and it renders
"Judging is paused while we check the quality of the verdicts." whenever
the switch is on. Open it signed out. If that line is absent, judging is
live.

### 1.3 Who can trigger a verdict

`/api/judge` is the only route that calls the judge model, and it refuses
in this order:

| # | Gate | Response | Allowlist bypasses |
|---|---|---|---|
| 1 | Malformed body | 400 | no |
| 2 | Not signed in | 401 | no |
| 3 | `KILL_SWITCH_JUDGE === "true"` | `paused: kill_switch` | **yes** |
| 4 | Monthly budget | `paused: budget` | no |
| 5 | No school on the profile | 400, "Take the quiz first." | no |
| 6 | Unknown or inactive topic | 404 | no |
| 7 | Five judged calls in 24 hours | `paused: daily_cap` | **yes** |
| 8 | Already revised this debate | `paused: already_revised` | no |
| 9 | Same topic within seven days | `paused: topic_lock` | no |
| 10 | Word count outside 80 to 400 | 400 | no |

The allowlist skips exactly two of the ten, which matches what
`docs/decisions.md` says it is for.

Two things follow that matter for 2F. First, `src/lib/budget.ts` **fails
closed**: `isBudgetExceeded()` returns true when
`AI_MONTHLY_BUDGET_USD` is unset or zero. Second, that variable has no
preview target. Together they mean **no Vercel preview deployment can
ever judge**, whatever the kill switch says, and `ANTHROPIC_API_KEY` is
absent on preview too. A golden-set run has to happen locally with a key,
not from a preview URL.

### 1.4 The live prompt version

`src/lib/judge/schema.ts:3` sets `PROMPT_VERSION = "v2"`, and
`src/lib/anthropic.ts:25` loads `content/prompts/judge.${PROMPT_VERSION}.md`.
So `judge.v2.md` is what would run today, while the single stored verdict
carries `prompt_version: v1`. There is no v2 verdict in production to
compare against, which is worth knowing before 2E adds a v3.

---

## 2. The fifteen enumeration sites

### 2.1 All fifteen are still there

Every site in `docs/phase1-recon.md` section 1.2 still exists. One line
number moved: `SchoolVector` is now `src/lib/types.ts:18`, not `:5`,
because `knownSchool()` was added at `:14` in Phase 1B. `knownSchool`
reads `SCHOOL_IDS` and is not a sixteenth list.

### 2.2 The list is not complete

Eleven further sites hold a per-school map or enumerate the three schools
by hand. Phase 1A either classified them as derived consumers or did not
reach them, and three of them matter.

| Site | What it is | Why it was missed |
|---|---|---|
| `src/lib/judge/rubric.ts:10` | `FIDELITY_CRITERIA: Record<SchoolId, string>`, the school fidelity criteria the judge prompt is built from | not a colour or a type, so it was outside Phase 1A's sweep. **This is the 2E dependency** |
| `src/lib/quiz-position.ts:19` | `TRIANGLE.vertices`, one coordinate pair per school | listed as a derived consumer; it holds its own map |
| `src/lib/scoring.ts:15, :23` | two object literals with one key per school | listed as a derived consumer; the literals are enumerations |
| `src/components/quiz/SchoolTriangle.tsx:5` | `CORNER: Record<SchoolId, string>` of CSS variable names | not reached |
| `src/components/debate/Verdict.tsx:54` | `SCHOOL_LABEL: Record<SchoolId, string>` of display names | not reached |
| `src/components/today/TodayCards.tsx:145` | an inline ternary chain mapping id to colour variable suffix | not reached, and the worst of the eleven: see 2.4 |
| `src/app/sitemap.ts:25` | three hardcoded `/s/<school>` URLs | not reached |
| `src/app/opengraph-image.tsx:15` | three explicit `SCHOOL_MARKER` reads | not reached |
| `scripts/render-cards.tsx:16` | local `SCHOOLS` array | `scripts/` was out of Phase 1A's scope |
| `src/lib/arena-fixtures.ts` | fixture vectors and per-school rows | preview-gated, styleguide only |
| `src/app/styleguide/arena/page.tsx` | per-school demo blocks | preview-gated, styleguide only |

So the count is twenty-six sites, not fifteen. The number is less useful
than the split in the next section.

### 2.3 Which gate catches what

I widened `SchoolId` and `SCHOOL_IDS` to six members in a throwaway
worktree and ran the gates. Nothing in the repository was touched. The
quiz is frozen, so `SchoolVector` was left at three fields, which is the
shape 2B would actually have.

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | **28 errors in 10 files** |
| `npm run test` | **10 failures in 2 files** |
| `npm run lint` | **0 errors** |

The compiler errors, by file: `scoring.ts` 9, `SchoolTriangle.tsx` 5,
`school-colors.ts` 4, `quiz-position.ts` 3, `card-tokens.ts` 2, and one
each in `judge/rubric.ts`, `chunky.ts`, `Verdict.tsx`, `SharePage.tsx`
and `tests/topic-seed-diff.test.ts`.

Widening `SchoolVector` as well gives 53 errors in 12 files, 30 of them in
`content/quiz/questions.ts`. That file is frozen, and leaving
`SchoolVector` at three fields is what keeps it out of the diff. Worth
settling in 2B: a new school is an allegiance, not a quiz outcome, so the
vector should stay three wide.

### 2.4 What no gate catches

This is the part 2B has to handle by hand, because every one of these
compiles, passes, lints, and keeps showing three schools.

| Site | What happens with six schools |
|---|---|
| `src/lib/footnotes.ts:4` | a second `SCHOOL_IDS`, still three. Client components silently disagree with the server |
| `src/lib/judge/schema.ts:15` | a third `SCHOOL_IDS`, feeding `z.enum` at `:44`. A verdict naming a new school fails validation at runtime, and the debate row keeps `verdict null` |
| `src/components/today/TodayCards.tsx:145` | the ternary falls through to `--color-stoic`, so a Ubuntu reader's school name renders in the Stoic colour |
| `src/app/sitemap.ts:25` | the new school pages are simply absent from the sitemap |
| `src/app/opengraph-image.tsx:15` | the landing card keeps three markers |
| `src/components/nav/SiteFooter.tsx:5` | footer keeps three links |
| `src/components/lessons/ModuleFilter.tsx:25` | filter offers three chips |
| `src/app/debate/rubric/page.tsx:15` | the published rubric lists three schools |
| `src/components/share/SharePage.tsx:161` | `ORDER` keeps three. The file does error, but at `:172` and for the vector, not for the array |
| `src/app/styleguide/daily-path/page.tsx:22`, `scripts/render-cards.tsx:16` | three, in preview and in the card renderer |
| `supabase/migrations/*` | not TypeScript at all. Section 3 |

The ternary in `TodayCards.tsx` is the one I would fix first whatever 2B
decides, because it is the only site that renders a **wrong** answer
rather than an incomplete one.

### 2.5 One runtime crash

`src/lib/quiz-position.ts:47` iterates `SCHOOL_IDS` and indexes both the
vector and `TRIANGLE.vertices` by each id. Widen `SCHOOL_IDS` and
`vertices["confucian"]` is `undefined`, so `vertex.x` throws. That is the
six failures in `tests/quiz-position.test.ts`, and `vectorToPoint` runs
on the quiz result page and the result card.

The fix is not a key. A triangle has three corners, and the Phase 1
decision was that the quiz keeps sorting into the original three, so
`vectorToPoint` should iterate the quiz's three rather than whatever
`SCHOOL_IDS` happens to hold. That is a 2B decision, not a mechanical
edit, and it is the clearest argument for the registry carrying two
lists: the schools the quiz sorts into, and the schools the product has.

---

## 3. How the school value is constrained in the database

No enum type exists. Every constraint is a CHECK, and I read them from
production rather than from the migration files.

| Table | Constraint | Definition |
|---|---|---|
| `quiz_results` | `quiz_results_school_check` | `school in ('stoicism','utilitarianism','virtue-ethics')` |
| `quiz_results` | `quiz_results_secondary_check` | same three, on `secondary` |
| `profiles` | `profiles_school_check` | same three |
| `debates` | `debates_school_check` | same three |

**Four constraints on three tables**, not three. Phase 1A listed the
tables and missed `quiz_results.secondary`, which is a separate
constraint and would need its own `alter`.

Three things carry a school and are not constrained at all:

- **`exchanges.school_a` and `exchanges.school_b`** are `text not null`
  with no school CHECK. The only check on them is `school_a <> school_b`.
  The table is named `exchanges` in the database, not
  `counterpart_exchanges`; `supabase/migrations/0012_counterpart.sql:6`
  creates it under that name.
- **`debate_topics.stances`** is `jsonb` with no key constraint. All six
  rows currently carry exactly the three keys, checked just now.
- **The read views** `debates_public`, `exchanges_public`,
  `profiles_public` and `public_results` each expose a school column.
  Views hold no constraints, so they inherit whatever the tables allow.

`profiles.school_history` is `jsonb not null` and also unconstrained.

For 2C that means: four `alter table ... drop constraint ... add
constraint` pairs across three tables, and a decision about whether
`exchanges` should gain the constraint it never had. Adding it would be
new enforcement rather than a widening, so it is a separate question from
the rest of 2C.

---

## 4. Every place that reads motion text for a debate

`debates` has no motion column. Confirmed against production: the columns
are `id, user_id, topic_slug, challenge_id, school, argument, rejected,
rejection_reason, verdict, score, prompt_version, argument_public,
elo_before, elo_after, elo_recomputed_at, created_at, kind,
parent_debate_id, seeking_counterpart_at`. The stored `verdict` jsonb has
no `motion` key either, checked on the one judged row.

So every surface below reads the **current** motion from
`debate_topics`, and a reword rewrites what a past debate appears to have
been about. That is the decision already recorded in `docs/decisions.md`
as "A motion is read live, so a reword rewrites the past".

### 4.1 Reads the live motion from `debate_topics`

| Site | Line | What the motion feeds | Affected by a reword after the fact |
|---|---|---|---|
| `src/app/api/judge/route.ts` | `:72` select, `:214` use | the judge prompt, via `anthropic.ts:69` | the verdict is already stored, so no |
| `src/app/debate/[slug]/[debateId]/page.tsx` | `:42` select, `:175` | the verdict page heading | **yes** |
| same | `:149` to `:168` | the share line, shortened to 60 characters | **yes** |
| `src/app/debate/[slug]/[debateId]/opengraph-image.tsx` | `:40` | the verdict card image | **yes** |
| `src/app/debate/[slug]/[debateId]/revise/page.tsx` | `:78`, `:99` | the revision editor | **yes** |
| `src/app/counterpart/[id]/page.tsx` | `:67`, `:115` | the exchange page | **yes** |
| `src/app/debate/[slug]/page.tsx` | `:44`, `:80` | the argument editor, before submission | correct to be live |
| `src/app/debate/page.tsx` | `:49`, `:122` | the topic list | correct to be live |
| `src/app/today/page.tsx` | `:85` | this week's motion | correct to be live |

The brief named three. There are nine, and the two beyond the ones the
brief listed are **the revise page and the counterpart exchange page**,
both added after the September brief was written. The share line on the
verdict page is a fourth consumer on a page the brief already named.

### 4.2 Reads the motion from the content files instead

`src/lib/topics.ts` reads `content/topics/*.md`, which the running arena
does not use. Three surfaces read motions that way:
`src/app/page.tsx:23`, `src/app/lessons/[slug]/page.tsx:33` and
`src/app/lessons/modules/[id]/page.tsx:30`. The seed script is the only
bridge between the files and the table, so these can disagree with the
arena until it is run. Not a 2D problem, but it is a second source of
motion text and worth knowing before 2D stores a third.

### 4.3 Not a motion reader

The counterpart screening call takes only `quotedClaim` and `body`
(`src/lib/screen.ts:50`). It never sees the motion, so 2D does not touch
it.

---

## 5. Can migrations be tested locally

**Yes.** The 2C fallback is not needed.

What is not available: the Docker daemon is unreachable, so the Supabase
CLI local stack cannot run, and the CLI is not installed or available as
a dependency. No `supabase db diff`, no edge functions, no local Studio.

What is available: **PostgreSQL 16.15** server binaries at
`/usr/lib/postgresql/16/bin`, with `psql` on the path. I started a
cluster on port 55432, created a fresh database, and applied a short shim
for what Supabase provides and bare Postgres does not: the `auth` schema,
an `auth.users` table, the `anon`, `authenticated` and `service_role`
roles, and an `auth.uid()` that reads the JWT claim.

All thirteen migrations then applied cleanly in order, 0001 through 0013,
with `ON_ERROR_STOP=1`. The result is a faithful fixture:

- The same four school CHECK constraints, with byte-identical
  definitions to production.
- The same thirteen public tables, by name: `ai_calls`, `blocks`,
  `challenges`, `class_members`, `classes`, `debate_topics`, `debates`,
  `exchanges`, `profiles`, `quiz_results`, `reading_responses`, `reports`,
  `turns`.
- 24 RLS policies across 12 tables, installed.
- The constraint genuinely enforces. Inserting a `confucian` row into
  `quiz_results` is rejected with
  `violates check constraint "quiz_results_school_check"`, a `stoicism`
  row is accepted, and after a 2C-shaped `drop constraint` and
  `add constraint` the `confucian` row is accepted.

Two limits to state plainly. `auth.uid()` returns null locally, so RLS
can be checked for installing and parsing but not exercised against real
sessions; that still needs the production or a hosted database. And
production runs Postgres 17.6 while this is 16.15, so anything
version-specific would need confirming against the real thing. Nothing in
these thirteen migrations is version-specific.

The practical upshot for 2C: write the migration, apply it to a fresh
local database on top of 0001 through 0013, and show the before and after
inserts, before anything touches production.

---

## Three things I am carrying forward

1. **The registry in 2B needs two lists, not one.** `SCHOOL_IDS` is read
   both as "schools the quiz sorts into" (`scoring.ts`,
   `quiz-position.ts`, `school-table.ts`) and as "schools the product
   has" (footer, lessons, rubric). Widening the single list crashes the
   quiz result page. Splitting it is the Phase 2B question.
2. **A dozen sites change silently.** The compiler catches ten files and
   the tests catch two. Everything in section 2.4 compiles, passes and
   keeps showing three schools, and `TodayCards.tsx:145` shows a wrong
   colour rather than a missing one.
3. **`src/lib/judge/rubric.ts` is frozen in spirit but not on the list.**
   `FIDELITY_CRITERIA` is `Record<SchoolId, string>`, so it is one of the
   ten the compiler stops, and the criteria themselves are yours to write
   rather than mine. 2E needs them before it needs a prompt.
