# Gate 4: the ten-minute click-through

For Arthur, on a phone, before the word "launch" (Gate 4 item 15: "when
8-13 are done, send me the flag-on preview link and the 10-minute phone
click-through. Launch only on my explicit 'launch'").

**Open:**
<https://sophecs-git-gate4-progress-arthurrzhang-1874s-projects.vercel.app>

That is the preview of branch `gate4-progress` (#106): a SIX_SCHOOLS
build of `main` at `0920d67`, with everything from items 8 to 13 in it,
plus these docs. GitHub deletes the branch when #106 merges; the address
keeps working, as #105's does. The message that sent you this also gives
the fixed address of the deployment itself. It shows what production
will show once the launch merge turns the flag on, apart from what the
launch merge itself changes (at the end). Vercel
asks you to sign in first; use the account that owns the project.

## Before you start

The preview shares production's database but not its judge
(`docs/stage5-plan.md`, "What a preview can reach"). So:

- **A quiz you finish writes a quiz v2 result to production.** Item 16's
  SQL clears the preview's v2 results before the launch merge
  (`docs/stage5-plan.md`, step 6), so this is expected.
- **Do not share or challenge from the result.** Share and challenge
  links point at sophecs.com, which answers "Nothing here." for a v2
  result until the launch, and a challenge writes a challenge to
  production.
- **Do not reply in an open exchange.** A reply sent from the preview is
  saved to production and would reach a real reader once screened.
- **Nothing is judged.** The judge's key, budget and kill switch are set
  for Production only. If you submit an argument you will see "The judge
  could not be reached.", and below it "The spending limit could not be
  checked, so nothing was sent to the judge.": the budget check failing
  closed, as it should with no budget set, not a fault. Nothing is
  written or billed. Production judges with v2 until the launch merge
  turns the flag on, then with v3, as you ruled; the flag-on judge was
  tested in the new-schools run of 2026-11-06.
- **Sign-in** sends its link back to the address you signed in from,
  which Supabase's redirect list now allows for previews (set by you on
  2026-11-08). If the link opens sophecs.com instead, skip step 6 and
  the stance line in step 7. On a phone, "Continue with Google" is the
  surer way: an emailed link opened in a mail app's own browser lacks
  the sign-in it started from, and Vercel's.

## The steps

1. **The landing page** (1 minute). It says a short quiz places you in
   one of six schools of ethics. Question one is live, with the map of
   the six below it on a phone. Tapping an answer takes you straight
   into the quiz, at question two.
2. **The quiz** (3 minutes). The other nine questions, the map showing
   where your answers put you as you go. Finish. The result names your
   school, shows your point on the map, and offers a share line. A
   school has three share lines and the result picks one;
   Utilitarianism's second is the new one from item 8.
3. **Your school's page** (1 minute). From the result, or open
   `/s/ubuntu`. Its quotation and source, the school's read, what it gets
   wrong, then the other five.
4. **`/schools`** (1 minute). All six, each linking to its page, and
   under them the school table (`/table` redirects here on this build).
   Six rows. Until the fresh sample run, sample arguments are the live
   three's only, so the new three are unranked, each with "Ranked once it
   has 20 judged original arguments." and its count, 0 so far.
5. **`/how-it-works`** (1 minute). The method, then the rubric: each of
   the six schools' criteria, in full, exactly as the judge receives
   them, and below them the sentence that says they are published in
   full (item 10). Under "Known limitations" one line is out of date:
   "That is why judging is paused rather than running." Production
   judges. It is on your next list (`docs/gate4.md`), and production's
   `/method` shows it too.
6. **Sign in, then `/me`** (1 minute). Your account's school, any open
   objection and open exchanges, where you stand (rating, streak and
   chart), pending challenges, your last five arguments, and your display
   name. On the preview a quiz never moves an account's school, a rule
   the launch lifts (`docs/decisions.md`, "Stage 5, step 4"), so your
   account keeps the school it has.
7. **The motions** (1 minute). `/debate` lists them; signed in, each shows
   your school's stance on it. That is your account's school, so the new
   three's stances (item 9) are not shown here; they are in
   `content/topics/*.md`. A motion's exemplars link shows the live three's
   sample arguments; the new three's come with the fresh run.

## What the preview cannot show yet

These come with the launch merge or after it (`docs/stage5-plan.md`,
"Gate 4 checklist"):

- sample activity for the new three: the fresh run, after the sample
  teardown, made by the generator in #105; the samples you read first
  are in `docs/gate4-samples.md`;
- a verdict: the preview has no judge (above);
- the three content files' status and colour tokens, the share lines and
  other front matter in `docs/quiz-v2.md`, section 8, and `README.md`;
- the navigation's redirects made permanent (308);
- the new three's criteria moved into `src/lib/judge/rubric.ts`, the same
  text the preview's rubric page shows.
