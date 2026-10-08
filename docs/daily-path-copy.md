# Daily path: content and copy

Arthur's answers to `docs/daily-path-plan.md`, plus every piece of text the
restyle needs. Written so no stage has to invent a word. Where the mockup has
a placeholder (`[AXIS 2]`, `Week [N] closes [DAY]`, "Illustrative path"),
the replacement is below. Copy in `code` style is final; text in braces is
filled in at runtime.

General rules for all of it: no emoji, no exclamation marks, numbers in
IBM Plex Mono, philosophy in Spectral. Right and wrong are never shown by
colour alone, and never in green: the only green in the product is Stoic
(`design/tokens.md` §7).

## 1. Decisions on the plan's questions

| Q | Decision |
|---|---|
| Q1 reading check | **Build the graded check as drawn.** The question bank is written and lives in `content/micro/*-before.md` as `reading_check` (see §2). The free-text retrieval prompts stay exactly as they are. |
| Q2 judging paused | **(a) Show the real state.** Locks read the same `KILL_SWITCH_JUDGE` + allowlist check the judge uses, so they lift on their own when judging resumes. Allowlisted users see the full path now. |
| Q3 six steps | Mapping in §3. It no longer needs a client-only "opened" flag for node 1. |
| Q4 streak | Real streak only. The reading celebration never lights the flame. `streak.ts` unchanged. |
| Q5 axes | Three rows: Fidelity, Rigor, Engagement. No fourth. Copy in §6. |
| Q6 school table | **(a) Build it read-only, as the last stage.** No names. Copy in §8. |
| Q7 profile chart | Go. Empty state, not a flat line. Copy in §9. |
| Q8 Today | **(a) `/today`.** `/` stays static. |

## 2. "Check your reading"

### Where the questions live

Each of the six before-lessons now carries two questions under
`reading_check`. Every existing line of those files is unchanged; the block
is appended. Shape (typed as `ReadingCheckQuestion` in
`src/lib/lesson-chunks.ts`, validated at build time, tested in
`tests/reading-check.test.ts`):

```yaml
reading_check:
  - question: >-
      ...
    options:        # exactly 3, each at most 100 characters
      - >-
        ...
    answer: 0       # 0-based index of the right option
    right: >-       # shown under "Exactly."
      ...
    wrong: >-       # shown under "Not quite.", whichever wrong option was picked
      ...
```

Render options in file order. The right answers are already spread across
positions (four each at 1st, 2nd and 3rd), so do not shuffle.

### Where it sits in the flow

After the whole passage, after both typed notes, before `Begin`. The typed
notes stay the "Read the case" step and keep being quoted back above the
editor. The check is a separate, second step. This is why steps 1 and 2 are
now different signals.

### Where results are stored

Nowhere on the server. The score is computed in the browser with
`readingCheckScore` and shown on the celebration. Completion of step 2 is
kept in `localStorage` under `check:${userId}:${topicSlug}` (user-scoped,
like the reading drafts), holding the picks. No migration, no change to
`reading_responses`. Cost: step 2 does not follow a reader across devices.
If that matters later, it is one small table; not now.

The check gates nothing. A reader who gets both wrong can still argue.

### Interface copy

| Element | Copy |
|---|---|
| Step heading | `Check your reading` |
| Progress label | `Question {n} of 2` |
| Submit button (disabled until an option is picked) | `Check` |
| Sheet heading, right | `Exactly.` |
| Sheet heading, wrong | `Not quite.` |
| Sheet body | the question's `right` or `wrong` text |
| Sheet button, question 1 | `Next question` |
| Sheet button, question 2 | `See how you did` |
| Wrong answer, extra line under the body | `The right answer: {correct option}` |

Screen reader: the sheet is announced with its heading, so the result is
never colour or icon alone.

### Celebration

| Element | Copy |
|---|---|
| Heading, 2 right | `Both right.` |
| Heading, 1 right | `One of two.` |
| Heading, 0 right | `Worth another read.` |
| Tile 1 | `{score}/2` with label `Reading check` |
| Tile 2 | `{n}/2` with label `Notes written` |
| Line under tiles | `Your notes will be waiting above the editor.` |
| Button | `Argue the motion` |
| Secondary link, 0 or 1 right | `Read the passage again` |

No streak tile and no flame on this screen.

## 3. The six steps

| Node | Label | Done when | Source |
|---|---|---|---|
| 1 | `Read the case` | both typed notes saved | `state.read` (server) |
| 2 | `Check your reading` | both questions answered | `localStorage` (§2) |
| 3 | `Argue the motion` | original argument judged | `state.argued` |
| 4 | `Face an objection` | same as 3; the objection arrives with the verdict | `state.argued` |
| 5 | `Revise once` | revision judged | `state.answered` |
| 6 | `Case closed` | same as 5 | `state.closed` |

Node 6 is renamed from "Verdict" because a reader already sees a verdict at
step 3; what step 6 marks is the case closing. Nodes 3 and 4 complete
together, and so do 5 and 6. That is honest: one judged argument produces
both the verdict and the objection. Mockup 05's `Steps 4–5 of 6` heading
stays.

One line under each node (the mockup's small caption):

1. `The passage, and two notes in your own words`
2. `Two questions on what you just read`
3. `Argue from your school. A judge scores it.`
4. `The judge names the objection you left standing`
5. `Answer it. One revision, no effect on your rating.`
6. `Your before and after, side by side`

Node states, as text for screen readers and the bobbing label:

- current: `Up next`
- done: `Done`
- locked by order: `After step {n}`
- locked by judging: `Waiting for judging`

## 4. Today (`/today`)

| Element | Copy |
|---|---|
| Page heading | `Today` |
| Case eyebrow | `This week's motion` |
| Case title | the motion's title from `content/topics` |
| Primary button | `Continue` (or `Start` if nothing is done) |
| All six done | heading `Case closed.`, line `Next week's motion opens on Monday.`, link `Argue another motion` → `/debate` |

### Judging paused (steps 3–6 locked for non-allowlisted readers)

Shown once, under node 2, not on every locked node:

- Title: `Judging is paused.`
- Body: `Judging is paused while we check the quality of the verdicts. You can read the case and check your reading now. The last four steps open when judging resumes.`
- Links: `How the judge works` → `/method`, `Read the lessons` → `/lessons`

The first sentence is the one already on `/debate` and in the editor, word
for word.

## 5. Today sidebar cards

### Streak card

| State | Number | Line |
|---|---|---|
| judging paused, not allowlisted | hide the number | `Streaks start when judging opens. A day counts when you have an argument judged 40 or more.` |
| 0 | `0` | `Days in a row with a judged argument scoring 40 or more. Nothing happens when it breaks.` |
| 1 | `1` | `Day in a row with a judged argument scoring 40 or more. Resets at midnight UTC.` |
| 2+ | `{n}` | `Days in a row with a judged argument scoring 40 or more. Resets at midnight UTC.` |

Rows 2 to 4 are the existing `StreakBlock` wording; reuse it, do not copy it.

### School card

- Eyebrow: `Your school`
- Name: the school name
- Line: the school's `one_line` from `content/schools/`
- Link: `See the school table` → school table

### Lessons card

- Eyebrow: `Lessons`
- Line: `A longer reading for each school, and twelve short passages: one before and one after each motion.`
- Link: `Open the lessons` → `/lessons`

## 6. Verdict and argue: the three axes

Replace `Fidelity to your school`, `[AXIS 2]`, `[AXIS 3]`, `[AXIS 4]` with
three rows. Scores are 0–10, in mono. The composite score out of 100 stays
as the large circle. Descriptions paraphrase `content/prompts/judge.v2.md`;
they do not change it.

| Row | Label | Description (argue screen, and verdict tooltip) |
|---|---|---|
| 1 | `Fidelity to your school` | `Does it reason the way your school reasons, from its own commitments? This counts most.` |
| 2 | `Rigor` | `Clear claims, real support, no unearned leaps.` |
| 3 | `Engagement` | `Does it meet the strongest objection a rival school would raise?` |

Argue screen panel heading: `What the judge looks for`. Link under it:
`Read the full rubric` → `/debate/rubric`.

## 7. Objection and revise (mockup 05)

| Element | Copy |
|---|---|
| Eyebrow | `Steps 4–5 of 6` |
| Heading | `The objection you left standing` |
| Speaker line | `Raised by {rival school}` |
| Lead-in to editor | `Answer it in a revision. You get one, and it does not move your rating.` |
| Submit | `Submit revision` (unchanged from Phase 3) |

## 8. School table

| Element | Copy |
|---|---|
| Nav label | `School table` |
| Heading | `School table` |
| Week line | `Week {N} · closes Sunday, midnight UTC` |
| Intro | `How each school argued this week. Fidelity is the judge's 0–10 mark for arguing the way the school reasons, averaged across every judged argument.` |
| Columns | `Rank` · `School` · `Avg fidelity` · `Arguments` · `Joined / left` |
| Joined / left cell | `+{in} / −{out}`; screen reader: `{in} joined, {out} left this week` |
| Your line, has argued | `You argued {n} times for {school} this week.` (`once` when 1) |
| Your line, has not | `You haven't argued for {school} this week yet.` |
| Footnote | `Joined and left count people who retook the quiz and changed school. No names are shown, here or anywhere else.` |
| Empty week | `No judged arguments yet this week. The table fills in as they arrive.` |
| Judging paused | the empty-week line, then `Judging is paused while we check the quality of the verdicts.` |

Ties share a rank. Rank is by average fidelity, then by number of arguments.
Week is the ISO week, the same one the weekly motion uses.

## 9. Profile chart

Replaces the mockup's "Illustrative path".

| Element | Copy |
|---|---|
| Heading | `Where you stand, week by week` |
| Y axis | `Rating` |
| X axis | `Week` |
| Empty | `Your rating appears here after your first judged argument.` |
| One point | show the point, with `One week so far.` |

## 10. Not changed

`content/topics/`, `content/schools/`, the after-lessons, the retrieval
prompts, the judge prompts, the schema, `streak.ts`, `elo.ts`, the kill
switch, the share card and the footer privacy copy.
