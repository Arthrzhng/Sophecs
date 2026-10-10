# Phase 1A: recon and motion audit

Report only. No loader, component, type, motion or lesson was changed to
produce it. The only files this branch adds are
`content/research/non-western-sources.md` (the research input, saved
verbatim) and this document.

Scope: the staged expansion that adds Confucian role ethics, Ubuntu and
Buddhist ethics alongside the existing three schools. Phase 1 is content
only, and nothing it produces may be visible to a production user.

---

## Part 1: how content is loaded, and everywhere schools are enumerated

### 1.1 The four loaders

Every content loader reads **one named subdirectory**. None of them globs
`content/**`, which is why adding `content/research/` is inert.

| Directory | Loader | How it enumerates | Tolerates a bad file |
|---|---|---|---|
| `content/schools/` | `src/lib/schools.ts:20` | `readdirSync`, keyed by the file's own `id` field | No validation at all. An unknown `id` lands in the record under that key |
| `content/topics/` | `src/lib/topics.ts:18` | `readdirSync`, skips `README.md` | Returns `[]` if the directory is missing |
| `content/micro/` | `src/lib/micro-lessons.ts:73` | `readdirSync`, keyed by `slug` | **Throws at module load**, which fails the build. Deliberate: a malformed micro-lesson would silently swallow a reader's argument prompt |
| `content/modules/` | `src/lib/modules.ts:23` | `readdirSync`, sorted by filename | Skips the file with a `console.warn` for a missing field, an empty body, or an unknown school. Throws only on bad reading marks |

Two further directories under `content/` are read by nothing that walks a
directory: `content/prompts/` (judge and screen prompts, read by path) and
`content/quiz/questions.ts` (a TypeScript module, imported).

**`content/topics/` is not what the running app reads.** `topics.ts` says
so in its own comment: the app reads motions from the `debate_topics`
table, and `scripts/seed-topics.ts` upserts the markdown into it.
`getAllTopicFiles()` is used by the seed script, the `/lessons` index and
`/lessons/[slug]`. This matters for Phase 1F and is picked up in Part 3.

### 1.2 Every place that enumerates schools

There is no single list. There are **three exported constants**, **five
component-local arrays**, **four `Record<SchoolId, …>` maps**, a **zod
enum**, a **union type**, and a **database CHECK constraint**.

| # | Site | What it is | Source of truth |
|---|---|---|---|
| 1 | `src/lib/types.ts:1` | `type SchoolId` union of three string literals | hand-written |
| 2 | `src/lib/types.ts:3` | `SCHOOL_IDS` array | hand-written |
| 3 | `src/lib/footnotes.ts:4` | **a second `SCHOOL_IDS`**, so client components can import it without the `server-only` boundary | hand-written, duplicate of #2 |
| 4 | `src/lib/judge/schema.ts:15` | **a third `SCHOOL_IDS`**, `as const`, feeding `z.enum` in the judge response schema | hand-written |
| 5 | `src/lib/types.ts:5` | `interface SchoolVector` with one numeric field per school | hand-written |
| 6 | `src/lib/school-colors.ts:8, 29, 39, 50` | `SCHOOL_COLORS`, `SCHOOL_ADHERENT`, `SCHOOL_ADHERENT_PLURAL`, `SCHOOL_TEXT_CLASS` | four `Record<SchoolId, …>` |
| 7 | `src/lib/card-tokens.ts:58, 224` | `CARD_SURFACE`, `SCHOOL_MARKER` hex literals for Satori | two `Record<SchoolId, …>` |
| 8 | `src/components/daily-path/chunky.ts:12` | `SCHOOL_CHUNKY` button fill and edge | `Record<SchoolId, …>` |
| 9 | `src/components/nav/SiteFooter.tsx:5` | local `SCHOOLS` array | hand-written |
| 10 | `src/components/lessons/ModuleFilter.tsx:25` | local `SCHOOLS` array | hand-written |
| 11 | `src/components/share/SharePage.tsx:161` | local `ORDER` array | hand-written |
| 12 | `src/app/debate/rubric/page.tsx:15` | local `SCHOOLS` array | hand-written |
| 13 | `src/app/styleguide/daily-path/page.tsx:22` | local `SCHOOLS` array | hand-written |
| 14 | `content/quiz/questions.ts` | every option carries a `SchoolVector` with three weights | hand-written, **frozen** |
| 15 | `supabase/migrations/0001_phase1.sql`, `0002_profiles.sql`, `0003_debates.sql` | `check (school in ('stoicism','utilitarianism','virtue-ethics'))` on three tables | **frozen** |

Consumers that derive from the lists above rather than adding their own:
`/s/[school]` (`generateStaticParams`, and a `404` for anything not in
`SCHOOL_IDS`), `/table` and `src/lib/school-table.ts`, `/today`,
`/lessons`, `src/lib/scoring.ts`, `src/lib/quiz-position.ts`, the landing
page, `src/lib/modules.ts`.

### 1.3 Would adding files to `content/schools/` change what users see?

**No.** For every enumeration site above, the answer is the same and the
reason is the same: **nothing enumerates schools by listing the
directory.** `getAllSchools()` is the only function that reads it, and it
is called from exactly one place.

| Site | Changes if `content/schools/confucian.md` is added? | Why |
|---|---|---|
| `/quiz` | No | Questions and vectors are hand-written in `content/quiz/questions.ts` |
| `/quiz/result` | No | `src/app/quiz/result/page.tsx:14` passes the whole `getAllSchools()` record to `QuizResultClient`, but the client does `schools[pending.primary]` (`QuizResultClient.tsx:116`), a **lookup, never an iteration**. A fourth key is carried into the props and never read |
| `/s/[school]` | No | `generateStaticParams` maps `SCHOOL_IDS`; anything else `notFound()`s (`page.tsx:10, 42`) |
| `/table` (school table) | No | `rankSchools` tallies over `SCHOOL_IDS` (`school-table.ts:92`) |
| `/today` | No | Sorts and tallies by `SCHOOL_IDS` |
| `/lessons` (index) | No | School chips and module ordering come from `SCHOOL_IDS`; module cards come from `getAllModules()`, which **rejects** an unknown school |
| Debate arena school picker | No | A reader's school comes from their profile row, constrained by the database CHECK. There is no picker that lists schools from content |
| OG image routes (`/r/[id]`, `/debate/.../opengraph-image`, `card.png`) | No | Each defaults `let school: SchoolId = "stoicism"` and reads the stored row; colours come from `card-tokens.ts` |
| Footer, rubric, module filter, share page | No | Local hand-written arrays |
| TypeScript types | No, and this is the hard stop | `SchoolId` is a closed union. A file with `id: confucian` is cast with `data.id as SchoolId` at `schools.ts:33` and type-checks silently |

**The one observable effect** of adding a school file today is that
`/quiz/result` serialises a fourth entry into the props sent to the
browser. It is never rendered, but it would be in the page payload. The
Phase 1B draft gate removes even that, which is a good reason for the gate
to live in `getAllSchools()` rather than only at the render sites.

---

## Part 2: motion audit

The six motions in `content/topics/*.md`, read for wording that
presupposes individual autonomy or individual rights, or that leaves
Confucian, Ubuntu or Buddhist reasoning with no purchase.

**Nothing below has been applied.** Slugs are untouched. Three motions are
flagged strongly, two lightly, one not at all.

### 2.1 `borrowed-judgement` — FLAG (strong)

> "Handing **your** daily choices to an AI assistant costs **you**
> something that matters, even when its choices are better than yours."

**The phrase:** `your daily choices` … `costs you something`.

**The problem:** the loss is located inside one person, in their ownership
of their own choosing. All three new traditions have to dispute the
subject of the sentence before they can argue its predicate. Confucian
role ethics holds that persons are constituted through relationships
rather than being an isolated bearer of properties, so the question is
what the handover does to the relationships and their reciprocal
obligations. Ubuntu's maxim locates personhood in others. Buddhist no-self
denies there is the owner the motion presupposes. The motion is arguable
by all three only as a rejection of its frame, which is a worse debate
than the one it could host.

**Proposed reword:** "Handing daily choices to an AI assistant costs
something that matters, even when its choices are better than the ones it
replaces."

Dropping the two possessives leaves the bearer of the loss open, which is
the live question: your faculty of judgement, your relationships, your
community, or an owner that was never there. The three existing stances
survive unchanged; each already names its own bearer.

### 2.2 `moral-training` — FLAG (strong)

> "Training a model on human feedback can make it good **in the same sense
> that habit makes a person good**."

**The phrase:** `in the same sense that habit makes a person good`.

**The problem:** this installs one tradition's developmental theory as the
yardstick. Habituation is Aristotle's account, and the virtue-ethics
stance already written for this motion is Aristotle's answer to it. The
Confucian tradition has at least two well-developed and mutually opposed
accounts of how a person is made good, Mencian and Xunzian, and Buddhist
cultivation makes intention constitutive rather than incidental. Each of
them has to measure itself against an Aristotelian standard instead of
competing with it on level terms.

**Proposed reword:** "Training a model on human feedback can make it good
in the same sense that moral upbringing makes a person good."

`moral upbringing` covers habituation, ritual education and training
without naming whose theory wins. Same length, same shape, and the three
existing stances still answer it.

### 2.3 `no-decision` — FLAG (strong)

> "It is a mistake to say that a language model decides anything."

**The phrase:** the construction itself.

**The problem:** it asks whether deciding is a property this entity has or
lacks. Confucian role ethics denies that agency is a property of an
isolated bearer even in the human case. Buddhist no-self denies there is a
bearer doing the deciding in the human case either. Both must contest the
form of the question rather than answer it. The motion also has no purchase
on what the description *does*, which is where *Analects* 13.3 on the
rectification of names bites hardest, and where the relational worry about
displaced responsibility lives.

**Proposed reword:** "It is a mistake to say that a language model decides
anything, and the mistake matters."

This is additive rather than replacing: the original clause survives
verbatim, so all three existing stances and both micro-lessons stay
accurate, and the second clause gives the relational traditions something
to argue about.

A sharper alternative, "Calling what a language model does a decision puts
responsibility in the wrong place," is a better motion but I am not
proposing it, for a reason worth your judgement: the virtue-ethics stance
already written for this topic says almost exactly that ("calling its
output a decision quietly moves responsibility off the people who trained
it"). Adopting it would make the motion one school's thesis.

### 2.4 `opaque-benefit` — FLAG (light)

> "An AI system that reliably reduces suffering should be deployed even
> where **nobody** can explain its decisions."

**The phrase:** `nobody can explain its decisions`.

**The problem:** `nobody` is unanchored and reads by default as an expert
who could in principle audit the system. That makes explanation the only
counterweight on offer. *Analects* 12.7 makes the confidence of the
governed a constitutive requirement of legitimate government, so the
Confucian objection is about trust and standing rather than about whether
an explanation exists; and the standing Ubuntu caution is that "community"
cannot be treated as a unified stakeholder, so the first question is who
defines the benefit and who was consulted. Neither can be stated without
first supplying the affected party the motion leaves out.

**Proposed reword:** "An AI system that reliably reduces suffering should
be deployed even where the people it decides about cannot be told why."

Caveat worth your attention: this shifts the claim from an epistemic fact
about the system to a fact about disclosure. The Stoic and Utilitarian
stances survive; the virtue-ethics stance ("nobody can act with practical
wisdom on the strength of a result they cannot deliberate about") changes
subject from the deployer to the affected person and may want a word.

### 2.5 `careful-builder` — FLAG (light)

> "When an AI system causes harm, the people who built it **are to blame
> in proportion to the harm**, however careful they were."

**The phrase:** `are to blame in proportion to the harm`.

**The problem:** it fixes the response to harm as apportioned blame, so a
tradition whose distinctive answer is repair and a restored relation can
only argue about the size of the share. This is the mildest of the five
flags: blame is intelligible in all three traditions, and the motion is
genuinely arguable as it stands.

**Proposed reword:** "When an AI system causes harm, the people who built
it owe something in proportion to the harm, however careful they were."

`owe something` admits blame, compensation, repair and apology without
settling which.

**This is the most expensive reword on the list, and I would not do it
without reading §3.6 first.** `content/micro/careful-builder-before.md`
contains a reading-check option whose text is "They are to blame in
proportion to the harm," and a `right` explanation reading "That is the
motion: blame scaled to harm, even after every precaution." Rewording the
motion makes a comprehension question's correct answer no longer the
motion.

### 2.6 `crash-arithmetic` — NOT FLAGGED

> "A self-driving car should be programmed to minimise total deaths in an
> unavoidable crash, even when that means sacrificing its own passenger."

The aggregative frame is the thing under debate here rather than an
assumption smuggled in, which is the opposite of the `moral-training`
problem. The possessive in `its own passenger` is not a defect: it is
precisely the hinge that Confucian graded concern and Mohist impartial
care disagree about, and it is the motion where Metz's "African Reasons
Why Artificial Intelligence Should Not Maximize Utility" is a direct
answer rather than a reframing. No change needed for the new traditions to
have purchase.

---

## Part 3: what recon turned up that blocks later phases

Not asked for, but 1A is the place to find these, and three of them change
what 1B through 1F can deliver.

### 3.1 `getAllModules()` rejects an unknown school, so Phase 1E's modules will not render even in preview

`src/lib/modules.ts:61` skips any module whose `school` is not in
`SCHOOL_IDS`, with a `console.warn`. The three modules Phase 1E asks for
are Ubuntu, Confucian and Buddhist. They would be dropped in preview and
in dev, not only in production.

Three ways out, in my order of preference:

1. **Have the Phase 1B draft gate also relax the school check for drafts.**
   A draft module would load in preview with its school carried as a plain
   string, and still never load in production. Smallest change, keeps the
   type closed.
2. **Ship them as inert files.** Reviewable as text in the pull request,
   not viewable in preview. Zero code change, but you cannot see them.
3. **Widen `SchoolId`.** Out of scope, see §3.2.

**This needs your decision before 1E.**

### 3.2 Widening `SchoolId` is not a content change

`SchoolId` is a closed union, and there are at least eight
`Record<SchoolId, …>` maps that become type errors the moment a fourth
member exists: the four in `school-colors.ts`, two in `card-tokens.ts`,
`SCHOOL_CHUNKY`, and `SchoolVector` in the quiz scoring. It would also
force a fourth weight into every option in `content/quiz/questions.ts`
(frozen), a fourth member in the judge's zod enum (frozen), and a
migration against three CHECK constraints (frozen). Phase 1 cannot touch
it, and Phase 2 should expect this to be most of its work.

### 3.3 A micro-lesson has exactly two positions, and Phase 1D wants a third per motion

`MicroLessonContent.position` is `"before" | "after"`
(`src/lib/lesson-chunks.ts:15`), and three things assume exactly two per
topic:

- `getAllMicroLessons()` sorts on `position === "before" ? -1 : 1`
  (`micro-lessons.ts:106`).
- `/lessons/[slug]` finds the sibling with
  `inTopic.find((l) => l.position !== lesson.position)`, which returns the
  first of two and silently ignores a third.
- `scripts/seed-topics.ts` validates `micro_before` and `micro_after` and
  knows nothing of a third slug.
- Validation branches on one value only. `readingCheckProblems`
  (`lesson-chunks.ts:67`) tests `position === "after"` and allows no
  reading check; **everything else falls through to the `before` branch**
  and must carry exactly two reading-check questions of exactly three
  options each, or `micro-lessons.ts` throws and the build fails. So a
  third position value would not merely lack a slot, it would be forced to
  carry a reading check it was never meant to have.

So "one 'view from elsewhere' lesson per motion" has no slot to attach to.
**This needs your decision before 1D**, and the options are a third
position value plus the sort, sibling and seed changes that implies, or
six standalone lessons that are not attached to a topic at all, or
attaching them as `after` lessons on new pseudo-topics.

### 3.4 There are three copies of `SCHOOL_IDS` and five more local arrays

Listed in §1.2 as sites 2, 3, 4 and 9 to 13. Not a Phase 1 problem,
because Phase 1 adds no school to any of them. It is a Phase 2 problem,
and worth knowing now: a fourth school has to be added in eight places
that no test ties together.

### 3.5 A reworded motion does nothing in production until someone reseeds

The app reads motions from `debate_topics`, not from the markdown. Phase
1F can land a reworded motion file on `main` and production will keep
serving the old text until `npm run seed:topics` is run against the
production database. That is not a deploy, it is a separate manual step,
and no preview gate protects it: the script writes to whatever database
the environment points at. Worth deciding who runs it and when.

### 3.6 Motion text is duplicated in six places outside `content/topics/`

Any reword has to carry these with it:

| Where | What it holds |
|---|---|
| `content/micro/careful-builder-before.md:31, 69, 76, 81` | The motion in the body, **as a reading-check option, and in both the `right` and `wrong` explanations** |
| `content/micro/borrowed-judgement-before.md:31, 79` | The motion paraphrased in the body and in a `wrong` explanation |
| `content/micro/careful-builder-after.md:22` | Paraphrase |
| `content/modules/greatest-happiness.md:38` | Names and paraphrases four of the six motions |
| `src/lib/arena-fixtures.ts:78` | The `opaque-benefit` motion as a hardcoded string |
| `design/layout.md`, `docs/phase2-brief.md` | Documentation copies |

### 3.7 Two content-rule conflicts to resolve before 1C

**Em dashes.** The standing instruction from the restyle was no em dashes
in new copy. The instruction for this work is to match the existing files'
em dash usage, and the existing school files use three, three and five
respectively. The second is more specific and more recent, so unless you
say otherwise the new school files will use em dashes in the same density.

**`one_line` length.** The existing three are 52, 91 and 96 characters,
which is already an 85% spread, so "within 10% of the existing one_line
lengths" has no single referent. Unless you say otherwise I will hold each
new `one_line` inside the existing range, 52 to 96 characters, rather than
10% beyond its top.

### 3.8 Two findings from the research file that constrain 1C

**The Ubuntu attribution cannot be the maxim.** The share-card rule is
that attribution must be a citable text, not a proverb, and the research
file marks the English gloss of *umuntu ngumuntu ngabantu* as having an
UNVERIFIED translator and date. The citable alternative the file does
supply is the *African Charter on Human and Peoples' Rights*, Article 27.1
or 28, official English text, 1981. The file is explicit that the Charter
is compatible with relational African ethics but is not an Ubuntu
scripture, so the `read` will have to say which it is quoting and why.

**Mohism's usable quotations are thin, and one is a UK risk.** *Mozi* 35
in Van Norden's translation is not public domain, and the file marks the
nearest W. P. Mei equivalent as UNVERIFIED. Mei's 1929 edition is US
public domain with **UK status UNVERIFIED**, and Sophecs is a UK site. If
Mohism is used at all in 1D, the safe choice is a paraphrase with no
quotation.

**`gets_wrong` has a house pattern worth matching.** `utilitarianism.md`
opens with a named critic (Rawls) and then adds the sibling schools'
objections; `stoicism.md` and `virtue-ethics.md` are sibling-school voice
throughout. The sibling half presupposes the schools are live in the
product, which the new three are not. So the new files will take the
`utilitarianism.md` shape: the named critic from the research file first
(Matolino and Kwindingwi for Ubuntu, the non-domination paper and Rosenlee
for Confucian, Keown for Buddhist), then one objection from an existing
school, which is safe because those three are live.

---

## What this branch has changed so far

```
content/research/non-western-sources.md   added, research input, read by no loader
docs/phase1-recon.md                      added, this file
```

No loader, type, component, motion, micro-lesson, module or school file
has been touched. No frozen path has been touched.

### Fidelity note on the saved research

Saved verbatim with one exception: curly quotation marks and apostrophes
were normalised to straight ASCII ones, so that text quoted out of it
matches the typography of the existing content files. Em dashes, en
dashes, ellipses and every diacritic are preserved exactly, and the file
carries all eleven UNVERIFIED markers.

## What I need from you to start 1B

1. Approve or amend the five proposed rewordings, and say which to apply
   in 1F. Approving a reword for `careful-builder` or `borrowed-judgement`
   is also approving the micro-lesson edits in §3.6, including a
   reading-check answer.
2. §3.1: how the three draft modules should behave in preview.
3. §3.3: how a third micro-lesson attaches to a motion.
4. §3.7: em dashes, and the `one_line` length target.
