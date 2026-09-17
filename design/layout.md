# Sophecs layout plan

Status: **proposed, awaiting approval.** Plan document; no code implements it.

Wireframes are at 1440px (rendered in a 960 or 720 container) and 360px.
`═` is a page edge, `─` a 1px `--border` hairline, `▓` the one saturated
surface.

---

## Alignment decisions, stated once and applied everywhere

- **Reading content is left-aligned. Never justified, never centred.**
  Ragged right at 66ch; justification in a browser produces rivers, and
  centred serif body is the strongest single signal of a generated page.
- **Headings are left-aligned**, including the landing h1. There is no
  centred text anywhere in the product except the 404 and the card's own
  internal composition.
- **Numbers right-align** in any column of numbers (arena ELO, verdict
  axes), and use `font-variant-numeric: tabular-nums`.
- **One action per screen carries primary weight.** Everything else is
  secondary or a text link.
- **Nothing is a card.** Sections are separated by a rule and space. The
  only bordered boxes are form controls and the one saturated result card.

---

## 1. Landing — `/`

The brief: a visitor starts the quiz within one screen height on mobile,
no hero illustration, no three-column feature grid.

**Decision: the landing page opens with quiz question 1, live.** Not a
description of the quiz, not a button to the quiz. The first question is a
real form; answering it navigates to `/quiz` at question 2 with the answer
carried. This is the strongest available reading of "open with the quiz
itself", it removes a click from the acquisition path, and it means the
first thing a visitor sees is the actual material rather than a claim
about it.

### Desktop (720 reading container)

```
═════════════════════════════════════════════════════════════════
  Sophecs                            Quiz   Debate   Lessons   Sign in
─────────────────────────────────────────────────────────────────

  Ten questions on how AI should decide things.          ← serif xl
  No account needed.                                        66ch

  1 of 10                                                ← sans xs, ink-soft

  A colleague takes credit for your work in a            ← serif lg
  meeting. Before you say anything, what do you
  check first?

  ┌───────────────────────────────────────────────┐
  │ Whether the outcome is even within my control.│     ← full-width rows
  └───────────────────────────────────────────────┘        radius-control
  ┌───────────────────────────────────────────────┐        surface + border
  │ Which response leaves the whole team best off.│
  └───────────────────────────────────────────────┘
  ┌───────────────────────────────────────────────┐
  │ What kind of person I want to be in this room.│
  └───────────────────────────────────────────────┘

─────────────────────────────────────────────────────────────────

  The three schools                                      ← serif lg

  Stoicism            Utilitarianism        Virtue Ethics
  "Of things some     "Actions are right    "We become just
   are in our power    in proportion as      by doing just
   and others are      they tend to          acts."
   not."               promote happiness."
  Epictetus,          J. S. Mill,           Aristotle,
  Enchiridion, ch. 1  Utilitarianism, ch. 2 Nic. Ethics II.1

─────────────────────────────────────────────────────────────────

  A motion you could argue                               ← serif lg

  Handing your daily choices to an AI assistant costs
  you something that matters, even when its choices are
  better than yours.
  Read the motion                                        ← text link

─────────────────────────────────────────────────────────────────
  FOOTER
═════════════════════════════════════════════════════════════════
```

The three schools are a 3-column grid, and I want to be explicit that this
is *not* the forbidden "three feature cards": they are three real quotations
with real citations, no borders, no icons, no headings-plus-blurb. It is a
table of contents, and the citation under each is what makes that legible.
At 360px it stacks.

### Mobile (360)

```
═══════════════════════════════════
 Sophecs                       ☰
───────────────────────────────────
 Ten questions on how AI
 should decide things.
 No account needed.

 1 of 10

 A colleague takes credit
 for your work in a meeting.
 Before you say anything,
 what do you check first?

 ┌───────────────────────────────┐
 │ Whether the outcome is even   │
 │ within my control.            │
 └───────────────────────────────┘
 ┌───────────────────────────────┐
 │ Which response leaves the     │  ← fold sits below here
 └───────────────────────────────┘
```

First answer row is above the fold at 360×640. Verified target, not an
assumption — Phase 2 measures it.

---

## 2. Quiz question — `/quiz`

Identical composition to the landing block, in `--container-narrow` (560).
This is the point: the transition from landing to quiz is not a transition.

### Desktop / mobile (same layout, 560 container)

```
═══════════════════════════════════════════
  Sophecs                    Quiz  Debate  Lessons
───────────────────────────────────────────

  4 of 10                        ← sans xs
  ────────                       ← 2px ink on 1px border, 40% filled

  Your team can ship a feature   ← serif lg
  that will help most users and
  quietly harm a few. What
  settles it?

  ┌─────────────────────────────┐
  │ ● Whether the harm is       │  ← selected: 2px ink border,
  │   something I chose.        │    filled dot, surface bg
  └─────────────────────────────┘
  ┌─────────────────────────────┐
  │ ○ The total effect across   │
  │   everyone it touches.      │
  └─────────────────────────────┘
  ┌─────────────────────────────┐
  │ ○ What a decent person      │
  │   would be able to live     │
  │   with.                     │
  └─────────────────────────────┘

  Back                    [ Next ]   ← secondary / primary
```

No card-within-card: the answer rows sit directly on paper, no wrapping
container. Progress is "4 of 10" plus a plain filled rule — the brief allows
`01/02/03` markers where content is a real sequence, and quiz progress is.
No transition between questions; the content changes.

Selected state is border-weight plus a filled radio, never colour — the
answer rows must be distinguishable in greyscale.

---

## 3. Quiz result — `/quiz/result` and `/r/[id]`

### Desktop (720 reading container)

```
═════════════════════════════════════════════════════
  Sophecs                     Quiz  Debate  Lessons
─────────────────────────────────────────────────────

  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓
  ▓                                                 ▓  ← the ONE saturated
  ▓                                                 ▓     surface. Square.
  ▓  “Of things some are in our power, and          ▓     No shadow.
  ▓   others are not.”                              ▓     1200×630.
  ▓                                                 ▓
  ▓  Epictetus, Enchiridion, ch. 1                  ▓
  ▓                                                 ▓
  ▓  ─────────────────────────────────────────      ▓
  ▓                                                 ▓
  ▓  Stoicism                                       ▓
  ▓                                                 ▓
  ▓  Which school do you think in?                  ▓
  ▓  sophecs.com                                    ▓
  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓

  [ Share ]   Copy link   Save image        ← primary + two text actions

─────────────────────────────────────────────────────

  Before you argue                            ← sans lg heading
  What is up to us                            ← serif lg

  The Enchiridion opens with a sorting. Some things    ← serif md, 66ch
  are up to us and some are not, Epictetus says, and
  he gives both lists…

  Epictetus, Enchiridion, ch. 1               ← citation, sans sm, ink-soft

─────────────────────────────────────────────────────

  Defend it                                   ← sans lg
  The quiz gives you a starting position…

  [ Take a motion ]        Read the lessons

─────────────────────────────────────────────────────
  FOOTER
═════════════════════════════════════════════════════
```

### Mobile (360)

Card full-bleed to the 24px gutter, share row wraps to two lines, everything
else stacks. Card aspect stays 1200:630 via container-query units so the
on-screen card and the OG render are the same tree — already true today and
preserved.

The card carries school only. No name, on screen or in either image.

### The card's typography

Five elements, in this order, and nothing else. Sizes are fractions of the
card's width; the pixel figures are what those come to on each canvas.

| | face | landscape 1200×630 | portrait 1080×1350 |
|---|---|---|---|
| Quotation | Spectral italic 400 | 44px | 70px |
| Source | Spectral italic 400 | 21px, 80% | 28px, 80% |
| Hairline | — | 1px, ink at 22%, 88% of width | same |
| School name | Spectral 500 roman | 60px | 136px |
| Question | IBM Plex Sans 400 | 24px | 40px |
| `sophecs.com` | IBM Plex Sans 400 | 46px | 105px |

No mono anywhere: the card holds no measured value. No eyebrow: with the
quotation leading and the address closing, the label it used to carry
(`SOPHECS · YOUR SCHOOL`, mono small caps with a middle dot) had nothing
left to say.

The quotation leads and the name resolves it. That inversion is the card's
one deliberate risk — a label with a caption under it is a badge, which is
what every quiz result on the internet looks like; a sentence with its
source under it and the name below the rule is a book plate.

**Two scales, not one scaled off the other.** A 1200×630 thumbnail in a
feed and a 1080×1350 frame on a phone are different objects, and the second
is not the first with more room. On the landscape card the quotation is the
largest element; on the portrait one the name is, by a clear margin, and
most of the extra height goes into the gaps rather than the type. Both fill
their content box to the same degree — measured at 90/96/96% across the
three schools on landscape and 90/97/97% on portrait.

**The closing block is two lines, and it is the call to action.** A link
preview is often served around 300px wide, where everything is a quarter of
its authored size; a single line holding the question and the address puts
the address at four or five pixels. Split, the address is set at 46px — the
second most visible element after the school name, ahead of the quotation —
and lands at 11.5px in a 300px preview. Both lines are at full opacity.

**Line counts are measured, not modelled.** Dividing a string's total width
by the box underestimates, because greedy wrapping wastes whatever a word
does not fill: Bentham's quote divides to 2.9 lines on the portrait and
really sets to four. The margins below are empirical — how far the box can
move before the count changes.

| canvas | element | lines (Sto / Uti / Vir) | tightest margin |
|---|---|---|---|
| landscape | quote 44px | 1 / 2 / 2 | shrink 9%, grow >40% |
| landscape | source 21px | 1 / 1 / 1 | shrink 39% |
| portrait | quote 70px | 2 / 4 / 4 | shrink 16%, grow 6% |
| portrait | source 28px | 1 / 1 / 1 | shrink 9% |

Chromium and Satori shape the same face to slightly different widths, so a
string near a boundary wraps in one engine and not the other — at an
earlier size the Epictetus quote set one line on screen and two in the PNG.
The two engines diverge by well under 1% here, so 6% is a wide margin. Only
the landscape canvas renders in both engines; `/r/[id]` and `/quiz/result`
are always 1200×630, so the portrait margins guard against an edited quote
reflowing rather than against a disagreement.

**Editing a `one_line` or a `one_line_attribution` in
`content/schools/*.md` means re-deriving this table.**

---

## 4. Debate arena index — `/debate`

A list, not a grid. Each row is a table row, not a card.

### Desktop (960 UI container)

```
═══════════════════════════════════════════════════════════════════
  Sophecs                                Quiz  Debate  Lessons  Me
───────────────────────────────────────────────────────────────────

  Motions                                          ← serif xl

  Showing  [ All ▾ ]  [ Any status ▾ ]             ← plain selects
                                                      radius-control

  ─────────────────────────────────────────────────────────────────
  MOTION                              STATUS        YOUR BEST   ELO
  ─────────────────────────────────────────────────────────────────
  Borrowed judgement                  Judged              72   1206
    Handing your daily choices to an                              ↑ mono,
    AI assistant costs you something                          tabular,
    Your stance: the only thing that                       right-aligned
    is truly yours is the faculty…
  ─────────────────────────────────────────────────────────────────
  The careful builder                 Awaiting verdict     —      —
    A team that tested, audited and
    deployed with care…
  ─────────────────────────────────────────────────────────────────
  Crash arithmetic                    Open                 —      —
  ─────────────────────────────────────────────────────────────────

  FOOTER
═══════════════════════════════════════════════════════════════════
```

Status is a word in `--ink-mid`, not a pill, not a dot, not an icon. The
user's stance line is pulled from the topic's `stances[school]` and only
renders when they have a school.

### Mobile (360)

```
═══════════════════════════════════
 Sophecs                       ☰
───────────────────────────────────
 Motions

 [ All ▾ ]   [ Any status ▾ ]

 ───────────────────────────────
 Borrowed judgement
 Handing your daily choices to
 an AI assistant costs you
 something that matters…
 Judged      72       1206
 ───────────────────────────────
 The careful builder
 A team that tested, audited…
 Awaiting verdict
 ───────────────────────────────
```

Columns collapse to a single metadata line. No horizontal scroll: the table
becomes a definition list below 768px rather than scrolling.

---

## 5. Single debate / write argument — `/debate/[slug]`

### Desktop (720 reading container)

```
═════════════════════════════════════════════════════
  Sophecs                     Quiz  Debate  Lessons  Me
─────────────────────────────────────────────────────

  Motion                                  ← sans sm, ink-soft

  Handing your daily choices to an AI     ← serif xl, 66ch
  assistant costs you something that
  matters, even when its choices are
  better than yours.

  │ You argue this as a Stoic.            ← 2px --stoic left rule.
                                             The ONLY school colour
                                             on this screen.

  ─────────────────────────────────────────────────────
  ▾ Before you argue: What is up to us     ← disclosure, open by
                                              default on first argument
    The Enchiridion opens with a sorting…
    Epictetus, Enchiridion, ch. 1
  ─────────────────────────────────────────────────────

  Your argument

  ┌───────────────────────────────────────────────┐
  │                                               │
  │                                               │   ← textarea
  │                                               │      surface + border
  │                                               │      radius-control
  │                                               │      serif md
  └───────────────────────────────────────────────┘
  163 / 400 words                         ← mono sm, ink-soft
                                             turns --error over limit

  [ Submit argument ]                     ← opens confirm dialog
```

Confirmation dialog states the consequences in plain terms:

```
  ┌─────────────────────────────────────────┐
  │  Submit this argument?                  │
  │                                         │
  │  It goes to the judge now. You get one  │
  │  verdict and one revision. This motion  │
  │  locks for seven days afterwards.       │
  │                                         │
  │            Cancel    [ Submit ]         │
  └─────────────────────────────────────────┘
```

### Mobile (360)

Same order, full width. The textarea is 12 rows and the word count sits
directly beneath it, above the fold when the keyboard is open.

---

## 6. Verdict — `/debate/[slug]/[debateId]`

### Desktop (720 reading container)

```
═════════════════════════════════════════════════════
  Verdict                                 ← sans sm, ink-soft
  Handing your daily choices to an AI…    ← serif lg, the motion

  ─────────────────────────────────────────────────────
                                        SCORE       ELO
  Overall                                  72       +6      ← mono,
  Fidelity to Stoicism                    8.0               tabular,
  Rigor                                   7.0               right
  Engagement                              6.5
  ─────────────────────────────────────────────────────
  How this was judged                     ← text link to /debate/rubric

  You argued from the sorting rather than around it.  ← serif md, 66ch
  The move from "the assistant chooses better" to
  "therefore nothing is lost" is where it thins…

  ─────────────────────────────────────────────────────
  The objection you left standing
  │ Utilitarianism                        ← 2px --utilitarian rule
  │
  │ You never weighed what the delegation
  │ actually produces…
  │
  │ It stands because your case treats the
  │ faculty as valuable independent of what
  │ it yields.

  [ Answer it ]     Answering does not change your ELO.
                                          ← plain sentence, not a tooltip

  ─────────────────────────────────────────────────────
  After you argue                         ← the "after" micro-lesson
  The strongest objection                 ← serif lg
  …
  J. S. Mill, Utilitarianism, ch. 2       ← citation

  ─────────────────────────────────────────────────────
  Share this verdict
  X     WhatsApp     Copy link            ← no saturated surface here
```

The four axes are a table: label left, value right, mono, tabular. No bars.
The current verdict page draws three horizontal progress bars, which is the
one place the product currently looks like a dashboard.

ELO renders as a signed number (`+6`, `−4`, `0`), never coloured.

### Mobile (360)

Table becomes label/value rows at full width; everything else stacks.

---

## 7. Lessons index — `/lessons`

**This screen depends on an unresolved content question — see report §C.**
The brief describes three modules with estimated reading time and sources
listed per module. There are no modules in `content/`. There are twelve
micro-lessons across six topics, one "before" and one "after" each.

Drawn below as **six topics, each with its two passages** — the structure
that actually exists.

### Desktop (720 reading container)

```
═════════════════════════════════════════════════════
  Lessons                                 ← serif xl

  Every motion comes with two short excerpts from     ← 66ch
  primary sources: one that frames the question
  before you argue, one that puts the strongest
  objection to you afterwards.

  ─────────────────────────────────────────────────────
  Borrowed judgement                      ← serif lg
                                             2 passages · 4 min
  │ What is up to us                      ← before
  │   Epictetus, Enchiridion, ch. 1
  │ The strongest objection               ← after
  │   J. S. Mill, Utilitarianism, ch. 2
                                          ← sources visible on the INDEX
  Argue this motion                       ← text link into the arena
  ─────────────────────────────────────────────────────
  The careful builder
                                             2 passages · 4 min
  │ The lorry driver
  │   Bernard Williams, Moral Luck (1976)
  │ …
  ─────────────────────────────────────────────────────
```

Reading time is computed from word count at 200wpm, rounded to the nearest
minute — the passages are 226–250 words each, so every topic reads "4 min".
That uniformity is honest and I would rather show it than invent variance.

### Mobile (360)

Stacks; source lines wrap under their titles.

---

## 8. Single lesson — `/lessons/[slug]`

### Desktop (720 reading container + left rail)

```
═══════════════════════════════════════════════════════════
              │                                             
  In this     │  Before you argue                           
  passage     │  What is up to us            ← serif xl     
              │  Epictetus, Enchiridion, ch. 1              
  The sorting │                                             
  What you own│  The Enchiridion opens with a sorting. Some 
  The handover│  things are up to us and some are not,      
              │  Epictetus says, and he gives both lists.   
  ───────     │  Up to us: opinion, impulse, desire,        
  Sources     │  aversion, "in a word, whatever is our own  
  Argue this  │  doing."¹                                   
              │                                             
  ← plain     │  Notice what is on the short list…          
    left rail │                                             
    sticky,   │  ───────────────────────────────────        
    no border │  Sources                                    
              │  1. Epictetus, Enchiridion, ch. 1           
              │                                             
              │  Argue this motion                          
═══════════════════════════════════════════════════════════
```

Footnotes are numbered, rendered at the end, and also available inline on
hover (desktop) or tap (mobile) as a small popover. Reading position is
remembered per lesson in `localStorage`, scoped by user id.

### Mobile (360)

Left rail becomes a `<select>` at the top of the passage — a dropdown, per
the brief, and a native select rather than a custom menu so the OS picker
does the work.

```
═══════════════════════════════════
 [ In this passage ▾ ]

 Before you argue
 What is up to us
 Epictetus, Enchiridion, ch. 1

 The Enchiridion opens with a
 sorting. Some things are up to
 us and some are not…
```

**Print:** left rail hidden, footnotes forced to the end, nav and footer
hidden, `--paper` becomes white, ink becomes black, citations retained.

---

## 9. Profile — `/me`

### Desktop (960 UI container)

```
═══════════════════════════════════════════════════════════════
  Your school   Stoicism                  ← sans sm label / serif lg

  ─────────────────────────────────────────────────────────────
  Rating       1206        ← mono xl, tabular
  Percentile   68th        ← mono lg
  Streak       3 days      ← mono lg
  ─────────────────────────────────────────────────────────────

  No flame. No badge. No ring. No bar.

  Open objections                         ← serif lg
  ─────────────────────────────────────────────────────────────
  Borrowed judgement          Utilitarianism        [ Answer ]
  Crash arithmetic            Virtue Ethics         [ Answer ]
  ─────────────────────────────────────────────────────────────

  Your motions                            ← serif lg
  ─────────────────────────────────────────────────────────────
  MOTION                    READ  ARGUED  ANSWERED  CLOSED
  Borrowed judgement          ✓      ✓        ✓        ✓
  Crash arithmetic            ✓      ✓        —        —
  The careful builder         ✓      —        —        —
  ─────────────────────────────────────────────────────────────
```

Case progress becomes a real table with four columns, replacing the current
inline tick strip. `✓` and `—` in ink, plus a per-row `aria-label` naming
each state. The table header is the text label, so nothing depends on
reading a glyph in isolation.

### Mobile (360)

```
═══════════════════════════════════
 Your school
 Stoicism

 Rating      1206
 Percentile  68th
 Streak      3 days

 Open objections
 ───────────────────────────────
 Borrowed judgement
 Utilitarianism
 [ Answer ]
 ───────────────────────────────

 Your motions
 ───────────────────────────────
 Borrowed judgement
 Read ✓  Argued ✓  Answered ✓  Closed ✓
 ───────────────────────────────
```

The four-column table becomes a labelled inline run below 768px.

---

## 10. Shell — every page

### Header

```
  Sophecs            Quiz   Debate   Lessons          Sign in
                                                      ─────────
```

Wordmark in Spectral 500 at `--text-base`. Three links in Plex Sans 400,
`--ink-mid`; the active route is 500 and `--ink` with a 2px ink underline.
Auth state right: "Sign in" when out, display name or "Me" when in. Height
56px, 1px bottom border, no shadow, not sticky.

At 360px the three links collapse behind a `☰` that opens a native
`<details>` disclosure — no overlay, no drawer, no scroll lock.

### Footer

Currently one sentence. The brief requires substantially more.

```
  ─────────────────────────────────────────────────────────────
  Sophecs is a philosophy tool for 15–18 year olds: a ten-question
  quiz that places you in a school of ethics, then motions to
  argue and a judge that scores how faithfully you argued it.

  The site          The schools        About
  Quiz              Stoicism           Who made this
  Debate            Utilitarianism     Contact
  Lessons           Virtue Ethics      Privacy
                                       Sources and method

  Arguments are judged by Claude Sonnet 4.5 against a published
  rubric. The rubric is at /debate/rubric.
  ─────────────────────────────────────────────────────────────
```

**The footer needs three things I cannot write for you** — who made this, a
contact address, and a privacy statement. Flagged in the report; Phase 1
builds the structure with those slots and I will not invent the content.

The judge-model disclosure I *can* write, because it is a fact about the
system, and it links to the rubric that already exists.
