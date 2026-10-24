# Review charter

The standards a step of work is reviewed against before it merges.

Written because the review loop changed on 2026-10-24. Arthur used to read
every pull request and merge it himself. He now reads only the decisions
that are his, and a step is reviewed by a fresh agent that has not seen the
work being reviewed, against this file. That only works if the standard is
written down rather than carried in the head of whoever wrote the code.

**This file grows.** Every time Arthur or a reviewer catches something a
rule here would not have caught, the rule goes in. Most of the rules below
exist because something got through, and each one says what.

A reviewer's job is to find where the work breaches a rule here, say so
concretely, and say how it could be checked. A reviewer who finds nothing
should say what it looked at, so that the absence of findings is a result
rather than a shrug.

**Every incident cited below names where its evidence lives**, because the
first review of this file caught the charter citing fixes that existed only
on an unmerged branch and describing them in the past tense. A reviewer
asked to verify those against `main` found the pre-fix state and reasonably
concluded the charter was unreliable. A citation with no ref is not
checkable, and an unmerged fix described as done is worse than no citation
at all.

---

## 1. The five gates pass

```
npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run check:bundle
```

All five, on the branch as pushed, not on a tidied working tree. A report
that says the gates pass has to have run them.

`npm run build` is not redundant with `tsc`: it catches Satori rendering in
the image routes and the `server-only` boundary, neither of which is a type
error.

### A gate must be scoped to the repository

Check what a gate actually ran on, not just what it said. A test count,
file count or lint target that does not match the repository is the gate
reporting on something else.

Caught on the first run of this loop, by a stop hook rather than by a
reviewer. The reviewer agents work in git worktrees under
`.claude/worktrees/`, each a full copy of the repository on its own branch,
and `vitest`, `tsc` and `eslint` all globbed into them: 85 test files and
1007 tests where `main` has 28 and 327, failing because two branches
disagreed with each other about tests neither branch under review
contained. The failures looked like the work's and were not.

The opposite sign is the dangerous one. The same hole would let a gate
report green off a stale agent checkout, and nothing in the output would
say so. All three tools now exclude `.claude/`, and `.gitignore` keeps the
worktrees out of a commit.

So: when a suite's numbers move, find out why before reading the result.

## 2. The judge request fixtures are byte-identical

`tests/judge-request/` holds six fixtures: the exact request
`src/lib/anthropic.ts` sends for each live school, as an original and as a
revision. **Judging is live and no production verdict may change**, so a
diff in any of those six is a change to how a real student's argument would
be scored.

The check is

    git diff --stat origin/main...HEAD -- tests/judge-request/

and the expected result is no output. **Write the revision range.** A bare
`git diff --stat tests/judge-request/` compares the working tree to the
index, so in a clean checkout it is empty whatever the branch did; it was
reported as evidence that the fixtures had not moved, and it was evidence of
nothing. `npm run test` enforces the same property behaviourally through
`tests/judge-request.test.ts`, which captures the request at the SDK
boundary and compares it to the committed files, and that is the check that
actually fails.

A fixture may only move where Arthur approved that specific change, and
then the approval is quoted in the pull request body.

**The fixtures are narrower than the rule.** They cover the v2 path for the
three live schools and nothing else, so a change to `judge.v3.md`, to a
draft school's criteria, to `src/lib/judge/rubric.ts` or to
`content/prompts/fidelity-criteria.draft.md` moves no fixture and passes
this rule while still changing what the judge receives. Anything that
changes the system prompt, the fidelity criteria, the motion, the stance or
the argument is Arthur's decision **even when no fixture moves**,
non-default prompt versions and draft-school criteria included.

Rewriting them takes `WRITE_JUDGE_FIXTURES=1`, which no npm script sets.
That is deliberate: a `vitest -u` must not be able to rewrite them, and
neither must a reviewer in a hurry.

## 3. No draft string reaches a client bundle

Phase 1B's guarantee is that no draft school reaches any page or any
bundle. `npm run check:bundle` greps `.next/static` for every draft
school's id, name and adherent noun, taking the strings from the registry
rather than from a list in the script.

Today that is six strings, and the script prints the count: the draft
entries in `src/lib/school-registry.drafts.ts` carry an id and a name but no
adherent nouns, so the adherent needles `draftNeedles()` would add are
empty until a draft entry gains them. Read the printed count rather than
assuming the coverage.

This rule exists because a single registry that enumerated all six schools
put three unreleased school names into **thirteen** production client
chunks (`docs/decisions.md`, the server-only split entry). The other four
gates were green at the time, and the answer first offered was that a few
hundred bytes of client JavaScript was an acceptable trade. The bytes were
never the problem.

A review that touches the registry, a school map, or anything imported by a
client component checks the grep output, not the reasoning about why it
should be fine.

## 4. Publishing a draft is Arthur's decision, and rule 3 goes green on one

A school, lesson or motion becoming visible is stop condition (c). It is
its own rule because **rule 3 cannot catch it, and does not merely miss it:
it passes.** Publishing a school moves its entry out of `DRAFT_SCHOOLS` in
`src/lib/school-registry.drafts.ts`, so `draftNeedles()` in
`scripts/check-client-bundle.ts` stops looking for that school's strings
altogether and `npm run check:bundle` reports success on the one change that
most needs Arthur's yes.

The check is the diff, not the gate: `git diff origin/main...HEAD --
src/lib/school-registry.drafts.ts src/lib/school-registry.ts
content/schools/` plus the `status:` front matter in the school files. A
school moving from `draft` to published also needs fidelity criteria to
exist for it, or `/api/judge` refuses every submission from it
(`hasFidelityCriteria` in `src/lib/judge/rubric.ts`).

## 5. Quotations are verbatim from the research file

Every quotation in the **non-Western** content comes from
`content/research/non-western-sources.md`, word for word, and every way the
content differs from the source is declared in `tests/content-quotations.ts`
so the guard checks it. The three live schools are exempt and the exemption
is written down: `REPORT_ONLY` in that file lists
`content/schools/{stoicism,utilitarianism,virtue-ethics}.md`, whose sources
predate the research file, and the test reports on them without failing. A
slot with no verified source gets `TODO-SOURCE` and a note to Arthur, never
a quotation from memory.

What `UNVERIFIED` bars is narrower than "not used", and the charter said the
broad thing first. An `UNVERIFIED` item may not be a **citation or an
attribution**, because an attribution has to be a citable text; the Nguni
maxim's English gloss has an UNVERIFIED translator and date and is still the
`one_line` of `content/schools/ubuntu.md`, quoted from the philosopher who
reports it rather than from a translator. The check is a read of the
research row, not a test: `quoteProblems` checks verbatim presence and never
reads the markers.

**Doctrinal description is not under this rule.** Arthur amended it on
2026-10-24: the live Stoic criteria describe indifferents without quoting
anyone, so a school's central commitments may be described in the
project's own words. Terms a school cannot be described without — ren, li,
anatta, dependent origination, dukkha — need no verified passage behind
them. What replaces the rule is a disclosure: any doctrinal claim the
writer is unsure of is listed for Arthur rather than asserted, in the file
it would have gone into.

A reviewer checks that the list exists and that nothing in the body is a
claim that should have been on it.

Where to look: the numbered list at the foot of
`content/prompts/fidelity-criteria.draft.md`. **It is not on `main`** — it
arrives with the revised criteria on the unmerged branch
`docs/phase2-fixtures`, and on `main` that file has no list at all, because
the amendment that requires one is newer than the file. A re-review caught
this sentence claiming otherwise, which is the same defect as the three
above: the charter describing the branch it was written alongside as though
it were the repository.

## 6. Claims in reports are verified, not asserted

Every factual claim in a pull request body or a report to Arthur says how
it was checked: **"I checked X by doing Y"**, with Y being a command, a
file read, or a test. A claim with no Y is a guess with a confident tone.

Three that got through before this rule existed:

- Three of six golden-set bands were wrong in a document, generalised from
  the one fixture that had actually been read. The file is
  `docs/phase2-fixtures.md`, which is on the unmerged branch
  `docs/phase2-fixtures` and not on `main`. The numbers were corrected by
  reading each fixture; **there is no generator**, and an earlier version of
  this rule claimed there was. The check is to open each JSON file in
  `tests/judge/golden/` and compare it to the row. A test that parses the
  table and compares it to the fixtures would make this enforceable and does
  not exist yet.
- A report said rewording a motion would change a debate's share text. The
  two real wordings are identical in their first 57 characters and the
  share text is 60, so it would not have. Found by comparing the strings.
- A claim about Supabase backup availability was going to be answered from
  memory. The free plan's actual terms came from Supabase's own
  documentation.

The same rule covers "the tests pass", "the deploy is Ready" and "the
fixtures are unchanged". Run it, then say it.

## 7. Test expectations match the thing they test

A test that asserts the opposite of what the code now does is worse than no
test: it passes review by being green, and it encodes a decision nobody
made.

Specifically:

- A test about a prompt reads the prompt. Two tests written in Phase 2E
  assert that `anthropic.ts` contains no rival-schools substitution and that
  `judge.v3.md` names it in its header comment
  (`tests/judge-v3-and-refusal.test.ts`). Both became false the moment
  Arthur approved that substitution. **On `main` they are still the
  pre-approval versions**; they are rewritten rather than deleted on the
  unmerged branch `docs/phase2-fixtures`, and that rewrite is part of what
  Arthur has yet to approve.
- An expected value that contradicts a rule the prompt states is a bug in
  the test. A JSON example was about to use `ASSIGNED_SCHOOL` as the value
  of a field the prompt says must never hold the assigned school.
- A band, a cap or a threshold in a document is checked against the file
  that implements it, not against the memory of writing it.
- **Measure the artefact the way the code measures it.** A document said
  the three live fidelity criteria run 730 to 893 characters, which is
  their `.length`. A review of them reported 729 to 892 and overwrote the
  document with it, because the measuring script had flattened whitespace
  first and each criterion's one blank line turned two characters into
  one. Every bound was off by exactly one, and the new figure contradicted
  `tests/judge-v3-and-refusal.test.ts`, which asserts the real band. The
  conclusion the figures supported was still true; the figures were not.
  When a document and a test disagree about a number, the test is the one
  that runs.

The check: for every assertion that names a prompt, a document or a cap,
open the named file and confirm it still holds. A test that names a file in
its own comment is checked against that file. List the file beside the test
name in the review, so the reviewer after you can tell what was opened.

## 8. Scripts and guards fail loudly

A guard that passes because it did not run is the worst outcome available,
because it reports success.

- `scripts/test-migrations.sh` silently stopped running its last two thirds
  for two phases. A deliberately-failing insert sat in a pipeline, so
  `set -e` with `pipefail` killed the script at that line; the only thing
  downstream was the line that printed "done", so nothing looked wrong.
- `scripts/test-migrations.sh` died at the last check in the file for two
  days. A deliberately-failing insert sat in a pipeline, so `set -euo
  pipefail` killed the script at that line; the only statement after it was
  the line that printed `== done ==`, so the output ended one line early and
  the non-zero exit went unread. Introduced 2026-10-21 and fixed
  2026-10-23. An earlier version of this bullet said it stopped running
  "its last two thirds", which is wrong: the block that sits downstream of
  that pipeline today was added by the same commit that fixed the bug.
  "Nothing looked wrong" was also too strong. Something did: a non-zero
  exit nobody read.
- **Open hazard, not a fixed one.** A substitution in
  `src/lib/anthropic.ts` fills the first occurrence of a placeholder with
  `String.prototype.replace`. `content/prompts/judge.v3.md` names
  `{{RUBRIC}}` twice, once in its own header comment and once as the real
  placeholder, and the whole file is sent to the model, so pointing the
  judge at v3 asks the model to score against a template. On `main` there
  is no guard. `fillPlaceholders` in `src/lib/judge/fill-placeholder.ts`
  throws on a second occurrence and exists on the unmerged branch
  `docs/phase2-fixtures`; `src/lib/anthropic.ts` is frozen, so landing it
  is Arthur's call, and until it lands this is a live hazard for anything
  that runs a non-default prompt version.
- A source guard matched school ids quoted inside comments
  (`withoutComments` in `tests/school-registry-guard.test.ts`, which has its
  own regression test for a school id inside a comment). A different guard
  matched a function call to the first closing paren rather than the
  balanced one (`stripCalls` in `tests/motion-text.test.ts`, where a naive
  `[^)]*` stopped at the `)` of an inner `.get(...)`).

**Proving a guard works means breaking the code on purpose and watching it
fail.** A new guard is reviewed with the demonstration, not with the
assertion that it would catch the case.

One guard cannot be demonstrated by a sandboxed reviewer:
`scripts/test-migrations.sh` wants a local Postgres 16 on port 55432. Say so
rather than reporting it as unchecked, and review it by reading it.

## 9. Nothing user-facing changes unless the phase says so

A step's scope is what the brief for that step says. A change to visible
text, layout, colour, copy or route behaviour that the brief did not ask
for is out of scope even when it is an improvement.

The check for a step that should change nothing visible: build both
branches, normalise the build id and the chunk hashes, and compare the
visible text and markup of every prerendered page under
`.next/server/app/`. Report the pages that differ and why, or report that
none do.

That needs `node_modules` and two builds, which a sandboxed reviewer may
not have. When it cannot be run, say so, then name every route whose inputs
the diff touches and read those routes instead. An unrunnable check
reported as unchecked is a result; reported as passed it is a lie.

A migration that gates a deploy is in this rule too. Phase 2D nearly
shipped a widened view as a production DDL change the deploy depended on,
with two pages returning 404 until it was applied. The column was read with
the admin client instead, and the view change became a Phase 3 item.

## 10. The production database is untouched without Arthur's yes

No migration, no DDL, no write to a production table without Arthur saying
yes to that specific change. Reading is fine. The Supabase project is on
the free plan: **no branches and no restorable backups**, so there is no
undo to fall back on.

Before an approved production change: a snapshot of the affected rows, the
lock mode and expected duration per statement, and a tested rollback. All
three go in the pull request body, and the rollback is tested on local
Postgres, not reasoned about.

Migrations do not open their own transaction. The Supabase runner wraps the
file, so an inner `commit` ends the runner's transaction early; by hand it
is `psql --single-transaction`. Each migration says so in its own header.

Grepping for it needs care, and a reviewer has already been tripped by it:
`grep -niE '^[[:space:]]*(begin|commit)' supabase/migrations/*.sql` hits
`0015_debates_motion_text.sql` and both rollback files, and every hit is the
`begin` of a `do $$ ... end $$;` PL/pgSQL block, not transaction control.
Read each hit before calling it a breach.

## 11. Money is not spent without Arthur's yes

Any run that bills an API, and any change to a cost cap, a rate limit, a
model, or a budget, is Arthur's call. A report that proposes a run states
the call count and the cost arithmetic, and names the cap it is measured
against.

Where the numbers live, so the arithmetic is checkable: the COST comment at
the top of `src/lib/anthropic.ts` carries the model, the per-call estimate,
the token estimates and the daily cap, and `INPUT_COST_PER_TOKEN` and
`OUTPUT_COST_PER_TOKEN` are just below it. The monthly budget is
`AI_MONTHLY_BUDGET_USD`, enforced by `isBudgetExceeded()`. Multiply cases by
samples for the call count, and calls by the per-call estimate for the
figure; both appear in a proposal or it is not one.

## 12. Philosophy and content judgements are Arthur's

Not the reviewer's and not the implementer's. School criteria, fixture
bands, school text, and which tradition says what are all his. They are
batched into one decision list per phase, with the file each one lives in,
rather than raised one at a time.

A reviewer who disagrees with a philosophical claim says so as a finding
for the decision list. It does not block the step.

The list is one per phase, in the pull request that carries the work, with
the file each item lives in named beside it. A step whose only blocker is an
(e) item is finished up to that point, pushed, reviewed, and left open with
the list, rather than held back entire.

## 13. The merge is the agent's, and it is confirmed

The last step of the loop needs a standard too, since the reviewer is handed
this file and nothing else.

Arthur merges nothing. The agent that opened a pull request merges it once
the gates are green and the review findings are fixed or answered, and then
confirms two things rather than assuming them:

- the merge commit on `main`, against `git ls-remote origin main`;
- the production deployment, which must read **Ready**.

A report that says a change is live says which SHA and quotes the deploy
state. `main` is production and a merge into it is a deploy, so an
unconfirmed merge is an unconfirmed deploy.
