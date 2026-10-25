# Phase 2F: the golden set

What a judge run would consist of, written down before one happens. Arthur
reads this and the draft criteria first; nothing here has been sent to a
model.

Measured against `main` at efa2173.

---

## One thing blocks the run: the key

**Everything else is ready**, and that is checked rather than claimed:
`GOLDEN_DRY_RUN=1 npm run judge:golden` validates all 24 fixtures, plans
every case, and prints what a real run would do and cost, without a key
and without sending anything. Under v2 it reports 14 of 24 cases, 42
calls, about $0.42; under v3, 24 of 24, 72 calls, about $0.93. Any value of
`GOLDEN_DRY_RUN` that is not clearly yes or no refuses to start, because
`GOLDEN_DRY_RUN=true` used to make a real, billed run.

**The criteria are approved** as of 2026-10-24 and stay in
`content/prompts/fidelity-criteria.draft.md`. Arthur ruled that they do
not move into `src/lib/judge/rubric.ts` until he publishes the three
schools in Phase 3, so `/api/judge` keeps refusing them. The golden runner
reads them from the draft file instead, in eval mode only. See "How Tier
B runs" below.

**The environment.** This is not something approval fixes. `npm run
judge:golden` needs `ANTHROPIC_API_KEY`, and this sandbox has none set.
The Anthropic API itself is reachable (`api.anthropic.com` answers), so
this is the key alone.

The key is read from the environment and nowhere else. `npm run
judge:golden` no longer passes `--env-file=.env.local`: there is no such
file here, and Node treats a missing one as a fatal error, so the command
died before it could say what was actually missing. An eval key held as an
environment secret is now all it wants.

Supabase was the second blocker and is no longer one. The runner logs to a
file rather than to `ai_calls`, so a run needs nothing from Supabase. With
a key in the environment, a run becomes possible from here.

## What the run has to show

Two tables, v2 then v3, same cases, pasted side by side. The brief's
golden-set discipline: a prompt change is reported with both tables, and
the version is bumped if any band moves.

Two runs produce them, and they differ in one environment variable:

    npm run judge:golden                          # v2, the baseline
    JUDGE_PROMPT_VERSION=v3 npm run judge:golden   # v3

`callJudgeModel` takes a prompt version, defaulting to `PROMPT_VERSION`.
Production never passes one: neither `/api/judge` nor `judgeDebate` has the
argument, so the only prompt they can reach is still v2. That is asserted
in `tests/judge-request.test.ts`, which also compares the v2 request
against the same six fixtures as before — byte for byte unchanged by the
override existing.

The run also reports all four axes against bands now, not two. A case may
leave any band unset, which means the axis is measured and printed but
cannot fail the run; the table prints `any` for it.

Specifically:

1. **The six existing cases do not move.** v3's only behavioural changes
   are the rival-school list and the new section on argument form. Neither
   should touch a case written in a conventional idiom. A moved band on
   these six is a reason to stop and look, not to adjust the band.
2. **The form cases score well under v3.** These are faithful arguments in
   idioms v2 never mentioned. If v3's new section works, they score as
   their conventional counterparts do. If they score the same under v2,
   the section is decoration and should come out.
3. **The low-scoring cases score low under both.** v3 says explicitly that
   fabrication, incoherence, caricature and bare assertion still score
   low. A case that scores well here is v3 being read as permission.

## Sampling, calls and cost

`SAMPLES` defaults to 3 and the runner reports a median, because
`claude-sonnet-5` rejects `temperature` and a single sample is a coin flip
near a band edge: `stoic-strong` returned fidelity 7, 8, 8 on three
consecutive single-sample runs against a band of 8 to 10. That is already
recorded in `docs/decisions.md` and is not revisited here.

**These figures were wrong in an earlier version of this document, and
low by about a sixth.** They priced every call at v2's size. The whole
prompt file is sent, header comment included, and `judge.v3.md` is 10,701
bytes against v2's 4,794, so a v3 call carries roughly 1,480 more input
tokens. A reviewer found it. The estimate is now computed per version:

- `src/lib/anthropic.ts` gives `est_in=1700 est_out=650` for v2, at $2/M
  in and $10/M out. That is **$0.0099** a call. (Its own recorded
  `est_usd_per_call=0.0098` does not follow from those figures; the frozen
  file is left alone and the arithmetic is done here.)
- v3 adds the difference in file size at roughly four bytes a token, about
  3,180 tokens in: **$0.0129** a call. Four bytes a token is a rule of
  thumb; a real count needs an API call. The run reports what was actually
  billed.

| Run | Cases | Samples | Calls | Approximate cost |
|---|---|---|---|---|
| Tier A under v2 (baseline) | 14 | 3 | 42 | $0.42 |
| Tier A under v3 | 14 | 3 | 42 | $0.54 |
| Tier B under v3 | 10 | 3 | 30 | $0.39 |
| **Everything** | | | **114** | **$1.34** |

Tier A and Tier B under v3 are one run of 24 cases, 72 calls, $0.93. Before
the correction this table said $1.12 for everything, and v3's run $0.71.

`GOLDEN_DRY_RUN=1 npm run judge:golden` prints the per-call estimate and
the run's total for the version it is given, without a key and without
sending anything: about $0.42 for v2 and $0.93 for v3, or $0.14 and $0.31
with `GOLDEN_SAMPLES=1`. The Tier A and Tier B split within v3, and the
totals, are those figures added up by hand. The rows above are each
rounded, so they sum to $1.35 where the unrounded total is $1.34.

**The ceiling.** Output is capped at `max_tokens: 850` in
`src/lib/anthropic.ts`. If every call ran to the cap rather than to the
650-token estimate, the 114 calls would cost about $1.57, and $1.74 with
the single-sample check. That is about the most this run can cost at three
samples a case: output is capped, but input is still the four-bytes-a-token
estimate, so the ceiling is approximate too.

Against `AI_MONTHLY_BUDGET_USD`, which is $50 and production-only. A
single-sample pass with `GOLDEN_SAMPLES=1` is a third of the calls: $0.14
under v2, $0.31 for all 24 cases under v3. The v2 one is worth doing first,
to catch a response that fails validation before paying for three samples.

The runner no longer logs to `ai_calls`: these 114 calls do not land in
production's spend ledger and the run needs no route to Supabase. See "How
a run is logged".

## A note on the motions

Every fixture below carries its own motion rather than pointing at a live
one in `debate_topics`, which is what the existing six do. That is
deliberate, and 2D is the reason: a motion read live is a motion that can be
reworded under a thing that depends on it. A fixture that borrowed a
production motion would quietly change meaning the next time that motion
was edited, and a golden set whose inputs move is not a golden set.

---

# Tier A: fourteen cases, runnable as soon as there is a key

All fourteen are in `tests/judge/golden/`. The six below predate this
document and are the baseline; the eight after them were extracted from
this document's own text into fixtures on 2026-10-24, so the arguments a
run sends are the ones written out here. The one change made in extracting
them: two arguments carried markdown italics (*Enchiridion*,
*Utilitarianism*) from this document's formatting, and the asterisks were
dropped, because a student typing into a plain text box does not produce
them and the judge should not see them.

## The six that already exist

These are unchanged, and they are the baseline:

| Case | School | Score band | Fidelity band |
|---|---|---|---|
| `stoic-strong` | stoicism | 60-95 | 8-10 |
| `stoic-wrong-school` | stoicism | 10-45 | 0-4 |
| `util-strong` | utilitarianism | 70-95 | 8-10 |
| `util-wrong-school` | utilitarianism | 5-35 | 0-4 |
| `virtue-strong` | virtue-ethics | 70-95 | 8-10 |
| `virtue-wrong-school` | virtue-ethics | 5-35 | 0-4 |

Nothing about them changes. They are in the run to prove v3 did not move
them.

## Three new cases: form must not cost a mark

Each is a faithful argument from a live school, in an idiom v2 never named.
Expected to score like that school's strong conventional case, with the
objection coming from either of the other two. The existing strong cases do
not share one band (Stoicism 60-95, the other two 70-95), so each new case
takes the band of the school it is written from: **fidelity 8-10
throughout, score 60-95 for the Stoic case and 70-95 for the other two**.

### `stoic-analogy`

> **Motion.** A hospital should be allowed to let an AI triage system
> decide which patients are seen first, even where no clinician can explain
> a given ordering.

> **Argument.** A ship's captain in a storm does not get to choose the
> weather. He chooses the set of the sail, and he is judged on that choice
> and on nothing else. Hand him a chart he cannot read and he is still
> judged on the set of the sail, because that is still what is his. The
> triage system is the weather. Whether it orders the queue well is not up
> to the clinician standing beside it; what is up to her is whether she
> consented to stand there, whether she said plainly that she cannot
> account for the ordering, and whether she keeps looking. A clinician who
> uses the system and tells the truth about it has done the part that was
> hers. A clinician who hides behind it has not, and no accuracy figure
> repairs that, because the figure was never the thing she was answerable
> for.

Tests: the analogy is the whole argument, and the dichotomy of control is
carried entirely inside it. v2 gives no instruction to credit this; v3 says
the form costs nothing.

### `virtue-exemplar`

> **Motion.** A company should publish the error rate of a model it uses to
> approve loans, even where publishing it would let applicants game the
> system.

> **Argument.** Think of the engineer everyone on a team quietly trusts:
> the one who says the number is worse than the slide claims, in the
> meeting, while the slide is still up. Not the one who says nothing and is
> technically correct, and not the one who says it loudly afterwards to
> whoever will listen. What she has is the virtue standing between
> cowardice and recklessness about speaking, and the practical wisdom to
> know that this room, now, is where it matters. Publishing the error rate
> is what she would do, and the gaming is real but it is the cost of being
> the kind of company that can be believed at all. A company that withholds
> it becomes, over many such decisions, one nobody has reason to trust, and
> that is a worse thing to be than gamed.

Tests: the virtue is identified through a person rather than named
abstractly first, and the mean sits inside the portrait. A judge reading
only for "name the virtue and its excess and deficiency" might mark this
down; v3 says it should not.

### `util-named-text`

> **Motion.** A government should be allowed to use an AI system to
> allocate social housing, even where applicants cannot be told how their
> place in the queue was reached.

> **Argument.** Mill's test in *Utilitarianism* is the greatest happiness
> of the greatest number, and he is explicit that each person's happiness
> counts the same as any other's. Apply it. The queue as it stands is
> administered by people with caseloads too large to be fair and discretion
> too wide to be checked, and the evidence on that is not seriously
> disputed. A system that places more households, faster, and with less
> variance between officers produces more welfare across the affected
> population, and the population to count is everyone in housing need, not
> only the articulate ones who would have appealed. The opacity is a real
> cost, paid in the distress of not knowing, and it has to be weighed
> rather than waved through. Weighed honestly, against years in temporary
> accommodation, it does not come close.

Tests: the argument reasons from a named text and then does the weighing.
It should score as a strong utilitarian case; citing Mill must not read as
a substitute for the calculation, and must not be penalised either.

## Four new cases: what still scores low

### `fabricated-source`

> **Motion.** A school should be allowed to use an AI system to predict
> which pupils will fall behind, even where the prediction is never shown
> to the pupil.

> **School.** stoicism

> **Argument.** Epictetus writes in the *Enchiridion* that "the wise man
> welcomes the instrument he cannot read, for the reading was never his to
> do." That settles it. The prediction is an external, and so is the
> pupil's progress, and so is the teacher's view of either. What is up to
> the school is whether it acts well on what it has, and Epictetus is clear
> that refusing a true instrument because its workings are hidden is itself
> a disturbance born of a false judgement about externals. Marcus Aurelius
> makes the same point in *Meditations* IV when he says the obstacle to
> knowing is not the obstacle to acting rightly.

Expected: **score 0-50, rigor 0-3, fidelity unconstrained**, and
`weakest_move` must name the invention. Arthur set the score band on
2026-10-24, widening it from 0-40: the case passes on rigor and on
`weakest_move` naming the invention, and the score is allowed more room
because fidelity is released and the composite partly tracks it. A
reviewer had flagged 0-40 as in tension with releasing fidelity.

"Names the invention" is checked mechanically, and the check is a proxy:
`weakest_move` must contain one of a list of terms, case-insensitive, in a
majority of samples. The list is in the fixture so it is visible:
fabricat, invent, misattribut, never wrote, never said, does not say,
doesn't say, does not exist, doesn't exist, no such, not a real, not
genuine, spurious, apocryphal, made up. "Unverified" is deliberately not
on it. That is what v3 tells the judge to say of a source it cannot place,
which is the right answer for `util-obscure-source` and the wrong one
here, where the authors are among the best known in the canon. The terms
are mine, not Arthur's.

Both quotations are fabricated. The surrounding Stoic framing is competent,
which is the point: the failure has to be caught on the citation, not on
the reasoning around it. **This is the most important case in the set.** If
v3's instruction works anywhere it has to work here, and a rigor score
above 3 means the judge is being persuaded by a confident voice and a real
author's name.

Fidelity is left unconstrained on purpose, and that is a change from how
this case was first written. v3 calls a fabricated or misattributed source
a rigor failure, so rigor is where the band belongs and 0-3 is the
assertion being tested. The reasoning wrapped around the invented
quotations really is the dichotomy of control, correctly applied, so a
judge that scored fidelity high here would not be wrong; one that scored it
low would not be either, since the commitments are being attributed to
sources that do not say them. Pinning that axis would be testing something
the prompt does not claim. The run measures fidelity and prints it, and the
number is worth reading, but it cannot fail the case.

### `incoherent`

> **Motion.** An AI system that reliably reduces suffering should be
> deployed even where nobody can explain its decisions.

> **School.** utilitarianism

> **Argument.** The aggregate welfare case is decisive here, because what
> matters is the total and the total is clearly improved. Of course the
> total is not really the right measure, since suffering cannot be added
> across people in the first place, which is why the utilitarian case is
> the strong one. Deploying it would reduce suffering by a wide margin, and
> that margin is unmeasurable, which is exactly why we should be confident
> about it. Anyone who objects is weighing costs, and weighing costs is
> what this argument has already shown to be impossible, so the objection
> cannot be raised. Therefore deploy, and also do not deploy until the
> explanation exists, which it will not.

Expected: **score 0-30, fidelity 0-4**. Each sentence is utilitarian in
vocabulary and the whole contradicts itself four times. Tests that fluency
in a school's idiom does not substitute for an argument.

### `caricature`

> **Motion.** When an AI system causes harm, the people who built it are to
> blame in proportion to the harm, however careful they were.

> **School.** virtue-ethics

> **Argument.** Virtue ethics says be a good person, so a good person would
> obviously take the blame. The opposing view is utilitarianism, which says
> that nothing matters except the numbers and that people are just
> containers for pleasure to be poured into, so a utilitarian would happily
> let a thousand people be harmed if the spreadsheet came out ahead. That
> is monstrous and nobody believes it. Stoics are worse: they think nothing
> outside your own head is real, so they would not care about the harm at
> all. Virtue ethics is the only one left that treats people as people, so
> the builders are to blame.

Expected: **score 0-30, fidelity 0-4**, with the caricature named. Both
failures v3 distinguishes are present: the assigned school flattened to a
slogan, which is a fidelity failure, and two rivals set up in forms nobody
holds, which is a rigor failure.

### `unsupported`

> **Motion.** Handing your daily choices to an AI assistant costs you
> something that matters, even when its choices are better than yours.

> **School.** stoicism

> **Argument.** This is plainly true, and any Stoic would say so
> immediately. The dichotomy of control settles it. Your choices are up to
> you, and handing them over is therefore a loss, which is obvious once
> stated. Nobody who has read Epictetus seriously could think otherwise.
> The externals are indifferent, the faculty of choice is not, and that is
> the end of the matter. It is the kind of thing that does not need arguing
> for, because the moment you see the distinction clearly you see the
> conclusion with it. Anyone unconvinced has simply not understood the
> distinction yet.

Expected: **score 10-40, fidelity 3-6**. Harder than the others on
purpose: every term is correct and correctly used, the school is not
caricatured, and nothing is fabricated. It asserts throughout and argues
nowhere. Fidelity is allowed to sit higher than the other three because the
commitments really are the school's; rigor is what should collapse.

## One new case: a real source the judge may not know

### `util-obscure-source`

> **Motion.** A health service should be allowed to infer a patient's
> mental health risk from data they gave for another purpose, where doing
> so measurably reduces suicides.

> **School.** utilitarianism

> **Argument.** Count everyone affected and weigh what each gains and
> loses. On one side, a measurable fall in suicides, concentrated among
> people with the least access to care, which is the largest preventable
> harm on the table. On the other, a cost that is easy to leave out of the
> ledger because it is diffuse rather than dramatic. Sabelo Mhlambi states
> it precisely in his 2020 Carr Center discussion paper, at page six: the
> notion that truths, and perhaps all truths, about an individual can be
> rationally computed destroys the core idea of privacy. That loss falls on
> every patient in the dataset and not only on those flagged, and it
> compounds each time another inference is drawn from the same data. So the
> weighing is lives against a widespread and cumulative loss, and the
> honest answer depends on the size of the fall. At a reduction large
> enough to measure against a base rate this low it carries; at a marginal
> one it does not, and the service should say which it has before
> deploying anything.

Expected: **score 70-95, fidelity 8-10**, objection from stoicism or
virtue-ethics.

The citation is real and exact: Carr Center Discussion Paper 2020-009,
printed page 6, quoted word for word from
`content/research/non-western-sources.md`. It is also a 2020 discussion
paper by a scholar writing outside the Anglo-American mainstream, which is
exactly the kind of source a model is least likely to be able to place.

This is the control for `fabricated-source`, and the pair only means
anything together. If the judge scores this one down, or names the citation
as unverifiable in a way that costs marks, v3's confidence rule is not
working, and the effect would fall hardest on the three schools whose
sources are hardest to check. One invented citation caught, one real and
obscure citation left alone: that is the result to read.

What is deliberately not being tested here: the argument is utilitarian and
Mhlambi is cited as evidence about a harm that has to be counted, not as
the ground of the argument. That keeps the case about whether an unplaceable
source is penalised, rather than confounding it with a school-bleed
judgement.

## How a run is logged

`npm run judge:golden` writes every call to
`tests/judge/golden-runs/<run-id>.json` and does not touch `ai_calls`.
Each record carries the prompt version, the fixture, where its criteria
came from (`live` or `draft`), a request fingerprint, the response, all
four axes (score, fidelity, rigor, engagement), the objection school, the
cost and the latency. The file is rewritten after every call, so a run
that dies part way through still leaves what it spent.

The fingerprint is of the inputs, not of the literal request bytes, and the
file says so. `callJudgeModel` does not hand back the request it built, and
rebuilding it to hash it would be a second copy of the assembly, which is
what `tests/judge-request.test.ts` exists to avoid. It covers the prompt
version, a hash of the prompt file, a hash of the school's criteria, and
the motion, school and argument. The assembly is a pure function of those
and is pinned byte for byte by the committed fixtures, so two runs with the
same fingerprint sent the same thing.

`GOLDEN_LOG=ai_calls` restores the old behaviour for anyone who wants an
eval in the production ledger. Production itself is untouched:
`judgeDebate` still writes to `ai_calls` on both the success and the
validation-failure path, `/api/judge` still goes through it, and nothing in
`src/` imports the file sink. `tests/golden-log.test.ts` asserts each of
those.

---

# Tier B: ten cases, written

Arthur approved the criteria on 2026-10-24 with changes, so these are
written out and committed to `tests/judge/golden/` rather than described.
Three shapes, and the third is the one worth being careful about.

**One strong case per school, built on that school's central concepts** —
not on the school's general shape, but on the terms the criteria actually
name, so that a low fidelity score is a readable result rather than a
shrug. Expected **fidelity 8-10**.

**One bleed case per school**, in the rival idiom the criteria name first.
Expected **fidelity 0-4**.

**The known-weakness cases**, where the school's own page concedes an
objection and the argument leans on exactly that. These expect **fidelity
7-10 with the loss taken on engagement**, and the distinction is why they
exist. An argument that authorises hierarchy through roles is doing what
Confucian role ethics does; an argument that leans on communal expectation
is doing what Ubuntu does. Neither is unfaithful. What each owes is an
answer to the objection its own tradition has already had put to it, and
not having one is an engagement failure. A judge that marked these down on
fidelity would be penalising a student for arguing the school as the school
actually runs.

| Case | School | Shape | Expected |
|---|---|---|---|
| `confucian-strong` | confucian | ren realised through li, in a role | score 65-95, fidelity 8-10 |
| `confucian-ren-disposition` | confucian | ren as a cultivated disposition | score 65-95, fidelity 8-10 |
| `confucian-wrong-school` | confucian | utilitarian in Confucian dress | score 5-35, fidelity 0-4 |
| `confucian-hierarchy` | confucian | roles authorising hierarchy, objection unanswered | score 40-75, fidelity 7-10, engagement 0-4 |
| `ubuntu-strong` | ubuntu | shared identity and solidarity | score 70-95, fidelity 8-10 |
| `ubuntu-wrong-school` | ubuntu | expected-utility maximising | score 5-35, fidelity 0-4 |
| `ubuntu-conformity` | ubuntu | communal expectation against a dissenter, objection unanswered | score 40-75, fidelity 7-10, engagement 0-4 |
| `buddhist-strong` | buddhist | anatta, intention, the Rahula test | score 70-95, fidelity 8-10 |
| `buddhist-wrong-school` | buddhist | outcomes only, intention ignored | score 5-35, fidelity 0-4 |
| `buddhist-intention-excuse` | buddhist | good intention excusing damage | score 5-35, fidelity 0-4 |

Three of these exist because of specific decisions Arthur took on the
criteria, and would be pointless without them:

- **`confucian-ren-disposition`.** The criteria read li as the medium and
  ren as what a relationship realises, and the disclosure list says
  scholars differ on whether ren is a disposition or an achievement.
  Rather than settle it, Arthur asked for a case that argues the other
  reading and expects fidelity 8-10. If the judge only credits the
  role-first reading, a case fails rather than a student being marked down
  quietly for the reading we did not write.
- **`ubuntu-strong` carries no appeal to harmony.** An earlier draft of the
  Ubuntu criteria made harmony native on the ground that it is Metz's own
  principle. Arthur withdrew that: it came from memory and is not in the
  research file. The case argues from capacities for relationships of
  shared identity and solidarity, which is the sourced wording.
- **`ubuntu-conformity`.** The earlier criteria scored an appeal to
  communal expectation down on fidelity. They no longer do, so there has
  to be a case proving the judge moves that loss to engagement rather than
  dropping it. Without it the change to the Ubuntu criteria is untested.

`buddhist-intention-excuse` stays a fidelity failure rather than a
known-weakness case, even though the school's page concedes the objection.
The difference is that the criteria name using a good intention to excuse
damage as a fidelity failure in terms: the tradition weighs intention, it
does not treat intention as a discharge.

## How Tier B runs

Against the approved criteria, read from the draft file by
`tests/judge/draft-criteria.ts`, which only the golden runner imports. For
each case the runner decides before any call is made:

- **A live school** is judged against `src/lib/judge/rubric.ts`, exactly as
  production would judge it. The draft file is never consulted for it, and
  `callJudgeModel` refuses draft criteria for a school that has live
  criteria, so no caller can use the golden path to change what a live
  school's request contains.
- **A draft school** is judged against its section of the draft file,
  verbatim, line breaks included: that is the text that was approved and
  measured, so it is the text the judge gets.
- **A draft school under v1 or v2 is skipped.** Those prompts name the
  three live schools in their prose and ask for an objection from "the two
  schools the argument was not assigned", which is incoherent for a school
  outside those three. Tier B therefore runs under v3 only, and a bare
  `npm run judge:golden` skips it, at no cost, and says why.
- **A fixture naming a school with criteria nowhere** throws before the
  first call.

Each logged call records `criteria_source`, `live` or `draft`, so a Tier B
result can never be read as though it came from production criteria.

`tests/draft-criteria.test.ts` is what keeps this confined, built like the
file-sink test for the same reason: an exception made for the eval is only
worth having while it stays inside the eval. It walks `src/` and fails on
any mention of the draft file or the loader, comments included; it drives
the real `/api/judge` handler for each of the three schools and shows it
answers `no_criteria` before any topic lookup, insert or model call, with a
live school as the control that gets past the refusal; and it shows
`callJudgeModel` refuses draft text for a live school. Moving the confucian
criteria into `rubric.ts`, as a demonstration, made the confucian refusal
test fail.

**The walk searches for a name, so on its own it is not proof**, and two
reviewers showed it: a path assembled at runtime has no name to find.
`tests/draft-criteria-reads.test.ts` is the other half. It records every
path the filesystem is asked for while the route loads and handles a
request from a live school and from each draft school, by patching the
real `fs` object rather than mocking an import, so a read through
`node:fs/promises` or through `createRequire` is recorded too. Three
evasions, each placed in a file the route imports, pass the walk and fail
the recorder. What neither catches is a constructed read in a `src/` file that the route
never loads, or one through a filesystem call the recorder does not watch.
It watches the reads, opens, copies and blob opens; a read by another
process it cannot see at all, which is why `child_process` and
`worker_threads` are refused anywhere in `src/`, as a tripwire rather than
a proof.

## These bands are provisional

Arthur accepted the Tier B score bands as provisional on 2026-10-24, with
one rule: **if any case lands outside its band, stop and report. Do not
adjust a band to fit a result.** The same holds for every band in this
document, and for the existing six in particular, which are the baseline
v3 must not move.

## A note on these arguments

Each is written as a student would write it, at the length the existing six
run to: these ten are 151 to 186 words, against 121 to 205 for the
existing six. Each carries its own motion rather than
pointing at a live one in `debate_topics`, for the reason 2D gave: a motion
read live is a motion that can be reworded under a thing that depends on
it.

Two were rewritten after review, before any run, because they did not
exhibit the shape their rows claim. Neither band changed.

- `confucian-hierarchy` was meant to leave the conceded objection
  unanswered, and answered it: "If the worker can appeal, and the employer
  answers, the relation is intact." That is engagement, and would have
  scored as such. It now argues the reciprocity of the roles and never
  meets the power between them. Nothing unfaithful was added to make it
  lean harder; in particular it does not tell the worker not to question
  the employer, since the Analects endorses remonstrance and that would
  have lowered fidelity and muddied the case.
- `ubuntu-conformity` committed a fidelity failure the criteria name:
  "they are the year group's own, which is to say they are the
  community's", which treats the community as a single stakeholder. It
  now leans on the expectations of named relationships, the pupils' year
  group, their families and their teachers, and still says nothing about
  the pressure that puts on a pupil who differs.

They are not covered by the quotation guard, because that reads
`content/**` and these are test data. Nothing in them is presented as a
quotation and none contains quotation marks. One paraphrases *Analects*
12.11, and it tracks the research file's wording: Legge has "There is
government, when the prince is prince, and the minister is minister", and
`confucian-hierarchy` says government rather than order for that reason.

---

## The run, once the key is in

1. `GOLDEN_DRY_RUN=1 npm run judge:golden`, and the same with
   `JUDGE_PROMPT_VERSION=v3`. No key needed, nothing sent; confirms the
   counts below before anything is spent.
2. `GOLDEN_SAMPLES=1 npm run judge:golden`: 14 calls, about $0.14, to catch a
   response that fails validation before paying for three samples.
3. `npm run judge:golden`: v2, 14 cases, 42 calls, about $0.42. The
   baseline.
4. `JUDGE_PROMPT_VERSION=v3 npm run judge:golden`: v3, all 24 cases, 72
   calls, about $0.93. Tier A's second table and Tier B's only one.
5. Paste both tables. **Any case outside its band: stop and report, and do
   not adjust the band.**

Steps 2 to 4 together are 128 calls and about $1.48 with the single-sample
check; 114 calls and about $1.34 without it. Both are estimates, computed
per prompt version as "Sampling, calls and cost" describes, and both were
understated in an earlier version of this document at $1.25 and $1.12.

Nothing goes to a model until Arthur confirms the eval key is in.
