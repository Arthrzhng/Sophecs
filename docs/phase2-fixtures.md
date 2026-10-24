# Phase 2F: the golden set

What a judge run would consist of, written down before one happens. Arthur
reads this and the draft criteria first; nothing here has been sent to a
model.

Measured against `main` at 7dd2975.

---

## Two things block the run, and only one of them is approval

**The criteria.** `content/prompts/fidelity-criteria.draft.md` holds draft
fidelity criteria for Confucianism, Ubuntu and Buddhist Ethics. Nothing
loads them, `hasFidelityCriteria` returns false for all three, and
`/api/judge` refuses a submission from those schools rather than judging
it. Tier B below cannot run until those criteria are approved, because
there is nothing to score fidelity against.

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

`src/lib/anthropic.ts` carries `est_usd_per_call=0.0098` for
`est_in=1700 est_out=650` at $2/M in and $10/M out.

| Run | Cases | Samples | Calls | Approximate cost |
|---|---|---|---|---|
| Tier A under v2 (baseline) | 14 | 3 | 42 | $0.41 |
| Tier A under v3 | 14 | 3 | 42 | $0.41 |
| **Tier A total** | | | **84** | **$0.82** |
| Tier B under v3, after approval | 9 | 3 | 27 | $0.26 |
| **Everything** | | | **111** | **$1.08** |

Against `AI_MONTHLY_BUDGET_USD`, which is $50 and production-only. A
single-sample pass with `GOLDEN_SAMPLES=1` is a third of the calls: $0.14
for Tier A under one prompt version, $0.27 for Tier A under both. It is
worth doing first to catch a fixture that fails to validate before paying
for three samples of it.

The runner no longer logs to `ai_calls`: these 111 calls do not land in
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

## The six that already exist

`tests/judge/golden/` holds these, unchanged, and they are the baseline:

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

Expected: **score 0-40, rigor 0-3, fidelity unconstrained**, and
`weakest_move` must name the invention.

Both quotations are fabricated. The surrounding Stoic framing is competent,
which is the point: the failure has to be caught on the citation, not on
the reasoning around it. **This is the most important case in the set.** If
v3's instruction works anywhere it has to work here, and a score above 40
means the judge is being persuaded by a confident voice and a real author's
name.

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
Each record carries the prompt version, the fixture, a request
fingerprint, the response, all four axes (score, fidelity, rigor,
engagement), the objection school, the cost and the latency. The file is rewritten after every call, so a run
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

# Tier B: after the criteria are approved

Nine cases, and they are deliberately not written out yet. Each one has to
score against criteria that do not exist until Arthur approves them, and
writing an argument to hit a band defined by a draft that might change is
work done twice.

Three kinds, and the third is the one worth being careful about.

**One strong case per school, built on that school's central concepts.**
Not on the school's general shape: on the terms the criteria actually name,
so that a low fidelity score is a readable result rather than a shrug. Ren
and li for Confucianism, Metz's principle and the appeal to harmony it
licenses for Ubuntu, anatta for Buddhist Ethics. Expected **fidelity
8-10**.

**One bleed case per school**, in the rival idiom the criteria name first.
Expected fidelity low, as with the existing three `*-wrong-school` cases.

**The known-weakness cases**, where the school's own page concedes an
objection and the argument leans on exactly that. These expect **high
fidelity with the loss taken on engagement**, and the distinction is the
whole point of including them. An argument that authorises hierarchy
through roles is doing what Confucian role ethics does; an argument that
leans on communal expectation is doing what Ubuntu does. Neither is
unfaithful. What each owes is an answer to the objection its own tradition
has already had put to it, and not having one is an engagement failure. A
judge that marked these down on fidelity would be penalising a student for
arguing the school as the school actually runs, which is the failure mode
these two cases exist to catch.

| Case | School | Shape | Expected | Why |
|---|---|---|---|---|
| `confucian-strong` | confucian | ren realised through li, in a role | fidelity 8-10 | the central terms, scored well |
| `confucian-wrong-school` | confucian | utilitarian in Confucian dress | fidelity 0-4 | the bleed the criteria name first |
| `ubuntu-strong` | ubuntu | Metz's principle, harmony as a ground | fidelity 8-10 | the central terms, scored well |
| `ubuntu-wrong-school` | ubuntu | expected-utility maximising | fidelity 0-4 | the bleed Metz argues against |
| `buddhist-strong` | buddhist | anatta, with intention and the Rahula method | fidelity 8-10 | the central terms, scored well |
| `buddhist-wrong-school` | buddhist | outcomes only, intention ignored | fidelity 0-4 | the consequentialist bleed |
| `confucian-hierarchy` | confucian | role-based, authorising hierarchy, objection unanswered | fidelity 7-10, engagement 0-4 | the objection the school's own page concedes |
| `ubuntu-conformity` | ubuntu | communal expectation against a dissenter, objection unanswered | fidelity 7-10, engagement 0-4 | the charge Matolino and Kwindingwi press |
| `buddhist-intention-excuse` | buddhist | good intention excusing damage | fidelity 0-4 | the failure the criteria name explicitly |

`ubuntu-conformity` is new as of Arthur's revision of the criteria on
2026-10-24, and it is the case that revision made necessary. The earlier
draft criteria scored an appeal to harmony down as a fidelity failure. They
no longer do, because harmony is Metz's own principle, so there has to be a
case that proves the judge takes the objection off fidelity and puts it on
engagement rather than just ignoring it. Without this case the change to
the Ubuntu criteria would be untested.

`buddhist-intention-excuse` stays a fidelity failure and is not a
known-weakness case, even though the school's page concedes the objection.
The difference is that the criteria name using a good intention to excuse
damage as a fidelity failure in terms: the tradition weighs intention, it
does not treat intention as a discharge.

One worked example, so the shape is visible:

### `confucian-strong` (draft)

> **Motion.** A council should be allowed to use an AI system to decide
> which families are visited by a social worker first, even where the
> ordering cannot be explained to them.

> **Argument.** Ask what the social worker and the family are to each
> other, because that is the question, and it is not answered by how
> accurate the ordering is. Ren is not a warm feeling she brings to the
> visit; it is the humaneness that the relationship between them realises
> when each can meet what the position requires. And it is realised through
> li, through the forms the work is conducted in: that she knows their
> circumstances before she arrives, that she can account for why she came
> to them first, that she can be held to it when she was wrong. Those forms
> are not decoration on the relationship. They are how it is learned and
> how it is kept. A system that orders the queue and cannot say why does
> not remove the obligations; it removes the form in which they were met,
> and a relationship whose forms have gone is degraded whatever the
> throughput figures say. Worse, calling it a triage tool names it as
> something that assists her judgement when it has replaced it. The name
> has done work the system has not.

Expected: **score 65-95, fidelity 8-10**, objection from utilitarianism or
virtue-ethics. Three of the criteria's commitments are load-bearing here:
ren as what a relationship realises, li as what it is conducted and learned
through, and holding a name to its work.

This is a rewrite. The earlier version of this example argued from roles
and from the rectification of names and never used either central term,
which would have tested the school's general shape rather than the criteria
as written.

The other eight follow this pattern once the criteria are settled. If the
criteria change, these change with them, which is the reason for waiting.

---

## What I would do next, on a yes

1. Add the eight new Tier A cases to `tests/judge/golden/` in the existing
   fixture format, with the bands above.
2. `GOLDEN_SAMPLES=1 npm run judge:golden` first: 14 calls, $0.14, to catch
   a fixture that fails zod before paying for three samples of it.
3. `npm run judge:golden`, then `JUDGE_PROMPT_VERSION=v3 npm run
   judge:golden`, three samples each, $0.82, and paste both tables.
4. Report any band that moved on the existing six, and stop rather than
   adjust it.

Steps 2 to 4 need an environment with an Anthropic key. They need nothing
from Supabase. Step 1 I can do here.
