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

## 2. The judge request fixtures are byte-identical

`tests/judge-request/` holds six fixtures: the exact request
`src/lib/anthropic.ts` sends for each live school, as an original and as a
revision. **Judging is live and no production verdict may change**, so a
diff in any of those six is a change to how a real student's argument would
be scored.

The check is `git diff --stat tests/judge-request/` against the merge base,
and the expected result is no output. A fixture may only move where Arthur
approved that specific change, and then the approval is quoted in the pull
request body.

Rewriting them takes `WRITE_JUDGE_FIXTURES=1`, which no npm script sets.
That is deliberate: a `vitest -u` must not be able to rewrite them, and
neither must a reviewer in a hurry.

## 3. No draft string reaches a client bundle

Phase 1B's guarantee is that no draft school reaches any page or any
bundle. `npm run check:bundle` greps `.next/static` for every draft
school's id, name and adherent noun, taking the strings from the registry
rather than from a list in the script.

This rule exists because a single registry that enumerated all six schools
put three unreleased school names into **thirteen** production client
chunks. The other four gates were green at the time, and the first answer
offered was that 450 bytes of client JavaScript was an acceptable trade.
The bytes were never the problem.

A review that touches the registry, a school map, or anything imported by a
client component checks the grep output, not the reasoning about why it
should be fine.

## 4. Quotations are verbatim from the research file

Every quotation in `content/**` comes from
`content/research/non-western-sources.md`, word for word, and every way the
content differs from the source is declared in `tests/content-quotations.ts`
so the guard checks it. Anything marked `UNVERIFIED` in the research file is
not used. A slot with no verified source gets `TODO-SOURCE` and a note to
Arthur, never a quotation from memory.

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

## 5. Claims in reports are verified, not asserted

Every factual claim in a pull request body or a report to Arthur says how
it was checked: **"I checked X by doing Y"**, with Y being a command, a
file read, or a test. A claim with no Y is a guess with a confident tone.

Three that got through before this rule existed:

- Three of six golden-set bands were wrong in `docs/phase2-fixtures.md`,
  generalised from the one fixture that had actually been read. The table
  is generated from the files now.
- A report said rewording a motion would change a debate's share text. The
  two real wordings are identical in their first 57 characters and the
  share text is 60, so it would not have. Found by comparing the strings.
- A claim about Supabase backup availability was going to be answered from
  memory. The free plan's actual terms came from Supabase's own
  documentation.

The same rule covers "the tests pass", "the deploy is Ready" and "the
fixtures are unchanged". Run it, then say it.

## 6. Test expectations match the thing they test

A test that asserts the opposite of what the code now does is worse than no
test: it passes review by being green, and it encodes a decision nobody
made.

Specifically:

- A test about a prompt reads the prompt. Two tests written in Phase 2E
  asserted that `anthropic.ts` contained no rival-schools substitution and
  that `judge.v3.md` named it in its header comment. Both became false the
  moment Arthur approved the substitution, and both had to be rewritten
  rather than deleted.
- An expected value that contradicts a rule the prompt states is a bug in
  the test. A JSON example was about to use `ASSIGNED_SCHOOL` as the value
  of a field the prompt says must never hold the assigned school.
- A band, a cap or a threshold in a document is checked against the file
  that implements it, not against the memory of writing it.

## 7. Scripts and guards fail loudly

A guard that passes because it did not run is the worst outcome available,
because it reports success.

- `scripts/test-migrations.sh` silently stopped running its last two thirds
  for two phases. A deliberately-failing insert sat in a pipeline, so
  `set -e` with `pipefail` killed the script at that line; the only thing
  downstream was the line that printed "done", so nothing looked wrong.
- A substitution in `anthropic.ts` filled the first occurrence of a
  placeholder, which was the mention of it in the prompt's own header
  comment, and left the real placeholder standing in the prompt. The model
  would have been asked to score against a template. The fix refuses a
  prompt that names a placeholder twice rather than guessing which one was
  meant.
- A source guard matched school ids quoted inside comments, and matched a
  function call to the first closing paren rather than the balanced one.

**Proving a guard works means breaking the code on purpose and watching it
fail.** A new guard is reviewed with the demonstration, not with the
assertion that it would catch the case.

## 8. Nothing user-facing changes unless the phase says so

A step's scope is what the brief for that step says. A change to visible
text, layout, colour, copy or route behaviour that the brief did not ask
for is out of scope even when it is an improvement.

The check for a step that should change nothing visible: build both
branches, normalise the build id and the chunk hashes, and compare the
visible text and markup of every prerendered page. Report the pages that
differ and why, or report that none do.

A migration that gates a deploy is in this rule too. Phase 2D nearly
shipped a widened view as a production DDL change the deploy depended on,
with two pages returning 404 until it was applied. The column was read with
the admin client instead, and the view change became a Phase 3 item.

## 9. The production database is untouched without Arthur's yes

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
is `psql --single-transaction`.

## 10. Money is not spent without Arthur's yes

Any run that bills an API, and any change to a cost cap, a rate limit, a
model, or a budget, is Arthur's call. A report that proposes a run states
the call count and the cost arithmetic, and names the cap it is measured
against.

## 11. Philosophy and content judgements are Arthur's

Not the reviewer's and not the implementer's. School criteria, fixture
bands, school text, and which tradition says what are all his. They are
batched into one decision list per phase, with the file each one lives in,
rather than raised one at a time.

A reviewer who disagrees with a philosophical claim says so as a finding
for the decision list. It does not block the step.
