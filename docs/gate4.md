# Gate 4

Written on 2026-11-06, after the full v3 run, Gate 3 and the new-schools
run, as Arthur's ruling of that day ordered: "full v3 run, then Gate 3
and the new-schools run, then Gate 4." Gate 4 is the launch of the six
schools; at Checkpoint B he said "not yet. Bring me Gate 4 once the golden
runs pass." Every open item below is his to decide, except the list
under Housekeeping, which is mine. Each names the file it lives in.
Nothing here is decided by being written down.

What shipped is in `docs/progress.md`; why, in `docs/decisions.md`; the
plan and the launch checklist, in `docs/stage5-plan.md` ("Gate 4
checklist").

## Where things stand

- **Judge v3 (#90).** The 4 Nov head comment is sent again, by his
  reversal of ruling 12. The full run of 16:58 UTC passes 23 of 25 cases
  (`docs/decisions.md`, "Judge v3: the head comment sent again").
- **Gate 3 (#97).** A SIX_SCHOOLS build judges all six: v3, the six as
  rivals, the three's approved criteria from the draft file. A build
  without the flag, production included, sends what it sent
  (`docs/decisions.md`, "Gate 3: the three judged on SIX_SCHOOLS
  builds").
- **The new-schools run (18:14 UTC).** As a flag-on build would judge,
  all 25 cases: 23 of 25 in every band; on the objection, 16 or 23 of 25
  depending on item 3 below.
- **Eval key:** $12.2431 of the $15.00 cap, over 18 run files.
- **Stage 5.** Steps 1 to 4 are done on flag-on builds. Of step 5,
  "debating as a new school", the judge is done; the arena already pairs
  any two of the six (migration 0014); the micro-lessons are per topic,
  not per school; the topics' stances are the open item 9 below.
- **Production** shows and judges the three published schools exactly as
  before. Nothing promotes a flag-on preview to Production.
- **The navigation restructure** you asked for on 2026-11-06 is next; its
  copy goes into `docs/daily-path-copy.md` first, and the screenshots of
  both menus, signed out and signed in, at 390 and 1280 pixels, will be
  added here when it is built.

## Do the golden runs pass? (b)

The checklist's first item is "The golden runs pass (the condition for
bringing Gate 4)". Both runs pass all but two cases, the same two.

1. **`confucian-hierarchy-school`**, your held-out case: roles argued
   faithfully in a school timetable, the power of teacher over pupil left
   unmet, which should hold engagement to 4. It fails in every run that
   sent the 4 Nov comment: 82/83/83 at 16:58 against a band of 40-75,
   engagement 5/6/6 against 0-4; 78/80/78 in the new-schools run, its
   engagement then 4/5/4, in band. It was in band in the three runs that
   sent no comment (22:08 on 5 Nov, 00:01 and 01:06 on 6 Nov), when the
   strong cases fell out of band. No prompt tried has had both. Accept it
   as a known miss, or rule how to trade it against the strong cases.
   `tests/judge/golden/confucian-hierarchy-school.json`,
   `content/prompts/judge.v3.md`.
2. **`stoic-analogy`'s fidelity.** 7/7/7 at 16:58 and 7/8/7 at 18:14,
   against 8-10; its score in band both times. It passed on 4 Nov (8/7/8).
   The one difference in body from the 4 Nov prompt is the paragraph
   crediting the concept over the vocabulary, kept because the 06:05
   check that passed had it; your ruling's "if in doubt, drop the moved
   section" would also cover dropping it, at about $1.17 for another full
   run. Accept, or drop it and rerun (d). `content/prompts/judge.v3.md`.
3. **Which objections count on a flag-on run.** Each golden fixture's
   expected objection schools were written for three rivals. On a
   flag-on build the prompt names, from the approved voices in
   `src/lib/judge/objection-voices.ts`, `ubuntu` for Stoicism,
   Utilitarianism and Confucianism and `confucian` for Buddhist Ethics,
   and the judge follows them: 72 of the 75 objections in the
   new-schools run were a voice the prompt named. On the fixtures' sets
   16 of 25 cases pass outright; counting the named voices, 23 of 25.
   **I would count them**: the prompt tells the judge to use them, and
   the voices are yours. If so, the fixtures' sets are widened in
   `tests/judge/golden/*.json` to match, at no cost.

## What the judge receives at launch (b)

4. **Production judges with v3.** A flag-on build judges with v3, because
   v2 names the three published schools in its prose and asks for an
   objection from "the two schools the argument was not assigned", so it
   cannot judge a new school or name six rivals. So turning the flag on
   for Production moves every school's judging from v2 to v3. This was my
   reading of Gate 3, not a ruling. `src/lib/judge/schema.ts`.
5. **Verdicts already stored under v2.** After launch a revision of a v2
   original is judged under v3; the verdict page shows the revision's
   score change from the original, and the `revision_judged` event
   records it, so both would compare across versions, and Elo and a
   topic's par would take v3 scores beside v2 ones. The 3 Nov comparison
   found v3 scoring the strong cases 3 to 13 points higher, and the rule
   in `docs/decisions.md` is that scores across versions are not compared
   as equivalent. Options: (i) accept it; (ii) show no score change when
   the two verdicts' versions differ, and leave Elo and par as they are;
   (iii) something else you rule. **I would take (ii).**
   `src/app/api/judge/route.ts`, `src/components/debate/Verdict.tsx`.
6. **The three's criteria at publishing.** Your ruling of 2026-10-24 keeps
   them in the draft file "until he publishes those schools". The
   flag-on loader reads only schools that are shown and not published, so
   the launch merge must move them into `src/lib/judge/rubric.ts` with
   the same text, or the judge would refuse the three once they are
   published. The flag-on request fixtures
   (`tests/judge-request/six-schools/`) pin that text, so the move can be
   shown to change nothing the judge receives. This needs your yes as
   part of the launch.
7. **Statements in frozen files that become untrue at launch.** All are
   sent to the judge or describe what it is sent; each is yours to
   change:
   - `content/prompts/judge.v3.md`, the head comment, sent as written:
     "is not the production default" and "a draft to run the golden set
     against"; that the vocabulary paragraph "lives with the criteria,
     not in this file" (the body carries one); and it names `fillOnce`,
     which `src/` no longer has.
   - `content/prompts/fidelity-criteria.draft.md`, its header: "NOT
     LOADED BY ANYTHING IN PRODUCTION", that `hasFidelityCriteria`
     returns false for the three, and "One thing reads this file: the
     golden runner".

## Content and philosophy: (e)

8. **The v2 copy.** Every piece of text a reader sees only with quiz v2
   and the six schools on, beside what a reader sees now, with lines
   already ruled marked. Read and rule. `docs/stage5-plan.md`, "The v2
   copy, for the Gate 4 pack". Two lines in it I would point to:
   - Utilitarianism's share line [1] cites v1's self-driving-car
     question, which v2 does not ask (`content/schools/utilitarianism.md`).
   - On `/r/<id>`, the map's description for screen readers says "where
     you stand" to a reader looking at someone else's answers, while the
     title there says "them" (`src/components/phase3/SchoolMap.tsx`).
9. **The debate topics' stances for the three.** Each of the six topics
   gives a one-sentence stance for the three published schools only. A reader
   placed in one of the three sees the motion without "Your stance"; the
   list hides the line rather than breaking. Write stances for the three,
   or launch without them. `content/topics/*.md`.
10. **`/debate/rubric`** says "These are the criteria the judge is given
    for each school, in full", and shows `rubric.ts`'s v2 text for the
    published three. On a flag-on build, and so at launch, the judge is
    given v3's text, for six. Change the page's claim, or the page.
    `src/app/debate/rubric/page.tsx`.
11. **A floor for exemplars.** On the full dataset none of the 72 chosen
    is one the sample run wrote to be weak; on the canary's rows alone, 4
    of 70 and 6 of 40 were, marked 28 to 36. A floor on the template mark
    would leave a position out rather than show a weak argument for it.
    `src/lib/exemplars.ts`; `docs/decisions.md`, the exemplars entry.
12. **The content judgements listed for Checkpoint B and the adherent
    nouns,** as the checklist names them (`docs/quiz-v2.md`, section 8;
    `docs/decisions.md`).
13. **The navigation's copy and screenshots**, to follow in this file
    (`docs/daily-path-copy.md`).

## Publishing: (c)

14. **The launch itself, on your instruction only,** and the rest of the
    checklist in `docs/stage5-plan.md`: the sample teardown; the flag on
    for Production with `next.config.ts`'s refusal removed; the three
    content files' status and colour tokens; the share lines and other
    front matter in the launch merge; `README.md`; the "until launch"
    rules of steps 3 and 4 lifted; a fresh sample run.

## Production database writes: (a)

15. **Clearing the preview's v2 results before the launch merge**, as the
    checklist sets out: `challenge_from` set to null where a genuine row
    points at one, a real reader's challenge with a v2 challengee reopened
    rather than deleted, and `debates.challenge_id` set to null where it
    points at a cleared challenge. The SQL comes to you for the SQL
    Editor.

## Still waiting on you from before

- Supabase Auth's Site URL and redirect list, and the Vercel redirect
  from `www.sophecs.com` to `sophecs.com`.

## Housekeeping

Mine, and not waiting on anyone:

- The navigation restructure, behind SIX_SCHOOLS, with its copy in
  `docs/daily-path-copy.md` first and the screenshots added here.
- The re-screening job's log is read inside the hour after its 05:43 UTC
  firing on 2026-11-07, since the Hobby plan keeps runtime logs for an
  hour.
