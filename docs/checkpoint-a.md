# Checkpoint A

The brief of 2026-11-03 ends Phase 3.0's first run of work here: one
document, one message, then stop. This is the document. Every item below
is Arthur's to decide. Each names the file it lives in, so a decision can
be made without hunting. Nothing here is decided by being written down.

What shipped to get here is in `docs/progress.md`; why, in
`docs/decisions.md`.

## 0. Waiting on Arthur already (sent under STOP NOW, 2026-11-03)

**Write permissions the site never uses.** Some tables accept writes,
from signed-in users or from anyone, that the site itself only ever makes
through its server key. The tables, what each allows, and the evidence
were sent to Arthur on 2026-11-03 under STOP NOW. They are left out of
this file, because the repository is public and the holes are not yet
closed.

Found since, and part of the same fix: production runs Postgres 17, and
anon and authenticated hold its eighth privilege, `MAINTAIN`, on all four
public views, which 0016 did not revoke. On a view it allows LOCK TABLE,
which locks the tables the view reads, so a holder could stop reads and
writes of `debates`. It is not reachable today: anon and authenticated
cannot log in, the Data API never locks, and no function in `public`
runs dynamic SQL (`docs/seed-snapshots/2026-11-04-view-acls-and-roles.json`).

Proposed: one migration revoking what the site does not use, MAINTAIN
included, tested locally as 0016 was. It changes no stored data. **Needs:
"yes, the grants fix".** Details: the message of 2026-11-03, and
`docs/decisions.md`, "Phase 3 item: move `motion_text` into
`debates_public`".

## Stage 1 (2F): the result, and two questions

Three v3 runs at three samples, the last on `main` after the objection
voices. `docs/decisions.md`, "2F, the rerun after the objection voices",
has every figure and quotation.

| Pass test | Run 1 | Run 2 | Run 3 (voices) |
| --- | --- | --- | --- |
| verdict_line failures after retries | 0 | 1 | 0 |
| `stoic-analogy` in band | yes | yes | yes |
| `confucian-hierarchy` in band | no (engagement 5) | yes | yes |
| `confucian-hierarchy-school` in band | no (86, eng 7) | no (78, eng 5) | no (80, eng 5) |
| power question in `unanswered_objection`, on my reading | never | never | 3 of 3 on `confucian-hierarchy`; on `-school`, 1 clear, 1 borderline, 1 not |
| original six in band | yes | yes | yes |

Eval key spend: $5.7934 of the $8.00 cap. No further run is planned.

1. **The band for `confucian-hierarchy-school`** (score 40-75, engagement
   0-4, `tests/judge/golden/confucian-hierarchy-school.json`). It is out
   in all three runs. The brief says never widen a band to fit a result,
   so this is yours: keep the band and treat it as a judge problem, or
   decide the fixture argument earns more than the band allows.
2. **The judge does not apply the engagement cap reliably.** On that case,
   sample 1 returns the power objection as unanswered, and sample 2
   arguably does; both score engagement 5, where the v3 criterion says no
   more than 4. On `confucian-hierarchy` it holds. A stronger instruction
   is a change to what the judge receives, (b).
3. **Whether the power question is met.** Which of these objections count
   as naming it is a judgement, mine above and Arthur's to confirm; the
   decisions entry quotes each one.

## Spending, rate limits and budget: (d)

1. **A per-reader ceiling on judge calls.** Since #52, a submission that
   ends without a verdict does not use one of the reader's five
   arguments. An argument whose replies always fail validation can
   therefore be resent at up to three calls a time. A second, higher daily
   ceiling on calls per reader would close it. `docs/decisions.md`, "Two
   retries, and a failed submission does not use an argument".
2. **The monthly budget does not hold as written.** `src/lib/budget.ts`
   sums `cost_usd` over a select with no range, so it adds up at most one
   response's rows (Supabase's default is 1000), and it reads a query
   error as zero spend. Production holds one `ai_calls` row, so nothing is
   at risk yet. Proposed patch: sum in the database and fail closed. Same
   entry.
3. **A retried submission that succeeds uses two or three of the five.**
   `docs/decisions.md`, "Open pre-pilot item: the daily cap counts calls,
   not judged debates".
4. **Backups.** "Open pre-pilot item: there is no restorable backup": a Pro
   upgrade, or a scheduled export.
5. **Leaked-password protection** needs the Pro plan. The site asks for no
   password, so it matters only if password sign-up is reachable through
   the Auth API, which has not been checked. "For Checkpoint A, from the
   security work".

## What the judge receives: (b)

1. **The v3 engagement cap of 4.** "Check first" rests on Arthur's ruling
   on the 3 Nov run, which asked that engagement check whether the
   argument meets the objection; the number is mine, the top of the 0-4 engagement band in all three
   fixtures that have one. `content/prompts/judge.v3.md`, and
   `docs/decisions.md`, "2F, Stage 1 of the brief of 2026-11-03".
2. **The head comment of `judge.v3.md` reaches the model.** It still holds
   one golden statistic from 2026-10-26 ("5 of 72"). Keeping the comment
   from the model means changing how `src/lib/anthropic.ts` reads the file.

## Content and philosophy: (e)

### The objection voices (v3)

Under Arthur's ruling, each school's v3 criteria name the rival that
normally voices its best-known objection. Confucianism's two are his
words; the other five are drafted from the school pages and are his to
confirm. `src/lib/judge/objection-voices.ts`, with the table in
`docs/decisions.md`, "Arthur's rulings of 2026-11-03 on the Stage 1 miss".

Two are weak:

- **Utilitarianism's**, voiced by Virtue Ethics. Its own page gives this
  objection to Rawls, who is no school here.
- **Buddhist Ethics'**, voiced by Utilitarianism. No page gives the
  "little systematic moral philosophy" objection to Utilitarianism, and the
  Buddhist page gives Utilitarianism a different objection, about
  intention excusing a well-meaning system. That is what
  `buddhist-intention-excuse` tests.

The other three match their pages: Stoicism and Virtue Ethics are voiced
by Utilitarianism, and Ubuntu by Stoicism. In the rerun the Buddhist risk
showed once: two of `buddhist-intention-excuse`'s three objections still
target intention, as all six did in runs 1 and 2, but sample 1 is the
systematic-theory gap, close to the voice's own wording ("compassion
alone gives no way to make that comparison").

### Quiz v2 (#53, `docs/quiz-v2.md`, section 7)

Nothing is built. The draft asks for:

1. The two axes and their plain names.
2. The six positions, especially Buddhist Ethics' and Ubuntu's.
3. The ten questions and forty options: the five flagged as possibly too
   nice, the three groups flagged as possibly underselling their school, and
   the two redrafted after review (3b, 8c).
4. Weighted options (16.2% to 17.7% per school) or equal ones (10.9% to
   23.0%).
5. The share lines on all six school pages say "Ten questions about AI".
   One of v2's questions is about AI, so they would need rewording if v2
   ships as drafted: `content/schools/*.md` (`share_lines`), and the same
   framing in `src/app/layout.tsx`, `src/components/share/SharePage.tsx`
   and `src/components/share/ChallengeInvite.tsx`.
6. Whether none of the six is a rule-based ethics, which the axes rest on:
   the draft calls this "my reading and not certain".
7. Ubuntu's alternatives: Menkiti's reading would move it towards role.
   The Ubuntu page places Gyekye between Metz and Menkiti, which points the
   same way, but its gloss on him points towards the individual end.

### Colours for the three draft schools (#55, branch `phase3-styleguide`, `/styleguide/phase3`)

`scripts/colour-candidates.mjs` searched for colours that:
- carry white hero text at AA;
- show as a dot on paper;
- stay apart from the live three in normal vision and under simulated
  deuteranopia and protanopia;
- avoid each school's stereotyped hues.

**Nearly everything that survived is indigo to plum.** Of the 1,056
colours that pass every test but the per-school hue exclusions, all but
four have a hue between 250 and 335; the four others, three dark teals
and a brown, are not among those offered. So the three new schools would
all be violets, told apart by lightness and chroma more than hue. The
recommended set is confucian `#705bbe`, ubuntu `#5f4d7e` and buddhist
`#411b7b`. At their closest the three are 11.4 apart (CIEDE2000, across
normal vision and both simulations), below the 12 the script requires
between any candidate and the live three under simulated colour
blindness. Each candidate has a card surface on which the card's text
reads at AA; only Confucianism's had to be darkened to get there.
Candidates, figures and screenshots are in `docs/phase3-styleguide/`.

The choice is Arthur's: one of these, or loosen a constraint.

## Security design, no change made

1. **Three `security_definer_view` errors** from the advisor
   (`debates_public`, `exchanges_public`, `public_results`). Closing them is
   a redesign: `security_invoker` views and row level security doing the
   hiding. "For Checkpoint A, from the security work".
2. **`is_class_member` and `is_class_owner`** are callable by any signed-in
   user. The class policies call them, so a revoke would break class pages;
   moving them out of the API schema is the usual fix. Same entry.
3. **`elo_percentile`** has a mutable `search_path` (advisor warning).
   `supabase/migrations/0006_elo_percentile.sql`.
4. **`exchanges_public`** is readable and unused. It was kept because it
   is meant to be public and exposes nothing private; whether to keep it
   is Arthur's. "For Checkpoint A, from the security work".
5. **The 0018 shape.** For a private argument, withheld verdict fields are
   left out of the public verdict rather than set to null.
   `supabase/migrations/0018_debates_public_private_verdict_text.sql`.

## Housekeeping

- **`backup_20261022` still exists** (4 relations when last read, on
  2026-11-04). Arthur's ruling said the drop was done on retry, but it had
  not gone through. It was retried on 2026-11-04; the database tool asked
  Arthur to confirm, and no answer came in time. It needs his approval of
  that prompt, then a read-back. `docs/progress.md` logs both. `docs/decisions.md`, "Open item: drop `backup_20261022`
  after 2026-10-29".
- **The brief and the repo disagree on one small thing.** The brief asks
  for "a neutral nav icon for School table (the triangle no longer means
  anything)", but the site header's links have no icons, triangle or
  otherwise. The preview offers icons that would be added, not swapped
  (`src/components/phase3/NavIcons.tsx`).
