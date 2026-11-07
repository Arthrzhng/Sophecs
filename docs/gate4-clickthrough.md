# Gate 4: the ten-minute click-through

For Arthur, on a phone, before the word "launch" (Gate 4 item 15: "when
8-13 are done, send me the flag-on preview link and the 10-minute phone
click-through. Launch only on my explicit 'launch'").

The preview is a SIX_SCHOOLS build of `main` with everything from items 8
to 13 in it. It shows what production will show once the launch merge
turns the flag on, apart from what the launch merge itself changes (at
the end). If Vercel asks you to sign in first, use the account that owns
the project.

## Before you start

The preview shares production's database but not its judge
(`docs/stage5-plan.md`, "What a preview can reach"). So:

- **A quiz you finish writes a quiz v2 result to production.** Item 16's
  SQL clears the preview's v2 results before the launch merge
  (`docs/stage5-plan.md`, step 6), so this is expected.
- **Nothing is judged.** The judge's key, budget and kill switch are set
  for Production only, so an argument submitted on the preview is told
  judging is paused, and nothing is written or billed. Production judges
  with v3, as you ruled; the flag-on judge was tested in the new-schools
  run of 2026-11-06.
- **Sign-in** sends its link back to the address you signed in from. It
  reaches the preview only if Supabase's redirect list allows preview
  addresses, which is still open with you (Supabase's Site URL and
  redirect list). If the link opens sophecs.com instead, skip steps 6
  and 7.

## The steps

1. **The landing page** (1 minute). It says a short quiz places you in
   one of six schools of ethics. Question one is live beside the map;
   answering it moves the dot.
2. **The quiz** (3 minutes). Ten questions, the dot moving across the map
   with each answer. Finish. The result names your school, shows where
   your answers put you on the map, and offers a share line. A school
   has three share lines and the result picks one; Utilitarianism's
   second is the new one from item 8.
3. **Your school's page** (1 minute). From the result, or open
   `/s/ubuntu`. Its quotation and source, the school's read, what it gets
   wrong, then the other five.
4. **`/schools`** (1 minute). All six, each linking to its page, and
   under them the school table (`/table` redirects here on this build).
   Six rows. Until the fresh sample run, sample arguments are the live
   three's only, so the new three are unranked, each with "Ranked once it
   has 20 judged original arguments." and its count, 0 so far.
5. **`/how-it-works`** (1 minute). The method, then the rubric: each of
   the six schools' criteria exactly as the judge receives them, under
   the sentence that says they are published in full (item 10). Under
   "Known limitations" one line is out of date: "That is why judging is
   paused rather than running." Production judges. It is on your next
   list (`docs/gate4.md`), and production's `/method` shows it too.
6. **Sign in, then `/me`** (1 minute). Your quiz results, your arguments
   and any open exchanges. On the preview a quiz never moves an account's
   school, a rule the launch lifts (`docs/decisions.md`, "Stage 5, step
   4"), so your account keeps the school it has.
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
